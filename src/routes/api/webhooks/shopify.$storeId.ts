import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import crypto from "crypto";

export const Route = createFileRoute("/api/webhooks/shopify/$storeId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const storeId = params.storeId;
        const body = await request.text();
        const signature = request.headers.get("x-shopify-hmac-sha256") || "";

        const { data: store } = await supabaseAdmin
          .from("shopify_stores")
          .select("*")
          .eq("id", storeId)
          .single();

        if (!store) {
          return new Response("Store not found", { status: 404 });
        }

        const computed = crypto
          .createHmac("sha256", store.webhook_secret)
          .update(body, "utf8")
          .digest("base64");

        let valid = false;
        try {
          valid =
            signature.length === computed.length &&
            crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
        } catch {
          valid = false;
        }

        if (!valid) {
          await supabaseAdmin.from("integration_logs").insert({
            provider_type: "shopify",
            provider_id: storeId,
            direction: "incoming",
            endpoint: "/api/webhooks/shopify",
            http_status: 401,
            status: "error",
            error: "HMAC verification failed",
          });
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        try {
          const customer = payload.customer || {};
          const shipping = payload.shipping_address || {};
          const lineItems = payload.line_items || [];
          const externalId = String(payload.id || payload.order_id || "");

          const { data: existing } = await supabaseAdmin
            .from("orders")
            .select("id")
            .eq("external_order_id", externalId)
            .maybeSingle();

          if (!existing) {
            const { data: order } = await supabaseAdmin
              .from("orders")
              .insert({
                customer_name:
                  shipping.name ||
                  `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() ||
                  "Unknown",
                customer_phone: shipping.phone || customer.phone || "",
                city: shipping.city ?? null,
                region: shipping.province ?? null,
                shipping_address:
                  [shipping.address1, shipping.address2].filter(Boolean).join(", ") || null,
                total_amount: Number(payload.total_price) || 0,
                source: "shopify",
                external_order_id: externalId,
                store_id: store.store_id,
              })
              .select()
              .single();

            if (order && lineItems.length) {
              await supabaseAdmin.from("order_items").insert(
                lineItems.map((li: any) => ({
                  order_id: order.id,
                  product_name: li.title || li.name || "Item",
                  quantity: Number(li.quantity) || 1,
                  unit_price: Number(li.price) || 0,
                })),
              );
            }
          }

          await supabaseAdmin
            .from("shopify_stores")
            .update({ last_sync_at: new Date().toISOString() })
            .eq("id", storeId);

          await supabaseAdmin.from("integration_logs").insert({
            provider_type: "shopify",
            provider_id: storeId,
            direction: "incoming",
            endpoint: "/api/webhooks/shopify",
            http_status: 200,
            status: "success",
            payload: { order_id: externalId },
          });

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          await supabaseAdmin.from("integration_logs").insert({
            provider_type: "shopify",
            provider_id: storeId,
            direction: "incoming",
            endpoint: "/api/webhooks/shopify",
            http_status: 500,
            status: "error",
            error: err.message,
            payload,
          });
          return new Response("Server error", { status: 500 });
        }
      },
    },
  },
});
