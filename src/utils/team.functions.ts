import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Role = "admin" | "moderator" | "agent" | "media_buyer";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden: admin only");
}

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      email: string;
      password: string;
      full_name: string;
      phone?: string;
      role: Role;
      max_orders_per_day?: number;
      max_concurrent_orders?: number;
    }) => {
      if (!input.email || !input.password || !input.full_name || !input.role)
        throw new Error("Missing required fields");
      if (input.password.length < 8) throw new Error("Password must be ≥ 8 chars");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (createErr || !created.user) throw new Error(createErr?.message ?? "Create failed");

    const uid = created.user.id;

    // handle_new_user() trigger inserts default profile + role; override here.
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone ?? null,
        max_orders_per_day: data.max_orders_per_day ?? 100,
        max_concurrent_orders: data.max_concurrent_orders ?? 20,
      })
      .eq("id", uid);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });

    return { id: uid };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      user_id: string;
      full_name?: string;
      phone?: string | null;
      is_active?: boolean;
      role?: Role;
      max_orders_per_day?: number;
      max_concurrent_orders?: number;
    }) => {
      if (!input.user_id) throw new Error("user_id required");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId && data.role) {
      throw new Error("You cannot change your own role.");
    }

    const profilePatch: Record<string, unknown> = {};
    if (data.full_name !== undefined) profilePatch.full_name = data.full_name;
    if (data.phone !== undefined) profilePatch.phone = data.phone;
    if (data.is_active !== undefined) profilePatch.is_active = data.is_active;
    if (data.max_orders_per_day !== undefined)
      profilePatch.max_orders_per_day = data.max_orders_per_day;
    if (data.max_concurrent_orders !== undefined)
      profilePatch.max_concurrent_orders = data.max_concurrent_orders;

    if (Object.keys(profilePatch).length) {
      await supabaseAdmin.from("profiles").update(profilePatch).eq("id", data.user_id);
    }

    if (data.role) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
      await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role });
    }

    // Disable login by banning when inactive
    if (data.is_active !== undefined) {
      await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
        ban_duration: data.is_active ? "none" : "876000h",
      });
    }

    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string }) => {
    if (!input.user_id) throw new Error("user_id required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("You cannot delete yourself.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
