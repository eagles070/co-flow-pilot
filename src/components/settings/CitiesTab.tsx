import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Download, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

interface Props {
  isAdmin: boolean;
}

interface CityRow {
  id: string;
  name: string;
  delivery_cost: number;
  return_cost: number;
  is_active: boolean;
}

export function CitiesTab({ isAdmin }: Props) {
  const [rows, setRows] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CityRow | null>(null);
  const [form, setForm] = useState({ name: "", delivery_cost: 0, return_cost: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("cities").select("*").order("name");
    setRows((data ?? []) as CityRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", delivery_cost: 0, return_cost: 0 });
    setOpen(true);
  };

  const openEdit = (r: CityRow) => {
    setEditing(r);
    setForm({ name: r.name, delivery_cost: r.delivery_cost, return_cost: r.return_cost });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) return toast.error("City name is required");
    const payload = {
      name: form.name.trim(),
      delivery_cost: Number(form.delivery_cost) || 0,
      return_cost: Number(form.return_cost) || 0,
    };
    const { error } = editing
      ? await supabase.from("cities").update(payload).eq("id", editing.id)
      : await supabase.from("cities").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("City saved");
    setOpen(false);
    load();
  };

  const remove = async (r: CityRow) => {
    const { error } = await supabase.from("cities").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("City deleted");
    load();
  };

  const toggleActive = async (r: CityRow, checked: boolean) => {
    await supabase.from("cities").update({ is_active: checked }).eq("id", r.id);
    load();
  };

  const onImport = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return toast.error("File is empty");
    const headers = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase());

    // Accept both new format (city_name, delivery_price, refused_price)
    // and legacy (name, delivery_cost, return_cost)
    const nameIdx = ["city_name", "name", "city"]
      .map((h) => headers.indexOf(h))
      .find((i) => i >= 0) ?? -1;
    const dIdx = ["delivery_price", "delivery_cost"]
      .map((h) => headers.indexOf(h))
      .find((i) => i >= 0) ?? -1;
    const rIdx = ["refused_price", "return_cost", "return_price"]
      .map((h) => headers.indexOf(h))
      .find((i) => i >= 0) ?? -1;

    if (nameIdx < 0)
      return toast.error("Header missing. Expected: city_name,delivery_price,refused_price");

    const inserts: { name: string; delivery_cost: number; return_cost: number }[] = [];
    for (const line of lines.slice(1)) {
      const cols = line.split(/[,;\t]/).map((c) => c.trim());
      const name = cols[nameIdx];
      if (!name) continue;
      inserts.push({
        name,
        delivery_cost: dIdx >= 0 ? Number(cols[dIdx]) || 0 : 0,
        return_cost: rIdx >= 0 ? Number(cols[rIdx]) || 0 : 0,
      });
    }
    if (!inserts.length) return toast.error("No rows parsed");
    // Deduplicate by name (case-insensitive), keep last occurrence — avoids
    // Postgres "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const dedupMap = new Map<string, { name: string; delivery_cost: number; return_cost: number }>();
    for (const row of inserts) dedupMap.set(row.name.toLowerCase(), row);
    const deduped = Array.from(dedupMap.values());
    const { error } = await supabase.from("cities").upsert(deduped, { onConflict: "name" });
    if (error) return toast.error(error.message);
    toast.success(`Imported ${inserts.length} cities`);
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const downloadTemplate = () => {
    const csv = [
      "city_name,delivery_price,refused_price",
      "Casablanca,25,10",
      "Rabat,30,12",
      "Marrakech,35,15",
      "Tanger,40,18",
      "Fes,35,15",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cities_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filtered = rows.filter((r) =>
    search ? r.name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Cities</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Used for city selection in orders and for internal finance calculations only.
            Not sent to delivery providers.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            CSV format: <code className="rounded bg-muted px-1">city_name,delivery_price,refused_price</code>
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.tsv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
            />
            <Button size="sm" variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" /> Template
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Import CSV
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openNew}>
                  <Plus className="mr-2 h-4 w-4" /> New city
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit city" : "New city"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <div>
                    <Label>City name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Casablanca"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Delivery price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.delivery_cost}
                        onChange={(e) =>
                          setForm({ ...form, delivery_cost: Number(e.target.value) })
                        }
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Used in finance when order = delivered.
                      </p>
                    </div>
                    <div>
                      <Label>Refused price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.return_cost}
                        onChange={(e) =>
                          setForm({ ...form, return_cost: Number(e.target.value) })
                        }
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Used in finance when order = refused / returned.
                      </p>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={submit}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="mb-3">
          <Input
            placeholder="Search cities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {rows.length === 0 ? "No cities yet." : "No cities match your search."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>City name</TableHead>
                <TableHead className="text-right">Delivery price</TableHead>
                <TableHead className="text-right">Refused price</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right">{Number(r.delivery_cost).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{Number(r.return_cost).toFixed(2)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={r.is_active}
                      disabled={!isAdmin}
                      onCheckedChange={(v) => toggleActive(r, v)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {isAdmin && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                          Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete city?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(r)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
