"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  Bell,
  Calendar as CalendarIcon,
  ChevronRight,
  FileText,
  Flag,
  Gauge,
  RefreshCw,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import axiosInstance from "@/lib/axios";
import { FastF1LoadingSkeleton } from "@/components/race-engineer/FastF1LoadingSkeleton";

interface NotificationItem {
  notification_id: string;
  user_id: string;
  title: string;
  message: string;
  status: string;
  reference_type?: string;
  reference_id?: string;
  created_at: string;
}

interface ReportItem {
  report_id: string;
  team_id?: string;
  generated_by: string;
  generator_name: string;
  report_type: string;
  created_at: string;
  data: {
    session_id?: string;
    driver_code?: string;
    driver_name?: string;
    key_findings?: string;
    stint_degradation_trend?: string;
    summary_stats?: Record<string, any>;
  };
}

interface DriverDashboardResponse {
  driver_id: string;
  user_id: string;
  driver_name: string;
  fastf1_code?: string;
  driver_number: number;
  nationality?: string;
  current_season_points: number;
  last_race_position?: number;
  last_race_position_text?: string;
  last_session_date?: string;
  recent_notifications: NotificationItem[];
  recent_reports: ReportItem[];
}

export default function DriverDashboardPage() {
  const { data, isLoading, isError, error, refetch } = useQuery<DriverDashboardResponse>({
    queryKey: ["driverDashboard"],
    queryFn: async () => {
      const res = await axiosInstance.get("/api/v1/driver/dashboard");
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <FastF1LoadingSkeleton
        title="Loading Driver Cockpit"
        message="Gathering season point totals, recent race results, and driver performance alerts..."
      />
    );
  }

  if (isError) {
    return (
      <div className="border border-red-500/30 bg-red-950/20 p-8 text-center text-red-400 border-l-2 border-l-red-500 font-sans">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <h3 className="text-base font-bold">Failed to load driver dashboard</h3>
        <p className="text-xs mt-1 text-red-300/80 mb-4 font-mono">
          {error instanceof Error ? error.message : "Unable to fetch driver dashboard summary."}
        </p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-mono font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <RefreshCw size={13} /> Retry loading
        </button>
      </div>
    );
  }

  const lastPosText = data?.last_race_position_text || (data?.last_race_position ? `P${data.last_race_position}` : "—");
  const lastSessionDateFormatted = data?.last_session_date
    ? new Date(data.last_session_date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-cyan-400">
        <div>
          <div className="flex items-center gap-2 mb-1.5 font-mono">
            <span className="sharp-tag bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              <Gauge size={12} className="text-cyan-400 mr-1" /> Personal telemetry cockpit
            </span>
            {data?.fastf1_code && (
              <span className="text-xs text-slate-400">
                • Driver code <strong className="text-slate-200 font-mono">#{data.driver_number} ({data.fastf1_code})</strong>
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Welcome back, {data?.driver_name || "Driver"}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Season performance stats, race engineering reports, and team assignments.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <Link
            href="/driver/reports"
            className="sharp-tag border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-400 hover:text-slate-950 transition-colors"
          >
            View reports <ChevronRight size={13} />
          </Link>
        </div>
      </div>

      {/* Basic Personal Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Season Points Card */}
        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-amber flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Current season points</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-bold font-mono tabular-nums text-amber">
                {data?.current_season_points ?? 0}
              </span>
              <span className="text-xs font-mono text-slate-500">PTS</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-1">Summed from session results</p>
          </div>
          <div className="p-3 border border-slate-800 bg-slate-900 text-amber">
            <Trophy size={22} />
          </div>
        </div>

        {/* Most Recent Finish Position Card */}
        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-cyan-400 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Last race finish position</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-bold font-mono tabular-nums text-cyan-400">
                {lastPosText}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-1">Official race classification</p>
          </div>
          <div className="p-3 border border-slate-800 bg-slate-900 text-cyan-400">
            <Flag size={22} />
          </div>
        </div>

        {/* Most Recent Session Date Card */}
        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-emerald-400 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Most recent session date</p>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-2 truncate">
              {lastSessionDateFormatted}
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-1">Latest calendar event</p>
          </div>
          <div className="p-3 border border-slate-800 bg-slate-900 text-emerald-400">
            <CalendarIcon size={22} />
          </div>
        </div>
      </div>

      {/* Grid Section: Recent Reports & Recent Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Reports Preview */}
        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-cyan-400 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-cyan-400" />
              <h2 className="text-sm font-bold text-slate-100">Recent performance reports</h2>
            </div>
            <Link
              href="/driver/reports"
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              View all <ChevronRight size={12} />
            </Link>
          </div>

          {(data?.recent_reports || []).length === 0 ? (
            <div className="py-8 text-center border border-slate-800/80 bg-slate-950 p-4 text-xs font-mono text-slate-500">
              No performance reports generated for your run yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {(data?.recent_reports || []).map((report) => (
                <Link
                  key={report.report_id}
                  href={`/driver/reports?id=${report.report_id}`}
                  className="block border border-slate-800 bg-slate-950 p-3.5 hover:bg-slate-900/80 hover:border-slate-700 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="sharp-tag bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono text-[10px]">
                      #{report.report_id.slice(0, 8)}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                      {new Date(report.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-200 mt-2 group-hover:text-cyan-300 transition-colors">
                    {report.data?.session_id || "Engineering report"}
                  </h3>
                  <p className="text-[11px] text-slate-400 line-clamp-1 mt-1 font-mono">
                    {report.data?.key_findings || "Stint degradation analysis summary available."}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Notifications Preview */}
        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-amber space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-amber" />
              <h2 className="text-sm font-bold text-slate-100">Recent notifications</h2>
            </div>
            <Link
              href="/driver/notifications"
              className="text-xs font-mono text-amber hover:text-amber-300 flex items-center gap-1"
            >
              View all <ChevronRight size={12} />
            </Link>
          </div>

          {(data?.recent_notifications || []).length === 0 ? (
            <div className="py-8 text-center border border-slate-800/80 bg-slate-950 p-4 text-xs font-mono text-slate-500">
              No notifications delivered to your cockpit.
            </div>
          ) : (
            <div className="space-y-2.5">
              {(data?.recent_notifications || []).map((notif) => {
                const isUnread = notif.status === "unread";
                return (
                  <Link
                    key={notif.notification_id}
                    href="/driver/notifications"
                    className={`block border p-3.5 transition-colors ${
                      isUnread
                        ? "border-amber/50 bg-amber/5 border-l-2 border-l-amber"
                        : "border-slate-800 bg-slate-950 hover:bg-slate-900/80"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-mono font-bold ${isUnread ? "text-amber" : "text-slate-400"}`}>
                        {isUnread ? "Unread alert" : "Read"}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                        {new Date(notif.created_at).toLocaleDateString()}{" "}
                        {new Date(notif.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-100 mt-1.5">{notif.title}</h3>
                    <p className="text-[11px] text-slate-300 line-clamp-1 mt-1 font-mono">{notif.message}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
