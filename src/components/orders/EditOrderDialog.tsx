import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ORDER_SOURCES, type OrderSource } from "@/lib/order-status";
import { ProductLineEditor, type LineItem, type ProductOpt } from "./ProductLineEditor";

interface Props {
  orderId: string | null;
  stores: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

interface CityOpt {
  id: string;
  name: string;
}

export function EditOrderDialog({ orderId, stores, onClose, onSaved }: Props) {
  const open = !!orderId;
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [cities, setCities] = useState<CityOpt[]>([]);
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
    if (!orderId) return;
    setLoading(true);
    Promise.all([
      supabase.from("orders").select("*").eq("id", orderId).single(),
      supabase.from("order_items").select("*").eq("order_id", orderId),
      supabase.from("products").select("id, name, sku, sell_price").eq("is_active", true).order("name"),
      supabase.from("cities").select("id, name").eq("is_active", true).order("name"),
    ]).then(([orderRes, itemsRes, productsRes, citiesRes]) => {
      if (orderRes.data) {
        const o = orderRes.data;
        setForm({
          customer_name: o.customer_name ?? "",
          customer_phone: o.customer_phone ?? "",
          customer_phone_alt: o.customer_phone_alt ?? "",
          city: o.city ?? "",
          shipping_address: o.shipping_address ?? "",
          source: o.source as OrderSource,
          store_id: o.store_id ?? "",
          notes: o.notes ?? "",
        });
      }
      setItems(((itemsRes.data ?? []) as LineItem[]).map((i) => ({ ...i, unit_price: Number(i.unit_price) })));
      setProducts((productsRes.data ?? []) as ProductOpt[]);
      setCities((citiesRes.data ?? []) as CityOpt[]);
      setLoading(false);
    });
  }, [orderId]);

  const total = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unit_price, 0), [items]);

  const submit = async () => {
    if (!orderId) return;
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

    const { error: orderErr } = await supabase
      .from("orders")
      .update({
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
      .eq("id", orderId);

    if (orderErr) {
      setSaving(false);
      toast.error(orderErr.message);
      return;
    }

    // Replace items: delete all then insert
    await supabase.from("order_items").delete().eq("order_id", orderId);
    const { error: itemsErr } = await supabase.from("order_items").insert(
      items.map((i) => ({
        order_id: orderId,
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
      }))
    );
    if (itemsErr) {
      setSaving(false);
      toast.error(`Order saved, items failed: ${itemsErr.message}`);
      return;
    }

    setSaving(false);
    toast.success("Order updated");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit order</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid gap-4 py-2">
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
                      {form.city && !cities.some((c) => c.name === form.city) && (
                        <SelectItem value={form.city}>{form.city} (legacy)</SelectItem>
                      )}
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
              />
            </div>

            <ProductLineEditor products={products} items={items} onChange={setItems} />

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
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || loading}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
