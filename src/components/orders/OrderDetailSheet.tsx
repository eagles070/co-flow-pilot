import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { statusLabel, statusVariant, type OrderStatus } from "@/lib/order-status";
import { CheckCircle2, Clock, Phone, PhoneOff, RefreshCw, Truck, UserPlus, XCircle } from "lucide-react";

interface Props {
  orderId: string | null;
  onClose: () => void;
}

interface OrderDetail {
  id: string;
  reference: string;
  customer_name: string;
  customer_phone: string;
  customer_phone_alt: string | null;
  shipping_address: string | null;
  city: string | null;
  total_amount: number;
  status: OrderStatus;
  source: string;
  agent_id: string | null;
  attempts: number;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
}

interface Item {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface HistoryRow {
  id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  created_at: string;
  note: string | null;
}

interface CallRow {
  id: string;
  outcome: string;
  created_at: string;
  note: string | null;
  duration_seconds: number | null;
}

interface TimelineEvent {
  ts: string;
  icon: React.ReactNode;
  title: string;
  detail?: string;
}

export function OrderDetailSheet({ orderId, onClose }: Props) {
  const open = !!orderId;
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    Promise.all([
      supabase.from("orders").select("*").eq("id", orderId).single(),
      supabase.from("order_items").select("id, product_name, quantity, unit_price").eq("order_id", orderId),
      supabase.from("order_status_history").select("*").eq("order_id", orderId).order("created_at"),
      supabase.from("call_attempts").select("*").eq("order_id", orderId).order("created_at"),
    ]).then(([o, it, h, c]) => {
      setOrder((o.data as OrderDetail) ?? null);
      setItems(((it.data ?? []) as Item[]).map((r) => ({ ...r, unit_price: Number(r.unit_price) })));
      setHistory((h.data ?? []) as HistoryRow[]);
      setCalls((c.data ?? []) as CallRow[]);
      setLoading(false);
    });
  }, [orderId]);

  const fmt = (s: string) => new Date(s).toLocaleString();

  const events: TimelineEvent[] = order
    ? [
        { ts: order.created_at, icon: <Clock className="h-4 w-4" />, title: "Order created", detail: order.reference },
        ...history
          .filter((h) => h.from_status !== null)
          .map((h) => ({
            ts: h.created_at,
            icon: <RefreshCw className="h-4 w-4" />,
            title: `Status: ${statusLabel(h.from_status as OrderStatus)} → ${statusLabel(h.to_status)}`,
            detail: h.note ?? undefined,
          })),
        ...calls.map((c) => ({
          ts: c.created_at,
          icon:
            c.outcome === "confirmed" ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : c.outcome === "no_reply" ? (
              <PhoneOff className="h-4 w-4 text-warning" />
            ) : c.outcome === "cancelled" ? (
              <XCircle className="h-4 w-4 text-destructive" />
            ) : (
              <Phone className="h-4 w-4" />
            ),
          title: `Call: ${c.outcome.replace("_", " ")}`,
          detail: c.note ?? (c.duration_seconds ? `${c.duration_seconds}s` : undefined),
        })),
        ...(order.confirmed_at
          ? [{ ts: order.confirmed_at, icon: <UserPlus className="h-4 w-4 text-success" />, title: "Confirmed" }]
          : []),
        ...(order.shipped_at
          ? [{ ts: order.shipped_at, icon: <Truck className="h-4 w-4 text-info" />, title: "Shipped" }]
          : []),
        ...(order.delivered_at
          ? [{ ts: order.delivered_at, icon: <CheckCircle2 className="h-4 w-4 text-success" />, title: "Delivered" }]
          : []),
      ].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
    : [];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {order?.reference ?? "Order"}
            {order && (
              <Badge variant={statusVariant(order.status)} className="ml-1">
                {statusLabel(order.status)}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>{order ? `Created ${fmt(order.created_at)}` : "Loading..."}</SheetDescription>
        </SheetHeader>

        {loading || !order ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="mt-4 space-y-5">
            {/* Customer */}
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Customer</h4>
              <div className="space-y-1 text-sm">
                <div><span className="text-muted-foreground">Name:</span> {order.customer_name}</div>
                <div><span className="text-muted-foreground">Phone:</span> {order.customer_phone}</div>
                {order.customer_phone_alt && (
                  <div><span className="text-muted-foreground">Alt phone:</span> {order.customer_phone_alt}</div>
                )}
                <div><span className="text-muted-foreground">City:</span> {order.city ?? "—"}</div>
                <div><span className="text-muted-foreground">Address:</span> {order.shipping_address ?? "—"}</div>
              </div>
            </section>

            <Separator />

            {/* Items */}
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Products</h4>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No products</p>
              ) : (
                <div className="space-y-1">
                  {items.map((i) => (
                    <div key={i.id} className="flex justify-between text-sm">
                      <span className="truncate">{i.quantity}× {i.product_name}</span>
                      <span className="font-medium">{(i.quantity * i.unit_price).toFixed(2)}</span>
                    </div>
                  ))}
                  <Separator className="my-2" />
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Total</span>
                    <span>{Number(order.total_amount).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </section>

            <Separator />

            {/* Stats */}
            <section className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border p-2">
                <div className="text-xs text-muted-foreground">Attempts</div>
                <div className="text-lg font-semibold">{order.attempts}</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-xs text-muted-foreground">Source</div>
                <div className="text-sm font-medium capitalize">{order.source.replace("_", " ")}</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-xs text-muted-foreground">Calls</div>
                <div className="text-lg font-semibold">{calls.length}</div>
              </div>
            </section>

            {order.notes && (
              <>
                <Separator />
                <section>
                  <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Notes</h4>
                  <p className="whitespace-pre-wrap text-sm">{order.notes}</p>
                </section>
              </>
            )}

            <Separator />

            {/* Timeline */}
            <section>
              <h4 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Timeline</h4>
              <ol className="relative space-y-3 border-l border-border pl-5">
                {events.map((e, idx) => (
                  <li key={idx} className="relative">
                    <span className="absolute -left-[26px] top-0.5 grid h-5 w-5 place-content-center rounded-full border bg-background">
                      {e.icon}
                    </span>
                    <div className="text-sm font-medium">{e.title}</div>
                    {e.detail && <div className="text-xs text-muted-foreground">{e.detail}</div>}
                    <div className="text-xs text-muted-foreground">{fmt(e.ts)}</div>
                  </li>
                ))}
                {events.length === 0 && <li className="text-sm text-muted-foreground">No activity yet.</li>}
              </ol>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
