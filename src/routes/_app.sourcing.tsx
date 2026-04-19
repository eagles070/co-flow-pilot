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
  DialogDescription,
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
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Package,
  DollarSign,
  Wallet,
  Upload,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/sourcing")({
  component: SourcingPage,
});

type PurchaseStatus = "ordered" | "in_transit" | "received";
type TransportType = "air" | "sea" | "other";

interface Purchase {
  id: string;
  product_name: string | null;
  image_url: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  amount_paid: number;
  transport_type: TransportType;
  status: PurchaseStatus;
  purchase_date: string;
  notes: string | null;
  converted_to_product_id: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<PurchaseStatus, { label: string; className: string }> = {
  ordered: { label: "Ordered", className: "bg-muted text-muted-foreground" },
  in_transit: {
    label: "In Transit",
    className: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  },
  received: {
    label: "Received",
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
};

const TRANSPORT_LABEL: Record<TransportType, string> = {
  air: "Air",
  sea: "Sea",
  other: "Other",
};

interface FormState {
  product_name: string;
  image_url: string;
  quantity: string;
  unit_cost: string;
  amount_paid: string;
  transport_type: TransportType;
  status: PurchaseStatus;
  purchase_date: string;
  notes: string;
}

const emptyForm: FormState = {
  product_name: "",
  image_url: "",
  quantity: "1",
  unit_cost: "0",
  amount_paid: "0",
  transport_type: "other",
  status: "ordered",
  purchase_date: new Date().toISOString().slice(0, 10),
  notes: "",
};

function SourcingPage() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [transportFilter, setTransportFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [convertOpen, setConvertOpen] = useState(false);
  const [convertTarget, setConvertTarget] = useState<Purchase | null>(null);
  const [convertSku, setConvertSku] = useState("");
  const [convertSellPrice, setConvertSellPrice] = useState("0");
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    void loadPurchases();
  }, []);

