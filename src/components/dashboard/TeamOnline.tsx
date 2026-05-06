import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Member = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  online: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  moderator: "Modérateur",
  agent: "Agent",
  media_buyer: "Media Buyer",
};

function initials(name: string | null, email: string | null) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 1).toUpperCase();
}

const AVATAR_GRADIENTS = [
  "from-violet-500 to-fuchsia-500",
  "from-sky-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-rose-500",
  "from-pink-500 to-purple-500",
  "from-cyan-500 to-blue-500",
];

function gradientFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

export function TeamOnline() {
  const [members, setMembers] = useState<Member[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, is_active")
          .eq("is_active", true),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (cancelled) return;
      const roleMap = new Map<string, string>();
      (roles ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role));
      setMembers(
        (profiles ?? []).map((p: any) => ({
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          role: roleMap.get(p.id) ?? null,
          online: false,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const channel = supabase.channel("presence:online");
    const sync = () => {
      const state = channel.presenceState() as Record<string, unknown[]>;
      setOnlineIds(new Set(Object.keys(state)));
    };
    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const sorted = [...members].sort((a, b) => {
    const ao = onlineIds.has(a.id) ? 0 : 1;
    const bo = onlineIds.has(b.id) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "");
  });

  const onlineCount = sorted.filter((m) => onlineIds.has(m.id)).length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b bg-gradient-to-r from-card to-muted/30 pb-4">
        <CardTitle className="text-base font-semibold">Équipe</CardTitle>
        <Badge
          variant="outline"
          className="gap-1.5 border-success/30 bg-success/10 text-success"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          {onlineCount} actif{onlineCount === 1 ? "" : "s"}
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {sorted.map((m) => {
            const online = onlineIds.has(m.id);
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <div className="relative shrink-0">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white shadow-sm",
                      gradientFor(m.id),
                    )}
                  >
                    {initials(m.full_name, m.email)}
                  </div>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                      online ? "bg-success" : "bg-muted-foreground/40",
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.full_name || m.email || "—"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {ROLE_LABEL[m.role ?? ""] ?? "—"}
                  </p>
                </div>
                {online ? (
                  <Badge
                    variant="outline"
                    className="border-success/30 bg-success/10 text-xs text-success"
                  >
                    En ligne
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-muted text-xs text-muted-foreground"
                  >
                    Hors ligne
                  </Badge>
                )}
              </li>
            );
          })}
          {sorted.length === 0 && (
            <li className="py-12 text-center text-sm text-muted-foreground">
              Aucun membre dans l'équipe.
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
