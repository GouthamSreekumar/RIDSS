"use client";

import { use, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Plus,
  ShieldAlert,
  Wrench,
  X,
} from "lucide-react";
import {
  useCreateComponent,
  useUpdateComponentStatus,
  useVehicleComponents,
} from "@/features/mechanic/api/mechanicApi";

const COMPONENT_STATUSES = [
  { value: "good", label: "Good", cls: "text-emerald-400 border-emerald-500/40 bg-emerald-950/40" },
  { value: "needs_attention", label: "Needs Attention", cls: "text-amber border-amber/40 bg-amber/10" },
  { value: "worn", label: "Worn", cls: "text-amber border-amber/40 bg-amber/10" },
  { value: "critical", label: "Critical", cls: "text-red-400 border-red-500/40 bg-red-950/40" },
  { value: "replaced", label: "Replaced", cls: "text-cyan-400 border-cyan-500/40 bg-cyan-950/40" },
  { value: "new", label: "New", cls: "text-blue-400 border-blue-500/40 bg-blue-950/40" },
];

function AddComponentModal({ vehicleId, onClose }: { vehicleId: string; onClose: () => void }) {
  const [componentName, setComponentName] = useState("");
  const [status, setStatus] = useState("good");
  const [err, setErr] = useState("");
  const createMutation = useCreateComponent();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!componentName.trim()) {
      setErr("Component name is required.");
      return;
    }

    createMutation.mutate(
      { vehicleId, payload: { component_name: componentName.trim(), status } },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (error: any) => {
          setErr(error.response?.data?.detail ?? "Failed to add component.");
        },
      }
    );
  };

  const inputCls =
    "w-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-ferrari-red transition-colors";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
    >
      <motion.div
        initial={{ scale: 0.98, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.98, y: 8 }}
        className="w-full max-w-md border-2 border-slate-800 bg-slate-950 border-l-2 border-l-ferrari-red p-5 space-y-4 font-sans"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Plus size={16} className="text-ferrari-red" />
            <h3 className="text-sm font-bold text-slate-100 font-mono">Register New Vehicle Component</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 font-mono">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Component Name</label>
            <input
              type="text"
              placeholder="E.g., High-Pressure Fuel Pump, DRS Actuator…"
              className={inputCls}
              value={componentName}
              onChange={(e) => setComponentName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Initial Status</label>
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
              {COMPONENT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {err && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle size={13} /> {err}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-700 bg-slate-900 py-2 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 border border-ferrari-red bg-ferrari-red py-2 text-xs font-semibold text-white hover:bg-ferrari-red/90 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? "Registering…" : "Register Component"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

export default function VehicleComponentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const vehicleId = resolvedParams.id;

  const { data: detail, isLoading, error } = useVehicleComponents(vehicleId);
  const updateMutation = useUpdateComponentStatus();
  const [showAddModal, setShowAddModal] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateMsg, setUpdateMsg] = useState<{ id: string; msg: string; type: "success" | "error" } | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 font-mono text-xs text-slate-500">
        <Activity size={20} className="animate-pulse text-ferrari-red" />
        <span>Loading vehicle components & health telemetry…</span>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Link href="/mechanic/vehicles" className="text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1">
          <ArrowLeft size={14} /> Back to Vehicles
        </Link>
        <div className="border border-red-500/30 bg-red-950/20 p-6 font-mono text-xs text-red-400 flex items-center gap-3">
          <AlertCircle size={20} />
          <span>Failed to load components for vehicle #{vehicleId}.</span>
        </div>
      </div>
    );
  }

  const isCritical = detail.health_status === "critical";
  const isAttention = detail.health_status === "needs_attention";

  const handleStatusChange = (componentId: string, newStatus: string) => {
    setUpdatingId(componentId);
    setUpdateMsg(null);

    updateMutation.mutate(
      { componentId, status: newStatus },
      {
        onSuccess: () => {
          setUpdatingId(null);
          setUpdateMsg({
            id: componentId,
            msg: `Status updated to ${newStatus.toUpperCase()}`,
            type: "success",
          });
          setTimeout(() => setUpdateMsg(null), 3000);
        },
        onError: (err: any) => {
          setUpdatingId(null);
          setUpdateMsg({
            id: componentId,
            msg: err.response?.data?.detail ?? "Failed to update component status.",
            type: "error",
          });
        },
      }
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <Link
          href="/mechanic/vehicles"
          className="text-xs font-mono text-slate-400 hover:text-slate-100 transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft size={14} /> Back to Garage Fleet
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 border border-slate-700 bg-slate-900 px-3.5 py-1.5 text-xs font-mono font-semibold text-slate-200 hover:border-slate-500 transition-colors"
          >
            <Plus size={13} /> Add Component
          </button>
          <Link
            href={`/mechanic/maintenance?vehicle_id=${detail.vehicle_id}`}
            className="flex items-center gap-1.5 border border-ferrari-red bg-ferrari-red px-3.5 py-1.5 text-xs font-mono font-semibold text-white hover:bg-ferrari-red/90 transition-colors"
          >
            <Wrench size={13} /> Schedule Maintenance
          </Link>
        </div>
      </div>

      {/* Prominent Health Status Header Banner */}
      <div
        className={`border p-6 border-l-4 ${
          isCritical
            ? "border-red-500/40 bg-red-950/20 border-l-red-500"
            : isAttention
            ? "border-amber/40 bg-amber/10 border-l-amber"
            : "border-emerald-500/40 bg-emerald-950/20 border-l-emerald-500"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono text-slate-100">{detail.chassis}</h1>
              <span className="text-xs font-mono text-slate-400">({detail.engine})</span>
            </div>

            {/* Health Rollup Callout */}
            <div className="pt-2 font-mono text-xs">
              {isCritical ? (
                <div className="flex items-center gap-2 text-red-400">
                  <ShieldAlert size={16} />
                  <span>
                    Overall Health: <strong className="uppercase">CRITICAL</strong> — Driver assignment is currently{" "}
                    <strong className="underline">BLOCKED</strong> in Team Manager Roster.
                  </span>
                </div>
              ) : isAttention ? (
                <div className="flex items-center gap-2 text-amber">
                  <AlertTriangle size={16} />
                  <span>
                    Overall Health: <strong className="uppercase">NEEDS ATTENTION</strong> — Flagged with warning in Team Manager Roster.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 size={16} />
                  <span>
                    Overall Health: <strong className="uppercase">GOOD</strong> — Vehicle ready for session assignment.
                  </span>
                </div>
              )}
            </div>

            {/* Driving Components Explanation */}
            {(!isCritical && !isAttention) ? null : (
              <div className="mt-2 text-xs font-mono text-slate-300 bg-slate-900/80 p-2.5 border border-slate-800">
                <span className="text-slate-400 font-semibold">Driven by component(s): </span>
                {isCritical ? (
                  <span className="text-red-400 font-bold">{detail.critical_components.join(", ")}</span>
                ) : (
                  <span className="text-amber font-bold">{detail.needs_attention_components.join(", ")}</span>
                )}
              </div>
            )}
          </div>

          {/* Large Badge Display */}
          <div
            className={`shrink-0 border px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-center ${
              isCritical
                ? "border-red-500/50 bg-red-950/50 text-red-400"
                : isAttention
                ? "border-amber/50 bg-amber/20 text-amber"
                : "border-emerald-500/50 bg-emerald-950/50 text-emerald-400"
            }`}
          >
            {detail.health_status.replace("_", " ")}
          </div>
        </div>
      </div>

      {/* Component Status Management Table */}
      <div className="border border-slate-800 bg-slate-surface">
        <div className="border-b border-slate-800 px-5 py-3.5 flex items-center justify-between bg-slate-900/60">
          <h2 className="text-sm font-bold text-slate-200 font-mono">
            Vehicle Component Inventory ({detail.components.length})
          </h2>
          <span className="text-xs font-mono text-slate-400">Update status to trigger real-time health roll-up</span>
        </div>

        {detail.components.length === 0 ? (
          <div className="flex h-36 items-center justify-center text-slate-500 font-mono text-xs">
            No component records registered for this vehicle.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-xs font-semibold text-slate-400">
                  <th className="py-3 px-5">Component Name</th>
                  <th className="py-3 px-5">Current Status</th>
                  <th className="py-3 px-5 text-right">Update Component Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {detail.components.map((comp) => {
                  const st = comp.status.toLowerCase();
                  const isCompCritical = st === "critical";
                  const isCompAttention = st === "needs_attention" || st === "worn";
                  const statusObj = COMPONENT_STATUSES.find((s) => s.value === st);

                  return (
                    <tr
                      key={comp.component_id}
                      className={`hover:bg-slate-900/50 transition-colors ${
                        isCompCritical ? "bg-red-950/10" : isCompAttention ? "bg-amber/5" : ""
                      }`}
                    >
                      <td className="py-4 px-5">
                        <div className="font-mono font-bold text-slate-100">{comp.component_name}</div>
                        {updateMsg && updateMsg.id === comp.component_id && (
                          <p
                            className={`text-[10px] font-mono mt-1 ${
                              updateMsg.type === "success" ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {updateMsg.msg}
                          </p>
                        )}
                      </td>

                      <td className="py-4 px-5">
                        <span
                          className={`border px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                            statusObj?.cls ?? "border-slate-700 bg-slate-900 text-slate-300"
                          }`}
                        >
                          {isCompCritical && <ShieldAlert size={12} />}
                          {isCompAttention && <AlertTriangle size={12} />}
                          {!isCompCritical && !isCompAttention && <CheckCircle2 size={12} />}
                          {comp.status.replace("_", " ")}
                        </span>
                      </td>

                      <td className="py-4 px-5 text-right">
                        <select
                          disabled={updatingId === comp.component_id}
                          value={comp.status}
                          onChange={(e) => handleStatusChange(comp.component_id, e.target.value)}
                          className="border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-ferrari-red disabled:opacity-50 cursor-pointer transition-colors"
                        >
                          {COMPONENT_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              Set to: {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Component Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddComponentModal
            vehicleId={detail.vehicle_id}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
