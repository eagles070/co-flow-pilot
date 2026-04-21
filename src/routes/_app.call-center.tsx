import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  PhoneCall, CheckCircle2, XCircle, PhoneOff, Clock, RotateCcw,
  AlertTriangle, MapPin, Package as PackageIcon, Copy, MessageCircle, History,
  Keyboard, Repeat, Timer, Loader2, Play, Pencil, Headphones,
} from "lucide-react";
import { EditOrderDialog } from "@/components/orders/EditOrderDialog";
import { HistoriqueTab } from "@/components/call-center/HistoriqueTab";
import type { StatusOpt } from "@/components/call-center/ChangeStatusDialog";
import { confirmOrderAndShip } from "@/utils/call-center.functions";

// Lightweight WebAudio beep — no asset dependency
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
import type { OrderSource, OrderStatus } from "@/lib/order-status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/call-center")({
  component: CallCenterPage,
});

type Outcome = "confirmed" | "cancelled" | "no_reply" | "wrong_number" | "postponed" | "callback_requested";

interface QueueOrder {
  id: string; reference: string; customer_name: string; customer_phone: string;
  customer_phone_alt: string | null; shipping_address: string | null; city: string | null;
  total_amount: number; status: OrderStatus; source: OrderSource; attempts: number;
  notes: string | null; created_at: string; store_id: string | null;
  order_items: { product_name: string; quantity: number; unit_price: number }[];
}

interface HistoryItem {
  kind: "status" | "call";
  at: string;
  label: string;
  detail?: string | null;
}

interface StoreOpt { id: string; name: string }

