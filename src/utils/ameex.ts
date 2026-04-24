type AmeexItem = {
  product_name: string;
  quantity: number;
  sku?: string | null;
};

type AmeexOrder = {
  reference: string;
  customer_name: string;
  customer_phone: string;
  city: string | null;
  /** Numeric Ameex city ID (e.g. "21"). When present, takes priority over `city` name. */
  ameex_city_id?: string | null;
  shipping_address: string | null;
  notes: string | null;
  total_amount: number | string;
};

type AmeexProvider = {
  api_id?: string | null;
  business_id?: string | null;
};

function normalizeAmount(value: number | string) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, amount);
}

export function getAmeexBusinessId(provider: AmeexProvider): string | null {
  const businessId = provider.business_id?.trim();
  if (businessId) return businessId;

  return null;
}

export function buildAmeexParcelForm({
  order,
  items,
  provider,
}: {
  order: AmeexOrder;
  items: AmeexItem[];
  provider: AmeexProvider;
}) {
  const form = new FormData();
  const businessId = getAmeexBusinessId(provider);
  const codAmount = normalizeAmount(order.total_amount);

  if (!businessId) {
    console.warn("[ameex] Missing business_id on provider. Parcel may be classified incorrectly unless Ameex Business ID is configured.");
  }

  // Ameex stock-based parcels should use numeric type "1".
  // `SIMPLE` was still being classified as a sample on their side.
  form.append("type", "1");
  form.append("colis_type", "stock");
  form.append("order_num", order.reference);
  // "replace": "false" => brand new parcel (NOUVEAU COLIS).
  form.append("replace", "false");
  form.append("open", "YES");
  form.append("try", "NO");
  form.append("fragile", "0");
  form.append("receiver", order.customer_name);
  form.append("phone", order.customer_phone);
  // Ameex expects the numeric city ID, not the city name. Fall back to "1" only as last resort.
  const cityValue = order.ameex_city_id?.trim() || order.city || "1";
  form.append("city", cityValue);
  form.append("address", order.shipping_address || "N/A");
  form.append("comment", order.notes || "");

  // Send each line item using the array format `produit[]` / `quantite[]` so
  // Ameex links the parcel to its warehouse stock (instead of treating it as
  // a "sample") and so multiple items are not overwritten.
  // Lines without a SKU are skipped here — the call-center handler already
  // surfaces a missing-SKU warning to the agent via stockErrors.
  items.forEach((item) => {
    console.log("[ameex] ITEM DEBUG:", item);
  });

  for (const item of items) {
    const sku = item.sku?.trim();
    if (!sku) {
      console.warn(
        `[ameex] Missing SKU for product: "${item.product_name}" (qty ${item.quantity}). Skipping produit/quantite for this line.`,
      );
      continue;
    }
    // Use array notation so multiple lines are preserved server-side.
    form.append("produit[]", sku);
    form.append("quantite[]", String(item.quantity));
  }

  form.append("cod", String(codAmount));

  if (businessId) {
    form.append("business", businessId);
  }

  if (codAmount > 0) {
    form.append("CRBT", "0");
  }

  // Debug final form payload sent to Ameex
  for (const pair of form.entries()) {
    console.log("[ameex] AMEEX FIELD:", pair[0], "=", pair[1]);
  }

  return form;
}

export function parseAmeexResponse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export function isAmeexSuccessResponse(payload: any) {
  const apiType = payload?.api?.type;
  return apiType ? apiType === "success" : true;
}

export function getAmeexErrorMessage(payload: any): string | null {
  return payload?.api?.msg || payload?.message || payload?.error || null;
}

export function findAmeexTracking(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;

  const keys = [
    "code",
    "CODE",
    "parcel_code",
    "PARCEL_CODE",
    "parcel",
    "PARCEL",
    "tracking",
    "tracking_number",
    "TRACKING",
    "barcode",
    "BARCODE",
    "num",
    "NUM",
    "order_code",
    "ORDER_CODE",
  ];

  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }

  for (const nestedValue of Object.values(payload)) {
    if (nestedValue && typeof nestedValue === "object") {
      const found = findAmeexTracking(nestedValue);
      if (found) return found;
    }
  }

  return null;
}