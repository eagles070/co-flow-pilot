import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Public endpoint receiving rows pushed from a Google Sheet (via Apps Script).
 *
 * Accepts a JSON body shaped like one of:
 *   { row: ["name","phone","city","address","product","qty","price","source","note"] }
 *   { values: { customer_name, customer_phone, city, shipping_address, product_name,
 *               quantity, total_amount, source, note } }
 *
 * The integration row also stores a token in `column_mapping.webhook_token` that
 * is checked via the `?token=` query param.
 */
export const Route = createFileRoute("/api/webhooks/sheets/$id")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const id = params.id;
        const url = new URL(request.url);
        const token = url.searchParams.get("token") || "";

        const { data: integ } = await supabaseAdmin
          .from("google_sheets_integrations")
          .select("*")
          .eq("id", id)
          .single();

        if (!integ) return new Response("Integration not found", { status: 404 });

        const mapping = (integ.column_mapping ?? {}) as Record<string, any>;
        const expectedToken = mapping.webhook_token as string | undefined;
        if (!expectedToken || token !== expectedToken) {
          await supabaseAdmin.from("integration_logs").insert({
            provider_type: "sheets",
            provider_id: id,
            direction: "incoming",
            endpoint: "/api/webhooks/sheets",
            http_status: 401,
            status: "error",
            error: "Invalid token",
          });
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(await request.text());
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        // Normalize row → fields
        const fromRow = (row: any[]) => ({
          customer_name: row[0],
          customer_phone: String(row[1] ?? ""),
          city: row[2] ?? null,
          shipping_address: row[3] ?? null,
          product_name: row[4] ?? null,
          quantity: Number(row[5] ?? 1) || 1,
          total_amount: Number(row[6] ?? 0) || 0,
          source_label: row[7] ?? null,
          note: row[8] ?? null,
        });

        const v = Array.isArray(payload?.row)
          ? fromRow(payload.row)
          : { ...payload?.values };

        if (!v.customer_name || !v.customer_phone) {
          return new Response("Missing customer_name or customer_phone", { status: 400 });
        }

        const externalId = payload?.external_id || `sheet-${id.slice(0, 6)}-${Date.now()}`;

        // Skip duplicates by external_order_id
        const { data: exists } = await supabaseAdmin
          .from("orders")
          .select("id")
          .eq("external_order_id", externalId)
          .maybeSingle();
        if (exists) {
          return new Response(JSON.stringify({ ok: true, duplicate: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { data: order, error: oe } = await supabaseAdmin
          .from("orders")
          .insert({
            customer_name: v.customer_name,
            customer_phone: v.customer_phone,
            city: v.city,
            shipping_address: v.shipping_address,
            total_amount: Number(v.total_amount) || 0,
            notes: v.note ?? null,
            source: "google_sheet",
            external_order_id: externalId,
            store_id: integ.store_id,
          })
          .select()
          .single();

        if (oe) {
          await supabaseAdmin.from("integration_logs").insert({
            provider_type: "sheets",
            provider_id: id,
            direction: "incoming",
            endpoint: "/api/webhooks/sheets",
            http_status: 500,
            status: "error",
            error: oe.message,
          });
          return new Response("DB error: " + oe.message, { status: 500 });
        }

        if (order && v.product_name) {
          await supabaseAdmin.from("order_items").insert({
            order_id: order.id,
            product_name: String(v.product_name),
            quantity: Number(v.quantity) || 1,
            unit_price: Number(v.total_amount) || 0,
          });
        }

        await supabaseAdmin.from("integration_logs").insert({
          provider_type: "sheets",
          provider_id: id,
          direction: "incoming",
          endpoint: "/api/webhooks/sheets",
          http_status: 200,
          status: "success",
          payload: payload as any,
        });

        await supabaseAdmin
          .from("google_sheets_integrations")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("id", id);

        return new Response(JSON.stringify({ ok: true, order_id: order?.id }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
