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
import {
  Search,
  Users,
  RefreshCw,
  Pencil,
  Trash2,
  Phone,
  CheckCircle2,
  XCircle,
  ListChecks,
  MoreVertical,
  Clock,
  ShoppingBag,
} from "lucide-react";
import { SectionHeader } from "@/components/layout/SectionHeader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { OrderDetailSheet } from "@/components/orders/OrderDetailSheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/orders")({
  component: OrdersPage,
});

interface OrderItem {
  product_id: string | null;
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
  attempts: number;
  created_at: string;
  updated_at: string;
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

interface ProductOpt {
  id: string;
  name: string;
}

const DATE_RANGES = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
];

function rowTone(s: OrderStatus): string {
  switch (s) {
    case "new":
    case "assigned":
      return "bg-row-new/40 hover:bg-row-new/60";
    case "no_reply":
    case "postponed":
      return "bg-row-nrp/40 hover:bg-row-nrp/60";
    case "confirmed":
      return "bg-row-confirmed/40 hover:bg-row-confirmed/60";
    case "shipped":
    case "in_transit":
      return "bg-row-shipped/40 hover:bg-row-shipped/60";
    case "delivered":
      return "bg-row-delivered/40 hover:bg-row-delivered/60";
    case "cancelled":
    case "refused":
    case "returned":
    case "duplicate":
      return "bg-row-danger/40 hover:bg-row-danger/60";
    default:
      return "hover:bg-muted/40";
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function OrdersPage() {
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "moderator"]);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [agents, setAgents] = useState<AgentOpt[]>([]);
  const [stores, setStores] = useState<StoreOpt[]>([]);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");

  const [bulkAgent, setBulkAgent] = useState<string>("");
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [ordersRes, agentsRes, storesRes, productsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*, order_items(product_id, product_name, quantity)")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("user_roles")
        .select("user_id, profiles:user_id(id, full_name, email)")
        .in("role", ["agent", "admin", "moderator"]),
      supabase.from("stores").select("id, name").order("name"),
      supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    ]);

    if (ordersRes.error) toast.error(ordersRes.error.message);
    setOrders((ordersRes.data ?? []) as unknown as OrderRow[]);

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
    setProducts((productsRes.data ?? []) as ProductOpt[]);
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const cities = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => o.city && set.add(o.city));
    return Array.from(set).sort();
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const cutoff =
      dateRange === "today"
        ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
        : dateRange === "7"
        ? now - 7 * 86400000
        : dateRange === "30"
        ? now - 30 * 86400000
        : 0;

    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (sourceFilter !== "all" && o.source !== sourceFilter) return false;
      if (agentFilter !== "all") {
        if (agentFilter === "unassigned" && o.agent_id) return false;
        if (agentFilter !== "unassigned" && o.agent_id !== agentFilter) return false;
      }
      if (cityFilter !== "all" && (o.city ?? "") !== cityFilter) return false;
      if (productFilter !== "all" && !o.order_items?.some((it) => it.product_id === productFilter)) return false;
      if (cutoff > 0 && new Date(o.created_at).getTime() < cutoff) return false;
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
  }, [orders, search, statusFilter, sourceFilter, agentFilter, cityFilter, productFilter, dateRange]);

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

  const buildStatusPatch = (status: OrderStatus) => {
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
    return patch;
  };

  const updateStatus = async (id: string, status: OrderStatus) => {
    const { error } = await supabase.from("orders").update(buildStatusPatch(status)).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
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
      prev.map((o) => (selected.has(o.id) ? { ...o, agent_id: bulkAgent, status: "assigned" } : o))
    );
    setSelected(new Set());
    setBulkAgent("");
  };

  const bulkChangeStatus = async () => {
    if (!bulkStatus || selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("orders").update(buildStatusPatch(bulkStatus as OrderStatus)).in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Updated ${ids.length} order(s)`);
    setOrders((prev) =>
      prev.map((o) => (selected.has(o.id) ? { ...o, status: bulkStatus as OrderStatus } : o))
    );
    setSelected(new Set());
    setBulkStatus("");
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from("orders").delete().eq("id", deletingId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOrders((prev) => prev.filter((o) => o.id !== deletingId));
    toast.success("Order deleted");
    setDeletingId(null);
  };

  const confirmBulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const { error } = await supabase.from("orders").delete().in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOrders((prev) => prev.filter((o) => !selected.has(o.id)));
    toast.success(`Deleted ${ids.length} order(s)`);
    setSelected(new Set());
    setBulkDeleteOpen(false);
  };

  const agentName = (id: string | null) => {
    if (!id) return "—";
    const a = agents.find((x) => x.id === id);
    return a?.full_name || a?.email || "Unknown";
  };

  const callPhone = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="space-y-5">
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

      <SectionHeader
        icon={ShoppingBag}
        title="Order Management"
        description="Filter, assign, and update orders across all sources"
        variant="primary"
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
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {ORDER_SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Agent" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="City" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Product" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bulk bar */}
        {canManage && selected.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Select value={bulkAgent} onValueChange={setBulkAgent}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Assign to agent..." /></SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={bulkAssign} disabled={!bulkAgent} size="sm">
                <Users className="mr-1 h-4 w-4" />Assign
              </Button>

              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Change status..." /></SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={bulkChangeStatus} disabled={!bulkStatus} size="sm" variant="secondary">
                <ListChecks className="mr-1 h-4 w-4" />Apply
              </Button>

              <Button onClick={() => setBulkDeleteOpen(true)} size="sm" variant="destructive">
                <Trash2 className="mr-1 h-4 w-4" />Delete
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
                <TableHead>Products</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">NRP</TableHead>
                <TableHead>Waiting</TableHead>
                <TableHead>Last action</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 14 : 13} className="py-8 text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 14 : 13} className="py-8 text-center text-muted-foreground">
                    No orders match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((o) => {
                  const isDelivered = o.status === "delivered";
                  const isCancelled =
                    o.status === "cancelled" || o.status === "refused" || o.status === "returned";
                  const locked = isDelivered;
                  return (
                  <TableRow
                    key={o.id}
                    data-state={selected.has(o.id) ? "selected" : undefined}
                    className={cn("group cursor-pointer", rowTone(o.status))}
                    onClick={() => setDetailId(o.id)}
                  >
                    {canManage && (
                      <TableCell onClick={stop}>
                        <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggleOne(o.id)} />
                      </TableCell>
                    )}
                    <TableCell className="text-xs font-medium">
                      {o.agent_id ? agentName(o.agent_id) : o.reference}
                    </TableCell>
                    <TableCell className="font-medium">{o.customer_name}</TableCell>
                    <TableCell className="tabular-nums">{o.customer_phone}</TableCell>
                    <TableCell>{o.city ?? "—"}</TableCell>
                    <TableCell className="max-w-[220px] text-sm">
                      {o.order_items && o.order_items.length > 0 ? (
                        <div className="space-y-1" title={o.order_items.map((it) => `${it.quantity}× ${it.product_name}`).join(", ")}>
                          {o.order_items.slice(0, 2).map((it, index) => (
                            <div key={`${o.id}-${index}`} className="truncate">
                              <span className="text-muted-foreground">{it.quantity}×</span>{" "}
                              {it.product_name}
                            </div>
                          ))}
                          {o.order_items.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                              +{o.order_items.length - 2} autre(s)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">{Number(o.total_amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{o.source.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {o.agent_id ? (
                        agentName(o.agent_id)
                      ) : (
                        <span className="italic text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell onClick={stop}>
                      <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v as OrderStatus)}>
                        <SelectTrigger className="h-8 w-[140px] border-0 bg-transparent p-0 hover:bg-accent/50">
                          <Badge variant={statusVariant(o.status)} className="cursor-pointer">
                            {statusLabel(o.status)}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {ORDER_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      {o.attempts > 0 ? (
                        <Badge
                          variant={o.attempts >= 3 ? "destructive" : "outline"}
                          className="font-mono"
                        >
                          NRP ({o.attempts})
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(o.created_at)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{timeAgo(o.updated_at)}</TableCell>
                    <TableCell className="text-right" onClick={stop}>
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Call"
                          disabled={locked}
                          onClick={() => callPhone(o.customer_phone)}
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-success hover:text-success"
                          title="Confirm"
                          disabled={locked || isCancelled || o.status === "confirmed"}
                          onClick={() => updateStatus(o.id, "confirmed")}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="More">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              disabled={locked || isCancelled}
                              onClick={() => updateStatus(o.id, "cancelled")}
                            >
                              <XCircle className="h-4 w-4" />
                              Cancel
                            </DropdownMenuItem>
                            {canManage && (
                              <>
                                <DropdownMenuItem disabled={locked} onClick={() => setEditingId(o.id)}>
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeletingId(o.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <EditOrderDialog
        orderId={editingId}
        stores={stores}
        onClose={() => setEditingId(null)}
        onSaved={fetchAll}
      />

      <OrderDetailSheet orderId={detailId} onClose={() => setDetailId(null)} />

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All line items and history for this order will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} order(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All selected orders, their items and history will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
