import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface PerfRow {
  name: string;
  primary: number;
  secondary?: number;
  badge?: { text: string; tone: "good" | "bad" | "warn" };
  rateLabel?: string;
}

export function PerformanceList({
  title,
  description,
  rows,
  primaryLabel,
  secondaryLabel,
  empty,
}: {
  title: string;
  description?: string;
  rows: PerfRow[];
  primaryLabel: string;
  secondaryLabel?: string;
  empty?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{empty ?? "No data yet"}</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b pb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span>Name</span>
              <div className="flex items-center gap-4">
                <span className="w-16 text-right">{primaryLabel}</span>
                {secondaryLabel && <span className="w-16 text-right">{secondaryLabel}</span>}
              </div>
            </div>
            {rows.map((r, i) => (
              <div key={r.name + i} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="truncate font-medium">{r.name}</span>
                  {r.badge && (
                    <Badge
                      variant="outline"
                      className={
                        r.badge.tone === "good"
                          ? "border-success/40 text-success"
                          : r.badge.tone === "bad"
                            ? "border-destructive/40 text-destructive"
                            : "border-warning/40 text-warning"
                      }
                    >
                      {r.badge.text}
                    </Badge>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-4 tabular-nums">
                  <span className="w-16 text-right font-medium">{r.primary.toLocaleString()}</span>
                  {typeof r.secondary === "number" && (
                    <span className="w-16 text-right text-muted-foreground">{r.secondary.toLocaleString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
