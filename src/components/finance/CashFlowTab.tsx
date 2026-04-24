import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Trash2, ArrowDownCircle, ArrowUpCircle, ArrowDownToLine, ArrowUpFromLine, Scale } from "lucide-react";
import { toast } from "sonner";
import { KpiCard } from "@/components/dashboard/KpiCard";

interface Row {
  id: string;
  type: "in" | "out";
  amount: number;
  source: "delivery" | "ads" | "supplier" | "other";
  description: string | null;
  occurred_at: string;
}

export function CashFlowTab() {
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "moderator"]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: "in" as "in" | "out",
    amount: 0,
    source: "delivery" as Row["source"],
    description: "",
    occurred_at: new Date().toISOString().slice(0, 10),
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("cash_flow").select("*").order("occurred_at", { ascending: false }).limit(200);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const cashIn = rows.filter((r) => r.type === "in").reduce((s, r) => s + Number(r.amount), 0);
  const cashOut = rows.filter((r) => r.type === "out").reduce((s, r) => s + Number(r.amount), 0);
  const balance = cashIn - cashOut;

  const save = async () => {
    if (!form.amount) return toast.error("Amount required");
    setSaving(true);
    const { error } = await supabase.from("cash_flow").insert({
      type: form.type,
      amount: form.amount,
      source: form.source,
      description: form.description || null,
      occurred_at: form.occurred_at,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Entry added");
    setOpen(false);
    setForm({ type: "in", amount: 0, source: "delivery", description: "", occurred_at: new Date().toISOString().slice(0, 10) });
    load();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("cash_flow").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Total cash in" value={cashIn.toFixed(2)} icon={ArrowDownToLine} tone="luxury-4" hint="incoming flow" />
        <KpiCard label="Total cash out" value={cashOut.toFixed(2)} icon={ArrowUpFromLine} tone="luxury-2" hint="outgoing flow" />
        <KpiCard label="Balance" value={balance.toFixed(2)} icon={Scale} tone={balance >= 0 ? "luxury-1" : "luxury-2"} hint="net position" />
      </div>

      <div className="flex justify-end">
        {canManage && <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> New entry</Button>}
      </div>

      <div className="rounded-2xl border border-border/70 bg-card shadow-[var(--shadow-sm)]">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No cash movements.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.occurred_at}</TableCell>
                  <TableCell>
                    {r.type === "in" ? (
                      <span className="inline-flex items-center gap-1 text-success font-medium"><ArrowDownCircle className="h-4 w-4" /> In</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-destructive font-medium"><ArrowUpCircle className="h-4 w-4" /> Out</span>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">{r.source}</TableCell>
                  <TableCell className="text-muted-foreground">{r.description ?? "—"}</TableCell>
                  <TableCell className={`text-right font-semibold tabular-nums ${r.type === "in" ? "text-success" : "text-destructive"}`}>{Number(r.amount).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    {canManage && <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New cash flow entry</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "in" | "out" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Cash In</SelectItem>
                    <SelectItem value="out">Cash Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Source</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v as Row["source"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delivery">Delivery</SelectItem>
                    <SelectItem value="ads">Ads</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} />
              </div>
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
