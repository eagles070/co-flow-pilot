import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  isAdmin: boolean;
}

interface Row {
  id: string;
  alert_key: string;
  enabled: boolean;
  in_app: boolean;
  email: boolean;
  threshold: number | null;
}

const META: Record<string, { label: string; description: string; thresholdLabel?: string }> = {
  low_stock: {
    label: "Low stock alert",
    description: "Notify when product stock falls below threshold.",
    thresholdLabel: "Stock threshold (units)",
  },
  low_profit: {
    label: "Low profit alert",
    description: "Notify when profit drops below threshold.",
    thresholdLabel: "Profit threshold",
  },
  high_return_rate: {
    label: "High return rate alert",
    description: "Notify when return rate exceeds threshold.",
    thresholdLabel: "Return rate (%)",
  },
  agent_performance: {
    label: "Agent performance alert",
    description: "Notify when an agent confirmation rate drops below threshold.",
    thresholdLabel: "Confirmation rate (%)",
  },
};

export function NotificationsTab({ isAdmin }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("notification_settings").select("*").order("alert_key");
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const update = async (r: Row, patch: Partial<Row>) => {
    const { error } = await supabase.from("notification_settings").update(patch).eq("id", r.id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...patch } : x)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {rows.map((r) => {
        const meta = META[r.alert_key] ?? { label: r.alert_key, description: "" };
        return (
          <Card key={r.id}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-base">{meta.label}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
              </div>
              <Switch
                checked={r.enabled}
                disabled={!isAdmin}
                onCheckedChange={(v) => update(r, { enabled: v })}
              />
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm">In-app notification</span>
                <Switch
                  checked={r.in_app}
                  disabled={!isAdmin || !r.enabled}
                  onCheckedChange={(v) => update(r, { in_app: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm">Email notification</span>
                <Switch
                  checked={r.email}
                  disabled={!isAdmin || !r.enabled}
                  onCheckedChange={(v) => update(r, { email: v })}
                />
              </div>
              {meta.thresholdLabel && (
                <div>
                  <Label>{meta.thresholdLabel}</Label>
                  <Input
                    type="number"
                    value={r.threshold ?? 0}
                    disabled={!isAdmin || !r.enabled}
                    onBlur={(e) => update(r, { threshold: Number(e.target.value) })}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x) => (x.id === r.id ? { ...x, threshold: Number(e.target.value) } : x))
                      )
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
