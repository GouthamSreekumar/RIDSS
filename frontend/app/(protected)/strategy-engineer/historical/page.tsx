"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CloudRain,
  Compass,
  History,
  Info,
  Layers,
  RefreshCw,
  Search,
  Thermometer,
  TrendingDown,
} from "lucide-react";
import axiosInstance from "@/lib/axios";
import { FastF1LoadingSkeleton } from "@/components/race-engineer/FastF1LoadingSkeleton";

interface HistoricalCompoundSummary {
  compound: string;
  sample_stints: number;
  avg_degradation_rate: number;
  avg_stint_length: number;
  avg_base_pace?: number;
}

interface HistoricalStintPattern {
  season: number;
  session_type: string;
  driver_code: string;
  stint: number;
  compound: string;
  total_laps: number;
  valid_laps: number;
  degradation_rate?: number;
  base_pace?: number;
  track_temp?: number;
  rainfall?: boolean;
}

interface HistoricalStrategyReviewResponse {
  circuit: string;
  seasons: number[];
  compound_summaries: HistoricalCompoundSummary[];
  stints: HistoricalStintPattern[];
  season_weather?: Record<number, { track_temp?: number; rainfall?: boolean; air_temp?: number; humidity?: number }>;
}

async function fetchHistoricalReview(
  circuit: string,
  seasons: string
): Promise<HistoricalStrategyReviewResponse> {
  const res = await axiosInstance.get(
    `/api/v1/strategy-engineer/historical?circuit=${encodeURIComponent(circuit)}&seasons=${encodeURIComponent(seasons)}`
  );
  return res.data;
}

const formatDegradationRate = (val?: number | null, decimals = 4): string => {
  if (val === undefined || val === null) return "—";
  const formatted = val.toFixed(decimals);
  return val >= 0 ? `+${formatted} s/lap` : `${formatted} s/lap`;
};

