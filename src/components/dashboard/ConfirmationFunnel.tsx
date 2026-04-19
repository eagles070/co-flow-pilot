import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FunnelStage {
  label: string;
  value: number;
  tone: "primary" | "info" | "success";
}

export function ConfirmationFunnel({ total, confirmed, delivered }: { total: number; confirmed: number; delivered: number }) {
  const stages: FunnelStage[] = [
    { label: "Total orders", value: total, tone: "primary" },
    { label: "Confirmed", value: confirmed, tone: "info" },
    { label: "Delivered", value: delivered, tone: "success" },
  ];
  const max = Math.max(total, 1);
  const confRate = total > 0 ? (confirmed / total) * 100 : 0;
  const delivRate = confirmed > 0 ? (delivered / confirmed) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Confirmation funnel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {stages.map((s, i) => {
          const pct = (s.value / max) * 100;
          const bg =
            s.tone === "primary" ? "bg-primary" : s.tone === "info" ? "bg-info" : "bg-success";
          return (
            <div key={s.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium">{s.label}</span>
                <span className="tabular-nums text-muted-foreground">{s.value.toLocaleString()}</span>
              </div>
              <div className="h-7 overflow-hidden rounded-md bg-muted">
                <div
                  className={`h-full ${bg} transition-all`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
              {i === 0 && total > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">Confirmation rate: <span className="font-medium text-foreground">{confRate.toFixed(1)}%</span></p>
              )}
              {i === 1 && confirmed > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">Delivery rate: <span className="font-medium text-foreground">{delivRate.toFixed(1)}%</span></p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
