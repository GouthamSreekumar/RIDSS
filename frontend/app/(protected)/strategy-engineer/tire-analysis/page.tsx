"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Compass,
  Filter,
  Info,
  Layers,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import axiosInstance from "@/lib/axios";
import { FastF1LoadingSkeleton } from "@/components/race-engineer/FastF1LoadingSkeleton";

interface ExcludedLapDetail {
  lap_number: number;
  reason: string;
}

interface TireDegradationLap {
  lap_number: number;
  tyre_life?: number;
  lap_time_seconds?: number;
  track_status?: string;
  deleted: boolean;
  is_excluded: boolean;
  exclusion_reason?: string;
}

interface StintDegradation {
  stint: number;
  compound: string;
  total_laps: number;
  valid_laps: number;
  excluded_laps_count: number;
  excluded_lap_numbers: ExcludedLapDetail[];
  degradation_rate?: number;
  base_pace?: number;
  laps: TireDegradationLap[];
}

interface TireAnalysisResponse {
  session_id: string;
  season: number;
  circuit_name: string;
  session_type: string;
  driver_code: string;
  stints: StintDegradation[];
}

interface CircuitSummary {
  circuit_id: string;
  circuit_name: string;
  country: string;
  round_number?: number;
}

async function fetchSeasons(): Promise<number[]> {
  const res = await axiosInstance.get("/api/v1/race-engineer/seasons");
  return res.data.seasons;
}

async function fetchCircuits(season: number): Promise<CircuitSummary[]> {
  const res = await axiosInstance.get(`/api/v1/race-engineer/circuits?season=${season}`);
  return res.data;
}

async function fetchTireAnalysis(
  season: number,
  circuit: string,
  sessionType: string,
  driver: string
): Promise<TireAnalysisResponse> {
  const res = await axiosInstance.get(
    `/api/v1/strategy-engineer/tire-analysis?season=${season}&circuit=${encodeURIComponent(
      circuit
    )}&session_type=${sessionType}&driver=${driver}`
  );
  return res.data;
}

const formatDegradationRate = (val?: number | null, decimals = 4): string => {
  if (val === undefined || val === null) return "N/A (<2 laps)";
  const formatted = val.toFixed(decimals);
  return val >= 0 ? `+${formatted} s/lap` : `${formatted} s/lap`;
};

