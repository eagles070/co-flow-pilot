import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  variant?: "primary" | "luxury" | "success" | "info" | "warning" | "destructive";
  actions?: ReactNode;
}

const VARIANT_BG: Record<NonNullable<SectionHeaderProps["variant"]>, string> = {
  primary: "var(--gradient-primary)",
  luxury: "var(--gradient-luxury)",
  success: "linear-gradient(135deg, var(--color-luxury-4), oklch(0.55 0.16 160))",
  info: "linear-gradient(135deg, var(--color-luxury-5), var(--color-info))",
  warning: "linear-gradient(135deg, var(--color-luxury-3), var(--color-warning))",
  destructive: "linear-gradient(135deg, var(--color-luxury-2), var(--color-destructive))",
};

export function SectionHeader({
  title,
  description,
  icon: Icon,
  variant = "primary",
  actions,
}: SectionHeaderProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 text-primary-foreground shadow-[var(--shadow-luxury)]"
      style={{ backgroundImage: VARIANT_BG[variant] }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {description && (
              <p className="text-sm text-primary-foreground/80">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
