import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/delivery")({
  component: DeliveryPage,
});

interface OrderRow {
  id: string;
  reference: string;
  customer_name: string;
  customer_phone: string;
  city: string | null;
  status: string;
  total_amount: number;
  shipped_at: string | null;
  delivered_at: string | null;
  returned_at: string | null;
  updated_at: string;
}

const SHIPPING_STATUSES = [
  "shipped",
  "in_transit",
  "delivered",
  "returned",
  "refused",
  "postponed",
];

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "delivered") return "default";
  if (status === "returned" || status === "refused") return "destructive";
  if (status === "in_transit" || status === "shipped") return "secondary";
  return "outline";
}

function DeliveryPage() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("orders")
        .select(
          "id,reference,customer_name,customer_phone,city,status,total_amount,shipped_at,delivered_at,returned_at,updated_at",
        )
        .in("status", SHIPPING_STATUSES)
        .order("updated_at", { ascending: false })
        .limit(200);
      setRows(rows => (data as OrderRow[]) ?? rows);
      setLoading(false);
    })();
  }, []);

  const issues = rows.filter((r) =>
    ["returned", "refused", "postponed"].includes(r.status),
  );

  const renderTable = (data: OrderRow[]) => (
    <div className="rounded-lg border bg-card">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">No orders.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Last update</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.reference}</TableCell>
                <TableCell>
                  <div>{o.customer_name}</div>
                  <div className="text-xs text-muted-foreground">{o.customer_phone}</div>
                </TableCell>
                <TableCell>{o.city ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(o.status)}>{o.status}</Badge>
                </TableCell>
                <TableCell className="text-right">{Number(o.total_amount).toFixed(2)}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {new Date(o.updated_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader title="Delivery" description="Track shipments and follow-up issues." />
      <Tabs defaultValue="followup">
        <TabsList>
          <TabsTrigger value="followup">Follow-up ({issues.length})</TabsTrigger>
          <TabsTrigger value="all">All ({rows.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="followup" className="mt-4">
          {renderTable(issues)}
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          {renderTable(rows)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
