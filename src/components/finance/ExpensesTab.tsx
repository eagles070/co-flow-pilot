import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["ads", "salaries", "rent", "shipping", "inventory", "tools", "other"] as const;

interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  expense_date: string;
  product_id: string | null;
}
interface Product { id: string; name: string }

export function ExpensesTab() {
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "moderator"]);
  const [rows, setRows] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [form, setForm] = useState({
    category: "ads" as (typeof CATEGORIES)[number],
    amount: 0,
    product_id: "" as string,
    description: "",
    expense_date: new Date().toISOString().slice(0, 10),
  });

  const load = async () => {
    setLoading(true);
    const [{ data: ex }, { data: pr }] = await Promise.all([
      supabase.from("expenses").select("*").order("expense_date", { ascending: false }).limit(200),
      supabase.from("products").select("id,name").order("name"),
    ]);
    setRows(ex ?? []);
    setProducts(pr ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => filterCat === "all" || r.category === filterCat);

  const save = async () => {
    if (!form.amount) return toast.error("Amount required");
    setSaving(true);
    const { error } = await supabase.from("expenses").insert({
      category: form.category,
      amount: form.amount,
      product_id: form.product_id || null,
      description: form.description || null,
      expense_date: form.expense_date,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Expense added");
    setOpen(false);
    setForm({ category: "ads", amount: 0, product_id: "", description: "", expense_date: new Date().toISOString().slice(0, 10) });
    load();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const productName = (id: string | null) => products.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Label className="text-xs">Category</Label>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {canManage && (
          <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add expense</Button>
        )}
      </div>

      <div className="rounded-2xl border border-border/70 bg-card shadow-[var(--shadow-sm)]">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No expenses.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.expense_date}</TableCell>
                  <TableCell className="capitalize font-medium">{e.category}</TableCell>
                  <TableCell className="text-muted-foreground">{productName(e.product_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{e.description ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{Number(e.amount).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <Button variant="ghost" size="icon" onClick={() => del(e.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New expense</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as (typeof CATEGORIES)[number] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Product (optional)</Label>
              <Select value={form.product_id || "none"} onValueChange={(v) => setForm({ ...form, product_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
