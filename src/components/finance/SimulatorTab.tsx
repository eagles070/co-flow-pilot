import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { LayoutDashboard, CheckCircle2 } from "lucide-react";

export function SimulatorTab() {
  // Product
  const [purchasePrice, setPurchasePrice] = useState(150);
  const [sellingPrice, setSellingPrice] = useState(350);

  // Ad cost (CPL)
  const [cplUsd, setCplUsd] = useState(2.5);
  const [exchangeRate, setExchangeRate] = useState(9.3);

  // Conversion
  const [confirmRate, setConfirmRate] = useState(40);
  const [deliveryRate, setDeliveryRate] = useState(70);

  // Other
  const [otherCosts, setOtherCosts] = useState(39);

  const calc = useMemo(() => {
    const cplMad = cplUsd * exchangeRate;
    const finalRate = (confirmRate / 100) * (deliveryRate / 100); // share of leads delivered
    const adCostPerOrder = finalRate > 0 ? cplMad / finalRate : 0;
    const totalCosts = adCostPerOrder + purchasePrice + otherCosts;
    const netProfit = sellingPrice - totalCosts;
    const margin = sellingPrice > 0 ? (netProfit / sellingPrice) * 100 : 0;
    const roi = totalCosts > 0 ? (netProfit / totalCosts) * 100 : 0;
    const grossMargin = sellingPrice - purchasePrice;

    // Break-even CPL: where netProfit = 0 → adCostPerOrder = sellingPrice - purchasePrice - otherCosts
    const maxAdPerOrder = sellingPrice - purchasePrice - otherCosts;
    const maxCplMad = Math.max(0, maxAdPerOrder * finalRate);
    const maxCplUsd = exchangeRate > 0 ? maxCplMad / exchangeRate : 0;
    const safetyMargin = maxCplUsd > 0 ? ((maxCplUsd - cplUsd) / maxCplUsd) * 100 : 0;
    const cplFillPct =
      maxCplUsd > 0 ? Math.min(100, Math.max(0, (cplUsd / maxCplUsd) * 100)) : 100;

    return {
      cplMad,
      finalRate: finalRate * 100,
      adCostPerOrder,
      totalCosts,
      netProfit,
      margin,
      roi,
      grossMargin,
      maxCplUsd,
      maxCplMad,
      safetyMargin,
      cplFillPct,
      isProfitable: netProfit >= 0,
    };
  }, [purchasePrice, sellingPrice, cplUsd, exchangeRate, confirmRate, deliveryRate, otherCosts]);

  return (
    <div className="space-y-5">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-[image:var(--gradient-primary)] p-6 text-primary-foreground shadow-[var(--shadow-luxury)]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Profit Simulator</h2>
            <p className="text-sm text-primary-foreground/80">
              Per-order profit based on your rates and costs
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* LEFT — INPUTS */}
        <div className="space-y-4">
          <SectionCard title="PRODUCT">
            <div className="grid grid-cols-2 gap-3">
              <UnitField label="Purchase Price" value={purchasePrice} onChange={setPurchasePrice} unit="MAD" />
              <UnitField label="Selling Price" value={sellingPrice} onChange={setSellingPrice} unit="MAD" />
            </div>
            <SoftRow
              label="Gross margin (before ads)"
              value={`${calc.grossMargin.toFixed(2)} MAD`}
              tone="luxury-4"
            />
          </SectionCard>

          <SectionCard title="AD COST (CPL)">
            <div className="grid grid-cols-2 gap-3">
              <UnitField label="CPL (USD)" value={cplUsd} onChange={setCplUsd} unit="$" step={0.1} />
              <UnitField label="Exchange Rate" value={exchangeRate} onChange={setExchangeRate} unit="MAD/$" step={0.1} />
            </div>
            <SoftRow label="CPL in MAD" value={`${calc.cplMad.toFixed(2)} MAD`} tone="luxury-1" />
          </SectionCard>

          <SectionCard title="CONVERSION RATES">
            <RateSlider
              label="Confirmation Rate"
              value={confirmRate}
              onChange={setConfirmRate}
              tone="luxury-1"
            />
            <RateSlider
              label="Delivery Rate"
              value={deliveryRate}
              onChange={setDeliveryRate}
              tone="luxury-4"
            />
            <SoftRow
              label="Final delivery rate"
              value={`${calc.finalRate.toFixed(1)}%`}
            />
          </SectionCard>

          <SectionCard title="OTHER COSTS">
            <UnitField
              label={
                <span className="flex items-center gap-2">
                  Per delivered order
                  <span className="text-[10px] font-normal text-muted-foreground">
                    — shipping + packaging + call center
                  </span>
                </span>
              }
              value={otherCosts}
              onChange={setOtherCosts}
              unit="MAD"
              full
            />
          </SectionCard>
        </div>

        {/* RIGHT — RESULTS */}
        <div className="space-y-4">
          {/* Net Profit hero */}
          <div
            className="relative overflow-hidden rounded-2xl p-5 text-white shadow-[var(--shadow-lg)]"
            style={{
              background: calc.isProfitable
                ? "linear-gradient(135deg, var(--color-luxury-4), oklch(0.55 0.16 160))"
                : "linear-gradient(135deg, var(--color-luxury-2), var(--color-destructive))",
            }}
          >
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] opacity-90">
              Net profit per delivered order
            </p>
            <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">
              {calc.netProfit.toFixed(2)} <span className="text-2xl opacity-90">MAD</span>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/15 px-3 py-2.5 backdrop-blur-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-90">Margin</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">{calc.margin.toFixed(1)}%</p>
              </div>
              <div className="rounded-xl bg-white/15 px-3 py-2.5 backdrop-blur-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-90">ROI</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">{calc.roi.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          {/* Calculation breakdown */}
          <SectionCard title="CALCULATION BREAKDOWN">
            <BreakdownRow label="Selling Price" value={`${sellingPrice.toFixed(2)} MAD`} />
            <div className="mt-2">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Costs
              </p>
              <div className="mt-1 space-y-1.5">
                <BreakdownRow
                  label="Ad Cost per Order"
                  value={`${calc.adCostPerOrder.toFixed(2)} MAD`}
                  tone="info"
                  sub={`${calc.cplMad.toFixed(2)} MAD ÷ ${calc.finalRate.toFixed(1)}% = ${calc.adCostPerOrder.toFixed(2)} MAD`}
                />
                <BreakdownRow label="Purchase Price" value={`${purchasePrice.toFixed(2)} MAD`} />
                <BreakdownRow label="Other Costs" value={`${otherCosts.toFixed(2)} MAD`} />
              </div>
            </div>
            <div className="mt-2 border-t pt-2">
              <BreakdownRow
                label="Total Costs"
                value={`${calc.totalCosts.toFixed(2)} MAD`}
                tone="bad"
                bold
              />
            </div>
            <div className="border-t pt-2">
              <BreakdownRow
                label="Net Profit"
                value={`${calc.netProfit.toFixed(2)} MAD`}
                tone={calc.isProfitable ? "good" : "bad"}
                bold
              />
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(0, Math.min(100, Math.abs(calc.margin)))}%`,
                    background: calc.isProfitable
                      ? "var(--color-luxury-4)"
                      : "var(--color-destructive)",
                  }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>0%</span>
                <span className="font-medium" style={{ color: calc.isProfitable ? "var(--color-luxury-4)" : "var(--color-destructive)" }}>
                  {calc.margin.toFixed(1)}% margin
                </span>
                <span>100%</span>
              </div>
            </div>
          </SectionCard>

          {/* Break-even CPL */}
          <SectionCard title="BREAK-EVEN CPL">
            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-xl border p-3"
                style={{
                  background: "color-mix(in oklab, var(--color-luxury-3) 12%, transparent)",
                  borderColor: "color-mix(in oklab, var(--color-luxury-3) 30%, transparent)",
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-luxury-3)" }}>
                  Max CPL (USD)
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: "var(--color-luxury-3)" }}>
                  ${calc.maxCplUsd.toFixed(3)}
                </p>
                <p className="text-[10px] text-muted-foreground">{calc.maxCplMad.toFixed(2)} MAD</p>
              </div>
              <div
                className="rounded-xl border p-3"
                style={{
                  background: "color-mix(in oklab, var(--color-luxury-4) 12%, transparent)",
                  borderColor: "color-mix(in oklab, var(--color-luxury-4) 30%, transparent)",
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-luxury-4)" }}>
                  Safety Margin
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: "var(--color-luxury-4)" }}>
                  {calc.safetyMargin.toFixed(1)}%
                </p>
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                <span>Your CPL: <span className="font-medium" style={{ color: "var(--color-luxury-3)" }}>${cplUsd.toFixed(3)}</span></span>
                <span>Break-even: <span className="font-medium" style={{ color: "var(--color-luxury-2)" }}>${calc.maxCplUsd.toFixed(3)}</span></span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${calc.cplFillPct}%`,
                    background: "linear-gradient(90deg, var(--color-luxury-1), var(--color-primary-glow))",
                  }}
                />
              </div>
            </div>

            <div
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
              style={{
                background: calc.isProfitable
                  ? "color-mix(in oklab, var(--color-luxury-4) 10%, transparent)"
                  : "color-mix(in oklab, var(--color-destructive) 10%, transparent)",
                borderColor: calc.isProfitable
                  ? "color-mix(in oklab, var(--color-luxury-4) 25%, transparent)"
                  : "color-mix(in oklab, var(--color-destructive) 25%, transparent)",
                color: calc.isProfitable ? "var(--color-luxury-4)" : "var(--color-destructive)",
              }}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                {calc.isProfitable
                  ? <>Your CPL (${cplUsd.toFixed(3)}) is <strong>{(calc.maxCplMad - calc.cplMad).toFixed(2)} MAD</strong> below the break-even limit.</>
                  : <>Your CPL exceeds the break-even by <strong>{(calc.cplMad - calc.maxCplMad).toFixed(2)} MAD</strong> — losing money per order.</>}
              </span>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-sm)]">
      <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function UnitField({
  label,
  value,
  onChange,
  unit,
  step = 1,
  full,
}: {
  label: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  unit: string;
  step?: number;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <Label className="text-[11px] font-medium text-foreground/80">{label}</Label>
      <div className="relative mt-1">
        <Input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="pr-12 tabular-nums"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">
          {unit}
        </span>
      </div>
    </div>
  );
}