function fmtTimer(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function CallCenterPage() {
  const { user, hasAnyRole } = useAuth();
  const isStaff = hasAnyRole(["admin", "moderator"]);

  // Workflow state: idle (start screen) → active (one order in focus)
  const [mode, setMode] = useState<"idle" | "active">("idle");
  const [pendingCount, setPendingCount] = useState(0);
  const [current, setCurrent] = useState<QueueOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<StoreOpt[]>([]);
  const [editOpen, setEditOpen] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<StatusOpt[]>([]);
  const [dropdownStatus, setDropdownStatus] = useState<string>("");
  const [ameexWarning, setAmeexWarning] = useState<null | "missing_provider" | "missing_business_id">(null);

  const [note, setNote] = useState("");
  const [recallAt, setRecallAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [blacklisted, setBlacklisted] = useState(false);
  const [repeatCount, setRepeatCount] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [callSeconds, setCallSeconds] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  const noteRef = useRef<HTMLTextAreaElement | null>(null);

  // Initial setup: max attempts + stores list (for edit dialog) + dynamic statuses
  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "nrp_max_attempts").maybeSingle()
      .then(({ data }) => { if (data?.value) setMaxAttempts(Number(data.value) || 3); });
    supabase.from("stores").select("id, name").eq("is_active", true).order("name")
      .then(({ data }) => setStores((data ?? []) as StoreOpt[]));
    supabase.from("status_configs").select("key, label, color").eq("is_active", true).order("sort_order")
      .then(({ data }) => setStatuses((data ?? []) as StatusOpt[]));
  }, []);

  // Count pending orders for the start screen badge
  const refreshPendingCount = useCallback(async () => {
    let q = supabase.from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "assigned", "no_reply", "postponed"]);
    if (!isStaff && user) q = q.eq("agent_id", user.id);
    const { count } = await q;
    setPendingCount(count ?? 0);
  }, [isStaff, user]);

  useEffect(() => { refreshPendingCount(); }, [refreshPendingCount]);

  // Call timer — runs only when an order is active
  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setCallSeconds(0);
    if (current) {
      timerRef.current = window.setInterval(() => setCallSeconds((s) => s + 1), 1000);
    }
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [current?.id]);

  // Auto-focus note input when order loads
  useEffect(() => {
    if (current && noteRef.current) {
      const t = window.setTimeout(() => noteRef.current?.focus(), 120);
      return () => window.clearTimeout(t);
    }
  }, [current?.id]);

  // Reset to start screen
  const resetToIdle = useCallback(() => {
    setCurrent(null);
    setMode("idle");
    setNote("");
    setRecallAt("");
    setHistory([]);
    setDropdownStatus("");
    refreshPendingCount();
  }, [refreshPendingCount]);

  // Fetch ONE order and enter focus mode
  const startConfirmation = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("orders")
      .select("*, order_items(product_name, quantity, unit_price)")
      .in("status", ["new", "assigned", "no_reply", "postponed"])
      .order("created_at", { ascending: true })
      .limit(1);
    if (!isStaff && user) q = q.eq("agent_id", user.id);
    const { data, error } = await q;
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const list = (data ?? []) as unknown as QueueOrder[];
    if (list.length === 0) {
      toast.info("No pending orders");
      refreshPendingCount();
      return;
    }
    const o = list[0];
    setCurrent(o);
    setMode("active");
    setNote(""); setRecallAt(""); setHistory([]); setDropdownStatus("");
    // Side checks
    const [bl, rp] = await Promise.all([
      supabase.from("blacklist").select("phone").eq("phone", o.customer_phone).maybeSingle(),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_phone", o.customer_phone),
    ]);
    setBlacklisted(!!bl.data);
    setRepeatCount(Math.max(0, (rp.count ?? 1) - 1));
  }, [isStaff, user, refreshPendingCount]);

  // Reload current order (used after editing)
  const reloadCurrent = useCallback(async () => {
    if (!current) return;
    const { data } = await supabase.from("orders")
      .select("*, order_items(product_name, quantity, unit_price)")
      .eq("id", current.id).maybeSingle();
    if (data) setCurrent(data as unknown as QueueOrder);
  }, [current]);

  // Save action and return to idle
  const finishAndReset = useCallback(async (newStatus: OrderStatus, outcome: Outcome) => {
    if (!current || !user || saving) return;
    setSaving(true);
    const orderPatch: { status: OrderStatus; agent_id: string; confirmed_at?: string } = {
      status: newStatus, agent_id: user.id,
    };
    if (newStatus === "confirmed") orderPatch.confirmed_at = new Date().toISOString();
    if (outcome === "no_reply" && (current.attempts + 1) >= maxAttempts) {
      orderPatch.agent_id = null as unknown as string;
    }

    const [{ error: oe }, { error: ce }] = await Promise.all([
      supabase.from("orders").update(orderPatch).eq("id", current.id),
      supabase.from("call_attempts").insert({
        order_id: current.id, agent_id: user.id, outcome,
        note: note || null, recall_at: recallAt ? new Date(recallAt).toISOString() : null,
        duration_seconds: callSeconds,
      }),
    ]);
    if (oe || ce) {
      setSaving(false);
      playBeep("error");
      toast.error(oe?.message || ce?.message || "Save failed");
      return;
    }

    // On confirm: deduct stock + push to Ameex automatically
    if (newStatus === "confirmed") {
      try {
        const result = await confirmOrderAndShip({ data: { order_id: current.id } });
        const stockErrs = result.stock?.errors ?? [];
        if (stockErrs.length > 0) {
          stockErrs.forEach((m) => toast.error(`Stock: ${m}`));
        }
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
      playBeep("error");
      toast.success("Order processed");
    }

    setSaving(false);
    resetToIdle();
  }, [current, user, saving, note, recallAt, callSeconds, maxAttempts, resetToIdle]);

  // Skip = return to idle without saving
  const skipOrder = useCallback(() => {
    if (!current) return;
    toast.info("Order skipped");
    resetToIdle();
  }, [current, resetToIdle]);

  // Apply a custom status from the dynamic dropdown (Settings → Statuses)
  const submitDropdownStatus = useCallback(async () => {
    if (!current || !user || saving || !dropdownStatus) return;
    // Map well-known keys to call_attempts.outcome
    const outcomeMap: Record<string, Outcome> = {
      confirmed: "confirmed", cancelled: "cancelled", no_reply: "no_reply",
      postponed: "postponed", duplicate: "cancelled",
    };
    const outcome: Outcome = outcomeMap[dropdownStatus] ?? "callback_requested";
    await finishAndReset(dropdownStatus as OrderStatus, outcome);
  }, [current, user, saving, dropdownStatus, finishAndReset]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (mode !== "active" || !current || saving) return;
      if (e.key === "Enter") { e.preventDefault(); finishAndReset("confirmed", "confirmed"); }
      else if (e.key === "n" || e.key === "N") { e.preventDefault(); finishAndReset("no_reply", "no_reply"); }
      else if (e.key === "c" || e.key === "C") { e.preventDefault(); finishAndReset("cancelled", "cancelled"); }
      else if (e.key === "s" || e.key === "S") { e.preventDefault(); skipOrder(); }
      else if (e.key === "p" || e.key === "P") { e.preventDefault(); finishAndReset("postponed", "postponed"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, current, saving, finishAndReset, skipOrder]);

  const loadHistory = useCallback(async () => {
    if (!current) return;
    const [{ data: hist }, { data: calls }] = await Promise.all([
      supabase.from("order_status_history").select("*").eq("order_id", current.id).order("created_at", { ascending: false }),
      supabase.from("call_attempts").select("*").eq("order_id", current.id).order("created_at", { ascending: false }),
    ]);
    const items: HistoryItem[] = [];
    (hist ?? []).forEach((h) => items.push({
      kind: "status", at: h.created_at,
      label: `${h.from_status ?? "—"} → ${h.to_status}`,
      detail: h.note,
    }));
    (calls ?? []).forEach((c) => items.push({
      kind: "call", at: c.created_at,
      label: `Call: ${c.outcome}${c.duration_seconds ? ` · ${fmtTimer(c.duration_seconds)}` : ""}`,
      detail: c.note,
    }));
    items.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    setHistory(items);
  }, [current]);

  const copyPhone = (phone: string) => {
    navigator.clipboard?.writeText(phone).then(() => toast.success("Phone copied"));
  };

  const itemsTotal = current?.order_items.reduce((s, i) => s + i.quantity * Number(i.unit_price), 0) ?? 0;
  const attemptsColor = current
    ? current.attempts >= 3 ? "bg-destructive text-destructive-foreground"
    : current.attempts === 2 ? "bg-yellow-500 text-white"
    : "bg-muted text-foreground"
    : "";
  const timerColor = callSeconds >= 60 ? "border-destructive text-destructive"
    : callSeconds >= 30 ? "border-yellow-500 text-yellow-600 dark:text-yellow-400"
    : "";
  const nrpLabel = current
    ? (current.attempts + 1) >= maxAttempts ? "Last attempt"
    : current.attempts >= 1 ? `NRP — Retry ${current.attempts}`
    : null
    : null;
  const nrpTone = current && current.attempts >= 2
    ? "bg-destructive text-destructive-foreground"
    : current && current.attempts === 1
    ? "bg-yellow-500 text-white"
    : "";

  return (
    <div>
      <PageHeader
        title="Call Center"
        description={mode === "active" && current
          ? `Processing order · Max attempts: ${maxAttempts}`
          : `${pendingCount} order(s) waiting · Max attempts: ${maxAttempts}`}
        actions={
          mode === "active" ? (
            <Badge variant="outline" className={cn("gap-1.5 font-mono text-sm transition-colors", timerColor)}>
              <Timer className="h-3.5 w-3.5" />{fmtTimer(callSeconds)}
            </Badge>
          ) : (
            <Button variant="outline" size="sm" onClick={refreshPendingCount}>
              <RotateCcw className="mr-2 h-4 w-4" />Refresh
            </Button>
          )
        }
      />

      <Tabs defaultValue="queue" className="mt-2">
        <TabsList>
          <TabsTrigger value="queue"><PhoneCall className="mr-1.5 h-4 w-4" />Queue</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-1.5 h-4 w-4" />Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4">
          {mode === "idle" ? (
            <Card className="mx-auto max-w-2xl">
          <CardContent className="flex flex-col items-center justify-center gap-5 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <Headphones className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-semibold tracking-tight">Ready to confirm?</h2>
              <p className="text-sm text-muted-foreground">
                Click the button below to start processing orders, one at a time.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <PhoneCall className="h-3.5 w-3.5" />{pendingCount} pending
              </Badge>
            </div>
            <Button
              size="lg"
              onClick={startConfirmation}
              disabled={loading || pendingCount === 0}
              className="mt-2 h-12 px-8 text-base"
            >
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
              Start Confirmation
            </Button>
            {pendingCount === 0 && (
              <p className="text-xs text-muted-foreground">No orders in queue right now.</p>
            )}
          </CardContent>
        </Card>
      ) : current ? (
        <Card className="min-h-[520px]">
          <CardHeader key={`h-${current.id}`} className="animate-in fade-in-50 border-b duration-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl">{current.customer_name}</CardTitle>
                  {blacklisted && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />Blacklisted
                    </Badge>
                  )}
                  {repeatCount > 0 && (
                    <Badge variant="secondary" className="gap-1">
                      <Repeat className="h-3 w-3" />Repeat ×{repeatCount}
                    </Badge>
                  )}
                  {nrpLabel && (
                    <Badge className={cn("gap-1", nrpTone)}>
                      <AlertTriangle className="h-3 w-3" />{nrpLabel}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{current.reference}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Badge className={cn("text-xs", attemptsColor)}>Attempts: {current.attempts}/{maxAttempts}</Badge>
                <Button variant="outline" size="sm" onClick={() => setEditOpen(current.id)}>
                  <Pencil className="mr-1 h-4 w-4" />Edit Order
                </Button>
                <Sheet open={historyOpen} onOpenChange={(o) => { setHistoryOpen(o); if (o) loadHistory(); }}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm"><History className="mr-1 h-4 w-4" />History</Button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-md">
                    <SheetHeader><SheetTitle>Order history</SheetTitle></SheetHeader>
                    <div className="mt-4 space-y-3">
                      {history.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No history yet.</p>
                      ) : history.map((h, i) => (
                        <div key={i} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{h.label}</span>
                            <span className="text-xs text-muted-foreground">{new Date(h.at).toLocaleString()}</span>
                          </div>
                          {h.detail && <p className="mt-1 text-muted-foreground">{h.detail}</p>}
                        </div>
                      ))}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {/* Phones */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
                <PhoneCall className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">Primary phone</div>
                  <a href={`tel:${current.customer_phone}`} className="text-xl font-bold tracking-wide hover:underline">
                    {current.customer_phone}
                  </a>
                </div>
                <Button size="icon" variant="ghost" onClick={() => copyPhone(current.customer_phone)} title="Copy">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button asChild size="icon" variant="ghost" title="WhatsApp">
                  <a href={`https://wa.me/${current.customer_phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-4 w-4 text-emerald-600" />
                  </a>
                </Button>
              </div>
              {current.customer_phone_alt ? (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
                  <PhoneCall className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">Alt phone</div>
                    <a href={`tel:${current.customer_phone_alt}`} className="font-medium hover:underline">
                      {current.customer_phone_alt}
                    </a>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => copyPhone(current.customer_phone_alt!)} title="Copy">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ) : <div />}
            </div>

            {/* Address */}
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="flex-1 text-sm">
                <div className="font-medium">{current.city ?? "—"}</div>
                <div className="text-muted-foreground">{current.shipping_address ?? "No address"}</div>
              </div>
            </div>

            {/* Products */}
            <div className="rounded-lg border">
              <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2 text-sm font-medium">
                <PackageIcon className="h-4 w-4" />Products
              </div>
              {current.order_items.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No products.</div>
              ) : (
                <ul className="divide-y">
                  {current.order_items.map((it, idx) => (
                    <li key={idx} className="flex items-center justify-between p-3 text-sm">
                      <span><span className="text-muted-foreground">{it.quantity}×</span> {it.product_name}</span>
                      <span className="font-medium">{(it.quantity * Number(it.unit_price)).toFixed(2)}</span>
                    </li>
                  ))}
                  <li className="flex items-center justify-between bg-primary/5 p-3">
                    <span className="text-sm font-semibold">Total</span>
                    <span className="text-xl font-bold text-primary">{(itemsTotal || current.total_amount).toFixed(2)}</span>
                  </li>
                </ul>
              )}
            </div>

            {current.notes && (
              <div className="rounded-lg border-l-4 border-primary bg-muted/30 p-3 text-sm">
                <div className="text-xs font-semibold text-muted-foreground">Order notes</div>
                <p className="mt-1 whitespace-pre-line">{current.notes}</p>
              </div>
            )}

            {/* Note + Recall */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Call note</Label>
                <Textarea ref={noteRef} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note about this call…" />
              </div>
              <div className="space-y-1.5">
                <Label>Recall at (optional)</Label>
                <Input type="datetime-local" value={recallAt} onChange={(e) => setRecallAt(e.target.value)} />
              </div>
            </div>

            {/* Primary actions */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <Button onClick={() => finishAndReset("confirmed", "confirmed")} disabled={saving} size="lg" className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                Confirm <kbd className="ml-2 rounded bg-emerald-800/40 px-1.5 py-0.5 text-[10px]">⏎</kbd>
              </Button>
              <Button onClick={() => finishAndReset("no_reply", "no_reply")} disabled={saving} size="lg" variant="secondary">
                {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PhoneOff className="mr-2 h-5 w-5" />}
                No reply <kbd className="ml-2 rounded bg-muted-foreground/20 px-1.5 py-0.5 text-[10px]">N</kbd>
              </Button>
              <Button onClick={() => finishAndReset("postponed", "postponed")} disabled={saving} size="lg" variant="secondary">
                {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Clock className="mr-2 h-5 w-5" />}
                Postpone <kbd className="ml-2 rounded bg-muted-foreground/20 px-1.5 py-0.5 text-[10px]">P</kbd>
              </Button>
            </div>
            {/* Secondary actions */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <Button onClick={() => finishAndReset("cancelled", "cancelled")} disabled={saving} variant="destructive">
                <XCircle className="mr-2 h-4 w-4" />Cancel <kbd className="ml-2 rounded bg-destructive-foreground/20 px-1.5 py-0.5 text-[10px]">C</kbd>
              </Button>
              <Button onClick={() => finishAndReset("cancelled", "wrong_number")} disabled={saving} variant="outline">
                Wrong number
              </Button>
              <div className="flex gap-1">
                <Select value={dropdownStatus} onValueChange={setDropdownStatus} disabled={saving}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select status…" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                          {s.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={submitDropdownStatus} disabled={saving || !dropdownStatus} variant="default">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
              <Keyboard className="h-3 w-3" />Shortcuts: Enter Confirm · N No reply · P Postpone · C Cancel
            </div>
          </CardContent>
        </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoriqueTab statuses={statuses} stores={stores} />
        </TabsContent>
      </Tabs>

      <EditOrderDialog
        orderId={editOpen}
        stores={stores}
        onClose={() => setEditOpen(null)}
        onSaved={() => { reloadCurrent(); }}
      />
    </div>
  );
}
