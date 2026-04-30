import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAmeexApiBase } from "@/utils/ameex";
import { mapAmeexStatusToCrm } from "@/utils/ameex-status";

/**
 * Cron-triggered Ameex sync.
 *
 * Polls Ameex for the status of every delivery that is still pending /
 * in_transit / shipped, and updates orders + deliveries when Ameex reports
 * a new status. Mirrors the polling cron from the PHP implementation.
 *
 * Trigger via pg_cron every 30 minutes. Idempotent (status mapping converges).
 */
async function runAmeexSync() {
  const startedAt = Date.now();
  const result = {
    checked: 0,
    updated: 0,
    unchanged: 0,
    errors: [] as Array<{ tracking: string; error: string }>,
  };

  const { data: provider } = await supabaseAdmin
    .from("delivery_providers")
    .select("*")
    .eq("provider_type", "ameex")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!provider) {
    return { ok: false, error: "No active Ameex provider configured", result };
  }

  const { data: pending } = await supabaseAdmin
    .from("deliveries")
    .select("id, order_id, tracking_number, status")
    .eq("carrier", provider.name)
    .in("status", ["pending", "in_transit"])
    .not("tracking_number", "is", null)
    .limit(200);

  if (!pending || pending.length === 0) {
    return { ok: true, result, durationMs: Date.now() - startedAt };
  }

  const base = getAmeexApiBase(provider);
  const trackingUrl = `${base}/customer/Parcels/Tracking`;

  for (const row of pending) {
    const tracking = row.tracking_number as string;
    result.checked += 1;

    try {
      const res = await fetch(trackingUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AUTH-ID": provider.api_id || "",
          "X-AUTH-KEY": provider.api_key || "",
        },
        body: JSON.stringify({ code: tracking }),
      });

      const text = await res.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text };
      }

      const t =
        parsed?.TRACKING ||
        parsed?.tracking ||
        parsed?.["TRACKING-STATUS"] ||
        parsed?.data ||
        {};
      const statut = t.STATUT || t.statut || parsed?.STATUT || parsed?.statut;
      const statutS = t.STATUT_S || t.statut_s || parsed?.STATUT_S || parsed?.statut_s;
      const comment = t.COMMENT || t.comment || "";

      const mapping = mapAmeexStatusToCrm(statut, statutS);

      if (!mapping) {
        await supabaseAdmin.from("integration_logs").insert({
          provider_type: "delivery",
          provider_id: provider.id,
          direction: "incoming",
          endpoint: trackingUrl,
          http_status: res.status,
          status: res.ok ? "success" : "error",
          payload: { tracking, response: parsed },
          error: res.ok ? "Unknown Ameex status" : `HTTP ${res.status}`,
        });
        result.unchanged += 1;
        continue;
      }

      const newStatus = mapping.crmStatus;
      if (row.status === newStatus) {
        result.unchanged += 1;
        continue;
      }

      const orderPatch: any = { status: newStatus };
      if (newStatus === "delivered") orderPatch.delivered_at = new Date().toISOString();
      if (newStatus === "returned" || newStatus === "refused")
        orderPatch.returned_at = new Date().toISOString();
      await supabaseAdmin.from("orders").update(orderPatch).eq("id", row.order_id);

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
        await supabaseAdmin.from("deliveries").update(delPatch).eq("id", row.id);
      }

      const histNote = [
        `Ameex sync: ${statut}${statutS ? ` / ${statutS}` : ""}`,
        comment ? `(${comment})` : "",
      ]
        .filter(Boolean)
        .join(" ")
        .slice(0, 500);

      await supabaseAdmin.from("order_status_history").insert({
        order_id: row.order_id,
        to_status: newStatus,
        note: histNote,
      });

      result.updated += 1;
    } catch (err: any) {
      result.errors.push({ tracking, error: err?.message || "fetch failed" });
      await supabaseAdmin.from("integration_logs").insert({
        provider_type: "delivery",
        provider_id: provider.id,
        direction: "incoming",
        endpoint: trackingUrl,
        status: "error",
        error: err?.message || "fetch failed",
        payload: { tracking },
      });
    }
  }

  await supabaseAdmin
    .from("delivery_providers")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", provider.id);

  return { ok: true, result, durationMs: Date.now() - startedAt };
}

export const Route = createFileRoute("/api/public/cron/ameex-sync")({
  server: {
    handlers: {
      POST: async () => {
        const out = await runAmeexSync();
        return Response.json(out);
      },
      GET: async () => {
        const out = await runAmeexSync();
        return Response.json(out);
      },
    },
  },
});
