import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Eye,
  ImagePlus,
  PackageX,
  AlertTriangle,
  TrendingUp,
  Package as PackageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/layout/SectionHeader";

export const Route = createFileRoute("/_app/products")({
  component: ProductsPage,
});

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  sku_ameex: string | null;
  description: string | null;
  cost_price: number;
  sell_price: number;
  stock: number;
  low_stock_threshold: number | null;
  image_url: string | null;
  is_active: boolean;
  supplier_id: string | null;
  updated_at: string;
}

interface Movement {
  id: string;
  product_id: string;
  type: "purchase" | "sale" | "return" | "adjustment" | "damaged";
  quantity: number;
  unit_cost: number | null;
  note: string | null;
  created_at: string;
}

type StockStatus = "active" | "low" | "out";

function getStatus(stock: number, threshold: number | null): StockStatus {
  if (stock <= 0) return "out";
  if (stock <= (threshold ?? 10)) return "low";
  return "active";
}

function StatusBadge({ status }: { status: StockStatus }) {
  if (status === "out")
    return (
      <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
        Out of stock
      </Badge>
    );
  if (status === "low")
    return (
      <Badge
        variant="outline"
        className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      >
        Low stock
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    >
      Active
    </Badge>
  );
}

function ProductsPage() {
  const { hasAnyRole, user } = useAuth();
  const canManage = hasAnyRole(["admin", "moderator"]);

  const [items, setItems] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StockStatus>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Detail drawer
  const [detail, setDetail] = useState<Product | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    confirmed: 0,
    delivered: 0,
    returned: 0,
  });
  const [adjOpen, setAdjOpen] = useState(false);
  const [adj, setAdj] = useState({ type: "purchase" as Movement["type"], quantity: 1, note: "" });

  const empty: Omit<Product, "id" | "updated_at"> = {
    name: "",
    sku: "",
    sku_ameex: "",
    description: "",
    cost_price: 0,
    sell_price: 0,
    stock: 0,
    low_stock_threshold: 10,
    image_url: "",
    is_active: true,
    supplier_id: null,
  };
  const [form, setForm] = useState<Omit<Product, "id" | "updated_at">>(empty);

  const load = async () => {
    setLoading(true);
    const [{ data: p, error }, { data: sup }] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("suppliers").select("id,name").order("name"),
    ]);
    if (error) toast.error(error.message);
    else setItems(p ?? []);
    setSuppliers(sup ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.sku ?? "").toLowerCase().includes(q))
          return false;
      }
      if (statusFilter !== "all" && getStatus(p.stock, p.low_stock_threshold) !== statusFilter)
        return false;
      if (supplierFilter !== "all" && p.supplier_id !== supplierFilter) return false;
      return true;
    });
  }, [items, search, statusFilter, supplierFilter]);

  const lowCount = items.filter((p) => getStatus(p.stock, p.low_stock_threshold) === "low").length;
  const outCount = items.filter((p) => getStatus(p.stock, p.low_stock_threshold) === "out").length;

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku ?? "",
      sku_ameex: p.sku_ameex ?? "",
      description: p.description ?? "",
      cost_price: Number(p.cost_price),
      sell_price: Number(p.sell_price),
      stock: p.stock,
      low_stock_threshold: p.low_stock_threshold ?? 10,
      image_url: p.image_url ?? "",
      is_active: p.is_active,
      supplier_id: p.supplier_id,
    });
    setOpen(true);
  };

  const handleFile = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Image only");
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user?.id ?? "anon"}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      setUploading(false);
      return toast.error(error.message);
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setForm((f) => ({ ...f, image_url: data.publicUrl }));
    setUploading(false);
    toast.success("Image uploaded");
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) await handleFile(file);
  };

  const save = async () => {
    if (!form.name) return toast.error("Name required");
    setSaving(true);
    const payload = {
      ...form,
      sku: form.sku || null,
      sku_ameex: form.sku_ameex || null,
      description: form.description || null,
      image_url: form.image_url || null,
      supplier_id: form.supplier_id || null,
    };

    if (editing) {
      // Stock is managed via stock_movements (trigger applies the delta).
      // Strip `stock` from the update so we don't overwrite the trigger-managed value.
      const { stock: newStock, ...updatePayload } = payload;
      const { error } = await supabase
        .from("products")
        .update(updatePayload)
        .eq("id", editing.id);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }

      const delta = newStock - editing.stock;
      if (delta !== 0) {
        const { error: smErr } = await supabase.from("stock_movements").insert({
          product_id: editing.id,
          type: "adjustment",
          quantity: delta,
          note: "Manual adjustment from Edit product",
          created_by: user?.id ?? null,
        });
        if (smErr) {
          setSaving(false);
          return toast.error(`Stock adjustment failed: ${smErr.message}`);
        }
      }
      setSaving(false);
      toast.success("Product updated");
      setOpen(false);
      load();
      return;
    }

    // Create flow: insert product (with initial stock as the starting value).
    const { error } = await supabase.from("products").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Product created");
    setOpen(false);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const openDetail = async (p: Product) => {
    setDetail(p);
    setMovements([]);
    setStats({ total: 0, confirmed: 0, delivered: 0, returned: 0 });
    const [{ data: mv }, { data: oi }] = await Promise.all([
      supabase
        .from("stock_movements")
        .select("*")
        .eq("product_id", p.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("order_items")
        .select("order_id, orders(status)")
        .eq("product_id", p.id),
    ]);
    setMovements((mv as Movement[]) ?? []);
    const orders = (oi ?? []) as Array<{ orders: { status: string } | null }>;
    const total = orders.length;
    let confirmed = 0,
      delivered = 0,
      returned = 0;
    orders.forEach((o) => {
      const s = o.orders?.status;
      if (s === "confirmed") confirmed++;
      if (s === "delivered") delivered++;
      if (s === "returned" || s === "refused") returned++;
    });
    setStats({ total, confirmed, delivered, returned });
  };

  const saveAdjustment = async () => {
    if (!detail) return;
    if (!adj.quantity) return toast.error("Quantity required");
    const { error } = await supabase.from("stock_movements").insert({
      product_id: detail.id,
      type: adj.type,
      quantity: adj.quantity,
      note: adj.note || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Stock adjusted");
    setAdjOpen(false);
    setAdj({ type: "purchase", quantity: 1, note: "" });
    // refresh
    const { data: refreshed } = await supabase
      .from("products")
      .select("*")
      .eq("id", detail.id)
      .single();
    if (refreshed) {
      setDetail(refreshed as Product);
      setItems((prev) => prev.map((x) => (x.id === detail.id ? (refreshed as Product) : x)));
      openDetail(refreshed as Product);
    }
  };

  const deliveryRate = stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0;
  const returnRate = stats.total > 0 ? (stats.returned / stats.total) * 100 : 0;
  const profit = detail
    ? stats.delivered * (Number(detail.sell_price) - Number(detail.cost_price))
    : 0;

  const supplierName = (id: string | null) =>
    id ? suppliers.find((s) => s.id === id)?.name ?? "—" : "—";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Products & Stock"
        description="Single source of truth for your catalog, stock levels and product performance."
        actions={
          canManage && (
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Add product
            </Button>
          )
        }
      />

      <SectionHeader
        icon={PackageIcon}
        title="Catalog & Inventory"
        description="Manage your product catalog and live stock levels"
        variant="luxury"
      />

      {/* Alerts */}
      {(outCount > 0 || lowCount > 0) && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          {outCount > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <PackageX className="h-4 w-4 text-destructive" />
              <span className="font-medium text-destructive">
                {outCount} product{outCount > 1 ? "s" : ""} out of stock
              </span>
            </div>
          )}
          {lowCount > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="font-medium text-amber-700 dark:text-amber-400">
                {lowCount} product{lowCount > 1 ? "s" : ""} low on stock
              </span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="low">Low stock</SelectItem>
            <SelectItem value="out">Out of stock</SelectItem>
          </SelectContent>
        </Select>
        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Supplier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No products found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Internal ID</TableHead>
                <TableHead>External SKU</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const status = getStatus(p.stock, p.low_stock_threshold);
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => openDetail(p)}
                  >
                    <TableCell>
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-10 w-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <ImagePlus className="h-4 w-4" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.sku ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          status === "out"
                            ? "font-semibold text-destructive"
                            : status === "low"
                              ? "font-semibold text-amber-600 dark:text-amber-400"
                              : ""
                        }
                      >
                        {p.stock}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {supplierName(p.supplier_id)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(p.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" onClick={() => openDetail(p)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canManage && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => del(p.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-[180px_1fr]">
            {/* Image uploader */}
            <div>
              <Label className="mb-2 block">Image</Label>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className="flex h-[180px] w-[180px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-muted/30 text-center text-xs text-muted-foreground transition-colors hover:bg-muted/60"
              >
                {form.image_url ? (
                  <img
                    src={form.image_url}
                    alt="preview"
                    className="h-full w-full rounded-lg object-cover"
                  />
                ) : uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="h-5 w-5" />
                    <span>Drop or click</span>
                    <span className="text-[10px]">Max 5MB</span>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {form.image_url && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-[180px] text-xs"
                  onClick={() => setForm({ ...form, image_url: "" })}
                >
                  Remove image
                </Button>
              )}
            </div>

            {/* Fields */}
            <div className="grid gap-3">
              <div>
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>External SKU</Label>
                  <Input
                    placeholder="From delivery provider"
                    value={form.sku ?? ""}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Supplier</Label>
                  <Select
                    value={form.supplier_id ?? "none"}
                    onValueChange={(v) =>
                      setForm({ ...form, supplier_id: v === "none" ? null : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Cost</Label>
                  <Input
                    type="number"
                    value={form.cost_price}
                    onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Sell</Label>
                  <Input
                    type="number"
                    value={form.sell_price}
                    onChange={(e) => setForm({ ...form, sell_price: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>{editing ? "Stock (set new total)" : "Initial stock"}</Label>
                  <Input
                    type="number"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                  />
                  {editing && form.stock !== editing.stock ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Adjustment of {form.stock - editing.stock > 0 ? "+" : ""}
                      {form.stock - editing.stock} will be recorded.
                    </p>
                  ) : null}
                </div>
              </div>
              <div>
                <Label>Low stock threshold</Label>
                <Input
                  type="number"
                  value={form.low_stock_threshold ?? 10}
                  onChange={(e) =>
                    setForm({ ...form, low_stock_threshold: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  rows={2}
                  value={form.description ?? ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || uploading}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail drawer */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>{detail.name}</SheetTitle>
              </SheetHeader>

              <div className="mt-4 flex gap-4">
                {detail.image_url ? (
                  <img
                    src={detail.image_url}
                    alt={detail.name}
                    className="h-24 w-24 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-md bg-muted">
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 space-y-1 text-sm">
                  <div className="text-muted-foreground">SKU: {detail.sku ?? "—"}</div>
                  <div className="text-muted-foreground">
                    Supplier: {supplierName(detail.supplier_id)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Stock: {detail.stock}</span>
                    <StatusBadge status={getStatus(detail.stock, detail.low_stock_threshold)} />
                  </div>
                  {canManage && (
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(detail)}>
                        <Pencil className="mr-2 h-3 w-3" /> Edit
                      </Button>
                      <Button size="sm" onClick={() => setAdjOpen(true)}>
                        <Plus className="mr-2 h-3 w-3" /> Adjust stock
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="mt-6">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Performance
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Total orders" value={stats.total} />
                  <Stat label="Confirmed" value={stats.confirmed} />
                  <Stat label="Delivered" value={stats.delivered} />
                  <Stat label="Returned" value={stats.returned} />
                  <Stat label="Delivery rate" value={`${deliveryRate.toFixed(1)}%`} />
                  <Stat label="Return rate" value={`${returnRate.toFixed(1)}%`} />
                </div>
                <div className="mt-2 flex items-center gap-2 rounded-md border bg-muted/30 p-3 text-sm">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span className="text-muted-foreground">Estimated profit:</span>
                  <span className="font-semibold">{profit.toFixed(2)}</span>
                </div>
              </div>

              {/* Movements */}
              <div className="mt-6">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Stock movements
                </div>
                <div className="rounded-lg border bg-card">
                  {movements.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      No movements yet.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead>Note</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movements.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(m.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {m.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{m.quantity}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {m.note ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Stock adjustment dialog */}
      <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Type</Label>
              <Select
                value={adj.type}
                onValueChange={(v) => setAdj({ ...adj, type: v as Movement["type"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Stock in (purchase)</SelectItem>
                  <SelectItem value="return">Stock in (return)</SelectItem>
                  <SelectItem value="adjustment">Manual adjustment (±)</SelectItem>
                  <SelectItem value="damaged">Stock out (damaged)</SelectItem>
                  <SelectItem value="sale">Stock out (sale)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                value={adj.quantity}
                onChange={(e) => setAdj({ ...adj, quantity: Number(e.target.value) })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Use negative for adjustments that decrease stock.
              </p>
            </div>
            <div>
              <Label>Reason / Note</Label>
              <Input value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveAdjustment}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
