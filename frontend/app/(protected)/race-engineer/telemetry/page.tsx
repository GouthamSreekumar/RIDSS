"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  Flame,
  Gauge,
  Layers,
  Radio,
  Search,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axiosInstance from "@/lib/axios";
import { FastF1LoadingSkeleton } from "@/components/race-engineer/FastF1LoadingSkeleton";

interface DriverResult {
  driver_code: string;
  driver_number: number;
  full_name?: string;
  team_name?: string;
  grid_position?: number;
  position?: number;
  points?: number;
  status?: string;
}

interface LapSummary {
  lap_number: number;
  driver_code: string;
  driver_number: number;
  lap_time_seconds?: number;
  lap_time_str?: string;
  sector_1_seconds?: number;
  sector_2_seconds?: number;
  sector_3_seconds?: number;
  stint?: number;
  compound?: string;
  tyre_life?: number;
  pit_in_time_str?: string;
  pit_out_time_str?: string;
  track_status?: string;
  is_personal_best: boolean;
  deleted?: boolean;
  deleted_reason?: string;
  is_accurate?: boolean;
  speed_st?: number;
  speed_fl?: number;
}

interface SessionOverview {
  session_id: string;
  season: number;
  circuit_name: string;
  session_name: string;
  total_laps: number;
  session_results?: DriverResult[];
  driver_lap_summaries: Record<string, LapSummary[]>;
}

interface CircuitSummary {
  circuit_id: string;
  circuit_name: string;
  country: string;
  length: number;
  round_number?: number;
}

const COMPOUND_TAG_CLASSES: Record<string, string> = {
  SOFT: "border-red-500/50 bg-red-950/40 text-red-400",
  MEDIUM: "border-amber-400/50 bg-amber-950/40 text-amber-400",
  HARD: "border-slate-400/50 bg-slate-900 text-slate-200",
  INTERMEDIATE: "border-emerald-500/50 bg-emerald-950/40 text-emerald-400",
  WET: "border-blue-500/50 bg-blue-950/40 text-blue-400",
};

const COMPOUND_HEX_MAP: Record<string, string> = {
  SOFT: "#EF4444",
  MEDIUM: "#F59E0B",
  HARD: "#E2E8F0",
  INTERMEDIATE: "#10B981",
  WET: "#3B82F6",
};

const COMPOUND_LEGEND = [
  { name: "SOFT", hex: "#EF4444", label: "Soft" },
  { name: "MEDIUM", hex: "#F59E0B", label: "Medium" },
  { name: "HARD", hex: "#E2E8F0", label: "Hard" },
  { name: "INTERMEDIATE", hex: "#10B981", label: "Intermediate" },
  { name: "WET", hex: "#3B82F6", label: "Wet" },
];

export type TrackStatusType = "NORMAL" | "SC" | "VSC" | "RED" | "YELLOW" | "UNKNOWN";

export interface TrackStatusInfo {
  type: TrackStatusType;
  code?: string;
  label: string;
  fullLabel: string;
  badgeClass: string;
  isCaution: boolean;
  unmapped?: boolean;
}

/**
 * FastF1 TrackStatus parser:
 * '1' = AllClear (Normal)
 * '2' = Yellow flag
 * '4' = Safety Car (SC)
 * '5' = Red flag
 * '6' = VSC Deployed
 * '7' = VSC Ending
 */