  async function loadPurchases() {
    setLoading(true);
    const { data, error } = await supabase
      .from("purchases")
      .select("*")
      .order("purchase_date", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setPurchases((data ?? []) as Purchase[]);
    }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return purchases.filter((p) => {
      if (search && !(p.product_name ?? "").toLowerCase().includes(search.toLowerCase()))
        return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (transportFilter !== "all" && p.transport_type !== transportFilter) return false;
      if (dateFilter && p.purchase_date !== dateFilter) return false;
      return true;
    });
  }, [purchases, search, statusFilter, transportFilter, dateFilter]);

  const totals = useMemo(() => {
    const totalCost = filtered.reduce((s, p) => s + Number(p.total_cost ?? 0), 0);
    const totalPaid = filtered.reduce((s, p) => s + Number(p.amount_paid ?? 0), 0);
    return { totalCost, totalPaid, totalRemaining: totalCost - totalPaid };
  }, [filtered]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(p: Purchase) {
    setEditing(p);
    setForm({
      product_name: p.product_name ?? "",
      image_url: p.image_url ?? "",
      quantity: String(p.quantity),
      unit_cost: String(p.unit_cost),
      amount_paid: String(p.amount_paid),
      transport_type: p.transport_type,
      status: p.status,
      purchase_date: p.purchase_date,
      notes: p.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function uploadImage(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    setUploadingImage(true);
    const ext = file.name.split(".").pop();
    const path = `sourcing/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      toast.error(error.message);
      setUploadingImage(false);
      return;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setForm((f) => ({ ...f, image_url: data.publicUrl }));
    setUploadingImage(false);
  }

  async function handleSave() {
    if (!form.product_name.trim()) {
      toast.error("Product name is required");
      return;
    }
    const qty = parseInt(form.quantity, 10);
    if (!qty || qty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    setSaving(true);
    const payload = {
      product_name: form.product_name.trim(),
      image_url: form.image_url || null,
      quantity: qty,
      unit_cost: Number(form.unit_cost) || 0,
      amount_paid: Number(form.amount_paid) || 0,
      transport_type: form.transport_type,
      status: form.status,
      purchase_date: form.purchase_date,
      notes: form.notes || null,
      created_by: user?.id ?? null,
      product_id: null,
    };

    if (editing) {
      const { error } = await supabase.from("purchases").update(payload).eq("id", editing.id);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      toast.success("Purchase updated");
    } else {
      const { data, error } = await supabase
        .from("purchases")
        .insert(payload)
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      toast.success("Purchase added");
      // If created directly as Received and not yet converted, prompt conversion
      if (data && data.status === "received" && !data.converted_to_product_id) {
        promptConvert(data as Purchase);
      }
    }
    setSaving(false);
    setDialogOpen(false);
    void loadPurchases();
  }

  async function handleStatusChange(p: Purchase, newStatus: PurchaseStatus) {
    const { error } = await supabase
      .from("purchases")
      .update({ status: newStatus })
      .eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Status updated");
    if (newStatus === "received" && !p.converted_to_product_id) {
      promptConvert({ ...p, status: newStatus });
    }
    void loadPurchases();
  }

  function promptConvert(p: Purchase) {
    setConvertTarget(p);
    setConvertSku("");
    setConvertSellPrice("0");
    setConvertOpen(true);
  }

  async function handleConvert() {
    if (!convertTarget) return;
    setConverting(true);
    const { data: product, error: prodErr } = await supabase
      .from("products")
      .insert({
        name: convertTarget.product_name ?? "Untitled",
        image_url: convertTarget.image_url,
        sku: convertSku || null,
        cost_price: Number(convertTarget.unit_cost) || 0,
        sell_price: Number(convertSellPrice) || 0,
        stock: convertTarget.quantity,
      })
      .select()
      .single();
    if (prodErr) {
      toast.error(prodErr.message);
      setConverting(false);
      return;
    }
    // record stock_in movement
    await supabase.from("stock_movements").insert({
      product_id: product.id,
      type: "purchase",
      quantity: convertTarget.quantity,
      unit_cost: convertTarget.unit_cost,
      reference: `SRC-${convertTarget.id.slice(0, 8)}`,
      note: "Converted from sourcing",
      created_by: user?.id ?? null,
    });
    await supabase
      .from("purchases")
      .update({ converted_to_product_id: product.id, product_id: product.id, stock_applied: true })
      .eq("id", convertTarget.id);

    toast.success("Product created in Products & Stock");
    setConverting(false);
    setConvertOpen(false);
    setConvertTarget(null);
    void loadPurchases();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this purchase?")) return;
    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Purchase deleted");
    void loadPurchases();
  }

  const formTotal = (Number(form.quantity) || 0) * (Number(form.unit_cost) || 0);
  const formRemaining = formTotal - (Number(form.amount_paid) || 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sourcing"
        description="Track product purchases, payments, and shipments before stock arrives"
        actions={
          <Button onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" /> Add Purchase
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<Package className="h-4 w-4" />}
          label="Total Purchases Value"
          value={totals.totalCost}
        />
        <SummaryCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Total Paid"
          value={totals.totalPaid}
        />
        <SummaryCard
          icon={<Wallet className="h-4 w-4" />}
          label="Total Remaining"
          value={totals.totalRemaining}
          tone={totals.totalRemaining > 0 ? "warning" : "default"}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by product name…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="ordered">Ordered</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="received">Received</SelectItem>
              </SelectContent>
            </Select>
            <Select value={transportFilter} onValueChange={setTransportFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Transport" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All transport</SelectItem>
                <SelectItem value="air">Air</SelectItem>
                <SelectItem value="sea">Sea</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="w-[160px]"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
            {(statusFilter !== "all" || transportFilter !== "all" || dateFilter || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setTransportFilter("all");
                  setDateFilter("");
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No purchases yet. Click "Add Purchase" to track your first order.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead>Transport</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const remaining = Number(p.total_cost) - Number(p.amount_paid);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt={p.product_name ?? ""}
                              className="h-10 w-10 rounded object-cover border"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {p.product_name ?? "—"}
                          {p.converted_to_product_id && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">
                              In stock
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{p.quantity}</TableCell>
                        <TableCell className="text-right">
                          {Number(p.unit_cost).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {Number(p.total_cost).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(p.amount_paid).toFixed(2)}
                        </TableCell>
                        <TableCell
                          className={`text-right ${remaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}
                        >
                          {remaining.toFixed(2)}
                        </TableCell>
                        <TableCell>{TRANSPORT_LABEL[p.transport_type]}</TableCell>
                        <TableCell>
                          <Select
                            value={p.status}
                            onValueChange={(v) =>
                              handleStatusChange(p, v as PurchaseStatus)
                            }
                          >
                            <SelectTrigger className="h-7 w-[130px]">
                              <Badge
                                variant="secondary"
                                className={STATUS_BADGE[p.status].className}
                              >
                                {STATUS_BADGE[p.status].label}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ordered">Ordered</SelectItem>
                              <SelectItem value="in_transit">In Transit</SelectItem>
                              <SelectItem value="received">Received</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{p.purchase_date}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(p.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Purchase" : "Add Purchase"}</DialogTitle>
            <DialogDescription>
              Track a purchase before the products arrive in stock.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Product Name *</Label>
                <Input
                  value={form.product_name}
                  onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
                  placeholder="e.g. Wireless Earbuds Pro"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Product Image</Label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) void uploadImage(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-md p-4 cursor-pointer hover:border-primary/50 transition-colors flex items-center gap-3"
                >
                  {form.image_url ? (
                    <img
                      src={form.image_url}
                      alt=""
                      className="h-16 w-16 rounded object-cover border"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded bg-muted flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 text-sm text-muted-foreground">
                    {uploadingImage ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                      </span>
                    ) : (
                      <>
                        <div className="flex items-center gap-1 text-foreground">
                          <Upload className="h-4 w-4" /> Drop image here or click to upload
                        </div>
                        <div className="text-xs">PNG, JPG, WEBP up to ~5MB</div>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadImage(file);
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Cost per Unit</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.unit_cost}
                  onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Total Cost (auto)</Label>
                <Input value={formTotal.toFixed(2)} disabled />
              </div>
              <div className="space-y-2">
                <Label>Amount Paid</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount_paid}
                  onChange={(e) => setForm((f) => ({ ...f, amount_paid: e.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Remaining Balance (auto)</Label>
                <Input
                  value={formRemaining.toFixed(2)}
                  disabled
                  className={
                    formRemaining > 0 ? "text-amber-600 dark:text-amber-400" : ""
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Transport Type</Label>
                <Select
                  value={form.transport_type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, transport_type: v as TransportType }))
                  }
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
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v as PurchaseStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ordered">Ordered</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || uploadingImage}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save Changes" : "Add Purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to product dialog */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to Product?</DialogTitle>
            <DialogDescription>
              Add "{convertTarget?.product_name}" to Products & Stock with{" "}
              {convertTarget?.quantity} units as initial stock.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>SKU (optional)</Label>
              <Input
                value={convertSku}
                onChange={(e) => setConvertSku(e.target.value)}
                placeholder="e.g. EARB-PRO-001"
              />
            </div>
            <div className="space-y-2">
              <Label>Sell Price</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={convertSellPrice}
                onChange={(e) => setConvertSellPrice(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConvertOpen(false)}
              disabled={converting}
            >
              No, keep in sourcing
            </Button>
            <Button onClick={handleConvert} disabled={converting}>
              {converting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, create product
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
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "default" | "warning";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-semibold ${tone === "warning" && value > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}
        >
          {value.toFixed(2)}
        </div>
      </CardContent>
    </Card>
  );
}
