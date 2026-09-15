"use client";

/**
 * TeamManagerSidebar — Pit-wall navigation sidebar for Team Manager workspace.
 * Mid-dark graphite structural chrome frame with recessed near-black nav surfaces.
 */
import {
  Activity,
  Calendar,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { fetchMe, logoutUser } from "@/features/auth/api/authApi";
import { useQuery } from "@tanstack/react-query";

const NAV_ITEMS = [
  { href: "/team-manager", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/team-manager/calendar", label: "Race Calendar", icon: Calendar, exact: false },
  { href: "/team-manager/roster", label: "Roster & Pairings", icon: Users, exact: false },
  { href: "/team-manager/reports", label: "Team Reports", icon: FileText, exact: false },
];

export function TeamManagerSidebar() {
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
    try {
      await logoutUser();
    } finally {
      router.replace("/login");
    }
  };

  const isActive = (item: (typeof NAV_ITEMS)[0]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-graphite font-sans">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4 bg-slate-900/60">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-ferrari-red/40 bg-ferrari-red/10 text-ferrari-red">
          <Activity size={16} />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-slate-100 font-mono">RIDSS</p>
          <p className="text-xs text-amber font-mono">Team workspace</p>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-3.5 py-2.5 text-xs transition-colors border-l-2 ${
                active
                  ? "border-l-ferrari-red bg-slate-surface text-slate-100 font-semibold border border-slate-800"
                  : "border-l-transparent text-slate-400 hover:bg-slate-surface/60 hover:text-slate-200"
              }`}
            >
              <Icon
                size={15}
                className={`shrink-0 ${active ? "text-ferrari-red" : "text-slate-500 group-hover:text-slate-300"}`}
              />
              <span className="flex-1 font-medium">{item.label}</span>
              {active && <ChevronRight size={12} className="text-ferrari-red shrink-0" />}
            </Link>
          );
        })}
      </nav>

      {/* ── User Profile + Logout ── */}
      <div className="border-t border-slate-800 p-3 bg-slate-900/60">
        <div className="mb-2 border border-slate-800 bg-slate-surface p-3 space-y-1">
          <p className="text-xs font-semibold text-slate-100 truncate">{user?.full_name ?? "—"}</p>
          <p className="text-[11px] text-slate-400 font-mono truncate">{user?.email ?? "—"}</p>
          <div className="pt-1">
            <span className="inline-block border border-amber/30 bg-amber/10 px-2 py-0.5 text-[10px] font-mono text-amber">
              Team manager
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-2 border border-slate-800 bg-slate-surface px-3 py-2 text-xs font-medium text-slate-400 hover:border-red-500/40 hover:bg-red-950/30 hover:text-red-400 transition-colors disabled:opacity-50"
        >
          <LogOut size={13} />
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
