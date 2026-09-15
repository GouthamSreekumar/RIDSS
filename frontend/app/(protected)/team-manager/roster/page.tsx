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
            <UserCheck size={16} className="text-ferrari-red" />
            <h2 className="text-sm font-bold text-slate-100">Assign driver to vehicle</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5 font-sans">
          <div>
            <label className={labelCls}>Select driver</label>
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
            <label className={labelCls}>Select vehicle</label>
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
            <label className={labelCls}>Season year</label>
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="border border-amber/40 bg-amber/10 p-3 text-xs text-amber space-y-1 border-l-2 border-l-amber"
            >
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle size={13} /> Reassignment warning
              </div>
              <p className="text-[11px] text-amber/90 font-mono">
                {driverAlreadyPaired && vehicleAlreadyPaired
                  ? `Driver ${selectedDriver?.full_name} and Vehicle ${selectedVehicle?.chassis} both have active pairings. Proceeding will set existing pairings to inactive.`
                  : driverAlreadyPaired
                  ? `Driver ${selectedDriver?.full_name} is currently assigned to ${selectedDriver?.current_vehicle?.chassis}. It will be reassigned.`
                  : `Vehicle ${selectedVehicle?.chassis} is currently assigned to ${selectedVehicle?.current_driver?.full_name}. It will be reassigned.`}
              </p>
            </motion.div>
          )}

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
              disabled={assignMutation.isPending}
              className="flex-1 border border-ferrari-red bg-ferrari-red py-2 text-xs font-mono font-semibold text-white hover:bg-ferrari-red/90 disabled:opacity-60 transition-colors"
            >
              {assignMutation.isPending
                ? "Assigning…"
                : requiresReassignWarning
                ? "Confirm & reassign"
                : "Confirm pairing"}
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
    >
      <motion.div
        initial={{ scale: 0.98, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.98, y: 8 }}
        className="w-full max-w-sm border-2 border-slate-800 bg-slate-950 border-l-2 border-l-amber p-5 space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-amber/30 bg-amber/10 text-amber">
            <UserX size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Unassign pairing?</h3>
            <p className="text-xs text-slate-400">
              Remove pairing between <span className="text-slate-200 font-semibold">{driverName}</span> and car{" "}
              <span className="text-slate-200 font-semibold">{vehicleChassis}</span>.
            </p>
          </div>
        </div>

        {err && (
          <p className="flex items-center gap-1 text-xs text-red-400 font-mono">
            <AlertCircle size={12} /> {err}
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
            onClick={handleUnassign}
            disabled={unassignMutation.isPending}
            className="flex-1 border border-red-500/40 bg-red-950/40 text-red-400 py-2 text-xs font-mono font-semibold hover:bg-red-900/40 disabled:opacity-50 transition-colors"
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

  const activePairings = drivers.filter((d) => d.current_vehicle && d.current_assignment_id);
  const unpairedDrivers = drivers.filter((d) => !d.current_vehicle);
  const unpairedVehicles = vehicles.filter((v) => !v.current_driver);

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Roster & driver-vehicle pairings</h1>
          <p className="mt-1 text-xs text-slate-400">
            Assign team drivers to garage vehicles. Enforces one active pairing per driver and car.
          </p>
        </div>
        <button
          onClick={() => setShowAssignModal(true)}
          className="flex items-center gap-2 border border-ferrari-red bg-ferrari-red px-4 py-2 text-xs font-semibold text-white hover:bg-ferrari-red/90 transition-colors"
        >
          <Plus size={15} /> Assign driver
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-emerald-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Active pairings</p>
            <p className="mt-1 text-3xl font-bold font-mono tabular-nums text-emerald-400">{activePairings.length}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center border border-slate-800 bg-slate-900 text-emerald-400">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-amber flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Unpaired drivers</p>
            <p className={`mt-1 text-3xl font-bold font-mono tabular-nums ${unpairedDrivers.length > 0 ? "text-amber" : "text-slate-300"}`}>
              {unpairedDrivers.length}
            </p>
          </div>
          <div className={`flex h-9 w-9 items-center justify-center border border-slate-800 bg-slate-900 ${unpairedDrivers.length > 0 ? "text-amber" : "text-slate-500"}`}>
            <UserX size={18} />
          </div>
        </div>

        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-cyan-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Unassigned vehicles</p>
            <p className={`mt-1 text-3xl font-bold font-mono tabular-nums ${unpairedVehicles.length > 0 ? "text-amber" : "text-slate-300"}`}>
              {unpairedVehicles.length}
            </p>
          </div>
          <div className={`flex h-9 w-9 items-center justify-center border border-slate-800 bg-slate-900 ${unpairedVehicles.length > 0 ? "text-amber" : "text-slate-500"}`}>
            <Car size={18} />
          </div>
        </div>
      </div>

      {/* Roster Tables & Grids */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center gap-2 text-slate-500 font-mono text-xs">
          <Activity size={20} className="animate-pulse text-ferrari-red" />
          <span>Loading team roster state…</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Pairings Table */}
          <div className="border border-slate-800 bg-slate-surface border-l-2 border-l-emerald-500">
            <div className="border-b border-slate-800 px-5 py-3.5 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center gap-2">
                <UserCheck size={16} className="text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-200">
                  Active pairings ({activePairings.length})
                </h2>
              </div>
            </div>

            {activePairings.length === 0 ? (
              <div className="flex h-36 flex-col items-center justify-center gap-2 text-slate-500 font-mono text-xs">
                <AlertCircle size={18} />
                <p>No active driver-vehicle pairings currently configured.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950 text-xs font-semibold text-slate-400">
                      <th className="py-3 px-5">Driver</th>
                      <th className="py-3 px-5">Assigned vehicle</th>
                      <th className="py-3 px-5">Engine</th>
                      <th className="py-3 px-5">Status</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-xs">
                    {activePairings.map((driver) => (
                      <tr key={driver.driver_id} className="hover:bg-slate-900/60 transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 items-center justify-center border border-ferrari-red/40 bg-ferrari-red/10 text-xs font-mono font-bold text-ferrari-red">
                              #{driver.driver_number}
                            </span>
                            <div>
                              <p className="font-semibold text-slate-100">{driver.full_name}</p>
                              <p className="text-[11px] text-slate-500 font-mono">{driver.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 font-mono text-slate-200">
                          {driver.current_vehicle?.chassis}
                        </td>
                        <td className="py-3.5 px-5 text-slate-400 font-mono">
                          {driver.current_vehicle?.engine}
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="border border-emerald-500/40 bg-emerald-950/40 px-2 py-0.5 text-[11px] font-mono font-bold text-emerald-400 inline-flex items-center gap-1">
                            <CheckCircle2 size={11} /> Active pairing
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <button
                            onClick={() =>
                              setUnassignTarget({
                                driverName: driver.full_name,
                                vehicleChassis: driver.current_vehicle?.chassis ?? "Car",
                                assignmentId: driver.current_assignment_id!,
                              })
                            }
                            className="inline-flex items-center gap-1 border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:border-red-500/40 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={11} /> Unassign
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
            <div className="border border-slate-800 bg-slate-surface p-5">
              <div className="mb-3 flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-cyan-400" />
                  <h3 className="text-sm font-bold text-slate-200">
                    Team drivers ({drivers.length})
                  </h3>
                </div>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {drivers.map((d) => {
                  const isPaired = Boolean(d.current_vehicle);
                  return (
                    <div
                      key={d.driver_id}
                      className={`flex items-center justify-between p-3 border border-slate-800 bg-slate-900/60 border-l-2 ${
                        isPaired ? "border-l-emerald-500" : "border-l-amber"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-6 w-6 items-center justify-center border border-slate-700 bg-slate-800 text-xs font-mono font-bold text-slate-200">
                          #{d.driver_number}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-slate-100">{d.full_name}</p>
                          <p className="text-[11px] text-slate-500">{d.nationality ?? "Driver"}</p>
                        </div>
                      </div>
                      {isPaired ? (
                        <span className="border border-emerald-500/30 bg-emerald-950/30 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                          {d.current_vehicle?.chassis}
                        </span>
                      ) : (
                        <span className="border border-amber/30 bg-amber/10 px-2 py-0.5 text-[10px] font-mono text-amber">
                          Unpaired
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Vehicles Inventory */}
            <div className="border border-slate-800 bg-slate-surface p-5">
              <div className="mb-3 flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <Car size={16} className="text-blue-400" />
                  <h3 className="text-sm font-bold text-slate-200">
                    Garage vehicles ({vehicles.length})
                  </h3>
                </div>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {vehicles.map((v) => {
                  const isAssigned = Boolean(v.current_driver);
                  return (
                    <div
                      key={v.vehicle_id}
                      className={`flex items-center justify-between p-3 border border-slate-800 bg-slate-900/60 border-l-2 ${
                        isAssigned ? "border-l-emerald-500" : "border-l-amber"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-mono font-semibold text-slate-100">{v.chassis}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{v.engine}</p>
                      </div>
                      {isAssigned ? (
                        <span className="border border-emerald-500/30 bg-emerald-950/30 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                          #{v.current_driver?.driver_number} {v.current_driver?.full_name}
                        </span>
                      ) : (
                        <span className="border border-amber/30 bg-amber/10 px-2 py-0.5 text-[10px] font-mono text-amber">
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
