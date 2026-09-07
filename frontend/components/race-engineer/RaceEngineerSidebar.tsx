"use client";

/**
 * RaceEngineerSidebar — Fixed left navigation for Race Engineer workspace.
 * Dark Engineering Theme with Electric Cyan & Emerald accents.
 */
import {
  Activity,
  ChevronRight,
  Cpu,
  FileText,
  Gauge,
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
  { href: "/race-engineer", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/race-engineer/roster", label: "Team Roster", icon: Users, exact: false },
  { href: "/race-engineer/telemetry", label: "Telemetry Analysis", icon: Gauge, exact: false },
  { href: "/race-engineer/reports", label: "Engineering Reports", icon: FileText, exact: false },
];

export function RaceEngineerSidebar() {
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
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800/80 bg-slate-950">
      {/* ── Top branding ── */}
      <div className="flex items-center gap-3 border-b border-slate-800/80 px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 ring-1 ring-cyan-500/30">
          <Cpu size={18} className="text-cyan-400" />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-slate-100">RIDSS</p>
          <p className="text-[10px] text-cyan-400 tracking-widest uppercase font-semibold">Race Engineer</p>
        </div>
      </div>

      {/* ── Navigation Items ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150
                ${active
                  ? "bg-cyan-500/10 text-cyan-300 font-medium ring-1 ring-cyan-500/25"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
            >
              <Icon
                size={16}
                className={`shrink-0 transition-colors ${active ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"}`}
              />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight size={12} className="text-cyan-400/60" />}
            </Link>
          );
        })}
      </nav>

      {/* ── User Profile + Logout ── */}
      <div className="border-t border-slate-800/80 p-3">
        <div className="mb-2 rounded-lg bg-slate-900/60 px-3 py-2.5 border border-slate-800/60">
          <p className="text-xs font-semibold text-slate-200 truncate">{user?.full_name ?? "—"}</p>
          <p className="text-[11px] text-slate-500 truncate">{user?.email ?? "—"}</p>
          <span className="mt-1 inline-block rounded-sm bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-cyan-300 ring-1 ring-cyan-500/20">
            Race Engineer
          </span>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400
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
