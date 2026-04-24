import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/blacklist")({
  component: BlacklistPage,
});

interface Entry {
  id: string;
  phone: string;
  reason: string | null;
  created_at: string;
}

function BlacklistPage() {
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "moderator"]);
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ phone: "", reason: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("blacklist")
      .select("*")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!form.phone) return toast.error("Phone required");
    setSaving(true);
    const { error } = await supabase.from("blacklist").insert({
      phone: form.phone,
      reason: form.reason || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Added to blacklist");
    setOpen(false);
    setForm({ phone: "", reason: "" });
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Remove from blacklist?")) return;
    const { error } = await supabase.from("blacklist").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Blacklist"
        description="Risky phone numbers — orders from these are auto-cancelled."
        actions={
          canManage && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add number
            </Button>
          )
        }
      />

      <SectionHeader
        icon={ShieldAlert}
        title="Risk Protection"
        description={`${items.length} blocked number${items.length === 1 ? "" : "s"} · auto-cancel on incoming orders`}
        variant="destructive"
      />

      <div className="rounded-2xl border border-border/70 bg-card shadow-[var(--shadow-sm)]">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Blacklist is empty.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Added</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono">{e.phone}</TableCell>
                  <TableCell className="text-muted-foreground">{e.reason ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(e.created_at).toLocaleString()}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => del(e.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to blacklist</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Phone *</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Input
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
