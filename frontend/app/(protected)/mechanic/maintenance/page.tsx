"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Plus,
  Wrench,
  X,
} from "lucide-react";
import {
  useMaintenanceHistory,
  useMechanicVehicles,
  useScheduleMaintenance,
  useUpdateMaintenanceStatus,
  useVehicleComponents,
  type MaintenanceItem,
} from "@/features/mechanic/api/mechanicApi";

// ── Schedule Maintenance Modal ────────────────────────────────────────────────
function ScheduleModal({ onClose, defaultVehicleId }: { onClose: () => void; defaultVehicleId?: string }) {
  const { data: vehicles = [] } = useMechanicVehicles();
  const scheduleMutation = useScheduleMaintenance();

  const [vehicleId, setVehicleId] = useState(defaultVehicleId || "");
  const [dateStr, setDateStr] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 16)
  );
  const [description, setDescription] = useState("");
  const [err, setErr] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    if (!vehicleId) {
      setErr("Please select a target vehicle.");
      return;
    }

    scheduleMutation.mutate(
      {
        vehicle_id: vehicleId,
        maintenance_date: new Date(dateStr).toISOString(),
        description,
      },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (error: any) => {
          setErr(error.response?.data?.detail ?? "Failed to schedule maintenance.");
        },
      }
    );
  };

  const inputCls =
    "w-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-ferrari-red transition-colors";
  const labelCls = "mb-1 block text-xs font-semibold text-slate-400";

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
        className="w-full max-w-md border-2 border-slate-800 bg-slate-950 border-l-2 border-l-ferrari-red"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Wrench size={16} className="text-ferrari-red" />
            <h2 className="text-sm font-bold text-slate-100">Schedule Maintenance Work Order</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5 font-sans">
          <div>
            <label className={labelCls}>Target Vehicle</label>
            <select
              className={inputCls}
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              required
            >
              <option value="">Select a car from garage…</option>
              {vehicles.map((v) => (
                <option key={v.vehicle_id} value={v.vehicle_id}>
                  {v.chassis} ({v.engine}) — Health: {v.health_status.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Scheduled Date & Time</label>
            <input
              type="datetime-local"
              className={inputCls}
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              required
            />
          </div>

          <div>
            <label className={labelCls}>Work Order Description</label>
            <textarea
              rows={3}
              className={inputCls}
              placeholder="E.g., Replace brake pads & inspect MGU-K energy storage units..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          {err && (
            <p className="flex items-center gap-1.5 text-xs text-red-400 font-mono">
              <AlertCircle size={13} /> {err}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-700 bg-slate-900 py-2 text-xs font-mono text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={scheduleMutation.isPending}
              className="flex-1 border border-ferrari-red bg-ferrari-red py-2 text-xs font-mono font-semibold text-white hover:bg-ferrari-red/90 disabled:opacity-60 transition-colors"
            >
              {scheduleMutation.isPending ? "Scheduling…" : "Confirm Schedule"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Complete Task Modal (Suggested Component Status Update) ───────────────────
function CompleteTaskModal({
  item,
  onClose,
}: {
  item: MaintenanceItem;
  onClose: () => void;
}) {
  const { data: vehicleDetail } = useVehicleComponents(item.vehicle_id);
  const updateMutation = useUpdateMaintenanceStatus();

  const [selectedCompId, setSelectedCompId] = useState("");
  const [newCompStatus, setNewCompStatus] = useState("good");
  const [err, setErr] = useState("");

  const handleComplete = () => {
    setErr("");
    updateMutation.mutate(
      {
        maintenanceId: item.maintenance_id,
        payload: {
          status: "completed",
          component_id: selectedCompId || undefined,
          new_component_status: selectedCompId ? newCompStatus : undefined,
        },
      },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (error: any) => {
          setErr(error.response?.data?.detail ?? "Failed to mark maintenance as completed.");
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
        className="w-full max-w-md border-2 border-slate-800 bg-slate-950 border-l-2 border-l-emerald-500 p-5 space-y-4 font-sans"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-100">Complete Maintenance Work</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-slate-300">
          Work Order: <strong className="text-slate-100">{item.description}</strong> on car{" "}
          <strong className="text-slate-100">{item.vehicle_chassis}</strong>.
        </p>

        {/* Suggested Component Status Update Section */}
        <div className="border border-slate-800 bg-slate-900/80 p-3.5 space-y-3">
          <label className="block text-xs font-semibold text-emerald-400">
            Suggested Action: Update Related Component Status
          </label>
          <p className="text-[11px] text-slate-400">
            Select a component serviced during this maintenance to confirm its updated health status (or leave unselected).
          </p>

          <div>
            <select
              className={inputCls}
              value={selectedCompId}
              onChange={(e) => setSelectedCompId(e.target.value)}
            >
              <option value="">No component status change required</option>
              {vehicleDetail?.components.map((c) => (
                <option key={c.component_id} value={c.component_id}>
                  {c.component_name} (Current: {c.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {selectedCompId && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">New Component Status</label>
              <select
                className={inputCls}
                value={newCompStatus}
                onChange={(e) => setNewCompStatus(e.target.value)}
              >
                <option value="good">Set to GOOD (Optimal / Repaired)</option>
                <option value="replaced">Set to REPLACED (Fresh Component)</option>
                <option value="needs_attention">Set to NEEDS ATTENTION</option>
              </select>
            </div>
          )}
        </div>

        {err && (
          <p className="flex items-center gap-1.5 text-xs text-red-400 font-mono">
            <AlertCircle size={13} /> {err}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-slate-700 bg-slate-900 py-2 text-xs font-mono text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleComplete}
            disabled={updateMutation.isPending}
            className="flex-1 border border-emerald-500 bg-emerald-600 py-2 text-xs font-mono font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 transition-colors"
          >
            {updateMutation.isPending ? "Updating…" : "Confirm Completion"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page Content ───────────────────────────────────────────────────────
function MechanicMaintenanceContent() {
  const searchParams = useSearchParams();
  const filterVehicleId = searchParams.get("vehicle_id") || "";

  const [selectedVehicle, setSelectedVehicle] = useState(filterVehicleId);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<MaintenanceItem | null>(null);

  const { data: vehicles = [] } = useMechanicVehicles();
  const { data: history = [], isLoading, error } = useMaintenanceHistory(selectedVehicle || undefined);
  const updateStatusMutation = useUpdateMaintenanceStatus();

  const filteredHistory = history.filter((item) => {
    if (statusFilter === "all") return true;
    return item.status === statusFilter;
  });

  const handleStartWork = (item: MaintenanceItem) => {
    updateStatusMutation.mutate({
      maintenanceId: item.maintenance_id,
      payload: { status: "in_progress" },
    });
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Garage Maintenance Work Orders</h1>
          <p className="mt-1 text-xs text-slate-400">
            Schedule work orders, transition tasks from Scheduled to Completed, and verify component fixes.
          </p>
        </div>
        <button
          onClick={() => setShowScheduleModal(true)}
          className="flex items-center gap-2 border border-ferrari-red bg-ferrari-red px-4 py-2 text-xs font-semibold text-white hover:bg-ferrari-red/90 transition-colors"
        >
          <Plus size={15} /> Schedule Maintenance
        </button>
      </div>

      {/* Filter & Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 border border-slate-800 bg-slate-surface p-4">
        {/* Vehicle Filter */}
        <div className="flex items-center gap-2 flex-1">
          <Filter size={14} className="text-slate-500 shrink-0" />
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="w-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-ferrari-red transition-colors"
          >
            <option value="">All Garage Cars</option>
            {vehicles.map((v) => (
              <option key={v.vehicle_id} value={v.vehicle_id}>
                {v.chassis} ({v.engine})
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex border border-slate-700 bg-slate-900 p-0.5 text-xs font-mono">
          {["all", "scheduled", "in_progress", "completed"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 capitalize transition-colors ${
                statusFilter === st
                  ? "bg-ferrari-red font-semibold text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {st.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Maintenance History Table */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center gap-2 font-mono text-xs text-slate-500">
          <Activity size={20} className="animate-pulse text-ferrari-red" />
          <span>Loading maintenance logs & work order history…</span>
        </div>
      ) : error ? (
        <div className="border border-red-500/30 bg-red-950/20 p-6 font-mono text-xs text-red-400 flex items-center gap-3">
          <AlertCircle size={20} />
          <span>Failed to load maintenance records. Please try again.</span>
        </div>
      ) : (
        <div className="border border-slate-800 bg-slate-surface">
          <div className="border-b border-slate-800 px-5 py-3.5 flex items-center justify-between bg-slate-900/60">
            <h2 className="text-sm font-bold text-slate-200 font-mono">
              Maintenance Work Orders ({filteredHistory.length})
            </h2>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="flex h-44 flex-col items-center justify-center gap-2 text-slate-500 font-mono text-xs">
              <Calendar size={20} />
              <p>No maintenance logs match the selected vehicle or status filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 text-xs font-semibold text-slate-400">
                    <th className="py-3 px-5">Target Vehicle</th>
                    <th className="py-3 px-5">Scheduled Date</th>
                    <th className="py-3 px-5">Description</th>
                    <th className="py-3 px-5">Assigned Mechanic</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs">
                  {filteredHistory.map((item) => {
                    const isScheduled = item.status === "scheduled";
                    const isInProgress = item.status === "in_progress";
                    const isCompleted = item.status === "completed";

                    return (
                      <tr key={item.maintenance_id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-4 px-5 font-mono font-bold text-slate-100">
                          {item.vehicle_chassis ?? "Car"}
                        </td>
                        <td className="py-4 px-5 font-mono text-slate-300">
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-slate-500" />
                            {new Date(item.maintenance_date).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-slate-200 max-w-xs truncate">
                          {item.description || "N/A"}
                        </td>
                        <td className="py-4 px-5 font-mono text-slate-400">
                          {item.mechanic_name ?? "Mechanic Staff"}
                        </td>
                        <td className="py-4 px-5">
                          <span
                            className={`border px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                              isInProgress
                                ? "border-amber/40 bg-amber/10 text-amber"
                                : isCompleted
                                ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-400"
                                : "border-cyan-500/40 bg-cyan-950/40 text-cyan-400"
                            }`}
                          >
                            {item.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right">
                          {isScheduled && (
                            <button
                              onClick={() => handleStartWork(item)}
                              disabled={updateStatusMutation.isPending}
                              className="border border-amber/50 bg-amber/10 px-3 py-1 text-xs font-mono font-semibold text-amber hover:bg-amber/20 transition-colors"
                            >
                              Start Work
                            </button>
                          )}

                          {isInProgress && (
                            <button
                              onClick={() => setCompleteTarget(item)}
                              className="border border-emerald-500 bg-emerald-600 px-3 py-1 text-xs font-mono font-semibold text-white hover:bg-emerald-500 transition-colors"
                            >
                              Complete Task
                            </button>
                          )}

                          {isCompleted && (
                            <span className="text-[11px] font-mono text-slate-500 italic">No action needed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Schedule Modal */}
      <AnimatePresence>
        {showScheduleModal && (
          <ScheduleModal
            defaultVehicleId={selectedVehicle}
            onClose={() => setShowScheduleModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Complete Task Dialog */}
      <AnimatePresence>
        {completeTarget && (
          <CompleteTaskModal
            item={completeTarget}
            onClose={() => setCompleteTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function MechanicMaintenancePage() {
  return (
    <Suspense fallback={<div className="p-8 font-mono text-xs text-slate-500">Loading maintenance portal…</div>}>
      <MechanicMaintenanceContent />
    </Suspense>
  );
}

