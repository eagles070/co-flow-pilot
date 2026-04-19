import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FeedOrder, FeedActivity } from "@/components/dashboard/LiveFeed";

export type DateRange = "today" | "week" | "month" | "all";

export interface DashboardFilters {
  range: DateRange;
  productId?: string;
  city?: string;
  source?: string;
}

interface OrderRow {
  id: string;
  status: string;
  source: string;
  city: string | null;
  agent_id: string | null;
  total_amount: number;
  delivery_cost: number;
  created_at: string;
  delivered_at: string | null;
  confirmed_at: string | null;
  attempts: number;
}

export interface DashboardData {
  loading: boolean;
  // Orders
  totalOrders: number;
  newOrders: number;
  waitingConfirmation: number;
  nrpOrders: number;
  // Call center
  inQueue: number;
  treatedToday: number;
  activeAgents: number;
  avgCallSeconds: number;
  // Delivery
  sentToDelivery: number;
  delivered: number;
  refusedReturned: number;
  inTransit: number;
  // Finance
  revenue: number;
  estimatedProfit: number;
  totalExpenses: number;
  margin: number;
  // Charts
  confirmed: number;
  nrpDay1: number;
  nrpDay2: number;
  nrpDay3: number;
  // Lists
  topAgents: Array<{ name: string; primary: number; secondary: number }>;
  worstAgents: Array<{ name: string; primary: number; rate: number }>;
  topProducts: Array<{ name: string; primary: number }>;
  problemProducts: Array<{ name: string; primary: number; rate: number }>;
  topCities: Array<{ name: string; primary: number; rate: number }>;
  problemCities: Array<{ name: string; primary: number; rate: number }>;
  // Live
  recentOrders: FeedOrder[];
  recentActivity: FeedActivity[];
  // Stock
  lowStockCount: number;
  lowStockProducts: string[];
}

const EMPTY: DashboardData = {
  loading: true,
  totalOrders: 0, newOrders: 0, waitingConfirmation: 0, nrpOrders: 0,
  inQueue: 0, treatedToday: 0, activeAgents: 0, avgCallSeconds: 0,
  sentToDelivery: 0, delivered: 0, refusedReturned: 0, inTransit: 0,
  revenue: 0, estimatedProfit: 0, totalExpenses: 0, margin: 0,
  confirmed: 0, nrpDay1: 0, nrpDay2: 0, nrpDay3: 0,
  topAgents: [], worstAgents: [], topProducts: [], problemProducts: [],
  topCities: [], problemCities: [], recentOrders: [], recentActivity: [],
  lowStockCount: 0, lowStockProducts: [],
};

function rangeStart(range: DateRange): Date | null {
  const now = new Date();
  if (range === "today") {
    const d = new Date(now); d.setHours(0, 0, 0, 0); return d;
  }
  if (range === "week") {
    const d = new Date(now); d.setDate(d.getDate() - 7); return d;
  }
  if (range === "month") {
    const d = new Date(now); d.setDate(d.getDate() - 30); return d;
  }
  return null;
}

