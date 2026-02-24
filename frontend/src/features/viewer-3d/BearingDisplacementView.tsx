/**
 * BearingDisplacementView.tsx
 *
 * Compact, collapsible overlay that visualizes isolation bearing displacement
 * orbits during time-history playback. Shows one bearing at a time in a
 * plan-view X-Z plot with prev/next navigation, amplification presets, and
 * a collapse toggle.
 *
 * Orbit data source: relative GLOBAL node displacements (nodeJ − nodeI) from
 * the time-history results. Node displacements are always in the backend's
 * global frame (Z-up).
 *
 * Backend Z-up global DOFs → Frontend Y-up:
 *   DOF 1 (Global X) → Frontend X  (plotted on horizontal axis)
 *   DOF 2 (Global Y) → Frontend Z  (plotted on vertical axis)
 *   DOF 3 (Global Z) → Frontend Y  (vertical — not plotted)
 */

import { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useComparisonStore } from '@/stores/comparisonStore';
import { useModelStore } from '@/stores/modelStore';
import type { TimeHistoryResults } from '@/types/analysis';

// ── Layout constants ─────────────────────────────────────────────────
const CANVAS_SIZE = 160;
const PADDING = 16;
const PLOT_SIZE = CANVAS_SIZE - PADDING * 2;
const SCALE_PRESETS = [1, 2, 5, 10, 50] as const;

// ── Colors ───────────────────────────────────────────────────────────
const COLOR_TRACE = '#d4af37';
const COLOR_TRACE_FADED = 'rgba(212, 175, 55, 0.25)';
const COLOR_CURRENT = '#facc15';
const COLOR_CAPACITY = 'rgba(255, 255, 255, 0.12)';
const COLOR_CAPACITY_STROKE = 'rgba(255, 255, 255, 0.3)';
const COLOR_AXIS = 'rgba(255, 255, 255, 0.18)';
const COLOR_LABEL = 'rgba(255, 255, 255, 0.65)';

// ── Helpers ──────────────────────────────────────────────────────────

function useActiveTimeHistory(): TimeHistoryResults | null {
  const results = useAnalysisStore((s) => s.results);
  const comparisonType = useComparisonStore((s) => s.comparisonType);
  const comparisonIsolated = useComparisonStore((s) => s.isolated);

  if (comparisonType === 'time_history' && comparisonIsolated?.timeHistoryResults) {
    return comparisonIsolated.timeHistoryResults;
  }
  if (results?.type === 'time_history' && results.results) {
    return results.results as TimeHistoryResults;
  }
  return null;
}

function collectBearingIds(thResults: TimeHistoryResults): number[] {
  const idSet = new Set<number>();
  for (const step of thResults.timeSteps) {
    if (step.bearingResponses) {
      for (const key of Object.keys(step.bearingResponses)) {
        idSet.add(Number(key));
      }
    }
  }
  return Array.from(idSet).sort((a, b) => a - b);
}

function extractOrbit(
  thResults: TimeHistoryResults,
  nodeI: number,
  nodeJ: number,
): { x: number; y: number }[] {
  const orbit: { x: number; y: number }[] = [];
  for (const step of thResults.timeSteps) {
    const dispI = step.nodeDisplacements[nodeI];
    const dispJ = step.nodeDisplacements[nodeJ];
    if (dispJ) {
      const dx = dispJ[0] - (dispI?.[0] ?? 0);
      const dy = dispJ[1] - (dispI?.[1] ?? 0);
      orbit.push({ x: dx, y: dy });
    } else {
      orbit.push({ x: 0, y: 0 });
    }
  }
  return orbit;
}

function computeScale(maxDisp: number): { plotMax: number } {
  if (maxDisp <= 0) return { plotMax: 1 };
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxDisp)));
  const normalized = maxDisp / magnitude;
  let nice: number;
  if (normalized <= 1) nice = 1;
  else if (normalized <= 2) nice = 2;
  else if (normalized <= 5) nice = 5;
  else nice = 10;
  return { plotMax: nice * magnitude * 1.15 };
}

// ── Canvas renderer ──────────────────────────────────────────────────

interface BearingPlotData {
  bearingId: number;
  label: string;
  orbit: { x: number; y: number }[];
  dispCapacity: number;
}

