import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2, Clock, Copy, Loader2, MessageCircle, PhoneCall, Plus, RefreshCw, Timer, X,
  AlertTriangle, Repeat, ShoppingBag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { OrderStatus, OrderSource } from "@/lib/order-status";
import type { StatusOpt } from "@/components/call-center/ChangeStatusDialog";
import { cn } from "@/lib/utils";

export interface FocusOrder {
  id: string;
  reference: string;
  external_order_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_phone_alt: string | null;
  shipping_address: string | null;
  city: string | null;
  total_amount: number;
  discount_amount?: number | null;
  extra_amount?: number | null;
  comment_colis?: string | null;
  tracking_number?: string | null;
  status: OrderStatus;
  source: OrderSource;
  attempts: number;
  notes: string | null;
  created_at: string;
  store_id: string | null;
  order_items: { product_id?: string | null; product_name: string; quantity: number; unit_price: number }[];
}

interface ProductOpt {
  id: string;
  name: string;
  sku: string | null;
  sell_price: number;
}
interface CityOpt { id: string; name: string }

interface Props {
  order: FocusOrder;
  statuses: StatusOpt[];
  callSeconds: number;
  blacklisted: boolean;
  repeatCount: number;
  maxAttempts: number;
  saving: boolean;
  /** Save form changes (does NOT change status). */
  onSaveChanges: (patch: SavePatch) => Promise<void>;
  /** Apply a status (and trigger ameex ship if confirmed). */
  onApplyStatus: (status: OrderStatus) => Promise<void>;
  onClose: () => void;
}

export interface SavePatch {
  customer_name: string;
  customer_phone: string;
  customer_phone_alt: string | null;
  city: string | null;
  shipping_address: string | null;
  notes: string | null;
  comment_colis: string | null;
  tracking_number: string | null;
  discount_amount: number;
  extra_amount: number;
  items: { product_id: string | null; product_name: string; quantity: number; unit_price: number }[];
  total_amount: number;
}

