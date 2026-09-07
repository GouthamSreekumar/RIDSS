"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  Flame,
  Gauge,
  Layers,
  Radio,
  Search,
  Zap,
} from "lucide-react";
import Link from "next/link";
import axiosInstance from "@/lib/axios";
import { FastF1LoadingSkeleton } from "@/components/race-engineer/FastF1LoadingSkeleton";

interface LapSummary {
  lap_number: number;
  driver_code: string;
  driver_number: number;
  lap_time_seconds?: number;
  lap_time_str?: string;
  sector_1_seconds?: number;
  sector_2_seconds?: number;
  sector_3_seconds?: number;
  stint?: number;
  compound?: string;
  tyre_life?: number;
  pit_in_time_str?: string;
  pit_out_time_str?: string;
  track_status?: string;
  is_personal_best: boolean;
  speed_st?: number;
  speed_fl?: number;
}

interface SessionOverview {
  session_id: string;
  season: number;
  circuit_name: string;
  session_name: string;
  total_laps: number;
  driver_lap_summaries: Record<string, LapSummary[]>;
}

interface CircuitSummary {
  circuit_id: string;
  circuit_name: string;
  country: string;
  length: number;
  round_number?: number;
  has_geometry: boolean;
}

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "bg-red-500 text-red-100 border-red-500/30",
  MEDIUM: "bg-amber-400 text-amber-950 border-amber-400/30",
  HARD: "bg-slate-200 text-slate-900 border-slate-300/30",
  INTERMEDIATE: "bg-emerald-500 text-emerald-100 border-emerald-500/30",
  WET: "bg-blue-500 text-blue-100 border-blue-500/30",
};

