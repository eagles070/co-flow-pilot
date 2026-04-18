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
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/logs")({
  component: LogsPage,
});

interface Log {
  id: string;
  user_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string | null;
  created_at: string;
}

function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setLogs(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <PageHeader title="System Logs" description="Audit trail of recent activity (admin)." />
      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No logs yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(l.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>{l.user_email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{l.action}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{l.entity_type}</TableCell>
                  <TableCell className="text-muted-foreground">{l.description ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
