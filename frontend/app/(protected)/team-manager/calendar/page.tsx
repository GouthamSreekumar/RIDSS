"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
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

interface CalendarDriverResult {
  driver_code: string;
  driver_number: number;
  full_name?: string;
  position?: number;
  position_text?: string;
  points?: number;
  status?: string;
}

interface RaceCalendarEvent {
  round_number: number;
  country: string;
  location: string;
  event_name: string;
  official_event_name?: string;
  event_date?: string;
  format?: string;
  is_completed: boolean;
  driver_results: CalendarDriverResult[];
}

interface TeamManagerCalendarResponse {
  season: number;
  available_seasons: number[];
  team_name: string;
  events: RaceCalendarEvent[];
}

export default function TeamManagerCalendarPage() {
  const [selectedSeason, setSelectedSeason] = useState<number | undefined>(undefined);

  const { data, isLoading, isError, error, refetch } = useQuery<TeamManagerCalendarResponse>({
    queryKey: ["teamManagerCalendar", selectedSeason],
    queryFn: async () => {
      const res = await axiosInstance.get("/api/v1/team-manager/calendar", {
        params: selectedSeason ? { season: selectedSeason } : {},
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const activeSeason = data?.season || selectedSeason || new Date().getFullYear();
  const availableSeasons = data?.available_seasons || [2023, 2024, 2025, 2026];
  const events = data?.events || [];

  const completedCount = events.filter((e) => e.is_completed).length;
  const upcomingCount = events.length - completedCount;

  if (isLoading) {
    return (
      <FastF1LoadingSkeleton
        title="Loading season race calendar"
        message="Connecting to shared FastF1 telemetry service layer for schedule and session results…"
      />
    );
  }

  if (isError) {
    return (
      <div className="border border-red-500/30 bg-red-950/20 p-8 text-center text-red-400 border-l-2 border-l-red-500">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <h3 className="text-base font-bold">Failed to load race calendar</h3>
        <p className="text-xs mt-1 text-red-300/80 mb-4 font-mono">
          {error instanceof Error ? error.message : "Unable to fetch season event schedule from FastF1."}
        </p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-mono font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <RefreshCw size={13} /> Retry FastF1 fetch
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
              <CalendarIcon className="text-ferrari-red" size={22} /> {data?.team_name || "Team"} race calendar
            </h1>
            <span className="border border-ferrari-red/40 bg-ferrari-red/10 px-2.5 py-0.5 text-xs font-mono text-ferrari-red">
              Season {activeSeason}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Full-season Formula 1 schedule and filtered own-team driver race results.
          </p>
        </div>

        {/* Dynamic Season Selector Tabs */}
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

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-cyan-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Total season events</p>
            <p className="text-3xl font-bold font-mono tabular-nums text-slate-100 mt-1">{events.length}</p>
          </div>
          <div className="p-2.5 border border-slate-800 bg-slate-900 text-cyan-400">
            <Globe size={20} />
          </div>
        </div>

        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-emerald-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Completed races</p>
            <p className="text-3xl font-bold font-mono tabular-nums text-emerald-400 mt-1">{completedCount}</p>
          </div>
          <div className="p-2.5 border border-slate-800 bg-slate-900 text-emerald-400">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-amber flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Upcoming races</p>
            <p className="text-3xl font-bold font-mono tabular-nums text-amber mt-1">{upcomingCount}</p>
          </div>
          <div className="p-2.5 border border-slate-800 bg-slate-900 text-amber">
            <Clock size={20} />
          </div>
        </div>
      </div>

      {/* Race Events Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <Flag size={16} className="text-ferrari-red" /> Season {activeSeason} race schedule & results
        </h2>

        {events.length === 0 ? (
          <div className="border border-slate-800 bg-slate-surface p-12 text-center text-xs font-mono text-slate-400">
            No race schedule data available for season {activeSeason}.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((ev) => {
              const isoCode = getCountryIsoCode(ev.country, ev.location);
              const eventDateFormatted = ev.event_date
                ? new Date(ev.event_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "TBD";

              return (
                <div
                  key={`round_${ev.round_number}_${ev.event_name}`}
                  className={`border flex flex-col justify-between transition-colors ${
                    ev.is_completed
                      ? "border-slate-800 bg-slate-surface border-l-2 border-l-emerald-500"
                      : "border-slate-800/70 bg-slate-950/40 border-l-2 border-l-slate-700 opacity-80"
                  }`}
                >
                  <div className="p-4 space-y-3">
                    {/* Top Row: Round Badge + Country Flag Graphic + ISO Code + Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs font-mono font-bold text-slate-300">
                          R{ev.round_number}
                        </span>
                        <CountryFlag
                          country={ev.country}
                          location={ev.location}
                          className="w-7 h-4.5 border border-slate-700/80 overflow-hidden shrink-0 inline-block align-middle"
                        />
                        {isoCode && (
                          <span className="text-xs font-mono font-semibold text-slate-400">
                            {isoCode}
                          </span>
                        )}
                      </div>

                      {ev.is_completed ? (
                        <span className="border border-emerald-500/40 bg-emerald-950/40 px-2 py-0.5 text-[11px] font-mono font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={11} /> Completed
                        </span>
                      ) : (
                        <span className="border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] font-mono text-slate-400 flex items-center gap-1">
                          <Clock size={11} /> Upcoming
                        </span>
                      )}
                    </div>

                    {/* Event Title & Location */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-100 truncate" title={ev.event_name}>
                        {ev.event_name}
                      </h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin size={12} className="text-slate-500 shrink-0" />
                        {ev.location}, {ev.country}
                      </p>
                    </div>

                    {/* Date Row */}
                    <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 bg-slate-950 px-2.5 py-1 border border-slate-800">
                      <CalendarIcon size={12} className="text-cyan-500" />
                      <span>{eventDateFormatted}</span>
                    </div>

                    {/* Team Driver Results (Completed Races Only) */}
                    {ev.is_completed && (
                      <div className="pt-3 border-t border-slate-800/80 space-y-2">
                        <p className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                          <Trophy size={12} className="text-amber" /> Team driver results
                        </p>

                        {ev.driver_results.length === 0 ? (
                          <p className="text-xs font-mono text-slate-500 italic">No team drivers in classified results.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {ev.driver_results.map((res) => {
                              const pos = res.position;
                              const posBadgeClass =
                                pos === 1
                                  ? "bg-amber text-slate-950 font-extrabold"
                                  : pos === 2
                                  ? "bg-slate-300 text-slate-950 font-bold"
                                  : pos === 3
                                  ? "bg-amber-700 text-amber-100 font-bold"
                                  : "bg-slate-800 text-slate-300";

                              return (
                                <div
                                  key={res.driver_code}
                                  className="flex items-center justify-between bg-slate-950 p-2 border border-slate-800 text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`w-6 h-5 flex items-center justify-center text-[10px] font-mono ${posBadgeClass}`}>
                                      {res.position_text || (res.position ? `P${res.position}` : "—")}
                                    </span>
                                    <div>
                                      <p className="font-bold text-slate-100 font-mono">
                                        Driver {res.driver_code} <span className="text-slate-500 font-normal">#{res.driver_number}</span>
                                      </p>
                                      <p className="text-[10px] text-slate-400 font-mono">{res.status || "Classified"}</p>
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    <span className="font-bold font-mono text-cyan-400">{res.points ?? 0}</span>
                                    <span className="text-[10px] text-slate-500 ml-1 font-mono">pts</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
