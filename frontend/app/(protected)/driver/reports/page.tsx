"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  FileText,
  RefreshCw,
  Search,
  User,
  Zap,
} from "lucide-react";
import axiosInstance from "@/lib/axios";
import { FastF1LoadingSkeleton } from "@/components/race-engineer/FastF1LoadingSkeleton";

interface DriverReport {
  report_id: string;
  team_id?: string;
  generated_by: string;
  generator_name: string;
  report_type: string;
  created_at: string;
  data: {
    session_id?: string;
    driver_code?: string;
    driver_name?: string;
    lap_numbers?: number[];
    key_findings?: string;
    stint_degradation_trend?: string;
    summary_stats?: Record<string, any>;
  };
}

async function fetchDriverReports(): Promise<DriverReport[]> {
  const res = await axiosInstance.get("/api/v1/driver/reports");
  return res.data;
}

function DriverReportsContent() {
  const searchParams = useSearchParams();
  const reportIdParam = searchParams.get("id");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReport, setSelectedReport] = useState<DriverReport | null>(null);

  const { data: reports, isLoading, isError, error, refetch } = useQuery<DriverReport[]>({
    queryKey: ["driverReports"],
    queryFn: fetchDriverReports,
    staleTime: 60 * 1000,
  });

  // Deep-link auto-open report if ?id= is present in URL
  useEffect(() => {
    if (reportIdParam && reports && reports.length > 0) {
      const matched = reports.find((r) => r.report_id === reportIdParam);
      if (matched) {
        setSelectedReport(matched);
      }
    }
  }, [reportIdParam, reports]);

  const filteredReports = (reports || []).filter((r) => {
    const sId = r.data?.session_id || "";
    const dName = r.data?.driver_name || r.data?.driver_code || "";
    const findings = r.data?.key_findings || "";
    const q = searchTerm.toLowerCase();
    return (
      sId.toLowerCase().includes(q) ||
      dName.toLowerCase().includes(q) ||
      findings.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <FastF1LoadingSkeleton
        title="Loading Driver Reports"
        message="Fetching personal performance analysis reports..."
      />
    );
  }

  if (isError) {
    return (
      <div className="border border-red-500/30 bg-red-950/20 p-8 text-center text-red-400 border-l-2 border-l-red-500 font-sans">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <h3 className="text-base font-bold">Failed to load performance reports</h3>
        <p className="text-xs mt-1 text-red-300/80 mb-4 font-mono">
          {error instanceof Error ? error.message : "Unable to fetch report records."}
        </p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-mono font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <RefreshCw size={13} /> Retry loading
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-cyan-400">
        <div>
          <div className="flex items-center gap-2 mb-1.5 font-mono">
            <span className="sharp-tag bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              <FileText size={12} className="text-cyan-400 mr-1" /> Own performance reports
            </span>
            <span className="text-xs text-slate-400">• Driver-scoped engineering analysis</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">Performance reports</h1>
          <p className="text-xs text-slate-400 mt-1">
            Read engineering session summaries, stint degradation trends, and key performance findings.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search reports by session or findings..."
            className="w-full border border-slate-800 bg-slate-surface pl-9 pr-4 py-2 text-xs text-slate-100 font-mono focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <span className="text-xs font-mono text-slate-400">
          Showing <strong className="text-slate-200 tabular-nums">{filteredReports.length}</strong> reports
        </span>
      </div>

      {/* Reports DataTable */}
      <div className="border border-slate-800 bg-slate-surface overflow-hidden border-l-2 border-l-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-mono text-xs border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 font-medium">Report ID</th>
                <th className="py-3 px-4 font-medium">Session ID</th>
                <th className="py-3 px-4 font-medium">Generated by</th>
                <th className="py-3 px-4 font-medium">Created date</th>
                <th className="py-3 px-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                    No performance reports found.
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => (
                  <tr key={report.report_id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-cyan-400">
                      #{report.report_id.slice(0, 8)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-200">
                      {report.data?.session_id || "Session report"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-sans">
                      {report.generator_name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 tabular-nums">
                      {new Date(report.created_at).toLocaleDateString()}{" "}
                      {new Date(report.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedReport(report)}
                        className="sharp-tag border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-400 hover:text-slate-950 transition-colors"
                      >
                        View detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Readable Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 font-sans">
          <div className="w-full max-w-2xl border border-slate-700 bg-slate-surface p-6 shadow-2xl space-y-6 border-l-2 border-l-cyan-400">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="sharp-tag bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono">
                  [Report #{selectedReport.report_id.slice(0, 8)}]
                </span>
                <h2 className="text-lg font-semibold tracking-tight text-slate-100 mt-1">
                  Engineering analysis: {selectedReport.data?.session_id || "F1 Session"}
                </h2>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-slate-400 hover:text-slate-200 font-mono text-base"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 border border-slate-800 text-xs font-mono">
                <div>
                  <p className="text-slate-400">Target driver:</p>
                  <p className="text-slate-100 font-semibold text-sm mt-0.5 font-sans">
                    {selectedReport.data?.driver_name || selectedReport.data?.driver_code || "Driver"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Generated by:</p>
                  <p className="text-slate-100 font-semibold text-sm mt-0.5 font-sans">
                    {selectedReport.generator_name}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-300 mb-1.5">
                  Key engineering findings
                </h4>
                <div className="bg-slate-950 p-4 border border-slate-800 text-xs text-slate-200 leading-relaxed font-mono">
                  {selectedReport.data?.key_findings || "No key findings notes entered."}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-300 mb-1.5">
                  Stint degradation trend
                </h4>
                <div className="bg-slate-950 p-4 border border-slate-800 text-xs text-amber-300 leading-relaxed font-mono">
                  {selectedReport.data?.stint_degradation_trend || "Normal tire degradation observed."}
                </div>
              </div>

              {selectedReport.data?.summary_stats && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 mb-1.5">
                    Summary performance statistics
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.entries(selectedReport.data.summary_stats).map(([k, v]) => (
                      <div key={k} className="bg-slate-950 p-3 border border-slate-800 text-xs font-mono">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">{k.replace(/_/g, " ")}</p>
                        <p className="text-sm font-bold text-cyan-300 mt-1">{String(v)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedReport(null)}
                className="border border-slate-700 bg-slate-950 px-5 py-2 text-xs font-mono font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Close view
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DriverReportsPage() {
  return (
    <Suspense fallback={<FastF1LoadingSkeleton title="Loading Driver Reports" message="Fetching personal performance analysis reports..." />}>
      <DriverReportsContent />
    </Suspense>
  );
}

