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
    return (
      <FastF1LoadingSkeleton
        title="Loading race engineering dashboard"
        message="Initializing team telemetry feed and active driver roster…"
      />
    );
  }

  if (error || !data) {
    return (
      <div className="border border-red-500/30 bg-red-950/20 p-6 text-center text-red-400 border-l-2 border-l-red-500 font-sans">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <h3 className="text-base font-bold">Failed to load race engineer dashboard</h3>
        <p className="text-xs mt-1 text-red-300/80 font-mono">
          Please check server permissions or backend configuration.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* ── Top Banner ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-cyan-400">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-0.5 text-xs font-mono font-bold text-cyan-400 inline-flex items-center gap-1.5">
              <Radio size={12} className="animate-pulse text-cyan-400" /> Live team workspace
            </span>
            <span className="text-xs text-slate-400 font-mono">• {data.team_name}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Race engineer operations</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Telemetry stream inspection, driver lap comparisons, and engineering performance analysis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/race-engineer/telemetry"
            className="inline-flex items-center gap-2 border border-cyan-400 bg-cyan-400 px-4 py-2 text-xs font-mono font-semibold text-slate-950 hover:bg-cyan-300 transition-colors"
          >
            <Gauge size={15} /> Open telemetry analysis
          </Link>
        </div>
      </div>

      {/* ── Quick Stats & Roster Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Team Drivers Card */}
        <div className="md:col-span-2 border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-cyan-500">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-2.5">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Cpu size={16} className="text-cyan-400" /> Team driver roster
            </h2>
            <span className="text-xs font-mono text-slate-400">Server-side filtered</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.active_drivers.map((drv) => (
              <div
                key={drv.driver_id}
                className="flex items-center justify-between border border-slate-800 bg-slate-900 p-3.5 border-l-2 border-l-cyan-400 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center border border-cyan-400/40 bg-cyan-400/10 font-mono text-xs font-bold text-cyan-400">
                    #{drv.driver_number}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-100">{drv.full_name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      FastF1 code: <span className="text-cyan-400 font-bold">{drv.fastf1_code}</span>
                    </p>
                  </div>
                </div>

                <Link
                  href={`/race-engineer/telemetry?driver=${drv.fastf1_code}`}
                  className="p-1.5 border border-slate-800 bg-slate-950 text-slate-400 hover:text-cyan-400 hover:border-cyan-400 transition-colors"
                  title="Inspect telemetry"
                >
                  <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Links Card */}
        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-amber">
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-4 border-b border-slate-800/80 pb-2.5">
            <Zap size={16} className="text-amber" /> Engineer quick actions
          </h2>
          <div className="space-y-2">
            {data.quick_links.map((link) => (
              <Link
                key={link.url}
                href={link.url}
                className="group flex items-center justify-between border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs text-slate-300 border-l-2 border-l-transparent hover:border-l-cyan-400 transition-colors font-mono"
              >
                <span>{link.title}</span>
                <ChevronRight size={14} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Engineering Reports Section ── */}
      <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-blue-500">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-2.5">
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <FileText size={16} className="text-cyan-400" /> Recent engineering analysis reports
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Report snapshots generated for team sessions</p>
          </div>
          <Link
            href="/race-engineer/reports"
            className="text-xs font-mono font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            View all reports <ChevronRight size={13} />
          </Link>
        </div>

        {data.recent_reports.length === 0 ? (
          <div className="border border-slate-800 bg-slate-950 p-8 text-center text-slate-500 text-xs font-mono">
            No engineering reports generated yet for your team. Click "Generate report" inside the telemetry viewer to create one.
          </div>
        ) : (
          <div className="space-y-2.5">
            {data.recent_reports.map((report) => (
              <div
                key={report.report_id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-800 bg-slate-900 border-l-2 border-l-cyan-500 p-3.5"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="border border-cyan-400/40 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-400">
                      {report.data.session_id || "Session report"}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Driver: <strong className="text-slate-200">{report.data.driver_name || report.data.driver_code || "Team driver"}</strong>
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-1">{report.data.key_findings || "Session analysis summary"}</p>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0 font-mono">
                  <span>{new Date(report.created_at).toLocaleDateString()}</span>
                  <Link
                    href="/race-engineer/reports"
                    className="border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-medium text-slate-200 hover:border-cyan-400 hover:text-cyan-400 transition-colors"
                  >
                    View details
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