function SoftRow({ label, value, tone }: { label: string; value: string; tone?: "luxury-1" | "luxury-4" }) {
  const accent = tone === "luxury-4" ? "var(--color-luxury-4)" : tone === "luxury-1" ? "var(--color-luxury-1)" : "var(--color-muted-foreground)";
  return (
    <div
      className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
      style={{
        background: tone ? `color-mix(in oklab, ${accent} 8%, transparent)` : "var(--color-muted)",
        borderColor: tone ? `color-mix(in oklab, ${accent} 20%, transparent)` : "var(--color-border)",
      }}
    >
      <span className="font-medium" style={{ color: tone ? accent : undefined }}>{label}</span>
      <span className="font-semibold tabular-nums" style={{ color: tone ? accent : undefined }}>{value}</span>
    </div>
  );
}

function RateSlider({
  label,
  value,
  onChange,
  tone,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  tone: "luxury-1" | "luxury-4";
}) {
  const color = tone === "luxury-4" ? "var(--color-luxury-4)" : "var(--color-luxury-1)";
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-[11px] font-medium text-foreground/80">{label}</Label>
        <span
          className="rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums"
          style={{
            background: `color-mix(in oklab, ${color} 15%, transparent)`,
            color,
          }}
        >
          {value}%
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={0}
        max={100}
        step={1}
        style={{ ["--primary" as string]: color } as React.CSSProperties}
      />
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  tone,
  bold,
  sub,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "info";
  bold?: boolean;
  sub?: string;
}) {
  const color =
    tone === "good"
      ? "var(--color-luxury-4)"
      : tone === "bad"
      ? "var(--color-destructive)"
      : tone === "info"
      ? "var(--color-info)"
      : undefined;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className={bold ? "font-semibold" : "text-foreground/80"}>{label}</span>
        <span
          className={`tabular-nums ${bold ? "font-semibold" : "font-medium"}`}
          style={{ color }}
        >
          {value}
        </span>
      </div>
      {sub && <p className="text-[10.5px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
