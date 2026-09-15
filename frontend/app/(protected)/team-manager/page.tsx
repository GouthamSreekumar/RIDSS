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
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

// ── Subcomponents ──────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  borderAccentClass,
  iconColorClass,
  subtext,
  badge,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  borderAccentClass: string;
  iconColorClass: string;
  subtext?: string;
  badge?: { text: string; alert?: boolean };
}) {
  return (
    <motion.div
      variants={itemVariants}
      className={`border border-slate-800 bg-slate-surface p-5 border-l-2 ${borderAccentClass}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-100">{value}</p>
          {subtext && <p className="mt-1 text-xs text-slate-500 font-mono">{subtext}</p>}
          {badge && (
            <div className="mt-2.5">
              <span
                className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] font-mono font-bold ${
                  badge.alert
                    ? "border-amber/40 bg-amber/10 text-amber"
                    : "border-emerald-500/40 bg-emerald-950/40 text-emerald-400"
                }`}
              >
                {badge.alert ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
                {badge.text}
              </span>
            </div>
          )}
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center border border-slate-800 bg-slate-900 ${iconColorClass}`}>
          <Icon size={18} />
        </div>
      </div>
    </motion.div>
  );
}

const ACTION_BADGES: Record<string, { label: string; style: string }> = {
  assignment_created: { label: "Pairing created", style: "border-l-2 border-l-emerald-500 bg-emerald-950/40 text-emerald-400 border border-emerald-900/60" },
  assignment_removed: { label: "Pairing removed", style: "border-l-2 border-l-amber-500 bg-amber-950/40 text-amber border border-amber-900/60" },
  report_generated: { label: "Report generated", style: "border-l-2 border-l-cyan-500 bg-cyan-950/40 text-cyan-400 border border-cyan-900/60" },
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
        <Activity size={24} className="animate-pulse text-ferrari-red" />
        <p className="text-xs text-slate-500 font-mono">Loading team workspace telemetry…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 border border-slate-800 bg-slate-surface p-8 text-center border-l-2 border-l-amber">
        <AlertCircle size={24} className="text-amber" />
        <div>
          <p className="text-sm font-semibold text-slate-200">Unable to load Team Manager Dashboard</p>
          <p className="mt-1 text-xs text-slate-500">Ensure your account is assigned to a valid team in RIDSS.</p>
        </div>
      </div>
    );
  }

  const hasUnpaired = data.unassigned_drivers_count > 0 || data.unassigned_vehicles_count > 0;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">{data.team_name}</h1>
            <span className="border border-amber/30 bg-amber/10 px-2.5 py-0.5 text-xs font-mono text-amber">
              Team workspace
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Driver-vehicle assignments, active telemetry pairings, and operational performance reports.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/team-manager/roster"
            className="flex items-center gap-2 border border-ferrari-red bg-ferrari-red px-4 py-2 text-xs font-semibold text-white hover:bg-ferrari-red/90 transition-colors"
          >
            <UserCheck size={15} /> Manage roster
          </Link>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Team drivers"
          value={data.driver_count}
          icon={Users}
          borderAccentClass="border-l-cyan-500"
          iconColorClass="text-cyan-400"
          subtext="Active roster drivers"
        />
        <StatCard
          label="Garage vehicles"
          value={data.vehicle_count}
          icon={Car}
          borderAccentClass="border-l-blue-500"
          iconColorClass="text-blue-400"
          subtext="Available chassis"
        />
        <StatCard
          label="Active pairings"
          value={data.active_pairings_count}
          icon={UserCheck}
          borderAccentClass="border-l-emerald-500"
          iconColorClass="text-emerald-400"
          subtext="Driver ↔ Vehicle pairs"
        />
        <StatCard
          label="Pairing alerts"
          value={data.unassigned_drivers_count + data.unassigned_vehicles_count}
          icon={AlertTriangle}
          borderAccentClass={hasUnpaired ? "border-l-amber" : "border-l-slate-700"}
          iconColorClass={hasUnpaired ? "text-amber" : "text-slate-400"}
          subtext={`${data.unassigned_drivers_count} driver, ${data.unassigned_vehicles_count} car unassigned`}
          badge={hasUnpaired ? { text: "Requires attention", alert: true } : { text: "Fully paired", alert: false }}
        />
      </div>

      {/* Main Grid: Activity Feed & Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Activity Feed (2 cols) */}
        <motion.div variants={itemVariants} className="lg:col-span-2 border border-slate-800 bg-slate-surface p-5">
          <div className="mb-4 flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-ferrari-red" />
              <h2 className="text-sm font-bold text-slate-200">
                Team activity feed
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-mono">Live audit log</span>
          </div>

          {data.recent_activity.length === 0 ? (
            <div className="flex h-44 flex-col items-center justify-center gap-2 text-slate-500">
              <Clock size={22} />
              <p className="text-xs font-mono">No recent team activity recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {data.recent_activity.map((log) => {
                const badgeInfo = ACTION_BADGES[log.action] ?? {
                  label: log.action.replace(/_/g, " "),
                  style: "border-l-2 border-l-slate-600 bg-slate-800/60 text-slate-400 border border-slate-700",
                };
                return (
                  <div key={log.log_id} className="flex items-start justify-between border border-slate-800 bg-slate-900/60 p-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-mono font-bold ${badgeInfo.style}`}>
                          {badgeInfo.label}
                        </span>
                        <span className="text-xs font-semibold text-slate-300">
                          {log.user_name ?? "Team user"}
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
                    <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                      {formatRelativeTime(log.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Quick Navigation & Status Sidepanel (1 col) */}
        <motion.div variants={itemVariants} className="space-y-5">
          <div className="border border-slate-800 bg-slate-surface p-5 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
              <Shield size={16} className="text-amber" />
              <h2 className="text-sm font-bold text-slate-200">Quick actions</h2>
            </div>

            <Link
              href="/team-manager/roster"
              className="flex items-center justify-between border border-slate-800 bg-slate-900/80 p-3.5 border-l-2 border-l-amber hover:border-l-ferrari-red transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center border border-amber/30 bg-amber/10 text-amber shrink-0">
                  <UserCheck size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-100 group-hover:text-amber transition-colors">
                    Roster & pairings
                  </p>
                  <p className="text-[11px] text-slate-500">Pair drivers with garage cars</p>
                </div>
              </div>
            </Link>

            <Link
              href="/team-manager/reports"
              className="flex items-center justify-between border border-slate-800 bg-slate-900/80 p-3.5 border-l-2 border-l-cyan-500 hover:border-l-ferrari-red transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 shrink-0">
                  <FileText size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-100 group-hover:text-cyan-400 transition-colors">
                    Team reports
                  </p>
                  <p className="text-[11px] text-slate-500">Generate operational snapshots</p>
                </div>
              </div>
            </Link>
          </div>

          <div className="border border-slate-800 bg-slate-surface p-5">
            <h3 className="text-xs font-bold text-slate-300 border-b border-slate-800/80 pb-2 mb-3">
              Roster status summary
            </h3>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span>Total drivers</span>
                <span className="font-mono font-bold text-slate-200">{data.driver_count}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span>Total vehicles</span>
                <span className="font-mono font-bold text-slate-200">{data.vehicle_count}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span>Unassigned drivers</span>
                <span className={`font-mono font-bold ${data.unassigned_drivers_count > 0 ? "text-amber" : "text-emerald-400"}`}>
                  {data.unassigned_drivers_count}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span>Unassigned vehicles</span>
                <span className={`font-mono font-bold ${data.unassigned_vehicles_count > 0 ? "text-amber" : "text-emerald-400"}`}>
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
