"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Compass,
  FileText,
  History,
  Shield,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import axiosInstance from "@/lib/axios";
import { FastF1LoadingSkeleton } from "@/components/race-engineer/FastF1LoadingSkeleton";

interface StrategyDashboardData {
  team_id: string;
  team_name: string;
  active_drivers: Array<{
    driver_id: string;
    driver_number: number;
    fastf1_code: string;
    full_name: string;
  }>;
  recent_strategies: Array<{
    id: string;
    session_id: string;
    creator_name: string;
    title?: string;
    driver_code?: string;
    plan: any[];
    created_at: string;
  }>;
  recent_reports: Array<{
    report_id: string;
    generator_name: string;
    created_at: string;
    data: any;
  }>;
  available_seasons: number[];
  quick_links: Array<{ title: string; url: string }>;
}

async function fetchStrategyDashboard(): Promise<StrategyDashboardData> {
  const res = await axiosInstance.get("/api/v1/strategy-engineer/dashboard");
  return res.data;
}

export default function StrategyEngineerDashboardPage() {
  const { data, isLoading, isError } = useQuery<StrategyDashboardData>({
    queryKey: ["strategyEngineerDashboard"],
    queryFn: fetchStrategyDashboard,
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return <FastF1LoadingSkeleton title="Loading Strategy Console" message="Initializing race strategy decision model..." />;
  }

  if (isError || !data) {
    return (
      <div className="border border-red-900/40 bg-red-950/20 p-6 border-l-2 border-l-red-500 font-mono text-xs text-red-300">
        Failed to load strategy dashboard telemetry. Please check session permissions or network connection.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Top Header Banner ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-purple-400">
        <div>
          <div className="flex items-center gap-2 mb-1.5 font-mono">
            <span className="sharp-tag bg-purple-500/10 text-purple-300 border border-purple-500/30">
              <Compass size={12} className="text-purple-400 mr-1" /> Strategy Engineer Console
            </span>
            <span className="text-xs text-slate-400">• {data.team_name}</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">Race strategy dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic stint degradation trend models, pit stop window recommendations, and race strategy authoring.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-purple-400 bg-purple-950/30 border border-purple-800/40 px-3 py-1.5">
          <Shield size={13} className="text-purple-400" />
          <span>RBAC: Strategy-only scope</span>
        </div>
      </div>

      {/* ── Driver Cards Grid ── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 font-mono">
          Team active drivers
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.active_drivers.map((drv) => (
            <div
              key={drv.driver_id}
              className="border border-slate-800 bg-slate-surface p-4 border-l-2 border-l-slate-700 hover:border-purple-500/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center border border-purple-500/30 bg-purple-500/10 text-purple-400 font-mono font-bold text-sm">
                    #{drv.driver_number || "—"}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100 font-sans">{drv.full_name}</h3>
                    <p className="text-xs text-purple-400 font-mono">CODE: {drv.fastf1_code}</p>
                  </div>
                </div>
                <Link
                  href={`/strategy-engineer/tire-analysis?driver=${drv.fastf1_code}`}
                  className="sharp-tag border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[11px] font-mono text-purple-300 hover:bg-purple-400 hover:text-slate-950 transition-colors"
                >
                  Analyze tires
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick Action Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link
          href="/strategy-engineer/tire-analysis"
          className="group border border-slate-800 bg-slate-surface p-4 border-l-2 border-l-purple-500 hover:border-purple-400 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <Activity size={18} className="text-purple-400" />
            <ArrowRight size={14} className="text-slate-500 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-xs font-semibold text-slate-100 font-sans">Tire degradation</h3>
          <p className="text-[11px] text-slate-400 mt-1">Linear trend fit per stint excluding SC/VSC caution laps.</p>
        </Link>

        <Link
          href="/strategy-engineer/strategies"
          className="group border border-slate-800 bg-slate-surface p-4 border-l-2 border-l-cyan-500 hover:border-cyan-400 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <Target size={18} className="text-cyan-400" />
            <ArrowRight size={14} className="text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-xs font-semibold text-slate-100 font-sans">Race strategies</h3>
          <p className="text-[11px] text-slate-400 mt-1">Compose stint plans and pit stop target windows.</p>
        </Link>

        <Link
          href="/strategy-engineer/historical"
          className="group border border-slate-800 bg-slate-surface p-4 border-l-2 border-l-emerald-500 hover:border-emerald-400 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <History size={18} className="text-emerald-400" />
            <ArrowRight size={14} className="text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-xs font-semibold text-slate-100 font-sans">Historical review</h3>
          <p className="text-[11px] text-slate-400 mt-1">Cross-season compound degradation review by circuit.</p>
        </Link>

        <Link
          href="/strategy-engineer/reports"
          className="group border border-slate-800 bg-slate-surface p-4 border-l-2 border-l-amber-500 hover:border-amber-400 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <FileText size={18} className="text-amber-400" />
            <ArrowRight size={14} className="text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-xs font-semibold text-slate-100 font-sans">Strategy reports</h3>
          <p className="text-[11px] text-slate-400 mt-1">Archived strategy decision summaries and notifications.</p>
        </Link>
      </div>

      {/* ── Two Column Layout: Recent Strategies & Recent Reports ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Strategies */}
        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-cyan-400 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-slate-100 font-sans flex items-center gap-2">
              <Target size={15} className="text-cyan-400" /> Recent race strategy plans
            </h3>
            <Link href="/strategy-engineer/strategies" className="text-xs font-mono text-cyan-400 hover:underline">
              View all →
            </Link>
          </div>

          {data.recent_strategies.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center font-mono">No authored strategy plans found yet.</p>
          ) : (
            <div className="space-y-2.5">
              {data.recent_strategies.map((strat) => (
                <div key={strat.id} className="bg-slate-950 p-3.5 border border-slate-800 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100">{strat.title || strat.session_id}</span>
                    <span className="sharp-tag bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                      {strat.driver_code || "DRIVER"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 mt-2 text-[11px]">
                    <span>Authored by: {strat.creator_name}</span>
                    <span>{new Date(strat.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Reports */}
        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-amber-400 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-slate-100 font-sans flex items-center gap-2">
              <FileText size={15} className="text-amber-400" /> Recent strategy reports
            </h3>
            <Link href="/strategy-engineer/reports" className="text-xs font-mono text-amber-400 hover:underline">
              View all →
            </Link>
          </div>

          {data.recent_reports.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center font-mono">No strategy reports generated yet.</p>
          ) : (
            <div className="space-y-2.5">
              {data.recent_reports.map((rep) => (
                <div key={rep.report_id} className="bg-slate-950 p-3.5 border border-slate-800 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-300">#{rep.report_id.slice(0, 8)}</span>
                    <span className="text-slate-300">{rep.data?.session_id || "Strategy Report"}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                    {rep.data?.key_findings || rep.data?.tire_degradation_summary || "Strategy analysis snapshot"}
                  </p>
                  <div className="flex items-center justify-between text-slate-400 mt-2 text-[11px]">
                    <span>By: {rep.generator_name}</span>
                    <span>{new Date(rep.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
