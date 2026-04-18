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
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/team")({
  component: TeamPage,
});

interface AgentStats {
  agent_id: string;
  name: string;
  email: string;
  total: number;
  confirmed: number;
  delivered: number;
  cancelled: number;
  revenue: number;
}

function TeamPage() {
  const [stats, setStats] = useState<AgentStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: orders }, { data: profiles }] = await Promise.all([
        supabase
          .from("orders")
          .select("agent_id,status,total_amount")
          .not("agent_id", "is", null),
        supabase.from("profiles").select("id,full_name,email"),
      ]);

      const map = new Map<string, AgentStats>();
      for (const p of profiles ?? []) {
        map.set(p.id, {
          agent_id: p.id,
          name: p.full_name ?? p.email ?? "—",
          email: p.email ?? "",
          total: 0,
          confirmed: 0,
          delivered: 0,
          cancelled: 0,
          revenue: 0,
        });
      }
      for (const o of orders ?? []) {
        if (!o.agent_id) continue;
        const s = map.get(o.agent_id);
        if (!s) continue;
        s.total++;
        if (o.status === "confirmed") s.confirmed++;
        if (o.status === "delivered") {
          s.delivered++;
          s.revenue += Number(o.total_amount);
        }
        if (o.status === "cancelled") s.cancelled++;
      }
      setStats(
        Array.from(map.values())
          .filter((s) => s.total > 0)
          .sort((a, b) => b.total - a.total),
      );
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <PageHeader title="Team Performance" description="Per-agent metrics and revenue." />
      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : stats.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No agent activity yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Confirmed</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Cancelled</TableHead>
                <TableHead className="text-right">Conf. rate</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((s) => (
                <TableRow key={s.agent_id}>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </TableCell>
                  <TableCell className="text-right">{s.total}</TableCell>
                  <TableCell className="text-right">{s.confirmed}</TableCell>
                  <TableCell className="text-right">{s.delivered}</TableCell>
                  <TableCell className="text-right">{s.cancelled}</TableCell>
                  <TableCell className="text-right">
                    {s.total ? ((s.confirmed / s.total) * 100).toFixed(0) : 0}%
                  </TableCell>
                  <TableCell className="text-right">{s.revenue.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
