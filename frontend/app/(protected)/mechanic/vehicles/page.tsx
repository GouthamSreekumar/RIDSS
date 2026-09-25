"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Car,
  CheckCircle2,
  ChevronRight,
  Filter,
  Search,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { useMechanicVehicles } from "@/features/mechanic/api/mechanicApi";

export default function MechanicVehiclesPage() {
  const { data: vehicles = [], isLoading, error } = useMechanicVehicles();
  const [search, setSearch] = useState("");
  const [filterHealth, setFilterHealth] = useState<string>("all");

  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch =
      v.chassis.toLowerCase().includes(search.toLowerCase()) ||
      v.engine.toLowerCase().includes(search.toLowerCase()) ||
      (v.current_driver_name && v.current_driver_name.toLowerCase().includes(search.toLowerCase()));

    const matchesHealth = filterHealth === "all" || v.health_status === filterHealth;

    return matchesSearch && matchesHealth;
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 font-mono text-xs text-slate-500">
        <Activity size={20} className="animate-pulse text-ferrari-red" />
        <span>Loading garage vehicles and component statuses…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-500/30 bg-red-950/20 p-6 font-mono text-xs text-red-400 flex items-center gap-3">
        <AlertCircle size={20} />
        <span>Failed to load vehicle list. Check network connection or permissions.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Garage Vehicle Fleet</h1>
          <p className="mt-1 text-xs text-slate-400">
            Computed overall vehicle health status derived directly from real-time component wear logs.
          </p>
        </div>
        <Link
          href="/mechanic/maintenance"
          className="flex items-center gap-1.5 border border-ferrari-red bg-ferrari-red px-3.5 py-2 text-xs font-mono font-semibold text-white hover:bg-ferrari-red/90 transition-colors w-fit"
        >
          <Wrench size={14} /> Schedule Maintenance
        </Link>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 border border-slate-800 bg-slate-surface p-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search chassis, engine, or assigned driver…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-slate-700 bg-slate-900 pl-9 pr-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-ferrari-red transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-500 shrink-0" />
          <select
            value={filterHealth}
            onChange={(e) => setFilterHealth(e.target.value)}
            className="border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-ferrari-red transition-colors"
          >
            <option value="all">All Health Tiers</option>
            <option value="good">Good Only</option>
            <option value="needs_attention">Needs Attention</option>
            <option value="critical">Critical Only</option>
          </select>
        </div>
      </div>

      {/* Vehicle Grid */}
      {filteredVehicles.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 border border-slate-800 bg-slate-surface text-slate-500 font-mono text-xs">
          <Car size={24} />
          <p>No vehicles found matching current search or filter criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredVehicles.map((v) => {
            const isCritical = v.health_status === "critical";
            const isAttention = v.health_status === "needs_attention";

            return (
              <div
                key={v.vehicle_id}
                className={`border bg-slate-surface p-5 flex flex-col justify-between border-l-4 ${
                  isCritical
                    ? "border-slate-800 border-l-red-500"
                    : isAttention
                    ? "border-slate-800 border-l-amber"
                    : "border-slate-800 border-l-emerald-500"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold font-mono text-slate-100">{v.chassis}</h3>
                      <p className="text-xs text-slate-400 font-mono">{v.engine}</p>
                    </div>

                    {/* Health Status Badge */}
                    <span
                      className={`border px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider inline-flex items-center gap-1.5 ${
                        isCritical
                          ? "border-red-500/40 bg-red-950/40 text-red-400"
                          : isAttention
                          ? "border-amber/40 bg-amber/10 text-amber"
                          : "border-emerald-500/40 bg-emerald-950/40 text-emerald-400"
                      }`}
                    >
                      {isCritical ? (
                        <>
                          <ShieldAlert size={12} /> Critical
                        </>
                      ) : isAttention ? (
                        <>
                          <AlertTriangle size={12} /> Needs Attention
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={12} /> Good
                        </>
                      )}
                    </span>
                  </div>

                  {/* Driver Pairing Info */}
                  <div className="border border-slate-800 bg-slate-900/60 p-2.5 font-mono text-xs text-slate-300">
                    <span className="text-slate-500">Pairing: </span>
                    {v.current_driver_name ? (
                      <span className="text-slate-100 font-semibold">{v.current_driver_name}</span>
                    ) : (
                      <span className="text-slate-500 italic">Unassigned</span>
                    )}
                  </div>

                  {/* Component Stats Breakdown */}
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono text-xs">
                    <div className="border border-slate-800/80 bg-slate-900/40 p-2">
                      <p className="text-[10px] text-slate-500 uppercase">Total</p>
                      <p className="text-sm font-bold text-slate-200 mt-0.5">{v.total_components}</p>
                    </div>
                    <div className="border border-slate-800/80 bg-slate-900/40 p-2">
                      <p className="text-[10px] text-slate-500 uppercase">Attention</p>
                      <p className={`text-sm font-bold mt-0.5 ${v.attention_count > 0 ? "text-amber" : "text-slate-400"}`}>
                        {v.attention_count}
                      </p>
                    </div>
                    <div className="border border-slate-800/80 bg-slate-900/40 p-2">
                      <p className="text-[10px] text-slate-500 uppercase">Critical</p>
                      <p className={`text-sm font-bold mt-0.5 ${v.critical_count > 0 ? "text-red-400" : "text-slate-400"}`}>
                        {v.critical_count}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer Action Button */}
                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-500 uppercase">
                    Status: <span className="text-slate-300">{v.status}</span>
                  </span>
                  <Link
                    href={`/mechanic/vehicles/${v.vehicle_id}`}
                    className="border border-ferrari-red bg-ferrari-red px-3 py-1.5 text-xs font-mono font-semibold text-white hover:bg-ferrari-red/90 transition-colors flex items-center gap-1"
                  >
                    Components <ChevronRight size={13} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
