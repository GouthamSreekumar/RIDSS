"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  Award,
  Calendar,
  ChevronRight,
  Clock,
  Flag,
  Info,
  Layers,
  Trophy,
  Zap,
} from "lucide-react";
import { useState } from "react";
import {
  useSeasonComparison,
  type RacePointsItem,
  type SeasonStats,
} from "@/features/team-manager/api/teamManagerApi";

export default function SeasonComparisonPage() {
  const [seasonA, setSeasonA] = useState<number | undefined>(undefined);
  const [seasonB, setSeasonB] = useState<number | undefined>(undefined);
  const [hoveredRound, setHoveredRound] = useState<number | null>(null);

  const { data, isLoading, error } = useSeasonComparison(seasonA, seasonB);

  const activeSeasonA = data?.season_a ?? 2026;
  const activeSeasonB = data?.season_b ?? 2025;
  const availableSeasons = data?.available_seasons ?? [2023, 2024, 2025, 2026];

  const statsA = data?.stats_a;
  const statsB = data?.stats_b;

  // Chart max cumulative points calculation for dynamic SVG scaling
  const maxPtsA = statsA?.total_points ?? 0;
  const maxPtsB = statsB?.total_points ?? 0;
  const maxPtsInChart = Math.max(100, maxPtsA, maxPtsB);

  const maxRounds = Math.max(
    statsA?.race_by_race_points.length ?? 0,
    statsB?.race_by_race_points.length ?? 0,
    24
  );

  return (
    <div className="space-y-6 font-sans">
      {/* ── Header & Title ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="border border-ferrari-red/40 bg-ferrari-red/10 px-2 py-0.5 text-[10px] font-mono font-bold text-ferrari-red uppercase">
              Team Analytics
            </span>
            <span className="text-xs text-slate-500 font-mono">• Combined Team Points</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-100">
            Season-over-season comparison
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Compare team performance, race-by-race cumulative points progression, wins, and podiums across seasons.
          </p>
        </div>

        {/* ── Season Selectors (Year-Tab Pattern) ── */}
        <div className="flex items-center gap-3 bg-slate-900/80 p-2 border border-slate-800">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono font-semibold text-slate-400">Season A (Primary)</span>
            <div className="flex items-center gap-1">
              {availableSeasons.map((year) => (
                <button
                  key={`a-${year}`}
                  onClick={() => setSeasonA(year)}
                  className={`px-2.5 py-1 text-xs font-mono font-bold transition-colors ${
                    activeSeasonA === year
                      ? "bg-ferrari-red text-white border border-ferrari-red"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 border border-slate-700"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          <div className="h-8 w-px bg-slate-800 flex items-center justify-center text-[10px] font-mono text-slate-500 font-bold px-1">
            VS
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono font-semibold text-slate-400">Season B (Baseline)</span>
            <div className="flex items-center gap-1">
              {availableSeasons.map((year) => (
                <button
                  key={`b-${year}`}
                  onClick={() => setSeasonB(year)}
                  className={`px-2.5 py-1 text-xs font-mono font-bold transition-colors ${
                    activeSeasonB === year
                      ? "bg-cyan-500 text-slate-950 border border-cyan-400"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 border border-slate-700"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-72 items-center justify-center gap-3 text-xs font-mono text-slate-400">
          <Activity size={20} className="animate-pulse text-ferrari-red" />
          <span>Fetching FastF1 telemetry season comparison data…</span>
        </div>
      ) : error ? (
        <div className="border border-red-500/40 bg-red-950/20 p-5 text-red-400 space-y-2 border-l-2 border-l-red-500 font-mono text-xs">
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle size={16} /> Unable to load season comparison telemetry
          </div>
          <p className="text-slate-300">
            Check network connection or FastF1 telemetry cache status.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Dynamic Partial Season Notice ── */}
          {(statsA?.is_partial || statsB?.is_partial) && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-amber/30 bg-amber/10 p-3 text-xs text-amber font-mono flex items-center justify-between border-l-2 border-l-amber"
            >
              <div className="flex items-center gap-2">
                <Info size={14} className="shrink-0" />
                <span>
                  {statsA?.is_partial && statsB?.is_partial
                    ? `Both Season ${activeSeasonA} (${statsA.races_completed}/${statsA.total_races} races) and Season ${activeSeasonB} (${statsB?.races_completed ?? 0}/${statsB?.total_races ?? 0} races) are currently in-progress.`
                    : statsA?.is_partial
                    ? `Season ${activeSeasonA} is in-progress (${statsA.races_completed}/${statsA.total_races} races completed). Rendered clearly as partial baseline comparison.`
                    : `Season ${activeSeasonB} is in-progress (${statsB?.races_completed ?? 0}/${statsB?.total_races ?? 0} races completed).`}
                </span>
              </div>
              <span className="border border-amber/40 bg-amber/20 px-2 py-0.5 text-[10px] font-bold uppercase shrink-0">
                Partial Data
              </span>
            </motion.div>
          )}

          {/* ── Side-by-Side Stat Comparison Block ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Points */}
            <div className="border border-slate-800 bg-slate-surface p-5 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                <span>Total Combined Points</span>
                <Trophy size={15} className="text-amber" />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                <div>
                  <span className="text-[10px] text-ferrari-red font-bold uppercase">{activeSeasonA}</span>
                  <p className="text-2xl font-bold text-slate-100 tabular-nums">{statsA?.total_points ?? 0}</p>
                  <p className="text-[10px] text-slate-500">{statsA?.races_completed} races</p>
                </div>
                <div className="border-l border-slate-800 pl-3">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase">{activeSeasonB}</span>
                  <p className="text-2xl font-bold text-slate-300 tabular-nums">{statsB?.total_points ?? 0}</p>
                  <p className="text-[10px] text-slate-500">{statsB?.races_completed} races</p>
                </div>
              </div>
              {statsA && statsB && (
                <div className="pt-1 text-[11px] font-mono flex items-center gap-1.5 border-t border-slate-800/80">
                  <span className="text-slate-500">Difference:</span>
                  <span
                    className={
                      statsA.total_points >= statsB.total_points
                        ? "text-emerald-400 font-bold"
                        : "text-amber font-bold"
                    }
                  >
                    {statsA.total_points >= statsB.total_points ? "+" : ""}
                    {(statsA.total_points - statsB.total_points).toFixed(1)} pts
                  </span>
                </div>
              )}
            </div>

            {/* Wins Count */}
            <div className="border border-slate-800 bg-slate-surface p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                <span>Race Wins (P1)</span>
                <Flag size={15} className="text-emerald-400" />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                <div>
                  <span className="text-[10px] text-ferrari-red font-bold uppercase">{activeSeasonA}</span>
                  <p className="text-2xl font-bold text-slate-100 tabular-nums">{statsA?.wins_count ?? 0}</p>
                </div>
                <div className="border-l border-slate-800 pl-3">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase">{activeSeasonB}</span>
                  <p className="text-2xl font-bold text-slate-300 tabular-nums">{statsB?.wins_count ?? 0}</p>
                </div>
              </div>
              <p className="pt-1 text-[11px] font-mono text-slate-500">
                1st place finishes per team
              </p>
            </div>

            {/* Podiums Count */}
            <div className="border border-slate-800 bg-slate-surface p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                <span>Podiums (P1 - P3)</span>
                <Award size={15} className="text-ferrari-red" />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                <div>
                  <span className="text-[10px] text-ferrari-red font-bold uppercase">{activeSeasonA}</span>
                  <p className="text-2xl font-bold text-slate-100 tabular-nums">{statsA?.podiums_count ?? 0}</p>
                </div>
                <div className="border-l border-slate-800 pl-3">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase">{activeSeasonB}</span>
                  <p className="text-2xl font-bold text-slate-300 tabular-nums">{statsB?.podiums_count ?? 0}</p>
                </div>
              </div>
              <p className="pt-1 text-[11px] font-mono text-slate-500">
                Top 3 positions count
              </p>
            </div>

            {/* Average Finishing Position */}
            <div className="border border-slate-800 bg-slate-surface p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                <span>Avg Finish Position</span>
                <Zap size={15} className="text-cyan-400" />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                <div>
                  <span className="text-[10px] text-ferrari-red font-bold uppercase">{activeSeasonA}</span>
                  <p className="text-2xl font-bold text-slate-100 tabular-nums">
                    {statsA?.avg_finishing_position ? `P${statsA.avg_finishing_position}` : "N/A"}
                  </p>
                </div>
                <div className="border-l border-slate-800 pl-3">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase">{activeSeasonB}</span>
                  <p className="text-2xl font-bold text-slate-300 tabular-nums">
                    {statsB?.avg_finishing_position ? `P${statsB.avg_finishing_position}` : "N/A"}
                  </p>
                </div>
              </div>
              <p className="pt-1 text-[11px] font-mono text-slate-500">
                Lower average position is superior
              </p>
            </div>
          </div>

          {/* ── Race-by-Race Points Progression Line Chart ── */}
          <div className="border border-slate-800 bg-slate-surface p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-ferrari-red" />
                  <h2 className="text-sm font-bold text-slate-100">
                    Cumulative Points Progression (Race-by-Race)
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Plotting team points accumulation across rounds for {activeSeasonA} vs {activeSeasonB}
                </p>
              </div>

              {/* Chart Legend */}
              <div className="flex items-center gap-5 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 bg-ferrari-red rounded-full" />
                  <span className="text-slate-200 font-semibold">{activeSeasonA} Season</span>
                  {statsA?.is_partial && (
                    <span className="text-[10px] text-amber font-normal">(In Progress)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 bg-cyan-400 rounded-full" />
                  <span className="text-slate-300 font-semibold">{activeSeasonB} Season</span>
                  {statsB?.is_partial && (
                    <span className="text-[10px] text-amber font-normal">(In Progress)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Custom Interactive SVG Telemetry Line Chart */}
            <div className="relative w-full h-80 pt-2 pb-6 font-mono text-[10px]">
              {/* Y-Axis Guidelines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-slate-600 pl-2">
                {[1, 0.75, 0.5, 0.25, 0].map((ratio) => {
                  const val = Math.round(maxPtsInChart * ratio);
                  return (
                    <div key={ratio} className="flex items-center gap-2 w-full">
                      <span className="w-8 text-right font-mono text-slate-500 tabular-nums">{val}</span>
                      <div className="h-px flex-1 bg-slate-800/60" />
                    </div>
                  );
                })}
              </div>

              {/* SVG Paths & Points */}
              <svg className="w-full h-full overflow-visible pl-10 pr-4">
                {/* Season B Line Path (Cyan) */}
                {statsB && statsB.race_by_race_points.length > 0 && (
                  <g>
                    <polyline
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={statsB.race_by_race_points
                        .map((pt, idx) => {
                          const x = ((idx + 0.5) / maxRounds) * 100;
                          const y = 100 - (pt.cumulative_points / maxPtsInChart) * 100;
                          return `${x}%,${y}%`;
                        })
                        .join(" ")}
                    />
                    {statsB.race_by_race_points.map((pt, idx) => {
                      const x = `${((idx + 0.5) / maxRounds) * 100}%`;
                      const y = `${100 - (pt.cumulative_points / maxPtsInChart) * 100}%`;
                      return (
                        <circle
                          key={`b-pt-${idx}`}
                          cx={x}
                          cy={y}
                          r={hoveredRound === pt.round_number ? 6 : 3.5}
                          className="fill-cyan-400 stroke-slate-950 stroke-2 transition-all cursor-pointer"
                          onMouseEnter={() => setHoveredRound(pt.round_number)}
                          onMouseLeave={() => setHoveredRound(null)}
                        />
                      );
                    })}
                  </g>
                )}

                {/* Season A Line Path (Ferrari Red) */}
                {statsA && statsA.race_by_race_points.length > 0 && (
                  <g>
                    <polyline
                      fill="none"
                      stroke="#ff1801"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={statsA.race_by_race_points
                        .map((pt, idx) => {
                          const x = ((idx + 0.5) / maxRounds) * 100;
                          const y = 100 - (pt.cumulative_points / maxPtsInChart) * 100;
                          return `${x}%,${y}%`;
                        })
                        .join(" ")}
                    />
                    {statsA.race_by_race_points.map((pt, idx) => {
                      const x = `${((idx + 0.5) / maxRounds) * 100}%`;
                      const y = `${100 - (pt.cumulative_points / maxPtsInChart) * 100}%`;
                      return (
                        <circle
                          key={`a-pt-${idx}`}
                          cx={x}
                          cy={y}
                          r={hoveredRound === pt.round_number ? 7 : 4}
                          className="fill-ferrari-red stroke-white stroke-2 transition-all cursor-pointer"
                          onMouseEnter={() => setHoveredRound(pt.round_number)}
                          onMouseLeave={() => setHoveredRound(null)}
                        />
                      );
                    })}
                  </g>
                )}
              </svg>

              {/* X-Axis Round Labels */}
              <div className="absolute bottom-0 left-10 right-4 flex justify-between pt-2 text-[9px] text-slate-500 font-mono">
                {Array.from({ length: maxRounds }).map((_, idx) => (
                  <span
                    key={`round-${idx}`}
                    className={`text-center cursor-pointer transition-colors ${
                      hoveredRound === idx + 1 ? "text-slate-100 font-bold" : ""
                    }`}
                    onMouseEnter={() => setHoveredRound(idx + 1)}
                    onMouseLeave={() => setHoveredRound(null)}
                  >
                    R{idx + 1}
                  </span>
                ))}
              </div>
            </div>

            {/* Hovered Round Tooltip Details */}
            {hoveredRound !== null && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-slate-700 bg-slate-900 p-3 font-mono text-xs text-slate-200 flex flex-wrap items-center justify-between gap-4 border-l-2 border-l-ferrari-red"
              >
                <div className="flex items-center gap-2 font-bold text-slate-100">
                  <Calendar size={14} className="text-ferrari-red" />
                  <span>Round {hoveredRound}:</span>
                  <span className="text-amber">
                    {statsA?.race_by_race_points.find((r) => r.round_number === hoveredRound)?.event_name ??
                      statsB?.race_by_race_points.find((r) => r.round_number === hoveredRound)?.event_name ??
                      `Grand Prix ${hoveredRound}`}
                  </span>
                </div>

                <div className="flex items-center gap-6 text-xs">
                  <div>
                    <span className="text-ferrari-red font-semibold">{activeSeasonA}:</span>{" "}
                    <span className="font-bold">
                      {statsA?.race_by_race_points.find((r) => r.round_number === hoveredRound)?.cumulative_points ?? "N/A"}{" "}
                      pts
                    </span>{" "}
                    <span className="text-slate-500">
                      (+{statsA?.race_by_race_points.find((r) => r.round_number === hoveredRound)?.race_points ?? 0})
                    </span>
                  </div>

                  <div>
                    <span className="text-cyan-400 font-semibold">{activeSeasonB}:</span>{" "}
                    <span className="font-bold">
                      {statsB?.race_by_race_points.find((r) => r.round_number === hoveredRound)?.cumulative_points ?? "N/A"}{" "}
                      pts
                    </span>{" "}
                    <span className="text-slate-500">
                      (+{statsB?.race_by_race_points.find((r) => r.round_number === hoveredRound)?.race_points ?? 0})
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* ── Detailed Race-by-Race Breakdown Table ── */}
          <div className="border border-slate-800 bg-slate-surface">
            <div className="border-b border-slate-800 px-5 py-3.5 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-200">
                  Grand Prix Points Breakdown
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {activeSeasonA} vs {activeSeasonB}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 font-semibold text-slate-400">
                    <th className="py-3 px-5 font-mono">Round</th>
                    <th className="py-3 px-5">Grand Prix Event</th>
                    <th className="py-3 px-5 font-mono text-ferrari-red">{activeSeasonA} Points</th>
                    <th className="py-3 px-5 font-mono text-ferrari-red">{activeSeasonA} Total</th>
                    <th className="py-3 px-5 font-mono text-cyan-400">{activeSeasonB} Points</th>
                    <th className="py-3 px-5 font-mono text-cyan-400">{activeSeasonB} Total</th>
                    <th className="py-3 px-5 text-right font-mono">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono">
                  {Array.from({ length: maxRounds }).map((_, idx) => {
                    const rNum = idx + 1;
                    const rA = statsA?.race_by_race_points.find((r) => r.round_number === rNum);
                    const rB = statsB?.race_by_race_points.find((r) => r.round_number === rNum);
                    const eventName = rA?.event_name ?? rB?.event_name ?? `Round ${rNum}`;

                    const delta = (rA?.cumulative_points ?? 0) - (rB?.cumulative_points ?? 0);

                    return (
                      <tr
                        key={`row-r-${rNum}`}
                        className={`hover:bg-slate-900/60 transition-colors ${
                          hoveredRound === rNum ? "bg-slate-900/80" : ""
                        }`}
                        onMouseEnter={() => setHoveredRound(rNum)}
                        onMouseLeave={() => setHoveredRound(null)}
                      >
                        <td className="py-3 px-5 font-bold text-slate-400">R{rNum}</td>
                        <td className="py-3 px-5 font-sans font-semibold text-slate-200">
                          {eventName}
                          {(!rA?.is_completed && !rB?.is_completed) && (
                            <span className="ml-2 text-[10px] text-slate-500 font-mono">(Upcoming)</span>
                          )}
                        </td>
                        <td className="py-3 px-5 text-slate-300">
                          {rA?.is_completed ? `+${rA.race_points}` : "—"}
                        </td>
                        <td className="py-3 px-5 font-bold text-slate-100">
                          {rA?.is_completed ? rA.cumulative_points : "—"}
                        </td>
                        <td className="py-3 px-5 text-slate-300">
                          {rB?.is_completed ? `+${rB.race_points}` : "—"}
                        </td>
                        <td className="py-3 px-5 font-bold text-slate-300">
                          {rB?.is_completed ? rB.cumulative_points : "—"}
                        </td>
                        <td className="py-3 px-5 text-right font-bold">
                          {rA?.is_completed || rB?.is_completed ? (
                            <span className={delta >= 0 ? "text-emerald-400" : "text-amber"}>
                              {delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
