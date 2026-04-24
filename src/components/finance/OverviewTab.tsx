import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle, DollarSign, Receipt, Truck, Wallet, Percent, ArrowDownToLine, ArrowUpFromLine, Scale, CheckCircle2, PackageX } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";

export function OverviewTab() {
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [stats, setStats] = useState({
    revenue: 0,
    expenses: 0,
    shippingCost: 0,
    cashIn: 0,
    cashOut: 0,
    deliveredCount: 0,
    returnedCount: 0,
    totalOrders: 0,
  });

  const load = async () => {
    setLoading(true);
    let oQuery = supabase.from("orders").select("status,total_amount,city,delivered_at,created_at");
    let eQuery = supabase.from("expenses").select("amount,expense_date");
    let cQuery = supabase.from("cash_flow").select("type,amount,occurred_at");
    if (from) {
      oQuery = oQuery.gte("created_at", from);
      eQuery = eQuery.gte("expense_date", from);
      cQuery = cQuery.gte("occurred_at", from);
    }
    if (to) {
      oQuery = oQuery.lte("created_at", to + "T23:59:59");
      eQuery = eQuery.lte("expense_date", to);
      cQuery = cQuery.lte("occurred_at", to);
    }
    const [{ data: orders }, { data: expenses }, { data: cash }, { data: cities }] =
      await Promise.all([
        oQuery,
        eQuery,
        cQuery,
        supabase.from("cities").select("name,delivery_cost,return_cost"),
      ]);

    // Build city price map (case-insensitive)
    const cityMap = new Map<string, { delivery: number; refused: number }>();
    (cities ?? []).forEach((c) => {
      cityMap.set((c.name ?? "").trim().toLowerCase(), {
        delivery: Number(c.delivery_cost ?? 0),
        refused: Number(c.return_cost ?? 0),
      });
    });
    const priceFor = (city: string | null) =>
      cityMap.get((city ?? "").trim().toLowerCase()) ?? { delivery: 0, refused: 0 };

    const o = orders ?? [];
    const revenue = o
      .filter((x) => x.status === "delivered")
      .reduce((s, x) => s + Number(x.total_amount), 0);

    // Internal shipping cost from city table
    let shippingCost = 0;
    for (const x of o) {
      const p = priceFor(x.city);
      if (x.status === "delivered") shippingCost += p.delivery;
      else if (x.status === "refused" || x.status === "returned") shippingCost += p.refused;
    }

    const exp = (expenses ?? []).reduce((s, x) => s + Number(x.amount), 0);
    const cashIn = (cash ?? []).filter((x) => x.type === "in").reduce((s, x) => s + Number(x.amount), 0);
    const cashOut = (cash ?? []).filter((x) => x.type === "out").reduce((s, x) => s + Number(x.amount), 0);
    setStats({
      revenue,
      expenses: exp,
      shippingCost,
      cashIn,
      cashOut,
      deliveredCount: o.filter((x) => x.status === "delivered").length,
      returnedCount: o.filter((x) => x.status === "returned" || x.status === "refused").length,
      totalOrders: o.length,
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, [from, to]);

  const totalCosts = stats.expenses + stats.shippingCost;
  const profit = stats.revenue - totalCosts;
  const balance = stats.cashIn - stats.cashOut;
  const margin = stats.revenue > 0 ? (profit / stats.revenue) * 100 : 0;
  const returnRate = stats.totalOrders > 0 ? (stats.returnedCount / stats.totalOrders) * 100 : 0;

  const alerts: { kind: "warn" | "danger"; msg: string }[] = [];
  if (stats.revenue > 0 && margin < 10) alerts.push({ kind: "warn", msg: `Low profit margin: ${margin.toFixed(1)}%` });
  if (returnRate > 20) alerts.push({ kind: "danger", msg: `High return rate: ${returnRate.toFixed(1)}%` });
  if (totalCosts > stats.revenue && stats.revenue > 0) alerts.push({ kind: "danger", msg: "Costs exceed revenue" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-md border p-3 text-sm ${a.kind === "danger" ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"}`}>
              <AlertTriangle className="h-4 w-4" />
              {a.msg}
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Revenue" value={stats.revenue.toFixed(2)} icon={DollarSign} tone="luxury-4" hint="cash collected" />
          <KpiCard label="Expenses" value={stats.expenses.toFixed(2)} icon={Receipt} tone="luxury-3" hint="operational costs" />
          <KpiCard label="Shipping (internal)" value={stats.shippingCost.toFixed(2)} icon={Truck} tone="luxury-5" hint="delivery overhead" />
          <KpiCard label="Net profit" value={profit.toFixed(2)} icon={Wallet} tone={profit >= 0 ? "luxury-1" : "luxury-2"} hint={profit >= 0 ? "positive margin" : "loss"} />
          <KpiCard label="Margin" value={`${margin.toFixed(1)}%`} icon={Percent} tone={margin >= 15 ? "luxury-4" : margin >= 0 ? "luxury-3" : "luxury-2"} hint="profit ratio" />
          <KpiCard label="Cash in" value={stats.cashIn.toFixed(2)} icon={ArrowDownToLine} tone="luxury-4" hint="incoming flow" />
          <KpiCard label="Cash out" value={stats.cashOut.toFixed(2)} icon={ArrowUpFromLine} tone="luxury-2" hint="outgoing flow" />
          <KpiCard label="Balance" value={balance.toFixed(2)} icon={Scale} tone={balance >= 0 ? "luxury-1" : "luxury-2"} hint="net cash" />
          <KpiCard label="Delivered orders" value={stats.deliveredCount.toLocaleString()} icon={CheckCircle2} tone="luxury-4" hint="completed" />
          <KpiCard label="Returned / refused" value={stats.returnedCount.toLocaleString()} icon={PackageX} tone="luxury-2" hint="lost revenue" />
        </div>
      )}
    </div>
  );
}