export function useDashboardData(filters: DashboardFilters) {
  const [data, setData] = useState<DashboardData>(EMPTY);

  const load = useCallback(async () => {
    setData((d) => ({ ...d, loading: true }));
    const start = rangeStart(filters.range);
    const startIso = start?.toISOString();

    let oQ = supabase.from("orders").select("id,status,source,city,agent_id,total_amount,delivery_cost,created_at,delivered_at,confirmed_at,attempts").limit(5000);
    if (startIso) oQ = oQ.gte("created_at", startIso);
    if (filters.city) oQ = oQ.eq("city", filters.city);
    if (filters.source) oQ = oQ.eq("source", filters.source as any);

    let eQ = supabase.from("expenses").select("amount,expense_date").limit(5000);
    if (start) eQ = eQ.gte("expense_date", start.toISOString().slice(0, 10));

    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [
      ordersRes, expensesRes, callsRes, profilesRes,
      itemsRes, productsRes, recentOrdersRes, activityRes,
    ] = await Promise.all([
      oQ,
      eQ,
      supabase.from("call_attempts").select("agent_id,duration_seconds,created_at").gte("created_at", today.toISOString()),
      supabase.from("profiles").select("id,full_name,email,is_active"),
      filters.productId
        ? supabase.from("order_items").select("product_id,product_name,quantity,order_id,orders!inner(status,city,created_at)").eq("product_id", filters.productId).limit(5000)
        : supabase.from("order_items").select("product_id,product_name,quantity,order_id,orders!inner(status,city,created_at)").limit(5000),
      supabase.from("products").select("id,name,stock,low_stock_threshold,cost_price,sell_price").eq("is_active", true),
      supabase.from("orders").select("id,reference,customer_name,city,total_amount,status,source,created_at").order("created_at", { ascending: false }).limit(8),
      supabase.from("activity_logs").select("id,action,entity_type,description,user_email,created_at").order("created_at", { ascending: false }).limit(10),
    ]);

    const orders: OrderRow[] = (ordersRes.data ?? []) as any;
    const expenses = expensesRes.data ?? [];
    const calls = callsRes.data ?? [];
    const profiles = profilesRes.data ?? [];
    const items: any[] = (itemsRes.data ?? []) as any;
    const products = productsRes.data ?? [];

    const profileMap = new Map(profiles.map((p) => [p.id, p.full_name ?? p.email ?? "Unknown"]));

    // KPIs
    const totalOrders = orders.length;
    const newOrders = orders.filter((o) => o.status === "new").length;
    const waitingConfirmation = orders.filter((o) => ["new", "assigned", "no_reply", "postponed"].includes(o.status)).length;
    const nrpOrders = orders.filter((o) => o.status === "no_reply").length;

    const inQueue = orders.filter((o) => ["new", "assigned"].includes(o.status)).length;
    const treatedToday = calls.length;
    const activeAgents = new Set(calls.map((c) => c.agent_id)).size;
    const avgCallSeconds = calls.length > 0 ? calls.reduce((s, c) => s + (c.duration_seconds ?? 0), 0) / calls.length : 0;

    const sentToDelivery = orders.filter((o) => ["shipped", "in_transit"].includes(o.status)).length;
    const delivered = orders.filter((o) => o.status === "delivered").length;
    const refusedReturned = orders.filter((o) => ["returned", "refused"].includes(o.status)).length;
    const inTransit = orders.filter((o) => o.status === "in_transit").length;

    // Finance
    const revenue = orders.filter((o) => o.status === "delivered").reduce((s, o) => s + Number(o.total_amount), 0);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    // Estimated profit = revenue - product costs (from items) - delivery costs - expenses
    const productMap = new Map(products.map((p) => [p.id, p]));
    let productCogs = 0;
    let deliveryCogs = 0;
    for (const o of orders) {
      if (o.status === "delivered") deliveryCogs += Number(o.delivery_cost ?? 0);
    }
    for (const it of items) {
      const ord = it.orders;
      if (ord?.status === "delivered" && it.product_id) {
        const p = productMap.get(it.product_id);
        if (p) productCogs += Number(p.cost_price) * Number(it.quantity);
      }
    }
    const estimatedProfit = revenue - productCogs - deliveryCogs - totalExpenses;
    const margin = revenue > 0 ? (estimatedProfit / revenue) * 100 : 0;

    // Funnel
    const confirmedCount = orders.filter((o) => ["confirmed", "shipped", "in_transit", "delivered", "returned", "refused"].includes(o.status)).length;

    // NRP by attempts
    const nrpRows = orders.filter((o) => o.status === "no_reply");
    const nrpDay1 = nrpRows.filter((o) => o.attempts <= 1).length;
    const nrpDay2 = nrpRows.filter((o) => o.attempts === 2).length;
    const nrpDay3 = nrpRows.filter((o) => o.attempts >= 3).length;

    // Agents
    const agentStats = new Map<string, { confirmed: number; delivered: number; nrp: number; total: number }>();
    for (const o of orders) {
      if (!o.agent_id) continue;
      const cur = agentStats.get(o.agent_id) ?? { confirmed: 0, delivered: 0, nrp: 0, total: 0 };
      cur.total += 1;
      if (["confirmed", "shipped", "in_transit", "delivered", "returned", "refused"].includes(o.status)) cur.confirmed += 1;
      if (o.status === "delivered") cur.delivered += 1;
      if (o.status === "no_reply") cur.nrp += 1;
      agentStats.set(o.agent_id, cur);
    }
    const agentRows = Array.from(agentStats.entries()).map(([id, s]) => ({
      id, name: profileMap.get(id) ?? "Unknown", ...s,
      nrpRate: s.total > 0 ? (s.nrp / s.total) * 100 : 0,
    }));
    const topAgents = [...agentRows].sort((a, b) => b.confirmed - a.confirmed).slice(0, 5)
      .map((a) => ({ name: a.name, primary: a.confirmed, secondary: a.delivered }));
    const worstAgents = [...agentRows].filter((a) => a.total >= 3).sort((a, b) => b.nrpRate - a.nrpRate).slice(0, 5)
      .map((a) => ({ name: a.name, primary: a.nrp, rate: a.nrpRate }));

    // Products
    const productStats = new Map<string, { name: string; sold: number; delivered: number; returned: number; total: number }>();
    for (const it of items) {
      const ord = it.orders;
      if (!it.product_id || !ord) continue;
      const cur = productStats.get(it.product_id) ?? { name: it.product_name, sold: 0, delivered: 0, returned: 0, total: 0 };
      cur.total += Number(it.quantity);
      if (ord.status === "delivered") { cur.delivered += Number(it.quantity); cur.sold += Number(it.quantity); }
      if (["returned", "refused"].includes(ord.status)) cur.returned += Number(it.quantity);
      productStats.set(it.product_id, cur);
    }
    const productArr = Array.from(productStats.values());
    const topProducts = [...productArr].sort((a, b) => b.sold - a.sold).slice(0, 5)
      .map((p) => ({ name: p.name, primary: p.sold }));
    const problemProducts = [...productArr].filter((p) => p.total >= 3).sort((a, b) => (b.returned / b.total) - (a.returned / a.total)).slice(0, 5)
      .map((p) => ({ name: p.name, primary: p.returned, rate: (p.returned / p.total) * 100 }));

    // Cities
    const cityStats = new Map<string, { delivered: number; refused: number; total: number }>();
    for (const o of orders) {
      const c = o.city ?? "Unknown";
      const cur = cityStats.get(c) ?? { delivered: 0, refused: 0, total: 0 };
      cur.total += 1;
      if (o.status === "delivered") cur.delivered += 1;
      if (["returned", "refused"].includes(o.status)) cur.refused += 1;
      cityStats.set(c, cur);
    }
    const cityArr = Array.from(cityStats.entries()).map(([name, s]) => ({ name, ...s }));
    const topCities = [...cityArr].filter((c) => c.total >= 2).sort((a, b) => b.delivered - a.delivered).slice(0, 5)
      .map((c) => ({ name: c.name, primary: c.delivered, rate: c.total > 0 ? (c.delivered / c.total) * 100 : 0 }));
    const problemCities = [...cityArr].filter((c) => c.total >= 2).sort((a, b) => (b.refused / b.total) - (a.refused / a.total)).slice(0, 5)
      .map((c) => ({ name: c.name, primary: c.refused, rate: c.total > 0 ? (c.refused / c.total) * 100 : 0 }));

    // Stock
    const lowStock = products.filter((p) => Number(p.stock) <= Number(p.low_stock_threshold ?? 10));

    setData({
      loading: false,
      totalOrders, newOrders, waitingConfirmation, nrpOrders,
      inQueue, treatedToday, activeAgents, avgCallSeconds,
      sentToDelivery, delivered, refusedReturned, inTransit,
      revenue, estimatedProfit, totalExpenses, margin,
      confirmed: confirmedCount, nrpDay1, nrpDay2, nrpDay3,
      topAgents, worstAgents, topProducts, problemProducts,
      topCities, problemCities,
      recentOrders: (recentOrdersRes.data ?? []) as any,
      recentActivity: (activityRes.data ?? []) as any,
      lowStockCount: lowStock.length,
      lowStockProducts: lowStock.slice(0, 3).map((p) => p.name),
    });
  }, [filters.range, filters.productId, filters.city, filters.source]);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh on new orders / activity
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => { load(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs" }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { data, reload: load };
}
