import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildAmeexParcelForm,
  findAmeexTracking,
  getAmeexErrorMessage,
  isAmeexSuccessResponse,
  parseAmeexResponse,
} from "@/utils/ameex";

type Role = "admin" | "moderator" | "agent" | "media_buyer";

async function assertStaff(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "moderator"]);
  if (error || !data?.length) throw new Error("Forbidden: admin/moderator only");
}

function randomToken(len = 32) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function logIntegration(supabase: any, entry: {
  provider_type: string;
  provider_id?: string | null;
  direction: string;
  endpoint?: string;
  http_status?: number;
  status: "success" | "error";
  payload?: unknown;
  error?: string;
}) {
  try {
    await supabase.from("integration_logs").insert({
      provider_type: entry.provider_type,
      provider_id: entry.provider_id ?? null,
      direction: entry.direction,
      endpoint: entry.endpoint ?? null,
      http_status: entry.http_status ?? null,
      status: entry.status,
      payload: entry.payload ? (entry.payload as any) : null,
      error: entry.error ?? null,
    });
  } catch (error) {
    console.error("Failed to write integration log", error);
  }
}

// =================== LISTS ===================

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const db = context.supabase;
    const [shopify, sheets, providers, logs] = await Promise.all([
      db
        .from("shopify_stores")
        .select("*")
        .order("created_at", { ascending: false }),
      db
        .from("google_sheets_integrations")
        .select("*")
        .order("created_at", { ascending: false }),
      db
        .from("delivery_providers")
        .select("*")
        .order("created_at", { ascending: false }),
      db
        .from("integration_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    return {
      shopify: shopify.data ?? [],
      sheets: sheets.data ?? [],
      providers: providers.data ?? [],
      logs: logs.data ?? [],
    };
  });

// =================== SHOPIFY ===================

export const createShopifyStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; domain: string; webhook_secret?: string }) => {
    if (!input.name || !input.domain) throw new Error("Name and domain required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const webhook_secret = data.webhook_secret?.trim() || randomToken(24);
    const { data: row, error } = await context.supabase
      .from("shopify_stores")
      .insert({
        name: data.name,
        domain: data.domain.replace(/^https?:\/\//, "").replace(/\/$/, ""),
        webhook_secret,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const testShopifyWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; base_url: string }) => {
    if (!input.id) throw new Error("Store id required");
    if (!input.base_url) throw new Error("Base URL required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const db = context.supabase;

    const { data: store, error } = await db
      .from("shopify_stores")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !store) throw new Error("Store not found");

    // Build a minimal Shopify-like order payload
    const samplePayload = {
      id: `test-${Date.now()}`,
      total_price: "0.00",
      customer: { first_name: "Webhook", last_name: "Test", phone: "" },
      shipping_address: {
        name: "Webhook Test",
        phone: "",
        city: "Test City",
        province: null,
        address1: "Test address",
        address2: null,
      },
      line_items: [],
    };
    const body = JSON.stringify(samplePayload);

    // Sign with the store's secret so the webhook accepts it
    const cryptoMod = await import("crypto");
    const signature = cryptoMod
      .createHmac("sha256", store.webhook_secret)
      .update(body, "utf8")
      .digest("base64");

    const url = `${data.base_url.replace(/\/$/, "")}/api/webhooks/shopify/${store.id}`;

    let httpStatus = 0;
    let responseText = "";
    let networkError: string | undefined;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-shopify-hmac-sha256": signature,
          "x-shopify-topic": "orders/create",
        },
        body,
      });
      httpStatus = res.status;
      responseText = (await res.text()).slice(0, 500);
    } catch (err: any) {
      networkError = err?.message ?? "Network error";
    }

    return {
      url,
      http_status: httpStatus,
      body: responseText,
      error: networkError,
    };
  });

export const updateShopifyStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id: string; name?: string; domain?: string; webhook_secret?: string }) => {
      if (!input.id) throw new Error("Store id required");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) patch.name = data.name;
    if (data.domain !== undefined)
      patch.domain = data.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (data.webhook_secret !== undefined) {
      const secret = data.webhook_secret.trim();
      if (!secret) throw new Error("Webhook secret cannot be empty");
      patch.webhook_secret = secret;
    }
    const { data: row, error } = await context.supabase
      .from("shopify_stores")
      .update(patch as any)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteShopifyStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase.from("shopify_stores").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// =================== GOOGLE SHEETS ===================

