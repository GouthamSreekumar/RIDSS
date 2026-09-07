"use client";

/**
 * AdminSidebar — Fixed left navigation for the admin dashboard.
 * Dark Engineering Theme with Ferrari Red accents.
 */
import {
  Activity,
  AlertTriangle,
  Bell,
  ChevronRight,
  Flag,
  LogOut,
  Settings,
  Shield,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { logoutUser } from "@/features/auth/api/authApi";
import { fetchMe } from "@/features/auth/api/authApi";
import { useQuery } from "@tanstack/react-query";

const NAV_ITEMS = [
  { href: "/admin",               label: "Overview",          icon: Activity,      exact: true  },
  { href: "/admin/users",         label: "User Management",   icon: Users,         exact: false },
  { href: "/admin/teams",         label: "Teams",             icon: Trophy,        exact: false },
  { href: "/admin/roles",         label: "Roles & Permissions", icon: Shield,      exact: false },
  { href: "/admin/races",         label: "Races & Circuits",  icon: Flag,          exact: false },
  { href: "/admin/notifications", label: "Notifications",     icon: Bell,          exact: false },
  { href: "/admin/audit-logs",    label: "Audit Logs",        icon: AlertTriangle, exact: false },
  { href: "/admin/settings",      label: "System Settings",   icon: Settings,      exact: false },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logoutUser(); } finally {
      router.replace("/login");
    }
  };

  const isActive = (item: typeof NAV_ITEMS[0]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800/60 bg-slate-900">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 border-b border-slate-800/60 px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ferrari-red/15 ring-1 ring-ferrari-red/30">
          <Activity size={18} className="text-ferrari-red" />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-slate-100">RIDSS</p>
          <p className="text-[10px] text-slate-500 tracking-widest uppercase">Admin Panel</p>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150
                ${active
                  ? "bg-ferrari-red/10 text-ferrari-red font-medium ring-1 ring-ferrari-red/20"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
                }`}
            >
              <Icon
                size={16}
                className={`shrink-0 transition-colors ${active ? "text-ferrari-red" : "text-slate-500 group-hover:text-slate-300"}`}
              />
              <span className="flex-1">{item.label}</span>
              {active && (
                <ChevronRight size={12} className="text-ferrari-red/60" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── User Profile + Logout ── */}
      <div className="border-t border-slate-800/60 p-3">
        <div className="mb-2 rounded-lg bg-slate-800/40 px-3 py-2.5">
          <p className="text-xs font-semibold text-slate-100 truncate">{user?.full_name ?? "—"}</p>
          <p className="text-[11px] text-slate-500 truncate">{user?.email ?? "—"}</p>
          <span className="mt-1 inline-block rounded-sm bg-ferrari-red/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-ferrari-red ring-1 ring-ferrari-red/20">
            Administrator
          </span>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500
                     transition-all hover:bg-red-500/10 hover:text-red-400
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogOut size={14} />
          {loggingOut ? "Signing out…" : "Sign Out"}
        </button>
      </div>
    </aside>
  );
}
