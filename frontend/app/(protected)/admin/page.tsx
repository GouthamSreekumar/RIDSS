"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  Flag,
  Shield,
  TrendingUp,
  Users,
  Trophy,
} from "lucide-react";
import { fetchDashboard } from "@/features/admin/api/adminApi";

// ── Framer Motion variants ─────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

// ── Subcomponents ──────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, color, subtext,
}: {
  label: string; value: number | string; icon: React.ElementType;
  color: string; subtext?: string;
}) {
  return (
    <motion.div
      variants={itemVariants}
      className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-surface p-6"
    >
      {/* Glow */}
      <div className={`absolute -top-6 -right-6 h-24 w-24 rounded-full blur-2xl opacity-20 ${color}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-100">{value}</p>
          {subtext && <p className="mt-1 text-xs text-slate-500">{subtext}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color} bg-opacity-10 ring-1 ring-current ring-opacity-20`}>
          <Icon size={20} />
        </div>
      </div>
    </motion.div>
  );
}

function HealthBadge({ label, value }: { label: string; value: string }) {
  const ok = value === "connected" || value === "initialized" || value === "healthy";
  return (
    <div className="flex items-center justify-between rounded-lg bg-graphite-800 px-4 py-3">
      <div className="flex items-center gap-2">
        {ok
          ? <CheckCircle2 size={14} className="text-success-green" />
          : <AlertCircle size={14} className="text-amber" />}
        <span className="text-sm text-slate-300">{label}</span>
      </div>
      <span className={`text-xs font-semibold uppercase tracking-wide ${ok ? "text-success-green" : "text-amber"}`}>
        {value}
      </span>
    </div>
  );
}

const ACTION_COLORS: Record<string, string> = {
  USER_CREATE: "text-success-green bg-success-green/10",
  USER_UPDATE: "text-blue-400 bg-blue-400/10",
  USER_STATUS_TOGGLE: "text-amber bg-amber/10",
  ROLE_CREATE: "text-purple-400 bg-purple-400/10",
  ROLE_PERMISSIONS_UPDATE: "text-ferrari-red bg-ferrari-red/10",
  TEAM_CREATE: "text-cyan-400 bg-cyan-400/10",
};

function formatRelative(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AdminOverviewPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Activity size={24} className="animate-pulse text-ferrari-red" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-500">
        <AlertCircle size={24} className="text-amber" />
        <p className="text-sm">Failed to load dashboard. Is the backend running?</p>
      </div>
    );
  }

  const health = data.system_health;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
      {/* ── Page Header ── */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-slate-100">Platform Overview</h1>
        <p className="mt-1 text-sm text-slate-500">
          Real-time metrics and system status for RIDSS administrators.
        </p>
      </motion.div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Users" value={data.user_count}
          icon={Users} color="text-blue-400 bg-blue-400"
          subtext="Registered accounts"
        />
        <StatCard
          label="Active Teams" value={data.team_count}
          icon={Trophy} color="text-amber bg-amber"
          subtext="Race teams configured"
        />
        <StatCard
          label="Race Events" value={data.active_races_count}
          icon={Flag} color="text-ferrari-red bg-ferrari-red"
          subtext="Current season and beyond"
        />
      </div>

      {/* ── System Health + Activity ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* System Health */}
        <motion.div variants={itemVariants} className="rounded-xl border border-slate-800 bg-slate-surface p-6">
          <div className="mb-4 flex items-center gap-2">
            <Database size={16} className="text-success-green" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">System Health</h2>
          </div>
          <div className="space-y-2">
            <HealthBadge label="Overall Status" value={health.status ?? "—"} />
            <HealthBadge label="Database" value={health.database ?? "—"} />
            <HealthBadge label="RBAC Cache" value={health.rbac_cache ?? "—"} />
          </div>
          {health.timestamp && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
              <Clock size={11} />
              Last checked: {new Date(health.timestamp).toLocaleTimeString()}
            </p>
          )}
        </motion.div>

        {/* Recent Activity */}
        <motion.div variants={itemVariants} className="rounded-xl border border-slate-800 bg-slate-surface p-6">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-ferrari-red" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Recent Activity</h2>
          </div>
          {data.recent_activity.length === 0 ? (
            <p className="text-sm text-slate-600 text-center py-8">No activity yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {data.recent_activity.map((log) => {
                const colorClass = ACTION_COLORS[log.action] ?? "text-slate-400 bg-slate-400/10";
                return (
                  <div key={log.log_id} className="flex items-start gap-3 rounded-lg bg-graphite-800 px-3 py-2.5">
                    <span className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0 ${colorClass}`}>
                      {log.action.replace(/_/g, " ")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-300 truncate">{log.entity_type}</p>
                      <p className="text-[11px] text-slate-600">{formatRelative(log.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Quick Actions ── */}
      <motion.div variants={itemVariants} className="rounded-xl border border-slate-800 bg-slate-surface p-6">
        <div className="mb-4 flex items-center gap-2">
          <Shield size={16} className="text-ferrari-red" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Quick Navigation</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Manage Users",   href: "/admin/users",          icon: Users,         color: "hover:border-blue-500/40 hover:text-blue-400" },
            { label: "Manage Teams",   href: "/admin/teams",          icon: Trophy,        color: "hover:border-amber/40 hover:text-amber" },
            { label: "Roles & Perms",  href: "/admin/roles",          icon: Shield,        color: "hover:border-purple-500/40 hover:text-purple-400" },
            { label: "Race Calendar",  href: "/admin/races",          icon: Flag,          color: "hover:border-ferrari-red/40 hover:text-ferrari-red" },
          ].map(({ label, href, icon: Icon, color }) => (
            <a
              key={href}
              href={href}
              className={`flex flex-col items-center gap-2 rounded-lg border border-slate-700/50 bg-graphite-800 px-4 py-4 text-center text-sm text-slate-400 transition-all duration-200 ${color}`}
            >
              <Icon size={20} />
              <span className="text-xs font-medium">{label}</span>
            </a>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
