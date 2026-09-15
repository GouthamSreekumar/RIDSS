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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.98, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.98, y: 8 }}
        className="w-full max-w-3xl border-2 border-slate-800 bg-slate-950 border-l-2 border-l-cyan-500 overflow-hidden my-8 font-sans"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <FileSpreadsheet size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                {snapshotData?.team_name ?? "Team"} report snapshot
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Generated {new Date(report.created_at).toLocaleString()} by {report.generator_name ?? "Manager"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {!snapshotData ? (
            <div className="py-8 text-center text-slate-500 text-xs font-mono">
              No detailed snapshot data available for this report.
            </div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-3 gap-4">
                <div className="border border-slate-800 bg-slate-900 p-3.5 text-center border-l-2 border-l-blue-500">
                  <p className="text-xs font-semibold text-slate-400">Total drivers</p>
                  <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-100">{totalDrivers}</p>
                </div>
                <div className="border border-slate-800 bg-slate-900 p-3.5 text-center border-l-2 border-l-cyan-500">
                  <p className="text-xs font-semibold text-slate-400">Total vehicles</p>
                  <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-100">{totalVehicles}</p>
                </div>
                <div className="border border-slate-800 bg-slate-900 p-3.5 text-center border-l-2 border-l-emerald-500">
                  <p className="text-xs font-semibold text-slate-400">Active pairings</p>
                  <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-400">{activePairings}</p>
                </div>
              </div>

              {/* Active Pairings Section */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <UserCheck size={15} className="text-emerald-400" />
                  <h3 className="text-xs font-bold text-slate-200">
                    Active pairings snapshot
                  </h3>
                </div>
                {pairings.length === 0 ? (
                  <p className="text-xs text-slate-500 font-mono italic">No active pairings recorded at snapshot time.</p>
                ) : (
                  <div className="border border-slate-800 bg-slate-900 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950 font-semibold text-slate-400">
                          <th className="py-2.5 px-4">Driver</th>
                          <th className="py-2.5 px-4">Vehicle chassis</th>
                          <th className="py-2.5 px-4">Engine</th>
                          <th className="py-2.5 px-4">Season</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 font-mono text-xs">
                        {pairings.map((p: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-800/40">
                            <td className="py-2.5 px-4 font-semibold text-slate-200 font-sans">
                              {p.driver_number ? `#${p.driver_number} ` : ""}{p.driver_name ?? "Driver"}
                            </td>
                            <td className="py-2.5 px-4 text-slate-200">{p.vehicle_chassis ?? "Chassis"}</td>
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
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-cyan-400" />
                  <h3 className="text-xs font-bold text-slate-200">
                    Drivers roster snapshot
                  </h3>
                </div>
                {drivers.length === 0 ? (
                  <p className="text-xs text-slate-500 font-mono italic">No drivers recorded in snapshot.</p>
                ) : (
                  <div className="border border-slate-800 bg-slate-900 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950 font-semibold text-slate-400">
                          <th className="py-2.5 px-4">#</th>
                          <th className="py-2.5 px-4">Full name</th>
                          <th className="py-2.5 px-4">Email</th>
                          <th className="py-2.5 px-4">Nationality</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 text-xs">
                        {drivers.map((d: any) => (
                          <tr key={d.driver_id ?? d.email} className="hover:bg-slate-800/40">
                            <td className="py-2 px-4 font-bold font-mono text-slate-300">#{d.driver_number ?? "—"}</td>
                            <td className="py-2 px-4 font-semibold text-slate-200">{d.full_name ?? "Driver"}</td>
                            <td className="py-2 px-4 text-slate-500 font-mono text-[11px]">{d.email ?? "—"}</td>
                            <td className="py-2 px-4 text-slate-400">{d.nationality ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Vehicles Snapshot */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Car size={15} className="text-blue-400" />
                  <h3 className="text-xs font-bold text-slate-200">
                    Garage vehicles snapshot
                  </h3>
                </div>
                {vehicles.length === 0 ? (
                  <p className="text-xs text-slate-500 font-mono italic">No vehicles recorded in snapshot.</p>
                ) : (
                  <div className="border border-slate-800 bg-slate-900 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950 font-semibold text-slate-400">
                          <th className="py-2.5 px-4">Chassis</th>
                          <th className="py-2.5 px-4">Engine specification</th>
                          <th className="py-2.5 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 font-mono text-xs">
                        {vehicles.map((v: any) => (
                          <tr key={v.vehicle_id ?? v.chassis} className="hover:bg-slate-800/40">
                            <td className="py-2 px-4 font-semibold text-slate-200">{v.chassis}</td>
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
        <div className="border-t border-slate-800 px-5 py-3 flex justify-end bg-slate-900/80">
          <button
            onClick={onClose}
            className="border border-slate-700 bg-slate-900 px-4 py-1.5 text-xs font-mono text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Close summary
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
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Team performance reports</h1>
          <p className="mt-1 text-xs text-slate-400">
            Generate and review operational snapshots of drivers, garage vehicles, and active pairings.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className="flex items-center gap-2 border border-ferrari-red bg-ferrari-red px-4 py-2 text-xs font-semibold text-white hover:bg-ferrari-red/90 disabled:opacity-60 transition-colors"
        >
          {generateMutation.isPending ? (
            <>
              <Activity size={15} className="animate-spin" /> Generating snapshot…
            </>
          ) : (
            <>
              <Plus size={15} /> Generate team report
            </>
          )}
        </button>
      </div>

      {/* Reports Table */}
      <div className="border border-slate-800 bg-slate-surface border-l-2 border-l-cyan-500">
        <div className="border-b border-slate-800 px-5 py-3.5 flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-200">
              Past reports history ({reports.length})
            </h2>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center gap-2 text-slate-500 font-mono text-xs">
            <Activity size={20} className="animate-pulse text-ferrari-red" />
            <span>Loading team reports…</span>
          </div>
        ) : isError ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-500 font-mono text-xs">
            <AlertCircle size={20} className="text-amber" />
            <p>Failed to load reports history.</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-600 font-mono text-xs">
            <FileText size={24} />
            <p>No team reports generated yet. Click "Generate team report" to create your first snapshot.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-xs font-semibold text-slate-400">
                  <th className="py-3 px-5">Report ID</th>
                  <th className="py-3 px-5">Report type</th>
                  <th className="py-3 px-5">Generated by</th>
                  <th className="py-3 px-5">Date & time</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {reports.map((report) => (
                  <tr key={report.report_id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-slate-300">
                      {report.report_id.substring(0, 8)}…
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="border border-cyan-500/40 bg-cyan-950/40 px-2 py-0.5 text-[11px] font-mono font-bold text-cyan-400 inline-block">
                        {report.report_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-200 font-semibold">
                      {report.generator_name ?? "System"}
                    </td>
                    <td className="py-3.5 px-5 text-slate-400 font-mono">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} />
                        {new Date(report.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => setSelectedReport(report)}
                        className="inline-flex items-center gap-1 border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:border-cyan-400/50 hover:text-cyan-400 transition-colors"
                      >
                        <Eye size={11} /> View summary
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
