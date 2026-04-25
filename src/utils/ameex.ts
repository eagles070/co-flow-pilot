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
  ameex_order_label?: string | null;
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
  const form = new URLSearchParams();
  const businessId = getAmeexBusinessId(provider);
  const codAmount = normalizeAmount(order.total_amount);
  const itemSummary = items
    .map((item) => `${item.quantity}× ${item.product_name?.trim() || item.sku?.trim() || "Produit"}`)
    .join(", ");
  const comment = [itemSummary, order.notes?.trim()].filter(Boolean).join(" | ").slice(0, 240);
  const stockItems = items
    .map((item) => ({
      product_name: item.product_name?.trim() || "Produit",
      quantity: item.quantity,
      sku: item.sku?.trim() || null,
    }))
    .filter((item) => !!item.sku);

  if (!businessId) {
    console.warn("[ameex] Missing business_id on provider. Parcel may be classified incorrectly unless Ameex Business ID is configured.");
  }

  // Ameex stock-based parcels should use numeric type "1".
  // `SIMPLE` was still being classified as a sample on their side.
  form.append("type", "1");
  form.append("colis_type", "stock");
  form.append("order_num", order.ameex_order_label?.trim() || order.reference);
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
  form.append("comment", comment);

  // Ameex stock parcels expect nested product fields instead of the legacy
  // `produit[]` / `quantite[]` keys. Using `products[index][ref]` preserves
  // every SKU and lets Ameex resolve warehouse stock correctly instead of
  // falling back to a sample parcel.
  // Lines without a SKU are skipped here — the call-center handler already
  // surfaces a missing-SKU warning to the agent via stockErrors.
  items.forEach((item) => {
    console.log("[ameex] ITEM DEBUG:", item);
  });

  for (const [index, item] of stockItems.entries()) {
    const sku = item.sku;
    if (!sku) {
      console.warn(
        `[ameex] Missing SKU for product: "${item.product_name}" (qty ${item.quantity}). Skipping products payload for this line.`,
      );
      continue;
    }

    const productKey = `products[${index}]`;

    // `ref` is the warehouse stock reference (SKU) Ameex uses for stock-based
    // orders. We avoid sending product names here.
    form.append(`${productKey}[id]`, sku);
    form.append(`${productKey}[ref]`, sku);
    form.append(`${productKey}[sku]`, sku);
    form.append(`${productKey}[title]`, item.product_name);
    form.append(`${productKey}[label]`, item.product_name);
    form.append(`${productKey}[name]`, item.product_name);
    form.append(`${productKey}[designation]`, item.product_name);
    form.append(`${productKey}[product_name]`, item.product_name);

    // Quantity naming can vary across partner setups, so we include the common
    // nested quantity aliases while keeping a single source value.
    form.append(`${productKey}[quantity]`, String(item.quantity));
    form.append(`${productKey}[qte]`, String(item.quantity));
    form.append(`${productKey}[qty]`, String(item.quantity));
  }

  form.append("cod", String(codAmount));

  if (businessId) {
    form.append("business", businessId);
  }

  if (codAmount > 0) {
    form.append("CRBT", "0");
  }

  // Debug final form payload sent to Ameex
  for (const [key, value] of form.entries()) {
    console.log("[ameex] AMEEX FIELD:", key, "=", value);
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