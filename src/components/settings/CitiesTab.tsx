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
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
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
    if (!form.name.trim()) return toast.error("Name is required");
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
    // Simple CSV/Excel-like parsing: first line headers (name,delivery_cost,return_cost)
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return toast.error("File is empty");
    const headers = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase());
    const nameIdx = headers.indexOf("name");
    const dIdx = headers.indexOf("delivery_cost");
    const rIdx = headers.indexOf("return_cost");
    if (nameIdx < 0) return toast.error("Header 'name' missing");
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
    const { error } = await supabase.from("cities").upsert(inserts, { onConflict: "name" });
    if (error) return toast.error(error.message);
    toast.success(`Imported ${inserts.length} cities`);
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Cities</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Internal delivery / return cost estimates (not linked to provider APIs).
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
                    <Label>Name</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Delivery cost</Label>
                      <Input
                        type="number"
                        value={form.delivery_cost}
                        onChange={(e) => setForm({ ...form, delivery_cost: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Return cost</Label>
                      <Input
                        type="number"
                        value={form.return_cost}
                        onChange={(e) => setForm({ ...form, return_cost: Number(e.target.value) })}
                      />
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
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No cities yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Delivery cost</TableHead>
                <TableHead className="text-right">Return cost</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right">{Number(r.delivery_cost).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{Number(r.return_cost).toFixed(2)}</TableCell>
                  <TableCell>
                    <Switch checked={r.is_active} disabled={!isAdmin} onCheckedChange={(v) => toggleActive(r, v)} />
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
                              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(r)}>Delete</AlertDialogAction>
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