export function parseTrackStatus(trackStatus?: string | null): TrackStatusInfo {
  if (!trackStatus || trackStatus === "1" || trackStatus.trim() === "") {
    return {
      type: "NORMAL",
      label: "Normal",
      fullLabel: "Normal track status",
      badgeClass: "text-slate-500",
      isCaution: false,
    };
  }

  const statusStr = trackStatus.trim();
  const digits = statusStr.split("");

  // Check for expected FastF1 digits: 1, 2, 4, 5, 6, 7
  const validDigits = new Set(["1", "2", "4", "5", "6", "7"]);
  const hasUnmappedDigit = digits.some((d) => !validDigits.has(d));

  if (hasUnmappedDigit) {
    console.warn(
      `[FastF1 TrackStatus] Unmapped track_status code encountered: "${statusStr}". Please verify against FastF1 documentation.`
    );
  }

  // Safety Car (4) takes highest caution precedence
  if (statusStr.includes("4")) {
    return {
      type: "SC",
      code: statusStr,
      label: "SC",
      fullLabel: "Safety Car lap",
      badgeClass: "border border-amber-400/60 bg-amber-950/70 text-amber-400 font-bold",
      isCaution: true,
      unmapped: hasUnmappedDigit,
    };
  }

  // VSC Deployed (6) or VSC Ending (7)
  if (statusStr.includes("6") || statusStr.includes("7")) {
    return {
      type: "VSC",
      code: statusStr,
      label: "VSC",
      fullLabel: "VSC lap",
      badgeClass: "border border-amber-400/50 bg-amber-950/50 text-amber-400 font-bold",
      isCaution: true,
      unmapped: hasUnmappedDigit,
    };
  }

  // Red Flag (5)
  if (statusStr.includes("5")) {
    return {
      type: "RED",
      code: statusStr,
      label: "RED",
      fullLabel: "Red Flag lap",
      badgeClass: "border border-red-500/60 bg-red-950/60 text-red-400 font-bold",
      isCaution: true,
      unmapped: hasUnmappedDigit,
    };
  }

  // Yellow Flag (2)
  if (statusStr.includes("2")) {
    return {
      type: "YELLOW",
      code: statusStr,
      label: "YELLOW",
      fullLabel: "Yellow Flag lap",
      badgeClass: "border border-yellow-500/40 bg-yellow-950/30 text-yellow-400 font-bold",
      isCaution: true,
      unmapped: hasUnmappedDigit,
    };
  }

  // Fallback for unmapped status string without known digits
  return {
    type: "UNKNOWN",
    code: statusStr,
    label: `TRACK-${statusStr}`,
    fullLabel: `Track status: ${statusStr} (Unmapped)`,
    badgeClass: "border border-amber-500/40 bg-amber-950/30 text-amber-300 font-bold",
    isCaution: true,
    unmapped: true,
  };
}

