import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PerfRow {
  name: string;
  primary: number;
  secondary?: number;
  badge?: { text: string; tone: "good" | "bad" | "warn" };
  rateLabel?: string;
}

type Tone = "good" | "bad";

const RANK_STYLES: Record<number, string> = {
  0: "bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-[0_2px_8px_-2px_rgba(245,158,11,0.5)] ring-1 ring-amber-300/50",
  1: "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900 shadow-[0_2px_8px_-2px_rgba(148,163,184,0.5)] ring-1 ring-slate-300/50",
  2: "bg-gradient-to-br from-orange-300 to-orange-500 text-orange-950 shadow-[0_2px_8px_-2px_rgba(249,115,22,0.5)] ring-1 ring-orange-300/50",
};

export function PerformanceList({
  title,
  description,
  rows,
  primaryLabel,
  secondaryLabel,
  empty,
  tone = "good",
}: {
  title: string;
  description?: string;
  rows: PerfRow[];
  primaryLabel: string;
  secondaryLabel?: string;
  empty?: string;
  tone?: Tone;
}) {
  const max = rows.length > 0 ? Math.max(...rows.map((r) => r.primary), 1) : 1;
  const isGood = tone === "good";

  return (
    <Card className="group relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-card/50 transition-all hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)]">
      {/* Decorative gradient accent */}
      <div
        className={cn(
          "absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-[0.07] blur-3xl transition-opacity group-hover:opacity-[0.12]",
          isGood ? "bg-success" : "bg-destructive",
        )}
      />

      <CardHeader className="relative pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg ring-1",
                  isGood
                    ? "bg-success/10 text-success ring-success/20"
                    : "bg-destructive/10 text-destructive ring-destructive/20",
                )}
              >
                {isGood ? <Trophy className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              </span>
              {title}
            </CardTitle>
            {description && (
              <p className="mt-1.5 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {rows.length > 0 && (
            <span className="shrink-0 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Top {rows.length}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative">
        {rows.length === 0 ? (
          <EmptyState message={empty ?? "No data yet"} tone={tone} />
        ) : (
          <div className="space-y-1">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/50 pb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
              <span>Name</span>
              <div className="flex items-center gap-6">
                <span className="w-16 text-right">{primaryLabel}</span>
                {secondaryLabel && <span className="w-16 text-right">{secondaryLabel}</span>}
              </div>
            </div>

            {/* Rows */}
            <div className="space-y-0.5 pt-1">
              {rows.map((r, i) => {
                const pct = Math.max(4, (r.primary / max) * 100);
                return (
                  <div
                    key={r.name + i}
                    className="group/row relative rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    {/* subtle bg progress bar */}
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-lg opacity-[0.06] transition-opacity group-hover/row:opacity-[0.1]",
                        isGood ? "bg-success" : "bg-destructive",
                      )}
                      style={{ width: `${pct}%` }}
                    />

                    <div className="relative flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
                            i < 3
                              ? RANK_STYLES[i]
                              : "bg-muted text-muted-foreground ring-1 ring-border/50",
                          )}
                        >
                          {i + 1}
                        </span>
                        <span className="truncate text-sm font-medium text-foreground">
                          {r.name}
                        </span>
                        {r.badge && (
                          <span
                            className={cn(
                              "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1",
                              r.badge.tone === "good"
                                ? "bg-success/10 text-success ring-success/20"
                                : r.badge.tone === "bad"
                                  ? "bg-destructive/10 text-destructive ring-destructive/20"
                                  : "bg-warning/10 text-warning ring-warning/20",
                            )}
                          >
                            {r.badge.text}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-6 tabular-nums">
                        <span className="w-16 text-right text-sm font-semibold text-foreground">
                          {r.primary.toLocaleString()}
                        </span>
                        {typeof r.secondary === "number" && (
                          <span className="w-16 text-right text-sm text-muted-foreground">
                            {r.secondary.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ message, tone }: { message: string; tone: Tone }) {
  const isGood = tone === "good";
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-2xl ring-1",
          isGood
            ? "bg-success/5 text-success/70 ring-success/15"
            : "bg-muted text-muted-foreground ring-border/50",
        )}
      >
        {isGood ? <Sparkles className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
      </div>
      <p className="max-w-[200px] text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
