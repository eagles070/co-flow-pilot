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
  api_key?: string | null;
  business_id?: string | null;
  base_url?: string | null;
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

export function getAmeexApiBase(provider: AmeexProvider): string {
  const rawBase = provider.base_url?.trim() || "https://cdn.ameex.ma/app/api";
  const normalizedBase = rawBase.replace(/\/+$/, "");

  // Legacy Ameex app/login hosts return an HTML/JSON login page instead of the API.
  // Force the documented API host whenever an old host is still saved in settings.
  if (/^https?:\/\/api\.ameex\.app(?:\/.*)?$/i.test(normalizedBase)) {
    return "https://cdn.ameex.ma/app/api";
  }

  if (/^https?:\/\/cdn\.ameex\.ma(?:\/app)?$/i.test(normalizedBase)) {
    return "https://cdn.ameex.ma/app/api";
  }

  return normalizedBase;
}

/**
 * Build the JSON payload Ameex actually accepts for stock parcels.
 * Direct API verification showed the accepted shape is:
 *   - PUT + application/json
 *   - Uppercase keys
 *   - PRODUCTS object map: { SKU: qty }
 * Lowercase / form-data variants made Ameex drop receiver/phone/address.
 */
export function buildAmeexParcelPayload({
  order,
  items,
  provider,
}: {
  order: AmeexOrder;
  items: AmeexItem[];
  provider: AmeexProvider;
}): {
  payload: Record<string, any>;
  fromStock: boolean;
  stockItemsCount: number;
} {
  const businessId = getAmeexBusinessId(provider);
  const codAmount = normalizeAmount(order.total_amount);

  // Human-readable nature/comment fields (so product names appear in Ameex UI)
  const itemSummary = items
    .map((item) => `${item.product_name?.trim() || item.sku?.trim() || "Produit"} x${item.quantity}`)
    .join(", ");
  const comment = [itemSummary, order.notes?.trim()].filter(Boolean).join(" | ").slice(0, 240);

  // Build PRODUCTS map: { "SKU1": qty1, "SKU2": qty2 }
  const productsMap: Record<string, number> = {};
  let stockItemsCount = 0;
  for (const item of items) {
    const sku = item.sku?.trim();
    if (!sku) continue;
    // If duplicate SKU, sum quantities
    productsMap[sku] = (productsMap[sku] || 0) + item.quantity;
    stockItemsCount += 1;
  }

  const fromStock = stockItemsCount > 0;

  // Ameex only reads the parcel fields reliably when they are sent in the
  // legacy uppercase JSON shape. City still needs the canonical Ameex city id.
  const cityValue = order.ameex_city_id?.trim() || "";

  const payload: Record<string, any> = {
    TYPE: fromStock ? "STOCK" : "SAMPLE",
    ORDER_NUM: order.ameex_order_label?.trim() || order.reference,
    RECEIVER: order.customer_name,
    PHONE: order.customer_phone,
    CITY: cityValue,
    ADDRESS: order.shipping_address || "N/A",
    COD: codAmount,
    COMMENT: comment,
    NATURE_PRODUCT: itemSummary || "Produit",
    REPLACE: "false",
    OPEN: "YES",
    TRY: "YES",
    FRAGILE: "0",
  };

  if (fromStock) payload.PRODUCTS = productsMap;

  if (businessId) {
    payload.BUSINESS = businessId;
  }

  if (!businessId) {
    console.warn("[ameex] Missing business_id on provider — parcel may be misclassified.");
  }

  console.log("[ameex] Built payload:", JSON.stringify(payload));
  console.log("[ameex] fromStock:", fromStock, "stockItemsCount:", stockItemsCount);

  return { payload, fromStock, stockItemsCount };
}

/**
 * Resolve the correct Ameex endpoint URL.
 * Stock parcels use /customer/Parcels/AddParcelStock,
 * sample/manual use /customer/Parcels/AddParcel.
 */
export function getAmeexEndpoint(provider: AmeexProvider, fromStock: boolean): string {
  const base = getAmeexApiBase(provider);
  return fromStock
    ? `${base}/customer/Parcels/AddParcelStock`
    : `${base}/customer/Parcels/AddParcel`;
}

/** Headers for Ameex API requests (matches the working PHP cURL setup).
 * PHP sends CURLOPT_POSTFIELDS as an array → cURL serializes it as
 * multipart/form-data. We mirror that with FormData. IMPORTANT: do NOT set
 * Content-Type here; fetch() will add it with the correct boundary.
 */
export function getAmeexHeaders(provider: AmeexProvider): Record<string, string> {
  return {
    "X-AUTH-ID": provider.api_id || "",
    "X-AUTH-KEY": provider.api_key || "",
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

/** Encode a payload object as JSON, matching the Ameex variant that preserves all fields. */
export function encodeAmeexBody(payload: Record<string, any>): string {
  return JSON.stringify(payload);
}

export function parseAmeexResponse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export function isAmeexSuccessResponse(payload: any) {
  // PHP just looks for ADD-PARCEL.NEW-PARCEL.TRACKING-NUMBER. If present -> success.
  if (findAmeexTracking(payload)) return true;
  const apiType = payload?.api?.type;
  if (apiType) return apiType === "success";
  return false;
}

export function getAmeexErrorMessage(payload: any): string | null {
  return (
    payload?.["ADD-PARCEL"]?.MESSAGE ||
    payload?.["PARCEL_INFO"]?.RESULT?.MESSAGE ||
    payload?.api?.msg ||
    payload?.message ||
    payload?.error ||
    payload?.["ADD-PARCEL"]?.error ||
    payload?.["ADD-PARCEL"]?.message ||
    null
  );
}

export function findAmeexTracking(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;

  // Primary: PHP-style response shape
  const direct =
    payload?.["ADD-PARCEL"]?.["NEW-PARCEL"]?.["TRACKING-NUMBER"] ||
    payload?.["ADD-PARCEL"]?.["NEW-PARCEL"]?.["tracking_number"];
  if (direct && typeof direct === "string") return direct.trim();
  if (typeof direct === "number") return String(direct);

  const keys = [
    "TRACKING-NUMBER",
    "tracking_number",
    "tracking",
    "TRACKING",
    "code",
    "CODE",
    "parcel_code",
    "PARCEL_CODE",
    "parcel",
    "PARCEL",
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

// ---------------------------------------------------------------------------
// Backwards-compat shim: old callers used buildAmeexParcelForm() returning a
// FormData. Keep the export but route it through the new JSON payload helper
// so any straggler import still works (returns a FormData snapshot of the
// payload, not used by the main flow anymore).
// ---------------------------------------------------------------------------
export function buildAmeexParcelForm(args: {
  order: AmeexOrder;
  items: AmeexItem[];
  provider: AmeexProvider;
}): FormData {
  const { payload } = buildAmeexParcelPayload(args);
  const form = new FormData();
  for (const [k, v] of Object.entries(payload)) {
    form.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  return form;
}