export const createSheetsIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      name: string;
      direction: "import" | "export";
      spreadsheet_id: string;
      sheet_name: string;
      column_mapping: Record<string, string>;
    }) => {
      if (!input.name || !input.spreadsheet_id) throw new Error("Name and spreadsheet ID required");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("google_sheets_integrations")
      .insert({
        name: data.name,
        direction: data.direction,
        spreadsheet_id: data.spreadsheet_id,
        sheet_name: data.sheet_name || "Sheet1",
        column_mapping: data.column_mapping ?? {},
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSheetsIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("google_sheets_integrations")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const syncSheetNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; provider_token?: string }) => input)
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const db = context.supabase;

    const { data: integ, error: ie } = await db
      .from("google_sheets_integrations")
      .select("*")
      .eq("id", data.id)
      .single();
    if (ie || !integ) throw new Error("Integration not found");

    const token = data.provider_token || integ.access_token;
    if (!token) {
      await logIntegration(db, {
        provider_type: "sheets",
        provider_id: integ.id,
        direction: "outgoing",
        status: "error",
        error: "No Google access token. Please reconnect Google.",
      });
      throw new Error("Missing Google access token. Please reconnect.");
    }

    if (integ.direction !== "import") {
      throw new Error("Export direction not yet implemented");
    }

    const range = encodeURIComponent(`${integ.sheet_name}!A1:Z1000`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${integ.spreadsheet_id}/values/${range}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json: any = await res.json();

    await logIntegration(db, {
      provider_type: "sheets",
      provider_id: integ.id,
      direction: "outgoing",
      endpoint: url,
      http_status: res.status,
      status: res.ok ? "success" : "error",
      payload: json,
      error: res.ok ? undefined : json?.error?.message ?? "Sheets API error",
    });

    if (!res.ok) throw new Error(json?.error?.message ?? "Sheets API error");

    const rows: string[][] = json.values ?? [];
    if (rows.length < 2) return { imported: 0 };

    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const mapping = (integ.column_mapping ?? {}) as Record<string, string>;
    const colIdx = (field: string) => {
      const wanted = (mapping[field] || field).toLowerCase();
      return headers.indexOf(wanted);
    };

    const nameI = colIdx("customer_name");
    const phoneI = colIdx("customer_phone");
    const cityI = colIdx("city");
    const addrI = colIdx("shipping_address");
    const totalI = colIdx("total_amount");
    const productI = colIdx("product_name");
    const extI = colIdx("external_order_id");

    let imported = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const phone = phoneI >= 0 ? r[phoneI] : "";
      const name = nameI >= 0 ? r[nameI] : "";
      if (!phone || !name) continue;

      const externalId = extI >= 0 ? r[extI] : `sheet-${integ.id.slice(0, 6)}-${i}`;
      const { data: exists } = await db
        .from("orders")
        .select("id")
        .eq("external_order_id", externalId)
        .maybeSingle();
      if (exists) continue;

      const { data: order, error: oe } = await db
        .from("orders")
        .insert({
          customer_name: name,
          customer_phone: phone,
          city: cityI >= 0 ? r[cityI] : null,
          shipping_address: addrI >= 0 ? r[addrI] : null,
          total_amount: totalI >= 0 ? Number(r[totalI]) || 0 : 0,
          source: "google_sheet",
          external_order_id: externalId,
          store_id: integ.store_id,
        })
        .select()
        .single();

      if (!oe && order && productI >= 0 && r[productI]) {
        await db.from("order_items").insert({
          order_id: order.id,
          product_name: r[productI],
          quantity: 1,
          unit_price: totalI >= 0 ? Number(r[totalI]) || 0 : 0,
        });
      }
      if (!oe) imported++;
    }

    await db
      .from("google_sheets_integrations")
      .update({
        last_sync_at: new Date().toISOString(),
        access_token: token,
      })
      .eq("id", integ.id);

    return { imported };
  });

// =================== DELIVERY PROVIDERS ===================

