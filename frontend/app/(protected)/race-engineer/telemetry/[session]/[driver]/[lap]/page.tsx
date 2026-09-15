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

interface CornerMarker {
  number: number;
  letter: string;
  x: number;
  y: number;
}

export interface MappedCornerItem {
  number: number;
  letter: string;
  cx: number;
  cy: number;
  nx: number;
  ny: number;
}

export interface PlacedCornerLabel {
  label: string;
  cx: number;
  cy: number;
  textX: number;
  textY: number;
  isClustered: boolean;
}

/**
 * Pure, generic, cluster-aware radial layout algorithm for circuit corner labels.
 * Detects text bounding-box collisions across any Formula 1 circuit layout dynamically.
 * Groups overlapping labels into clusters, fans them out radially with tick lines,
 * and leaves isolated corners at their standard 11px off-track offset.
 */
export function computeClusterAwareCornerLayout(
  corners: MappedCornerItem[],
  centroidX: number,
  centroidY: number,
  fontSize: number = 7
): PlacedCornerLabel[] {
  if (!corners || corners.length === 0) return [];

  const getBoundingBox = (label: string, x: number, y: number) => {
    const width = label.length * 4.5 + 3;
    const height = fontSize + 2;
    const pad = 1.5;
    return {
      minX: x - width / 2 - pad,
      maxX: x + width / 2 + pad,
      minY: y - height / 2 - pad,
      maxY: y + height / 2 + pad,
    };
  };

  const boxesOverlap = (b1: ReturnType<typeof getBoundingBox>, b2: ReturnType<typeof getBoundingBox>) => {
    return !(b1.maxX < b2.minX || b1.minX > b2.maxX || b1.maxY < b2.minY || b1.minY > b2.maxY);
  };

  // 1. Initial normal offset positions (11px base)
  const baseOffset = 11;
  const initialNodes = corners.map((c) => {
    const label = `${c.number}${c.letter}`;
    const textX = c.cx + c.nx * baseOffset;
    const textY = c.cy + c.ny * baseOffset;
    return {
      corner: c,
      label,
      cx: c.cx,
      cy: c.cy,
      nx: c.nx,
      ny: c.ny,
      textX,
      textY,
    };
  });

  // 2. Collision detection graph & connected component clustering
  const n = initialNodes.length;
  const adj: number[][] = Array.from({ length: n }, () => []);

  for (let i = 0; i < n; i++) {
    const b1 = getBoundingBox(initialNodes[i].label, initialNodes[i].textX, initialNodes[i].textY);
    for (let j = i + 1; j < n; j++) {
      const b2 = getBoundingBox(initialNodes[j].label, initialNodes[j].textX, initialNodes[j].textY);
      if (boxesOverlap(b1, b2)) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }

  const visited = new Array(n).fill(false);
  const clusters: number[][] = [];

  for (let i = 0; i < n; i++) {
    if (!visited[i]) {
      const cluster: number[] = [];
      const queue = [i];
      visited[i] = true;
      while (queue.length > 0) {
        const curr = queue.shift()!;
        cluster.push(curr);
        for (const neighbor of adj[curr]) {
          if (!visited[neighbor]) {
            visited[neighbor] = true;
            queue.push(neighbor);
          }
        }
      }
      clusters.push(cluster);
    }
  }

  // 3. Process each cluster
  const result: PlacedCornerLabel[] = new Array(n);

  for (const clusterIndices of clusters) {
    if (clusterIndices.length === 1) {
      // Isolated corner: keep original normal offset, no tick mark needed
      const idx = clusterIndices[0];
      const node = initialNodes[idx];
      result[idx] = {
        label: node.label,
        cx: node.cx,
        cy: node.cy,
        textX: node.textX,
        textY: node.textY,
        isClustered: false,
      };
    } else {
      // Clustered corners: Radial fan-out around cluster centroid
      clusterIndices.sort((a, b) => initialNodes[a].corner.number - initialNodes[b].corner.number);

      const clusterNodes = clusterIndices.map((idx) => initialNodes[idx]);

      const clusterCentroidX = clusterNodes.reduce((acc, node) => acc + node.cx, 0) / clusterNodes.length;
      const clusterCentroidY = clusterNodes.reduce((acc, node) => acc + node.cy, 0) / clusterNodes.length;

      let dirX = clusterCentroidX - centroidX;
      let dirY = clusterCentroidY - centroidY;
      const dirLen = Math.hypot(dirX, dirY) || 1;
      dirX /= dirLen;
      dirY /= dirLen;

      const baseAngle = Math.atan2(dirY, dirX);
      const k = clusterNodes.length;

      const totalArc = Math.min(Math.PI * 0.7, (k - 1) * 0.35);
      const angleStep = k > 1 ? totalArc / (k - 1) : 0;
      const startAngle = baseAngle - totalArc / 2;

      let radius = 22;
      let placedPositions: { textX: number; textY: number }[] = [];
      const maxPasses = 15;

      for (let pass = 0; pass < maxPasses; pass++) {
        placedPositions = clusterNodes.map((_, i) => {
          const angle = startAngle + i * angleStep;
          return {
            textX: clusterCentroidX + Math.cos(angle) * radius,
            textY: clusterCentroidY + Math.sin(angle) * radius,
          };
        });

        let hasOverlap = false;
        for (let i = 0; i < k; i++) {
          const b1 = getBoundingBox(clusterNodes[i].label, placedPositions[i].textX, placedPositions[i].textY);
          for (let j = i + 1; j < k; j++) {
            const b2 = getBoundingBox(clusterNodes[j].label, placedPositions[j].textX, placedPositions[j].textY);
            if (boxesOverlap(b1, b2)) {
              hasOverlap = true;
              break;
            }
          }
          if (hasOverlap) break;
        }

        if (!hasOverlap) break;
        radius += 4;
      }

      for (let i = 0; i < k; i++) {
        const globalIdx = clusterIndices[i];
        const node = clusterNodes[i];
        result[globalIdx] = {
          label: node.label,
          cx: node.cx,
          cy: node.cy,
          textX: placedPositions[i].textX,
          textY: placedPositions[i].textY,
          isClustered: true,
        };
      }
    }
  }

  return result;
}

interface LapTelemetry {
  session_id: string;
  driver_code: string;
  driver_number: number;
  lap_number: number;
  lap_time_seconds?: number;
  sector_1_seconds?: number;
  sector_2_seconds?: number;
  sector_3_seconds?: number;
  telemetry_points: TelemetryPoint[];
  corners: CornerMarker[];
  driver_color?: string;
}

interface ComparisonData {
  primary_driver: string;
  primary_lap: number;
  primary_telemetry: LapTelemetry;
  primary_color?: string;
  secondary_driver: string;
  secondary_lap: number;
  secondary_telemetry: LapTelemetry;
  secondary_color?: string;
  aligned_distance: number[];
  speed_delta: number[];
  time_delta_seconds: number[];
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

  const availableDrivers =
    sessionOverview && Object.keys(sessionOverview.driver_lap_summaries).length > 0
      ? Object.keys(sessionOverview.driver_lap_summaries)
      : [driverCode];
  const comparisonDrivers = availableDrivers.filter((d) => d.toUpperCase() !== driverCode.toUpperCase());

  // Playback & State
  const [activeTime, setActiveTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [comparisonMode, setComparisonMode] = useState<boolean>(false);
  const [secondaryDriver, setSecondaryDriver] = useState<string>(comparisonDrivers[0] || "PER");
  const [secondaryLap, setSecondaryLap] = useState<number>(lapNumber);

  // Sync secondary driver when season roster changes
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

  const primaryColor = telemetry?.driver_color || "#06B6D4";
  const secondaryColor = comparisonData?.secondary_color || "#F59E0B";

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

  // Secondary driver telemetry point matched by activeTime
  const secPoints = comparisonData?.secondary_telemetry?.telemetry_points || [];
  const secCurrentPoint =
    secPoints.length > 0
      ? secPoints.reduce((prev, curr) =>
          Math.abs(curr.time_seconds - activeTime) < Math.abs(prev.time_seconds - activeTime) ? curr : prev
        )
      : null;

  // Sector Boundaries (in seconds)
  const s1Time = telemetry?.sector_1_seconds || maxTime / 3;
  const s2Time = s1Time + (telemetry?.sector_2_seconds || maxTime / 3);

  // ── Bug 1 Fix: Sort & Deduplicate Telemetry Position Data by Distance (Ascending & Monotonic) ──
  const rawPosPoints = points.filter((p) => p.x !== 0 || p.y !== 0);
  rawPosPoints.sort((a, b) => a.distance - b.distance);

  const validPosPoints: TelemetryPoint[] = [];
  let lastDist = -1;
  for (const pt of rawPosPoints) {
    if (pt.distance > lastDist) {
      validPosPoints.push(pt);
      lastDist = pt.distance;
    }
  }

  let s1SvgPath = "";
  let s2SvgPath = "";
  let s3SvgPath = "";
  let fullTrackPath = "";
  let dotX = 250;
  let dotY = 150;
  let secDotX = 250;
  let secDotY = 150;
  let scaledCorners: PlacedCornerLabel[] = [];

  if (validPosPoints.length > 0) {
    const xs = validPosPoints.map((c) => c.x);
    const ys = validPosPoints.map((c) => c.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    // ── Aspect-Ratio Preserving Strict Uniform Scale ──
    const viewBoxW = 500;
    const viewBoxH = 300;
    const padding = 45;
    const scale = Math.min((viewBoxW - 2 * padding) / rangeX, (viewBoxH - 2 * padding) / rangeY);
    const offsetX = (viewBoxW - rangeX * scale) / 2;
    const offsetY = (viewBoxH - rangeY * scale) / 2;

    const mappedPoints = validPosPoints.map((p) => ({
      nx: (p.x - minX) * scale + offsetX,
      ny: (maxY - p.y) * scale + offsetY,
      time: p.time_seconds,
    }));

    const centroidX = mappedPoints.reduce((acc, p) => acc + p.nx, 0) / mappedPoints.length;
    const centroidY = mappedPoints.reduce((acc, p) => acc + p.ny, 0) / mappedPoints.length;

    // Polyline track paths
    fullTrackPath = `M ${mappedPoints.map((p) => `${p.nx.toFixed(1)},${p.ny.toFixed(1)}`).join(" L ")} Z`;

    const s1Pts = mappedPoints.filter((p) => p.time <= s1Time);
    const s2Pts = mappedPoints.filter((p) => p.time >= s1Time && p.time <= s2Time);
    const s3Pts = mappedPoints.filter((p) => p.time >= s2Time);

    if (s1Pts.length > 0) {
      s1SvgPath = `M ${s1Pts.map((p) => `${p.nx.toFixed(1)},${p.ny.toFixed(1)}`).join(" L ")}`;
    }
    if (s2Pts.length > 0) {
      s2SvgPath = `M ${s2Pts.map((p) => `${p.nx.toFixed(1)},${p.ny.toFixed(1)}`).join(" L ")}`;
    }
    if (s3Pts.length > 0) {
      s3SvgPath = `M ${s3Pts.map((p) => `${p.nx.toFixed(1)},${p.ny.toFixed(1)}`).join(" L ")}`;
    }

    if (currentPoint) {
      dotX = (currentPoint.x - minX) * scale + offsetX;
      dotY = (maxY - currentPoint.y) * scale + offsetY;
    }
    if (secCurrentPoint) {
      secDotX = (secCurrentPoint.x - minX) * scale + offsetX;
      secDotY = (maxY - secCurrentPoint.y) * scale + offsetY;
    }

    // ── Generic Cluster-Aware Radial Layout for Corner Markers ──
    if (telemetry?.corners && telemetry.corners.length > 0) {
      const cornerItems: MappedCornerItem[] = telemetry.corners.map((c) => {
        const cx = (c.x - minX) * scale + offsetX;
        const cy = (maxY - c.y) * scale + offsetY;

        // Nearest mapped point index on track path
        let closestIdx = 0;
        let minDistSq = Infinity;
        for (let i = 0; i < mappedPoints.length; i++) {
          const dx = mappedPoints[i].nx - cx;
          const dy = mappedPoints[i].ny - cy;
          const d2 = dx * dx + dy * dy;
          if (d2 < minDistSq) {
            minDistSq = d2;
            closestIdx = i;
          }
        }

        // Local tangent using neighboring points
        const step = Math.min(4, Math.floor(mappedPoints.length / 25));
        const prevP = mappedPoints[Math.max(0, closestIdx - step)];
        const nextP = mappedPoints[Math.min(mappedPoints.length - 1, closestIdx + step)];

        let tx = nextP.nx - prevP.nx;
        let ty = nextP.ny - prevP.ny;
        const tLen = Math.hypot(tx, ty) || 1;
        tx /= tLen;
        ty /= tLen;

        // Normal vector perpendicular to local tangent: N = (-ty, tx)
        let nx = -ty;
        let ny = tx;

        // Orient outward away from circuit centroid
        const toCentroidX = cx - centroidX;
        const toCentroidY = cy - centroidY;
        if (nx * toCentroidX + ny * toCentroidY < 0) {
          nx = -nx;
          ny = -ny;
        }

        return {
          number: c.number,
          letter: c.letter,
          cx,
          cy,
          nx,
          ny,
        };
      });

      scaledCorners = computeClusterAwareCornerLayout(cornerItems, centroidX, centroidY, 7);
    }
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
        message="Streaming full-resolution position trace and sector telemetry..."
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-cyan-400">
        <div>
          <Link
            href="/race-engineer/telemetry"
            className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-cyan-400 hover:text-cyan-300 mb-2 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Overview
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">
              Driver {driverCode} — Lap #{lapNumber} Telemetry
            </h1>
            <span className="sharp-tag bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              [{circuit} {sessionType} ({season})]
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setComparisonMode(!comparisonMode)}
            className={`inline-flex items-center gap-2 rounded-none border px-4 py-2 text-xs font-mono font-semibold transition-all ${
              comparisonMode
                ? "border-amber-400 bg-amber-500 text-slate-950 font-bold"
                : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Sliders size={14} />
            {comparisonMode ? "Comparison Mode Active" : "Toggle Driver Comparison"}
          </button>

          <button
            onClick={() => setShowReportModal(true)}
            className="inline-flex items-center gap-2 rounded-none bg-cyan-400 px-4 py-2 text-xs font-mono font-bold text-slate-950 hover:bg-cyan-300 transition-colors"
          >
            <FileText size={14} /> Generate Engineering Report
          </button>
        </div>
      </div>

      {/* Comparison Selector Sub-Bar if Active */}
      {comparisonMode && (
        <div className="flex flex-wrap items-center gap-4 border border-amber-500/30 bg-amber-950/20 p-4 border-l-2 border-l-amber-500 text-xs font-mono text-amber-200">
          <span className="font-semibold flex items-center gap-1.5 text-slate-200">
            <Sparkles size={14} className="text-amber-400" /> Comparison driver trace:
          </span>
          <div className="flex items-center gap-2">
            <label className="text-slate-300">Driver:</label>
            <select
              value={secondaryDriver}
              onChange={(e) => setSecondaryDriver(e.target.value)}
              className="rounded-none bg-slate-950 px-3 py-1 text-slate-100 border border-slate-700 font-mono font-bold"
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
            <label className="text-slate-300">Lap:</label>
            <input
              type="number"
              min={1}
              max={70}
              value={secondaryLap}
              onChange={(e) => setSecondaryLap(Number(e.target.value))}
              className="w-16 rounded-none bg-slate-950 px-2 py-1 text-slate-100 border border-slate-700 text-center font-mono font-bold"
            />
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <span
              style={{ borderColor: primaryColor }}
              className="inline-flex items-center gap-1.5 rounded-none bg-slate-950 border px-3 py-1 text-xs font-mono font-bold text-slate-100"
            >
              <span style={{ backgroundColor: primaryColor }} className="w-2 h-2"></span> Primary: Driver {driverCode}
            </span>
            <span
              style={{ borderColor: secondaryColor }}
              className="inline-flex items-center gap-1.5 rounded-none bg-slate-950 border px-3 py-1 text-xs font-mono font-bold text-slate-100"
            >
              <span style={{ backgroundColor: secondaryColor }} className="w-2 h-2"></span> Comparison: Driver {secondaryDriver}
            </span>
          </div>
        </div>
      )}

      {/* ── Main Dominant Centerpiece: Enlarged Track Map + HUD Live Readout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Enlarged Track Map (Dominant Visual Centerpiece: h-[500px]) */}
        <div className="lg:col-span-3 border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-slate-700 relative">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold tracking-tight text-slate-100 flex items-center gap-2">
              <Activity size={16} className="text-cyan-400" /> Circuit map and live position trace
            </h2>
            <div className="flex items-center gap-3">
              {/* Sector Color Key */}
              <div className="flex items-center gap-2 text-xs font-mono bg-slate-950 px-3 py-1 border border-slate-800">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500"></span> S1
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-amber-400"></span> S2
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-cyan-400"></span> S3
                </span>
              </div>
              <span className="text-xs font-mono text-cyan-400 tabular-nums">
                {Math.round(activeDistance)}m / {Math.round(maxDistance)}m
              </span>
            </div>
          </div>

          <div className="relative h-[500px] w-full flex items-center justify-center bg-slate-950 border border-slate-800 overflow-hidden">
            {/* SVG Track Map Canvas */}
            <svg viewBox="0 0 500 300" className="w-full h-full p-4">
              {/* Background Full Track Base Path */}
              {fullTrackPath && (
                <path
                  d={fullTrackPath}
                  fill="none"
                  stroke="#1E293B"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Sector 1 Segment (Vibrant Red) */}
              {s1SvgPath && (
                <path
                  d={s1SvgPath}
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Sector 2 Segment (Bright Amber) */}
              {s2SvgPath && (
                <path
                  d={s2SvgPath}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Sector 3 Segment (Electric Cyan) */}
              {s3SvgPath && (
                <path
                  d={s3SvgPath}
                  fill="none"
                  stroke="#06B6D4"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Tick Lines for Clustered Corner Markers */}
              {scaledCorners
                .filter((c) => c.isClustered)
                .map((c, idx) => (
                  <line
                    key={`tick_line_${idx}`}
                    x1={c.cx}
                    y1={c.cy}
                    x2={c.textX}
                    y2={c.textY}
                    stroke="#94A3B8"
                    strokeWidth="0.8"
                    strokeOpacity="0.5"
                    strokeDasharray="2 2"
                  />
                ))}

              {/* Plain-Text Corner Turn Markers */}
              {scaledCorners.map((c, idx) => (
                <text
                  key={`corner_text_${idx}`}
                  x={c.textX}
                  y={c.textY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="7"
                  fontWeight="600"
                  fill="#F8FAFC"
                  stroke="#020617"
                  strokeWidth="2"
                  paintOrder="stroke"
                  className="font-sans select-none"
                >
                  {c.label}
                </text>
              ))}

              {/* Moving Position Dot for Driver 1 */}
              <circle
                cx={dotX}
                cy={dotY}
                r="7"
                style={{ fill: primaryColor }}
                className="stroke-slate-950 stroke-2"
              />

              {/* Moving Position Dot for Driver 2 (Comparison Mode) */}
              {comparisonMode && comparisonData && secCurrentPoint && (
                <circle
                  cx={secDotX}
                  cy={secDotY}
                  r="7"
                  style={{ fill: secondaryColor }}
                  className="stroke-slate-950 stroke-2"
                />
              )}
            </svg>
          </div>
        </div>

        {/* Live Numeric Telemetry Readout HUD Panel (Side Column) */}
        <div className="lg:col-span-1 flex flex-col justify-between gap-4">
          <div className="border border-slate-800 bg-slate-surface p-4 space-y-4 flex-1 border-l-2 border-l-slate-700">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold tracking-tight text-slate-100 flex items-center gap-2">
                <Cpu size={16} className="text-cyan-400" /> Telemetry HUD
              </h2>
              {comparisonMode && (
                <span className="text-[10px] font-mono text-amber-400 font-semibold">
                  Dual Sync
                </span>
              )}
            </div>

            {!comparisonMode ? (
              /* Single Driver HUD Readout Cards */
              <div className="space-y-3">
                <div className="rounded-none bg-slate-950 p-3.5 border border-slate-800 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-slate-400 font-mono font-medium">Speed</p>
                    <p className="text-2xl font-semibold font-mono text-cyan-400 mt-0.5 tabular-nums">
                      {currentPoint?.speed || 0} <span className="text-xs text-slate-500 font-normal">km/h</span>
                    </p>
                  </div>
                  <Gauge size={22} className="text-cyan-500/40" />
                </div>

                <div className="rounded-none bg-slate-950 p-3.5 border border-slate-800 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-slate-400 font-mono font-medium">Engine RPM</p>
                    <p className="text-2xl font-semibold font-mono text-emerald-400 mt-0.5 tabular-nums">
                      {currentPoint?.rpm || 0}
                    </p>
                  </div>
                  <Zap size={22} className="text-emerald-500/40" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-none bg-slate-950 p-3 border border-slate-800">
                    <p className="text-[10px] text-slate-400 font-mono font-medium">Throttle</p>
                    <p className="text-xl font-semibold font-mono text-amber-400 mt-0.5 tabular-nums">
                      {currentPoint?.throttle || 0}%
                    </p>
                  </div>

                  <div className="rounded-none bg-slate-950 p-3 border border-slate-800">
                    <p className="text-[10px] text-slate-400 font-mono font-medium">Brake</p>
                    <p className="text-xl font-semibold font-mono text-red-400 mt-0.5 tabular-nums">
                      {currentPoint?.brake ? "100%" : "0%"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-none bg-slate-950 p-3 border border-slate-800">
                    <p className="text-[10px] text-slate-400 font-mono font-medium">Gear</p>
                    <p className="text-xl font-semibold font-mono text-slate-100 mt-0.5 tabular-nums">
                      <span className="text-cyan-300 font-semibold">nGear {currentPoint?.gear || 0}</span>
                    </p>
                  </div>

                  <div className="rounded-none bg-slate-950 p-3 border border-slate-800">
                    <p className="text-[10px] text-slate-400 font-mono font-medium">DRS</p>
                    <p className="text-xs font-semibold font-mono mt-1">
                      {currentPoint?.drs ? (
                        <span className="sharp-tag bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                          OPEN
                        </span>
                      ) : (
                        <span className="text-slate-500">CLOSED</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Dual Comparative HUD Cards */
              <div className="space-y-3">
                <div style={{ borderColor: primaryColor }} className="rounded-none border bg-slate-950 p-3 space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-100">
                    <span className="flex items-center gap-1.5">
                      <span style={{ backgroundColor: primaryColor }} className="w-2 h-2"></span>
                      Driver {driverCode}
                    </span>
                    <span className="font-mono text-slate-400">Lap #{lapNumber}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-mono">
                    <div className="bg-slate-900 p-1 border border-slate-800">
                      <span className="text-[8px] text-slate-400 block font-sans">SPD</span>
                      <span className="font-semibold text-slate-100 tabular-nums">{currentPoint?.speed || 0}</span>
                    </div>
                    <div className="bg-slate-900 p-1 border border-slate-800">
                      <span className="text-[8px] text-slate-400 block font-sans">THR</span>
                      <span className="text-amber-400 font-semibold tabular-nums">{currentPoint?.throttle || 0}%</span>
                    </div>
                    <div className="bg-slate-900 p-1 border border-slate-800">
                      <span className="text-[8px] text-slate-400 block font-sans">BRK</span>
                      <span className="text-red-400 font-semibold tabular-nums">{currentPoint?.brake ? "100%" : "0%"}</span>
                    </div>
                  </div>
                </div>

                <div style={{ borderColor: secondaryColor }} className="rounded-none border bg-slate-950 p-3 space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-100">
                    <span className="flex items-center gap-1.5">
                      <span style={{ backgroundColor: secondaryColor }} className="w-2 h-2"></span>
                      Driver {secondaryDriver}
                    </span>
                    <span className="font-mono text-slate-400">Lap #{secondaryLap}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-mono">
                    <div className="bg-slate-900 p-1 border border-slate-800">
                      <span className="text-[8px] text-slate-400 block font-sans">SPD</span>
                      <span className="font-semibold text-slate-100 tabular-nums">{secCurrentPoint?.speed || 0}</span>
                    </div>
                    <div className="bg-slate-900 p-1 border border-slate-800">
                      <span className="text-[8px] text-slate-400 block font-sans">THR</span>
                      <span className="text-amber-300 font-semibold tabular-nums">{secCurrentPoint?.throttle || 0}%</span>
                    </div>
                    <div className="bg-slate-900 p-1 border border-slate-800">
                      <span className="text-[8px] text-slate-400 block font-sans">BRK</span>
                      <span className="text-rose-400 font-semibold tabular-nums">{secCurrentPoint?.brake ? "100%" : "0%"}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-none bg-slate-950 p-3 border border-slate-800 flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400">Speed delta:</span>
                  <span
                    className={`font-semibold tabular-nums ${
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
      </div>

      {/* ── Integrated Playback Controls Bar (Directly below Map Centerpiece) ── */}
      <div className="border border-slate-800 bg-slate-surface p-4 border-l-2 border-l-cyan-400 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTime(0)}
            className="p-2 rounded-none border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 transition-colors"
            title="Reset to Start"
          >
            <RotateCcw size={16} />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-2 rounded-none bg-cyan-400 px-4 py-2 text-xs font-mono font-bold text-slate-950 hover:bg-cyan-300 transition-colors"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            {isPlaying ? "Pause Playback" : "Play Telemetry"}
          </button>

          <button
            onClick={() => setActiveTime(maxTime)}
            className="p-2 rounded-none border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 transition-colors"
            title="Jump to End"
          >
            <FastForward size={16} />
          </button>
        </div>

        {/* Distance Scrub Bar Slider */}
        <div className="flex-1 w-full max-w-xl flex items-center gap-3">
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
            className="w-full h-2 bg-slate-950 rounded-none appearance-none cursor-pointer accent-cyan-400 border border-slate-800"
          />
          <span className="text-xs font-mono text-slate-400 tabular-nums">{Math.round(maxDistance)}m</span>
        </div>

        {/* Speed Selector Buttons */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-800">
          {[0.5, 1, 2, 5].map((spd) => (
            <button
              key={spd}
              onClick={() => setPlaybackSpeed(spd)}
              className={`px-2.5 py-1 text-xs font-semibold font-mono transition-colors ${
                playbackSpeed === spd ? "bg-cyan-400 text-slate-950 font-bold" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* ── Repositioned Telemetry Chart Stack (Below Map & Controls) ── */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold tracking-tight text-slate-100 flex items-center gap-2">
          <Gauge size={16} className="text-cyan-400" /> Synced multi-channel telemetry stack
        </h2>

        {/* Speed Channel Chart */}
        <div className="border border-slate-800 bg-slate-surface p-4 relative border-l-2 border-l-cyan-400">
          <div className="flex justify-between items-center mb-2 font-mono">
            <span className="text-xs font-semibold text-cyan-300">Speed (km/h)</span>
            <span className="text-xs text-slate-400 tabular-nums">{currentPoint?.speed || 0} km/h</span>
          </div>

          <div
            className="relative h-28 w-full bg-slate-950 border border-slate-800 cursor-crosshair overflow-hidden"
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
            <svg viewBox={`0 0 ${maxDistance} 350`} preserveAspectRatio="none" className="w-full h-full">
              <polyline
                fill="none"
                stroke={primaryColor}
                strokeWidth="2.5"
                points={points.map((p) => `${p.distance},${350 - p.speed}`).join(" ")}
              />
              {comparisonMode && comparisonData && comparisonData.secondary_telemetry?.telemetry_points && (
                <polyline
                  fill="none"
                  stroke={secondaryColor}
                  strokeWidth="2"
                  strokeDasharray="4 2"
                  points={comparisonData.secondary_telemetry.telemetry_points.map((p) => `${p.distance},${350 - p.speed}`).join(" ")}
                />
              )}
            </svg>

            <div
              style={{ left: `${(activeDistance / maxDistance) * 100}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 pointer-events-none"
            />
          </div>
        </div>

        {/* Time Delta Chart (fastf1.utils.delta_time) when comparison mode active */}
        {comparisonMode && comparisonData && comparisonData.time_delta_seconds && comparisonData.time_delta_seconds.length > 0 && (
          <div className="border border-amber-500/30 bg-slate-surface p-4 relative border-l-2 border-l-amber-500">
            <div className="flex justify-between items-center mb-2 font-mono">
              <span className="text-xs font-semibold text-amber-300">
                Time delta trace (seconds) — fastf1.utils.delta_time ({driverCode} vs {secondaryDriver})
              </span>
              <span className="text-xs text-amber-400">
                Above 0 line = {driverCode} ahead | Below 0 line = {secondaryDriver} ahead
              </span>
            </div>

            <div className="relative h-20 w-full bg-slate-950 border border-slate-800 cursor-crosshair overflow-hidden">
              <svg viewBox={`0 0 ${maxDistance} 100`} preserveAspectRatio="none" className="w-full h-full">
                <line x1="0" y1="50" x2={maxDistance} y2="50" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
                <polyline
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2"
                  points={comparisonData.aligned_distance.map((dist, idx) => {
                    const delta = comparisonData.time_delta_seconds[idx] || 0;
                    const clampedY = Math.max(5, Math.min(95, 50 - delta * 20));
                    return `${dist},${clampedY}`;
                  }).join(" ")}
                />
              </svg>

              <div
                style={{ left: `${(activeDistance / maxDistance) * 100}%` }}
                className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 pointer-events-none"
              />
            </div>
          </div>
        )}

        {/* Throttle & Brake Channel Chart */}
        <div className="border border-slate-800 bg-slate-surface p-4 relative border-l-2 border-l-amber-500">
          <div className="flex justify-between items-center mb-2 font-mono">
            <span className="text-xs font-semibold text-amber-300">Throttle (%) & Brake (%)</span>
            <span className="text-xs text-slate-400 tabular-nums">
              {comparisonMode ? (
                <>
                  <span className="text-cyan-400 font-semibold">{driverCode}:</span> T:<span className="text-amber-400">{currentPoint?.throttle || 0}%</span> B:<span className="text-red-400">{currentPoint?.brake ? 100 : 0}%</span>
                  <span className="text-slate-500 mx-1.5">|</span>
                  <span className="text-amber-400 font-semibold">{secondaryDriver}:</span> T:<span className="text-amber-300">{secCurrentPoint?.throttle || 0}%</span> B:<span className="text-rose-400">{secCurrentPoint?.brake ? 100 : 0}%</span>
                </>
              ) : (
                <>
                  T: <span className="text-amber-400">{currentPoint?.throttle || 0}%</span> | B: <span className="text-red-400">{currentPoint?.brake ? 100 : 0}%</span>
                </>
              )}
            </span>
          </div>

          <div
            className="relative h-24 w-full bg-slate-950 border border-slate-800 cursor-crosshair overflow-hidden"
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
              <polyline
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2"
                points={points.map((p) => `${p.distance},${100 - p.throttle}`).join(" ")}
              />
              <polyline
                fill="none"
                stroke="#EF4444"
                strokeWidth="2"
                points={points.map((p) => `${p.distance},${100 - p.brake * 100}`).join(" ")}
              />

              {comparisonMode && comparisonData && comparisonData.secondary_telemetry?.telemetry_points && (
                <polyline
                  fill="none"
                  stroke="#FBBF24"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                  points={comparisonData.secondary_telemetry.telemetry_points.map((p) => `${p.distance},${100 - p.throttle}`).join(" ")}
                />
              )}
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
              className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* ── Generate Report Modal ── */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg border border-slate-700 bg-slate-surface p-6 shadow-2xl space-y-4 border-l-2 border-l-cyan-400">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold tracking-tight text-slate-100 flex items-center gap-2">
                <FileText size={16} className="text-cyan-400" /> Generate engineering performance report
              </h3>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>

            {reportSuccess ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 text-emerald-300 text-xs font-mono flex items-center gap-2">
                <CheckCircle2 size={16} /> {reportSuccess}
              </div>
            ) : (
              <form onSubmit={handleGenerateReport} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Key performance findings & engineering notes:
                  </label>
                  <textarea
                    rows={4}
                    value={reportFindings}
                    onChange={(e) => setReportFindings(e.target.value)}
                    placeholder="Enter detailed lap observations, braking stability, corner exit speeds, or tire degradation analysis..."
                    className="w-full border border-slate-700 bg-slate-950 p-3 text-xs text-slate-100 font-mono focus:border-cyan-400 focus:outline-none"
                    required
                  />
                </div>

                <div className="bg-slate-950 p-3 border border-slate-800 text-xs font-mono text-slate-400 space-y-1">
                  <p>• Automatically records AuditLog action "report_generated"</p>
                  <p>• Triggers a Notification for driver user ({driverCode})</p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 font-mono">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reportSubmitting}
                    className="bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
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
