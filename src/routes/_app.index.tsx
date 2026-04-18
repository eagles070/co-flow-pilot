import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag, CheckCircle2, Truck, XCircle, TrendingUp, DollarSign,
  Phone, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend,
} from "recharts";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

const trendData = [
  { day: "Mon", orders: 145, confirmed: 92, delivered: 71 },
  { day: "Tue", orders: 168, confirmed: 110, delivered: 84 },
  { day: "Wed", orders: 152, confirmed: 98, delivered: 79 },
  { day: "Thu", orders: 189, confirmed: 124, delivered: 96 },
  { day: "Fri", orders: 215, confirmed: 148, delivered: 112 },
  { day: "Sat", orders: 198, confirmed: 132, delivered: 105 },
  { day: "Sun", orders: 176, confirmed: 118, delivered: 91 },
];

const perfData = [
  { name: "Confirmed", value: 68 },
  { name: "Delivered", value: 52 },
  { name: "Returned", value: 11 },
  { name: "Cancelled", value: 18 },
];

interface KpiProps {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down";
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "warning" | "info" | "destructive";
}

function Kpi({ label, value, delta, trend, icon: Icon, tone = "default" }: KpiProps) {
  const toneClass = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
    info: "bg-info/10 text-info",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];

  return (
    <Card className="overflow-hidden border-border/60 transition-shadow hover:shadow-[var(--shadow-md)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
            {delta && (
              <div className="mt-1 flex items-center gap-1 text-xs">
                {trend === "up" ? (
                  <ArrowUpRight className="h-3 w-3 text-success" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-destructive" />
                )}
                <span className={trend === "up" ? "text-success" : "text-destructive"}>{delta}</span>
                <span className="text-muted-foreground">vs last week</span>
              </div>
            )}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Real-time overview of your COD operations."
        actions={<Badge variant="outline" className="gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live</Badge>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total Orders" value="1,243" delta="+12.4%" trend="up" icon={ShoppingBag} />
        <Kpi label="Confirmed" value="842" delta="+8.1%" trend="up" icon={CheckCircle2} tone="info" />
        <Kpi label="Delivered" value="638" delta="+5.6%" trend="up" icon={Truck} tone="success" />
        <Kpi label="Cancelled / Refused" value="124" delta="-3.2%" trend="down" icon={XCircle} tone="destructive" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Confirmation Rate" value="67.7%" delta="+2.1%" trend="up" icon={Phone} tone="info" />
        <Kpi label="Delivery Rate" value="75.8%" delta="+1.4%" trend="up" icon={TrendingUp} tone="success" />
        <Kpi label="Revenue" value="$48,920" delta="+14.2%" trend="up" icon={DollarSign} />
        <Kpi label="Profit" value="$12,180" delta="+9.7%" trend="up" icon={DollarSign} tone="success" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Orders trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="orders" stroke="var(--color-primary)" fill="url(#g1)" strokeWidth={2} />
                  <Area type="monotone" dataKey="delivered" stroke="var(--color-success)" fill="url(#g2)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perfData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="var(--color-muted-foreground)" fontSize={12} width={80} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confirmation trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="orders" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="confirmed" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">What's next</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Phase 1 is live — auth, role system, app shell, and dashboard skeleton are ready.
              </p>
              <ul className="space-y-2">
                {[
                  "Phase 2 — Orders module (table, filters, bulk assign, sources)",
                  "Phase 3 — Call Center workflow with NRP/recall logic",
                  "Phase 4 — Delivery sync, Inventory and Sourcing",
                  "Phase 5 — Finance, Team performance, Blacklist, Logs",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
