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

export async function resolveProductForOrderItem(
  db: any,
  item: CallCenterOrderItem,
): Promise<MatchedProduct | null> {
  const itemLabel = item.product_name?.trim();

  if (itemLabel) {
    const { data: bySku } = await db
      .from("products")
      .select("id, sku, name")
      .eq("sku", itemLabel)
      .maybeSingle();

    if (bySku) return bySku;
  }

  if (item.product_id) {
    const { data: byId } = await db
      .from("products")
      .select("id, sku, name")
      .eq("id", item.product_id)
      .maybeSingle();

    if (byId) return byId;
  }

  if (itemLabel) {
    const { data: byName } = await db
      .from("products")
      .select("id, sku, name")
      .eq("name", itemLabel)
      .maybeSingle();

    if (byName) return byName;
  }

  return null;
}
