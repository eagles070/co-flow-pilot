import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Activity } from "lucide-react";

export interface FeedOrder {
  id: string;
  reference: string;
  customer_name: string;
  city: string | null;
  total_amount: number;
  status: string;
  source: string;
  created_at: string;
}

export interface FeedActivity {
  id: string;
  action: string;
  entity_type: string;
  description: string | null;
  user_email: string | null;
  created_at: string;
}

export function LiveFeed({ orders, activity }: { orders: FeedOrder[]; activity: FeedActivity[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Incoming orders</CardTitle>
            <p className="text-xs text-muted-foreground">Live feed of latest orders</p>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live
          </Badge>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No recent orders</p>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 rounded-md border bg-card/50 p-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{o.reference}</span>
                      <span className="truncate font-medium">{o.customer_name}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{o.city ?? "—"}</span>
                      <span>•</span>
                      <span className="capitalize">{o.source.replace("_", " ")}</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(o.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">{Number(o.total_amount).toFixed(2)}</div>
                    <Badge variant="outline" className="mt-0.5 text-[10px] capitalize">
                      {o.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            Recent activity
          </CardTitle>
          <p className="text-xs text-muted-foreground">Last actions across the system</p>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No recent activity</p>
          ) : (
            <div className="space-y-2.5">
              {activity.map((a) => (
                <div key={a.id} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="capitalize font-medium">{a.action.replace("_", " ")}</span>
                      <span className="text-xs text-muted-foreground">{a.entity_type}</span>
                    </div>
                    {a.description && <p className="text-xs text-muted-foreground line-clamp-1">{a.description}</p>}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {a.user_email ?? "system"} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
