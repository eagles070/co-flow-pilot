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
import { toast } from "sonner";
import {
  PhoneCall, CheckCircle2, XCircle, PhoneOff, Clock, RotateCcw, ChevronRight,
  AlertTriangle, MapPin, Package as PackageIcon, Copy, MessageCircle, History,
  Keyboard, Repeat, Timer, Loader2,
} from "lucide-react";

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
  notes: string | null; created_at: string;
  order_items: { product_name: string; quantity: number; unit_price: number }[];
}

interface HistoryItem {
  kind: "status" | "call";
  at: string;
  label: string;
  detail?: string | null;
  agent?: string | null;
}

function fmtTimer(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function CallCenterPage() {
  const { user, hasAnyRole } = useAuth();
  const isStaff = hasAnyRole(["admin", "moderator"]);
  const [queue, setQueue] = useState<QueueOrder[]>([]);
  const [current, setCurrent] = useState<QueueOrder | null>(null);
  const [loading, setLoading] = useState(true);
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

  // Load max attempts setting
  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "nrp_max_attempts").maybeSingle()
      .then(({ data }) => { if (data?.value) setMaxAttempts(Number(data.value) || 3); });
  }, []);

  // Call timer
  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setCallSeconds(0);
    if (current) {
      timerRef.current = window.setInterval(() => setCallSeconds((s) => s + 1), 1000);
    }
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [current?.id]);

  // Auto-focus note input when an order loads
  useEffect(() => {
    if (current && noteRef.current) {
      const t = window.setTimeout(() => noteRef.current?.focus(), 120);
      return () => window.clearTimeout(t);
    }
  }, [current?.id]);

  const loadOrder = useCallback(async (o: QueueOrder) => {
    setCurrent(o); setNote(""); setRecallAt(""); setHistory([]);
    const [bl, rp] = await Promise.all([
      supabase.from("blacklist").select("phone").eq("phone", o.customer_phone).maybeSingle(),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_phone", o.customer_phone),
    ]);
    setBlacklisted(!!bl.data);
    setRepeatCount(Math.max(0, (rp.count ?? 1) - 1));
  }, []);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("orders")
      .select("*, order_items(product_name, quantity, unit_price)")
      .in("status", ["new", "assigned", "no_reply", "postponed"])
      .order("created_at", { ascending: true }).limit(100);
    if (!isStaff && user) q = q.eq("agent_id", user.id);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    const list = (data ?? []) as unknown as QueueOrder[];
    setQueue(list);
    if (list.length > 0) loadOrder(list[0]);
    else setCurrent(null);
    setLoading(false);
  }, [isStaff, user, loadOrder]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const remaining = useMemo(() => queue.filter((o) => !current || o.id !== current.id), [queue, current]);

  const finishAndNext = useCallback(async (newStatus: OrderStatus, outcome: Outcome) => {
    if (!current || !user || saving) return;
    setSaving(true);
    const orderPatch: { status: OrderStatus; agent_id: string; confirmed_at?: string } = {
      status: newStatus, agent_id: user.id,
    };
    if (newStatus === "confirmed") orderPatch.confirmed_at = new Date().toISOString();

    // NRP overflow: if hit max attempts, unassign so it returns to general queue
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
    setSaving(false);
    if (oe || ce) { toast.error(oe?.message || ce?.message || "Save failed"); return; }
    toast.success("Saved — loading next");
    const next = remaining[0] ?? null;
    setQueue((prev) => prev.filter((o) => o.id !== current.id));
    if (next) loadOrder(next); else { setCurrent(null); fetchQueue(); }
  }, [current, user, saving, note, recallAt, callSeconds, maxAttempts, remaining, loadOrder, fetchQueue]);

  const skipNext = useCallback(() => {
    if (!current || remaining.length === 0) return;
    loadOrder(remaining[0]);
  }, [current, remaining, loadOrder]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (!current || saving) return;
      if (e.key === "Enter") { e.preventDefault(); finishAndNext("confirmed", "confirmed"); }
      else if (e.key === "n" || e.key === "N") { e.preventDefault(); finishAndNext("no_reply", "no_reply"); }
      else if (e.key === "c" || e.key === "C") { e.preventDefault(); finishAndNext("cancelled", "cancelled"); }
      else if (e.key === "s" || e.key === "S") { e.preventDefault(); skipNext(); }
      else if (e.key === "p" || e.key === "P") { e.preventDefault(); finishAndNext("postponed", "postponed"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, saving, finishAndNext, skipNext]);

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

  return (
    <div>
      <PageHeader
        title="Call Center — Focus Mode"
        description={`${queue.length} order(s) in your queue · Max attempts: ${maxAttempts}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 font-mono text-sm">
              <Timer className="h-3.5 w-3.5" />{fmtTimer(callSeconds)}
            </Badge>
            <Button variant="outline" size="sm" onClick={fetchQueue} disabled={loading}>
              <RotateCcw className="mr-2 h-4 w-4" />Refresh
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="min-h-[520px]">
          {!current ? (
            <CardContent className="flex h-[520px] flex-col items-center justify-center text-center text-muted-foreground">
              <CheckCircle2 className="mb-3 h-12 w-12 text-primary" />
              <p className="text-lg font-medium">Queue clear 🎉</p>
              <p className="text-sm">No orders waiting.</p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="border-b">
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
                      {current.attempts >= 2 && (
                        <Badge className={cn("gap-1", current.attempts >= 3 ? "bg-destructive text-destructive-foreground" : "bg-yellow-500 text-white")}>
                          <AlertTriangle className="h-3 w-3" />NRP {current.attempts}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{current.reference}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={cn("text-xs", attemptsColor)}>Attempts: {current.attempts}/{maxAttempts}</Badge>
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
                      <li className="flex items-center justify-between bg-muted/20 p-3 text-sm font-semibold">
                        <span>Total</span><span>{(itemsTotal || current.total_amount).toFixed(2)}</span>
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
                    <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note about this call…" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Recall at (optional)</Label>
                    <Input type="datetime-local" value={recallAt} onChange={(e) => setRecallAt(e.target.value)} />
                  </div>
                </div>

                {/* Primary actions — large */}
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <Button onClick={() => finishAndNext("confirmed", "confirmed")} disabled={saving} size="lg" className="bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle2 className="mr-2 h-5 w-5" />Confirm <kbd className="ml-2 rounded bg-emerald-800/40 px-1.5 py-0.5 text-[10px]">⏎</kbd>
                  </Button>
                  <Button onClick={() => finishAndNext("no_reply", "no_reply")} disabled={saving} size="lg" variant="secondary">
                    <PhoneOff className="mr-2 h-5 w-5" />No reply <kbd className="ml-2 rounded bg-muted-foreground/20 px-1.5 py-0.5 text-[10px]">N</kbd>
                  </Button>
                  <Button onClick={() => finishAndNext("postponed", "postponed")} disabled={saving} size="lg" variant="secondary">
                    <Clock className="mr-2 h-5 w-5" />Postpone <kbd className="ml-2 rounded bg-muted-foreground/20 px-1.5 py-0.5 text-[10px]">P</kbd>
                  </Button>
                </div>
                {/* Secondary actions */}
                <div className="grid grid-cols-3 gap-2">
                  <Button onClick={() => finishAndNext("cancelled", "cancelled")} disabled={saving} variant="destructive">
                    <XCircle className="mr-2 h-4 w-4" />Cancel <kbd className="ml-2 rounded bg-destructive-foreground/20 px-1.5 py-0.5 text-[10px]">C</kbd>
                  </Button>
                  <Button onClick={() => finishAndNext("cancelled", "wrong_number")} disabled={saving} variant="outline">
                    Wrong #
                  </Button>
                  <Button onClick={skipNext} disabled={saving || remaining.length === 0} variant="ghost">
                    Skip <kbd className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px]">S</kbd>
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                  <Keyboard className="h-3 w-3" />Shortcuts: Enter Confirm · N No reply · P Postpone · C Cancel · S Skip
                </div>
              </CardContent>
            </>
          )}
        </Card>

        {/* Up next queue */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-sm">Up next ({remaining.length})</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[640px] overflow-y-auto p-0">
            {remaining.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No more orders.</div>
            ) : (
              <ul className="divide-y">
                {remaining.slice(0, 30).map((o) => {
                  const nrpBadge = o.attempts >= 3 ? "destructive" : o.attempts === 2 ? "default" : "outline";
                  return (
                    <li key={o.id}>
                      <button onClick={() => loadOrder(o)} className="block w-full p-3 text-left hover:bg-accent/50">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{o.customer_name}</span>
                          <Badge variant={nrpBadge as "outline" | "default" | "destructive"} className={cn("h-5 text-[10px]", o.attempts === 2 && "bg-yellow-500 text-white")}>
                            {o.status === "no_reply" ? `NRP ${o.attempts}` : `${o.attempts}×`}
                          </Badge>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{o.customer_phone}</div>
                        <div className="truncate text-xs text-muted-foreground">{o.city ?? "—"} · {Number(o.total_amount).toFixed(2)}</div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
