import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Row {
  productId: string;
  name: string;
  totalOrders: number;
  confirmed: number;
  delivered: number;
  returned: number;
  revenue: number;
  cost: number;
  shipping: number;
  expenses: number;
}

export function ProfitTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [
      { data: products },
      { data: items },
      { data: purchases },
      { data: expenses },
      { data: orders },
      { data: cities },
    ] = await Promise.all([
      supabase.from("products").select("id,name,cost_price"),
      supabase
        .from("order_items")
        .select("product_id,product_name,quantity,unit_price,order_id,orders(status,city,total_amount)"),
      supabase.from("purchases").select("product_id,quantity,unit_cost,status"),
      supabase.from("expenses").select("product_id,amount"),
      supabase.from("orders").select("id,total_amount"),
      supabase.from("cities").select("name,delivery_cost,return_cost"),
    ]);

    // Average cost per product from received purchases (fallback to product.cost_price)
    const costMap = new Map<string, { qty: number; spent: number }>();
    (purchases ?? []).filter((p) => p.status === "received" && p.product_id).forEach((p) => {
      const c = costMap.get(p.product_id!) ?? { qty: 0, spent: 0 };
      c.qty += p.quantity;
      c.spent += p.quantity * Number(p.unit_cost);
      costMap.set(p.product_id!, c);
    });

    const expMap = new Map<string, number>();
    (expenses ?? []).filter((e) => e.product_id).forEach((e) => {
      expMap.set(e.product_id!, (expMap.get(e.product_id!) ?? 0) + Number(e.amount));
    });

    // City price map
    const cityMap = new Map<string, { delivery: number; refused: number }>();
    (cities ?? []).forEach((c) => {
      cityMap.set((c.name ?? "").trim().toLowerCase(), {
        delivery: Number(c.delivery_cost ?? 0),
        refused: Number(c.return_cost ?? 0),
      });
    });
    const priceFor = (city: string | null | undefined) =>
      cityMap.get((city ?? "").trim().toLowerCase()) ?? { delivery: 0, refused: 0 };

    // Order total map (for prorating shipping cost across items in same order)
    const orderTotalMap = new Map<string, number>();
    (orders ?? []).forEach((o) => orderTotalMap.set(o.id, Number(o.total_amount) || 0));

    const agg = new Map<string, Row>();
    (items ?? []).forEach((it) => {
      const pid = it.product_id ?? `name:${it.product_name}`;
      const ord = (it.orders as any) as { status?: string; city?: string | null; total_amount?: number } | null;
      const status = ord?.status;
      const r = agg.get(pid) ?? {
        productId: pid,
        name: it.product_name,
        totalOrders: 0, confirmed: 0, delivered: 0, returned: 0,
        revenue: 0, cost: 0, shipping: 0, expenses: 0,
      };
      r.totalOrders += 1;
      if (status === "confirmed") r.confirmed += 1;

      const lineTotal = it.quantity * Number(it.unit_price);
      const orderTotal = orderTotalMap.get(it.order_id) ?? Number(ord?.total_amount ?? lineTotal);
      const share = orderTotal > 0 ? lineTotal / orderTotal : 1;

      if (status === "delivered") {
        r.delivered += 1;
        r.revenue += lineTotal;
        const cm = it.product_id ? costMap.get(it.product_id) : undefined;
        const product = (products ?? []).find((p) => p.id === it.product_id);
        const unitCost = cm && cm.qty > 0 ? cm.spent / cm.qty : Number(product?.cost_price ?? 0);
        r.cost += unitCost * it.quantity;
        r.shipping += priceFor(ord?.city).delivery * share;
      }
      if (status === "returned" || status === "refused") {
        r.returned += 1;
        r.shipping += priceFor(ord?.city).refused * share;
      }
      agg.set(pid, r);
    });

    agg.forEach((r) => { r.expenses = it_expense(r.productId, expMap); });
    setRows(
      Array.from(agg.values()).sort(
        (a, b) =>
          b.revenue - b.cost - b.shipping - b.expenses -
          (a.revenue - a.cost - a.shipping - a.expenses),
      ),
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (rows.length === 0) return <div className="py-16 text-center text-sm text-muted-foreground">No order data yet.</div>;

  return (
    <div className="rounded-2xl border border-border/70 bg-card shadow-[var(--shadow-sm)]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Orders</TableHead>
            <TableHead className="text-right">Confirmed</TableHead>
            <TableHead className="text-right">Delivered</TableHead>
            <TableHead className="text-right">Returned</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Shipping</TableHead>
            <TableHead className="text-right">Expenses</TableHead>
            <TableHead className="text-right">Profit</TableHead>
            <TableHead className="text-right">Margin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const profit = r.revenue - r.cost - r.shipping - r.expenses;
            const margin = r.revenue > 0 ? (profit / r.revenue) * 100 : 0;
            return (
              <TableRow key={r.productId}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-right">{r.totalOrders}</TableCell>
                <TableCell className="text-right">{r.confirmed}</TableCell>
                <TableCell className="text-right">{r.delivered}</TableCell>
                <TableCell className="text-right">{r.returned}</TableCell>
                <TableCell className="text-right">{r.revenue.toFixed(2)}</TableCell>
                <TableCell className="text-right">{r.cost.toFixed(2)}</TableCell>
                <TableCell className="text-right">{r.shipping.toFixed(2)}</TableCell>
                <TableCell className="text-right">{r.expenses.toFixed(2)}</TableCell>
                <TableCell className={`text-right font-medium ${profit >= 0 ? "text-green-600" : "text-destructive"}`}>{profit.toFixed(2)}</TableCell>
                <TableCell className={`text-right ${margin >= 15 ? "text-green-600" : margin >= 0 ? "text-yellow-600" : "text-destructive"}`}>{margin.toFixed(1)}%</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function it_expense(pid: string, map: Map<string, number>) {
  if (pid.startsWith("name:")) return 0;
  return map.get(pid) ?? 0;
}
