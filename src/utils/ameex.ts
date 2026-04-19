type AmeexItem = {
  product_name: string;
  quantity: number;
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

  const apiId = provider.api_id?.trim();
  return apiId || null;
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
  const productLabel = items.map((item) => `${item.product_name} x${item.quantity}`).join(", ") || "Order";
  const businessId = getAmeexBusinessId(provider);
  const codAmount = normalizeAmount(order.total_amount);

  form.append("type", "SIMPLE");
  form.append("order_num", order.reference);
  form.append("replace", "true");
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
  form.append("product", productLabel);
  form.append("cod", String(codAmount));

  if (businessId) {
    form.append("business", businessId);
  }

  if (codAmount > 0) {
    form.append("CRBT", "0");
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