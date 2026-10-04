"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Compass,
  FileText,
  Info,
  Layers,
  Plus,
  Radio,
  Search,
  Shield,
  Target,
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
  const [selectedStrategy, setSelectedStrategy] = useState<RaceStrategy | null>(null);

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

  // Fetch Strategies
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
            <span className="text-xs text-slate-400">• Manually authored plans</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">
            Race strategy composition & repository
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Author stint plans, target pit laps, and compound selection informed by pit stop recommendation calculations.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="sharp-tag border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-mono font-semibold text-cyan-300 hover:bg-cyan-400 hover:text-slate-950 transition-colors flex items-center gap-1.5"
        >
          <Plus size={14} /> Author new strategy
        </button>
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

        <span className="text-xs font-mono text-slate-400">
          Total plans: <strong className="text-slate-200 tabular-nums">{filteredStrategies.length}</strong>
        </span>
      </div>

      {/* Strategies List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredStrategies.length === 0 ? (
          <div className="col-span-full border border-slate-800 bg-slate-surface p-8 text-center text-xs text-slate-500 font-mono">
            No race strategy plans found. Click "Author new strategy" to create your first plan.
          </div>
        ) : (
          filteredStrategies.map((strat) => (
            <div
              key={strat.id}
              className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-cyan-400 space-y-4 hover:border-cyan-500/40 transition-colors"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 font-sans">
                    {strat.title || strat.session_id}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Session: <span className="text-cyan-300">{strat.session_id}</span>
                  </p>
                </div>
                <span className="sharp-tag bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono">
                  {strat.driver_code || "TEAM DRIVER"}
                </span>
              </div>

              {/* Stint Plan Sequence */}
              <div className="space-y-2">
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
                <span>{new Date(strat.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>

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
