import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "lucide-react";
import type { DashboardFilters, DateRange } from "@/hooks/use-dashboard-data";

interface Props {
  filters: DashboardFilters;
  onChange: (f: DashboardFilters) => void;
  cities: string[];
  products: { id: string; name: string }[];
  sources: string[];
}

export function DashboardFilterBar({ filters, onChange, cities, products, sources }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card/50 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        Filters
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Range</Label>
        <Select value={filters.range} onValueChange={(v) => onChange({ ...filters, range: v as DateRange })}>
          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last 7 days</SelectItem>
            <SelectItem value="month">Last 30 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Product</Label>
        <Select value={filters.productId ?? "all"} onValueChange={(v) => onChange({ ...filters, productId: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-8 w-44"><SelectValue placeholder="All products" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {products.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">City</Label>
        <Select value={filters.city ?? "all"} onValueChange={(v) => onChange({ ...filters, city: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-8 w-40"><SelectValue placeholder="All cities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cities</SelectItem>
            {cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Source</Label>
        <Select value={filters.source ?? "all"} onValueChange={(v) => onChange({ ...filters, source: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-8 w-36"><SelectValue placeholder="All sources" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {sources.map((s) => (<SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
