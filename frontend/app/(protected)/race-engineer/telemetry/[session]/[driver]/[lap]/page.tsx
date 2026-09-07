"use client";

import { use, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Cpu,
  FastForward,
  FileText,
  Gauge,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axiosInstance from "@/lib/axios";
import { FastF1LoadingSkeleton } from "@/components/race-engineer/FastF1LoadingSkeleton";

interface TelemetryPoint {
  distance: number;
  time_seconds: number;
  speed: number;
  rpm: number;
  throttle: number;
  brake: number;
  gear: number;
  drs: number;
  x: number;
  y: number;
}

interface LapTelemetry {
  session_id: string;
  driver_code: string;
  driver_number: number;
  lap_number: number;
  lap_time_seconds?: number;
  telemetry_points: TelemetryPoint[];
  track_geometry?: {
    type: string;
    geometry: {
      type: string;
      coordinates: number[][];
    };
  };
}

interface ComparisonData {
  primary_driver: string;
  primary_lap: number;
  primary_telemetry: LapTelemetry;
  secondary_driver: string;
  secondary_lap: number;
  secondary_telemetry: LapTelemetry;
  aligned_distance: number[];
  speed_delta: number[];
}

export default function LapTelemetryPage({
  params,
}: {
  params: Promise<{ session: string; driver: string; lap: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  // Parse session string: e.g. "2024_bahrain_race" or "2026_british%20grand%20prix_race"
  const decodedSession = decodeURIComponent(resolvedParams.session);
  const sessionParts = decodedSession.split("_");
  const season = parseInt(sessionParts[0]) || 2024;
  const sessionType = (sessionParts.slice(-1)[0] || "Race").replace(/^\w/, (c) => c.toUpperCase());
  const rawCircuit = sessionParts.slice(1, -1).join(" ") || "Bahrain";
  const circuit = rawCircuit.replace(/\b\w/g, (c) => c.toUpperCase());

  const driverCode = resolvedParams.driver;
  const lapNumber = parseInt(resolvedParams.lap) || 1;

  // Fetch Session Overview to get dynamic team driver roster for this season/session
  const { data: sessionOverview } = useQuery({
    queryKey: ["sessionOverview", season, circuit, sessionType],
    queryFn: async () => {
      const res = await axiosInstance.get("/api/v1/race-engineer/overview", {
        params: { season, circuit, session_type: sessionType },
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const SEASON_DRIVER_ROSTER: Record<number, string[]> = {
    2023: ["VER", "PER"],
    2024: ["VER", "PER"],
    2025: ["VER", "LAW", "TSU"],
    2026: ["VER", "HAD"],
  };

  const seasonRoster = SEASON_DRIVER_ROSTER[season] || ["VER", "PER"];
  const availableDrivers =
    sessionOverview && Object.keys(sessionOverview.driver_lap_summaries).length > 0
      ? Object.keys(sessionOverview.driver_lap_summaries).filter((d) => seasonRoster.includes(d.toUpperCase()))
      : seasonRoster;
  const comparisonDrivers = availableDrivers.filter((d) => d.toUpperCase() !== driverCode.toUpperCase());

  // Playback & State
  const [activeTime, setActiveTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [comparisonMode, setComparisonMode] = useState<boolean>(false);
  const [secondaryDriver, setSecondaryDriver] = useState<string>(comparisonDrivers[0] || "PER");
  const [secondaryLap, setSecondaryLap] = useState<number>(lapNumber);

  // Sync secondary driver when season roster changes (e.g. Perez left after 2024)
  useEffect(() => {
    if (comparisonDrivers.length > 0 && !comparisonDrivers.includes(secondaryDriver)) {
      setSecondaryDriver(comparisonDrivers[0]);
    }
  }, [comparisonDrivers, secondaryDriver]);

  // Report Modal state
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportFindings, setReportFindings] = useState<string>("");
  const [reportSubmitting, setReportSubmitting] = useState<boolean>(false);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);

  // Fetch Tier 2 Primary Telemetry
  const { data: telemetry, isLoading, isError, error } = useQuery<LapTelemetry>({
    queryKey: ["lapTelemetry", season, circuit, sessionType, driverCode, lapNumber],
    queryFn: async () => {
      const res = await axiosInstance.get("/api/v1/race-engineer/lap-telemetry", {
        params: {
          season,
          circuit,
          session_type: sessionType,
          driver: driverCode,
          lap: lapNumber,
        },
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch Comparison Telemetry if enabled
  const { data: comparisonData } = useQuery<ComparisonData>({
    queryKey: ["comparisonTelemetry", season, circuit, sessionType, driverCode, lapNumber, secondaryDriver, secondaryLap],
    queryFn: async () => {
      const res = await axiosInstance.get("/api/v1/race-engineer/compare", {
        params: {
          season,
          circuit,
          session_type: sessionType,
          primary_driver: driverCode,
          primary_lap: lapNumber,
          secondary_driver: secondaryDriver,
          secondary_lap: secondaryLap,
        },
      });
      return res.data;
    },
    enabled: comparisonMode && Boolean(secondaryDriver),
    staleTime: 5 * 60 * 1000,
  });

  const points = telemetry?.telemetry_points || [];
  const maxDistance = points.length > 0 ? points[points.length - 1].distance : 5000;
  const maxTime = points.length > 0 ? points[points.length - 1].time_seconds || 90 : 90;

  // Playback timer (runs on lap time_seconds)
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const updatePlayback = (currentTime: number) => {
      if (!isPlaying) return;
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      setActiveTime((prev) => {
        const timeStep = 1 * playbackSpeed * deltaTime;
        const nextTime = prev + timeStep;
        if (nextTime >= maxTime) {
          setIsPlaying(false);
          return maxTime;
        }
        return nextTime;
      });

      animationFrameId = requestAnimationFrame(updatePlayback);
    };

    if (isPlaying) {
      lastTime = performance.now();
      animationFrameId = requestAnimationFrame(updatePlayback);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, playbackSpeed, maxTime]);

  // Find primary driver telemetry point closest to activeTime
  const currentPoint =
    points.length > 0
      ? points.reduce((prev, curr) =>
          Math.abs(curr.time_seconds - activeTime) < Math.abs(prev.time_seconds - activeTime) ? curr : prev
        )
      : null;

  const activeDistance = currentPoint ? currentPoint.distance : 0;

  // Secondary driver telemetry point matched by activeTime (shows actual physical distance gap on circuit map!)
  const secPoints = comparisonData?.secondary_telemetry?.telemetry_points || [];
  const secCurrentPoint =
    secPoints.length > 0
      ? secPoints.reduce((prev, curr) =>
          Math.abs(curr.time_seconds - activeTime) < Math.abs(prev.time_seconds - activeTime) ? curr : prev
        )
      : null;

  // Track geometry & telemetry coordinate normalization
  // Use actual lap telemetry points (X, Y) so track outline & moving dot share the exact same scale
  const rawCoords =
    points.length > 0
      ? points.filter((p) => p.x !== 0 || p.y !== 0).map((p) => [p.x, p.y])
      : telemetry?.track_geometry?.geometry?.coordinates || [];

  let trackSvgPath = "";
  let dotX = 160;
  let dotY = 90;
  let secDotX = 160;
  let secDotY = 90;

  if (rawCoords.length > 0) {
    const xs = rawCoords.map((c) => c[0]);
    const ys = rawCoords.map((c) => c[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    const canvasWidth = 280;
    const canvasHeight = 140;
    const scale = Math.min(canvasWidth / rangeX, canvasHeight / rangeY);
    const offsetX = (320 - rangeX * scale) / 2;
    const offsetY = (180 - rangeY * scale) / 2;

    const pathPoints = rawCoords.map((c) => {
      const nx = (c[0] - minX) * scale + offsetX;
      const ny = (maxY - c[1]) * scale + offsetY;
      return `${nx.toFixed(1)},${ny.toFixed(1)}`;
    });
    trackSvgPath = `M ${pathPoints.join(" L ")} Z`;

    if (currentPoint) {
      dotX = (currentPoint.x - minX) * scale + offsetX;
      dotY = (maxY - currentPoint.y) * scale + offsetY;
    }
    if (secCurrentPoint) {
      secDotX = (secCurrentPoint.x - minX) * scale + offsetX;
      secDotY = (maxY - secCurrentPoint.y) * scale + offsetY;
    }
  } else {
    trackSvgPath = "M 40 90 C 40 40, 280 40, 280 90 C 280 140, 40 140, 40 90 Z";
  }

  // Generate Report Handler
  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportFindings.trim()) return;

    setReportSubmitting(true);
    setReportSuccess(null);

    try {
      const res = await axiosInstance.post("/api/v1/race-engineer/reports", {
        session_id: resolvedParams.session,
        driver_code: driverCode,
        lap_numbers: [lapNumber],
        key_findings: reportFindings,
        stint_degradation_trend: "Optimal brake balance with steady tire wear across lap.",
        summary_stats: {
          max_speed: currentPoint?.speed || 315,
          rpm_peak: currentPoint?.rpm || 11800,
          drs_usage: currentPoint?.drs ? "Active" : "Standard",
        },
      });

      setReportSuccess(`Report #${res.data.report_id.slice(0, 8)} generated successfully! Audit log logged & driver notified.`);
      setReportFindings("");
      setTimeout(() => {
        setShowReportModal(false);
        setReportSuccess(null);
      }, 2500);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to generate report.");
    } finally {
      setReportSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <FastF1LoadingSkeleton
        title={`Loading Tier 2 Telemetry: Driver ${driverCode} Lap ${lapNumber}`}
        message="Streaming Speed, RPM, Throttle, Brake, Gear, DRS, and Track Geometry channels..."
      />
    );
  }

  if (isError || !telemetry) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400">
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-400" />
        <h3 className="text-lg font-bold">Telemetry Stream Failed</h3>
        <p className="text-sm mt-1 text-red-300/80">
          {error instanceof Error ? error.message : "Unable to load detailed lap telemetry from FastF1."}
        </p>
        <Link
          href="/race-engineer/telemetry"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200"
        >
          <ArrowLeft size={14} /> Back to Telemetry Overview
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header Bar ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-md">
        <div>
          <Link
            href="/race-engineer/telemetry"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 mb-2 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Overview
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Driver {driverCode} — Lap #{lapNumber} Telemetry
            </h1>
            <span className="rounded-full bg-cyan-500/15 px-3 py-0.5 text-xs font-semibold text-cyan-300 ring-1 ring-cyan-500/30">
              {circuit} {sessionType} ({season})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Comparison Mode Toggle */}
          <button
            onClick={() => setComparisonMode(!comparisonMode)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
              comparisonMode
                ? "bg-amber-500 text-slate-950 ring-2 ring-amber-400 shadow-lg shadow-amber-500/20"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Sliders size={14} />
            {comparisonMode ? "Comparison Mode Active" : "Toggle Driver Comparison"}
          </button>

          {/* Generate Report Button */}
          <button
            onClick={() => setShowReportModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
          >
            <FileText size={14} /> Generate Engineering Report
          </button>
        </div>
      </div>

      {/* Comparison Selector Sub-Bar if Active */}
      {comparisonMode && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
          <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-400" /> Comparison Driver Trace:
          </span>
          <div className="flex items-center gap-2">
            <label className="font-semibold text-slate-300">Driver:</label>
            <select
              value={secondaryDriver}
              onChange={(e) => setSecondaryDriver(e.target.value)}
              className="rounded bg-slate-900 px-3 py-1 text-slate-100 border border-slate-700 font-bold"
            >
              {comparisonDrivers.length > 0 ? (
                comparisonDrivers.map((dCode) => (
                  <option key={dCode} value={dCode}>
                    Driver {dCode}
                  </option>
                ))
              ) : (
                <option value="">No other drivers in session</option>
              )}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="font-semibold text-slate-300">Lap:</label>
            <input
              type="number"
              min={1}
              max={70}
              value={secondaryLap}
              onChange={(e) => setSecondaryLap(Number(e.target.value))}
              className="w-16 rounded bg-slate-900 px-2 py-1 text-slate-100 border border-slate-700 text-center font-mono font-bold"
            />
          </div>

          {/* Color Legend Key Badges */}
          <div className="flex items-center gap-3 ml-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 px-3 py-1 text-xs font-bold text-cyan-300">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span> Primary: Driver {driverCode}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-950/80 border border-amber-500/40 px-3 py-1 text-xs font-bold text-amber-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span> Comparison: Driver {secondaryDriver}
            </span>
          </div>
        </div>
      )}

      {/* ── Top Workspace: Track Map + Live Readout Panel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Track Map (Static GeoJSON Path + Moving Position Dot) */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-sm relative">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Activity size={16} className="text-cyan-400" /> Circuit Track Map & Live Position
            </h2>
            <span className="text-[11px] font-mono text-cyan-400">
              Pos: Distance {Math.round(activeDistance)}m / {Math.round(maxDistance)}m
            </span>
          </div>

          <div className="relative h-64 w-full flex items-center justify-center rounded-lg bg-slate-950 border border-slate-800/80 overflow-hidden">
            {/* Render Track SVG */}
            <svg viewBox="0 0 320 180" className="w-full h-full p-2">
              {/* Circuit Track Outline Background */}
              <path
                d={trackSvgPath}
                fill="none"
                stroke="#1E293B"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Circuit Track Outline Glowing Layer */}
              <path
                d={trackSvgPath}
                fill="none"
                stroke="#06B6D4"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Moving Position Dot for Driver 1 */}
              <circle
                cx={dotX}
                cy={dotY}
                r="6"
                className="fill-cyan-300 stroke-slate-950 stroke-2 shadow-lg shadow-cyan-400"
              />

              {/* Moving Position Dot for Driver 2 (Comparison Mode) */}
              {comparisonMode && comparisonData && secCurrentPoint && (
                <circle
                  cx={secDotX}
                  cy={secDotY}
                  r="6"
                  className="fill-amber-400 stroke-slate-950 stroke-2 shadow-lg shadow-amber-400"
                />
              )}
            </svg>
          </div>
        </div>

        {/* Live Numeric Telemetry Readout Panel */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Cpu size={16} className="text-cyan-400" /> Live Telemetry Readout
            </h2>
            {comparisonMode && (
              <span className="text-[11px] font-mono text-amber-400 font-bold">
                Comparison Sync Active
              </span>
            )}
          </div>

          {!comparisonMode ? (
            /* Single Driver Readout Grid */
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-950/80 p-3 border border-slate-800/80">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Speed</p>
                <p className="text-2xl font-bold font-mono text-cyan-400">
                  {currentPoint?.speed || 0} <span className="text-xs text-slate-400 font-normal">km/h</span>
                </p>
              </div>

              <div className="rounded-lg bg-slate-950/80 p-3 border border-slate-800/80">
                <p className="text-[10px] text-slate-400 uppercase font-medium">RPM</p>
                <p className="text-2xl font-bold font-mono text-emerald-400">
                  {currentPoint?.rpm || 0}
                </p>
              </div>

              <div className="rounded-lg bg-slate-950/80 p-3 border border-slate-800/80">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Throttle</p>
                <p className="text-xl font-bold font-mono text-amber-400">
                  {currentPoint?.throttle || 0}%
                </p>
              </div>

              <div className="rounded-lg bg-slate-950/80 p-3 border border-slate-800/80">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Brake</p>
                <p className="text-xl font-bold font-mono text-red-400">
                  {currentPoint?.brake ? "100%" : "0%"}
                </p>
              </div>

              <div className="rounded-lg bg-slate-950/80 p-3 border border-slate-800/80">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Gear</p>
                <p className="text-xl font-bold font-mono text-slate-100">
                  nGear: <span className="text-cyan-300">{currentPoint?.gear || 0}</span>
                </p>
              </div>

              <div className="rounded-lg bg-slate-950/80 p-3 border border-slate-800/80">
                <p className="text-[10px] text-slate-400 uppercase font-medium">DRS Status</p>
                <p className="text-xs font-bold font-mono mt-1">
                  {currentPoint?.drs ? (
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-300 ring-1 ring-emerald-500/30">
                      DRS OPEN
                    </span>
                  ) : (
                    <span className="text-slate-500">CLOSED</span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            /* Dual Comparative Readout Side-by-Side Grid */
            <div className="space-y-3">
              {/* Primary Driver Card */}
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-cyan-300">
                  <span>● Primary: Driver {driverCode}</span>
                  <span className="font-mono text-slate-400">Lap #{lapNumber}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="bg-slate-950/60 p-1.5 rounded border border-cyan-900/40">
                    <span className="text-[9px] text-slate-400 block uppercase">Speed</span>
                    <span className="text-cyan-400 font-bold">{currentPoint?.speed || 0}</span>
                    <span className="text-[9px] text-slate-500"> km/h</span>
                  </div>
                  <div className="bg-slate-950/60 p-1.5 rounded border border-cyan-900/40">
                    <span className="text-[9px] text-slate-400 block uppercase">Throttle</span>
                    <span className="text-amber-400 font-bold">{currentPoint?.throttle || 0}%</span>
                  </div>
                  <div className="bg-slate-950/60 p-1.5 rounded border border-cyan-900/40">
                    <span className="text-[9px] text-slate-400 block uppercase">Brake</span>
                    <span className="text-red-400 font-bold">{currentPoint?.brake ? "100%" : "0%"}</span>
                  </div>
                </div>
              </div>

              {/* Secondary Comparison Driver Card */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-amber-300">
                  <span>● Comparison: Driver {secondaryDriver}</span>
                  <span className="font-mono text-slate-400">Lap #{secondaryLap}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="bg-slate-950/60 p-1.5 rounded border border-amber-900/40">
                    <span className="text-[9px] text-slate-400 block uppercase">Speed</span>
                    <span className="text-amber-400 font-bold">{secCurrentPoint?.speed || 0}</span>
                    <span className="text-[9px] text-slate-500"> km/h</span>
                  </div>
                  <div className="bg-slate-950/60 p-1.5 rounded border border-amber-900/40">
                    <span className="text-[9px] text-slate-400 block uppercase">Throttle</span>
                    <span className="text-amber-300 font-bold">{secCurrentPoint?.throttle || 0}%</span>
                  </div>
                  <div className="bg-slate-950/60 p-1.5 rounded border border-amber-900/40">
                    <span className="text-[9px] text-slate-400 block uppercase">Brake</span>
                    <span className="text-rose-400 font-bold">{secCurrentPoint?.brake ? "100%" : "0%"}</span>
                  </div>
                </div>
              </div>

              {/* Delta Summary Pill */}
              <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800 flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">Live Speed Delta:</span>
                <span
                  className={`font-bold ${
                    (currentPoint?.speed || 0) >= (secCurrentPoint?.speed || 0) ? "text-cyan-400" : "text-amber-400"
                  }`}
                >
                  {((currentPoint?.speed || 0) - (secCurrentPoint?.speed || 0)).toFixed(1)} km/h
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Playback Controls Bar ── */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Play/Pause & Step Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTime(0)}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
            title="Reset to Start"
          >
            <RotateCcw size={16} />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors shadow-md shadow-cyan-500/20"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            {isPlaying ? "Pause Playback" : "Play Telemetry"}
          </button>

          <button
            onClick={() => setActiveTime(maxTime)}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
            title="Jump to End"
          >
            <FastForward size={16} />
          </button>
        </div>

        {/* Distance Scrub Bar Slider */}
        <div className="flex-1 w-full max-w-md flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">0m</span>
          <input
            type="range"
            min={0}
            max={maxDistance}
            value={activeDistance}
            onChange={(e) => {
              setIsPlaying(false);
              const targetDist = Number(e.target.value);
              const matchedPt = points.reduce((prev, curr) =>
                Math.abs(curr.distance - targetDist) < Math.abs(prev.distance - targetDist) ? curr : prev
              );
              if (matchedPt) {
                setActiveTime(matchedPt.time_seconds);
              }
            }}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <span className="text-xs font-mono text-slate-400">{Math.round(maxDistance)}m</span>
        </div>

        {/* Speed Selector Pills */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
          {[0.5, 1, 2, 5].map((spd) => (
            <button
              key={spd}
              onClick={() => setPlaybackSpeed(spd)}
              className={`px-2.5 py-1 text-xs font-semibold font-mono rounded transition-colors ${
                playbackSpeed === spd ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* ── Synced Telemetry Chart Stack ── */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Gauge size={18} className="text-cyan-400" /> Synced Multi-Channel Telemetry Stack
        </h2>

        {/* Speed Channel Chart */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 relative">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-cyan-300">Speed (km/h)</span>
            <span className="text-xs font-mono text-slate-400">{currentPoint?.speed || 0} km/h</span>
          </div>

          <div
            className="relative h-28 w-full bg-slate-950 rounded border border-slate-800/80 cursor-crosshair overflow-hidden"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const pct = clickX / rect.width;
              const targetDist = pct * maxDistance;
              const matchedPt = points.reduce((prev, curr) =>
                Math.abs(curr.distance - targetDist) < Math.abs(prev.distance - targetDist) ? curr : prev
              );
              if (matchedPt) {
                setActiveTime(matchedPt.time_seconds);
              }
            }}
          >
            {/* SVG Speed Line */}
            <svg viewBox={`0 0 ${maxDistance} 350`} preserveAspectRatio="none" className="w-full h-full">
              <polyline
                fill="none"
                stroke="#06B6D4"
                strokeWidth="2.5"
                points={points.map((p) => `${p.distance},${350 - p.speed}`).join(" ")}
              />
              {/* Secondary Comparison Line */}
              {comparisonMode && comparisonData && comparisonData.secondary_telemetry?.telemetry_points && (
                <polyline
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                  points={comparisonData.secondary_telemetry.telemetry_points.map((p) => `${p.distance},${350 - p.speed}`).join(" ")}
                />
              )}
            </svg>

            {/* Distance Crosshair Line */}
            <div
              style={{ left: `${(activeDistance / maxDistance) * 100}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-md shadow-cyan-400/50 pointer-events-none"
            />
          </div>
        </div>

        {/* Speed Delta (km/h) Channel Chart when comparison mode active */}
        {comparisonMode && comparisonData && comparisonData.speed_delta && comparisonData.speed_delta.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-slate-900/60 p-4 relative">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-amber-300">
                Speed Delta Trace (km/h) — {driverCode} (Primary) vs {secondaryDriver} (Secondary)
              </span>
              <span className="text-xs font-mono text-amber-400">
                Above 0 Line = {driverCode} Faster | Below 0 Line = {secondaryDriver} Faster
              </span>
            </div>

            <div className="relative h-20 w-full bg-slate-950 rounded border border-slate-800/80 cursor-crosshair overflow-hidden">
              <svg viewBox={`0 0 ${maxDistance} 100`} preserveAspectRatio="none" className="w-full h-full">
                {/* Zero Reference Line */}
                <line x1="0" y1="50" x2={maxDistance} y2="50" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
                {/* Speed Delta Trace Polyline */}
                <polyline
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2"
                  points={comparisonData.aligned_distance.map((dist, idx) => {
                    const delta = comparisonData.speed_delta[idx] || 0;
                    const clampedY = Math.max(5, Math.min(95, 50 - delta * 1.5));
                    return `${dist},${clampedY}`;
                  }).join(" ")}
                />
              </svg>

              <div
                style={{ left: `${(activeDistance / maxDistance) * 100}%` }}
                className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-md shadow-cyan-400/50 pointer-events-none"
              />
            </div>
          </div>
        )}

        {/* Throttle & Brake Channel Chart */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 relative">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-amber-300">Throttle (%) & Brake (%)</span>
            <span className="text-xs font-mono text-slate-400">
              {comparisonMode ? (
                <>
                  <span className="text-cyan-400 font-bold">{driverCode}:</span> T:<span className="text-amber-400">{currentPoint?.throttle || 0}%</span> B:<span className="text-red-400">{currentPoint?.brake ? 100 : 0}%</span>
                  <span className="text-slate-500 mx-1.5">|</span>
                  <span className="text-amber-400 font-bold">{secondaryDriver}:</span> T:<span className="text-amber-300">{secCurrentPoint?.throttle || 0}%</span> B:<span className="text-rose-400">{secCurrentPoint?.brake ? 100 : 0}%</span>
                </>
              ) : (
                <>
                  T: <span className="text-amber-400">{currentPoint?.throttle || 0}%</span> | B: <span className="text-red-400">{currentPoint?.brake ? 100 : 0}%</span>
                </>
              )}
            </span>
          </div>

          <div
            className="relative h-24 w-full bg-slate-950 rounded border border-slate-800/80 cursor-crosshair overflow-hidden"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const pct = clickX / rect.width;
              const targetDist = pct * maxDistance;
              const matchedPt = points.reduce((prev, curr) =>
                Math.abs(curr.distance - targetDist) < Math.abs(prev.distance - targetDist) ? curr : prev
              );
              if (matchedPt) {
                setActiveTime(matchedPt.time_seconds);
              }
            }}
          >
            <svg viewBox={`0 0 ${maxDistance} 100`} preserveAspectRatio="none" className="w-full h-full">
              {/* Primary Throttle Line (Amber Solid) */}
              <polyline
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2"
                points={points.map((p) => `${p.distance},${100 - p.throttle}`).join(" ")}
              />
              {/* Primary Brake Line (Red Solid) */}
              <polyline
                fill="none"
                stroke="#EF4444"
                strokeWidth="2"
                points={points.map((p) => `${p.distance},${100 - p.brake * 100}`).join(" ")}
              />

              {/* Secondary Comparison Throttle Line (Amber Dashed) */}
              {comparisonMode && comparisonData && comparisonData.secondary_telemetry?.telemetry_points && (
                <polyline
                  fill="none"
                  stroke="#FBBF24"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                  points={comparisonData.secondary_telemetry.telemetry_points.map((p) => `${p.distance},${100 - p.throttle}`).join(" ")}
                />
              )}
              {/* Secondary Comparison Brake Line (Rose Dashed) */}
              {comparisonMode && comparisonData && comparisonData.secondary_telemetry?.telemetry_points && (
                <polyline
                  fill="none"
                  stroke="#FB7185"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                  points={comparisonData.secondary_telemetry.telemetry_points.map((p) => `${p.distance},${100 - p.brake * 100}`).join(" ")}
                />
              )}
            </svg>

            <div
              style={{ left: `${(activeDistance / maxDistance) * 100}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-md shadow-cyan-400/50 pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* ── Generate Report Modal ── */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <FileText size={18} className="text-cyan-400" /> Generate Engineering Performance Report
              </h3>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>

            {reportSuccess ? (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 text-emerald-300 text-sm flex items-center gap-2">
                <CheckCircle2 size={18} /> {reportSuccess}
              </div>
            ) : (
              <form onSubmit={handleGenerateReport} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Key Performance Findings & Engineering Notes:
                  </label>
                  <textarea
                    rows={4}
                    value={reportFindings}
                    onChange={(e) => setReportFindings(e.target.value)}
                    placeholder="Enter detailed lap observations, braking stability, corner exit speeds, or tire degradation analysis..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="rounded-lg bg-slate-950 p-3 border border-slate-800 text-xs text-slate-400 space-y-1">
                  <p>• Automatically records AuditLog action "report_generated"</p>
                  <p>• Triggers a Notification for driver user ({driverCode})</p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reportSubmitting}
                    className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
                  >
                    {reportSubmitting ? "Generating..." : "Submit Engineering Report"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
