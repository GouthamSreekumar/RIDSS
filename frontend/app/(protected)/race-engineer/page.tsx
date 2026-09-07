"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  ChevronRight,
  Cpu,
  FileText,
  Gauge,
  Radio,
  ShieldAlert,
  Zap,
} from "lucide-react";
import Link from "next/link";
import axiosInstance from "@/lib/axios";
import { FastF1LoadingSkeleton } from "@/components/race-engineer/FastF1LoadingSkeleton";

interface DashboardData {
  team_id: string;
  team_name: string;
  active_drivers: Array<{
    driver_id: string;
    driver_number: number;
    fastf1_code: string;
    full_name: string;
    nationality?: string;
  }>;
  recent_reports: Array<{
    report_id: string;
    generated_by: string;
    generator_name: string;
    report_type: string;
    created_at: string;
    data: {
      session_id?: string;
      driver_code?: string;
      driver_name?: string;
      key_findings?: string;
    };
  }>;
  available_seasons: number[];
  quick_links: Array<{ title: string; url: string }>;
}

async function fetchDashboard(): Promise<DashboardData> {
  const res = await axiosInstance.get("/api/v1/race-engineer/dashboard");
  return res.data;
}

export default function RaceEngineerDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["raceEngineerDashboard"],
    queryFn: fetchDashboard,
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return <FastF1LoadingSkeleton title="Loading Race Engineering Dashboard" message="Initializing team telemetry feed and active roster..." />;
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-red-400" />
        <h3 className="text-lg font-bold">Failed to load Race Engineer Dashboard</h3>
        <p className="text-sm mt-1 text-red-300/80">Please check server permissions or backend configuration.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Top Banner ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 px-3 py-0.5 text-xs font-semibold text-cyan-300 ring-1 ring-cyan-500/30">
              <Radio size={12} className="animate-pulse text-cyan-400" /> Live Team Workspace
            </span>
            <span className="text-xs text-slate-400">• {data.team_name}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Race Engineer Operations</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Telemetry stream inspection, driver lap comparisons, and engineering performance analysis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/race-engineer/telemetry"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
          >
            <Gauge size={16} /> Open Telemetry Analysis
          </Link>
        </div>
      </div>

      {/* ── Quick Stats & Roster Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Team Drivers Card */}
        <div className="md:col-span-2 rounded-xl border border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Cpu size={18} className="text-cyan-400" /> Team Driver Roster
            </h2>
            <span className="text-xs text-slate-400 font-medium">Server-side filtered</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.active_drivers.map((drv) => (
              <div
                key={drv.driver_id}
                className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/80 p-4 transition-all hover:border-cyan-500/40 hover:bg-slate-900"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15 font-mono text-base font-bold text-cyan-300 ring-1 ring-cyan-500/30">
                    #{drv.driver_number}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{drv.full_name}</p>
                    <p className="text-xs text-slate-400 font-mono">
                      FastF1 Code: <span className="text-cyan-400 font-bold">{drv.fastf1_code}</span>
                    </p>
                  </div>
                </div>

                <Link
                  href={`/race-engineer/telemetry?driver=${drv.fastf1_code}`}
                  className="p-2 text-slate-400 hover:text-cyan-300 transition-colors"
                  title="Inspect Telemetry"
                >
                  <ArrowRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Links Card */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur-sm">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4">
            <Zap size={18} className="text-amber-400" /> Engineer Quick Actions
          </h2>
          <div className="space-y-2">
            {data.quick_links.map((link) => (
              <Link
                key={link.url}
                href={link.url}
                className="group flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/60 px-4 py-3 text-sm text-slate-300 hover:border-slate-700 hover:bg-slate-800/50 transition-all"
              >
                <span>{link.title}</span>
                <ChevronRight size={16} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Engineering Reports Section ── */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <FileText size={18} className="text-cyan-400" /> Recent Engineering Analysis Reports
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Report snapshots generated for team sessions</p>
          </div>
          <Link
            href="/race-engineer/reports"
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            View All Reports <ChevronRight size={14} />
          </Link>
        </div>

        {data.recent_reports.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-800 p-8 text-center text-slate-500 text-sm">
            No engineering reports generated yet for your team. Click "Generate Report" inside the telemetry viewer to create one.
          </div>
        ) : (
          <div className="space-y-3">
            {data.recent_reports.map((report) => (
              <div
                key={report.report_id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-slate-800/60 bg-slate-900/70 p-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-300 uppercase tracking-wide">
                      {report.data.session_id || "Session Report"}
                    </span>
                    <span className="text-xs text-slate-400">
                      Driver: <strong className="text-slate-200">{report.data.driver_name || report.data.driver_code || "Team Driver"}</strong>
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-1">{report.data.key_findings || "Session analysis summary"}</p>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
                  <span>{new Date(report.created_at).toLocaleDateString()}</span>
                  <Link
                    href="/race-engineer/reports"
                    className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