function SessionLapChart({
  laps,
  currentDriverCode,
  circuit,
  season,
  sessionType,
}: {
  laps: LapSummary[];
  currentDriverCode: string;
  circuit: string;
  season: number;
  sessionType: string;
}) {
  const router = useRouter();
  const [hoveredLap, setHoveredLap] = useState<LapSummary | null>(null);

  if (!laps || laps.length === 0) return null;

  const validLaps = laps.filter(
    (l) => l.lap_time_seconds && l.lap_time_seconds > 0 && !l.deleted
  );
  const validLapTimes = validLaps.map((l) => l.lap_time_seconds!);

  const minLapTime = validLapTimes.length > 0 ? Math.min(...validLapTimes) : 90;
  const maxLapTime = validLapTimes.length > 0 ? Math.max(...validLapTimes) : 120;

  // Effective cutoff for in/out pit laps so normal laps have full visual resolution
  const pitCutoff = minLapTime * 1.25;
  const effectiveMax = Math.min(maxLapTime, pitCutoff);
  const yMin = Math.max(0, minLapTime * 0.95);
  const yMax = Math.max(yMin + 5, effectiveMax * 1.03);

  // Grid line values
  const gridTicks = [
    yMin,
    yMin + (yMax - yMin) * 0.33,
    yMin + (yMax - yMin) * 0.66,
    yMax,
  ];

  const formatSecToStr = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return m > 0 ? `${m}:${s.padStart(4, "0")}s` : `${s}s`;
  };

  const viewBoxWidth = 900;
  const viewBoxHeight = 220;
  const padLeft = 65;
  const padRight = 20;
  const padTop = 28;
  const padBottom = 32;
  const chartWidth = viewBoxWidth - padLeft - padRight;
  const chartHeight = viewBoxHeight - padTop - padBottom;
  const slotWidth = chartWidth / laps.length;
  const barWidth = Math.max(3, Math.min(22, slotWidth * 0.75));

  const activeLap = hoveredLap || laps.find((l) => l.is_personal_best) || laps[0];
  const activeTrackInfo = parseTrackStatus(activeLap?.track_status);

  return (
    <div className="border-b border-slate-800 bg-slate-950 p-4 space-y-3 font-mono">
      {/* HUD Readout Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900/90 p-2.5 border border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-slate-100 font-sans">
            Lap #{activeLap.lap_number}
          </span>
          <span className="text-cyan-400 font-bold tabular-nums">
            {activeLap.lap_time_str || (activeLap.lap_time_seconds ? `${activeLap.lap_time_seconds.toFixed(3)}s` : "—")}
          </span>
          {activeLap.compound && (
            <span
              style={{
                borderColor: COMPOUND_HEX_MAP[activeLap.compound.toUpperCase()] || "#64748B",
                color: COMPOUND_HEX_MAP[activeLap.compound.toUpperCase()] || "#64748B",
              }}
              className="border px-2 py-0.5 text-[10px] font-bold"
            >
              {activeLap.compound} (Stint {activeLap.stint ?? 1})
            </span>
          )}
          {activeLap.sector_1_seconds && (
            <span className="text-slate-400 text-[11px] tabular-nums">
              S1: {activeLap.sector_1_seconds.toFixed(3)}s | S2: {activeLap.sector_2_seconds?.toFixed(3)}s | S3: {activeLap.sector_3_seconds?.toFixed(3)}s
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeLap.is_personal_best && (
            <span className="border border-emerald-500/40 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              Personal best lap
            </span>
          )}
          {activeLap.deleted && (
            <span
              title={activeLap.deleted_reason ? `Deleted: ${activeLap.deleted_reason}` : "Deleted lap"}
              className="border border-red-500/40 bg-red-950/60 px-2 py-0.5 text-[10px] font-bold text-red-400 max-w-[220px] truncate inline-block"
            >
              {activeLap.deleted_reason ? `Deleted — ${activeLap.deleted_reason}` : "Deleted lap"}
            </span>
          )}
          {activeTrackInfo.isCaution && (
            <span
              title={activeTrackInfo.fullLabel}
              className={`px-2 py-0.5 text-[10px] font-bold inline-block ${activeTrackInfo.badgeClass}`}
            >
              [{activeTrackInfo.fullLabel}]
            </span>
          )}
          <span className="text-[10px] text-slate-500">Click bar for Tier 2 detail</span>
        </div>
      </div>

      {/* SVG Chart Container */}
      <div className="relative w-full overflow-hidden bg-slate-950 border border-slate-900">
        <svg viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} className="w-full h-auto select-none">
          {/* Grid Lines & Y-axis labels */}
          {gridTicks.map((val, idx) => {
            const ratio = (val - yMin) / (yMax - yMin);
            const yPos = padTop + chartHeight - ratio * chartHeight;
            return (
              <g key={`grid_${idx}`}>
                <line
                  x1={padLeft}
                  y1={yPos}
                  x2={viewBoxWidth - padRight}
                  y2={yPos}
                  stroke="#1E293B"
                  strokeWidth="1"
                  strokeDasharray={idx === 0 ? "none" : "3 3"}
                />
                <text
                  x={padLeft - 8}
                  y={yPos}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize="9"
                  fill="#64748B"
                  className="font-mono"
                >
                  {formatSecToStr(val)}
                </text>
              </g>
            );
          })}

          {/* Render Bars */}
          {laps.map((lap, idx) => {
            const isHovered = hoveredLap?.lap_number === lap.lap_number;
            const isPb = lap.is_personal_best;
            const isDel = lap.deleted;
            const trackInfo = parseTrackStatus(lap.track_status);
            const compoundHex = COMPOUND_HEX_MAP[lap.compound?.toUpperCase() || ""] || "#64748B";

            let barH = 4;
            if (lap.lap_time_seconds && lap.lap_time_seconds > 0) {
              const clampedVal = Math.min(lap.lap_time_seconds, yMax);
              const ratio = Math.max(0.04, (clampedVal - yMin) / (yMax - yMin));
              barH = Math.max(6, ratio * chartHeight);
            }
            const barY = padTop + chartHeight - barH;
            const barX = padLeft + idx * slotWidth + (slotWidth - barWidth) / 2;

            const tooltipTitle = [
              `Lap #${lap.lap_number}: ${
                lap.lap_time_str || (lap.lap_time_seconds ? `${lap.lap_time_seconds.toFixed(3)}s` : "No time")
              }`,
              trackInfo.isCaution ? trackInfo.fullLabel : null,
              isDel ? `Deleted${lap.deleted_reason ? `: ${lap.deleted_reason}` : ""}` : null,
            ]
              .filter(Boolean)
              .join(" | ");

            return (
              <g
                key={`lap_bar_${lap.lap_number}`}
                onMouseEnter={() => setHoveredLap(lap)}
                onMouseLeave={() => setHoveredLap(null)}
                onClick={() =>
                  router.push(
                    `/race-engineer/telemetry/${encodeURIComponent(sessionType)}/${encodeURIComponent(
                      currentDriverCode
                    )}/${lap.lap_number}?circuit=${encodeURIComponent(circuit)}&season=${season}`
                  )
                }
                className="cursor-pointer group"
              >
                <title>{tooltipTitle}</title>

                {/* Column Invisible Click Target Box */}
                <rect
                  x={padLeft + idx * slotWidth}
                  y={padTop}
                  width={slotWidth}
                  height={chartHeight}
                  fill="transparent"
                />

                {/* Main Lap Time Bar */}
                <rect
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={barH}
                  fill={compoundHex}
                  fillOpacity={isDel ? 0.35 : isHovered ? 1 : 0.85}
                  stroke={isPb ? "#06B6D4" : isDel ? "#EF4444" : isHovered ? "#F8FAFC" : "none"}
                  strokeWidth={isPb ? 2 : isHovered ? 1.5 : 0}
                  strokeDasharray={isDel ? "2 2" : "none"}
                  className="transition-all duration-150"
                />

                {/* SC / VSC Solid Amber Top & Left Accent Marker */}
                {trackInfo.isCaution && (
                  <g>
                    {/* Top solid amber cap */}
                    <rect
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={Math.min(4, Math.max(2, barH * 0.15))}
                      fill="#F59E0B"
                    />
                    {/* Left solid amber accent line */}
                    <rect
                      x={barX}
                      y={barY}
                      width={Math.min(2.5, barWidth)}
                      height={barH}
                      fill="#F59E0B"
                    />
                  </g>
                )}

                {/* Personal Best Highlight Top Marker Tag */}
                {isPb && (
                  <g>
                    <line
                      x1={barX + barWidth / 2}
                      y1={padTop}
                      x2={barX + barWidth / 2}
                      y2={barY}
                      stroke="#06B6D4"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                      opacity="0.6"
                    />
                    <rect
                      x={barX + barWidth / 2 - 8}
                      y={barY - 16}
                      width="16"
                      height="11"
                      fill="#06B6D4"
                    />
                    <text
                      x={barX + barWidth / 2}
                      y={barY - 10}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="7"
                      fontWeight="bold"
                      fill="#020617"
                    >
                      PB
                    </text>
                  </g>
                )}

                {/* Deleted Lap Tag */}
                {isDel && !isPb && (
                  <text
                    x={barX + barWidth / 2}
                    y={barY - 8}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="7"
                    fontWeight="bold"
                    fill="#EF4444"
                  >
                    DEL
                  </text>
                )}

                {/* SC / VSC Label Tag Above Bar */}
                {trackInfo.isCaution && (
                  <g key={`sc_tag_${lap.lap_number}`}>
                    <rect
                      x={barX + barWidth / 2 - (trackInfo.label.length > 3 ? 12 : 9)}
                      y={barY - (isPb ? 27 : isDel ? 19 : 14)}
                      width={trackInfo.label.length > 3 ? 24 : 18}
                      height="11"
                      fill="#F59E0B"
                      rx="1"
                    />
                    <text
                      x={barX + barWidth / 2}
                      y={barY - (isPb ? 21 : isDel ? 13 : 8)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="7"
                      fontWeight="bold"
                      fill="#020617"
                    >
                      {trackInfo.label}
                    </text>
                  </g>
                )}

                {/* Lap Number X-Axis Labels */}
                {(laps.length <= 25 || lap.lap_number % 5 === 0 || lap.lap_number === 1 || lap.lap_number === laps.length) && (
                  <text
                    x={barX + barWidth / 2}
                    y={viewBoxHeight - 10}
                    textAnchor="middle"
                    fontSize="9"
                    fill={isHovered ? "#F8FAFC" : "#64748B"}
                    fontWeight={isHovered ? "bold" : "normal"}
                  >
                    L{lap.lap_number}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Chart Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-900 pt-2.5 text-[11px] text-slate-400 font-mono">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold text-slate-300 font-sans">Tire compounds:</span>
          {COMPOUND_LEGEND.map((cmp) => (
            <span key={cmp.name} className="flex items-center gap-1.5">
              <span style={{ backgroundColor: cmp.hex }} className="w-2.5 h-2.5"></span>
              {cmp.label}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 text-cyan-400">
            <span className="w-2.5 h-2.5 border-2 border-cyan-400 bg-cyan-400/20"></span>
            Personal best (PB)
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-3 h-3 bg-amber-400 text-slate-950 font-bold text-[8px] flex items-center justify-center rounded-[1px]">
              SC
            </span>
            Safety Car (SC)
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-3.5 h-3 bg-amber-400/80 border border-amber-400 text-slate-950 font-bold text-[7px] flex items-center justify-center rounded-[1px]">
              VSC
            </span>
            Virtual Safety Car (VSC)
          </span>
          <span className="flex items-center gap-1.5 text-red-400">
            <span className="w-2.5 h-2.5 border border-dashed border-red-400 bg-red-950/40"></span>
            Deleted lap (reason on hover)
          </span>
        </div>
      </div>
    </div>
  );
}

export default function TelemetryOverviewPage() {
  const [season, setSeason] = useState<number>(2024);
  const [circuit, setCircuit] = useState<string>("Bahrain");
  const [sessionType, setSessionType] = useState<string>("Race");
  const [selectedDriver, setSelectedDriver] = useState<string>("");

  // Fetch Season Circuits dynamically from FastF1 backend
  const { data: dynamicCircuits = [] } = useQuery<CircuitSummary[]>({
    queryKey: ["seasonCircuits", season],
    queryFn: async () => {
      const res = await axiosInstance.get("/api/v1/race-engineer/circuits", {
        params: { season },
      });
      return res.data;
    },
    staleTime: 10 * 60 * 1000,
  });

  // Fetch Session Overview (Tier 1)
  const { data: overview, isLoading, isError, error, refetch } = useQuery<SessionOverview>({
    queryKey: ["sessionOverview", season, circuit, sessionType],
    queryFn: async () => {
      const res = await axiosInstance.get("/api/v1/race-engineer/overview", {
        params: { season, circuit, session_type: sessionType },
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const availableDrivers = overview ? Object.keys(overview.driver_lap_summaries) : [];
  const currentDriverCode =
    selectedDriver && availableDrivers.includes(selectedDriver)
      ? selectedDriver
      : availableDrivers.length > 0
      ? availableDrivers[0]
      : "VER";
  const currentDriverLaps = overview?.driver_lap_summaries[currentDriverCode] || [];

  // Compute best lap time for current driver (filtering out deleted or invalid laps)
  const validLaps = currentDriverLaps.filter(
    (l) => l.lap_time_seconds && l.lap_time_seconds > 0 && !l.deleted
  );
  const fastestLap = validLaps.length > 0
    ? validLaps.reduce((prev, curr) => (curr.lap_time_seconds! < prev.lap_time_seconds! ? curr : prev))
    : null;

  return (
    <div className="space-y-6 font-sans">
      {/* ── Page Header & Selection Controls ── */}
      <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-cyan-400">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-0.5 text-xs font-mono font-bold text-cyan-400 inline-flex items-center gap-1.5">
                <Gauge size={12} className="text-cyan-400" /> Tier 1 session overview
              </span>
              <span className="text-xs text-slate-400 font-mono">• Own-team server filtered</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">Telemetry selection & lap analysis</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Select season and circuit parameters to review lap timing, stint degradation, and sector speed trap data.
            </p>
          </div>
        </div>

        {/* Dynamic Parameter Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-950 p-3 border border-slate-800 font-mono text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1 font-sans">Season year</label>
            <select
              value={season}
              onChange={(e) => {
                setSeason(Number(e.target.value));
                setCircuit("");
              }}
              className="w-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-100 focus:border-cyan-400 focus:outline-none"
            >
              {[2023, 2024, 2025, 2026].map((y) => (
                <option key={y} value={y}>
                  Season {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1 font-sans">Circuit event</label>
            <select
              value={circuit}
              onChange={(e) => setCircuit(e.target.value)}
              className="w-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-100 focus:border-cyan-400 focus:outline-none"
            >
              {dynamicCircuits.length === 0 ? (
                <option value={circuit}>{circuit} Grand Prix</option>
              ) : (
                dynamicCircuits.map((c) => (
                  <option key={c.circuit_id} value={c.circuit_name}>
                    {c.circuit_name} ({c.country})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1 font-sans">Session type</label>
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              className="w-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-100 focus:border-cyan-400 focus:outline-none"
            >
              <option value="Race">Race</option>
              <option value="Qualifying">Qualifying</option>
              <option value="FP1">Free Practice 1</option>
              <option value="FP2">Free Practice 2</option>
              <option value="FP3">Free Practice 3</option>
              <option value="Sprint">Sprint Race</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1 font-sans">Target driver</label>
            <select
              value={currentDriverCode}
              onChange={(e) => setSelectedDriver(e.target.value)}
              disabled={availableDrivers.length === 0}
              className="w-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-100 focus:border-cyan-400 focus:outline-none disabled:opacity-50"
            >
              {availableDrivers.map((d) => (
                <option key={d} value={d}>
                  Driver {d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      {isLoading ? (
        <FastF1LoadingSkeleton
          title={`Loading FastF1 ${circuit} Telemetry`}
          message={`Fetching lap times, sector speed traps, and stint compound data for ${season} ${circuit} ${sessionType}...`}
        />
      ) : isError || !overview ? (
        <div className="border border-red-500/30 bg-red-950/20 p-8 text-center text-red-400 border-l-2 border-l-red-500">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-400" />
          <h3 className="text-base font-bold">Failed to load session overview</h3>
          <p className="text-xs mt-1 text-red-300/80 mb-4 font-mono">
            {error instanceof Error ? error.message : "Unable to fetch telemetry data from FastF1 service."}
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-mono text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Retry FastF1 fetch
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Session Classification & Driver KPI Row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Driver Summary Card */}
            <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-cyan-400 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div>
                  <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    Driver {currentDriverCode} telemetry profile
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {overview.season} {overview.circuit_name} — {overview.session_name}
                  </p>
                </div>
                <span className="border border-cyan-400/40 bg-cyan-400/10 px-2 py-0.5 text-xs font-mono font-bold text-cyan-400">
                  {currentDriverLaps.length} Laps
                </span>
              </div>

              {/* Fast Lap KPI Box */}
              {fastestLap && (
                <div className="border border-slate-800 bg-slate-950 p-3.5 border-l-2 border-l-emerald-500 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span className="flex items-center gap-1 font-semibold text-emerald-400">
                      <Flame size={13} /> Personal best lap
                    </span>
                    <span>Lap #{fastestLap.lap_number}</span>
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-100">
                    {fastestLap.lap_time_str || `${fastestLap.lap_time_seconds?.toFixed(3)}s`}
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
                    <span>S1: {fastestLap.sector_1_seconds?.toFixed(3)}s</span>
                    <span>S2: {fastestLap.sector_2_seconds?.toFixed(3)}s</span>
                    <span>S3: {fastestLap.sector_3_seconds?.toFixed(3)}s</span>
                  </div>
                </div>
              )}

              {/* Stint Overview */}
              <div className="space-y-2 pt-1">
                <p className="text-xs font-semibold text-slate-400">Stint compound breakdown</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set(currentDriverLaps.map((l) => l.compound).filter(Boolean))).map(
                    (cmp) => {
                      const tagCls = COMPOUND_TAG_CLASSES[cmp?.toUpperCase() || ""] || "border-slate-700 bg-slate-900 text-slate-300";
                      return (
                        <span
                          key={cmp}
                          className={`border px-2.5 py-0.5 text-xs font-mono font-bold ${tagCls}`}
                        >
                          {cmp}
                        </span>
                      );
                    }
                  )}
                </div>
              </div>
            </div>

            {/* Session Classification Table (2 cols) */}
            <div className="lg:col-span-2 border border-slate-800 bg-slate-surface border-l-2 border-l-emerald-500">
              <div className="border-b border-slate-800 px-5 py-3.5 flex items-center justify-between bg-slate-900/40">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-amber-400" />
                  <h2 className="text-sm font-bold text-slate-200">
                    Session classification
                  </h2>
                </div>
                <span className="text-xs font-mono text-slate-400">Own-team drivers</span>
              </div>

              {!overview.session_results || overview.session_results.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-slate-500">
                  No session results classified for this session.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950 font-semibold text-slate-400">
                        <th className="py-2.5 px-4">Pos</th>
                        <th className="py-2.5 px-4">Driver</th>
                        <th className="py-2.5 px-4">Team</th>
                        <th className="py-2.5 px-4">Grid</th>
                        <th className="py-2.5 px-4">Points</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-mono">
                      {overview.session_results.map((res) => {
                        const isSelected = res.driver_code === currentDriverCode;
                        const pos = res.position;
                        const posClass =
                          pos === 1
                            ? "bg-amber-400 text-slate-950 font-extrabold"
                            : pos === 2
                            ? "bg-slate-300 text-slate-950 font-bold"
                            : pos === 3
                            ? "bg-amber-700 text-amber-100 font-bold"
                            : "bg-slate-800 text-slate-300";

                        return (
                          <tr
                            key={res.driver_code}
                            className={`transition-colors ${
                              isSelected ? "bg-cyan-500/10 text-slate-100" : "hover:bg-slate-900/60"
                            }`}
                          >
                            <td className="py-3 px-4">
                              <span className={`w-6 h-5 inline-flex items-center justify-center text-[10px] ${posClass}`}>
                                {res.position ? `P${res.position}` : "—"}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold font-sans text-slate-100">
                              Driver {res.driver_code} <span className="text-slate-500 font-normal">#{res.driver_number}</span>
                            </td>
                            <td className="py-3 px-4 text-slate-400 font-sans">{res.team_name || "Team"}</td>
                            <td className="py-3 px-4 text-slate-400">{res.grid_position ? `P${res.grid_position}` : "—"}</td>
                            <td className="py-3 px-4 text-cyan-400 font-bold">{res.points ?? 0}</td>
                            <td className="py-3 px-4 text-slate-400">{res.status || "Classified"}</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => setSelectedDriver(res.driver_code)}
                                className={`border px-2.5 py-1 text-[11px] font-mono transition-colors ${
                                  isSelected
                                    ? "border-cyan-400 bg-cyan-400 text-slate-950 font-bold"
                                    : "border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-400"
                                }`}
                              >
                                {isSelected ? "Selected" : "Select"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ── Driver Lap Summary & Bar Chart Section ── */}
          <div className="border border-slate-800 bg-slate-surface border-l-2 border-l-cyan-400">
            <div className="border-b border-slate-800 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-cyan-400" />
                <h2 className="text-sm font-bold text-slate-200">
                  Driver {currentDriverCode} lap breakdown ({currentDriverLaps.length} laps)
                </h2>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Click any bar or lap row to launch Tier 2 detailed telemetry & track map analysis
              </p>
            </div>

            {currentDriverLaps.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-slate-500">
                No lap summary data available for Driver {currentDriverCode}.
              </div>
            ) : (
              <div>
                {/* ── Restored Session Lap Time Bar Chart ── */}
                <SessionLapChart
                  laps={currentDriverLaps}
                  currentDriverCode={currentDriverCode}
                  circuit={circuit}
                  season={season}
                  sessionType={sessionType}
                />

                {/* ── Detailed Lap Table ── */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950 font-semibold text-slate-400">
                        <th className="py-3 px-4">Lap</th>
                        <th className="py-3 px-4">Lap time</th>
                        <th className="py-3 px-4">Sector 1</th>
                        <th className="py-3 px-4">Sector 2</th>
                        <th className="py-3 px-4">Sector 3</th>
                        <th className="py-3 px-4">Stint</th>
                        <th className="py-3 px-4">Compound</th>
                        <th className="py-3 px-4">Speed ST</th>
                        <th className="py-3 px-4">Lap status</th>
                        <th className="py-3 px-4 text-right">Inspect Tier 2</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-mono">
                      {currentDriverLaps.map((lap) => {
                        const isPb = lap.is_personal_best;
                        const isDel = lap.deleted;
                        const trackInfo = parseTrackStatus(lap.track_status);
                        const compoundTag = COMPOUND_TAG_CLASSES[lap.compound?.toUpperCase() || ""] || "border-slate-700 bg-slate-900 text-slate-300";

                        return (
                          <tr
                            key={lap.lap_number}
                            className={`hover:bg-slate-900/80 transition-colors ${
                              isDel ? "bg-red-950/10" : isPb ? "bg-emerald-950/15" : trackInfo.isCaution ? "bg-amber-950/10" : ""
                            }`}
                          >
                            <td className="py-3 px-4 font-bold text-slate-200">
                              #{lap.lap_number}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-100">
                              {lap.lap_time_str || (lap.lap_time_seconds ? `${lap.lap_time_seconds.toFixed(3)}s` : "—")}
                            </td>
                            <td className="py-3 px-4 text-slate-400">
                              {lap.sector_1_seconds ? `${lap.sector_1_seconds.toFixed(3)}s` : "—"}
                            </td>
                            <td className="py-3 px-4 text-slate-400">
                              {lap.sector_2_seconds ? `${lap.sector_2_seconds.toFixed(3)}s` : "—"}
                            </td>
                            <td className="py-3 px-4 text-slate-400">
                              {lap.sector_3_seconds ? `${lap.sector_3_seconds.toFixed(3)}s` : "—"}
                            </td>
                            <td className="py-3 px-4 text-slate-400">
                              Stint {lap.stint ?? 1}
                            </td>
                            <td className="py-3 px-4">
                              {lap.compound ? (
                                <span className={`border px-2 py-0.5 text-[10px] font-bold ${compoundTag}`}>
                                  {lap.compound}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-3 px-4 text-cyan-400 font-bold">
                              {lap.speed_st ? `${Math.round(lap.speed_st)} km/h` : "—"}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {isPb && (
                                  <span className="border border-emerald-500/40 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                                    PB
                                  </span>
                                )}
                                {isDel && (
                                  <span
                                    title={lap.deleted_reason ? `Deleted: ${lap.deleted_reason}` : "Deleted lap"}
                                    className="border border-red-500/40 bg-red-950/40 px-2 py-0.5 text-[10px] font-bold text-red-400 max-w-[160px] truncate block"
                                  >
                                    {lap.deleted_reason ? `Deleted — ${lap.deleted_reason}` : "Deleted"}
                                  </span>
                                )}
                                {trackInfo.isCaution && (
                                  <span
                                    title={trackInfo.fullLabel}
                                    className={`px-2 py-0.5 text-[10px] font-bold inline-block ${trackInfo.badgeClass}`}
                                  >
                                    {trackInfo.label}
                                  </span>
                                )}
                                {!isPb && !isDel && !trackInfo.isCaution && (
                                  <span className="text-slate-500 text-[11px]">Valid</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Link
                                href={`/race-engineer/telemetry/${encodeURIComponent(sessionType)}/${encodeURIComponent(currentDriverCode)}/${lap.lap_number}?circuit=${encodeURIComponent(circuit)}&season=${season}`}
                                className="inline-flex items-center gap-1 border border-cyan-400/40 bg-slate-900 px-2.5 py-1 text-[11px] font-mono text-cyan-400 hover:bg-cyan-400 hover:text-slate-950 transition-colors"
                              >
                                Inspect <ArrowRight size={11} />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
