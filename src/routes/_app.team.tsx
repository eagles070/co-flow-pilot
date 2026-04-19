import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Pencil, Trash2, ShieldAlert, UserCheck } from "lucide-react";
import { toast } from "sonner";
import {
  adminCreateUser, adminUpdateUser, adminDeleteUser,
} from "@/utils/team.functions";

export const Route = createFileRoute("/_app/team")({
  component: TeamPage,
});

type TabRole = "moderator" | "agent" | "media_buyer";

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  max_orders_per_day: number | null;
  max_concurrent_orders: number | null;
  role: AppRole | null;
}

const TAB_LABELS: Record<TabRole, string> = {
  moderator: "Moderators",
  agent: "Agents",
  media_buyer: "Media Buyers",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

function TeamPage() {
  const { hasRole, user: me } = useAuth();
  const isAdmin = hasRole("admin");

  const [tab, setTab] = useState<TabRole>("agent");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles, error }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,email,full_name,phone,is_active,last_login_at,created_at,max_orders_per_day,max_concurrent_orders")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const roleMap = new Map<string, AppRole>();
    (roles ?? []).forEach((r) => roleMap.set(r.user_id, r.role as AppRole));
    setRows(
      (profiles ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? null })),
    );
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin]);

  const filtered = useMemo(() => rows.filter((r) => r.role === tab), [rows, tab]);

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Team Management" />
        <Card>
          <CardContent className="flex items-center gap-3 py-12">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <p className="text-sm">Admins only.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Team Management"
        description="Create users, assign roles, and manage team access."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <UserCheck className="h-3 w-3" />
              {rows.length} member{rows.length === 1 ? "" : "s"}
            </Badge>
            <Button onClick={() => setOpenCreate(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add User
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabRole)}>
        <TabsList>
          {(Object.keys(TAB_LABELS) as TabRole[]).map((r) => (
            <TabsTrigger key={r} value={r}>
              {TAB_LABELS[r]} ({rows.filter((x) => x.role === r).length})
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(TAB_LABELS) as TabRole[]).map((r) => (
          <TabsContent key={r} value={r} className="mt-4">
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Login</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((u) => {
                        const isMe = u.id === me?.id;
                        return (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">
                              {u.full_name ?? "—"}
                              {isMe && (
                                <Badge variant="outline" className="ml-2 text-[10px]">you</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{u.email}</TableCell>
                            <TableCell className="text-muted-foreground">{u.phone ?? "—"}</TableCell>
                            <TableCell>
                              {u.is_active ? (
                                <Badge variant="outline" className="bg-success/15 text-success border-success/20">
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-muted text-muted-foreground">
                                  Inactive
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {fmtDate(u.last_login_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditing(u)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  disabled={isMe}
                                  onClick={() => setDeleting(u)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                            No {TAB_LABELS[r].toLowerCase()} yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <p className="mt-3 text-xs text-muted-foreground">
        You can't change or delete your own account to avoid lockout.
      </p>

      <CreateUserDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        defaultRole={tab}
        onCreated={load}
      />

      {editing && (
        <EditUserDialog
          user={editing}
          isMe={editing.id === me?.id}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}

      {deleting && (
        <AlertDialog open onOpenChange={(o) => !o && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this user?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes <strong>{deleting.full_name ?? deleting.email}</strong> and revokes access.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  try {
                    await adminDeleteUser({ data: { user_id: deleting.id } });
                    toast.success("User deleted");
                    setDeleting(null);
                    load();
                  } catch (e: any) {
                    toast.error(e?.message ?? "Failed");
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

/* ---------- Create dialog ---------- */
function CreateUserDialog({
  open, onClose, defaultRole, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  defaultRole: TabRole;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    role: defaultRole as AppRole,
    max_orders_per_day: 100,
    max_concurrent_orders: 20,
  });

  useEffect(() => {
    if (open) {
      setForm({
        email: "", password: "", full_name: "", phone: "",
        role: defaultRole, max_orders_per_day: 100, max_concurrent_orders: 20,
      });
    }
  }, [open, defaultRole]);

  const submit = async () => {
    if (!form.email || !form.password || !form.full_name) {
      toast.error("Email, password and name are required");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      await adminCreateUser({
        data: {
          email: form.email.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || undefined,
          role: form.role as "admin" | "moderator" | "agent" | "media_buyer",
          max_orders_per_day: form.role === "agent" ? form.max_orders_per_day : undefined,
          max_concurrent_orders: form.role === "agent" ? form.max_concurrent_orders : undefined,
        },
      });
      toast.success("User created");
      onClose();
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name">
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Password (min 8 chars)">
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Role">
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="media_buyer">Media Buyer</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {form.role === "agent" && (
            <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3">
              <Field label="Max orders / day">
                <Input
                  type="number"
                  value={form.max_orders_per_day}
                  onChange={(e) => setForm({ ...form, max_orders_per_day: Number(e.target.value) })}
                />
              </Field>
              <Field label="Max concurrent orders">
                <Input
                  type="number"
                  value={form.max_concurrent_orders}
                  onChange={(e) => setForm({ ...form, max_concurrent_orders: Number(e.target.value) })}
                />
              </Field>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Edit dialog ---------- */
function EditUserDialog({
  user, isMe, onClose, onSaved,
}: {
  user: UserRow;
  isMe: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: user.full_name ?? "",
    phone: user.phone ?? "",
    is_active: user.is_active,
    role: (user.role ?? "agent") as AppRole,
    max_orders_per_day: user.max_orders_per_day ?? 100,
    max_concurrent_orders: user.max_concurrent_orders ?? 20,
  });

  const submit = async () => {
    setSaving(true);
    try {
      await adminUpdateUser({
        data: {
          user_id: user.id,
          full_name: form.full_name,
          phone: form.phone || null,
          is_active: form.is_active,
          role: isMe ? undefined : form.role as "admin" | "moderator" | "agent" | "media_buyer",
          max_orders_per_day: form.role === "agent" ? form.max_orders_per_day : undefined,
          max_concurrent_orders: form.role === "agent" ? form.max_concurrent_orders : undefined,
        },
      });
      toast.success("User updated");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {user.full_name ?? user.email}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name">
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Email (read-only)">
            <Input value={user.email ?? ""} disabled />
          </Field>
          <Field label="Role">
            <Select
              value={form.role}
              onValueChange={(v) => setForm({ ...form, role: v as AppRole })}
              disabled={isMe}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="media_buyer">Media Buyer</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Active</Label>
              <p className="text-xs text-muted-foreground">Inactive users cannot sign in.</p>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(c) => setForm({ ...form, is_active: c })}
              disabled={isMe}
            />
          </div>
          {form.role === "agent" && (
            <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3">
              <Field label="Max orders / day">
                <Input
                  type="number"
                  value={form.max_orders_per_day}
                  onChange={(e) => setForm({ ...form, max_orders_per_day: Number(e.target.value) })}
                />
              </Field>
              <Field label="Max concurrent orders">
                <Input
                  type="number"
                  value={form.max_concurrent_orders}
                  onChange={(e) => setForm({ ...form, max_concurrent_orders: Number(e.target.value) })}
                />
              </Field>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
