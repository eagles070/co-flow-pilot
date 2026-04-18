import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Search, Users, RefreshCw, Pencil, Trash2 } from "lucide-react";
import {
  ORDER_SOURCES,
  ORDER_STATUSES,
  statusLabel,
  statusVariant,
  type OrderSource,
  type OrderStatus,
} from "@/lib/order-status";
import { NewOrderDialog } from "@/components/orders/NewOrderDialog";
import { EditOrderDialog } from "@/components/orders/EditOrderDialog";

export const Route = createFileRoute("/_app/orders")({
  component: OrdersPage,
});

interface OrderItem {
  product_name: string;
  quantity: number;
}

interface OrderRow {
  id: string;
  reference: string;
  customer_name: string;
  customer_phone: string;
  shipping_address: string | null;
  city: string | null;
  total_amount: number;
  status: OrderStatus;
  source: OrderSource;
  store_id: string | null;
  agent_id: string | null;
  created_at: string;
  order_items: OrderItem[];
}

interface AgentOpt {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface StoreOpt {
  id: string;
  name: string;
}

function OrdersPage() {
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "moderator"]);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [agents, setAgents] = useState<AgentOpt[]>([]);
  const [stores, setStores] = useState<StoreOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [bulkAgent, setBulkAgent] = useState<string>("");

  const fetchAll = async () => {
    setLoading(true);
    const [ordersRes, agentsRes, storesRes] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500),
      supabase
        .from("user_roles")
        .select("user_id, profiles:user_id(id, full_name, email)")
        .in("role", ["agent", "admin", "moderator"]),
      supabase.from("stores").select("id, name").order("name"),
    ]);

    if (ordersRes.error) toast.error(ordersRes.error.message);
    setOrders((ordersRes.data ?? []) as OrderRow[]);

    const ag: AgentOpt[] = [];
    const seen = new Set<string>();
    (agentsRes.data ?? []).forEach((r: any) => {
      const p = r.profiles;
      if (p && !seen.has(p.id)) {
        seen.add(p.id);
        ag.push({ id: p.id, full_name: p.full_name, email: p.email });
      }
    });
    setAgents(ag);
    setStores((storesRes.data ?? []) as StoreOpt[]);
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (sourceFilter !== "all" && o.source !== sourceFilter) return false;
      if (agentFilter !== "all") {
        if (agentFilter === "unassigned" && o.agent_id) return false;
        if (agentFilter !== "unassigned" && o.agent_id !== agentFilter) return false;
      }
      if (q) {
        return (
          o.reference.toLowerCase().includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          o.customer_phone.toLowerCase().includes(q) ||
          (o.city ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, search, statusFilter, sourceFilter, agentFilter]);

  const allSelected = filtered.length > 0 && filtered.every((o) => selected.has(o.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((o) => o.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const updateStatus = async (id: string, status: OrderStatus) => {
    const now = new Date().toISOString();
    const patch: {
      status: OrderStatus;
      confirmed_at?: string;
      shipped_at?: string;
      delivered_at?: string;
      returned_at?: string;
    } = { status };
    if (status === "confirmed") patch.confirmed_at = now;
    if (status === "shipped") patch.shipped_at = now;
    if (status === "delivered") patch.delivered_at = now;
    if (status === "returned" || status === "refused") patch.returned_at = now;

    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status } : o))
    );
    toast.success("Status updated");
  };

  const bulkAssign = async () => {
    if (!bulkAgent || selected.size === 0) {
      toast.error("Select orders and an agent");
      return;
    }
    const ids = Array.from(selected);
    const { error } = await supabase
      .from("orders")
      .update({ agent_id: bulkAgent, status: "assigned" })
      .in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Assigned ${ids.length} order(s)`);
    setOrders((prev) =>
      prev.map((o) =>
        selected.has(o.id) ? { ...o, agent_id: bulkAgent, status: "assigned" } : o
      )
    );
    setSelected(new Set());
    setBulkAgent("");
  };

  const agentName = (id: string | null) => {
    if (!id) return "—";
    const a = agents.find((x) => x.id === id);
    return a?.full_name || a?.email || "Unknown";
  };

  return (
    <div>
      <PageHeader
        title="Orders"
        description={`${filtered.length} of ${orders.length} order(s)`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {canManage && <NewOrderDialog stores={stores} onCreated={fetchAll} />}
          </div>
        }
      />

      <Card className="p-4">
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ref, name, phone, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {ORDER_SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.full_name || a.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bulk bar */}
        {canManage && selected.size > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-md border bg-muted/30 p-2">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <div className="ml-auto flex items-center gap-2">
              <Select value={bulkAgent} onValueChange={setBulkAgent}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Assign to agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name || a.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={bulkAssign} disabled={!bulkAgent}>
                <Users className="mr-2 h-4 w-4" />
                Assign
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {canManage && (
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                )}
                <TableHead>Reference</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 10 : 9} className="py-8 text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 10 : 9} className="py-8 text-center text-muted-foreground">
                    No orders match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((o) => (
                  <TableRow key={o.id} data-state={selected.has(o.id) ? "selected" : undefined}>
                    {canManage && (
                      <TableCell>
                        <Checkbox
                          checked={selected.has(o.id)}
                          onCheckedChange={() => toggleOne(o.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-mono text-xs">{o.reference}</TableCell>
                    <TableCell className="font-medium">{o.customer_name}</TableCell>
                    <TableCell>{o.customer_phone}</TableCell>
                    <TableCell>{o.city ?? "—"}</TableCell>
                    <TableCell>{Number(o.total_amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {o.source.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{agentName(o.agent_id)}</TableCell>
                    <TableCell>
                      <Select
                        value={o.status}
                        onValueChange={(v) => updateStatus(o.id, v as OrderStatus)}
                      >
                        <SelectTrigger className="h-8 w-[140px] border-0 bg-transparent p-0 hover:bg-accent/50">
                          <Badge variant={statusVariant(o.status)} className="cursor-pointer">
                            {statusLabel(o.status)}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {ORDER_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
