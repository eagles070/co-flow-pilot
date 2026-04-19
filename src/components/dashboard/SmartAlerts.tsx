import { AlertTriangle, TrendingDown, PackageX, Package } from "lucide-react";

export interface SmartAlert {
  kind: "danger" | "warn" | "info";
  icon: "trend" | "warn" | "stock" | "product";
  title: string;
  detail?: string;
}

const ICONS = {
  trend: TrendingDown,
  warn: AlertTriangle,
  stock: PackageX,
  product: Package,
};

export function SmartAlerts({ alerts }: { alerts: SmartAlert[] }) {
  if (!alerts.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {alerts.map((a, i) => {
        const Icon = ICONS[a.icon];
        const tone =
          a.kind === "danger"
            ? "border-destructive/40 bg-destructive/5 text-destructive"
            : a.kind === "warn"
              ? "border-warning/40 bg-warning/5 text-warning"
              : "border-info/40 bg-info/5 text-info";
        return (
          <div key={i} className={`flex items-start gap-2.5 rounded-lg border p-3 text-sm ${tone}`}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium">{a.title}</div>
              {a.detail && <div className="mt-0.5 text-xs opacity-80">{a.detail}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
