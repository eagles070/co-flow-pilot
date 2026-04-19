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
import { Plus } from "lucide-react";
import { ProductLineEditor, type LineItem, type ProductOpt } from "./ProductLineEditor";

interface Props {
  stores: { id: string; name: string }[];
  onCreated: () => void;
}

interface CityOpt {
  id: string;
  name: string;
}

export function NewOrderDialog({ stores, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [cities, setCities] = useState<CityOpt[]>([]);
  const [customSources, setCustomSources] = useState<string[]>([]);
  const [items, setItems] = useState<LineItem[]>([]);

  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_phone_alt: "",
    city: "",
    shipping_address: "",
    source: "manual" as OrderSource,
    store_id: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    Promise.all([
      supabase.from("products").select("id, name, sku, sell_price").eq("is_active", true).order("name"),
      supabase.from("cities").select("id, name").eq("is_active", true).order("name"),
      supabase.from("order_sources").select("name").eq("is_active", true).order("sort_order"),
    ]).then(([prodRes, cityRes, srcRes]) => {
      setProducts((prodRes.data ?? []) as ProductOpt[]);
      setCities((cityRes.data ?? []) as CityOpt[]);
      setCustomSources(((srcRes.data ?? []) as { name: string }[]).map((s) => s.name));
    });
  }, [open]);

  const total = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unit_price, 0), [items]);

  const reset = () => {
    setForm({
      customer_name: "",
      customer_phone: "",
      customer_phone_alt: "",
      city: "",
      shipping_address: "",
      source: "manual",
      store_id: "",
      notes: "",
    });
    setItems([]);
  };

  const submit = async () => {
    if (!form.customer_name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (!form.customer_phone.trim()) {
      toast.error("Phone is required");
      return;
    }
    if (!form.city.trim()) {
      toast.error("City is required");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one product");
      return;
    }
    setSaving(true);
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        customer_phone_alt: form.customer_phone_alt || null,
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
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create new order</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {/* Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Customer name *</Label>
              <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Alt phone</Label>
              <Input value={form.customer_phone_alt} onChange={(e) => setForm({ ...form, customer_phone_alt: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>City *</Label>
              {cities.length > 0 ? (
                <Select value={form.city} onValueChange={(v) => setForm({ ...form, city: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a city..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Address</Label>
            <Textarea
              rows={2}
              value={form.shipping_address}
              onChange={(e) => setForm({ ...form, shipping_address: e.target.value })}
              placeholder="Street, building, etc."
            />
          </div>

          {/* Products */}
          <ProductLineEditor products={products} items={items} onChange={setItems} />

          {/* Source / Store */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v as OrderSource })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                  {customSources
                    .filter((n) => !ORDER_SOURCES.some((s) => s.label.toLowerCase() === n.toLowerCase()))
                    .map((n) => (
                      <SelectItem key={n} value="manual" disabled>
                        {n} (logged as manual)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Store</Label>
              <Select value={form.store_id || "none"} onValueChange={(v) => setForm({ ...form, store_id: v === "none" ? "" : v })}>
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
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
