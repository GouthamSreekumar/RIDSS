/**
 * Shared dashboard stub component.
 * Each role dashboard page renders this with role-specific metadata.
 * Replace with full dashboard implementation in subsequent sprints.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { fetchMe, logoutUser } from "@/features/auth/api/authApi";

const ROLE_COLORS: Record<string, string> = {
  administrator:     "text-ferrari-red",
  team_manager:      "text-amber",
  race_engineer:     "text-blue-400",
  strategy_engineer: "text-purple-400",
  mechanic:          "text-success-green",
  driver:            "text-orange-400",
};

const ROLE_LABELS: Record<string, string> = {
  administrator:     "Administrator",
  team_manager:      "Team Manager",
  race_engineer:     "Race Engineer",
  strategy_engineer: "Strategy Engineer",
  mechanic:          "Mechanic",
  driver:            "Driver",
};

export function DashboardStub() {
  const router = useRouter();

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    retry: false,
  });

  const handleLogout = async () => {
    try {
      await logoutUser();
    } finally {
      router.replace("/login");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-graphite">
        <Activity size={24} className="animate-pulse text-ferrari-red" />
      </div>
    );
  }

  const roleColor = ROLE_COLORS[user?.role ?? ""] ?? "text-slate-400";
  const roleLabel = ROLE_LABELS[user?.role ?? ""] ?? user?.role ?? "Unknown";

  return (
    <main className="min-h-screen bg-graphite p-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mx-auto max-w-2xl"
      >
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ferrari-red/15 ring-1 ring-ferrari-red/30">
              <Activity size={20} className="text-ferrari-red" />
            </div>
            <span className="text-lg font-bold text-slate-100">RIDSS</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400
                       transition-all hover:border-ferrari-red/40 hover:text-ferrari-red
                       focus-visible:ring-2 focus-visible:ring-ferrari-red"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>

        {/* Welcome card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-surface p-8">
          <div className="h-0.5 -mx-8 -mt-8 mb-8 rounded-t-2xl bg-gradient-to-r from-transparent via-ferrari-red to-transparent" />
          <p className="mb-1 text-sm text-slate-500">Welcome back,</p>
          <h1 className="mb-1 text-3xl font-bold text-slate-100">{user?.full_name ?? "—"}</h1>
          <p className={`text-sm font-semibold tracking-wide ${roleColor}`}>{roleLabel}</p>

          <div className="mt-8 rounded-xl border border-slate-700/50 bg-graphite-800 p-6 text-center">
            <p className="text-slate-500 text-sm">
              Dashboard for <span className={`font-semibold ${roleColor}`}>{roleLabel}</span> — coming soon.
            </p>
            <p className="mt-1 text-xs text-slate-600">This stub confirms successful authentication and role-based routing.</p>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
