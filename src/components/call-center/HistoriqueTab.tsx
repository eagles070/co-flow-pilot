import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Pencil, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { EditOrderDialog } from "@/components/orders/EditOrderDialog";
import { ChangeStatusDialog, type StatusOpt } from "./ChangeStatusDialog";
import type { OrderStatus } from "@/lib/order-status";

interface Row {
  id: string;
  reference: string;
  customer_name: string;
  customer_phone: string;
  city: string | null;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
  agent_id: string | null;
  order_items: { product_name: string; quantity: number }[];
}

interface AgentOpt { id: string; full_name: string | null; email: string | null }
interface StoreOpt { id: string; name: string }

interface Props {
  statuses: StatusOpt[];
  stores: StoreOpt[];
}

export function HistoriqueTab({ statuses, stores }: Props) {
  const { hasAnyRole } = useAuth();
  const isStaff = hasAnyRole(["admin", "moderator"]);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [agents, setAgents] = useState<AgentOpt[]>([]);
  const [editOpen, setEditOpen] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState<{ id: string; status: OrderStatus } | null>(null);

  useEffect(() => {
    if (!isStaff) return;
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name")
      .then(({ data }) => setAgents((data ?? []) as AgentOpt[]));
  }, [isStaff]);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("orders")
      .select("id, reference, customer_name, customer_phone, city, total_amount, status, created_at, agent_id, order_items(product_name, quantity)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") q = q.eq("status", statusFilter as OrderStatus);
    if (agentFilter !== "all") q = q.eq("agent_id", agentFilter);
    if (from) q = q.gte("created_at", new Date(from).toISOString());
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      q = q.lte("created_at", end.toISOString());
    }

    const fromIdx = (page - 1) * pageSize;
    const toIdx = fromIdx + pageSize - 1;
    const { data, count, error } = await q.range(fromIdx, toIdx);
    setLoading(false);
    if (error) return;
    setRows((data ?? []) as Row[]);
    setTotal(count ?? 0);
  }, [statusFilter, agentFilter, from, to, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  const statusMap = useMemo(() => {
    const m = new Map<string, StatusOpt>();
    statuses.forEach((s) => m.set(s.key, s));
    return m;
  }, [statuses]);

  const agentMap = useMemo(() => {
    const m = new Map<string, string>();
    agents.forEach((a) => m.set(a.id, a.full_name || a.email || a.id.slice(0, 8)));
    return m;
  }, [agents]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card>
      <CardContent className="p-4">
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Status</label>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[150px]">
            <label className="mb-1 block text-xs text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </div>
          <div className="min-w-[150px]">
            <label className="mb-1 block text-xs text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
          {isStaff && (
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Agent</label>
              <Select value={agentFilter} onValueChange={(v) => { setAgentFilter(v); setPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All agents</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="mr-1.5 h-4 w-4" />Refresh
          </Button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Informations</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead className="text-right">Prix</TableHead>
                  <TableHead>État</TableHead>
                  {isStaff && <TableHead>Agent</TableHead>}
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const s = statusMap.get(r.status);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.customer_name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{r.customer_phone}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.order_items?.length ? (
                          <div className="space-y-1">
                            {r.order_items.slice(0, 2).map((item, index) => (
                              <div key={`${r.id}-${index}`} className="leading-5">
                                <span className="text-foreground">{item.product_name}</span>
                                <span className="ml-1 text-xs">×{item.quantity}</span>
                              </div>
                            ))}
                            {r.order_items.length > 2 && (
                              <div className="text-xs">+{r.order_items.length - 2} autre(s)</div>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{r.city ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">{Number(r.total_amount).toFixed(2)}</TableCell>
                      <TableCell>
                        {s ? (
                          <Badge
                            variant="outline"
                            style={{ borderColor: s.color, color: s.color }}
                            className="font-medium"
                          >
                            <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                            {s.label}
                          </Badge>
                        ) : (
                          <Badge variant="outline">{r.status}</Badge>
                        )}
                      </TableCell>
                      {isStaff && (
                        <TableCell className="text-sm text-muted-foreground">
                          {r.agent_id ? (agentMap.get(r.agent_id) ?? "—") : "—"}
                        </TableCell>
                      )}
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" title="Edit" onClick={() => setEditOpen(r.id)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Change status"
                            onClick={() => setStatusOpen({ id: r.id, status: r.status })}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Rows per page</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span>· {total} total</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-muted-foreground">Page {page} / {totalPages}</span>
            <Button size="icon" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>

      <EditOrderDialog
        orderId={editOpen}
        stores={stores}
        onClose={() => setEditOpen(null)}
        onSaved={() => load()}
      />
      <ChangeStatusDialog
        orderId={statusOpen?.id ?? null}
        currentStatus={statusOpen?.status ?? null}
        statuses={statuses}
        onClose={() => setStatusOpen(null)}
        onSaved={() => load()}
      />
    </Card>
  );
}
