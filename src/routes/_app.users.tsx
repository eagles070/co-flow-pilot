import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth, type AppRole } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, ShieldAlert, UserCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/users")({
  component: UsersPage,
});

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  roles: AppRole[];
}

const ROLE_OPTIONS: AppRole[] = ["admin", "moderator", "agent", "media_buyer"];

function roleBadgeClass(r: AppRole) {
  return {
    admin: "bg-destructive/15 text-destructive border-destructive/20",
    moderator: "bg-info/15 text-info border-info/20",
    agent: "bg-success/15 text-success border-success/20",
    media_buyer: "bg-warning/15 text-warning border-warning/20",
  }[r];
}

function UsersPage() {
  const { hasRole, user: me } = useAuth();
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = hasRole("admin");

  const load = async () => {
    setLoading(true);
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const map = new Map<string, AppRole[]>();
    (roles ?? []).forEach((r) => {
      const arr = map.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      map.set(r.user_id, arr);
    });
    setRows(
      (profiles ?? []).map((p) => ({
        ...p,
        roles: map.get(p.id) ?? [],
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setUserRole = async (userId: string, newRole: AppRole) => {
    if (!isAdmin) return;
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) return toast.error(delErr.message);
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (insErr) return toast.error(insErr.message);
    toast.success("Role updated");
    load();
  };

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Users & Roles" />
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
        title="Users & Roles"
        description="Manage who can access the CRM and what they can do."
        actions={
          <Badge variant="outline" className="gap-1.5">
            <UserCheck className="h-3 w-3" />
            {rows.length} user{rows.length === 1 ? "" : "s"}
          </Badge>
        }
      />
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
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-48 text-right">Change role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => {
                  const primary = u.roles[0];
                  const isMe = u.id === me?.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.full_name ?? "—"}
                        {isMe && <Badge variant="outline" className="ml-2 text-[10px]">you</Badge>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        {primary ? (
                          <Badge variant="outline" className={roleBadgeClass(primary)}>
                            {primary}
                          </Badge>
                        ) : (
                          <Badge variant="outline">no role</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={primary ?? ""}
                          onValueChange={(v) => setUserRole(u.id, v as AppRole)}
                          disabled={isMe}
                        >
                          <SelectTrigger className="h-8 w-40">
                            <SelectValue placeholder="Assign role" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                      No users yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        You can't change your own role to avoid locking yourself out.
      </p>
    </div>
  );
}
