"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Flag,
  Globe,
  MapPin,
  RefreshCw,
  Trophy,
} from "lucide-react";
import axiosInstance from "@/lib/axios";
import { getCountryIsoCode } from "@/lib/flags";
import { CountryFlag } from "@/components/team-manager/CountryFlag";
import { FastF1LoadingSkeleton } from "@/components/race-engineer/FastF1LoadingSkeleton";

interface DriverSessionItem {
  round_number: number;
  country: string;
  location: string;
  event_name: string;
  official_event_name?: string;
  event_date?: string;
  session_type: string;
  position?: number;
  position_text?: string;
  points?: number;
  status?: string;
}

interface DriverSessionHistoryResponse {
  season: number;
  available_seasons: number[];
  driver_code: string;
  driver_name: string;
  sessions: DriverSessionItem[];
}

export default function DriverSessionsPage() {
  const [selectedSeason, setSelectedSeason] = useState<number | undefined>(undefined);

  const { data, isLoading, isError, error, refetch } = useQuery<DriverSessionHistoryResponse>({
    queryKey: ["driverSessions", selectedSeason],
    queryFn: async () => {
      const res = await axiosInstance.get("/api/v1/driver/sessions", {
        params: selectedSeason ? { season: selectedSeason } : {},
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const activeSeason = data?.season || selectedSeason || new Date().getFullYear();
  const availableSeasons = data?.available_seasons || [2023, 2024, 2025, 2026];
  const sessions = data?.sessions || [];

  const completedSessions = sessions.filter((s) => s.position !== null && s.position !== undefined);

  if (isLoading) {
    return (
      <FastF1LoadingSkeleton
        title="Loading Driver Session History"
        message="Connecting to shared FastF1 telemetry service layer for season schedule and personal race classifications..."
      />
    );
  }

  if (isError) {
    return (
      <div className="border border-red-500/30 bg-red-950/20 p-8 text-center text-red-400 border-l-2 border-l-red-500 font-sans">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <h3 className="text-base font-bold">Failed to load session history</h3>
        <p className="text-xs mt-1 text-red-300/80 mb-4 font-mono">
          {error instanceof Error ? error.message : "Unable to fetch season sessions from FastF1."}
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

  return (
    <div className="space-y-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-ferrari-red">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <Activity className="text-ferrari-red" size={22} /> Personal session history
            </h1>
            <span className="border border-ferrari-red/40 bg-ferrari-red/10 px-2.5 py-0.5 text-xs font-mono text-ferrari-red">
              Season {activeSeason}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Scoped race classification history and points finish log for driver {data?.driver_name} ({data?.driver_code}).
          </p>
        </div>

        {/* Dynamic Season Selector Tabs (Calendar year-tab UI pattern) */}
        <div className="flex items-center bg-slate-950 border border-slate-800 p-1">
          {availableSeasons.map((year) => (
            <button
              key={year}
              onClick={() => setSelectedSeason(year)}
              className={`px-3 py-1 text-xs font-mono font-semibold transition-colors ${
                activeSeason === year
                  ? "bg-ferrari-red text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-cyan-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Total season events</p>
            <p className="text-3xl font-bold font-mono tabular-nums text-slate-100 mt-1">{sessions.length}</p>
          </div>
          <div className="p-2.5 border border-slate-800 bg-slate-900 text-cyan-400">
            <Globe size={20} />
          </div>
        </div>

        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-emerald-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Classified finishes</p>
            <p className="text-3xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
              {completedSessions.length}
            </p>
          </div>
          <div className="p-2.5 border border-slate-800 bg-slate-900 text-emerald-400">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-amber flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Driver code</p>
            <p className="text-2xl font-bold font-mono text-amber mt-1">{data?.driver_code || "—"}</p>
          </div>
          <div className="p-2.5 border border-slate-800 bg-slate-900 text-amber">
            <Trophy size={20} />
          </div>
        </div>
      </div>

      {/* Session History List */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <Flag size={16} className="text-ferrari-red" /> Season {activeSeason} race log
        </h2>

        {sessions.length === 0 ? (
          <div className="border border-slate-800 bg-slate-surface p-12 text-center text-xs font-mono text-slate-400">
            No session history recorded for season {activeSeason}.
          </div>
        ) : (
          <div className="border border-slate-800 bg-slate-surface overflow-hidden border-l-2 border-l-slate-700">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-mono text-xs border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-medium">Round</th>
                    <th className="py-3 px-4 font-medium">Circuit & Grand Prix</th>
                    <th className="py-3 px-4 font-medium">Event date</th>
                    <th className="py-3 px-4 font-medium">Session</th>
                    <th className="py-3 px-4 font-medium">Finishing position</th>
                    <th className="py-3 px-4 font-medium">Points</th>
                    <th className="py-3 px-4 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {sessions.map((sess) => {
                    const isoCode = getCountryIsoCode(sess.country, sess.location);
                    const eventDateFormatted = sess.event_date
                      ? new Date(sess.event_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "TBD";

                    const pos = sess.position;
                    const posBadgeClass =
                      pos === 1
                        ? "bg-amber text-slate-950 font-extrabold"
                        : pos === 2
                        ? "bg-slate-300 text-slate-950 font-bold"
                        : pos === 3
                        ? "bg-amber-700 text-amber-100 font-bold"
                        : pos && pos <= 10
                        ? "bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold"
                        : "bg-slate-900 border border-slate-800 text-slate-400";

                    return (
                      <tr key={`round_${sess.round_number}`} className="hover:bg-slate-900/60 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-300">
                          R{sess.round_number}
                        </td>
                        <td className="py-3.5 px-4 font-sans">
                          <div className="flex items-center gap-2">
                            <CountryFlag
                              country={sess.country}
                              location={sess.location}
                              className="w-5 h-3.5 border border-slate-700 overflow-hidden shrink-0 inline-block"
                            />
                            <div>
                              <p className="font-bold text-slate-100">{sess.event_name}</p>
                              <p className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                                <MapPin size={10} className="text-slate-500" /> {sess.location}, {sess.country}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 tabular-nums">
                          {eventDateFormatted}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="sharp-tag border border-slate-700 bg-slate-900 text-slate-300 font-mono text-[10px]">
                            {sess.session_type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {pos !== null && pos !== undefined ? (
                            <span className={`inline-flex items-center justify-center px-2.5 py-1 text-xs font-mono ${posBadgeClass}`}>
                              {sess.position_text || `P${pos}`}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-cyan-400 font-bold tabular-nums">
                          {sess.points !== null && sess.points !== undefined ? `${sess.points} pts` : "0 pts"}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-400">
                          {sess.status || "Classified"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
