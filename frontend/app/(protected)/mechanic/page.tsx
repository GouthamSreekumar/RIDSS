"use client";

import Link from "next/link";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Calendar,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { useMechanicDashboard } from "@/features/mechanic/api/mechanicApi";

export default function MechanicDashboardPage() {
  const { data: dashboard, isLoading, error } = useMechanicDashboard();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 font-mono text-xs text-slate-500">
        <Activity size={20} className="animate-pulse text-ferrari-red" />
        <span>Loading garage health status & maintenance pipeline…</span>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="border border-red-500/30 bg-red-950/20 p-6 font-mono text-xs text-red-400 flex items-center gap-3">
        <AlertCircle size={20} />
        <span>Failed to load mechanic dashboard overview data. Please check network connection or permissions.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Mechanic Operations Dashboard</h1>
          <p className="mt-1 text-xs text-slate-400">
            Real-time component health tracking, scheduled maintenance work orders, and vehicle readiness status.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/mechanic/vehicles"
            className="flex items-center gap-1.5 border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono font-semibold text-slate-200 hover:border-slate-500 transition-colors"
          >
            <Car size={14} /> View Vehicles
          </Link>
          <Link
            href="/mechanic/maintenance"
            className="flex items-center gap-1.5 border border-ferrari-red bg-ferrari-red px-3.5 py-2 text-xs font-mono font-semibold text-white hover:bg-ferrari-red/90 transition-colors"
          >
            <Wrench size={14} /> Schedule Maintenance
          </Link>
        </div>
      </div>

      {/* KPI Cards (Health Status Tiers) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Vehicles */}
        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-cyan-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Total Garage Cars</p>
            <p className="mt-1 text-3xl font-bold font-mono tabular-nums text-slate-100">{dashboard.total_vehicles}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center border border-slate-800 bg-slate-900 text-cyan-400">
            <Car size={18} />
          </div>
        </div>

        {/* Good Health */}
        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-emerald-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Good Health</p>
            <p className="mt-1 text-3xl font-bold font-mono tabular-nums text-emerald-400">{dashboard.good_count}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center border border-slate-800 bg-slate-900 text-emerald-400">
            <CheckCircle2 size={18} />
          </div>
        </div>

        {/* Needs Attention */}
        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-amber flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Needs Attention</p>
            <p className={`mt-1 text-3xl font-bold font-mono tabular-nums ${dashboard.needs_attention_count > 0 ? "text-amber" : "text-slate-300"}`}>
              {dashboard.needs_attention_count}
            </p>
          </div>
          <div className={`flex h-9 w-9 items-center justify-center border border-slate-800 bg-slate-900 ${dashboard.needs_attention_count > 0 ? "text-amber" : "text-slate-500"}`}>
            <AlertTriangle size={18} />
          </div>
        </div>

        {/* Critical Health */}
        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-red-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Critical (Blocked)</p>
            <p className={`mt-1 text-3xl font-bold font-mono tabular-nums ${dashboard.critical_count > 0 ? "text-red-400" : "text-slate-300"}`}>
              {dashboard.critical_count}
            </p>
          </div>
          <div className={`flex h-9 w-9 items-center justify-center border border-slate-800 bg-slate-900 ${dashboard.critical_count > 0 ? "text-red-400 animate-pulse" : "text-slate-500"}`}>
            <ShieldAlert size={18} />
          </div>
        </div>
      </div>

      {/* Critical Banner if any vehicle is Critical */}
      {dashboard.critical_count > 0 && (
        <div className="border border-red-500/40 bg-red-950/30 p-4 border-l-4 border-l-red-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-red-400 shrink-0" size={20} />
            <div>
              <h3 className="text-xs font-bold font-mono text-red-300 uppercase tracking-wider">
                {dashboard.critical_count} Vehicle(s) Require Immediate Attention
              </h3>
              <p className="text-xs text-red-400/90 mt-0.5">
                Vehicles with CRITICAL component health are blocked from driver assignment in Team Manager's Roster.
              </p>
            </div>
          </div>
          <Link
            href="/mechanic/vehicles"
            className="shrink-0 border border-red-500/50 bg-red-900/40 px-3 py-1.5 text-xs font-mono font-semibold text-red-200 hover:bg-red-900/60 transition-colors flex items-center gap-1"
          >
            Inspect Critical Cars <ChevronRight size={13} />
          </Link>
        </div>
      )}

      {/* Main Grid: Maintenance Pipeline & Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Upcoming Maintenance List (2 Columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="border border-slate-800 bg-slate-surface">
            <div className="border-b border-slate-800 px-5 py-3.5 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2">
                <Wrench size={16} className="text-ferrari-red" />
                <h2 className="text-sm font-bold text-slate-200">
                  Maintenance Pipeline ({dashboard.upcoming_maintenance.length})
                </h2>
              </div>
              <Link
                href="/mechanic/maintenance"
                className="text-xs font-mono text-ferrari-red hover:underline flex items-center gap-1"
              >
                Manage all <ChevronRight size={12} />
              </Link>
            </div>

            {dashboard.upcoming_maintenance.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-500 font-mono text-xs">
                <CheckCircle2 size={20} className="text-emerald-500/60" />
                <p>No upcoming or in-progress maintenance tasks scheduled.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {dashboard.upcoming_maintenance.map((m) => {
                  const isCompleted = m.status === "completed";
                  const isInProgress = m.status === "in_progress";
                  return (
                    <div key={m.maintenance_id} className="p-4 hover:bg-slate-900/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-100 text-xs">
                            {m.vehicle_chassis ?? `Car #${m.vehicle_id.slice(0, 6)}`}
                          </span>
                          <span
                            className={`border px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${
                              isInProgress
                                ? "border-amber/40 bg-amber/10 text-amber"
                                : isCompleted
                                ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-400"
                                : "border-cyan-500/40 bg-cyan-950/40 text-cyan-400"
                            }`}
                          >
                            {m.status.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">{m.description || "Routine component inspection"}</p>
                        <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono">
                          <span className="flex items-center gap-1">
                            <Clock size={11} /> {new Date(m.maintenance_date).toLocaleString()}
                          </span>
                          <span>Mechanic: {m.mechanic_name ?? "Assigned Staff"}</span>
                        </div>
                      </div>

                      <Link
                        href={`/mechanic/maintenance`}
                        className="shrink-0 border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-mono text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-center"
                      >
                        Update Task
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Audit Log Activity Feed (1 Column) */}
        <div className="border border-slate-800 bg-slate-surface">
          <div className="border-b border-slate-800 px-5 py-3.5 flex items-center justify-between bg-slate-900/60">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-cyan-400" />
              <h2 className="text-sm font-bold text-slate-200">Garage Activity Log</h2>
            </div>
          </div>

          {dashboard.recent_activity.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-slate-500 font-mono text-xs">
              No recent garage audit activity.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80 max-h-[440px] overflow-y-auto">
              {dashboard.recent_activity.map((act) => (
                <div key={act.log_id} className="p-3.5 space-y-1 text-xs hover:bg-slate-900/40 transition-colors">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="font-semibold text-slate-200">{act.user_name}</span>
                    <span className="text-slate-500">
                      {new Date(act.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] font-mono">
                    <span className="text-ferrari-red font-semibold">{act.action}</span> on {act.entity_type}
                  </p>
                  {act.details && (
                    <p className="text-[10px] text-slate-500 font-mono truncate">
                      {JSON.stringify(act.details)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
