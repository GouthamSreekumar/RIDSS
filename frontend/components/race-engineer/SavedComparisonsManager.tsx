"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Save, Trash2, ExternalLink, Sliders, CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import axiosInstance from "@/lib/axios";

export interface SavedComparison {
  id: string;
  user_id: string;
  season: number;
  circuit: string;
  session_type: string;
  driver_a: string;
  lap_a: number;
  driver_b: string;
  lap_b: number;
  label?: string | null;
  created_at: string;
}

interface SaveComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  season: number;
  circuit: string;
  sessionType: string;
  driverA: string;
  lapA: number;
  driverB: string;
  lapB: number;
  onSuccess?: () => void;
}

export function SaveComparisonModal({
  isOpen,
  onClose,
  season,
  circuit,
  sessionType,
  driverA,
  lapA,
  driverB,
  lapB,
  onSuccess,
}: SaveComparisonModalProps) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.post("/api/v1/race-engineer/saved-comparisons", {
        season,
        circuit,
        session_type: sessionType,
        driver_a: driverA,
        lap_a: lapA,
        driver_b: driverB,
        lap_b: lapB,
        label: label.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      setLabel("");
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ["savedComparisons"] });
      onClose();
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || "Failed to save comparison.");
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 font-sans">
      <div className="w-full max-w-md border border-slate-700 bg-slate-surface p-5 shadow-2xl space-y-4 border-l-2 border-l-amber-400">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-semibold tracking-tight text-slate-100 flex items-center gap-2">
            <Bookmark size={16} className="text-amber-400" /> Save Telemetry Comparison
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 p-2.5 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle size={14} /> {errorMsg}
          </div>
        )}

        <div className="bg-slate-950 p-3 border border-slate-800 text-xs font-mono space-y-1 text-slate-300">
          <p className="text-amber-400 font-bold">Comparison Details:</p>
          <p>• Event: {season} {circuit} ({sessionType})</p>
          <p>• Primary (A): Driver {driverA} — Lap #{lapA}</p>
          <p>• Secondary (B): Driver {driverB} — Lap #{lapB}</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Comparison Label (Optional):
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Monaco T7 exit comparison"
            className="w-full border border-slate-700 bg-slate-950 p-2 text-xs text-slate-100 font-mono focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 font-mono">
          <button
            type="button"
            onClick={onClose}
            className="border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-amber-400 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Save size={14} />
            {saveMutation.isPending ? "Saving..." : "Save Comparison"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SavedComparisonsList() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: savedList = [], isLoading, isError } = useQuery<SavedComparison[]>({
    queryKey: ["savedComparisons"],
    queryFn: async () => {
      const res = await axiosInstance.get("/api/v1/race-engineer/saved-comparisons");
      return res.data;
    },
    staleTime: 30 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axiosInstance.delete(`/api/v1/race-engineer/saved-comparisons/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedComparisons"] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || "Failed to delete saved comparison.");
    },
  });

  const handleOpenComparison = (item: SavedComparison) => {
    // Format session slug e.g. "2024_Bahrain_Race"
    const sessionSlug = `${item.season}_${item.circuit.replace(/\s+/g, "%20")}_${item.session_type}`;
    const url = `/race-engineer/telemetry/${encodeURIComponent(sessionSlug)}/${encodeURIComponent(item.driver_a)}/${item.lap_a}?circuit=${encodeURIComponent(item.circuit)}&season=${item.season}&sec_driver=${encodeURIComponent(item.driver_b)}&sec_lap=${item.lap_b}&comparison=true`;
    router.push(url);
  };

  return (
    <div className="border border-slate-800 bg-slate-surface p-4 border-l-2 border-l-amber-400 space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="text-sm font-semibold tracking-tight text-slate-100 flex items-center gap-2">
          <Bookmark size={16} className="text-amber-400" /> Saved Comparisons
        </h3>
        <span className="sharp-tag bg-amber-500/10 text-amber-300 border border-amber-500/30 font-mono text-[10px]">
          {savedList.length} saved
        </span>
      </div>

      {isLoading ? (
        <div className="text-xs text-slate-400 font-mono py-3">Loading saved comparisons...</div>
      ) : isError ? (
        <div className="text-xs text-red-400 py-2">Error loading saved comparisons.</div>
      ) : savedList.length === 0 ? (
        <div className="text-xs text-slate-500 font-mono py-4 text-center border border-dashed border-slate-800 bg-slate-950/50">
          No saved comparisons yet. Activate comparison mode on telemetry details to save standard reference laps.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {savedList.map((item) => (
            <div
              key={item.id}
              className="border border-slate-800 bg-slate-950 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:border-amber-500/40 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-100 font-mono">
                    {item.label || `${item.circuit} ${item.session_type} Comparison`}
                  </span>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 border border-amber-500/20">
                    {item.season}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  <span className="text-cyan-400">Driver {item.driver_a} (Lap #{item.lap_a})</span> vs{" "}
                  <span className="text-amber-400">Driver {item.driver_b} (Lap #{item.lap_b})</span>
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  Circuit: {item.circuit} ({item.session_type}) • Saved{" "}
                  {new Date(item.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center font-mono">
                <button
                  onClick={() => handleOpenComparison(item)}
                  className="inline-flex items-center gap-1 bg-amber-500/10 hover:bg-amber-400 text-amber-300 hover:text-slate-950 border border-amber-500/30 px-2.5 py-1 text-xs font-semibold transition-colors"
                >
                  <ExternalLink size={12} /> Open & Refetch
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this saved comparison?")) {
                      deleteMutation.mutate(item.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                  title="Delete comparison"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
