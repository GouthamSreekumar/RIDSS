"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Database,
  HardDrive,
  HeartPulse,
  GitCommit,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { fetchSystemHealth, SystemHealthResponse } from "@/features/admin/api/adminApi";

const STATUS_THEME = {
  Healthy: {
    bannerBg: "bg-emerald-950/30 border-emerald-500/40 text-emerald-300",
    borderL: "border-l-emerald-500",
    badge: "border-emerald-500/40 bg-emerald-950/50 text-emerald-400 ring-1 ring-emerald-500/20",
    text: "text-emerald-400",
    icon: CheckCircle2,
  },
  Degraded: {
    bannerBg: "bg-amber-950/30 border-amber/40 text-amber-300",
    borderL: "border-l-amber",
    badge: "border-amber/40 bg-amber/10 text-amber ring-1 ring-amber/20",
    text: "text-amber",
    icon: AlertTriangle,
  },
  Critical: {
    bannerBg: "bg-red-950/40 border-red-500/50 text-red-300",
    borderL: "border-l-red-500",
    badge: "border-red-500/40 bg-red-950/50 text-red-400 ring-1 ring-red-500/20",
    text: "text-red-400",
    icon: ShieldAlert,
  },
  Unreachable: {
    bannerBg: "bg-red-950/40 border-red-500/50 text-red-300",
    borderL: "border-l-red-500",
    badge: "border-red-500/40 bg-red-950/50 text-red-400 ring-1 ring-red-500/20",
    text: "text-red-400",
    icon: ShieldAlert,
  },
};


export default function SystemHealthPage() {
  const {
    data: health,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery<SystemHealthResponse>({
    queryKey: ["admin-system-health"],
    queryFn: fetchSystemHealth,
    refetchInterval: 30000, // auto-refresh every 30s
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 font-mono text-xs text-slate-500">
        <Activity size={20} className="animate-pulse text-ferrari-red" />
        <span>Checking database connectivity, FastF1 cache & Alembic migration status…</span>
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="border border-red-500/30 bg-red-950/20 p-6 font-mono text-xs text-red-400 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle size={20} />
          <span>Failed to retrieve system health details. Check backend API status or Administrator permissions.</span>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded border border-red-500/40 px-3 py-1 text-xs hover:bg-red-900/40"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  const overallTheme = STATUS_THEME[health.status] || STATUS_THEME.Degraded;
  const OverallIcon = overallTheme.icon;

  const dbTheme = STATUS_THEME[health.database.status] || STATUS_THEME.Critical;
  const DbIcon = dbTheme.icon;

  const cacheTheme = STATUS_THEME[health.cache.status] || STATUS_THEME.Degraded;
  const CacheIcon = cacheTheme.icon;

  const migTheme = STATUS_THEME[health.migrations.status] || STATUS_THEME.Degraded;
  const MigIcon = migTheme.icon;

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <HeartPulse size={24} className="text-ferrari-red" />
            System Health & Status
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Real-time monitoring of database connectivity, FastF1 telemetry disk cache, and Alembic schema migrations.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-graphite-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={isRefetching ? "animate-spin text-ferrari-red" : ""} />
          {isRefetching ? "Refreshing…" : "Refresh Diagnostics"}
        </button>
      </div>

      {/* Prominent Overall Status Indicator Banner */}
      <div className={`border p-5 rounded-xl border-l-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${overallTheme.bannerBg} ${overallTheme.borderL}`}>
        <div className="flex items-start sm:items-center gap-3.5">
          <div className={`p-2.5 rounded-lg border bg-slate-900/60 ${overallTheme.text}`}>
            <OverallIcon size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
                Overall Platform Status
              </span>
              <span className={`border px-2 py-0.5 text-[11px] font-mono font-bold uppercase ${overallTheme.badge}`}>
                {health.status}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-slate-200">
              {health.status === "Healthy"
                ? "All system services operating normally. Database connected, telemetry cache ready, schema up to date."
                : health.status === "Degraded"
                ? "Platform running with warnings. Check telemetry pre-warm status or unapplied database migrations."
                : "CRITICAL: Database connection failure detected. Action required immediately."}
            </p>
          </div>
        </div>
        <div className="text-[11px] font-mono text-slate-400 shrink-0 self-end sm:self-center">
          Last checked: {new Date(health.timestamp).toLocaleTimeString()}
        </div>
      </div>

      {/* Individual Diagnostics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. Database Connectivity Card */}
        <div className={`border border-slate-800 bg-slate-surface p-5 rounded-xl border-l-4 ${dbTheme.borderL} space-y-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-cyan-400">
                <Database size={18} />
              </div>
              <h2 className="text-sm font-bold text-slate-100">Database Connectivity</h2>
            </div>
            <span className={`border px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${dbTheme.badge}`}>
              {health.database.status}
            </span>
          </div>

          <div className="space-y-2 pt-1 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Ping Response Time:</span>
              <span className={`font-bold ${health.database.response_time_ms !== null ? "text-emerald-400" : "text-red-400"}`}>
                {health.database.response_time_ms !== null ? `${health.database.response_time_ms} ms` : "Unreachable"}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-900/60 p-2.5 border border-slate-800 rounded">
              {health.database.details}
            </p>
          </div>
        </div>

        {/* 2. FastF1 Cache Status Card */}
        <div className={`border border-slate-800 bg-slate-surface p-5 rounded-xl border-l-4 ${cacheTheme.borderL} space-y-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-purple-400">
                <HardDrive size={18} />
              </div>
              <h2 className="text-sm font-bold text-slate-100">FastF1 Telemetry Cache</h2>
            </div>
            <span className={`border px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${cacheTheme.badge}`}>
              {health.cache.status}
            </span>
          </div>

          <div className="space-y-2 pt-1 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Disk Cache Footprint:</span>
              <span className="font-bold text-purple-300">{health.cache.size_formatted}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Last Pre-warm Run:</span>
              <span className="font-bold text-slate-200">
                {health.cache.last_prewarm_at
                  ? new Date(health.cache.last_prewarm_at).toLocaleString()
                  : "Never / Pending"}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-900/60 p-2.5 border border-slate-800 rounded truncate" title={health.cache.details}>
              {health.cache.details}
            </p>
          </div>
        </div>

        {/* 3. Pending Migrations Card */}
        <div className={`border border-slate-800 bg-slate-surface p-5 rounded-xl border-l-4 ${migTheme.borderL} space-y-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-amber">
                <GitCommit size={18} />
              </div>
              <h2 className="text-sm font-bold text-slate-100">Alembic Schema Status</h2>
            </div>
            <span className={`border px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${migTheme.badge}`}>
              {health.migrations.pending ? "Pending" : "Up to Date"}
            </span>
          </div>

          <div className="space-y-2 pt-1 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Target Script Head:</span>
              <span className="font-bold text-slate-200 truncate max-w-[140px]" title={health.migrations.current_head}>
                {health.migrations.current_head}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Applied Database Version:</span>
              <span className={`font-bold ${health.migrations.pending ? "text-amber" : "text-emerald-400"} truncate max-w-[140px]`} title={health.migrations.applied_version}>
                {health.migrations.applied_version}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-900/60 p-2.5 border border-slate-800 rounded">
              {health.migrations.details}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