export default function HistoricalStrategyReviewPage() {
  const [circuit, setCircuit] = useState("Bahrain");
  const [selectedSeasons, setSelectedSeasons] = useState("2023,2024");
  const [searchTerm, setSearchTerm] = useState("");

  const {
    data: review,
    isLoading,
    isError,
    refetch,
  } = useQuery<HistoricalStrategyReviewResponse>({
    queryKey: ["historicalReview", circuit, selectedSeasons],
    queryFn: () => fetchHistoricalReview(circuit, selectedSeasons),
    staleTime: 5 * 60 * 1000,
  });

  const filteredStints = (review?.stints || []).filter((s) => {
    const q = searchTerm.toLowerCase();
    return (
      s.driver_code.toLowerCase().includes(q) ||
      s.compound.toLowerCase().includes(q) ||
      s.season.toString().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-emerald-400">
        <div>
          <div className="flex items-center gap-2 mb-1.5 font-mono">
            <span className="sharp-tag bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              <History size={12} className="text-emerald-400 mr-1" /> Historical cross-season review
            </span>
            <span className="text-xs text-slate-400">• Multi-year circuit analysis</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">
            Cross-season strategic review ({circuit})
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Reuses Race Engineer's shared season-aware team data across past seasons to evaluate degradation trends and compound lifespan history.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="sharp-tag border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-300 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
        >
          <RefreshCw size={12} /> Refetch historical data
        </button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-slate-800 bg-slate-surface p-4 font-mono text-xs">
        <div>
          <label className="block text-slate-400 mb-1">Target circuit</label>
          <select
            value={circuit}
            onChange={(e) => setCircuit(e.target.value)}
            className="w-full border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-400 focus:outline-none"
          >
            <option value="Bahrain">Bahrain Grand Prix</option>
            <option value="Monaco">Monaco Grand Prix</option>
            <option value="Silverstone">Silverstone Grand Prix</option>
            <option value="Monza">Monza Grand Prix</option>
            <option value="Spa">Spa-Francorchamps</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-400 mb-1">Seasons (comma separated)</label>
          <input
            type="text"
            value={selectedSeasons}
            onChange={(e) => setSelectedSeasons(e.target.value)}
            placeholder="2023,2024"
            className="w-full border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-400 focus:outline-none"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={() => refetch()}
            className="w-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-mono font-semibold text-emerald-300 hover:bg-emerald-400 hover:text-slate-950 transition-colors"
          >
            Execute Review
          </button>
        </div>
      </div>

      {isLoading ? (
        <FastF1LoadingSkeleton title="Fetching Historical Telemetry Data" message="Aggregate cross-season stint degradation models..." />
      ) : isError || !review ? (
        <div className="border border-red-900/40 bg-red-950/20 p-6 border-l-2 border-l-red-500 font-mono text-xs text-red-300">
          Failed to fetch historical race strategy data for {circuit}. Please check season query syntax.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Compound Averages Matrix */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 font-mono">
              Compound Degradation Multi-Year Averages ({review.circuit})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {review.compound_summaries.map((summary) => (
                <div
                  key={summary.compound}
                  className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-emerald-400 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-100 font-sans">
                      {summary.compound} COMPOUND
                    </span>
                    <span className="sharp-tag border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-mono text-emerald-300">
                      {summary.sample_stints} Stints Analyzed
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 border border-slate-800 font-mono text-xs">
                    <div>
                      <span className="text-slate-500 text-[11px] block">Avg deg rate</span>
                      <span className="text-emerald-300 font-bold text-sm">
                        {formatDegradationRate(summary.avg_degradation_rate, 4)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px] block">Avg stint length</span>
                      <span className="text-slate-100 font-bold text-sm">
                        {summary.avg_stint_length} Laps
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Year-over-Year Season Weather Context Banner */}
          {review.season_weather && Object.keys(review.season_weather).length > 0 && (
            <div className="border border-slate-800 bg-slate-surface p-4 border-l-2 border-l-amber-500 font-mono text-xs space-y-2">
              <div className="flex items-center gap-2 text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                <Thermometer size={13} className="text-amber-400" />
                Year-over-Year Season Weather Context ({review.circuit})
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                {Object.entries(review.season_weather).map(([yr, w]) => (
                  <div key={yr} className="bg-slate-950 px-3 py-1.5 border border-slate-800 flex items-center gap-2 text-xs">
                    <span className="font-bold text-emerald-400">{yr} Season:</span>
                    <span className="text-amber-300 font-semibold">
                      Track Temp {w.track_temp !== undefined && w.track_temp !== null ? `${w.track_temp}°C` : "N/A"}
                    </span>
                    {w.rainfall && (
                      <span className="sharp-tag border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0.2 text-[10px] text-cyan-300">
                        Rain
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historical Stints Data Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                Historical Stint Breakdown & Weather Context
              </h2>
              <div className="relative w-64">
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search stints..."
                  className="w-full border border-slate-800 bg-slate-surface pl-8 pr-3 py-1.5 text-xs text-slate-100 font-mono focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="border border-slate-800 bg-slate-surface overflow-hidden border-l-2 border-l-slate-700">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-medium">Season</th>
                      <th className="py-3 px-4 font-medium">Driver</th>
                      <th className="py-3 px-4 font-medium">Stint #</th>
                      <th className="py-3 px-4 font-medium">Compound</th>
                      <th className="py-3 px-4 font-medium">Total laps</th>
                      <th className="py-3 px-4 font-medium">Valid laps</th>
                      <th className="py-3 px-4 font-medium">Degradation rate</th>
                      <th className="py-3 px-4 font-medium">Track temp</th>
                      <th className="py-3 px-4 font-medium">Base pace</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredStints.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                          No historical stint patterns found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredStints.map((stint, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/60 transition-colors">
                          <td className="py-3 px-4 font-semibold text-emerald-400">{stint.season}</td>
                          <td className="py-3 px-4 font-bold text-slate-100">{stint.driver_code}</td>
                          <td className="py-3 px-4">Stint #{stint.stint}</td>
                          <td className="py-3 px-4 font-semibold">{stint.compound}</td>
                          <td className="py-3 px-4">{stint.total_laps}</td>
                          <td className="py-3 px-4 text-emerald-300">{stint.valid_laps}</td>
                          <td className="py-3 px-4 text-amber-300 font-semibold">
                            {formatDegradationRate(stint.degradation_rate, 4)}
                          </td>
                          <td className="py-3 px-4 text-amber-200">
                            {stint.track_temp !== undefined && stint.track_temp !== null ? `${stint.track_temp}°C` : "—"}
                            {stint.rainfall && <span className="ml-1 text-[10px] text-cyan-400 font-sans font-semibold">(Rain)</span>}
                          </td>
                          <td className="py-3 px-4 text-purple-300">
                            {stint.base_pace !== undefined && stint.base_pace !== null
                              ? `${stint.base_pace.toFixed(3)}s`
                              : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
