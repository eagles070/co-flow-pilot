import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { AlertTriangle, Headphones, History, Loader2, PhoneCall, Play, RotateCcw } from "lucide-react";
import { HistoriqueTab } from "@/components/call-center/HistoriqueTab";
import type { StatusOpt } from "@/components/call-center/ChangeStatusDialog";
import { confirmOrderAndShip } from "@/utils/call-center.functions";
import { findRelaunchCandidate, relaunchAmeexParcel } from "@/utils/relaunch.functions";
import type { OrderSource, OrderStatus } from "@/lib/order-status";
import { FocusOrderCard, type FocusOrder, type SavePatch } from "@/components/call-center/FocusOrderCard";

function playBeep(kind: "success" | "error") {
  try {
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine";
    if (kind === "success") {
      o.frequency.setValueAtTime(660, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.12);
    } else {
      o.frequency.setValueAtTime(300, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.18);
    }
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    o.start(); o.stop(ctx.currentTime + 0.24);
    setTimeout(() => ctx.close(), 300);
  } catch { /* ignore */ }
}

export const Route = createFileRoute("/_app/call-center")({
  component: CallCenterPage,
});

type Outcome = "confirmed" | "cancelled" | "no_reply" | "wrong_number" | "postponed" | "callback_requested";

function outcomeFor(status: OrderStatus): Outcome {
  switch (status) {
    case "confirmed": return "confirmed";
    case "cancelled": return "cancelled";
    case "no_reply": return "no_reply";
    case "postponed": return "postponed";
    default: return "callback_requested";
  }
}

