import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, Search, Package, DollarSign, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/sourcing")({
  component: SourcingPage,
});

type PurchaseStatus = "ordered" | "in_transit" | "received";
type TransportType = "air" | "sea" | "other";

interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
}

interface ProductLite {
  id: string;
  name: string;
  sku: string | null;
}

interface Purchase {
  id: string;
  product_id: string;
  supplier_id: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  amount_paid: number;
  transport_type: TransportType;
  status: PurchaseStatus;
  purchase_date: string;
  notes: string | null;
  created_at: string;
  product?: ProductLite | null;
  supplier?: { id: string; name: string } | null;
}

const statusLabel: Record<PurchaseStatus, string> = {
  ordered: "Ordered",
  in_transit: "In Transit",
  received: "Received",
};
const statusVariant: Record<PurchaseStatus, "secondary" | "outline" | "default"> = {
  ordered: "outline",
  in_transit: "secondary",
  received: "default",
};

function SourcingPage() {
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "moderator"]);

  return (
    <div>
      <PageHeader
        title="Sourcing"
        description="Track product purchases, supplier payments, and incoming stock."
      />
      <Tabs defaultValue="purchases" className="space-y-4">
        <TabsList>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>
        <TabsContent value="purchases">
          <PurchasesTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="suppliers">
          <SuppliersTab canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────── PURCHASES ───────────────

function PurchasesTab({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [suppliers, setSuppliers] = useState<Pick<Supplier, "id" | "name">[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [saving, setSaving] = useState(false);

  // filters
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const emptyForm = {
    product_id: "",
    supplier_id: "",
    quantity: 1,
    unit_cost: 0,
    amount_paid: 0,
    transport_type: "other" as TransportType,
    status: "ordered" as PurchaseStatus,
    purchase_date: new Date().toISOString().slice(0, 10),
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const [pRes, prodRes, supRes] = await Promise.all([
      supabase
        .from("purchases")
        .select("*, product:products(id,name,sku), supplier:suppliers(id,name)")
        .order("purchase_date", { ascending: false }),
      supabase.from("products").select("id,name,sku").order("name"),
      supabase.from("suppliers").select("id,name").eq("is_active", true).order("name"),
    ]);
    if (pRes.error) toast.error(pRes.error.message);
    else setItems((pRes.data ?? []) as Purchase[]);
    setProducts((prodRes.data ?? []) as ProductLite[]);
    setSuppliers((supRes.data ?? []) as Pick<Supplier, "id" | "name">[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const cost = items.reduce((s, i) => s + Number(i.total_cost), 0);
    const paid = items.reduce((s, i) => s + Number(i.amount_paid), 0);
    return { cost, paid, remaining: cost - paid };
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (productFilter !== "all" && p.product_id !== productFilter) return false;
      if (supplierFilter !== "all" && p.supplier_id !== supplierFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${p.product?.name ?? ""} ${p.product?.sku ?? ""} ${p.supplier?.name ?? ""} ${p.notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, productFilter, supplierFilter, statusFilter, search]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (p: Purchase) => {
    setEditing(p);
    setForm({
      product_id: p.product_id,
      supplier_id: p.supplier_id ?? "",
      quantity: p.quantity,
      unit_cost: Number(p.unit_cost),
      amount_paid: Number(p.amount_paid),
      transport_type: p.transport_type,
      status: p.status,
      purchase_date: p.purchase_date,
      notes: p.notes ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.product_id) return toast.error("Select a product");
    if (form.quantity <= 0) return toast.error("Quantity must be > 0");
    setSaving(true);
    const payload = {
      product_id: form.product_id,
      supplier_id: form.supplier_id || null,
      quantity: form.quantity,
      unit_cost: form.unit_cost,
      amount_paid: form.amount_paid,
      transport_type: form.transport_type,
      status: form.status,
      purchase_date: form.purchase_date,
      notes: form.notes || null,
    };
    const { error } = editing
      ? await supabase.from("purchases").update(payload).eq("id", editing.id)
      : await supabase.from("purchases").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Purchase updated" : "Purchase added");
    setOpen(false);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this purchase?")) return;
    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const totalCost = form.quantity * form.unit_cost;
  const remaining = totalCost - form.amount_paid;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Total purchases cost"
          value={totals.cost}
        />
        <SummaryCard
          icon={<Wallet className="h-4 w-4" />}
          label="Total paid"
          value={totals.paid}
        />
        <SummaryCard
          icon={<Package className="h-4 w-4" />}
          label="Total remaining"
          value={totals.remaining}
          highlight
        />
      </div>

      {/* Filters + action */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search product, supplier, notes…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ordered">Ordered</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="received">Received</SelectItem>
          </SelectContent>
        </Select>
        {canManage && (
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Add purchase
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No purchases found.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead>Transport</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const rem = Number(p.total_cost) - Number(p.amount_paid);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.product?.name ?? "—"}</TableCell>
                    <TableCell>{p.supplier?.name ?? "—"}</TableCell>
                    <TableCell className="text-right">{p.quantity}</TableCell>
                    <TableCell className="text-right">{Number(p.unit_cost).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(p.total_cost).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">{Number(p.amount_paid).toFixed(2)}</TableCell>
                    <TableCell
                      className={`text-right ${rem > 0 ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {rem.toFixed(2)}
                    </TableCell>
                    <TableCell className="capitalize">{p.transport_type}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[p.status]}>{statusLabel[p.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.purchase_date}</TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => del(p.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Per-product summary */}
      {productFilter !== "all" && <ProductPurchaseSummary purchases={filtered} />}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit purchase" : "New purchase"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Product *</Label>
                <Select
                  value={form.product_id}
                  onValueChange={(v) => setForm({ ...form, product_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Supplier</Label>
                <Select
                  value={form.supplier_id || "none"}
                  onValueChange={(v) => setForm({ ...form, supplier_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
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
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Cost / unit</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.unit_cost}
                  onChange={(e) => setForm({ ...form, unit_cost: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Total cost</Label>
                <Input value={totalCost.toFixed(2)} readOnly className="bg-muted" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount paid</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.amount_paid}
                  onChange={(e) => setForm({ ...form, amount_paid: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Remaining</Label>
                <Input
                  value={remaining.toFixed(2)}
                  readOnly
                  className={`bg-muted ${remaining > 0 ? "text-destructive" : ""}`}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Transport</Label>
                <Select
                  value={form.transport_type}
                  onValueChange={(v: TransportType) => setForm({ ...form, transport_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="air">Air</SelectItem>
                    <SelectItem value="sea">Sea</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v: PurchaseStatus) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ordered">Ordered</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="received">Received (auto-stock)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${highlight && value > 0 ? "text-destructive" : ""}`}>
          {value.toFixed(2)}
        </div>
      </CardContent>
    </Card>
  );
}

function ProductPurchaseSummary({ purchases }: { purchases: Purchase[] }) {
  const qty = purchases.reduce((s, p) => s + p.quantity, 0);
  const spent = purchases.reduce((s, p) => s + Number(p.total_cost), 0);
  const avg = qty > 0 ? spent / qty : 0;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <SummaryCard icon={<Package className="h-4 w-4" />} label="Total quantity" value={qty} />
      <SummaryCard icon={<DollarSign className="h-4 w-4" />} label="Total spent" value={spent} />
      <SummaryCard icon={<Wallet className="h-4 w-4" />} label="Avg cost / unit" value={avg} />
    </div>
  );
}

// ─────────────── SUPPLIERS ───────────────

function SuppliersTab({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);

  const empty: Omit<Supplier, "id"> = {
    name: "",
    contact_name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    is_active: true,
  };
  const [form, setForm] = useState(empty);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      name: s.name,
      contact_name: s.contact_name ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      address: s.address ?? "",
      notes: s.notes ?? "",
      is_active: s.is_active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name) return toast.error("Name required");
    setSaving(true);
    const payload = {
      ...form,
      contact_name: form.contact_name || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      notes: form.notes || null,
    };
    const { error } = editing
      ? await supabase.from("suppliers").update(payload).eq("id", editing.id)
      : await supabase.from("suppliers").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setOpen(false);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this supplier?")) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> New supplier
          </Button>
        </div>
      )}
      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No suppliers yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.contact_name ?? "—"}</TableCell>
                  <TableCell>{s.phone ?? "—"}</TableCell>
                  <TableCell>{s.email ?? "—"}</TableCell>
                  <TableCell>
                    {s.is_active ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => del(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit supplier" : "New supplier"}</DialogTitle>
          </DialogHeader>
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
                <Label>Contact name</Label>
                <Input
                  value={form.contact_name ?? ""}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={form.phone ?? ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={form.address ?? ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
