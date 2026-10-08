"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Compass,
  FileText,
  Info,
  Layers,
  Plus,
  Radio,
  Search,
  Shield,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import axiosInstance from "@/lib/axios";
import { FastF1LoadingSkeleton } from "@/components/race-engineer/FastF1LoadingSkeleton";

interface StintPlan {
  stint_number: number;
  compound: string;
  start_lap: number;
  end_lap: number;
  target_pit_lap?: number;
  notes?: string;
}

interface RaceStrategy {
  id: string;
  team_id: string;
  session_id: string;
  created_by: string;
  creator_name: string;
  title?: string;
  driver_code?: string;
  plan: StintPlan[];
  created_at: string;
}

interface PitRecommendation {
  session_id: string;
  driver_code: string;
  current_stint?: number;
  current_compound?: string;
  current_degradation_rate?: number;
  current_base_pace?: number;
  alternate_compound?: string;
  alternate_degradation_rate?: number;
  alternate_base_pace?: number;
  pit_loss_seconds: number;
  crossover_lap?: number;
  recommended_window_start?: number;
  recommended_window_end?: number;
  reasoning: string;
  fallback_used: boolean;
}

interface StintEstimate {
  stint_number: number;
  compound: string;
  start_lap: number;
  end_lap: number;
  stint_length: number;
  target_pit_lap?: number;
  degradation_rate: number;
  base_pace: number;
  stint_projected_time_seconds: number;
  degradation_source: string;
}

interface StrategyComparisonItem {
  strategy_id: string;
  title?: string;
  driver_code?: string;
  created_by_name: string;
  stops_count: number;
  pit_loss_total_seconds: number;
  total_projected_time_seconds: number;
  total_projected_time_str: string;
  stint_estimates: StintEstimate[];
  is_lowest_time: boolean;
  estimation_label: string;
}

interface StrategyComparisonResponse {
  session_id: string;
  circuit_name: string;
  season: number;
  pit_loss_seconds: number;
  compared_strategies: StrategyComparisonItem[];
  disclaimer: string;
}

async function fetchRaceStrategies(): Promise<RaceStrategy[]> {
  const res = await axiosInstance.get("/api/v1/strategy-engineer/strategies");
  return res.data;
}

async function fetchPitRecommendation(session_id: string, driver: string): Promise<PitRecommendation> {
  const res = await axiosInstance.get(
    `/api/v1/strategy-engineer/pit-recommendation?session_id=${session_id}&driver=${driver}`
  );
  return res.data;
}

