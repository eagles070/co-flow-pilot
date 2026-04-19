import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function mapAmeexStatus(statut: string, statutS?: string) {
  const s = (statut || "").toUpperCase();
  const sub = (statutS || "").toUpperCase();
  if (s === "DELIVERED") return "delivered";
  if (s === "RETURNED") return "returned";
  if (s === "REFUSED") return "refused";
  if (s === "DISTRIBUTION") return "in_transit";
  if (s === "IN_PROGRESS") {
    if (sub === "POSTPONED") return "postponed";
    return "in_transit";
  }
  return null;
}

export const Route = createFileRoute("/api/webhooks/ameex/$providerId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const providerId = params.providerId;
        const url = new URL(request.url);
        const tokenQ = url.searchParams.get("token");

        const { data: provider } = await supabaseAdmin
          .from("delivery_providers")
          .select("*")
          .eq("id", providerId)
          .single();

        if (!provider) return new Response("Not found", { status: 404 });
        if (tokenQ !== provider.webhook_token) {
          await supabaseAdmin.from("integration_logs").insert({
            provider_type: "delivery",
            provider_id: providerId,
            direction: "incoming",
            endpoint: "/api/webhooks/ameex",
            http_status: 401,
            status: "error",
            error: "Invalid webhook token",
          });
          return new Response("Unauthorized", { status: 401 });
        }

        // Ameex sends application/x-www-form-urlencoded
        const ct = request.headers.get("content-type") || "";
        let body: Record<string, string> = {};
        if (ct.includes("application/json")) {
          body = await request.json();
        } else {
          const form = await request.formData();
          for (const [k, v] of form.entries()) body[k] = String(v);
        }

        const code = body.CODE || body.code;
        const statut = body.STATUT || body.statut;
        const statutS = body.STATUT_S || body.statut_s;
        const newStatus = mapAmeexStatus(statut, statutS);

        if (code && newStatus) {
          const { data: del } = await supabaseAdmin
            .from("deliveries")
            .select("order_id")
            .eq("tracking_number", code)
            .maybeSingle();

          if (del?.order_id) {
            const patch: any = { status: newStatus };
            if (newStatus === "delivered") patch.delivered_at = new Date().toISOString();
            if (newStatus === "returned") patch.returned_at = new Date().toISOString();
            await supabaseAdmin.from("orders").update(patch).eq("id", del.order_id);

            const delPatch: any = {};
            if (newStatus === "delivered") {
              delPatch.status = "delivered";
              delPatch.delivered_at = new Date().toISOString();
            } else if (newStatus === "returned" || newStatus === "refused") {
              delPatch.status = newStatus;
              delPatch.returned_at = new Date().toISOString();
            } else if (newStatus === "in_transit") {
              delPatch.status = "in_transit";
            }
            if (Object.keys(delPatch).length) {
              await supabaseAdmin
                .from("deliveries")
                .update(delPatch)
                .eq("tracking_number", code);
            }
          }
        }

        await supabaseAdmin.from("integration_logs").insert({
          provider_type: "delivery",
          provider_id: providerId,
          direction: "incoming",
          endpoint: "/api/webhooks/ameex",
          http_status: 200,
          status: "success",
          payload: body,
        });

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