export const createDeliveryProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      name: string;
      provider_type: string;
      api_id: string;
      api_key: string;
      business_id?: string;
      base_url?: string;
    }) => {
      if (!input.name || !input.api_id || !input.api_key)
        throw new Error("Name, API ID and API key required");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const webhook_token = randomToken(24);
    const { data: row, error } = await context.supabase
      .from("delivery_providers")
      .insert({
        name: data.name,
        provider_type: data.provider_type || "ameex",
        api_id: data.api_id,
        api_key: data.api_key,
        business_id: data.business_id?.trim() || null,
        base_url: data.base_url || "https://api.ameex.app",
        webhook_token,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateDeliveryProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      name?: string;
      provider_type?: string;
      api_id?: string;
      api_key?: string;
      business_id?: string;
      base_url?: string;
    }) => {
      if (!input.id) throw new Error("Provider id required");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const patch: Record<string, any> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.provider_type !== undefined) patch.provider_type = data.provider_type;
    if (data.api_id !== undefined) patch.api_id = data.api_id;
    if (data.api_key !== undefined) patch.api_key = data.api_key;
    if (data.business_id !== undefined) patch.business_id = data.business_id.trim() || null;
    if (data.base_url !== undefined) patch.base_url = data.base_url;
    patch.updated_at = new Date().toISOString();

    const { data: row, error } = await context.supabase
      .from("delivery_providers")
      .update(patch as any)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteDeliveryProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("delivery_providers")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testDeliveryProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const db = context.supabase;
    const { data: p, error } = await db
      .from("delivery_providers")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !p) throw new Error("Provider not found");

    const url = `${p.base_url}/customer/Delivery/Parcels/Info?ParcelCode=TEST_PING`;
    const res = await fetch(url, {
      headers: { "C-Api-Id": p.api_id, "C-Api-Key": p.api_key },
    });
    const text = await res.text();

    await logIntegration(db, {
      provider_type: "delivery",
      provider_id: p.id,
      direction: "outgoing",
      endpoint: url,
      http_status: res.status,
      status: res.status < 500 ? "success" : "error",
      payload: { body: text.slice(0, 500) },
    });

    return { http_status: res.status, body: text.slice(0, 200) };
  });

export const sendOrderToAmeex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { order_id: string; provider_id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const db = context.supabase;

    const [{ data: order }, { data: provider }] = await Promise.all([
      db
        .from("orders")
        .select("*, order_items(product_name, quantity)")
        .eq("id", data.order_id)
        .single(),
      db
        .from("delivery_providers")
        .select("*")
        .eq("id", data.provider_id)
        .single(),
    ]);

    if (!order) throw new Error("Order not found");
    if (!provider) throw new Error("Provider not found");

    const items = (order.order_items as any[]) ?? [];
    const form = buildAmeexParcelForm({ order, items, provider });

    const url = `${provider.base_url}/customer/Delivery/Parcels/Action/Type/Add`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "C-Api-Id": provider.api_id, "C-Api-Key": provider.api_key },
      body: form,
    });
    const text = await res.text();
    const parsed = parseAmeexResponse(text);
    const trackingNumber = findAmeexTracking(parsed);
    const rawAmeexError = getAmeexErrorMessage(parsed);
    const ameexError =
      rawAmeexError?.includes("CRBT") && Number(order.total_amount) <= 0
        ? "Ameex requires a positive order amount before creating a parcel. Update the order total, then retry."
        : rawAmeexError;
    const ameexSuccess = isAmeexSuccessResponse(parsed);

    await logIntegration(db, {
      provider_type: "delivery",
      provider_id: provider.id,
      direction: "outgoing",
      endpoint: url,
      http_status: res.status,
      status: res.ok && ameexSuccess && !!trackingNumber ? "success" : "error",
      payload: { request: { order_id: order.id }, response: parsed },
      error: res.ok ? (ameexSuccess && trackingNumber ? undefined : ameexError || "No tracking number returned") : `HTTP ${res.status}`,
    });

    if (!res.ok) throw new Error(`Ameex error: HTTP ${res.status}`);
    if (!ameexSuccess) throw new Error(ameexError || "Ameex rejected the parcel request");

    if (trackingNumber) {
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
    }

    await db
      .from("delivery_providers")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", provider.id);

    return { tracking_number: trackingNumber, response: parsed };
  });
