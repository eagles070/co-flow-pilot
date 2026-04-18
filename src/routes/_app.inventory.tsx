import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inventory")({
  component: InventoryPage,
});

interface Movement {
  id: string;
  product_id: string;
  type: "purchase" | "sale" | "return" | "adjustment" | "damaged";
  quantity: number;
  unit_cost: number | null;
  reference: string | null;
  note: string | null;
  created_at: string;
  products?: { name: string } | null;
}

function InventoryPage() {
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "moderator"]);
  const [movs, setMovs] = useState<Movement[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; stock: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_id: "",
    type: "purchase" as Movement["type"],
    quantity: 1,
    unit_cost: 0,
    note: "",
  });

  const load = async () => {
    setLoading(true);
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase
        .from("stock_movements")
        .select("*, products(name)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("products").select("id,name,stock").order("name"),
    ]);
    setMovs((m as Movement[]) ?? []);
    setProducts(p ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!form.product_id) return toast.error("Pick a product");
    setSaving(true);
    const { error } = await supabase.from("stock_movements").insert({
      product_id: form.product_id,
      type: form.type,
      quantity: form.quantity,
      unit_cost: form.unit_cost,
      note: form.note || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Movement recorded");
    setOpen(false);
    setForm({ product_id: "", type: "purchase", quantity: 1, unit_cost: 0, note: "" });
    load();
  };

  const lowStock = products.filter((p) => p.stock <= 10);

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Stock movements and live product stock."
        actions={
          canManage && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New movement
            </Button>
          )
        }
      />

      {lowStock.length > 0 && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <div className="font-medium text-destructive">⚠ Low stock alert</div>
          <div className="mt-1 text-muted-foreground">
            {lowStock.map((p) => `${p.name} (${p.stock})`).join(" · ")}
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : movs.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No movements yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movs.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-muted-foreground">
                    {new Date(m.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>{m.products?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{m.type}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{m.quantity}</TableCell>
                  <TableCell className="text-right">
                    {m.unit_cost ? Number(m.unit_cost).toFixed(2) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.note ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New stock movement</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Product</Label>
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
                      {p.name} (stock: {p.stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as Movement["type"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchase">Purchase (+)</SelectItem>
                    <SelectItem value="return">Return (+)</SelectItem>
                    <SelectItem value="sale">Sale (-)</SelectItem>
                    <SelectItem value="damaged">Damaged (-)</SelectItem>
                    <SelectItem value="adjustment">Adjustment (±)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label>Unit cost</Label>
              <Input
                type="number"
                value={form.unit_cost}
                onChange={(e) => setForm({ ...form, unit_cost: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Note</Label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
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
