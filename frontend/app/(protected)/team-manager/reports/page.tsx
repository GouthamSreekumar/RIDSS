"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  Calendar,
  Car,
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  FileText,
  Plus,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import {
  useGenerateReport,
  useTeamReports,
  type TeamReport,
} from "@/features/team-manager/api/teamManagerApi";

// ── Report Readable Summary Modal Component ──────────────────────────────────
function ReportDetailModal({
  report,
  onClose,
}: {
  report: TeamReport;
  onClose: () => void;
}) {
  let snapshotData = report.data;
  if (typeof snapshotData === "string") {
    try {
      snapshotData = JSON.parse(snapshotData);
    } catch {
      snapshotData = null;
    }
  }

  const totalDrivers = snapshotData?.summary?.total_drivers ?? snapshotData?.drivers?.length ?? 0;
  const totalVehicles = snapshotData?.summary?.total_vehicles ?? snapshotData?.vehicles?.length ?? 0;
  const activePairings = snapshotData?.summary?.active_pairings ?? snapshotData?.pairings?.length ?? 0;
  const pairings = Array.isArray(snapshotData?.pairings) ? snapshotData.pairings : [];
  const drivers = Array.isArray(snapshotData?.drivers) ? snapshotData.drivers : [];
  const vehicles = Array.isArray(snapshotData?.vehicles) ? snapshotData.vehicles : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 16 }}
        className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-surface shadow-2xl overflow-hidden my-8"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-400/15 text-blue-400 ring-1 ring-blue-400/30">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {snapshotData?.team_name ?? "Team"} Report Snapshot
              </h2>
              <p className="text-xs text-slate-500">
                Generated {new Date(report.created_at).toLocaleString()} by {report.generator_name ?? "Manager"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {!snapshotData ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              No detailed snapshot data available for this report.
            </div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-800 bg-graphite-800 p-4 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Total Drivers</p>
                  <p className="mt-1 text-2xl font-bold text-slate-100">{totalDrivers}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-graphite-800 p-4 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Total Vehicles</p>
                  <p className="mt-1 text-2xl font-bold text-slate-100">{totalVehicles}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-graphite-800 p-4 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Active Pairings</p>
                  <p className="mt-1 text-2xl font-bold text-success-green">{activePairings}</p>
                </div>
              </div>

              {/* Active Pairings Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <UserCheck size={16} className="text-success-green" />
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                    Active Pairings Snapshot
                  </h3>
                </div>
                {pairings.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No active pairings recorded at snapshot time.</p>
                ) : (
                  <div className="rounded-lg border border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-graphite-800 text-[10px] uppercase text-slate-400">
                          <th className="py-2.5 px-4">Driver</th>
                          <th className="py-2.5 px-4">Vehicle Chassis</th>
                          <th className="py-2.5 px-4">Engine</th>
                          <th className="py-2.5 px-4">Season</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {pairings.map((p: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="py-2.5 px-4 font-semibold text-slate-200">
                              {p.driver_number ? `#${p.driver_number} ` : ""}{p.driver_name ?? "Driver"}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-slate-300">{p.vehicle_chassis ?? "Chassis"}</td>
                            <td className="py-2.5 px-4 text-slate-400">{p.vehicle_engine ?? "Engine"}</td>
                            <td className="py-2.5 px-4 text-slate-400">{p.season ?? 2026}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Drivers Snapshot */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-blue-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                    Drivers Roster Snapshot
                  </h3>
                </div>
                {drivers.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No drivers recorded in snapshot.</p>
                ) : (
                  <div className="rounded-lg border border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-graphite-800 text-[10px] uppercase text-slate-400">
                          <th className="py-2.5 px-4">#</th>
                          <th className="py-2.5 px-4">Full Name</th>
                          <th className="py-2.5 px-4">Email</th>
                          <th className="py-2.5 px-4">Nationality</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {drivers.map((d: any) => (
                          <tr key={d.driver_id ?? d.email} className="hover:bg-slate-800/30">
                            <td className="py-2 px-4 font-bold text-slate-300">#{d.driver_number ?? "—"}</td>
                            <td className="py-2 px-4 font-medium text-slate-200">{d.full_name ?? "Driver"}</td>
                            <td className="py-2 px-4 text-slate-500">{d.email ?? "—"}</td>
                            <td className="py-2 px-4 text-slate-400">{d.nationality ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Vehicles Snapshot */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Car size={16} className="text-cyan-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                    Garage Vehicles Snapshot
                  </h3>
                </div>
                {vehicles.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No vehicles recorded in snapshot.</p>
                ) : (
                  <div className="rounded-lg border border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-graphite-800 text-[10px] uppercase text-slate-400">
                          <th className="py-2.5 px-4">Chassis</th>
                          <th className="py-2.5 px-4">Engine Specification</th>
                          <th className="py-2.5 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {vehicles.map((v: any) => (
                          <tr key={v.vehicle_id ?? v.chassis} className="hover:bg-slate-800/30">
                            <td className="py-2 px-4 font-mono font-semibold text-slate-200">{v.chassis}</td>
                            <td className="py-2 px-4 text-slate-400">{v.engine}</td>
                            <td className="py-2 px-4">
                              <span className="capitalize text-slate-300">{v.status ?? "ready"}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>


        {/* Modal Footer */}
        <div className="border-t border-slate-800 px-6 py-4 flex justify-end bg-slate-900/60">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-all"
          >
            Close Summary
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Reports Main Page ────────────────────────────────────────────────────────
export default function TeamReportsPage() {
  const [selectedReport, setSelectedReport] = useState<TeamReport | null>(null);

  const { data: reports = [], isLoading, isError } = useTeamReports();
  const generateMutation = useGenerateReport();

  const handleGenerate = () => {
    generateMutation.mutate();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Team Performance Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            Generate and review operational snapshots of drivers, garage vehicles, and active pairings.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-ferrari-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-ferrari-red/90 disabled:opacity-60 transition-all shadow-md"
        >
          {generateMutation.isPending ? (
            <>
              <Activity size={16} className="animate-spin" /> Generating Snapshot…
            </>
          ) : (
            <>
              <Plus size={16} /> Generate Team Report
            </>
          )}
        </button>
      </div>

      {/* Reports Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-surface overflow-hidden shadow-md">
        <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-blue-400" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-200">
              Past Reports History ({reports.length})
            </h2>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center gap-2 text-slate-500">
            <Activity size={24} className="animate-pulse text-ferrari-red" />
            <span className="text-sm">Loading team reports…</span>
          </div>
        ) : isError ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-500">
            <AlertCircle size={24} className="text-amber" />
            <p className="text-sm">Failed to load reports history.</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-600">
            <FileText size={28} />
            <p className="text-sm">No team reports generated yet. Click "Generate Team Report" to create your first snapshot.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800/60 bg-graphite-800/50 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  <th className="py-3 px-6">Report ID</th>
                  <th className="py-3 px-6">Report Type</th>
                  <th className="py-3 px-6">Generated By</th>
                  <th className="py-3 px-6">Date & Time</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {reports.map((report) => (
                  <tr key={report.report_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6 font-mono text-xs text-slate-300">
                      {report.report_id.substring(0, 8)}…
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-400/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400 ring-1 ring-blue-400/20 uppercase tracking-wide">
                        {report.report_type}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-200 font-medium">
                      {report.generator_name ?? "System"}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} />
                        {new Date(report.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => setSelectedReport(report)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-graphite-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-blue-400/40 hover:text-blue-400 transition-all"
                      >
                        <Eye size={12} /> View Summary
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Readable Summary Modal */}
      <AnimatePresence>
        {selectedReport && (
          <ReportDetailModal
            report={selectedReport}
            onClose={() => setSelectedReport(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
