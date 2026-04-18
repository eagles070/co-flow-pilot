import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ORDER_SOURCES, type OrderSource } from "@/lib/order-status";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  stores: { id: string; name: string }[];
  onCreated: () => void;
}

interface ProductOpt {
  id: string;
  name: string;
  sku: string | null;
  sell_price: number;
}

interface LineItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export function NewOrderDialog({ stores, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [items, setItems] = useState<LineItem[]>([]);
  const [pickProduct, setPickProduct] = useState<string>("");

  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    city: "",
    shipping_address: "",
    source: "manual" as OrderSource,
    store_id: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    supabase
      .from("products")
      .select("id, name, sku, sell_price")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setProducts((data ?? []) as ProductOpt[]));
  }, [open]);

  const total = useMemo(
    () => items.reduce((s, i) => s + i.quantity * i.unit_price, 0),
    [items]
  );

  const reset = () => {
    setForm({
      customer_name: "",
      customer_phone: "",
      city: "",
      shipping_address: "",
      source: "manual",
      store_id: "",
      notes: "",
    });
    setItems([]);
    setPickProduct("");
  };

  const addItem = () => {
    if (!pickProduct) return;
    const p = products.find((x) => x.id === pickProduct);
    if (!p) return;
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === p.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        { product_id: p.id, product_name: p.name, quantity: 1, unit_price: Number(p.sell_price) },
      ];
    });
    setPickProduct("");
  };

  const updateItem = (id: string, patch: Partial<LineItem>) =>
    setItems((prev) => prev.map((i) => (i.product_id === id ? { ...i, ...patch } : i)));

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((i) => i.product_id !== id));

  const submit = async () => {
    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      toast.error("Customer name and phone are required");
      return;
    }
    setSaving(true);
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        city: form.city || null,
        shipping_address: form.shipping_address || null,
        total_amount: total,
        source: form.source,
        store_id: form.store_id || null,
        notes: form.notes || null,
      })
      .select("id")
      .single();

    if (error || !order) {
      setSaving(false);
      toast.error(error?.message ?? "Failed to create order");
      return;
    }

    if (items.length > 0) {
      const { error: itemsErr } = await supabase.from("order_items").insert(
        items.map((i) => ({
          order_id: order.id,
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
        }))
      );
      if (itemsErr) {
        toast.error(`Order saved, but items failed: ${itemsErr.message}`);
      }
    }

    setSaving(false);
    toast.success("Order created");
    reset();
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New order
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create new order</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {/* Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Customer name *</Label>
              <Input
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input
                value={form.customer_phone}
                onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
              />
            </div>
          </div>

          {/* Address */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Address</Label>
              <Input
                value={form.shipping_address}
                onChange={(e) => setForm({ ...form, shipping_address: e.target.value })}
                placeholder="Street, building, etc."
              />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
          </div>

          {/* Products */}
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Products</Label>
              <span className="text-sm font-medium">
                Total: {total.toFixed(2)}
              </span>
            </div>

            <div className="flex gap-2">
              <Select value={pickProduct} onValueChange={setPickProduct}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={products.length === 0 ? "No products yet — add some in Products" : "Select a product..."} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ""} — {Number(p.sell_price).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={addItem} disabled={!pickProduct}>
                Add
              </Button>
            </div>

            {items.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                No products added. Order total will be 0.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((i) => (
                  <div key={i.product_id} className="flex items-center gap-2 rounded-md bg-muted/40 p-2">
                    <span className="flex-1 truncate text-sm">{i.product_name}</span>
                    <Input
                      type="number"
                      min={1}
                      value={i.quantity}
                      onChange={(e) =>
                        updateItem(i.product_id, { quantity: Math.max(1, Number(e.target.value) || 1) })
                      }
                      className="h-8 w-16"
                    />
                    <span className="text-xs text-muted-foreground">×</span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={i.unit_price}
                      onChange={(e) =>
                        updateItem(i.product_id, { unit_price: Number(e.target.value) || 0 })
                      }
                      className="h-8 w-24"
                    />
                    <span className="w-20 text-right text-sm font-medium">
                      {(i.quantity * i.unit_price).toFixed(2)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeItem(i.product_id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Source / Store */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select
                value={form.source}
                onValueChange={(v) => setForm({ ...form, source: v as OrderSource })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Store</Label>
              <Select
                value={form.store_id || "none"}
                onValueChange={(v) => setForm({ ...form, store_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving..." : "Create order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
