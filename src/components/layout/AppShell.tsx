import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, ShoppingBag, PhoneCall, Truck, Package,
  Factory, Users, UserCog, Plug, Wallet, Settings, ShieldAlert, FileClock,
  Moon, Sun, LogOut, Boxes, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { useAuth, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AppRole[]; // if undefined → all
  group: "main" | "ops" | "biz" | "admin";
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, group: "main" },
  { to: "/orders", label: "Orders", icon: ShoppingBag, group: "ops" },
  { to: "/call-center", label: "Call Center", icon: PhoneCall, group: "ops" },
  { to: "/delivery", label: "Delivery", icon: Truck, group: "ops" },
  { to: "/products", label: "Products & Stock", icon: Package, group: "ops" },
  { to: "/sourcing", label: "Sourcing", icon: Factory, group: "biz", roles: ["admin", "moderator"] },
  { to: "/finance", label: "Finance", icon: Wallet, group: "biz", roles: ["admin", "moderator", "media_buyer"] },
  { to: "/team", label: "Team", icon: Users, group: "admin", roles: ["admin", "moderator"] },
  { to: "/users", label: "Users & Roles", icon: UserCog, group: "admin", roles: ["admin"] },
  { to: "/integrations", label: "Integrations", icon: Plug, group: "admin", roles: ["admin"] },
  { to: "/blacklist", label: "Blacklist", icon: ShieldAlert, group: "admin", roles: ["admin", "moderator"] },
  { to: "/logs", label: "System Logs", icon: FileClock, group: "admin", roles: ["admin"] },
  { to: "/settings", label: "Settings", icon: Settings, group: "admin", roles: ["admin"] },
];

const GROUP_LABELS: Record<string, string> = {
  main: "Overview",
  ops: "Operations",
  biz: "Business",
  admin: "Administration",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const { user, roles, hasAnyRole, signOut } = useAuth();

  const visible = NAV.filter((n) => !n.roles || hasAnyRole(n.roles));
  const grouped = (["main", "ops", "biz", "admin"] as const).map((g) => ({
    g,
    items: visible.filter((n) => n.group === g),
  })).filter((x) => x.items.length > 0);

  const initials = (user?.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-md)]">
                <Boxes className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold tracking-tight">CODFlow</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {grouped.map(({ g, items }) => (
            <div key={g} className="mb-4">
              {!collapsed && (
                <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {GROUP_LABELS[g]}
                </div>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = location.pathname === item.to ||
                    (item.to !== "/" && location.pathname.startsWith(item.to));
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className={cn(
                          "group flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                          active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[var(--shadow-sm)]"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          collapsed && "justify-center",
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={cn("h-9 px-2", collapsed ? "w-9" : "w-full justify-start")}>
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <div className="ml-2 flex-1 overflow-hidden text-left">
                      <div className="truncate text-xs font-medium">{user?.email}</div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {roles[0] ?? "no role"}
                      </div>
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggle}>
                  {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  Toggle theme
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] p-6">{children}</div>
      </main>
    </div>
  );
}