function drawBearingPlot(
  ctx: CanvasRenderingContext2D,
  data: BearingPlotData,
  currentStep: number,
  plotSize: number,
  ampFactor: number,
) {
  const { orbit, dispCapacity } = data;
  if (orbit.length === 0) return;

  const pad = PADDING;
  const cx = pad + plotSize / 2;
  const cy = pad + plotSize / 2;

  // Scale to actual orbit extent (amplified)
  let orbitMax = 0;
  for (const pt of orbit) {
    orbitMax = Math.max(orbitMax, Math.abs(pt.x), Math.abs(pt.y));
  }
  const effectiveMax = Math.max(orbitMax * ampFactor, 0.01);
  const { plotMax } = computeScale(effectiveMax);
  const scale = plotSize / 2 / plotMax;

  const toCanvas = (x: number, y: number): [number, number] => [
    cx + x * ampFactor * scale,
    cy - y * ampFactor * scale,
  ];

  // Capacity circle (clipped to plot area)
  ctx.save();
  ctx.beginPath();
  ctx.rect(pad, pad, plotSize, plotSize);
  ctx.clip();
  const capRadius = dispCapacity * scale;
  ctx.beginPath();
  ctx.arc(cx, cy, capRadius, 0, Math.PI * 2);
  ctx.fillStyle = COLOR_CAPACITY;
  ctx.fill();
  ctx.strokeStyle = COLOR_CAPACITY_STROKE;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Axis cross-hairs
  ctx.beginPath();
  ctx.moveTo(pad, cy);
  ctx.lineTo(pad + plotSize, cy);
  ctx.moveTo(cx, pad);
  ctx.lineTo(cx, pad + plotSize);
  ctx.strokeStyle = COLOR_AXIS;
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Full orbit trace (faded)
  if (orbit.length > 1) {
    ctx.beginPath();
    const [sx, sy] = toCanvas(orbit[0]!.x, orbit[0]!.y);
    ctx.moveTo(sx, sy);
    for (let i = 1; i < orbit.length; i++) {
      const [px, py] = toCanvas(orbit[i]!.x, orbit[i]!.y);
      ctx.lineTo(px, py);
    }
    ctx.strokeStyle = COLOR_TRACE_FADED;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Active trace up to current step
  const clampedStep = Math.min(currentStep, orbit.length - 1);
  if (clampedStep > 0) {
    const trailLength = Math.min(clampedStep, 80);
    const startIdx = Math.max(0, clampedStep - trailLength);
    ctx.beginPath();
    const [sx, sy] = toCanvas(orbit[startIdx]!.x, orbit[startIdx]!.y);
    ctx.moveTo(sx, sy);
    for (let i = startIdx + 1; i <= clampedStep; i++) {
      const [px, py] = toCanvas(orbit[i]!.x, orbit[i]!.y);
      ctx.lineTo(px, py);
    }
    ctx.strokeStyle = COLOR_TRACE;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  // Recent tail highlight
  const tailLen = Math.min(20, clampedStep);
  if (tailLen > 1) {
    const tailStart = clampedStep - tailLen;
    for (let i = tailStart; i < clampedStep; i++) {
      const t = (i - tailStart) / tailLen;
      const [x1, y1] = toCanvas(orbit[i]!.x, orbit[i]!.y);
      const [x2, y2] = toCanvas(orbit[i + 1]!.x, orbit[i + 1]!.y);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = COLOR_TRACE;
      ctx.lineWidth = 1 + 2 * t;
      ctx.globalAlpha = 0.2 + 0.8 * t;
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
  }

  // Current position dot
  const current = orbit[clampedStep];
  if (current) {
    const [curX, curY] = toCanvas(current.x, current.y);
    ctx.beginPath();
    ctx.arc(curX, curY, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.3)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(curX, curY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_CURRENT;
    ctx.fill();
  }

  // Axis labels
  ctx.font = '8px monospace';
  ctx.fillStyle = COLOR_LABEL;
  ctx.textAlign = 'left';
  ctx.fillText('X', pad + plotSize + 2, cy + 3);
  ctx.textAlign = 'center';
  ctx.fillText('Z', cx, pad - 3);

  // Displacement readout
  if (current) {
    ctx.font = '8px monospace';
    ctx.fillStyle = COLOR_CURRENT;
    ctx.textAlign = 'right';
    ctx.fillText(
      `X=${current.x.toFixed(3)}" Z=${current.y.toFixed(3)}"`,
      pad + plotSize,
      CANVAS_SIZE - 3,
    );
  }

  // Scale bar
  const scaleBarPx = dispCapacity * scale;
  if (scaleBarPx > 8 && scaleBarPx < plotSize) {
    const barY = CANVAS_SIZE - 4;
    ctx.beginPath();
    ctx.moveTo(pad, barY);
    ctx.lineTo(pad + scaleBarPx, barY);
    ctx.moveTo(pad, barY - 2);
    ctx.lineTo(pad, barY + 2);
    ctx.moveTo(pad + scaleBarPx, barY - 2);
    ctx.lineTo(pad + scaleBarPx, barY + 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = '7px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'left';
    ctx.fillText(`${dispCapacity.toFixed(1)}"`, pad + scaleBarPx + 2, barY + 2);
  }
}

// ── Main component ───────────────────────────────────────────────────

export function BearingDisplacementView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ampFactor, setAmpFactor] = useState(1);
  const [collapsed, setCollapsed] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const thResults = useActiveTimeHistory();
  const currentTimeStep = useAnalysisStore((s) => s.currentTimeStep);
  const bearings = useModelStore((s) => s.bearings);

  const bearingIds = useMemo(() => {
    if (!thResults) return [];
    return collectBearingIds(thResults);
  }, [thResults]);

  const bearingPlots: BearingPlotData[] = useMemo(() => {
    if (!thResults || bearingIds.length === 0) return [];
    return bearingIds.map((id) => {
      const bearing = bearings.get(id);
      let dispCapacity = 16;
      if (bearing) dispCapacity = Math.max(...bearing.dispCapacities);
      return {
        bearingId: id,
        label: bearing?.label ?? `Brg ${id}`,
        orbit: bearing ? extractOrbit(thResults, bearing.nodeI, bearing.nodeJ) : [],
        dispCapacity,
      };
    });
  }, [thResults, bearingIds, bearings]);

  const numBearings = bearingPlots.length;

  // Clamp selected index when bearing count changes
  useEffect(() => {
    if (selectedIdx >= numBearings && numBearings > 0) {
      setSelectedIdx(numBearings - 1);
    }
  }, [numBearings, selectedIdx]);

  const activePlot = numBearings > 0 ? bearingPlots[selectedIdx] : undefined;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activePlot) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    drawBearingPlot(ctx, activePlot, currentTimeStep, PLOT_SIZE, ampFactor);
  }, [activePlot, currentTimeStep, ampFactor]);

  useEffect(() => {
    draw();
  }, [draw]);

  if (numBearings === 0 || !thResults) return null;

  const panelWidth = 192;

  return (
    <div
      className="absolute bottom-3 right-3 z-10 rounded-lg overflow-hidden"
      style={{
        width: panelWidth,
        backgroundColor: 'rgba(17, 17, 17, 0.92)',
        border: '1px solid rgba(212, 175, 55, 0.35)',
      }}
    >
      {/* Header — always visible */}
      <div
        className="flex items-center justify-between px-2 py-1 cursor-pointer select-none"
        style={{ borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.08)' }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="text-[9px] font-semibold text-gray-300 tracking-wide uppercase">
          Bearing Orbits
        </span>
        <div className="flex items-center gap-1.5">
          {!collapsed && thResults && (
            <span className="text-[8px] text-yellow-400 font-mono">
              t={(currentTimeStep * thResults.dt).toFixed(2)}s
            </span>
          )}
          <span className="text-[10px] text-gray-500">{collapsed ? '\u25B2' : '\u25BC'}</span>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Bearing selector */}
          {numBearings > 1 && (
            <div
              className="flex items-center justify-center gap-2 py-1"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <button
                type="button"
                onClick={() => setSelectedIdx((i) => (i - 1 + numBearings) % numBearings)}
                className="text-[10px] text-gray-400 hover:text-gray-200 px-1"
              >
                &lt;
              </button>
              <span className="text-[9px] text-gray-300 font-mono min-w-[80px] text-center">
                {activePlot?.label ?? ''} ({selectedIdx + 1}/{numBearings})
              </span>
              <button
                type="button"
                onClick={() => setSelectedIdx((i) => (i + 1) % numBearings)}
                className="text-[10px] text-gray-400 hover:text-gray-200 px-1"
              >
                &gt;
              </button>
            </div>
          )}
          {numBearings === 1 && (
            <div
              className="flex items-center justify-center py-1"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span className="text-[9px] text-gray-300 font-mono">{activePlot?.label ?? ''}</span>
            </div>
          )}

          {/* Canvas */}
          <div className="flex justify-center px-2 pt-1">
            <canvas
              ref={canvasRef}
              className="pointer-events-none"
              style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
            />
          </div>

          {/* Amplification buttons */}
          <div className="flex items-center justify-center gap-1 px-2 py-1.5">
            {SCALE_PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setAmpFactor(s)}
                className={`px-1.5 py-0 rounded text-[8px] font-medium transition-colors ${
                  ampFactor === s
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-800/60 text-gray-500 hover:text-gray-300'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
