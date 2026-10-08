"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Layers,
  Plus,
  Search,
  Target,
  Trophy,
} from "lucide-react";
import axiosInstance from "@/lib/axios";
import { FastF1LoadingSkeleton } from "@/components/race-engineer/FastF1LoadingSkeleton";

// ── Types ──────────────────────────────────────────────────────────────────────

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
  session_id?: string;
  season?: number;
  round?: number;
  created_by: string;
  creator_name: string;
  title?: string;
  driver_code?: string;
  plan: StintPlan[];
  created_at: string;
  is_legacy: boolean;
}

interface UpcomingEvent {
  round: number;
  event_name: string;
  circuit: string;
  country: string;
  race_date?: string;
}

interface EventDriver {
  driver_code: string;
  full_name?: string;
  driver_number?: number;
}

interface EventDriversResponse {
  season: number;
  round: number;
  event_name: string;
  drivers: EventDriver[];
  roster_basis_event?: string;
  roster_basis_season?: number;
}

interface CompoundGuide {
  compound: string;
  degradation_rate?: number;
  base_pace?: number;
  degradation_source: string;
  source_detail?: string;
  estimated_viable_stint_min?: number;
  estimated_viable_stint_max?: number;
  degradation_rate_unreliable: boolean;
  reliability_caution?: string;
}

interface PlanningReference {
  event_name: string;
  circuit_name: string;
  season: number;
  round: number;
  pit_loss_seconds: number;
  default_total_laps: number;
  compounds: CompoundGuide[];
  data_basis_note: string;
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
  season: number;
  round: number;
  circuit_name: string;
  pit_loss_seconds: number;
  compared_strategies: StrategyComparisonItem[];
  disclaimer: string;
}

// ── API helpers ────────────────────────────────────────────────────────────────

async function fetchRaceStrategies(): Promise<RaceStrategy[]> {
  const res = await axiosInstance.get("/api/v1/strategy-engineer/strategies");
  return res.data;
}

async function fetchUpcomingEvents(): Promise<{ season: number; events: UpcomingEvent[] }> {
  const res = await axiosInstance.get("/api/v1/strategy-engineer/upcoming-events");
  return res.data;
}

async function fetchEventDrivers(round: number): Promise<EventDriversResponse> {
  const res = await axiosInstance.get(`/api/v1/strategy-engineer/upcoming-events/${round}/drivers`);
  return res.data;
}

