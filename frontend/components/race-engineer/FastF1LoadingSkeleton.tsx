"use client";

import { Activity, Clock, Database } from "lucide-react";

interface FastF1LoadingSkeletonProps {
  title?: string;
  message?: string;
}

export function FastF1LoadingSkeleton({
  title = "Loading FastF1 Telemetry Stream",
  message = "Fetching session lap data and vehicle channels from FastF1 engine...",
}: FastF1LoadingSkeletonProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] rounded-xl border border-slate-800/80 bg-slate-900/60 p-8 text-center backdrop-blur-sm">
      <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 ring-1 ring-cyan-500/30 shadow-lg shadow-cyan-500/5">
        <Activity className="h-8 w-8 text-cyan-400 animate-pulse" />
        <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 animate-ping" />
      </div>

      <h3 className="text-lg font-bold tracking-tight text-slate-100 mb-2">{title}</h3>
      <p className="max-w-md text-sm text-slate-400 mb-6">{message}</p>

      {/* Uncached load info badge */}
      <div className="inline-flex items-center gap-2 rounded-lg bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20 mb-8">
        <Clock size={14} className="shrink-0 text-amber-400" />
        <span>First-time session load may take 15–30 seconds. Cached loads are near-instantaneous.</span>
      </div>

      {/* Skeleton placeholders */}
      <div className="w-full max-w-2xl space-y-3">
        <div className="h-4 w-3/4 rounded bg-slate-800/80 animate-pulse mx-auto" />
        <div className="h-12 w-full rounded-lg bg-slate-800/60 animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-20 rounded-lg bg-slate-800/50 animate-pulse" />
          <div className="h-20 rounded-lg bg-slate-800/50 animate-pulse" />
          <div className="h-20 rounded-lg bg-slate-800/50 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
