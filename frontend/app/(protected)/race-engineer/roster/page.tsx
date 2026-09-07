"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  ChevronRight,
  Cpu,
  FileText,
  Flame,
  Gauge,
  Radio,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import axiosInstance from "@/lib/axios";
import { FastF1LoadingSkeleton } from "@/components/race-engineer/FastF1LoadingSkeleton";

interface DriverRosterItem {
  driver_id: string;
  driver_number: number;
  fastf1_code: string;
  full_name: string;
  nationality?: string;
}

interface DashboardData {
  team_id: string;
  team_name: string;
  active_drivers: DriverRosterItem[];
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
}

export default function RaceEngineerRosterPage() {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["raceEngineerDashboard"],
    queryFn: async () => {
      const res = await axiosInstance.get("/api/v1/race-engineer/dashboard");
      return res.data;
    },
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <FastF1LoadingSkeleton
        title="Loading Team Driver Roster"
        message="Fetching own-team driver profiles, telemetry tags, and active vehicle assignments..."
      />
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400">
        <Cpu className="mx-auto mb-3 h-10 w-10 text-red-400" />
        <h3 className="text-lg font-bold">Failed to load Team Roster</h3>
        <p className="text-sm mt-1 text-red-300/80">Please check server connection or team authorization.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 px-3 py-0.5 text-xs font-semibold text-cyan-300 ring-1 ring-cyan-500/30">
              <Users size={12} className="text-cyan-400" /> Race Engineering Roster
            </span>
            <span className="text-xs text-slate-400">• {data.team_name}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Team Driver & Telemetry Roster</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Active drivers assigned to {data.team_name}. Enforced server-side — Race Engineers only have access to their own team's telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/race-engineer/telemetry"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
          >
            <Gauge size={16} /> Open Telemetry Viewer
          </Link>
        </div>
      </div>

      {/* ── Security & Scope Notice ── */}
      <div className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-xs text-cyan-200">
        <ShieldCheck size={18} className="text-cyan-400 shrink-0" />
        <div>
          <span className="font-bold text-cyan-300">Server-Enforced Scope Notice:</span> FastF1 streams full grid session data, but RIDSS server-side security automatically restricts your telemetry queries to {data.team_name} drivers ({data.active_drivers.map((d) => d.fastf1_code).join(", ")}).
        </div>
      </div>

      {/* ── Active Team Drivers Grid ── */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Cpu size={18} className="text-cyan-400" /> Assigned Team Drivers ({data.active_drivers.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.active_drivers.map((driver) => {
            const driverReports = data.recent_reports.filter(
              (r) => r.data.driver_code === driver.fastf1_code || r.data.driver_name === driver.full_name
            );

            return (
              <div
                key={driver.driver_id}
                className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-sm hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Top Card Bar */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 font-mono text-xl font-bold text-cyan-300 ring-1 ring-cyan-500/30">
                        #{driver.driver_number}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-100">{driver.full_name}</h3>
                        <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{driver.nationality || "Formula 1 Driver"}</span>
                          <span>•</span>
                          <span className="font-mono text-cyan-400 font-bold">FastF1 Tag: {driver.fastf1_code}</span>
                        </p>
                      </div>
                    </div>

                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                      Active Driver
                    </span>
                  </div>

                  {/* Driver Stats Snapshot */}
                  <div className="grid grid-cols-2 gap-3 mt-5">
                    <div className="rounded-lg bg-slate-950/80 p-3 border border-slate-800/80">
                      <p className="text-[10px] text-slate-400 uppercase font-medium">Team Access</p>
                      <p className="text-sm font-semibold text-slate-200 mt-0.5">{data.team_name}</p>
                    </div>

                    <div className="rounded-lg bg-slate-950/80 p-3 border border-slate-800/80">
                      <p className="text-[10px] text-slate-400 uppercase font-medium">Engineering Reports</p>
                      <p className="text-sm font-semibold text-cyan-400 mt-0.5">{driverReports.length} Generated</p>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-slate-800/60">
                  <Link
                    href={`/race-engineer/telemetry?driver=${driver.fastf1_code}`}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500/15 px-4 py-2.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 transition-colors ring-1 ring-cyan-500/30"
                  >
                    Inspect Telemetry <ArrowRight size={14} />
                  </Link>

                  <Link
                    href="/race-engineer/reports"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    View Reports
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