async function fetchPlanningReference(round: number): Promise<PlanningReference> {
  const res = await axiosInstance.get(`/api/v1/strategy-engineer/upcoming-events/${round}/planning-reference`);
  return res.data;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function RaceStrategiesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [formTitle, setFormTitle] = useState("");
  const [totalLaps, setTotalLaps] = useState<number>(57);
  const [stints, setStints] = useState<StintPlan[]>([
    { stint_number: 1, compound: "MEDIUM", start_lap: 1, end_lap: 18, target_pit_lap: 18 },
    { stint_number: 2, compound: "HARD", start_lap: 19, end_lap: 38, target_pit_lap: 38 },
    { stint_number: 3, compound: "SOFT", start_lap: 39, end_lap: 57 },
  ]);

  // Comparison state
  const [selectedStrategyIds, setSelectedStrategyIds] = useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: strategies, isLoading } = useQuery<RaceStrategy[]>({
    queryKey: ["raceStrategiesList"],
    queryFn: fetchRaceStrategies,
    staleTime: 60_000,
  });

  const { data: upcomingData, isLoading: loadingEvents } = useQuery({
    queryKey: ["upcomingEvents"],
    queryFn: fetchUpcomingEvents,
    enabled: isModalOpen,
    staleTime: 5 * 60_000,
  });

  const { data: driversData, isLoading: loadingDrivers } = useQuery<EventDriversResponse>({
    queryKey: ["eventDrivers", selectedRound],
    queryFn: () => fetchEventDrivers(selectedRound!),
    enabled: isModalOpen && selectedRound !== null,
    staleTime: 5 * 60_000,
  });

  const { data: planningRef, isLoading: loadingRef } = useQuery<PlanningReference>({
    queryKey: ["planningReference", selectedRound],
    queryFn: () => fetchPlanningReference(selectedRound!),
    enabled: isModalOpen && selectedRound !== null,
    staleTime: 5 * 60_000,
    onSuccess: (data) => {
      // Pre-fill total laps from planning reference when round is first selected
      if (data.default_total_laps) setTotalLaps(data.default_total_laps);
    },
  });

  const { data: comparisonData, isLoading: loadingComparison, isError: isErrorComparison } =
    useQuery<StrategyComparisonResponse>({
      queryKey: ["strategyComparison", selectedStrategyIds],
      queryFn: async () => {
        const idsQuery = selectedStrategyIds
          .map((id) => `strategy_ids=${encodeURIComponent(id)}`)
          .join("&");
        const res = await axiosInstance.get(`/api/v1/strategy-engineer/strategies/compare?${idsQuery}`);
        return res.data;
      },
      enabled: isCompareModalOpen && selectedStrategyIds.length >= 2,
    });

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRound || !upcomingData) throw new Error("No event selected.");
      const season = upcomingData.season;
      await axiosInstance.post("/api/v1/strategy-engineer/strategies", {
        season,
        round: selectedRound,
        driver_code: selectedDriver || undefined,
        title: formTitle || undefined,
        total_laps: totalLaps,
        plan: stints,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raceStrategiesList"] });
      setIsModalOpen(false);
      setSelectedRound(null);
      setSelectedDriver("");
      setFormTitle("");
    },
    onError: (err: any) => {
      alert(`Failed to save strategy plan: ${err?.response?.data?.detail || err.message}`);
    },
  });

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const handleAddStint = () => {
    const next = stints.length + 1;
    const prevEnd = stints.length > 0 ? stints[stints.length - 1].end_lap : 1;
    setStints([
      ...stints,
      {
        stint_number: next,
        compound: "MEDIUM",
        start_lap: prevEnd + 1,
        end_lap: prevEnd + 18,
        target_pit_lap: prevEnd + 18,
      },
    ]);
  };

  const handleRemoveStint = (idx: number) => {
    if (stints.length <= 1) return;
    setStints(
      stints.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stint_number: i + 1 }))
    );
  };

  const handleStintChange = (idx: number, field: keyof StintPlan, value: any) => {
    const updated = [...stints];
    updated[idx] = { ...updated[idx], [field]: value };
    setStints(updated);
  };

  const toggleSelectStrategy = (id: string) => {
    setSelectedStrategyIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const getCompoundColor = (compound: string) => {
    switch (compound.toUpperCase()) {
      case "SOFT": return "text-red-400 border-red-500/40 bg-red-950/20";
      case "MEDIUM": return "text-amber-400 border-amber-500/40 bg-amber-950/20";
      case "HARD": return "text-slate-200 border-slate-400/40 bg-slate-800/40";
      case "INTERMEDIATE": return "text-green-400 border-green-500/40 bg-green-950/20";
      case "WET": return "text-blue-400 border-blue-500/40 bg-blue-950/20";
      default: return "text-purple-400 border-purple-500/40 bg-purple-950/20";
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case "actual_session": return "Session-specific degradation data";
      case "historical": return "Historical same-circuit degradation data";
      case "historical_circuit": return "Historical circuit data";
      case "default_fallback": return "Built-in baseline compound model";
      default: return "Default compound model";
    }
  };

  const filteredStrategies = (strategies || []).filter((s) => {
    const q = searchTerm.toLowerCase();
    return (
      (s.title || "").toLowerCase().includes(q) ||
      (s.session_id || "").toLowerCase().includes(q) ||
      (s.driver_code || "").toLowerCase().includes(q) ||
      String(s.round || "").includes(q)
    );
  });

  const legacyStrategies = filteredStrategies.filter((s) => s.is_legacy);
  const modernStrategies = filteredStrategies.filter((s) => !s.is_legacy);

  if (isLoading) {
    return <FastF1LoadingSkeleton title="Loading Race Strategies" message="Fetching strategy plan repository..." />;
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-cyan-400">
        <div>
          <div className="flex items-center gap-2 mb-1.5 font-mono">
            <span className="sharp-tag bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              <Target size={12} className="text-cyan-400 mr-1" /> Pre-race strategy plans
            </span>
            <span className="text-xs text-slate-400">• Author plans for upcoming events · compare scenarios</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">
            Race Strategy Composition &amp; Scenario Comparison
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Author stint plans for upcoming race events. Use historical circuit degradation data to select
            compounds and pit-lap windows, then compare scenarios side-by-side.
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

      {/* Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search plans…"
            className="w-full border border-slate-800 bg-slate-surface pl-9 pr-4 py-2 text-xs text-slate-100 font-mono focus:border-cyan-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
          {selectedStrategyIds.length > 0 && (
            <span className="text-cyan-300">
              Selected: <strong>{selectedStrategyIds.length}</strong>
              <button onClick={() => setSelectedStrategyIds([])} className="ml-2 text-slate-500 hover:text-slate-300 underline">
                Clear
              </button>
            </span>
          )}
          <span>Total plans: <strong className="text-slate-200 tabular-nums">{filteredStrategies.length}</strong></span>
        </div>
      </div>

      {/* Modern plans */}
      {modernStrategies.length > 0 && (
        <StrategyCardGrid
          strategies={modernStrategies}
          selectedIds={selectedStrategyIds}
          onToggle={toggleSelectStrategy}
          getCompoundColor={getCompoundColor}
        />
      )}

      {/* Legacy plans */}
      {legacyStrategies.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
            <AlertCircle size={12} className="text-amber-400" />
            <span className="text-amber-300 font-semibold">Legacy Plans</span>
            <span>— authored before the event-based planning system ({legacyStrategies.length} plan{legacyStrategies.length !== 1 ? "s" : ""})</span>
          </div>
          <StrategyCardGrid
            strategies={legacyStrategies}
            selectedIds={selectedStrategyIds}
            onToggle={toggleSelectStrategy}
            getCompoundColor={getCompoundColor}
            dimmed
          />
        </div>
      )}

      {filteredStrategies.length === 0 && (
        <div className="border border-slate-800 bg-slate-surface p-8 text-center text-xs text-slate-500 font-mono">
          No strategy plans found. Click "Author new strategy" to create your first pre-race plan.
        </div>
      )}

      {/* ── Comparison Modal ───────────────────────────────────────────────────── */}
      {isCompareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto">
          <div className="w-full max-w-6xl border border-slate-700 bg-slate-surface p-6 shadow-2xl space-y-6 border-l-2 border-l-emerald-400 my-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="sharp-tag bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-mono">
                  Side-by-Side Scenario Comparison
                </span>
                <h2 className="text-lg font-semibold tracking-tight text-slate-100 mt-1">
                  Strategy Plan Projected Time Comparison
                </h2>
              </div>
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 font-mono text-sm px-2 py-1 border border-slate-800"
              >
                ✕ Close
              </button>
            </div>

            <div className="border border-emerald-500/30 bg-emerald-950/20 p-4 border-l-2 border-l-emerald-500 text-xs font-mono space-y-1">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                <Info size={14} className="text-emerald-400 shrink-0" />
                <span>Phase 1 Deterministic Estimate — based on historical circuit degradation data, not a guarantee</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Projects total race time per plan by summing each stint's projected lap times (base pace + degradation rate × lap number)
                plus the circuit's pit-lane loss constant per planned stop.
              </p>
            </div>

            {loadingComparison ? (
              <FastF1LoadingSkeleton title="Computing Comparison" message="Aggregating compound degradation rates…" />
            ) : isErrorComparison || !comparisonData ? (
              <div className="border border-red-900/40 bg-red-950/20 p-6 border-l-2 border-l-red-500 font-mono text-xs text-red-300">
                Failed to execute comparison. Ensure all selected plans belong to the same event (same season and round).
              </div>
            ) : (
              <div className="space-y-6 font-mono">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-3 border border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Event</span>
                    <span className="font-bold text-slate-100">
                      {comparisonData.circuit_name} — Season {comparisonData.season}
                      {comparisonData.round ? ` Round ${comparisonData.round}` : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Pit-Lane Loss Constant</span>
                    <span className="font-bold text-amber-300">{comparisonData.pit_loss_seconds}s per stop</span>
                  </div>
                </div>

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
                        <h3 className="text-sm font-semibold text-slate-100 font-sans">{plan.title || "Strategy Plan"}</h3>
                        <div className={`p-3 border font-mono text-center space-y-1 ${plan.is_lowest_time ? "bg-emerald-950/40 border-emerald-500/50" : "bg-slate-950 border-slate-800"}`}>
                          <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Estimated Total Race Time</span>
                          <span className={`text-xl font-bold ${plan.is_lowest_time ? "text-emerald-300" : "text-slate-100"}`}>
                            {plan.total_projected_time_str}
                          </span>
                          <span className="text-[10px] text-slate-400 block pt-0.5">
                            {plan.stops_count} Stop{plan.stops_count !== 1 ? "s" : ""} (+{plan.pit_loss_total_seconds}s pit loss)
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Stint Breakdown:</h4>
                        {plan.stint_estimates.map((st) => (
                          <div key={st.stint_number} className="bg-slate-950 p-3 border border-slate-800 text-xs space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-100">Stint #{st.stint_number}</span>
                              <span className={`sharp-tag border px-2 py-0.5 text-[10px] font-bold ${getCompoundColor(st.compound)}`}>
                                {st.compound}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div>
                                <span className="text-slate-500 block text-[10px]">Length</span>
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
                              Data source: <span className="text-slate-400">{getSourceLabel(st.degradation_source)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 text-center italic pt-2">{plan.estimation_label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Compose Strategy Plan Modal ────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl border border-slate-700 bg-slate-surface p-6 shadow-2xl space-y-6 border-l-2 border-l-cyan-400 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="sharp-tag bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono">
                  Author Strategy Plan
                </span>
                <h2 className="text-lg font-semibold tracking-tight text-slate-100 mt-1">
                  Compose Pre-Race Strategy Plan
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200 font-mono">✕</button>
            </div>

            {/* ── Pre-race Planning Reference Box ──────────────────────────────── */}
            <div className="border border-cyan-500/20 bg-cyan-950/10 p-4 border-l-2 border-l-cyan-500 text-xs font-mono space-y-3">
              <div className="flex items-center justify-between text-cyan-300 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Info size={14} className="text-cyan-400" />
                  Phase 1 Deterministic Estimate — Historical Compound Planning Guide
                </span>
                {loadingRef && <span className="text-slate-400">Loading…</span>}
              </div>

              {!selectedRound ? (
                <p className="text-slate-400 text-[11px]">
                  Select an upcoming race event above to view historical compound degradation data for that circuit.
                </p>
              ) : planningRef ? (
                <div className="space-y-3">
                  <p className="text-slate-400 text-[11px] leading-relaxed">{planningRef.data_basis_note}</p>

                  {/* Pit-lane loss */}
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="text-slate-400">Circuit pit-lane loss constant:</span>
                    <span className="font-bold text-amber-300">{planningRef.pit_loss_seconds}s</span>
                    <span className="text-slate-400">Default total laps:</span>
                    <span className="font-bold text-cyan-300">{totalLaps}</span>
                    <span className="text-slate-500">(editable above)</span>
                  </div>

                  {/* Compound table */}
                  <div className="space-y-2">
                    {planningRef.compounds
                      .filter((c) => ["SOFT", "MEDIUM", "HARD"].includes(c.compound))
                      .map((c) => (
                        <div
                          key={c.compound}
                          className={`p-3 border text-[11px] space-y-1 ${
                            c.degradation_rate_unreliable
                              ? "border-amber-500/30 bg-amber-950/10"
                              : "border-slate-800 bg-slate-950"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`font-bold sharp-tag border px-2 py-0.5 text-[10px] ${getCompoundColor(c.compound)}`}>
                              {c.compound}
                            </span>
                            {c.degradation_rate_unreliable ? (
                              <span className="flex items-center gap-1 text-amber-400 text-[10px]">
                                <AlertTriangle size={11} /> Unreliable estimate
                              </span>
                            ) : (
                              <div className="flex items-center gap-3 text-[11px]">
                                <span className="text-slate-400">
                                  Degradation: <span className="text-amber-300 font-semibold">{c.degradation_rate?.toFixed(4)} s/lap</span>
                                </span>
                                {c.estimated_viable_stint_min != null && (
                                  <span className="text-slate-400">
                                    Indicative stint: <span className="text-cyan-300 font-semibold">
                                      ~{c.estimated_viable_stint_min}–{c.estimated_viable_stint_max} laps
                                    </span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          {c.degradation_rate_unreliable && c.reliability_caution && (
                            <p className="text-amber-300 text-[10px] leading-relaxed">{c.reliability_caution}</p>
                          )}
                          <p className="text-slate-500 text-[10px]">
                            Source: {c.source_detail || c.degradation_source}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* ── Form ─────────────────────────────────────────────────────────── */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="space-y-4 font-mono text-xs"
            >
              <div className="grid grid-cols-3 gap-3">
                {/* Event picker */}
                <div>
                  <label className="block text-slate-400 mb-1">Upcoming event</label>
                  {loadingEvents ? (
                    <div className="border border-slate-800 bg-slate-950 px-3 py-2 text-slate-500">Loading events…</div>
                  ) : (
                    <select
                      value={selectedRound ?? ""}
                      onChange={(e) => {
                        const r = e.target.value ? Number(e.target.value) : null;
                        setSelectedRound(r);
                        setSelectedDriver("");
                      }}
                      required
                      className="w-full border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="">Select event…</option>
                      {(upcomingData?.events || []).map((ev) => (
                        <option key={ev.round} value={ev.round}>
                          R{ev.round} — {ev.event_name} {ev.race_date ? `(${ev.race_date.slice(0, 10)})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  {upcomingData?.events.length === 0 && (
                    <p className="text-amber-400 text-[10px] mt-1">No upcoming events in the current season.</p>
                  )}
                </div>

                {/* Driver picker */}
                <div>
                  <label className="block text-slate-400 mb-1">Driver</label>
                  {!selectedRound ? (
                    <div className="border border-slate-800 bg-slate-950 px-3 py-2 text-slate-600">
                      Select an event first
                    </div>
                  ) : loadingDrivers ? (
                    <div className="border border-slate-800 bg-slate-950 px-3 py-2 text-slate-500">Loading roster…</div>
                  ) : (
                    <>
                      <select
                        value={selectedDriver}
                        onChange={(e) => setSelectedDriver(e.target.value)}
                        className="w-full border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-cyan-400 focus:outline-none font-bold"
                      >
                        <option value="">Any / team</option>
                        {(driversData?.drivers || []).map((d) => (
                          <option key={d.driver_code} value={d.driver_code}>
                            {d.driver_code}{d.full_name ? ` — ${d.full_name}` : ""}
                          </option>
                        ))}
                      </select>
                      {driversData?.roster_basis_event && (
                        <p className="text-slate-500 text-[10px] mt-1">{driversData.roster_basis_event}</p>
                      )}
                    </>
                  )}
                </div>

                {/* Plan title */}
                <div>
                  <label className="block text-slate-400 mb-1">Plan title</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. 2-Stop Medium–Hard–Soft"
                    className="w-full border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-cyan-400 focus:outline-none font-sans"
                  />
                </div>
              </div>

              {/* Total laps override */}
              <div className="flex items-center gap-3 text-[11px]">
                <label className="text-slate-400">Total race laps:</label>
                <input
                  type="number"
                  value={totalLaps}
                  onChange={(e) => setTotalLaps(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="w-20 border border-slate-800 bg-slate-950 px-2 py-1 text-slate-100 text-xs"
                />
                {planningRef && (
                  <span className="text-slate-500">
                    (default from most recent {planningRef.circuit_name} edition: {planningRef.default_total_laps} laps)
                  </span>
                )}
              </div>

              {/* Stint authoring */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="font-semibold text-slate-200 text-xs font-sans">Stint Sequence</h4>
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
                        value={stint.target_pit_lap ?? ""}
                        onChange={(e) =>
                          handleStintChange(idx, "target_pit_lap", e.target.value ? Number(e.target.value) : undefined)
                        }
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
                  disabled={createMutation.isPending || !selectedRound}
                  className="border border-cyan-500/40 bg-cyan-500/20 px-5 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-400 hover:text-slate-950 transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? "Saving…" : "Save Strategy Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-component: strategy card grid ─────────────────────────────────────────

function StrategyCardGrid({
  strategies,
  selectedIds,
  onToggle,
  getCompoundColor,
  dimmed = false,
}: {
  strategies: RaceStrategy[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  getCompoundColor: (c: string) => string;
  dimmed?: boolean;
}) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${dimmed ? "opacity-70" : ""}`}>
      {strategies.map((strat) => {
        const isSelected = selectedIds.includes(strat.id);
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
                  onChange={() => onToggle(strat.id)}
                  className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-400 focus:ring-cyan-400 cursor-pointer"
                />
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 font-sans">
                    {strat.title || `Round ${strat.round ?? ""} Plan`}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {strat.season && strat.round
                      ? <>Season <span className="text-cyan-300">{strat.season}</span> · Round <span className="text-cyan-300">{strat.round}</span></>
                      : <span className="text-amber-400">{strat.session_id}</span>
                    }
                  </p>
                </div>
              </div>
              <span className="sharp-tag bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono shrink-0">
                {strat.driver_code || "TEAM"}
              </span>
            </div>

            <div className="space-y-2 py-3">
              <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Planned Stint Sequence:</p>
              <div className="space-y-1.5 font-mono text-xs">
                {strat.plan && strat.plan.length > 0 ? (
                  strat.plan.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-950 p-2.5 border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="text-purple-400 font-bold">Stint #{s.stint_number}:</span>
                        <span className={`font-semibold sharp-tag border px-1.5 py-0.5 text-[10px] ${getCompoundColor(s.compound)}`}>
                          {s.compound}
                        </span>
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
                <button onClick={() => onToggle(strat.id)} className="text-xs text-cyan-300 hover:underline">
                  {isSelected ? "Deselect" : "Select for Compare"}
                </button>
                <span>• {new Date(strat.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