export default function RaceStrategiesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Selection and Comparison State
  const [selectedStrategyIds, setSelectedStrategyIds] = useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // Form State for New Strategy Creation
  const [formSessionId, setFormSessionId] = useState("2024_bahrain_race");
  const [formDriverCode, setFormDriverCode] = useState("VER");
  const [formTitle, setFormTitle] = useState("Bahrain 2-Stop Strategy Plan");
  const [stints, setStints] = useState<StintPlan[]>([
    { stint_number: 1, compound: "MEDIUM", start_lap: 1, end_lap: 18, target_pit_lap: 18, notes: "Start stint" },
    { stint_number: 2, compound: "HARD", start_lap: 19, end_lap: 38, target_pit_lap: 38, notes: "Middle stint" },
    { stint_number: 3, compound: "SOFT", start_lap: 39, end_lap: 57, target_pit_lap: undefined, notes: "Final sprint" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch Strategies List
  const {
    data: strategies,
    isLoading,
    isError,
    refetch,
  } = useQuery<RaceStrategy[]>({
    queryKey: ["raceStrategiesList"],
    queryFn: fetchRaceStrategies,
    staleTime: 60 * 1000,
  });

  // Fetch Pit Window Recommendation reference input for form
  const { data: pitRecommendation, isLoading: loadingRec } = useQuery<PitRecommendation>({
    queryKey: ["pitRecommendationRef", formSessionId, formDriverCode],
    queryFn: () => fetchPitRecommendation(formSessionId, formDriverCode),
    enabled: isModalOpen && !!formSessionId && !!formDriverCode,
  });

  // Fetch Side-by-Side Comparison Data
  const {
    data: comparisonData,
    isLoading: loadingComparison,
    isError: isErrorComparison,
  } = useQuery<StrategyComparisonResponse>({
    queryKey: ["strategyComparison", selectedStrategyIds],
    queryFn: async () => {
      const idsQuery = selectedStrategyIds.map((id) => `strategy_ids=${encodeURIComponent(id)}`).join("&");
      const res = await axiosInstance.get(`/api/v1/strategy-engineer/strategies/compare?${idsQuery}`);
      return res.data;
    },
    enabled: isCompareModalOpen && selectedStrategyIds.length >= 2,
  });

  const toggleSelectStrategy = (id: string) => {
    if (selectedStrategyIds.includes(id)) {
      setSelectedStrategyIds(selectedStrategyIds.filter((sId) => sId !== id));
    } else {
      setSelectedStrategyIds([...selectedStrategyIds, id]);
    }
  };

  const handleAddStint = () => {
    const nextStintNum = stints.length + 1;
    const prevEnd = stints.length > 0 ? stints[stints.length - 1].end_lap : 1;
    setStints([
      ...stints,
      {
        stint_number: nextStintNum,
        compound: "MEDIUM",
        start_lap: prevEnd + 1,
        end_lap: prevEnd + 18,
        target_pit_lap: prevEnd + 18,
        notes: `Stint ${nextStintNum}`,
      },
    ]);
  };

  const handleRemoveStint = (index: number) => {
    if (stints.length <= 1) return;
    const updated = stints.filter((_, i) => i !== index).map((s, idx) => ({ ...s, stint_number: idx + 1 }));
    setStints(updated);
  };

  const handleStintChange = (index: number, field: keyof StintPlan, value: any) => {
    const updated = [...stints];
    updated[index] = { ...updated[index], [field]: value };
    setStints(updated);
  };

  const handleCreateStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axiosInstance.post("/api/v1/strategy-engineer/strategies", {
        session_id: formSessionId,
        driver_code: formDriverCode,
        title: formTitle,
        plan: stints,
      });
      setIsModalOpen(false);
      refetch();
    } catch (err: any) {
      alert(`Failed to save strategy plan: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStrategies = (strategies || []).filter((s) => {
    const title = s.title || "";
    const session = s.session_id || "";
    const driver = s.driver_code || "";
    const q = searchTerm.toLowerCase();
    return title.toLowerCase().includes(q) || session.toLowerCase().includes(q) || driver.toLowerCase().includes(q);
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

  const getSourceLabel = (source: string) => {
    switch (source) {
      case "actual_session":
        return "Session-specific degradation data";
      case "historical":
        return "Historical same-circuit degradation data";
      default:
        return "Default compound model fallback";
    }
  };

  if (isLoading) {
    return <FastF1LoadingSkeleton title="Loading Race Strategies" message="Fetching strategy plan repository..." />;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-cyan-400">
        <div>
          <div className="flex items-center gap-2 mb-1.5 font-mono">
            <span className="sharp-tag bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              <Target size={12} className="text-cyan-400 mr-1" /> Race strategy plans
            </span>
            <span className="text-xs text-slate-400">• Manually authored plans & side-by-side comparison</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">
            Race strategy composition & scenario comparison
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Author stint plans, target pit laps, and execute side-by-side scenario comparisons with deterministic projected race times.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {selectedStrategyIds.length >= 2 && (
            <button
              onClick={() => setIsCompareModalOpen(true)}
              className="sharp-tag border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-xs font-mono font-semibold text-emerald-300 hover:bg-emerald-400 hover:text-slate-950 transition-colors flex items-center gap-1.5 animate-pulse"
            >
              <Layers size={14} /> Compare Selected ({selectedStrategyIds.length})
            </button>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="sharp-tag border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-mono font-semibold text-cyan-300 hover:bg-cyan-400 hover:text-slate-950 transition-colors flex items-center gap-1.5"
          >
            <Plus size={14} /> Author new strategy
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search strategy plans..."
            className="w-full border border-slate-800 bg-slate-surface pl-9 pr-4 py-2 text-xs text-slate-100 font-mono focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
          {selectedStrategyIds.length > 0 && (
            <span className="text-cyan-300">
              Selected for comparison: <strong>{selectedStrategyIds.length}</strong>
              <button
                onClick={() => setSelectedStrategyIds([])}
                className="ml-2 text-slate-500 hover:text-slate-300 underline"
              >
                Clear
              </button>
            </span>
          )}
          <span>
            Total plans: <strong className="text-slate-200 tabular-nums">{filteredStrategies.length}</strong>
          </span>
        </div>
      </div>

      {/* Strategies List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredStrategies.length === 0 ? (
          <div className="col-span-full border border-slate-800 bg-slate-surface p-8 text-center text-xs text-slate-500 font-mono">
            No race strategy plans found. Click "Author new strategy" to create your first plan.
          </div>
        ) : (
          filteredStrategies.map((strat) => {
            const isSelected = selectedStrategyIds.includes(strat.id);
            return (
              <div
                key={strat.id}
                className={`border bg-slate-surface p-5 border-l-2 transition-all ${
                  isSelected
                    ? "border-emerald-500/60 border-l-emerald-400 bg-emerald-950/10 shadow-lg"
                    : "border-slate-800 border-l-cyan-400 hover:border-cyan-500/40"
                }`}
              >
                <div className="flex items-start justify-between border-b border-slate-800 pb-3 gap-2">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectStrategy(strat.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-400 focus:ring-cyan-400 cursor-pointer"
                    />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100 font-sans">
                        {strat.title || strat.session_id}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        Session: <span className="text-cyan-300">{strat.session_id}</span>
                      </p>
                    </div>
                  </div>

                  <span className="sharp-tag bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono shrink-0">
                    {strat.driver_code || "TEAM DRIVER"}
                  </span>
                </div>

                {/* Stint Plan Sequence */}
                <div className="space-y-2 py-3">
                  <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    Planned Stint Sequence:
                  </p>
                  <div className="space-y-1.5 font-mono text-xs">
                    {strat.plan && strat.plan.length > 0 ? (
                      strat.plan.map((s, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-slate-950 p-2.5 border border-slate-800"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-purple-400 font-bold">Stint #{s.stint_number}:</span>
                            <span className="font-semibold text-slate-100">{s.compound}</span>
                            <span className="text-slate-500">(Laps {s.start_lap}–{s.end_lap})</span>
                          </div>
                          {s.target_pit_lap && (
                            <span className="sharp-tag border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                              Pit Lap {s.target_pit_lap}
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-[11px]">No stint breakdown specified.</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800">
                  <span>By: {strat.creator_name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleSelectStrategy(strat.id)}
                      className="text-xs text-cyan-300 hover:underline"
                    >
                      {isSelected ? "Deselect" : "Select for Compare"}
                    </button>
                    <span>• {new Date(strat.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Side-by-Side Strategy Scenario Comparison Modal */}
      {isCompareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto">
          <div className="w-full max-w-6xl border border-slate-700 bg-slate-surface p-6 shadow-2xl space-y-6 border-l-2 border-l-emerald-400 my-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="sharp-tag bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-mono">
                  [Side-by-Side Scenario Comparison]
                </span>
                <h2 className="text-lg font-semibold tracking-tight text-slate-100 mt-1">
                  Strategy Plan Total Time Estimation & Stint Comparison
                </h2>
              </div>
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 font-mono text-sm px-2 py-1 border border-slate-800"
              >
                ✕ Close
              </button>
            </div>

            {/* Global Framing & Disclaimer Header */}
            <div className="border border-emerald-500/30 bg-emerald-950/20 p-4 border-l-2 border-l-emerald-500 text-xs font-mono space-y-1">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                <Info size={14} className="text-emerald-400 shrink-0" />
                <span>Phase 1 Deterministic Estimate — Based on current degradation model, not a guarantee</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Calculates total projected race time per plan by summing each planned stint's length multiplied by compound degradation rate and fresh tire base pace, plus the configured circuit pit stop loss constant per planned stop.
              </p>
            </div>

            {loadingComparison ? (
              <FastF1LoadingSkeleton title="Computing Scenario Comparison" message="Aggregating compound degradation rates and pit loss constants..." />
            ) : isErrorComparison || !comparisonData ? (
              <div className="border border-red-900/40 bg-red-950/20 p-6 border-l-2 border-l-red-500 font-mono text-xs text-red-300">
                Failed to execute side-by-side strategy comparison. Ensure at least two valid strategies for the same session are selected.
              </div>
            ) : (
              <div className="space-y-6 font-mono">
                {/* Circuit & Pit Loss Summary Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-3 border border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Session Context</span>
                    <span className="font-bold text-slate-100">{comparisonData.circuit_name} ({comparisonData.season}) — {comparisonData.session_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Pit Stop Loss Constant</span>
                    <span className="font-bold text-amber-300">{comparisonData.pit_loss_seconds}s loss per stop</span>
                  </div>
                </div>

                {/* Parallel Columns Grid */}
                <div className={`grid grid-cols-1 md:grid-cols-${Math.min(comparisonData.compared_strategies.length, 3)} gap-4`}>
                  {comparisonData.compared_strategies.map((plan) => (
                    <div
                      key={plan.strategy_id}
                      className={`border p-5 space-y-4 border-l-2 ${
                        plan.is_lowest_time
                          ? "border-emerald-500 bg-emerald-950/20 border-l-emerald-400 shadow-xl"
                          : "border-slate-800 bg-slate-surface border-l-slate-600"
                      }`}
                    >
                      {/* Column Header & Total Time Estimate */}
                      <div className="space-y-2 border-b border-slate-800 pb-3">
                        <div className="flex items-center justify-between">
                          <span className="sharp-tag bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                            {plan.driver_code || "DRIVER"}
                          </span>
                          {plan.is_lowest_time && (
                            <span className="sharp-tag border border-emerald-500/60 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                              <Trophy size={11} /> LOWEST ESTIMATED TIME
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-semibold text-slate-100 font-sans">
                          {plan.title || "Strategy Plan"}
                        </h3>

                        {/* Prominent Projected Time Card */}
                        <div className={`p-3 border font-mono text-center space-y-1 ${
                          plan.is_lowest_time ? "bg-emerald-950/40 border-emerald-500/50" : "bg-slate-950 border-slate-800"
                        }`}>
                          <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
                            Estimated Total Race Time
                          </span>
                          <span className={`text-xl font-bold font-mono ${plan.is_lowest_time ? "text-emerald-300" : "text-slate-100"}`}>
                            {plan.total_projected_time_str}
                          </span>
                          <span className="text-[10px] text-slate-400 block pt-0.5">
                            {plan.stops_count} Stop{plan.stops_count !== 1 ? "s" : ""} (+{plan.pit_loss_total_seconds}s pit loss)
                          </span>
                        </div>
                      </div>

                      {/* Stints Sequence Column Breakdown */}
                      <div className="space-y-3">
                        <h4 className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                          Planned Stint Breakdown:
                        </h4>
                        {plan.stint_estimates.map((st) => (
                          <div
                            key={st.stint_number}
                            className="bg-slate-950 p-3 border border-slate-800 text-xs space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-100">
                                Stint #{st.stint_number}
                              </span>
                              <span className={`sharp-tag border px-2 py-0.5 text-[10px] font-bold ${getCompoundColor(st.compound)}`}>
                                {st.compound}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div>
                                <span className="text-slate-500 block text-[10px]">Stint Length</span>
                                <span className="text-slate-200">Laps {st.start_lap}–{st.end_lap} ({st.stint_length} laps)</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[10px]">Degradation Rate</span>
                                <span className="text-amber-300">+{st.degradation_rate.toFixed(4)} s/lap</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-900">
                              <div>
                                <span className="text-slate-500 block text-[10px]">Fresh Base Pace</span>
                                <span className="text-purple-300">{st.base_pace.toFixed(3)}s</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[10px]">Stint Projected Time</span>
                                <span className="text-emerald-300 font-bold">{st.stint_projected_time_seconds}s</span>
                              </div>
                            </div>

                            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                              Data source: <span className="text-slate-400 font-sans">{getSourceLabel(st.degradation_source)}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Framing Label per column */}
                      <p className="text-[10px] text-slate-400 text-center italic pt-2">
                        {plan.estimation_label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Strategy Plan Authoring Modal with Pit Window Recommendation Reference Input */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl border border-slate-700 bg-slate-surface p-6 shadow-2xl space-y-6 border-l-2 border-l-cyan-400 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="sharp-tag bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono">
                  [Author Strategy Plan]
                </span>
                <h2 className="text-lg font-semibold tracking-tight text-slate-100 mt-1">
                  Compose Race Strategy Plan
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200 font-mono">
                ✕
              </button>
            </div>

            {/* Embedded Pit Window Recommendation Reference Card */}
            <div className="border border-purple-500/30 bg-purple-950/20 p-4 border-l-2 border-l-purple-500 text-xs font-mono space-y-2">
              <div className="flex items-center justify-between text-purple-300 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Zap size={14} className="text-purple-400" /> Reference Input: Deterministic Pit Stop Window Recommendation
                </span>
                {loadingRec && <span className="text-slate-400">Calculating recommendation...</span>}
              </div>
              {pitRecommendation ? (
                <div className="space-y-1.5">
                  <p className="text-slate-200 leading-relaxed text-[11px]">
                    {pitRecommendation.reasoning}
                  </p>
                  {pitRecommendation.recommended_window_start && (
                    <div className="pt-1 flex items-center gap-3">
                      <span className="sharp-tag bg-purple-500/20 text-purple-200 border border-purple-400/40 px-2.5 py-1 text-xs">
                        Target Pit Window: Laps {pitRecommendation.recommended_window_start} – {pitRecommendation.recommended_window_end}
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        Circuit Pit Loss: {pitRecommendation.pit_loss_seconds}s
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-400 text-[11px]">
                  Select session and driver code below to view real-time pit window recommendations.
                </p>
              )}
            </div>

            {/* Form Fields */}
            <form onSubmit={handleCreateStrategy} className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Session ID</label>
                  <input
                    type="text"
                    value={formSessionId}
                    onChange={(e) => setFormSessionId(e.target.value)}
                    className="w-full border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-cyan-400 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Driver code</label>
                  <input
                    type="text"
                    value={formDriverCode}
                    onChange={(e) => setFormDriverCode(e.target.value.toUpperCase())}
                    className="w-full border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-cyan-400 focus:outline-none font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Plan title</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-cyan-400 focus:outline-none font-sans"
                    required
                  />
                </div>
              </div>

              {/* Stints Authoring Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="font-semibold text-slate-200 text-xs font-sans">Stint Sequence Authoring</h4>
                  <button
                    type="button"
                    onClick={handleAddStint}
                    className="sharp-tag border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-cyan-300 hover:bg-slate-800"
                  >
                    + Add stint
                  </button>
                </div>

                {stints.map((stint, idx) => (
                  <div key={idx} className="grid grid-cols-6 gap-2 bg-slate-950 p-3 border border-slate-800 items-center">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Stint</span>
                      <span className="font-bold text-slate-100">#{stint.stint_number}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] block">Compound</span>
                      <select
                        value={stint.compound}
                        onChange={(e) => handleStintChange(idx, "compound", e.target.value)}
                        className="w-full border border-slate-800 bg-slate-900 px-2 py-1 text-slate-100 focus:border-cyan-400 focus:outline-none text-xs"
                      >
                        <option value="SOFT">SOFT</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HARD">HARD</option>
                        <option value="INTERMEDIATE">INTERMEDIATE</option>
                        <option value="WET">WET</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] block">Start lap</span>
                      <input
                        type="number"
                        value={stint.start_lap}
                        onChange={(e) => handleStintChange(idx, "start_lap", Number(e.target.value))}
                        className="w-full border border-slate-800 bg-slate-900 px-2 py-1 text-slate-100 text-xs"
                      />
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] block">End lap</span>
                      <input
                        type="number"
                        value={stint.end_lap}
                        onChange={(e) => handleStintChange(idx, "end_lap", Number(e.target.value))}
                        className="w-full border border-slate-800 bg-slate-900 px-2 py-1 text-slate-100 text-xs"
                      />
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] block">Target pit lap</span>
                      <input
                        type="number"
                        value={stint.target_pit_lap || ""}
                        onChange={(e) => handleStintChange(idx, "target_pit_lap", e.target.value ? Number(e.target.value) : undefined)}
                        placeholder="Optional"
                        className="w-full border border-slate-800 bg-slate-900 px-2 py-1 text-slate-100 text-xs"
                      />
                    </div>

                    <div className="text-right">
                      {stints.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveStint(idx)}
                          className="text-red-400 hover:text-red-300 text-xs font-semibold"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="border border-cyan-500/40 bg-cyan-500/20 px-5 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-400 hover:text-slate-950 transition-colors disabled:opacity-50"
                >
                  {submitting ? "Saving strategy..." : "Save Strategy Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
