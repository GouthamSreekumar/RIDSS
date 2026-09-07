"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Car,
  CheckCircle2,
  Clock,
  FileText,
  Shield,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useTeamDashboard } from "@/features/team-manager/api/teamManagerApi";

// ── Motion Variants ────────────────────────────────────────────────────────────
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
  label,
  value,
  icon: Icon,
  color,
  subtext,
  badge,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  subtext?: string;
  badge?: { text: string; alert?: boolean };
}) {
  return (
    <motion.div
      variants={itemVariants}
      className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-surface p-6 shadow-md"
    >
      <div className={`absolute -top-6 -right-6 h-24 w-24 rounded-full blur-2xl opacity-20 ${color}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-100">{value}</p>
          {subtext && <p className="mt-1 text-xs text-slate-500">{subtext}</p>}
          {badge && (
            <span
              className={`mt-2 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                badge.alert ? "bg-amber/15 text-amber ring-1 ring-amber/30" : "bg-success-green/15 text-success-green ring-1 ring-success-green/30"
              }`}
            >
              {badge.alert ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
              {badge.text}
            </span>
          )}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color} bg-opacity-10 ring-1 ring-current ring-opacity-20`}>
          <Icon size={20} />
        </div>
      </div>
    </motion.div>
  );
}

const ACTION_BADGES: Record<string, { label: string; style: string }> = {
  assignment_created: { label: "PAIRING CREATED", style: "text-success-green bg-success-green/10 ring-1 ring-success-green/20" },
  assignment_removed: { label: "PAIRING REMOVED", style: "text-amber bg-amber/10 ring-1 ring-amber/20" },
  report_generated: { label: "REPORT GENERATED", style: "text-blue-400 bg-blue-400/10 ring-1 ring-blue-400/20" },
};

function formatRelativeTime(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Dashboard Page ─────────────────────────────────────────────────────────────
export default function TeamManagerDashboardPage() {
  const { data, isLoading, isError } = useTeamDashboard();

  if (isLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Activity size={28} className="animate-pulse text-ferrari-red" />
        <p className="text-sm text-slate-500">Loading team operations workspace…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-surface p-8 text-center">
        <AlertCircle size={28} className="text-amber" />
        <div>
          <p className="text-sm font-semibold text-slate-200">Unable to load Team Manager Dashboard</p>
          <p className="mt-1 text-xs text-slate-500">Ensure your account is assigned to a valid team in RIDSS.</p>
        </div>
      </div>
    );
  }

  const hasUnpaired = data.unassigned_drivers_count > 0 || data.unassigned_vehicles_count > 0;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-100">{data.team_name}</h1>
            <span className="rounded-full bg-amber/10 px-2.5 py-0.5 text-xs font-semibold text-amber ring-1 ring-amber/20">
              Team Workspace
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Manage driver-vehicle assignments, roster health, and operational performance reports.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/team-manager/roster"
            className="flex items-center gap-2 rounded-lg bg-ferrari-red px-4 py-2 text-sm font-semibold text-white hover:bg-ferrari-red/90 transition-all shadow-md"
          >
            <UserCheck size={16} /> Manage Roster
          </Link>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Team Drivers"
          value={data.driver_count}
          icon={Users}
          color="text-blue-400 bg-blue-400"
          subtext="Roster count"
        />
        <StatCard
          label="Garage Vehicles"
          value={data.vehicle_count}
          icon={Car}
          color="text-cyan-400 bg-cyan-400"
          subtext="Available chassis"
        />
        <StatCard
          label="Active Pairings"
          value={data.active_pairings_count}
          icon={UserCheck}
          color="text-success-green bg-success-green"
          subtext="Driver ↔ Vehicle pairs"
        />
        <StatCard
          label="Pairing Alerts"
          value={data.unassigned_drivers_count + data.unassigned_vehicles_count}
          icon={AlertTriangle}
          color="text-amber bg-amber"
          subtext={`${data.unassigned_drivers_count} driver, ${data.unassigned_vehicles_count} car unassigned`}
          badge={hasUnpaired ? { text: "Requires Attention", alert: true } : { text: "Fully Paired", alert: false }}
        />
      </div>

      {/* Main Grid: Activity Feed & Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Activity Feed (2 cols) */}
        <motion.div variants={itemVariants} className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-surface p-6 shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-ferrari-red" />
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
                Team Activity Feed
              </h2>
            </div>
            <span className="text-[11px] text-slate-500">Live Audit Log</span>
          </div>

          {data.recent_activity.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-600">
              <Clock size={24} />
              <p className="text-sm">No recent team activity recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {data.recent_activity.map((log) => {
                const badgeInfo = ACTION_BADGES[log.action] ?? {
                  label: log.action.replace(/_/g, " ").toUpperCase(),
                  style: "text-slate-400 bg-slate-400/10 ring-1 ring-slate-700",
                };
                return (
                  <div key={log.log_id} className="flex items-start justify-between rounded-lg bg-graphite-800 p-3.5 border border-slate-800/80">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badgeInfo.style}`}>
                          {badgeInfo.label}
                        </span>
                        <span className="text-xs font-medium text-slate-300">
                          {log.user_name ?? "Team User"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {log.action === "assignment_created" && log.details
                          ? `Assigned driver ${log.details.driver_name ?? "Driver"} to chassis ${log.details.vehicle_chassis ?? "Vehicle"}`
                          : log.action === "assignment_removed" && log.details
                          ? `Unassigned pairing for ${log.details.driver_name ?? "Driver"}`
                          : log.action === "report_generated"
                          ? "Generated a complete team snapshot report"
                          : `Action on ${log.entity_type}`}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-500 whitespace-nowrap">
                      {formatRelativeTime(log.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Quick Navigation & Status Sidepanel (1 col) */}
        <motion.div variants={itemVariants} className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-surface p-6 shadow-md space-y-4">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-amber" />
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Quick Actions</h2>
            </div>

            <Link
              href="/team-manager/roster"
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-graphite-800 p-4 transition-all hover:border-amber/40 hover:bg-slate-800/60 group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber/10 text-amber ring-1 ring-amber/20">
                  <UserCheck size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-100 group-hover:text-amber transition-colors">
                    Roster & Pairings
                  </p>
                  <p className="text-xs text-slate-500">Pair drivers with garage cars</p>
                </div>
              </div>
            </Link>

            <Link
              href="/team-manager/reports"
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-graphite-800 p-4 transition-all hover:border-blue-400/40 hover:bg-slate-800/60 group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-400/10 text-blue-400 ring-1 ring-blue-400/20">
                  <FileText size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-100 group-hover:text-blue-400 transition-colors">
                    Team Reports
                  </p>
                  <p className="text-xs text-slate-500">Generate & view performance snapshots</p>
                </div>
              </div>
            </Link>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-surface p-6 shadow-md">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
              Roster Status Summary
            </h3>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span>Total Drivers</span>
                <span className="font-semibold text-slate-200">{data.driver_count}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span>Total Vehicles</span>
                <span className="font-semibold text-slate-200">{data.vehicle_count}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span>Unassigned Drivers</span>
                <span className={`font-semibold ${data.unassigned_drivers_count > 0 ? "text-amber" : "text-success-green"}`}>
                  {data.unassigned_drivers_count}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span>Unassigned Vehicles</span>
                <span className={`font-semibold ${data.unassigned_vehicles_count > 0 ? "text-amber" : "text-success-green"}`}>
                  {data.unassigned_vehicles_count}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
