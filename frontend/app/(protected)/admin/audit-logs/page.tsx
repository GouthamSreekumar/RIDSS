"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, AlertCircle, AlertTriangle, ChevronRight, Clock, Filter, Search } from "lucide-react";
import { useState } from "react";
import { fetchAuditLogs, type AuditLog } from "@/features/admin/api/adminApi";

const ACTION_COLOR: Record<string, string> = {
  USER_CREATE:              "text-success-green bg-success-green/10 ring-success-green/20",
  USER_UPDATE:              "text-blue-400 bg-blue-400/10 ring-blue-400/20",
  USER_STATUS_TOGGLE:       "text-amber bg-amber/10 ring-amber/20",
  ROLE_CREATE:              "text-purple-400 bg-purple-400/10 ring-purple-400/20",
  ROLE_PERMISSIONS_UPDATE:  "text-ferrari-red bg-ferrari-red/10 ring-ferrari-red/20",
  TEAM_CREATE:              "text-cyan-400 bg-cyan-400/10 ring-cyan-400/20",
  TEAM_UPDATE:              "text-cyan-400 bg-cyan-400/10 ring-cyan-400/20",
  TEAM_MEMBER_ASSIGN:       "text-teal-400 bg-teal-400/10 ring-teal-400/20",
  TEAM_MEMBER_REMOVE:       "text-orange-400 bg-orange-400/10 ring-orange-400/20",
};

function formatTs(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function DetailsPanel({ log }: { log: AuditLog | null }) {
  if (!log) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-700 px-6">
        <ChevronRight size={24} />
        <p className="text-sm text-center">Select a log entry to view full details.</p>
      </div>
    );
  }

  let parsedDetails: unknown = log.details;
  try {
    if (log.details) parsedDetails = JSON.parse(log.details);
  } catch { /* raw string */ }

  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Action</p>
        <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${ACTION_COLOR[log.action] ?? "text-slate-400 bg-slate-700/40 ring-slate-700"}`}>
          {log.action.replace(/_/g, " ")}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-graphite-800 p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-1">Entity Type</p>
          <p className="text-sm text-slate-300 font-medium">{log.entity_type}</p>
        </div>
        <div className="rounded-lg bg-graphite-800 p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-1">Entity ID</p>
          <p className="text-xs text-slate-400 font-mono break-all">{log.entity_id ?? "—"}</p>
        </div>
        <div className="rounded-lg bg-graphite-800 p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-1">User</p>
          <p className="text-xs text-slate-400 font-mono break-all">{log.user_email ?? log.user_id ?? "—"}</p>
        </div>
        <div className="rounded-lg bg-graphite-800 p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-1">IP Address</p>
          <p className="text-sm text-slate-300">{log.ip_address ?? "—"}</p>
        </div>
      </div>
      <div className="rounded-lg bg-graphite-800 p-3">
        <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-1">Timestamp</p>
        <p className="text-xs text-slate-300 flex items-center gap-1.5"><Clock size={11} /> {formatTs(log.created_at)}</p>
      </div>
      {Boolean(parsedDetails) && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Details</p>
          <pre className="rounded-lg bg-graphite-800 p-3 text-[11px] text-slate-400 overflow-x-auto whitespace-pre-wrap break-words">
            {typeof parsedDetails === "object"
              ? JSON.stringify(parsedDetails, null, 2)
              : String(parsedDetails)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data: logs = [], isLoading, isError } = useQuery({
    queryKey: ["admin-audit-logs", actionFilter, entityFilter],
    queryFn: () => fetchAuditLogs({
      action: actionFilter || undefined,
      entity_type: entityFilter || undefined,
      limit: 200,
    }),
    refetchInterval: 30_000,
  });

  const filtered = logs.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      l.entity_type.toLowerCase().includes(q) ||
      (l.user_id ?? "").toLowerCase().includes(q) ||
      (l.entity_id ?? "").toLowerCase().includes(q)
    );
  });

  const uniqueActions = [...new Set(logs.map(l => l.action))].sort();
  const uniqueEntities = [...new Set(logs.map(l => l.entity_type))].sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-500">
          Immutable security audit trail — all administrative actions.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            className="w-full rounded-lg border border-slate-700 bg-graphite-800 pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-ferrari-red transition-all"
            placeholder="Search logs…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5 text-slate-500">
          <Filter size={14} />
        </div>
        <select
          className="rounded-lg border border-slate-700 bg-graphite-800 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-ferrari-red transition-all"
          value={actionFilter} onChange={e => setActionFilter(e.target.value)}
        >
          <option value="">All actions</option>
          {uniqueActions.map(a => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
        </select>
        <select
          className="rounded-lg border border-slate-700 bg-graphite-800 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-ferrari-red transition-all"
          value={entityFilter} onChange={e => setEntityFilter(e.target.value)}
        >
          <option value="">All entities</option>
          {uniqueEntities.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Split view: log list + detail panel */}
      <div className="flex gap-4 min-h-[500px]">
        {/* Log list */}
        <div className="flex-1 rounded-xl border border-slate-800 bg-slate-surface overflow-hidden flex flex-col">
          <div className="border-b border-slate-800 px-4 py-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-slate-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {isLoading ? "Loading…" : `${filtered.length} event${filtered.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Activity size={20} className="animate-pulse text-ferrari-red" />
            </div>
          ) : isError ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-500">
              <AlertCircle size={20} className="text-amber" />
              <p className="text-sm">Failed to load audit logs.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-600">
              <AlertTriangle size={24} />
              <p className="text-sm">No audit events found.</p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              {filtered.map(log => (
                <motion.button
                  key={log.log_id}
                  onClick={() => setSelectedLog(log)}
                  className={`w-full flex items-start gap-3 px-4 py-3 border-b border-slate-800/40 text-left transition-all hover:bg-slate-800/30 ${
                    selectedLog?.log_id === log.log_id ? "bg-slate-800/40 border-l-2 border-l-ferrari-red" : ""
                  }`}
                >
                  <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ${ACTION_COLOR[log.action] ?? "text-slate-500 bg-slate-700/40 ring-slate-700"}`}>
                    {log.action.replace(/_/g, " ")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 truncate">{log.entity_type} {log.entity_id ? `· ${log.entity_id.slice(0, 8)}…` : ""}</p>
                    <p className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                      <Clock size={10} />
                      {formatTs(log.created_at)}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="w-80 shrink-0 rounded-xl border border-slate-800 bg-slate-surface overflow-hidden">
          <div className="border-b border-slate-800 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Event Details</span>
          </div>
          <DetailsPanel log={selectedLog} />
        </div>
      </div>
    </div>
  );
}