function CallCenterPage() {
  const { user, hasAnyRole } = useAuth();
  const isStaff = hasAnyRole(["admin", "moderator"]);

  const [mode, setMode] = useState<"idle" | "active">("idle");
  const [pendingCount, setPendingCount] = useState(0);
  const [current, setCurrent] = useState<FocusOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [statuses, setStatuses] = useState<StatusOpt[]>([]);
  const [ameexWarning, setAmeexWarning] = useState<null | "missing_provider" | "missing_business_id">(null);

  const [saving, setSaving] = useState(false);
  const [blacklisted, setBlacklisted] = useState(false);
  const [repeatCount, setRepeatCount] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [callSeconds, setCallSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);
  const [relaunchCandidate, setRelaunchCandidate] = useState<{
    order_id: string; reference: string; status: string; previous_status?: string | null; parcel_code: string;
  } | null>(null);
  const [relaunching, setRelaunching] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "nrp_max_attempts").maybeSingle()
      .then(({ data }) => { if (data?.value) setMaxAttempts(Number(data.value) || 3); });
    supabase.from("stores").select("id, name").eq("is_active", true).order("name")
      .then(({ data }) => setStores((data ?? []) as { id: string; name: string }[]));
    supabase.from("status_configs").select("key, label, color").eq("is_active", true).order("sort_order")
      .then(({ data }) => setStatuses((data ?? []) as StatusOpt[]));
    supabase.from("delivery_providers")
      .select("business_id")
      .eq("provider_type", "ameex").eq("status", "active")
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        if (!data) setAmeexWarning("missing_provider");
        else if (!data.business_id?.trim()) setAmeexWarning("missing_business_id");
        else setAmeexWarning(null);
      });
  }, []);

  const refreshPendingCount = useCallback(async () => {
    let q = supabase.from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "assigned", "no_reply", "postponed"]);
    if (!isStaff && user) q = q.eq("agent_id", user.id);
    const { count } = await q;
    setPendingCount(count ?? 0);
  }, [isStaff, user]);

  useEffect(() => { refreshPendingCount(); }, [refreshPendingCount]);

  // Realtime: refresh pending count + relaunch candidate when orders change
  useEffect(() => {
    const channel = supabase
      .channel("call-center-orders-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        async (payload) => {
          refreshPendingCount();
          const newRow = (payload.new ?? {}) as { id?: string; relaunch_eligible?: boolean; status?: string };
          if (current?.id) {
            // Re-check relaunch candidate when any other order becomes eligible / status changes
            if (newRow.id && newRow.id !== current.id) {
              try {
                const { candidate } = await findRelaunchCandidate({ data: { order_id: current.id } });
                setRelaunchCandidate(candidate ?? null);
                if (candidate && !relaunchCandidate) {
                  toast.info(`Relaunch available · Parcel ${candidate.parcel_code}`);
                }
              } catch { /* ignore */ }
            }
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refreshPendingCount, current?.id, relaunchCandidate]);

  // Call timer
  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setCallSeconds(0);
    if (current) timerRef.current = window.setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [current?.id]);

  const resetToIdle = useCallback(() => {
    setCurrent(null);
    setMode("idle");
    setRelaunchCandidate(null);
    refreshPendingCount();
  }, [refreshPendingCount]);

  const startConfirmation = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("orders")
      .select("*, order_items(product_id, product_name, quantity, unit_price)")
      .in("status", ["new", "assigned", "no_reply", "postponed"])
      .order("created_at", { ascending: true })
      .limit(1);
    if (!isStaff && user) q = q.eq("agent_id", user.id);
    const { data, error } = await q;
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const list = (data ?? []) as unknown as FocusOrder[];
    if (list.length === 0) { toast.info("No pending orders"); refreshPendingCount(); return; }
    const o = list[0];
    setCurrent(o);
    setMode("active");
    setRelaunchCandidate(null);
    const [bl, rp] = await Promise.all([
      supabase.from("blacklist").select("phone").eq("phone", o.customer_phone).maybeSingle(),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_phone", o.customer_phone),
    ]);
    setBlacklisted(!!bl.data);
    setRepeatCount(Math.max(0, (rp.count ?? 1) - 1));
    // Look up a relaunch candidate for this order
    try {
      const { candidate } = await findRelaunchCandidate({ data: { order_id: o.id } });
      if (candidate) setRelaunchCandidate(candidate);
    } catch (e: any) {
      console.warn("[relaunch] candidate lookup failed", e?.message);
    }
  }, [isStaff, user, refreshPendingCount]);

  const handleRelaunch = useCallback(async () => {
    if (!current || !relaunchCandidate) return;
    setRelaunching(true);
    try {
      const result = await relaunchAmeexParcel({
        data: {
          new_order_id: current.id,
          old_order_id: relaunchCandidate.order_id,
          parcel_code: relaunchCandidate.parcel_code,
        },
      });
      if (!result.ok) {
        playBeep("error");
        toast.error(`Relaunch failed: ${result.error}`, { duration: 8000 });
      } else {
        playBeep("success");
        toast.success(`Customer relaunched · Parcel ${result.parcel_code}`);
        resetToIdle();
      }
    } catch (e: any) {
      playBeep("error");
      toast.error(`Relaunch error: ${e?.message ?? e}`);
    } finally {
      setRelaunching(false);
    }
  }, [current, relaunchCandidate, resetToIdle]);


  const handleSaveChanges = useCallback(async (patch: SavePatch) => {
    if (!current) return;
    setSaving(true);
    const { error: oe } = await supabase.from("orders").update({
      customer_name: patch.customer_name,
      customer_phone: patch.customer_phone,
      customer_phone_alt: patch.customer_phone_alt,
      city: patch.city,
      shipping_address: patch.shipping_address,
      notes: patch.notes,
      comment_colis: patch.comment_colis,
      tracking_number: patch.tracking_number,
      discount_amount: patch.discount_amount,
      extra_amount: patch.extra_amount,
      total_amount: patch.total_amount,
    }).eq("id", current.id);
    if (oe) { setSaving(false); toast.error(oe.message); throw oe; }

    await supabase.from("order_items").delete().eq("order_id", current.id);
    if (patch.items.length > 0) {
      const { error: ie } = await supabase.from("order_items").insert(patch.items.map((i) => ({
        order_id: current.id,
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })));
      if (ie) { setSaving(false); toast.error(ie.message); throw ie; }
    }
    // Refresh local order so subsequent operations see latest data
    setCurrent({ ...current, ...patch, order_items: patch.items });
    setSaving(false);
  }, [current]);

  const handleApplyStatus = useCallback(async (newStatus: OrderStatus) => {
    if (!current || !user) return;
    setSaving(true);
    const orderPatch: { status: OrderStatus; agent_id: string | null; confirmed_at?: string } = {
      status: newStatus, agent_id: user.id,
    };
    if (newStatus === "confirmed") orderPatch.confirmed_at = new Date().toISOString();
    const outcome = outcomeFor(newStatus);
    if (outcome === "no_reply" && (current.attempts + 1) >= maxAttempts) orderPatch.agent_id = null;

    const [{ error: oe }, { error: ce }] = await Promise.all([
      supabase.from("orders").update(orderPatch).eq("id", current.id),
      supabase.from("call_attempts").insert({
        order_id: current.id, agent_id: user.id, outcome,
        duration_seconds: callSeconds,
      }),
    ]);
    if (oe || ce) {
      setSaving(false); playBeep("error");
      toast.error(oe?.message || ce?.message || "Save failed");
      return;
    }

    if (newStatus === "confirmed") {
      try {
        const result = await confirmOrderAndShip({ data: { order_id: current.id } });
        const stockErrs = result.stock?.errors ?? [];
        stockErrs.forEach((m) => toast.error(`Stock: ${m}`));
        if (!result.ameex?.ok) {
          playBeep("error");
          toast.error(`Ameex: ${result.ameex?.error ?? "failed"}`, { duration: 8000 });
        } else {
          playBeep("success");
          toast.success(`Confirmed · Tracking ${result.ameex.tracking_number}`);
        }
      } catch (err: any) {
        playBeep("error");
        toast.error(`Confirm pipeline failed: ${err?.message ?? err}`, { duration: 8000 });
      }
    } else {
      playBeep("success");
      toast.success("Order processed");
    }

    setSaving(false);
    resetToIdle();
  }, [current, user, callSeconds, maxAttempts, resetToIdle]);

  return (
    <div>
      <PageHeader
        title="Call Center"
        description={mode === "active" && current
          ? `Processing order · Max attempts: ${maxAttempts}`
          : `${pendingCount} order(s) waiting · Max attempts: ${maxAttempts}`}
        actions={mode === "idle" ? (
          <Button variant="outline" size="sm" onClick={refreshPendingCount}>
            <RotateCcw className="mr-2 h-4 w-4" />Refresh
          </Button>
        ) : null}
      />

      {ameexWarning && (
        <div className="mt-3 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <div className="font-medium">
              {ameexWarning === "missing_provider" ? "No active Ameex delivery provider configured" : "Ameex Business ID is missing"}
            </div>
            <div className="text-xs text-destructive/80">
              {ameexWarning === "missing_provider"
                ? "Confirmed orders will not be sent to Ameex. Add an Ameex provider in Integrations → Delivery providers."
                : "Without a Business ID, Ameex will treat parcels as samples instead of stock orders."}
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="queue" className="mt-2">
        <TabsList>
          <TabsTrigger value="queue"><PhoneCall className="mr-1.5 h-4 w-4" />Queue</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-1.5 h-4 w-4" />Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4">
          {mode === "idle" || !current ? (
            <Card className="mx-auto max-w-2xl">
              <CardContent className="flex flex-col items-center justify-center gap-5 py-16 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <Headphones className="h-10 w-10 text-primary" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-semibold tracking-tight">Ready to confirm?</h2>
                  <p className="text-sm text-muted-foreground">
                    Click below to start processing orders, one at a time.
                  </p>
                </div>
                <Badge variant="secondary" className="gap-1.5">
                  <PhoneCall className="h-3.5 w-3.5" />{pendingCount} pending
                </Badge>
                <Button size="lg" onClick={startConfirmation} disabled={loading || pendingCount === 0}
                  className="mt-2 h-12 px-8 text-base">
                  {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
                  Start Confirmation
                </Button>
                {pendingCount === 0 && <p className="text-xs text-muted-foreground">No orders in queue right now.</p>}
              </CardContent>
            </Card>
          ) : (
            <FocusOrderCard
              order={current}
              statuses={statuses}
              callSeconds={callSeconds}
              blacklisted={blacklisted}
              repeatCount={repeatCount}
              maxAttempts={maxAttempts}
              saving={saving}
              onSaveChanges={handleSaveChanges}
              onApplyStatus={handleApplyStatus}
              onClose={resetToIdle}
              relaunchCandidate={relaunchCandidate}
              relaunching={relaunching}
              onRelaunch={handleRelaunch}
            />
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoriqueTab statuses={statuses} stores={stores} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
