import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AmeexCity = {
  id: string;
  code: string;
  name: string;
};

/**
 * Fetch the canonical city list from Ameex (id + name + code).
 * Used by Settings → Cities to map our local cities to Ameex city IDs.
 */
export const fetchAmeexCities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; cities: AmeexCity[]; error?: string }> => {
    const db = context.supabase;

    const { data: provider, error: provErr } = await db
      .from("delivery_providers")
      .select("id, base_url, api_id, api_key")
      .eq("provider_type", "ameex")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (provErr) return { ok: false, cities: [], error: provErr.message };
    if (!provider)
      return { ok: false, cities: [], error: "No active Ameex provider configured." };

    const url = `${provider.base_url}/customer/Delivery/Cities/List`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "C-Api-Id": provider.api_id, "C-Api-Key": provider.api_key },
      });
      const text = await res.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        return { ok: false, cities: [], error: `Invalid JSON from Ameex: ${text.slice(0, 200)}` };
      }

      const raw = parsed?.api?.cities;
      if (!raw || typeof raw !== "object") {
        return {
          ok: false,
          cities: [],
          error: parsed?.api?.msg || "Ameex returned no cities.",
        };
      }

      const cities: AmeexCity[] = Object.values(raw)
        .map((c: any) => ({
          id: String(c?.id ?? ""),
          code: String(c?.code ?? ""),
          name: String(c?.name ?? ""),
        }))
        .filter((c) => c.id && c.name)
        .sort((a, b) => a.name.localeCompare(b.name));

      return { ok: true, cities };
    } catch (err: any) {
      return { ok: false, cities: [], error: err?.message || "Network error" };
    }
  });
