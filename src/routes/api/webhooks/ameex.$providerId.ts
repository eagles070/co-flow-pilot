import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mapAmeexStatusToCrm } from "@/utils/ameex-status";

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

        // Ameex sends application/x-www-form-urlencoded (sometimes JSON)
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
        const comment = body.COMMENT || body.comment || "";
        const mapping = mapAmeexStatusToCrm(statut, statutS);

        if (code && mapping) {
          const { data: del } = await supabaseAdmin
            .from("deliveries")
            .select("order_id")
            .eq("tracking_number", code)
            .maybeSingle();

          if (del?.order_id) {
            const newStatus = mapping.crmStatus;

            const patch: any = { status: newStatus };
            if (newStatus === "delivered") patch.delivered_at = new Date().toISOString();
            if (newStatus === "returned" || newStatus === "refused")
              patch.returned_at = new Date().toISOString();
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

            // Append history note (mirrors PHP saveCommandHistory)
            const histNote = [
              `Ameex: ${statut}${statutS ? ` / ${statutS}` : ""}`,
              comment ? `(${comment})` : "",
            ]
              .filter(Boolean)
              .join(" ")
              .slice(0, 500);

            await supabaseAdmin.from("order_status_history").insert({
              order_id: del.order_id,
              to_status: newStatus,
              note: histNote,
            });
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
