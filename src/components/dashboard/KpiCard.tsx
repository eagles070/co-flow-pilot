import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: string;
  trend?: "up" | "down";
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "warning" | "info" | "destructive" | "luxury-1" | "luxury-2" | "luxury-3" | "luxury-4" | "luxury-5";
  hint?: string;
}

const TONE_VARS: Record<NonNullable<KpiCardProps["tone"]>, { solid: string; gradient: string }> = {
  "default":     { solid: "var(--color-primary)",   gradient: "linear-gradient(90deg, var(--color-luxury-1), var(--color-luxury-5))" },
  "success":     { solid: "var(--color-success)",   gradient: "linear-gradient(90deg, var(--color-luxury-4), var(--color-success))" },
  "warning":     { solid: "var(--color-warning)",   gradient: "linear-gradient(90deg, var(--color-luxury-3), var(--color-warning))" },
  "info":        { solid: "var(--color-info)",      gradient: "linear-gradient(90deg, var(--color-luxury-5), var(--color-info))" },
  "destructive": { solid: "var(--color-destructive)", gradient: "linear-gradient(90deg, var(--color-luxury-2), var(--color-destructive))" },
  "luxury-1":    { solid: "var(--color-luxury-1)",  gradient: "linear-gradient(90deg, var(--color-luxury-1), var(--color-primary-glow))" },
  "luxury-2":    { solid: "var(--color-luxury-2)",  gradient: "linear-gradient(90deg, var(--color-luxury-2), var(--color-luxury-3))" },
  "luxury-3":    { solid: "var(--color-luxury-3)",  gradient: "linear-gradient(90deg, var(--color-luxury-3), var(--color-luxury-2))" },
  "luxury-4":    { solid: "var(--color-luxury-4)",  gradient: "linear-gradient(90deg, var(--color-luxury-4), var(--color-luxury-5))" },
  "luxury-5":    { solid: "var(--color-luxury-5)",  gradient: "linear-gradient(90deg, var(--color-luxury-5), var(--color-luxury-1))" },
};

export function KpiCard({ label, value, delta, trend, icon: Icon, tone = "default", hint }: KpiCardProps) {
  const vars = TONE_VARS[tone];
  return (
    <div
      className="kpi-luxury p-5"
      style={{
        ["--kpi-accent" as string]: vars.gradient,
        ["--kpi-accent-solid" as string]: vars.solid,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground truncate">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums leading-none">
            {value}
          </p>
          {hint && (
            <p className="mt-2 flex items-center gap-1 text-[11px] font-medium" style={{ color: vars.solid }}>
              <ArrowUpRight className="h-3 w-3" />
              <span className="truncate">{hint}</span>
            </p>
          )}
          {delta && (
            <div className="mt-2 flex items-center gap-1 text-[11px] font-medium">
              {trend === "up" ? (
                <ArrowUpRight className="h-3 w-3 text-success" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-destructive" />
              )}
              <span className={trend === "up" ? "text-success" : "text-destructive"}>{delta}</span>
            </div>
          )}
        </div>
        <div className="kpi-bubble flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
    </div>
  );
}