function fmtTimer(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

const STATUS_PALETTE: Record<string, { dot: string; ring: string; bg: string; text: string }> = {
  new:       { dot: "bg-blue-500",    ring: "ring-blue-500/30",    bg: "bg-blue-500/5",    text: "text-blue-600 dark:text-blue-400" },
  confirmed: { dot: "bg-emerald-500", ring: "ring-emerald-500/40", bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  no_reply:  { dot: "bg-amber-500",   ring: "ring-amber-500/30",   bg: "bg-amber-500/5",   text: "text-amber-600 dark:text-amber-400" },
  postponed: { dot: "bg-orange-500",  ring: "ring-orange-500/30",  bg: "bg-orange-500/5",  text: "text-orange-600 dark:text-orange-400" },
  out_of_stock: { dot: "bg-fuchsia-500", ring: "ring-fuchsia-500/30", bg: "bg-fuchsia-500/5", text: "text-fuchsia-600 dark:text-fuchsia-400" },
  rupture_stock: { dot: "bg-fuchsia-500", ring: "ring-fuchsia-500/30", bg: "bg-fuchsia-500/5", text: "text-fuchsia-600 dark:text-fuchsia-400" },
  fake_order:{ dot: "bg-rose-600",    ring: "ring-rose-600/30",    bg: "bg-rose-600/5",    text: "text-rose-600 dark:text-rose-400" },
  cancelled: { dot: "bg-rose-500",    ring: "ring-rose-500/30",    bg: "bg-rose-500/5",    text: "text-rose-600 dark:text-rose-400" },
};

function paletteFor(key: string) {
  return STATUS_PALETTE[key] ?? { dot: "bg-muted-foreground", ring: "ring-muted-foreground/30", bg: "bg-muted/40", text: "text-foreground" };
}

interface TimelineEvent { ts: string; title: string; detail?: string | null; tone: "info" | "success" | "warn" | "danger" | "muted"; }

export function FocusOrderCard({
  order, statuses, callSeconds, blacklisted, repeatCount, maxAttempts, saving,
  onSaveChanges, onApplyStatus, onClose,
}: Props) {
  const [tab, setTab] = useState<"details" | "timeline">("details");
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [cities, setCities] = useState<CityOpt[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // form state — mirrors order
  const [form, setForm] = useState({
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    customer_phone_alt: order.customer_phone_alt ?? "",
    city: order.city ?? "",
    shipping_address: order.shipping_address ?? "",
    notes: order.notes ?? "",
    comment_colis: order.comment_colis ?? "",
    tracking_number: order.tracking_number ?? "",
    discount_amount: Number(order.discount_amount ?? 0),
    extra_amount: Number(order.extra_amount ?? 0),
  });
  const [items, setItems] = useState(order.order_items.map((i) => ({
    product_id: i.product_id ?? null,
    product_name: i.product_name,
    quantity: i.quantity,
    unit_price: Number(i.unit_price),
  })));

  const [statusValue, setStatusValue] = useState<OrderStatus>(order.status);

  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => { const t = setTimeout(() => noteRef.current?.focus(), 150); return () => clearTimeout(t); }, [order.id]);

  // Load products + cities once
  useEffect(() => {
    Promise.all([
      supabase.from("products").select("id, name, sku, sell_price").eq("is_active", true).order("name"),
      supabase.from("cities").select("id, name").eq("is_active", true).order("name"),
    ]).then(([p, c]) => {
      setProducts((p.data ?? []) as ProductOpt[]);
      setCities((c.data ?? []) as CityOpt[]);
    });
  }, []);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unit_price, 0), [items]);
  const total = Math.max(0, subtotal - (form.discount_amount || 0) + (form.extra_amount || 0));

  const cityMatched = useMemo(() => {
    if (!form.city) return null;
    return cities.some((c) => c.name.toLowerCase() === form.city.toLowerCase());
  }, [form.city, cities]);

  const buildPatch = (): SavePatch => ({
    customer_name: form.customer_name.trim(),
    customer_phone: form.customer_phone.trim(),
    customer_phone_alt: form.customer_phone_alt.trim() || null,
    city: form.city || null,
    shipping_address: form.shipping_address || null,
    notes: form.notes || null,
    comment_colis: form.comment_colis || null,
    tracking_number: form.tracking_number || null,
    discount_amount: form.discount_amount || 0,
    extra_amount: form.extra_amount || 0,
    items,
    total_amount: total,
  });

  const handleSave = async () => {
    if (!form.customer_name.trim()) return toast.error("Customer name required");
    if (!form.customer_phone.trim()) return toast.error("Phone required");
    await onSaveChanges(buildPatch());
  };

  const handleApply = async () => {
    // Persist edits then apply selected status
    await onSaveChanges(buildPatch());
    await onApplyStatus(statusValue);
  };

  const loadTimeline = async () => {
    setTimelineLoading(true);
    const [{ data: hist }, { data: calls }] = await Promise.all([
      supabase.from("order_status_history").select("*").eq("order_id", order.id).order("created_at", { ascending: false }),
      supabase.from("call_attempts").select("*").eq("order_id", order.id).order("created_at", { ascending: false }),
    ]);

    // Collect actor user IDs and resolve names
    const userIds = new Set<string>();
    (hist ?? []).forEach((h: any) => h.changed_by && userIds.add(h.changed_by));
    (calls ?? []).forEach((c: any) => c.agent_id && userIds.add(c.agent_id));
    const nameMap = new Map<string, string>();
    if (userIds.size > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", Array.from(userIds));
      (profs ?? []).forEach((p: any) => {
        nameMap.set(p.id, p.full_name?.trim() || p.email || "Unknown");
      });
    }

    const evts: TimelineEvent[] = [];
    evts.push({
      ts: order.created_at,
      title: "Order received via webhook",
      detail: order.source,
      actor: order.source,
      tone: "info",
    });
    (hist ?? []).forEach((h: any) => {
      if (!h.from_status) return;
      const tone: TimelineEvent["tone"] = h.to_status === "confirmed" ? "success"
        : h.to_status === "cancelled" || h.to_status === "fake_order" ? "danger"
        : h.to_status === "no_reply" || h.to_status === "postponed" ? "warn" : "info";
      evts.push({
        ts: h.created_at,
        title: `Changed status to ${h.to_status.replace("_", " ")}`,
        actor: h.changed_by ? (nameMap.get(h.changed_by) ?? "system") : "system",
        tone,
      });
    });
    (calls ?? []).forEach((c: any) => {
      evts.push({
        ts: c.created_at,
        title: `Command entered: ${c.outcome.replace("_", " ")}${c.duration_seconds ? ` · ${fmtTimer(c.duration_seconds)}` : ""}`,
        actor: c.agent_id ? (nameMap.get(c.agent_id) ?? "agent") : "system",
        tone: c.outcome === "confirmed" ? "success" : c.outcome === "cancelled" ? "danger" : "warn",
      });
    });
    if (order.tracking_number) {
      evts.push({
        ts: new Date().toISOString(),
        title: `Sent to Ameex — Tracking: ${order.tracking_number}`,
        actor: "system",
        tone: "info",
      });
    }
    evts.sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
    setTimeline(evts);
    setTimelineLoading(false);
  };

  useEffect(() => { if (tab === "timeline") loadTimeline(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab, order.id]);

  const headerPalette = paletteFor(order.status);
  const sourceLabel = order.source.replace("_", " ");
  const timerColor = callSeconds >= 60 ? "border-destructive text-destructive"
    : callSeconds >= 30 ? "border-amber-500 text-amber-600 dark:text-amber-400" : "";

  const addItem = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setItems((arr) => [...arr, { product_id: p.id, product_name: p.name, quantity: 1, unit_price: Number(p.sell_price) }]);
  };

  return (
    <Card className="overflow-hidden border-0 shadow-xl">
      {/* Header bar */}
      <div className="flex items-center gap-3 border-b bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-3 text-white">
        <Badge className={cn("gap-1.5 border-0 px-3 py-1 font-medium", headerPalette.bg, headerPalette.text)}>
          <span className={cn("h-2 w-2 rounded-full", headerPalette.dot)} />
          {order.status.replace("_", " ")}
        </Badge>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">
            #{order.reference} · {items[0]?.product_name ?? "Order"}
          </div>
          <div className="text-xs text-white/60">
            {new Date(order.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            {" · "}{Number(order.total_amount).toFixed(2)} MAD
          </div>
        </div>
        <Badge variant="outline" className={cn("gap-1.5 border-white/20 bg-white/5 font-mono text-white", timerColor)}>
          <Timer className="h-3 w-3" />{fmtTimer(callSeconds)}
        </Badge>
        {blacklisted && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />BL</Badge>}
        {repeatCount > 0 && <Badge className="gap-1 bg-white/10 text-white"><Repeat className="h-3 w-3" />×{repeatCount}</Badge>}
        <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/10" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <div className="flex items-center justify-between border-b px-5">
          <TabsList className="h-12 gap-2 bg-transparent p-0">
            <TabsTrigger value="details" className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-1 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              Details
            </TabsTrigger>
            <TabsTrigger value="timeline" className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-1 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              Timeline
            </TabsTrigger>
          </TabsList>
          <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
            <ShoppingBag className="h-3 w-3" />{sourceLabel}
          </Badge>
        </div>

        {/* DETAILS TAB */}
        <TabsContent value="details" className="m-0">
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_280px]">
            {/* LEFT — form */}
            <div className="space-y-6">
              {/* Customer info */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer Info</h3>
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2">
                    Phone
                    {order.source === "shopify" && <span className="text-xs font-normal text-muted-foreground">(Shopify — read only)</span>}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.customer_phone}
                      readOnly={order.source === "shopify"}
                      onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                    />
                    <Button asChild size="icon" variant="outline" title="WhatsApp">
                      <a href={`https://wa.me/${form.customer_phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer">
                        <MessageCircle className="h-4 w-4 text-emerald-600" />
                      </a>
                    </Button>
                    <Button asChild size="icon" variant="outline" title="Call">
                      <a href={`tel:${form.customer_phone}`}><PhoneCall className="h-4 w-4 text-primary" /></a>
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Delivery City</Label>
                    {order.source === "shopify" && order.city && (
                      <span className="text-xs text-muted-foreground">Shopify: {order.city}</span>
                    )}
                  </div>
                  {cities.length > 0 ? (
                    <Select value={form.city} onValueChange={(v) => setForm({ ...form, city: v })}>
                      <SelectTrigger className={cn(cityMatched ? "border-emerald-500/50 ring-1 ring-emerald-500/30" : "")}>
                        <SelectValue placeholder="Select a city..." />
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map((c) => (
                          <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                        ))}
                        {form.city && !cities.some((c) => c.name.toLowerCase() === form.city.toLowerCase()) && (
                          <SelectItem value={form.city}>{form.city} (legacy)</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  )}
                  {cityMatched === true && (
                    <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />City matched — ready to send to Ameex
                    </p>
                  )}
                  {cityMatched === false && (
                    <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" />City not in list — will be sent as raw text
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Textarea rows={2} value={form.shipping_address} onChange={(e) => setForm({ ...form, shipping_address: e.target.value })} />
                </div>
              </section>

              {/* Order details */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order Details</h3>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Products</Label>
                  <Select onValueChange={addItem}>
                    <SelectTrigger className="h-8 w-auto gap-1 border-primary/30 bg-primary/5 text-primary">
                      <Plus className="h-3.5 w-3.5" /><SelectValue placeholder="Add product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} {p.sku ? `· ${p.sku}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  {items.length === 0 && <p className="text-sm text-muted-foreground">No products added.</p>}
                  {items.map((it, idx) => (
                    <div key={idx} className="rounded-lg border bg-primary/5 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-primary">{it.product_name}</div>
                          {it.product_id && (
                            <div className="text-xs text-muted-foreground">
                              SKU: {products.find((p) => p.id === it.product_id)?.sku ?? "—"}
                            </div>
                          )}
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setItems((a) => a.filter((_, i) => i !== idx))}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Qty</Label>
                          <Input type="number" min={1} value={it.quantity}
                            onChange={(e) => setItems((a) => a.map((x, i) => i === idx ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Unit Price (MAD)</Label>
                          <Input type="number" step="0.01" value={it.unit_price}
                            onChange={(e) => setItems((a) => a.map((x, i) => i === idx ? { ...x, unit_price: Number(e.target.value) || 0 } : x))} />
                        </div>
                      </div>
                      <div className="mt-2 text-right text-sm text-muted-foreground">
                        Line total: <span className="font-semibold text-foreground">{(it.quantity * it.unit_price).toFixed(2)} MAD</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center justify-between">
                      <span>Discount (-)</span>
                      <span className="text-xs text-muted-foreground">MAD</span>
                    </Label>
                    <Input type="number" step="0.01" value={form.discount_amount}
                      onChange={(e) => setForm({ ...form, discount_amount: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center justify-between">
                      <span>Extra (+)</span>
                      <span className="text-xs text-muted-foreground">MAD</span>
                    </Label>
                    <Input type="number" step="0.01" value={form.extra_amount}
                      onChange={(e) => setForm({ ...form, extra_amount: Number(e.target.value) || 0 })} />
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{subtotal.toFixed(2)} MAD</span>
                  </div>
                  <div className="-mx-3 -mb-3 mt-2 flex items-center justify-between rounded-b-lg bg-slate-900 px-3 py-3 text-white">
                    <span className="text-sm font-semibold">Total Price</span>
                    <span className="text-xl font-bold">{total.toFixed(2)} MAD</span>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Comment Colis</Label>
                  <Textarea rows={2} value={form.comment_colis}
                    onChange={(e) => setForm({ ...form, comment_colis: e.target.value })}
                    placeholder="Note dyl colis (visible f Ameex)..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Tracking Number <span className="text-xs font-normal text-muted-foreground">(auto-filled after Ameex send)</span></Label>
                  <Input value={form.tracking_number} placeholder="e.g. AMX123456"
                    onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Order Note (internal)</Label>
                  <Textarea ref={noteRef} rows={2} value={form.notes}
                    placeholder="Internal note..."
                    onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </section>
            </div>

            {/* RIGHT — status pills */}
            <aside className="space-y-4">
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order Status</h3>
                <div className="space-y-2">
                  {statuses.map((s) => {
                    const pal = paletteFor(s.key);
                    const active = statusValue === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setStatusValue(s.key as OrderStatus)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-all",
                          active
                            ? cn("border-transparent ring-2 shadow-sm", pal.ring, pal.bg, pal.text, "font-semibold")
                            : "border-border hover:bg-muted/50",
                        )}
                      >
                        <span className={cn("h-2.5 w-2.5 rounded-full", pal.dot)} />
                        <span className="flex-1">{s.label}</span>
                        {active && <CheckCircle2 className="h-4 w-4" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {order.external_order_id && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Shopify ID</div>
                  <div className="mt-1 flex items-center gap-1.5 font-mono text-sm">
                    #{order.external_order_id}
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                      navigator.clipboard.writeText(order.external_order_id!);
                      toast.success("Copied");
                    }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Attempts</span>
                  <span className="font-mono font-semibold text-foreground">{order.attempts}/{maxAttempts}</span>
                </div>
              </div>
            </aside>
          </CardContent>
        </TabsContent>

        {/* TIMELINE TAB */}
        <TabsContent value="timeline" className="m-0">
          <CardContent className="p-6">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity Timeline</h3>
            {timelineLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="space-y-3">
                {timeline.map((e, idx) => {
                  const toneColors = {
                    info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                    danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                    muted: "bg-muted text-muted-foreground",
                  }[e.tone];
                  return (
                    <li key={idx} className="flex gap-3 rounded-lg border bg-card p-3">
                      <div className={cn("grid h-8 w-8 shrink-0 place-content-center rounded-full", toneColors)}>
                        {e.tone === "success" ? <CheckCircle2 className="h-4 w-4" />
                          : e.tone === "danger" ? <X className="h-4 w-4" />
                          : e.tone === "warn" ? <Clock className="h-4 w-4" />
                          : <RefreshCw className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{e.title}</div>
                        {e.detail && <div className="mt-0.5 text-xs text-muted-foreground">{e.detail}</div>}
                        <div className="mt-1 text-xs text-muted-foreground">
                          {new Date(e.ts).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </TabsContent>
      </Tabs>

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
        <Button variant="outline" onClick={onClose} disabled={saving} className="min-w-[110px]">
          Close
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes
          </Button>
          <Button onClick={handleApply} disabled={saving} className="min-w-[180px] bg-slate-900 text-white hover:bg-slate-800">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Save & Apply Status
          </Button>
        </div>
      </div>
    </Card>
  );
}
