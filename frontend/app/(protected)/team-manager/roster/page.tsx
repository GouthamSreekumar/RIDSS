"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Car,
  CheckCircle2,
  Plus,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import {
  useAssignDriver,
  useTeamDrivers,
  useTeamVehicles,
  useUnassignDriver,
  type TeamDriverItem,
  type TeamVehicleItem,
} from "@/features/team-manager/api/teamManagerApi";

// ── Assign Modal Component ───────────────────────────────────────────────────
function AssignModal({
  onClose,
  drivers,
  vehicles,
}: {
  onClose: () => void;
  drivers: TeamDriverItem[];
  vehicles: TeamVehicleItem[];
}) {
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [season, setSeason] = useState(2026);
  const [confirmedReassign, setConfirmedReassign] = useState(false);
  const [err, setErr] = useState("");

  const assignMutation = useAssignDriver();

  const selectedDriver = drivers.find((d) => d.driver_id === selectedDriverId);
  const selectedVehicle = vehicles.find((v) => v.vehicle_id === selectedVehicleId);

  const driverAlreadyPaired = Boolean(selectedDriver?.current_vehicle);
  const vehicleAlreadyPaired = Boolean(selectedVehicle?.current_driver);
  const requiresReassignWarning = (driverAlreadyPaired || vehicleAlreadyPaired) && !confirmedReassign;

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setErr("");

    if (!selectedDriverId || !selectedVehicleId) {
      setErr("Please select both a driver and a vehicle.");
      return;
    }

    if (requiresReassignWarning) {
      setConfirmedReassign(true);
      return;
    }

    assignMutation.mutate(
      {
        driver_id: selectedDriverId,
        vehicle_id: selectedVehicleId,
        season,
      },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (error: any) => {
          setErr(error.response?.data?.detail ?? "Failed to create driver-vehicle assignment.");
        },
      }
    );
  };

  const inputCls =
    "w-full rounded-lg border border-slate-700 bg-graphite-800 px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-ferrari-red focus:border-transparent transition-all";
  const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 16 }}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-surface shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <UserCheck size={18} className="text-ferrari-red" />
            <h2 className="text-sm font-bold text-slate-100">Assign Driver to Vehicle</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className={labelCls}>Select Driver</label>
            <select
              className={inputCls}
              value={selectedDriverId}
              onChange={(e) => {
                setSelectedDriverId(e.target.value);
                setConfirmedReassign(false);
              }}
              required
            >
              <option value="">Choose a team driver…</option>
              {drivers.map((d) => (
                <option key={d.driver_id} value={d.driver_id}>
                  #{d.driver_number} — {d.full_name} {d.current_vehicle ? `(Paired: ${d.current_vehicle.chassis})` : "(Unpaired)"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Select Vehicle</label>
            <select
              className={inputCls}
              value={selectedVehicleId}
              onChange={(e) => {
                setSelectedVehicleId(e.target.value);
                setConfirmedReassign(false);
              }}
              required
            >
              <option value="">Choose a team car…</option>
              {vehicles.map((v) => (
                <option key={v.vehicle_id} value={v.vehicle_id}>
                  {v.chassis} ({v.engine}) — {v.current_driver ? `(Assigned: #${v.current_driver.driver_number})` : "(Available)"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Season Year</label>
            <input
              type="number"
              className={inputCls}
              value={season}
              onChange={(e) => setSeason(parseInt(e.target.value, 10) || 2026)}
              min={2020}
              max={2035}
              required
            />
          </div>

          {/* Reassignment Confirmation Warning */}
          {requiresReassignWarning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="rounded-lg border border-amber/40 bg-amber/10 p-3 text-xs text-amber space-y-1"
            >
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle size={14} /> Reassignment Warning
              </div>
              <p className="text-[11px] text-amber/90">
                {driverAlreadyPaired && vehicleAlreadyPaired
                  ? `Driver ${selectedDriver?.full_name} and Vehicle ${selectedVehicle?.chassis} both have active pairings. Proceeding will set existing pairings to inactive.`
                  : driverAlreadyPaired
                  ? `Driver ${selectedDriver?.full_name} is currently assigned to ${selectedDriver?.current_vehicle?.chassis}. It will be reassigned.`
                  : `Vehicle ${selectedVehicle?.chassis} is currently assigned to ${selectedVehicle?.current_driver?.full_name}. It will be reassigned.`}
              </p>
            </motion.div>
          )}

          {err && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle size={14} /> {err}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 py-2.5 text-sm font-medium text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={assignMutation.isPending}
              className="flex-1 rounded-lg bg-ferrari-red py-2.5 text-sm font-semibold text-white hover:bg-ferrari-red/90 disabled:opacity-60 transition-all shadow-md"
            >
              {assignMutation.isPending
                ? "Assigning…"
                : requiresReassignWarning
                ? "Confirm & Reassign"
                : "Confirm Pairing"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Unassign Confirmation Dialog ─────────────────────────────────────────────
function UnassignDialog({
  driverName,
  vehicleChassis,
  assignmentId,
  onClose,
}: {
  driverName: string;
  vehicleChassis: string;
  assignmentId: string;
  onClose: () => void;
}) {
  const [err, setErr] = useState("");
  const unassignMutation = useUnassignDriver();

  const handleUnassign = () => {
    setErr("");
    unassignMutation.mutate(assignmentId, {
      onSuccess: () => {
        onClose();
      },
      onError: (error: any) => {
        setErr(error.response?.data?.detail ?? "Failed to unassign pairing.");
      },
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 16 }}
        className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-surface shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber/15 text-amber ring-1 ring-amber/30">
            <UserX size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Unassign Pairing?</h3>
            <p className="text-xs text-slate-400">
              Remove pairing between <span className="text-slate-200 font-semibold">{driverName}</span> and car{" "}
              <span className="text-slate-200 font-semibold">{vehicleChassis}</span>.
            </p>
          </div>
        </div>

        {err && (
          <p className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle size={12} /> {err}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUnassign}
            disabled={unassignMutation.isPending}
            className="flex-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 py-2 text-xs font-semibold hover:bg-red-500/30 disabled:opacity-50 transition-all"
          >
            {unassignMutation.isPending ? "Unassigning…" : "Unassign"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Roster Main Page ─────────────────────────────────────────────────────────
export default function TeamRosterPage() {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [unassignTarget, setUnassignTarget] = useState<{
    driverName: string;
    vehicleChassis: string;
    assignmentId: string;
  } | null>(null);

  const { data: drivers = [], isLoading: loadingDrivers } = useTeamDrivers();
  const { data: vehicles = [], isLoading: loadingVehicles } = useTeamVehicles();

  const isLoading = loadingDrivers || loadingVehicles;

  // Active pairings list compiled from drivers
  const activePairings = drivers.filter((d) => d.current_vehicle && d.current_assignment_id);
  const unpairedDrivers = drivers.filter((d) => !d.current_vehicle);
  const unpairedVehicles = vehicles.filter((v) => !v.current_driver);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Roster & Driver-Vehicle Pairings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Assign team drivers to garage vehicles. Enforces one active pairing per driver and car.
          </p>
        </div>
        <button
          onClick={() => setShowAssignModal(true)}
          className="flex items-center gap-2 rounded-lg bg-ferrari-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-ferrari-red/90 transition-all shadow-md"
        >
          <Plus size={16} /> Assign Driver
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-surface p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Active Pairings</p>
            <p className="mt-1 text-2xl font-bold text-success-green">{activePairings.length}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-green/10 text-success-green ring-1 ring-success-green/20">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-surface p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Unpaired Drivers</p>
            <p className={`mt-1 text-2xl font-bold ${unpairedDrivers.length > 0 ? "text-amber" : "text-slate-300"}`}>
              {unpairedDrivers.length}
            </p>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${unpairedDrivers.length > 0 ? "bg-amber/10 text-amber ring-1 ring-amber/20" : "bg-slate-800 text-slate-500"}`}>
            <UserX size={20} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-surface p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Unassigned Vehicles</p>
            <p className={`mt-1 text-2xl font-bold ${unpairedVehicles.length > 0 ? "text-amber" : "text-slate-300"}`}>
              {unpairedVehicles.length}
            </p>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${unpairedVehicles.length > 0 ? "bg-amber/10 text-amber ring-1 ring-amber/20" : "bg-slate-800 text-slate-500"}`}>
            <Car size={20} />
          </div>
        </div>
      </div>

      {/* Roster Tables & Grids */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center gap-2 text-slate-500">
          <Activity size={24} className="animate-pulse text-ferrari-red" />
          <span className="text-sm">Loading team roster state…</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Pairings Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-surface overflow-hidden shadow-md">
            <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck size={16} className="text-success-green" />
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-200">
                  Active Pairings ({activePairings.length})
                </h2>
              </div>
            </div>

            {activePairings.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-600">
                <AlertCircle size={20} />
                <p className="text-sm">No active driver-vehicle pairings currently configured.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-800/60 bg-graphite-800/50 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                      <th className="py-3 px-6">Driver</th>
                      <th className="py-3 px-6">Assigned Vehicle</th>
                      <th className="py-3 px-6">Engine</th>
                      <th className="py-3 px-6">Status</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-sm">
                    {activePairings.map((driver) => (
                      <tr key={driver.driver_id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ferrari-red/15 font-bold text-xs text-ferrari-red ring-1 ring-ferrari-red/30">
                              #{driver.driver_number}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-100">{driver.full_name}</p>
                              <p className="text-xs text-slate-500">{driver.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-200">
                          {driver.current_vehicle?.chassis}
                        </td>
                        <td className="py-4 px-6 text-xs text-slate-400">
                          {driver.current_vehicle?.engine}
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center gap-1 rounded-full bg-success-green/10 px-2.5 py-0.5 text-xs font-semibold text-success-green ring-1 ring-success-green/20">
                            <CheckCircle2 size={12} /> Active Pairing
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() =>
                              setUnassignTarget({
                                driverName: driver.full_name,
                                vehicleChassis: driver.current_vehicle?.chassis ?? "Car",
                                assignmentId: driver.current_assignment_id!,
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-red-500/40 hover:text-red-400 transition-all"
                          >
                            <Trash2 size={12} /> Unassign
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Unpaired Drivers & Unassigned Vehicles Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Drivers Roster */}
            <div className="rounded-xl border border-slate-800 bg-slate-surface p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-blue-400" />
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-300">
                    Team Drivers ({drivers.length})
                  </h3>
                </div>
              </div>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {drivers.map((d) => {
                  const isPaired = Boolean(d.current_vehicle);
                  return (
                    <div
                      key={d.driver_id}
                      className="flex items-center justify-between rounded-lg bg-graphite-800 p-3 border border-slate-800/80"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded bg-slate-700 text-xs font-bold text-slate-200">
                          #{d.driver_number}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-slate-100">{d.full_name}</p>
                          <p className="text-[11px] text-slate-500">{d.nationality ?? "Driver"}</p>
                        </div>
                      </div>
                      {isPaired ? (
                        <span className="rounded bg-success-green/10 px-2 py-0.5 text-[10px] font-semibold text-success-green ring-1 ring-success-green/20">
                          {d.current_vehicle?.chassis}
                        </span>
                      ) : (
                        <span className="rounded bg-amber/15 px-2 py-0.5 text-[10px] font-semibold text-amber ring-1 ring-amber/30">
                          Unpaired
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Vehicles Inventory */}
            <div className="rounded-xl border border-slate-800 bg-slate-surface p-6 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car size={16} className="text-cyan-400" />
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-300">
                    Garage Vehicles ({vehicles.length})
                  </h3>
                </div>
              </div>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {vehicles.map((v) => {
                  const isAssigned = Boolean(v.current_driver);
                  return (
                    <div
                      key={v.vehicle_id}
                      className="flex items-center justify-between rounded-lg bg-graphite-800 p-3 border border-slate-800/80"
                    >
                      <div>
                        <p className="text-xs font-mono font-semibold text-slate-100">{v.chassis}</p>
                        <p className="text-[11px] text-slate-500">{v.engine}</p>
                      </div>
                      {isAssigned ? (
                        <span className="rounded bg-success-green/10 px-2 py-0.5 text-[10px] font-semibold text-success-green ring-1 ring-success-green/20">
                          #{v.current_driver?.driver_number} {v.current_driver?.full_name}
                        </span>
                      ) : (
                        <span className="rounded bg-amber/15 px-2 py-0.5 text-[10px] font-semibold text-amber ring-1 ring-amber/30">
                          Unassigned
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      <AnimatePresence>
        {showAssignModal && (
          <AssignModal
            onClose={() => setShowAssignModal(false)}
            drivers={drivers}
            vehicles={vehicles}
          />
        )}
      </AnimatePresence>

      {/* Unassign Dialog */}
      <AnimatePresence>
        {unassignTarget && (
          <UnassignDialog
            driverName={unassignTarget.driverName}
            vehicleChassis={unassignTarget.vehicleChassis}
            assignmentId={unassignTarget.assignmentId}
            onClose={() => setUnassignTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