export default function TireAnalysisPage() {
  const [season, setSeason] = useState<number>(2024);
  const [circuit, setCircuit] = useState<string>("Bahrain");
  const [sessionType, setSessionType] = useState<string>("Race");
  const [driver, setDriver] = useState<string>("VER");

  // Fetch Available Seasons
  const { data: seasons } = useQuery<number[]>({
    queryKey: ["seasonsList"],
    queryFn: fetchSeasons,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch Season Circuits
  const { data: circuits } = useQuery<CircuitSummary[]>({
    queryKey: ["seasonCircuits", season],
    queryFn: () => fetchCircuits(season),
    enabled: !!season,
  });

  // Fetch Tire Analysis Data
  const {
    data: analysis,
    isLoading,
    isError,
    refetch,
  } = useQuery<TireAnalysisResponse>({
    queryKey: ["tireAnalysis", season, circuit, sessionType, driver],
    queryFn: () => fetchTireAnalysis(season, circuit, sessionType, driver),
    staleTime: 2 * 60 * 1000,
  });

  const getCompoundColor = (compound: string) => {
    switch (compound.toUpperCase()) {
      case "SOFT":
        return "text-red-400 border-red-500/40 bg-red-950/20";
      case "MEDIUM":
        return "text-amber-400 border-amber-500/40 bg-amber-950/20";
      case "HARD":
        return "text-slate-200 border-slate-400/40 bg-slate-800/40";
      case "INTERMEDIATE":
        return "text-green-400 border-green-500/40 bg-green-950/20";
      case "WET":
        return "text-blue-400 border-blue-500/40 bg-blue-950/20";
      default:
        return "text-purple-400 border-purple-500/40 bg-purple-950/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-purple-400">
        <div>
          <div className="flex items-center gap-2 mb-1.5 font-mono">
            <span className="sharp-tag bg-purple-500/10 text-purple-300 border border-purple-500/30">
              <Activity size={12} className="text-purple-400 mr-1" /> Tire analysis
            </span>
            <span className="text-xs text-slate-400">• OLS Linear Fit & Exclusion Audit</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">
            Stint tire degradation analysis
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Calculates degradation rate (slope: s/lap) and base pace (intercept) per stint. Deleted laps and Safety Car / VSC caution periods are strictly excluded.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="sharp-tag border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-300 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
        >
          <RefreshCw size={12} /> Refresh analysis
        </button>
      </div>

      {/* Season / Circuit / Session / Driver Selector Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border border-slate-800 bg-slate-surface p-4 font-mono text-xs">
        <div>
          <label className="block text-slate-400 mb-1">Season year</label>
          <select
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="w-full border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-purple-400 focus:outline-none"
          >
            {(seasons || [2023, 2024]).map((s) => (
              <option key={s} value={s}>
                {s} Season
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-400 mb-1">Circuit / Event</label>
          <select
            value={circuit}
            onChange={(e) => setCircuit(e.target.value)}
            className="w-full border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-purple-400 focus:outline-none"
          >
            {(circuits || []).map((c) => (
              <option key={c.circuit_id} value={c.circuit_name}>
                R{c.round_number || "—"}: {c.circuit_name} ({c.country})
              </option>
            ))}
            {(!circuits || circuits.length === 0) && (
              <option value="Bahrain">Bahrain Grand Prix</option>
            )}
          </select>
        </div>

        <div>
          <label className="block text-slate-400 mb-1">Session type</label>
          <select
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value)}
            className="w-full border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-purple-400 focus:outline-none"
          >
            <option value="Race">Race</option>
            <option value="Qualifying">Qualifying</option>
            <option value="FP1">Practice 1 (FP1)</option>
            <option value="FP2">Practice 2 (FP2)</option>
            <option value="FP3">Practice 3 (FP3)</option>
            <option value="Sprint">Sprint</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-400 mb-1">Driver code</label>
          <input
            type="text"
            value={driver}
            onChange={(e) => setDriver(e.target.value.toUpperCase())}
            placeholder="VER / PER"
            className="w-full border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-purple-400 focus:outline-none font-bold tracking-wider"
          />
        </div>
      </div>

      {isLoading ? (
        <FastF1LoadingSkeleton title="Analyzing Tire Degradation" message="Filtering caution laps and executing OLS linear fit per stint..." />
      ) : isError || !analysis ? (
        <div className="border border-red-900/40 bg-red-950/20 p-6 border-l-2 border-l-red-500 font-mono text-xs text-red-300 space-y-2">
          <p className="font-semibold text-sm">Failed to calculate tire degradation</p>
          <p>Verify telemetry data availability for driver {driver} in session {season} {circuit} {sessionType}.</p>
        </div>
      ) : analysis.stints.length === 0 ? (
        <div className="border border-slate-800 bg-slate-surface p-8 text-center font-mono text-xs text-slate-400">
          No stint telemetry records available for driver {driver} in session {analysis.session_id}.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stints Overview Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analysis.stints.map((stint) => (
              <div
                key={stint.stint}
                className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-purple-500 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-slate-400">
                    STINT #{stint.stint}
                  </span>
                  <span className={`sharp-tag border px-2.5 py-0.5 text-xs font-mono font-bold ${getCompoundColor(stint.compound)}`}>
                    {stint.compound}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 border border-slate-800 font-mono text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px] block">Degradation rate</span>
                    <span className="text-slate-100 font-bold text-sm">
                      {formatDegradationRate(stint.degradation_rate, 4)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Base pace (intercept)</span>
                    <span className="text-purple-300 font-bold text-sm">
                      {stint.base_pace !== undefined && stint.base_pace !== null
                        ? `${stint.base_pace.toFixed(3)}s`
                        : "N/A"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
                  <span>Total laps: {stint.total_laps}</span>
                  <span className="text-emerald-400">Valid: {stint.valid_laps}</span>
                  <span className={stint.excluded_laps_count > 0 ? "text-amber-400 font-semibold" : "text-slate-500"}>
                    Excluded: {stint.excluded_laps_count}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Detailed Stint-by-Stint Degradation Breakdown */}
          {analysis.stints.map((stint) => (
            <div key={stint.stint} className="border border-slate-800 bg-slate-surface p-6 border-l-2 border-l-slate-700 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-100 font-sans">
                    Stint #{stint.stint} Detailed Analysis — {stint.compound} Compound
                  </span>
                  <span className={`sharp-tag border px-2 py-0.5 text-xs font-mono font-bold ${getCompoundColor(stint.compound)}`}>
                    {stint.compound}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-400">
                  OLS Fit: <strong className="text-purple-300">{formatDegradationRate(stint.degradation_rate, 4)}</strong>
                </div>
              </div>

              {/* Excluded Laps Transparency Callout Notice */}
              {stint.excluded_laps_count > 0 && (
                <div className="border border-amber-500/30 bg-amber-950/20 p-4 border-l-2 border-l-amber-500 text-xs font-mono space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-semibold">
                    <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                    <span>Data Quality Transparency Audit: {stint.excluded_laps_count} laps excluded from OLS linear fit</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Including caution-period or deleted laps would produce a fabricated, misleading degradation rate. The following laps were excluded prior to fitting:
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {stint.excluded_lap_numbers.map((ex) => (
                      <span key={ex.lap_number} className="sharp-tag border border-amber-500/40 bg-amber-900/30 px-2 py-0.5 text-[11px] text-amber-200">
                        Lap {ex.lap_number}: {ex.reason}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Laps Telemetry Table */}
              <div className="overflow-x-auto border border-slate-800">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Lap</th>
                      <th className="py-2.5 px-3">Tyre life</th>
                      <th className="py-2.5 px-3">Lap time</th>
                      <th className="py-2.5 px-3">Track status</th>
                      <th className="py-2.5 px-3">OLS Status</th>
                      <th className="py-2.5 px-3">Exclusion note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {stint.laps.map((l) => (
                      <tr key={l.lap_number} className={l.is_excluded ? "bg-amber-950/10 text-slate-400" : "hover:bg-slate-900/60"}>
                        <td className="py-2 px-3 font-semibold text-slate-100">L{l.lap_number}</td>
                        <td className="py-2 px-3">{l.tyre_life ?? "—"}</td>
                        <td className={`py-2 px-3 font-semibold ${l.is_excluded ? "text-slate-400 line-through" : "text-purple-300"}`}>
                          {l.lap_time_seconds ? `${l.lap_time_seconds.toFixed(3)}s` : "—"}
                        </td>
                        <td className="py-2 px-3">{l.track_status ?? "1"}</td>
                        <td className="py-2 px-3">
                          {l.is_excluded ? (
                            <span className="text-amber-400 font-semibold">EXCLUDED</span>
                          ) : (
                            <span className="text-emerald-400 font-semibold">INCLUDED</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-400 text-[11px]">
                          {l.exclusion_reason || "Valid green-flag lap"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
