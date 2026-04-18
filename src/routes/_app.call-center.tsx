import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PhoneCall, CheckCircle2, XCircle, PhoneOff, Clock, RotateCcw, ChevronRight, AlertTriangle, MapPin, Package as PackageIcon } from "lucide-react";
import type { OrderSource, OrderStatus } from "@/lib/order-status";

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

  const loadOrder = async (o: QueueOrder) => {
    setCurrent(o); setNote(""); setRecallAt("");
    const { data } = await supabase.from("blacklist").select("phone").eq("phone", o.customer_phone).maybeSingle();
    setBlacklisted(!!data);
  };

  const fetchQueue = async () => {
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
  };

  useEffect(() => { fetchQueue(); /* eslint-disable-next-line */ }, []);

  const remaining = useMemo(() => queue.filter((o) => !current || o.id !== current.id), [queue, current]);

  const finishAndNext = async (newStatus: OrderStatus, outcome: Outcome) => {
    if (!current || !user) return;
    setSaving(true);
    const orderPatch: { status: OrderStatus; agent_id: string; confirmed_at?: string } = {
      status: newStatus, agent_id: user.id,
    };
    if (newStatus === "confirmed") orderPatch.confirmed_at = new Date().toISOString();
    const [{ error: oe }, { error: ce }] = await Promise.all([
      supabase.from("orders").update(orderPatch).eq("id", current.id),
      supabase.from("call_attempts").insert({
        order_id: current.id, agent_id: user.id, outcome,
        note: note || null, recall_at: recallAt ? new Date(recallAt).toISOString() : null,
      }),
    ]);
    setSaving(false);
    if (oe || ce) { toast.error(oe?.message || ce?.message || "Save failed"); return; }
    toast.success("Saved — loading next");
    const next = remaining[0] ?? null;
    setQueue((prev) => prev.filter((o) => o.id !== current.id));
    if (next) loadOrder(next); else { setCurrent(null); fetchQueue(); }
  };

  const itemsTotal = current?.order_items.reduce((s, i) => s + i.quantity * Number(i.unit_price), 0) ?? 0;

  return (
    <div>
      <PageHeader title="Call Center — Focus Mode" description={`${queue.length} order(s) in your queue`}
        actions={<Button variant="outline" onClick={fetchQueue} disabled={loading}><RotateCcw className="mr-2 h-4 w-4" />Refresh</Button>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="min-h-[480px]">
          {!current ? (
            <CardContent className="flex h-[480px] flex-col items-center justify-center text-center text-muted-foreground">
              <CheckCircle2 className="mb-3 h-12 w-12 text-primary" />
              <p className="text-lg font-medium">Queue clear 🎉</p>
              <p className="text-sm">No orders waiting.</p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="border-b">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl">{current.customer_name}</CardTitle>
                      {blacklisted && <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Blacklisted</Badge>}
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{current.reference}</p>
                  </div>
                  <Badge variant="outline">Attempts: {current.attempts}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="grid gap-3 md:grid-cols-2">
                  <a href={`tel:${current.customer_phone}`} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3 hover:bg-muted">
                    <PhoneCall className="h-5 w-5 text-primary" />
                    <div><div className="text-xs text-muted-foreground">Primary phone</div><div className="text-lg font-semibold">{current.customer_phone}</div></div>
                  </a>
                  {current.customer_phone_alt && (
                    <a href={`tel:${current.customer_phone_alt}`} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3 hover:bg-muted">
                      <PhoneCall className="h-5 w-5 text-muted-foreground" />
                      <div><div className="text-xs text-muted-foreground">Alt phone</div><div className="font-medium">{current.customer_phone_alt}</div></div>
                    </a>
                  )}
                </div>
                <div className="flex items-start gap-3 rounded-lg border p-3">
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{current.city ?? "—"}</div>
                    <div className="text-muted-foreground">{current.shipping_address ?? "No address"}</div>
                  </div>
                </div>
                <div className="rounded-lg border">
                  <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2 text-sm font-medium"><PackageIcon className="h-4 w-4" />Products</div>
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
                      <li className="flex items-center justify-between bg-muted/20 p-3 text-sm font-semibold"><span>Total</span><span>{(itemsTotal || current.total_amount).toFixed(2)}</span></li>
                    </ul>
                  )}
                </div>
                {current.notes && (
                  <div className="rounded-lg border-l-4 border-primary bg-muted/30 p-3 text-sm">
                    <div className="text-xs font-semibold text-muted-foreground">Order notes</div>
                    <p className="mt-1 whitespace-pre-line">{current.notes}</p>
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5"><Label>Call note</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Recall at (optional)</Label><Input type="datetime-local" value={recallAt} onChange={(e) => setRecallAt(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  <Button onClick={() => finishAndNext("confirmed", "confirmed")} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="mr-2 h-4 w-4" />Confirm</Button>
                  <Button onClick={() => finishAndNext("no_reply", "no_reply")} disabled={saving} variant="secondary"><PhoneOff className="mr-2 h-4 w-4" />No reply</Button>
                  <Button onClick={() => finishAndNext("postponed", "postponed")} disabled={saving} variant="secondary"><Clock className="mr-2 h-4 w-4" />Postpone</Button>
                  <Button onClick={() => finishAndNext("cancelled", "cancelled")} disabled={saving} variant="destructive"><XCircle className="mr-2 h-4 w-4" />Cancel</Button>
                  <Button onClick={() => finishAndNext("cancelled", "wrong_number")} disabled={saving} variant="outline">Wrong #</Button>
                  <Button onClick={() => loadOrder(remaining[0] ?? current)} disabled={saving || remaining.length === 0} variant="ghost">Skip <ChevronRight className="ml-1 h-4 w-4" /></Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
        <Card>
          <CardHeader className="border-b"><CardTitle className="text-sm">Up next ({remaining.length})</CardTitle></CardHeader>
          <CardContent className="max-h-[600px] overflow-y-auto p-0">
            {remaining.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No more orders.</div>
            ) : (
              <ul className="divide-y">
                {remaining.slice(0, 30).map((o) => (
                  <li key={o.id}>
                    <button onClick={() => loadOrder(o)} className="block w-full p-3 text-left hover:bg-accent/50">
                      <div className="flex items-center justify-between"><span className="text-sm font-medium">{o.customer_name}</span><Badge variant="outline" className="h-5 text-[10px]">{o.attempts}×</Badge></div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{o.customer_phone}</div>
                      <div className="text-xs text-muted-foreground">{o.city ?? "—"} · {Number(o.total_amount).toFixed(2)}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
