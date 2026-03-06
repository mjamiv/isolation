import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useComparisonStore } from '@/stores/comparisonStore';
import type { TimeHistoryResults } from '@/types/analysis';
import { computeTfpStageOffsets } from './tfpKinematics';
import { extractOrbitPoints } from './tfpKinematics';
import { toViewerTranslation, useActiveDisplacements } from './useActiveDisplacements';

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

interface AssemblyDrawParams {
  relDx: number;
  relDy: number;
  relDz: number;
  stageCapacities: [number, number, number];
  fullOrbitPoints: [number, number, number][];
  orbitPoints: [number, number, number][];
  radius: number;
  gap: number;
  plateThickness: number;
  viewZoom: number;
  viewPanX: number;
  viewPanY: number;
  viewYaw: number;
  viewPitch: number;
  showOrbit: boolean;
}

function drawAssembly(canvas: HTMLCanvasElement, params: AssemblyDrawParams) {
  const {
    relDx,
    relDy,
    relDz,
    stageCapacities,
    fullOrbitPoints,
    orbitPoints,
    radius,
    gap,
    plateThickness,
    viewZoom,
    viewPanX,
    viewPanY,
    viewYaw,
    viewPitch,
    showOrbit,
  } = params;
  const offsets = computeTfpStageOffsets(relDx, relDz, stageCapacities);
  const [s1x, s1z] = offsets.slider1;
  const [s2x, s2z] = offsets.slider2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 220;
  const cssH = canvas.clientHeight || 160;
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const cosY = Math.cos(viewYaw);
  const sinY = Math.sin(viewYaw);
  const cosP = Math.cos(viewPitch);
  const sinP = Math.sin(viewPitch);
  let orbitExtent = 0;
  for (const p of fullOrbitPoints) {
    orbitExtent = Math.max(orbitExtent, Math.abs(p[0]), Math.abs(p[2]));
  }
  const viewExtent = Math.max(
    radius * 4,
    Math.abs(relDx) + Math.abs(relDz) + radius * 2.5,
    orbitExtent + radius * 1.2,
    32,
  );
  const scale = (Math.min(cssW, cssH) / (viewExtent * 1.15)) * viewZoom;
  const cx = cssW * 0.5 + viewPanX;
  const cy = cssH * 0.58 + viewPanY;

  const project = (x: number, y: number, z: number) => {
    const xr = x * cosY - z * sinY;
    const zr = x * sinY + z * cosY;
    const yr = y * cosP - zr * sinP;
    const depth = y * sinP + zr * cosP;
    return { x: cx + xr * scale, y: cy - yr * scale, depth };
  };

  const SEGS = 28;
  const lightDir = { x: 0.35, y: 0.65, z: -0.67 };
  const lightLen = Math.sqrt(lightDir.x ** 2 + lightDir.y ** 2 + lightDir.z ** 2);
  lightDir.x /= lightLen;
  lightDir.y /= lightLen;
  lightDir.z /= lightLen;

  const shade = (base: string, nDotL: number): string => {
    const m = base.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) return base;
    const br = 0.45 + 0.55 * Math.max(0, nDotL);
    const rc = Math.min(255, Math.round(parseInt(m[1]!, 16) * br));
    const gc = Math.min(255, Math.round(parseInt(m[2]!, 16) * br));
    const bc = Math.min(255, Math.round(parseInt(m[3]!, 16) * br));
    return `rgb(${rc},${gc},${bc})`;
  };

  const drawPlate = (x: number, y: number, z: number, r: number, h: number, fill: string) => {
    ctx.globalAlpha = 0.92;
    const topY = y + h * 0.5;
    const botY = y - h * 0.5;
    const topPts: { x: number; y: number; depth: number }[] = [];
    const botPts: { x: number; y: number; depth: number }[] = [];
    for (let i = 0; i < SEGS; i++) {
      const angle = (i / SEGS) * Math.PI * 2;
      const px = x + Math.cos(angle) * r;
      const pz = z + Math.sin(angle) * r;
      topPts.push(project(px, topY, pz));
      botPts.push(project(px, botY, pz));
    }

    const topCenter = project(x, topY, z);
    const botCenter = project(x, botY, z);
    const topFacesCamera = topCenter.depth > botCenter.depth;

    const backPts = topFacesCamera ? botPts : topPts;
    const backNdotL = topFacesCamera ? -lightDir.y : lightDir.y;
    ctx.beginPath();
    ctx.moveTo(backPts[0]!.x, backPts[0]!.y);
    for (let i = 1; i < SEGS; i++) ctx.lineTo(backPts[i]!.x, backPts[i]!.y);
    ctx.closePath();
    ctx.fillStyle = shade(fill, backNdotL * 0.5);
    ctx.fill();

    for (let i = 0; i < SEGS; i++) {
      const next = (i + 1) % SEGS;
      const midAngle = ((i + 0.5) / SEGS) * Math.PI * 2;
      const nx = Math.cos(midAngle);
      const nz = Math.sin(midAngle);
      const nDotL = nx * lightDir.x + nz * lightDir.z;
      const ex = topPts[next]!.x - topPts[i]!.x;
      const ey = topPts[next]!.y - topPts[i]!.y;
      const fx = botPts[i]!.x - topPts[i]!.x;
      const fy = botPts[i]!.y - topPts[i]!.y;
      if (ex * fy - ey * fx >= 0) continue;
      ctx.beginPath();
      ctx.moveTo(topPts[i]!.x, topPts[i]!.y);
      ctx.lineTo(topPts[next]!.x, topPts[next]!.y);
      ctx.lineTo(botPts[next]!.x, botPts[next]!.y);
      ctx.lineTo(botPts[i]!.x, botPts[i]!.y);
      ctx.closePath();
      ctx.fillStyle = shade(fill, nDotL * 0.85);
      ctx.fill();
    }

    const frontPts = topFacesCamera ? topPts : botPts;
    const frontNdotL = topFacesCamera ? lightDir.y : -lightDir.y;
    ctx.beginPath();
    ctx.moveTo(frontPts[0]!.x, frontPts[0]!.y);
    for (let i = 1; i < SEGS; i++) ctx.lineTo(frontPts[i]!.x, frontPts[i]!.y);
    ctx.closePath();
    ctx.fillStyle = shade(fill, frontNdotL);
    ctx.fill();
  };

  // Background
  ctx.fillStyle = 'rgba(8,12,20,0.92)';
  ctx.fillRect(0, 0, cssW, cssH);

  // Subtle grid
  const gridY = -radius * 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 0.5;
  const gridStep = Math.max(radius * 0.4, 6);
  const gridHalf = radius * 3;
  for (let g = -gridHalf; g <= gridHalf; g += gridStep) {
    const a = project(-gridHalf, gridY, g);
    const b = project(gridHalf, gridY, g);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    const c = project(g, gridY, -gridHalf);
    const d = project(g, gridY, gridHalf);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
  }

  // Orbit trace
  if (showOrbit && fullOrbitPoints.length > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    fullOrbitPoints.forEach((p, i) => {
      const q = project(p[0], p[1], p[2]);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.stroke();
  }
  if (showOrbit && orbitPoints.length > 1) {
    ctx.strokeStyle = 'rgba(34,211,238,0.80)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    orbitPoints.forEach((p, i) => {
      const q = project(p[0], p[1], p[2]);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.stroke();
    const last = orbitPoints[orbitPoints.length - 1]!;
    const cur = project(last[0], last[1], last[2]);
    ctx.beginPath();
    ctx.arc(cur.x, cur.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#22d3ee';
    ctx.fill();
  }

  // Assembly plates — depth-sorted
  const pieces: { x: number; y: number; z: number; r: number; h: number; fill: string }[] = [
    {
      x: 0,
      y: -plateThickness * 1.8,
      z: 0,
      r: radius * 0.96,
      h: plateThickness * 2.2,
      fill: '#6b7280',
    },
    { x: 0, y: 0, z: 0, r: radius, h: plateThickness, fill: '#c8d0dc' },
    {
      x: 0,
      y: plateThickness * 0.85,
      z: 0,
      r: radius * 0.55,
      h: plateThickness * 0.9,
      fill: '#9ca3af',
    },
    { x: s1x, y: gap * 0.35, z: s1z, r: radius * 0.22, h: plateThickness * 1.1, fill: '#d1d5db' },
    { x: s2x, y: gap * 0.56, z: s2z, r: radius * 0.32, h: plateThickness * 1.05, fill: '#e5e7eb' },
    { x: relDx, y: gap + relDy, z: relDz, r: radius, h: plateThickness, fill: '#c8d0dc' },
    {
      x: relDx,
      y: gap + relDy - plateThickness * 0.85,
      z: relDz,
      r: radius * 0.55,
      h: plateThickness * 0.9,
      fill: '#9ca3af',
    },
  ];
  pieces.sort((a, b) => project(a.x, a.y, a.z).depth - project(b.x, b.y, b.z).depth);
  for (const p of pieces) drawPlate(p.x, p.y, p.z, p.r, p.h, p.fill);

  ctx.globalAlpha = 1;

  // Displacement readout — bottom-left of canvas
  ctx.font = '10px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.40)';
  ctx.fillText(`dX ${relDx.toFixed(2)}  dZ ${relDz.toFixed(2)}`, 6, cssH - 6);
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BearingAssemblyWindow() {
  const bearings = useModelStore((s) => s.bearings);
  const nodes = useModelStore((s) => s.nodes);
  const activeBearingId = useDisplayStore((s) => s.activeBearingId);
  const setActiveBearing = useDisplayStore((s) => s.setActiveBearing);
  const bearingVerticalScale = useDisplayStore((s) => s.bearingVerticalScale);
  const showBearingDisplacement = useDisplayStore((s) => s.showBearingDisplacement);
  const currentTimeStep = useAnalysisStore((s) => s.currentTimeStep);
  const { nodeDisplacements, zUpData } = useActiveDisplacements();
  const thResults = useActiveTimeHistory();

  const bearingList = useMemo(
    () => Array.from(bearings.values()).sort((a, b) => a.id - b.id),
    [bearings],
  );

  const [showOrbit, setShowOrbit] = useState(true);
  const [viewZoom, setViewZoom] = useState(1);
  const [viewPan, setViewPan] = useState({ x: 0, y: 0 });
  const [viewYaw, setViewYaw] = useState(-Math.PI / 4);
  const [viewPitch, setViewPitch] = useState(0.62);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });

  const selectedIdx = useMemo(() => {
    if (bearingList.length === 0) return 0;
    if (activeBearingId == null) return 0;
    const idx = bearingList.findIndex((b) => b.id === activeBearingId);
    return idx >= 0 ? idx : 0;
  }, [bearingList, activeBearingId]);

  useEffect(() => {
    if (bearingList.length === 0) return;
    const hasActive = activeBearingId != null && bearingList.some((b) => b.id === activeBearingId);
    if (!hasActive) setActiveBearing(bearingList[0]?.id ?? null);
  }, [bearingList, activeBearingId, setActiveBearing]);

  const bearing = bearingList[selectedIdx] ?? null;
  const maxDispCap = Math.max(...(bearing?.dispCapacities ?? [0.01]), 0.01);
  const stageCapacities: [number, number, number] = useMemo(
    () => [
      Math.max(0.001, bearing?.dispCapacities?.[0] ?? maxDispCap * 0.33),
      Math.max(0.001, bearing?.dispCapacities?.[1] ?? maxDispCap * 0.33),
      Math.max(0.001, bearing?.dispCapacities?.[2] ?? maxDispCap * 0.34),
    ],
    [bearing, maxDispCap],
  );
  const radius = Math.min(Math.max(maxDispCap * 1.1, 12), 36);
  const plateThickness = Math.min(Math.max(radius * 0.14, 1.2), 4.0);
  const gap = Math.max(4, Math.min(16, radius * 0.5 * bearingVerticalScale));
  const orbitY = -plateThickness * 0.72;

  const localScale = 1;
  const fullOrbitPoints = useMemo(() => {
    if (!thResults || !bearing) return [] as [number, number, number][];
    return extractOrbitPoints(thResults.timeSteps, bearing.nodeI, bearing.nodeJ, 240).map(
      ([x, z]) => [x * localScale, orbitY, z * localScale] as [number, number, number],
    );
  }, [thResults, bearing, orbitY]);
  const orbitPoints = useMemo(() => {
    if (fullOrbitPoints.length === 0) return [] as [number, number, number][];
    const clampedStep = Math.min(currentTimeStep, fullOrbitPoints.length - 1);
    return fullOrbitPoints.slice(0, clampedStep + 1);
  }, [fullOrbitPoints, currentTimeStep]);

  const nodeI = bearing ? nodes.get(bearing.nodeI) : undefined;
  const nodeJ = bearing ? nodes.get(bearing.nodeJ) : undefined;
  const is2DFrame = nodeI && nodeJ ? Math.abs(nodeI.z) < 1e-3 && Math.abs(nodeJ.z) < 1e-3 : false;
  const dispI = toViewerTranslation(
    bearing
      ? (nodeDisplacements?.[bearing.nodeI] ?? nodeDisplacements?.[String(bearing.nodeI)])
      : undefined,
    localScale,
    is2DFrame,
    zUpData,
  );
  const dispJ = toViewerTranslation(
    bearing
      ? (nodeDisplacements?.[bearing.nodeJ] ?? nodeDisplacements?.[String(bearing.nodeJ)])
      : undefined,
    localScale,
    is2DFrame,
    zUpData,
  );

  const relDx = dispJ[0] - dispI[0];
  const relDy = dispJ[1] - dispI[1];
  const relDz = dispJ[2] - dispI[2];

  useEffect(() => {
    if (!showBearingDisplacement || !bearing || !nodeI || !nodeJ) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawAssembly(canvas, {
      relDx,
      relDy,
      relDz,
      stageCapacities,
      fullOrbitPoints,
      orbitPoints,
      radius,
      gap,
      plateThickness,
      viewZoom,
      viewPanX: viewPan.x,
      viewPanY: viewPan.y,
      viewYaw,
      viewPitch,
      showOrbit,
    });
  }, [
    relDx,
    relDy,
    relDz,
    stageCapacities,
    fullOrbitPoints,
    orbitPoints,
    radius,
    gap,
    plateThickness,
    viewZoom,
    viewPan.x,
    viewPan.y,
    viewYaw,
    viewPitch,
    showOrbit,
    showBearingDisplacement,
    bearing,
    nodeI,
    nodeJ,
  ]);

  if (!showBearingDisplacement || !bearing || !nodeI || !nodeJ) return null;

  const handleWheel = (e: ReactWheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const next = e.deltaY < 0 ? viewZoom * 1.12 : viewZoom / 1.12;
    setViewZoom(Math.min(5, Math.max(0.3, next)));
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    dragRef.current = { active: true, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current = { active: true, x: e.clientX, y: e.clientY };
    if (e.shiftKey) {
      setViewPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    } else {
      setViewYaw((y) => y + dx * 0.012);
      setViewPitch((p) => Math.min(1.35, Math.max(0.1, p + dy * 0.01)));
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    dragRef.current.active = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const prevBearing = () => {
    const nextIdx = (selectedIdx - 1 + bearingList.length) % bearingList.length;
    setActiveBearing(bearingList[nextIdx]?.id ?? null);
  };
  const nextBearing = () => {
    const nextIdx = (selectedIdx + 1) % bearingList.length;
    setActiveBearing(bearingList[nextIdx]?.id ?? null);
  };
  const resetView = () => {
    setViewZoom(1);
    setViewPan({ x: 0, y: 0 });
    setViewYaw(-Math.PI / 4);
    setViewPitch(0.62);
  };

  return (
    <div
      className="bearing-assembly-panel"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      {/* Canvas — the main content */}
      <canvas
        ref={canvasRef}
        className="bearing-assembly-canvas"
        style={{ touchAction: 'none' }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {/* Compact bottom bar */}
      <div className="bearing-assembly-bar">
        {bearingList.length > 1 && (
          <>
            <button className="bearing-assembly-btn" onClick={prevBearing}>
              ‹
            </button>
            <span className="bearing-assembly-label">
              {bearing.label ?? `Brg ${bearing.id}`}
              <span className="bearing-assembly-count">
                {selectedIdx + 1}/{bearingList.length}
              </span>
            </span>
            <button className="bearing-assembly-btn" onClick={nextBearing}>
              ›
            </button>
            <span className="bearing-assembly-sep" />
          </>
        )}
        <button
          className="bearing-assembly-btn"
          data-active={showOrbit}
          onClick={() => setShowOrbit((v) => !v)}
        >
          Orbit
        </button>
        <button className="bearing-assembly-btn" onClick={resetView}>
          Reset
        </button>
      </div>
    </div>
  );
}
