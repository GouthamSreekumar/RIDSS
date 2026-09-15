"use client";

import { Activity, Clock } from "lucide-react";

interface FastF1LoadingSkeletonProps {
  title?: string;
  message?: string;
  variant?: "overview" | "telemetry" | "calendar" | "default";
}

const timingInfoMap = {
  calendar: "Results-only sync: ~1–3s when uncached. Instant on cached rounds.",
  overview: "Tier 1 overview (laps & weather): ~3–8s when uncached. Instant when cached.",
  telemetry: "Tier 2 lap telemetry stream: ~8–15s when uncached. Instant when cached.",
  default: "First-time session load: ~3–10s when uncached. Instant on cached loads.",
};

export function FastF1LoadingSkeleton({
  title = "Loading FastF1 telemetry stream",
  message = "Fetching session lap data and vehicle channels from FastF1 engine…",
  variant = "default",
}: FastF1LoadingSkeletonProps) {
  const timingText = timingInfoMap[variant] || timingInfoMap.default;

  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] border border-slate-800 bg-slate-surface p-8 text-center border-l-2 border-l-cyan-400 font-sans">
      <div className="mb-5 flex h-14 w-14 items-center justify-center border border-cyan-400/40 bg-cyan-400/10 text-cyan-400">
        <Activity className="h-7 w-7 text-cyan-400 animate-pulse" />
      </div>

      <h3 className="text-base font-bold tracking-tight text-slate-100 mb-1.5">{title}</h3>
      <p className="max-w-md text-xs text-slate-400 mb-5">{message}</p>

      {/* Dynamic load info badge */}
      <div className="inline-flex items-center gap-2 border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1.5 text-xs font-mono text-cyan-300 mb-8">
        <Clock size={13} className="shrink-0 text-cyan-400" />
        <span>{timingText}</span>
      </div>

      {/* Skeleton placeholders */}
      <div className="w-full max-w-2xl space-y-3 font-mono">
        <div className="h-3 w-3/4 bg-slate-800/80 animate-pulse mx-auto" />
        <div className="h-10 w-full bg-slate-800/60 animate-pulse border border-slate-800" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-16 bg-slate-800/50 animate-pulse border border-slate-800" />
          <div className="h-16 bg-slate-800/50 animate-pulse border border-slate-800" />
          <div className="h-16 bg-slate-800/50 animate-pulse border border-slate-800" />
        </div>
      </div>
    </div>
  );
}
