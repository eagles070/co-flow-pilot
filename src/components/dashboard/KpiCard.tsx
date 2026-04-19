import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: string;
  trend?: "up" | "down";
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "warning" | "info" | "destructive";
  hint?: string;
}

export function KpiCard({ label, value, delta, trend, icon: Icon, tone = "default", hint }: KpiCardProps) {
  const toneClass = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
    info: "bg-info/10 text-info",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];

  return (
    <Card className="overflow-hidden border-border/60 transition-shadow hover:shadow-[var(--shadow-md)]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">{label}</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
            {hint && <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{hint}</p>}
            {delta && (
              <div className="mt-1 flex items-center gap-1 text-[11px]">
                {trend === "up" ? (
                  <ArrowUpRight className="h-3 w-3 text-success" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-destructive" />
                )}
                <span className={trend === "up" ? "text-success" : "text-destructive"}>{delta}</span>
              </div>
            )}
          </div>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
