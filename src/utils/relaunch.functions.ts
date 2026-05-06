import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAmeexApiBase } from "@/utils/ameex";

/**
 * Find an old eligible parcel to relaunch for the given order.
 * Match: same city + at least one common product (by product_id or product_name),
 * status in (cancelled/returned/refused/no_reply) and relaunch_eligible = true.
 */
export const findRelaunchCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { order_id: string }) => {
    if (!input.order_id) throw new Error("order_id required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const db = context.supabase;

    const { data: order } = await db
      .from("orders")
      .select("id, city, order_items(product_id, product_name)")
      .eq("id", data.order_id)
      .single();
    if (!order || !order.city) return { candidate: null };

    const items = (order as any).order_items ?? [];
    if (items.length === 0) return { candidate: null };

    const productIds = items.map((i: any) => i.product_id).filter(Boolean);
    const productNames = items.map((i: any) => (i.product_name || "").trim()).filter(Boolean);

    // Get candidate orders: eligible, same city, not the same order
    const { data: candidates } = await db
      .from("orders")
      .select(`id, reference, status, city, previous_status, created_at,
               order_items(product_id, product_name),
               deliveries(tracking_number)`)
      .eq("relaunch_eligible", true)
      .ilike("city", order.city)
      .neq("id", data.order_id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!candidates || candidates.length === 0) return { candidate: null };

    for (const cand of candidates as any[]) {
      const cItems = cand.order_items ?? [];
      const matches = cItems.some(
        (ci: any) =>
          (ci.product_id && productIds.includes(ci.product_id)) ||
          productNames.some(
            (n: string) => n.toLowerCase() === (ci.product_name || "").toLowerCase(),
          ),
      );
      const tracking = cand.deliveries?.[0]?.tracking_number;
      if (matches && tracking) {
        return {
          candidate: {
            order_id: cand.id,
            reference: cand.reference,
            status: cand.status,
            previous_status: cand.previous_status,
            parcel_code: tracking,
          },
        };
      }
    }
    return { candidate: null };
  });

/**
 * Trigger Ameex RelaunchNew for an existing parcel, reusing the original
 * parcel tracking number, but pushing the new order's customer data.
 */
export const relaunchAmeexParcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { new_order_id: string; old_order_id: string; parcel_code: string }) => {
    if (!input.new_order_id || !input.old_order_id || !input.parcel_code) {
      throw new Error("new_order_id, old_order_id and parcel_code are required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const userId = context.userId;

    // Load new order to get fresh customer data
    const { data: newOrder, error: ne } = await db
      .from("orders")
      .select("*, order_items(product_name, quantity)")
      .eq("id", data.new_order_id)
      .single();
    if (ne || !newOrder) throw new Error(ne?.message || "New order not found");

    // Load old order for previous_status logging
    const { data: oldOrder } = await db
      .from("orders")
      .select("status")
      .eq("id", data.old_order_id)
      .maybeSingle();

    // Active Ameex provider
    const { data: provider } = await db
      .from("delivery_providers")
      .select("*")
      .eq("provider_type", "ameex")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!provider) throw new Error("No active Ameex provider configured");

    const itemsSummary = ((newOrder as any).order_items ?? [])
      .map((i: any) => `${i.product_name} x${i.quantity}`)
      .join(", ");

    const base = getAmeexApiBase(provider);
    const url = `${base}/customer/Delivery/Parcels/Action/Type/RelaunchNew?ParcelCode=${encodeURIComponent(
      data.parcel_code,
    )}`;

    const fd = new FormData();
    fd.append("order_num", newOrder.reference || "");
    fd.append("receiver", newOrder.customer_name || "");
    fd.append("phone", newOrder.customer_phone || "");
    fd.append("city", newOrder.city || "");
    fd.append("address", newOrder.shipping_address || "");
    fd.append(
      "comment",
      [itemsSummary, newOrder.comment_colis, newOrder.notes].filter(Boolean).join(" | ").slice(0, 240),
    );
    fd.append("price", String(Number(newOrder.total_amount) || 0));

    let res: Response | null = null;
    let text = "";
    let parsed: any = null;
    let errorMsg: string | null = null;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "C-Api-Id": provider.api_id || "",
          "C-Api-Key": provider.api_key || "",
        },
        body: fd,
      });
      text = await res.text();
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text };
      }
      if (!res.ok) errorMsg = `HTTP ${res.status}: ${text.slice(0, 200)}`;
    } catch (err: any) {
      errorMsg = err?.message || "Network error";
    }

    const ok = !errorMsg;

    // Log integration call
    await db.from("integration_logs").insert({
      provider_type: "delivery",
      provider_id: provider.id,
      direction: "outgoing",
      endpoint: url,
      http_status: res?.status ?? null,
      status: ok ? "success" : "error",
      payload: {
        request: {
          new_order_id: data.new_order_id,
          old_order_id: data.old_order_id,
          parcel_code: data.parcel_code,
        },
        response: parsed,
      },
      error: errorMsg,
    });

    // Log relaunch history
    await db.from("relaunch_logs").insert({
      order_id: data.old_order_id,
      new_order_id: data.new_order_id,
      parcel_code: data.parcel_code,
      previous_status: oldOrder?.status ?? null,
      comments: itemsSummary,
      response: parsed,
      status: ok ? "success" : "error",
      relaunched_by: userId,
    });

    if (ok) {
      // Mark new order shipped, reuse parcel code
      await db
        .from("orders")
        .update({
          status: "shipped",
          shipped_at: new Date().toISOString(),
          tracking_number: data.parcel_code,
          relaunched_at: new Date().toISOString(),
          relaunched_by: userId,
          previous_status: oldOrder?.status ?? null,
        })
        .eq("id", data.new_order_id);

      // Mark old order no longer eligible
      await db
        .from("orders")
        .update({ relaunch_eligible: false })
        .eq("id", data.old_order_id);

      // Upsert delivery row pointing to the same parcel
      await db.from("deliveries").upsert(
        {
          order_id: data.new_order_id,
          carrier: provider.name,
          tracking_number: data.parcel_code,
          provider_id: provider.id,
          status: "pending",
        },
        { onConflict: "order_id" },
      );
    }

    return {
      ok,
      error: errorMsg,
      parcel_code: data.parcel_code,
      response: parsed,
    };
  });