export default function TelemetryOverviewPage() {
  const [season, setSeason] = useState<number>(2024);
  const [circuit, setCircuit] = useState<string>("Bahrain");
  const [sessionType, setSessionType] = useState<string>("Race");
  const [selectedDriver, setSelectedDriver] = useState<string>("");

  // Fetch Season Circuits dynamically from FastF1 backend
  const { data: dynamicCircuits = [] } = useQuery<CircuitSummary[]>({
    queryKey: ["seasonCircuits", season],
    queryFn: async () => {
      const res = await axiosInstance.get("/api/v1/race-engineer/circuits", {
        params: { season },
      });
      return res.data;
    },
    staleTime: 10 * 60 * 1000,
  });

  // Fetch Session Overview (Tier 1)
  const { data: overview, isLoading, isError, error, refetch } = useQuery<SessionOverview>({
    queryKey: ["sessionOverview", season, circuit, sessionType],
    queryFn: async () => {
      const res = await axiosInstance.get("/api/v1/race-engineer/overview", {
        params: { season, circuit, session_type: sessionType },
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const availableDrivers = overview ? Object.keys(overview.driver_lap_summaries) : [];
  const currentDriverCode =
    selectedDriver && availableDrivers.includes(selectedDriver)
      ? selectedDriver
      : availableDrivers.length > 0
      ? availableDrivers[0]
      : "VER";
  const currentDriverLaps = overview?.driver_lap_summaries[currentDriverCode] || [];

  // Compute best lap time for current driver
  const validLaps = currentDriverLaps.filter((l) => l.lap_time_seconds && l.lap_time_seconds > 0);
  const fastestLap = validLaps.length > 0
    ? validLaps.reduce((prev, curr) => (curr.lap_time_seconds! < prev.lap_time_seconds! ? curr : prev))
    : null;

  return (
    <div className="space-y-8">
      {/* ── Page Header & Selection Controls ── */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 px-3 py-0.5 text-xs font-semibold text-cyan-300 ring-1 ring-cyan-500/30">
                <Gauge size={12} className="text-cyan-400" /> Tier 1 Session Overview
              </span>
              <span className="text-xs text-slate-400">• Own-Team Server Filtered</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">Telemetry Selection & Lap Analysis</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Select season and circuit parameters to review lap timing, stint degradation, and sector speed trap data.
            </p>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-800/60">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Season</label>
            <select
              value={season}
              onChange={(e) => setSeason(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
              <option value={2024}>2024</option>
              <option value={2023}>2023</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Circuit</label>
            <select
              value={circuit}
              onChange={(e) => setCircuit(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none font-medium"
            >
              {dynamicCircuits.length > 0 ? (
                dynamicCircuits.map((c, idx) => (
                  <option key={`${c.circuit_id}_${idx}`} value={c.circuit_name}>
                    {c.round_number ? `R${c.round_number}: ` : ""}{c.circuit_name} ({c.country})
                  </option>
                ))
              ) : (
                <>
                  <option value="Bahrain">Bahrain International Circuit</option>
                  <option value="Jeddah">Jeddah Corniche Circuit</option>
                  <option value="Melbourne">Albert Park Circuit (Melbourne)</option>
                  <option value="Suzuka">Suzuka International Racing Course</option>
                  <option value="Shanghai">Shanghai International Circuit</option>
                  <option value="Miami">Miami International Autodrome</option>
                  <option value="Monaco">Circuit de Monaco</option>
                  <option value="Silverstone">Silverstone Circuit</option>
                  <option value="Monza">Autodromo Nazionale Monza</option>
                  <option value="Spa">Circuit de Spa-Francorchamps</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Session</label>
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              <option value="Race">Race</option>
              <option value="Qualifying">Qualifying</option>
              <option value="FP1">Practice 1</option>
              <option value="FP2">Practice 2</option>
              <option value="FP3">Practice 3</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Team Driver</label>
            <select
              value={currentDriverCode}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none font-bold"
            >
              {availableDrivers.length === 0 ? (
                <option value="VER">VER (Max Verstappen)</option>
              ) : (
                availableDrivers.map((dCode) => (
                  <option key={dCode} value={dCode}>
                    Driver {dCode}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <FastF1LoadingSkeleton
          title={`Fetching FastF1 Data for ${season} ${circuit} ${sessionType}`}
          message="Loading lap telemetry summaries and stint records..."
        />
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400">
          <h3 className="text-lg font-bold">Telemetry Data Unavailable</h3>
          <p className="text-sm mt-1 text-red-300/80">
            {error instanceof Error ? error.message : "Failed to load session overview from FastF1."}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 rounded-lg bg-red-500/20 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/30"
          >
            Retry Fetch
          </button>
        </div>
      )}

      {/* Overview Content */}
      {overview && !isLoading && (
        <>
          {/* Driver Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
              <p className="text-xs text-slate-400 font-medium">Selected Driver</p>
              <p className="text-xl font-bold text-cyan-400 mt-1 flex items-center gap-2">
                <span className="font-mono">{currentDriverCode}</span>
                <span className="text-xs text-slate-400 font-normal">({currentDriverLaps.length} laps)</span>
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
              <p className="text-xs text-slate-400 font-medium">Personal Best Lap</p>
              <p className="text-xl font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                <Flame size={18} className="text-emerald-400" />
                {fastestLap?.lap_time_str || "N/A"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
              <p className="text-xs text-slate-400 font-medium">Max Speed Trap</p>
              <p className="text-xl font-bold text-amber-400 mt-1 flex items-center gap-1.5">
                <Zap size={18} className="text-amber-400" />
                {Math.max(...currentDriverLaps.map((l) => l.speed_st || 0), 0)} km/h
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
              <p className="text-xs text-slate-400 font-medium">Stint Count</p>
              <p className="text-xl font-bold text-slate-200 mt-1 flex items-center gap-1.5">
                <Layers size={18} className="text-slate-400" />
                {new Set(currentDriverLaps.map((l) => l.stint).filter(Boolean)).size || 1} Stint(s)
              </p>
            </div>
          </div>

          {/* Static Lap-Time / Stint Chart Visualization */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Activity size={18} className="text-cyan-400" /> Lap Time & Tyre Compound Distribution
              </h2>
              <span className="text-xs text-slate-400 font-mono">Static Overview (Click any lap below to drill down)</span>
            </div>

            {/* Color & Highlight Legend Index */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-slate-950/60 p-3 border border-slate-800/60 text-xs">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Tyre Legend:</span>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-500 ring-1 ring-red-400/50" />
                <span className="text-slate-300 font-medium">Soft (Red)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-amber-400 ring-1 ring-amber-300/50" />
                <span className="text-slate-300 font-medium">Medium (Yellow)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-slate-200 ring-1 ring-slate-100/50" />
                <span className="text-slate-300 font-medium">Hard (White/Grey)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-emerald-500 ring-1 ring-emerald-400/50" />
                <span className="text-slate-300 font-medium">Intermediate (Green)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-blue-500 ring-1 ring-blue-400/50" />
                <span className="text-slate-300 font-medium">Wet (Blue)</span>
              </div>
              <div className="flex items-center gap-1.5 sm:ml-auto border-t sm:border-t-0 sm:border-l border-slate-800 pt-2 sm:pt-0 sm:pl-3">
                <span className="h-3.5 w-3.5 rounded-sm border-2 border-emerald-400 bg-emerald-500/20" />
                <span className="text-emerald-300 font-semibold">Green Border = Fastest / Personal Best Lap</span>
              </div>
            </div>

            {/* Rendered SVG Bar/Scatter Chart */}
            <div className="relative h-64 w-full rounded-lg bg-slate-950/80 border border-slate-800/80 p-4">
              {validLaps.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  No timed lap data available for this driver.
                </div>
              ) : (
                <div className="flex h-full items-end gap-1 overflow-x-auto pb-4 pt-2">
                  {currentDriverLaps.map((lap) => {
                    const isFastest = fastestLap && lap.lap_number === fastestLap.lap_number;
                    const compound = (lap.compound || "UNKNOWN").toUpperCase();
                    const barColor = compound.includes("SOFT")
                      ? "bg-red-500"
                      : compound.includes("MEDIUM")
                      ? "bg-amber-400"
                      : compound.includes("HARD")
                      ? "bg-slate-200"
                      : "bg-cyan-500";

                    const timeSec = lap.lap_time_seconds || 100;
                    const minTime = fastestLap?.lap_time_seconds || 80;
                    const heightPct = Math.max(15, Math.min(100, 100 - (timeSec - minTime) * 8));

                    return (
                      <Link
                        key={lap.lap_number}
                        href={`/race-engineer/telemetry/${season}_${circuit.toLowerCase()}_${sessionType.toLowerCase()}/${currentDriverCode}/${lap.lap_number}`}
                        className="group flex flex-col items-center flex-1 min-w-[14px] h-full justify-end"
                        title={`Lap ${lap.lap_number}: ${lap.lap_time_str || "N/A"} (${lap.compound || "Tyre"})`}
                      >
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full rounded-t-sm transition-all duration-150 group-hover:opacity-100 ${barColor} ${
                            isFastest ? "ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-950 opacity-100" : "opacity-75"
                          }`}
                        />
                        <span className="text-[9px] font-mono text-slate-400 mt-1 group-hover:text-cyan-300">
                          {lap.lap_number}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Lap Breakdown Table (Click to drill down) */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Clock size={18} className="text-cyan-400" /> Driver Lap Breakdown
              </h2>
              <span className="text-xs text-slate-400">Click row to open Tier 2 Telemetry Replay</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Lap</th>
                    <th className="py-3 px-4">Lap Time</th>
                    <th className="py-3 px-4">Sector 1</th>
                    <th className="py-3 px-4">Sector 2</th>
                    <th className="py-3 px-4">Sector 3</th>
                    <th className="py-3 px-4">Compound</th>
                    <th className="py-3 px-4">Tyre Life</th>
                    <th className="py-3 px-4">Speed Trap</th>
                    <th className="py-3 px-4 text-right">Drill-Down Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {currentDriverLaps.map((lap) => {
                    const compoundKey = (lap.compound || "").toUpperCase();
                    const compoundBadgeClass = COMPOUND_COLORS[compoundKey] || "bg-slate-800 text-slate-300 border-slate-700";

                    return (
                      <tr
                        key={lap.lap_number}
                        className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-100 flex items-center gap-1.5">
                          #{lap.lap_number}
                          {lap.is_personal_best && (
                            <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[9px] font-bold text-emerald-300">
                              PB
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-cyan-300">
                          {lap.lap_time_str || "—"}
                        </td>
                        <td className="py-3 px-4 font-mono">{lap.sector_1_seconds ? `${lap.sector_1_seconds}s` : "—"}</td>
                        <td className="py-3 px-4 font-mono">{lap.sector_2_seconds ? `${lap.sector_2_seconds}s` : "—"}</td>
                        <td className="py-3 px-4 font-mono">{lap.sector_3_seconds ? `${lap.sector_3_seconds}s` : "—"}</td>
                        <td className="py-3 px-4">
                          {lap.compound ? (
                            <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold border ${compoundBadgeClass}`}>
                              {lap.compound}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono">{lap.tyre_life ? `${lap.tyre_life} laps` : "—"}</td>
                        <td className="py-3 px-4 font-mono text-amber-400">{lap.speed_st ? `${lap.speed_st} km/h` : "—"}</td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/race-engineer/telemetry/${season}_${circuit.toLowerCase()}_${sessionType.toLowerCase()}/${currentDriverCode}/${lap.lap_number}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-colors ring-1 ring-cyan-500/20"
                          >
                            Replay Telemetry <ExternalLink size={12} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
