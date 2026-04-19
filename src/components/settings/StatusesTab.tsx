import { useEffect, useState } from "react";
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
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  isAdmin: boolean;
}

interface StatusRow {
  id: string;
  key: string;
  label: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
}

export function StatusesTab({ isAdmin }: Props) {
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StatusRow | null>(null);
  const [form, setForm] = useState({ key: "", label: "", color: "#6b7280" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("status_configs").select("*").order("sort_order");
    setRows((data ?? []) as StatusRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ key: "", label: "", color: "#6b7280" });
    setOpen(true);
  };

  const openEdit = (r: StatusRow) => {
    setEditing(r);
    setForm({ key: r.key, label: r.label, color: r.color });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.label.trim() || !form.key.trim()) return toast.error("Key and label are required");
    if (editing) {
      const { error } = await supabase
        .from("status_configs")
        .update({ label: form.label, color: form.color })
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const maxOrder = Math.max(0, ...rows.map((r) => r.sort_order));
      const { error } = await supabase.from("status_configs").insert({
        key: form.key.toLowerCase().replace(/\s+/g, "_"),
        label: form.label,
        color: form.color,
        sort_order: maxOrder + 1,
      });
      if (error) return toast.error(error.message);
    }
    toast.success("Status saved");
    setOpen(false);
    load();
  };

  const move = async (r: StatusRow, dir: -1 | 1) => {
    const idx = rows.findIndex((x) => x.id === r.id);
    const swap = rows[idx + dir];
    if (!swap) return;
    await supabase.from("status_configs").update({ sort_order: swap.sort_order }).eq("id", r.id);
    await supabase.from("status_configs").update({ sort_order: r.sort_order }).eq("id", swap.id);
    load();
  };

  const toggleActive = async (r: StatusRow, checked: boolean) => {
    await supabase.from("status_configs").update({ is_active: checked }).eq("id", r.id);
    load();
  };

  const remove = async (r: StatusRow) => {
    if (r.is_system) return toast.error("System statuses cannot be deleted");
    const { error } = await supabase.from("status_configs").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Status deleted");
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Order statuses</CardTitle>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" /> New status
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit status" : "New status"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label>Key (machine-readable)</Label>
                  <Input
                    value={form.key}
                    disabled={!!editing}
                    onChange={(e) => setForm({ ...form, key: e.target.value })}
                    placeholder="e.g. waiting_payment"
                  />
                </div>
                <div>
                  <Label>Label</Label>
                  <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
                </div>
                <div>
                  <Label>Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      className="h-9 w-12 rounded border"
                    />
                    <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
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
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" disabled={!isAdmin || i === 0} onClick={() => move(r, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={!isAdmin || i === rows.length - 1}
                        onClick={() => move(r, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: r.color }} />
                      <span className="font-medium">{r.label}</span>
                      {r.is_system && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">SYSTEM</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.key}</TableCell>
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
                        {!r.is_system && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete status?</AlertDialogTitle>
                                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remove(r)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
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
