export type CallCenterOrderItem = {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
};

export type MatchedProduct = {
  id: string;
  sku: string | null;
  name: string;
};

function normalizeProductText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildLooseNamePattern(value: string) {
  const tokens = normalizeProductText(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

  return tokens.length ? `%${tokens.join("%")}%` : null;
}

export async function resolveProductForOrderItem(
  db: any,
  item: CallCenterOrderItem,
): Promise<MatchedProduct | null> {
  const rawItemLabel = item.product_name?.trim() || "";
  const normalizedItemLabel = normalizeProductText(rawItemLabel);
  const looseNamePattern = buildLooseNamePattern(rawItemLabel);

  if (item.product_id) {
    const { data: byId } = await db
      .from("products")
      .select("id, sku, name")
      .eq("id", item.product_id)
      .maybeSingle();

    if (byId) return byId;
  }

  if (rawItemLabel) {
    const { data: bySku } = await db
      .from("products")
      .select("id, sku, name")
      .eq("sku", rawItemLabel)
      .maybeSingle();

    if (bySku) return bySku;
  }

  if (rawItemLabel) {
    const { data: byName } = await db
      .from("products")
      .select("id, sku, name")
      .eq("name", rawItemLabel)
      .maybeSingle();

    if (byName) return byName;
  }

  if (looseNamePattern) {
    const { data: fuzzyMatches } = await db
      .from("products")
      .select("id, sku, name")
      .ilike("name", looseNamePattern)
      .limit(10);

    const normalizedMatch = fuzzyMatches?.find(
      (product: MatchedProduct) => normalizeProductText(product.name) === normalizedItemLabel,
    );

    if (normalizedMatch) return normalizedMatch;

    if (fuzzyMatches?.length === 1) return fuzzyMatches[0];
  }

  return null;
}
