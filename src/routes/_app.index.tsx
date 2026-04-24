import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ShoppingBag, Inbox, PhoneCall, PhoneMissed, Users, Clock, Truck, CheckCircle2,
  PackageX, RotateCw, DollarSign, Wallet, Receipt, Percent, ListChecks,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { useDashboardData, type DashboardFilters } from "@/hooks/use-dashboard-data";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SmartAlerts, type SmartAlert } from "@/components/dashboard/SmartAlerts";
import { ConfirmationFunnel } from "@/components/dashboard/ConfirmationFunnel";
import { PerformanceList } from "@/components/dashboard/PerformanceLists";
import { LiveFeed } from "@/components/dashboard/LiveFeed";
import { DashboardFilterBar } from "@/components/dashboard/DashboardFilterBar";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function fmtSeconds(s: number) {
  if (!s) return "0s";
  const m = Math.floor(s / 60); const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function Dashboard() {
  const [filters, setFilters] = useState<DashboardFilters>({ range: "week" });
  const [cities, setCities] = useState<string[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [sources, setSources] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const [c, p, s] = await Promise.all([
        supabase.from("cities").select("name").eq("is_active", true).order("name"),
        supabase.from("products").select("id,name").eq("is_active", true).order("name").limit(200),
        supabase.from("order_sources").select("name").eq("is_active", true).order("sort_order"),
      ]);
      setCities((c.data ?? []).map((x) => x.name));
      setProducts((p.data ?? []) as any);
      setSources((s.data ?? []).map((x) => x.name.toLowerCase().replace(/\s+/g, "_")));
    })();
  }, []);

  const { data } = useDashboardData(filters);

  const alerts = useMemo<SmartAlert[]>(() => {
    const a: SmartAlert[] = [];
    const confRate = data.totalOrders > 0 ? (data.confirmed / data.totalOrders) * 100 : 0;
    const returnRate = (data.delivered + data.refusedReturned) > 0 ? (data.refusedReturned / (data.delivered + data.refusedReturned)) * 100 : 0;
    const nrpRate = data.totalOrders > 0 ? (data.nrpOrders / data.totalOrders) * 100 : 0;
    if (data.totalOrders >= 5 && nrpRate > 25) a.push({ kind: "danger", icon: "warn", title: `High NRP rate: ${nrpRate.toFixed(1)}%`, detail: `${data.nrpOrders} orders with no reply` });
    if (data.totalOrders >= 5 && confRate < 50) a.push({ kind: "warn", icon: "trend", title: `Low confirmation rate: ${confRate.toFixed(1)}%`, detail: "Review agent capacity and call flow" });
    if ((data.delivered + data.refusedReturned) >= 5 && returnRate > 20) a.push({ kind: "danger", icon: "trend", title: `High return rate: ${returnRate.toFixed(1)}%`, detail: `${data.refusedReturned} returns vs ${data.delivered} delivered` });
    if (data.lowStockCount > 0) a.push({ kind: "warn", icon: "stock", title: `${data.lowStockCount} product${data.lowStockCount > 1 ? "s" : ""} low on stock`, detail: data.lowStockProducts.join(", ") });
    if (data.problemProducts.length > 0 && data.problemProducts[0].rate > 30) {
      const p = data.problemProducts[0];
      a.push({ kind: "warn", icon: "product", title: `Poor performer: ${p.name}`, detail: `${p.rate.toFixed(0)}% return rate` });
    }
    return a;
  }, [data]);

  const deliveryPerf = [
    { name: "Delivered", value: data.delivered, color: "var(--color-success)" },
    { name: "Refused / Returned", value: data.refusedReturned, color: "var(--color-destructive)" },
    { name: "In transit", value: data.inTransit, color: "var(--color-info)" },
  ];

  const nrpData = [
    { name: "Day 1", value: data.nrpDay1 },
    { name: "Day 2", value: data.nrpDay2 },
    { name: "Day 3+", value: data.nrpDay3 },
  ];

  const deliveryRate = (data.delivered + data.refusedReturned) > 0
    ? (data.delivered / (data.delivered + data.refusedReturned)) * 100 : 0;

  return (
    <div>
      <PageHeader
        title="Operations Dashboard"
        description="Real-time overview of orders, call center, delivery, and finance."
        actions={
          <Badge variant="outline" className="gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live
          </Badge>
        }
      />

      <div className="space-y-5">
        <DashboardFilterBar filters={filters} onChange={setFilters} cities={cities} products={products} sources={sources} />

        {alerts.length > 0 && <SmartAlerts alerts={alerts} />}

        {/* Orders */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">📦 Orders</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Total orders" value={data.totalOrders.toLocaleString()} icon={ShoppingBag} tone="luxury-1" hint="all-time volume" />
            <KpiCard label="New orders" value={data.newOrders.toLocaleString()} icon={Inbox} tone="luxury-5" hint="not treated yet" />
            <KpiCard label="Waiting confirmation" value={data.waitingConfirmation.toLocaleString()} icon={ListChecks} tone="luxury-3" hint="pending review" />
            <KpiCard label="NRP orders" value={data.nrpOrders.toLocaleString()} icon={PhoneMissed} tone="luxury-2" hint="needs follow-up" />
          </div>
        </section>

        {/* Call center */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">📞 Call center</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Orders in queue" value={data.inQueue.toLocaleString()} icon={Inbox} tone="luxury-3" hint="awaiting agent" />
            <KpiCard label="Treated today" value={data.treatedToday.toLocaleString()} icon={PhoneCall} tone="luxury-5" hint="processed calls" />
            <KpiCard label="Active agents" value={data.activeAgents.toLocaleString()} icon={Users} tone="luxury-1" hint="online now" />
            <KpiCard label="Avg call time" value={fmtSeconds(data.avgCallSeconds)} icon={Clock} tone="luxury-4" hint="per conversation" />
          </div>
        </section>

        {/* Delivery */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">🚚 Delivery</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Sent to delivery" value={data.sentToDelivery.toLocaleString()} icon={Truck} tone="luxury-5" hint="shipped parcels" />
            <KpiCard label="Delivered" value={data.delivered.toLocaleString()} icon={CheckCircle2} tone="luxury-4" hint="completed orders" />
            <KpiCard label="Refused / Returned" value={data.refusedReturned.toLocaleString()} icon={PackageX} tone="luxury-2" hint="returned to stock" />
            <KpiCard label="In transit" value={data.inTransit.toLocaleString()} icon={RotateCw} tone="luxury-1" hint="on the road" />
          </div>
        </section>

        {/* Finance */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">💰 Finance</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Revenue (delivered)" value={fmtMoney(data.revenue)} icon={DollarSign} tone="luxury-4" hint="cash collected" />
            <KpiCard label="Estimated profit" value={fmtMoney(data.estimatedProfit)} icon={Wallet} tone={data.estimatedProfit >= 0 ? "luxury-1" : "luxury-2"} hint="net margin" />
            <KpiCard label="Total expenses" value={fmtMoney(data.totalExpenses)} icon={Receipt} tone="luxury-3" hint="costs incurred" />
            <KpiCard label="Margin" value={`${data.margin.toFixed(1)}%`} icon={Percent} tone={data.margin >= 15 ? "luxury-4" : data.margin >= 0 ? "luxury-3" : "luxury-2"} hint="profit ratio" />
          </div>
        </section>

        {/* Charts row */}
        <section className="grid gap-4 lg:grid-cols-3">
          <ConfirmationFunnel total={data.totalOrders} confirmed={data.confirmed} delivered={data.delivered} />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">NRP analysis</CardTitle>
              <p className="text-xs text-muted-foreground">No-reply orders by attempt</p>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={nrpData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={12} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {nrpData.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? "var(--color-warning)" : i === 1 ? "var(--color-info)" : "var(--color-destructive)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Delivery performance</CardTitle>
              <p className="text-xs text-muted-foreground">Delivery rate: <span className="font-medium text-foreground">{deliveryRate.toFixed(1)}%</span></p>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={deliveryPerf} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {deliveryPerf.map((d, i) => (<Cell key={i} fill={d.color} />))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Team performance */}
        <section className="grid gap-4 lg:grid-cols-2">
          <PerformanceList
            tone="good"
            title="Top agents"
            description="Highest confirmed orders"
            rows={data.topAgents}
            primaryLabel="Confirmed"
            secondaryLabel="Delivered"
            empty="No agent activity yet"
          />
          <PerformanceList
            tone="bad"
            title="Worst agents"
            description="High NRP rate"
            rows={data.worstAgents.map((a) => ({ name: a.name, primary: a.primary, badge: { text: `${a.rate.toFixed(0)}% NRP`, tone: "bad" as const } }))}
            primaryLabel="NRP"
            empty="No problem agents detected"
          />
        </section>

        {/* Product performance */}
        <section className="grid gap-4 lg:grid-cols-2">
          <PerformanceList
            tone="good"
            title="Top selling products"
            description="By delivered units"
            rows={data.topProducts}
            primaryLabel="Sold"
            empty="No product sales yet"
          />
          <PerformanceList
            tone="bad"
            title="Problem products"
            description="High return / refusal rate"
            rows={data.problemProducts.map((p) => ({ name: p.name, primary: p.primary, badge: { text: `${p.rate.toFixed(0)}% returned`, tone: "bad" as const } }))}
            primaryLabel="Returned"
            empty="No problem products"
          />
        </section>

        {/* City performance */}
        <section className="grid gap-4 lg:grid-cols-2">
          <PerformanceList
            tone="good"
            title="Top cities"
            description="Highest delivery volume"
            rows={data.topCities.map((c) => ({ name: c.name, primary: c.primary, badge: { text: `${c.rate.toFixed(0)}%`, tone: "good" as const } }))}
            primaryLabel="Delivered"
            empty="No city data yet"
          />
          <PerformanceList
            tone="bad"
            title="Problem cities"
            description="High refusal rate"
            rows={data.problemCities.map((c) => ({ name: c.name, primary: c.primary, badge: { text: `${c.rate.toFixed(0)}% refused`, tone: "bad" as const } }))}
            primaryLabel="Refused"
            empty="No problem cities"
          />
        </section>

        {/* Live feed */}
        <section>
          <LiveFeed orders={data.recentOrders} activity={data.recentActivity} />
        </section>
      </div>
    </div>
  );
}
