"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, AlertCircle, Calendar, Flag, Globe, MapPin, Plus, Ruler, Trash2, X,
} from "lucide-react";
import { useState } from "react";
import {
  createCircuit, createRace, deleteCircuit, deleteRace,
  fetchCircuits, fetchRaces,
  type Circuit, type CircuitCreate, type Race, type RaceCreate,
} from "@/features/admin/api/adminApi";

const inputCls = "w-full rounded-lg border border-slate-700 bg-graphite-800 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-ferrari-red focus:border-transparent transition-all";
const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500";

// ── Create Race Modal ──────────────────────────────────────────────────────────

function CreateRaceModal({
  onClose, circuits,
}: {
  onClose: () => void;
  circuits: Circuit[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RaceCreate>({
    race_name: "", circuit_id: "", race_date: "", season: new Date().getFullYear(),
  });
  const [err, setErr] = useState("");

  const mutation = useMutation({
    mutationFn: createRace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-races"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      onClose();
    },
    onError: (e: Error & { response?: { data?: { detail?: string } } }) => {
      setErr(e.response?.data?.detail ?? "Failed to create race.");
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-sm font-bold text-slate-100">Add Race Event</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>
        <form onSubmit={e => {
          e.preventDefault();
          mutation.mutate({ ...form, race_date: new Date(form.race_date).toISOString() });
        }} className="space-y-4 p-6">
          <div>
            <label className={labelCls}>Race Name</label>
            <input className={inputCls} placeholder="e.g. Monaco Grand Prix" value={form.race_name}
              onChange={e => setForm(f => ({ ...f, race_name: e.target.value }))} required />
          </div>
          <div>
            <label className={labelCls}>Circuit</label>
            <select className={inputCls + " appearance-none"} value={form.circuit_id}
              onChange={e => setForm(f => ({ ...f, circuit_id: e.target.value }))} required>
              <option value="">Select circuit…</option>
              {circuits.map(c => <option key={c.circuit_id} value={c.circuit_id}>{c.circuit_name} ({c.country})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Race Date</label>
              <input type="datetime-local" className={inputCls} value={form.race_date}
                onChange={e => setForm(f => ({ ...f, race_date: e.target.value }))} required />
            </div>
            <div>
              <label className={labelCls}>Season</label>
              <input type="number" className={inputCls} value={form.season} min={1950} max={2100}
                onChange={e => setForm(f => ({ ...f, season: parseInt(e.target.value) }))} required />
            </div>
          </div>
          {err && <p className="flex items-center gap-2 text-xs text-red-400"><AlertCircle size={12} /> {err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 py-2.5 text-sm text-slate-400 hover:text-slate-200 transition-all">Cancel</button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 rounded-lg bg-ferrari-red py-2.5 text-sm font-semibold text-white hover:bg-ferrari-red/90 disabled:opacity-60 transition-all">
              {mutation.isPending ? "Adding…" : "Add Race"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Create Circuit Modal ───────────────────────────────────────────────────────

function CreateCircuitModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CircuitCreate>({ circuit_name: "", country: "", length: 0 });
  const [err, setErr] = useState("");

  const mutation = useMutation({
    mutationFn: createCircuit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-circuits"] });
      onClose();
    },
    onError: (e: Error & { response?: { data?: { detail?: string } } }) => {
      setErr(e.response?.data?.detail ?? "Failed to create circuit.");
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
        className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-sm font-bold text-slate-100">Add Circuit</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4 p-6">
          <div>
            <label className={labelCls}>Circuit Name</label>
            <input className={inputCls} placeholder="e.g. Circuit de Monaco" value={form.circuit_name}
              onChange={e => setForm(f => ({ ...f, circuit_name: e.target.value }))} required />
          </div>
          <div>
            <label className={labelCls}>Country</label>
            <input className={inputCls} placeholder="e.g. Monaco" value={form.country}
              onChange={e => setForm(f => ({ ...f, country: e.target.value }))} required />
          </div>
          <div>
            <label className={labelCls}>Length (km)</label>
            <input type="number" step="0.001" min="0.1" className={inputCls} placeholder="e.g. 3.337" value={form.length || ""}
              onChange={e => setForm(f => ({ ...f, length: parseFloat(e.target.value) }))} required />
          </div>
          {err && <p className="flex items-center gap-2 text-xs text-red-400"><AlertCircle size={12} /> {err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 py-2.5 text-sm text-slate-400 hover:text-slate-200 transition-all">Cancel</button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 rounded-lg bg-ferrari-red py-2.5 text-sm font-semibold text-white hover:bg-ferrari-red/90 disabled:opacity-60 transition-all">
              {mutation.isPending ? "Adding…" : "Add Circuit"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

type TabKey = "races" | "circuits";

export default function RacesPage() {
  const [tab, setTab] = useState<TabKey>("races");
  const [showAddRace, setShowAddRace] = useState(false);
  const [showAddCircuit, setShowAddCircuit] = useState(false);
  const queryClient = useQueryClient();

  const { data: races = [], isLoading: racesLoading } = useQuery({
    queryKey: ["admin-races"],
    queryFn: fetchRaces,
  });

  const { data: circuits = [], isLoading: circuitsLoading } = useQuery({
    queryKey: ["admin-circuits"],
    queryFn: fetchCircuits,
  });

  const deleteRaceMutation = useMutation({
    mutationFn: (r: Race) => deleteRace(r.race_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-races"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });

  const deleteCircuitMutation = useMutation({
    mutationFn: (c: Circuit) => deleteCircuit(c.circuit_id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-circuits"] }),
  });

  const isLoading = tab === "races" ? racesLoading : circuitsLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Races & Circuits</h1>
          <p className="mt-1 text-sm text-slate-500">Manage the race calendar and circuit database.</p>
        </div>
        <button
          onClick={() => tab === "races" ? setShowAddRace(true) : setShowAddCircuit(true)}
          className="flex items-center gap-2 rounded-lg bg-ferrari-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-ferrari-red/90 transition-all"
        >
          <Plus size={16} /> {tab === "races" ? "Add Race" : "Add Circuit"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1 w-fit">
        {(["races", "circuits"] as TabKey[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition-all ${
              tab === t
                ? "bg-slate-surface text-slate-100 shadow-sm"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Activity size={24} className="animate-pulse text-ferrari-red" />
        </div>
      ) : tab === "races" ? (
        races.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-600">
            <Flag size={32} /> <p className="text-sm">No races scheduled yet.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-surface overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/40">
                  {["Race", "Circuit", "Date", "Season", ""].map(h => (
                    <th key={h} className="py-3 pl-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {races.map(race => (
                  <tr key={race.race_id} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                    <td className="py-3.5 pl-4">
                      <div className="flex items-center gap-2">
                        <Flag size={14} className="text-ferrari-red shrink-0" />
                        <span className="text-sm font-medium text-slate-100">{race.race_name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 pl-4">
                      <span className="text-sm text-slate-400">{race.circuit?.circuit_name ?? "—"}</span>
                      {race.circuit?.country && (
                        <span className="ml-1.5 text-xs text-slate-600">({race.circuit.country})</span>
                      )}
                    </td>
                    <td className="py-3.5 pl-4">
                      <div className="flex items-center gap-1.5 text-sm text-slate-400">
                        <Calendar size={12} className="text-slate-600" />
                        {new Date(race.race_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </td>
                    <td className="py-3.5 pl-4">
                      <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300">{race.season}</span>
                    </td>
                    <td className="py-3.5 pl-4 pr-4">
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${race.race_name}"?`)) deleteRaceMutation.mutate(race);
                        }}
                        className="rounded-md p-1.5 text-slate-600 hover:bg-red-500/10 hover:text-red-400 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Circuits tab */
        circuits.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-600">
            <Globe size={32} /> <p className="text-sm">No circuits in the database yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {circuits.map(circuit => (
              <motion.div
                key={circuit.circuit_id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="group relative rounded-xl border border-slate-800 bg-slate-surface p-5 transition-all hover:border-slate-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ferrari-red/10 ring-1 ring-ferrari-red/20">
                      <Globe size={16} className="text-ferrari-red" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-100 text-sm">{circuit.circuit_name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={10} className="text-slate-600" />
                        <span className="text-xs text-slate-500">{circuit.country}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${circuit.circuit_name}"?`)) deleteCircuitMutation.mutate(circuit);
                    }}
                    className="opacity-0 group-hover:opacity-100 rounded-md p-1.5 text-slate-600 hover:bg-red-500/10 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                  <Ruler size={11} />
                  <span>{circuit.length.toFixed(3)} km per lap</span>
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}

      <AnimatePresence>
        {showAddRace && <CreateRaceModal onClose={() => setShowAddRace(false)} circuits={circuits} />}
        {showAddCircuit && <CreateCircuitModal onClose={() => setShowAddCircuit(false)} />}
      </AnimatePresence>
    </div>
  );
}
