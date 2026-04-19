import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildAmeexParcelForm,
  findAmeexTracking,
  getAmeexErrorMessage,
  isAmeexSuccessResponse,
  parseAmeexResponse,
} from "@/utils/ameex";

/**
 * Confirm an order:
 *  1. Deduct stock for each line item (matched by SKU first, then product_id, then product_name)
 *     by inserting `stock_movements` rows of type 'sale' — the existing
 *     `apply_stock_movement` trigger will decrement `products.stock`.
 *  2. Push the order to the active Ameex delivery provider (creates a parcel,
 *     creates a `deliveries` row, and updates order status to 'shipped').
 *
 * Returns granular errors so the UI can show what failed without rolling back
 * the confirmation itself (the order status stays 'confirmed' even if Ameex
 * fails — the operator can retry from the Delivery page).
 */
export const confirmOrderAndShip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { order_id: string }) => {
    if (!input.order_id) throw new Error("order_id required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const userId = context.userId;

    // 1) Load order + items
    const { data: order, error: orderErr } = await db
      .from("orders")
      .select("*, order_items(id, product_id, product_name, quantity, unit_price)")
      .eq("id", data.order_id)
      .single();

    if (orderErr || !order) {
      throw new Error(orderErr?.message || "Order not found");
    }

    const items = ((order as any).order_items as Array<{
      product_id: string | null;
      product_name: string;
      quantity: number;
      unit_price: number;
    }>) ?? [];

    // 2) Stock deduction (by SKU → product_id → product_name)
    const stockErrors: string[] = [];
    const stockApplied: string[] = [];

    for (const item of items) {
      let productId: string | null = item.product_id;

      // Try to resolve by SKU if product_name looks like a SKU or fallback by name
      if (!productId) {
        // 1) try exact SKU match
        const { data: bySku } = await db
          .from("products")
          .select("id, sku, name")
          .eq("sku", item.product_name)
          .maybeSingle();
        if (bySku) productId = bySku.id;

        // 2) fallback: name match
        if (!productId) {
          const { data: byName } = await db
            .from("products")
            .select("id")
            .eq("name", item.product_name)
            .maybeSingle();
          if (byName) productId = byName.id;
        }
      }

      if (!productId) {
        stockErrors.push(`No product found for "${item.product_name}"`);
        continue;
      }

      const { error: smErr } = await db.from("stock_movements").insert({
        product_id: productId,
        type: "sale",
        quantity: item.quantity,
        unit_cost: item.unit_price,
        order_id: order.id,
        reference: order.reference,
        note: "Auto: order confirmed in Call Center",
        created_by: userId,
      });
      if (smErr) {
        stockErrors.push(`Stock for "${item.product_name}": ${smErr.message}`);
      } else {
        stockApplied.push(item.product_name);
      }
    }

    // 3) Pick active Ameex provider
    const { data: provider, error: provErr } = await db
      .from("delivery_providers")
      .select("*")
      .eq("provider_type", "ameex")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (provErr) {
      return {
        ok: false,
        stock: { applied: stockApplied, errors: stockErrors },
        ameex: { ok: false, error: `Provider lookup failed: ${provErr.message}` },
      };
    }
    if (!provider) {
      return {
        ok: false,
        stock: { applied: stockApplied, errors: stockErrors },
        ameex: {
          ok: false,
          error:
            "No active Ameex provider configured. Add one in Integrations → Delivery providers.",
        },
      };
    }

    // 4) Push to Ameex
    const form = buildAmeexParcelForm({ order, items, provider });

    const url = `${provider.base_url}/customer/Delivery/Parcels/Action/Type/Add`;

    let res: Response;
    let text = "";
    let parsed: any = null;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "C-Api-Id": provider.api_id, "C-Api-Key": provider.api_key },
        body: form,
      });
      text = await res.text();
      parsed = parseAmeexResponse(text);
    } catch (err: any) {
      await db.from("integration_logs").insert({
        provider_type: "delivery",
        provider_id: provider.id,
        direction: "outgoing",
        endpoint: url,
        status: "error",
        error: err?.message || "Network error",
      });
      return {
        ok: false,
        stock: { applied: stockApplied, errors: stockErrors },
        ameex: { ok: false, error: `Network: ${err?.message || "fetch failed"}` },
      };
    }

    const trackingNumber = findAmeexTracking(parsed);
    const rawAmeexError = getAmeexErrorMessage(parsed);
    const ameexError =
      rawAmeexError?.includes("CRBT") && Number(order.total_amount) <= 0
        ? "Ameex requires a positive order amount before creating a parcel. Update the order total, then retry."
        : rawAmeexError;
    const ameexSuccess = isAmeexSuccessResponse(parsed);

    await db.from("integration_logs").insert({
      provider_type: "delivery",
      provider_id: provider.id,
      direction: "outgoing",
      endpoint: url,
      http_status: res.status,
      status: res.ok && ameexSuccess && trackingNumber ? "success" : "error",
      payload: { request: { order_id: order.id }, response: parsed },
      error: res.ok ? (ameexSuccess && trackingNumber ? null : ameexError || "No tracking number returned") : `HTTP ${res.status}`,
    });

    if (!res.ok) {
      return {
        ok: false,
        stock: { applied: stockApplied, errors: stockErrors },
        ameex: {
          ok: false,
          error: `Ameex HTTP ${res.status}: ${parsed?.message || parsed?.error || text.slice(0, 200)}`,
        },
      };
    }

    if (!ameexSuccess) {
      return {
        ok: false,
        stock: { applied: stockApplied, errors: stockErrors },
        ameex: {
          ok: false,
          error: ameexError || `Ameex request failed. Response: ${JSON.stringify(parsed).slice(0, 250)}`,
          response: parsed,
        },
      };
    }

    if (!trackingNumber) {
      const snippet = JSON.stringify(parsed).slice(0, 250);
      return {
        ok: false,
        stock: { applied: stockApplied, errors: stockErrors },
        ameex: {
          ok: false,
          error: `Ameex did not return a tracking number. Response: ${snippet}`,
          response: parsed,
        },
      };
    }

    await db.from("deliveries").upsert(
      {
        order_id: order.id,
        carrier: provider.name,
        tracking_number: trackingNumber,
        provider_id: provider.id,
        status: "pending",
      },
      { onConflict: "order_id" },
    );

    await db
      .from("orders")
      .update({ status: "shipped", shipped_at: new Date().toISOString() })
      .eq("id", order.id);

    await db
      .from("delivery_providers")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", provider.id);

    return {
      ok: stockErrors.length === 0,
      stock: { applied: stockApplied, errors: stockErrors },
      ameex: { ok: true, tracking_number: trackingNumber },
    };
  });
