import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildAmeexParcelForm,
  findAmeexTracking,
  getAmeexErrorMessage,
  isAmeexSuccessResponse,
  parseAmeexResponse,
} from "@/utils/ameex";
import { resolveProductForOrderItem } from "@/utils/call-center.helpers";

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

    // 2) Stock deduction + prepare Ameex items
    const stockErrors: string[] = [];
    const stockApplied: string[] = [];
    const ameexSkuErrors: string[] = [];
    const ameexItems = [] as Array<{
      product_name: string;
      quantity: number;
      sku?: string | null;
    }>;

    for (const item of items) {
      const matchedProduct = await resolveProductForOrderItem(db, item);
      const productId = matchedProduct?.id ?? null;

      ameexItems.push({
        // Keep the human-readable order label as the original product name.
        // Ameex stock matching uses `sku` only inside buildAmeexParcelForm.
        product_name: item.product_name,
        quantity: item.quantity,
        sku: matchedProduct?.sku ?? null,
      });

      if (!matchedProduct?.sku?.trim()) {
        ameexSkuErrors.push(`Missing SKU for "${item.product_name}"`);
      }

      if (!productId) {
        stockErrors.push(`No product found for SKU/name "${item.product_name}"`);
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
        stockApplied.push(matchedProduct?.sku?.trim() || item.product_name);
      }
    }

    if (ameexSkuErrors.length > 0) {
      return {
        ok: false,
        stock: { applied: stockApplied, errors: stockErrors },
        ameex: {
          ok: false,
          error: `Parcel blocked: ${ameexSkuErrors.join(", ")}. Match each order item to a product with a valid SKU before sending to Ameex.`,
        },
      };
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

    if (!provider.business_id?.trim()) {
      return {
        ok: false,
        stock: { applied: stockApplied, errors: stockErrors },
        ameex: {
          ok: false,
          error:
            "Ameex Business ID is missing in the delivery provider settings. Add the exact Business ID from Ameex before sending so the parcel is treated as stock, not sample.",
        },
      };
    }

    // 4) Resolve Ameex city ID from our cities table (matched by name)
    let ameexCityId: string | null = null;
    if (order.city) {
      const { data: cityRow } = await db
        .from("cities")
        .select("ameex_city_id")
        .ilike("name", order.city)
        .maybeSingle();
      ameexCityId = (cityRow as any)?.ameex_city_id || null;
    }

    if (!ameexCityId) {
      return {
        ok: false,
        stock: { applied: stockApplied, errors: stockErrors },
        ameex: {
          ok: false,
          error: order.city
            ? `City "${order.city}" is not mapped to an Ameex city ID. Open Settings → Cities and pick the matching Ameex city.`
            : "Order has no city. Edit the order and pick a city, then map it in Settings → Cities.",
        },
      };
    }

    // 5) Push to Ameex
    const form = buildAmeexParcelForm({
      order: { ...order, ameex_city_id: ameexCityId } as any,
      items: ameexItems,
      provider,
    });
    const requestFields = Array.from(form.entries()).map(([key, value]) => ({
      key,
      value: String(value),
    }));

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
        payload: {
          request: {
            order_id: order.id,
            items: ameexItems,
            fields: requestFields,
          },
        },
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
      payload: {
        request: {
          order_id: order.id,
          items: ameexItems,
          fields: requestFields,
        },
        response: parsed,
      },
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
