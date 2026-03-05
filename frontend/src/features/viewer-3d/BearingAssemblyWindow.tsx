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
  transparent: boolean;
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
    transparent,
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
  const cssW = canvas.clientWidth || 248;
  const cssH = canvas.clientHeight || 180;
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const yaw = viewYaw;
  const pitch = viewPitch;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
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
  const cy = cssH * 0.62 + viewPanY;
  const shellOpacity = transparent ? 0.5 : 1;
  const coreOpacity = transparent ? 0.65 : 1;

  const project = (x: number, y: number, z: number) => {
    const xr = x * cosY - z * sinY;
    const zr = x * sinY + z * cosY;
    const yr = y * cosP - zr * sinP;
    const depth = y * sinP + zr * cosP;
    return { x: cx + xr * scale, y: cy - yr * scale, depth };
  };

  const drawPlate = (
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    fill: string,
    alpha: number,
    sideShade = 'rgba(30,41,59,0.28)',
  ) => {
    const top = project(x, y + h * 0.5, z);
    const bot = project(x, y - h * 0.5, z);
    const rx = Math.max(2, r * scale);
    const ry = Math.max(1.5, rx * 0.32);
    const sideTop = top.y;
    const sideBot = bot.y;

    ctx.globalAlpha = Math.min(alpha, 0.95);
    ctx.fillStyle = sideShade;
    ctx.fillRect(top.x - rx, Math.min(sideTop, sideBot), rx * 2, Math.abs(sideBot - sideTop));

    ctx.beginPath();
    ctx.ellipse(bot.x, bot.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15,23,42,0.42)';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(top.x, top.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
  };

  const gridY = -radius * 1.5;

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, cssH);
  bg.addColorStop(0, 'rgba(15,23,42,0.85)');
  bg.addColorStop(1, 'rgba(2,6,23,0.95)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cssW, cssH);

  // Grid plane
  ctx.strokeStyle = 'rgba(59,130,246,0.20)';
  ctx.lineWidth = 0.8;
  const gridStep = Math.max(radius * 0.35, 6);
  const gridHalf = radius * 3.6;
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

  if (showOrbit && fullOrbitPoints.length > 1) {
    ctx.strokeStyle = 'rgba(254,243,199,0.28)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    fullOrbitPoints.forEach((p, i) => {
      const q = project(p[0], p[1], p[2]);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.stroke();
  }
  if (showOrbit && orbitPoints.length > 1) {
    ctx.strokeStyle = 'rgba(212,175,55,0.92)';
    ctx.lineWidth = 1.6;
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
    ctx.arc(cur.x, cur.y, 3.8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(250,204,21,0.34)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cur.x, cur.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.fill();
  }

  // Assembly pieces
  drawPlate(
    0,
    -plateThickness * 1.8,
    0,
    radius * 0.96,
    plateThickness * 2.2,
    '#7c8596',
    shellOpacity,
  );
  drawPlate(0, 0, 0, radius, plateThickness, '#d2dae6', shellOpacity);
  drawPlate(
    0,
    plateThickness * 0.85,
    0,
    radius * 0.55,
    plateThickness * 0.9,
    '#a8b3c3',
    coreOpacity,
  );
  drawPlate(s1x, gap * 0.35, s1z, radius * 0.22, plateThickness * 1.1, '#dbe2eb', coreOpacity);
  drawPlate(s2x, gap * 0.56, s2z, radius * 0.32, plateThickness * 1.05, '#edf2f7', coreOpacity);
  drawPlate(relDx, gap + relDy, relDz, radius, plateThickness, '#d2dae6', shellOpacity);
  drawPlate(
    relDx,
    gap + relDy - plateThickness * 0.85,
    relDz,
    radius * 0.55,
    plateThickness * 0.9,
    '#a8b3c3',
    coreOpacity,
  );

  ctx.globalAlpha = 1;
}

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

export function BearingAssemblyWindow() {
  const bearings = useModelStore((s) => s.bearings);
  const nodes = useModelStore((s) => s.nodes);
  const activeBearingId = useDisplayStore((s) => s.activeBearingId);
  const setActiveBearing = useDisplayStore((s) => s.setActiveBearing);
  const scaleFactor = useDisplayStore((s) => s.scaleFactor);
  const bearingVerticalScale = useDisplayStore((s) => s.bearingVerticalScale);
  const showBearingDisplacement = useDisplayStore((s) => s.showBearingDisplacement);
  const currentTimeStep = useAnalysisStore((s) => s.currentTimeStep);
  const { nodeDisplacements, zUpData } = useActiveDisplacements();
  const thResults = useActiveTimeHistory();

  const bearingList = useMemo(
    () => Array.from(bearings.values()).sort((a, b) => a.id - b.id),
    [bearings],
  );
  const [collapsed, setCollapsed] = useState(false);
  const [transparent, setTransparent] = useState(false);
  const [showOrbit, setShowOrbit] = useState(true);
  const [dragMode, setDragMode] = useState<'rotate' | 'pan'>('rotate');
  const [expanded, setExpanded] = useState(false);
  const [sizePreset, setSizePreset] = useState<'sm' | 'md' | 'lg'>('sm');
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
    if (!hasActive) {
      setActiveBearing(bearingList[0]?.id ?? null);
    }
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
  const fullOrbitPoints = useMemo(() => {
    if (!thResults || !bearing) return [] as [number, number, number][];
    return extractOrbitPoints(thResults.timeSteps, bearing.nodeI, bearing.nodeJ, 240).map(
      ([x, z]) => [x * scaleFactor, orbitY, z * scaleFactor] as [number, number, number],
    );
  }, [thResults, bearing, scaleFactor, orbitY]);
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
    scaleFactor,
    is2DFrame,
    zUpData,
  );
  const dispJ = toViewerTranslation(
    bearing
      ? (nodeDisplacements?.[bearing.nodeJ] ?? nodeDisplacements?.[String(bearing.nodeJ)])
      : undefined,
    scaleFactor,
    is2DFrame,
    zUpData,
  );

  // Use relative displacement only, not undeformed node offsets, so all model generators
  // produce consistent local bearing kinematics.
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
      transparent,
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
    transparent,
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
    const next = e.deltaY < 0 ? viewZoom * 1.08 : viewZoom / 1.08;
    setViewZoom(Math.min(3, Math.max(0.6, next)));
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { active: true, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current = { active: true, x: e.clientX, y: e.clientY };
    const effectiveMode = e.shiftKey ? 'pan' : dragMode;
    if (effectiveMode === 'pan') {
      setViewPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    } else {
      setViewYaw((y) => y + dx * 0.008);
      setViewPitch((p) => Math.min(1.25, Math.max(0.15, p + dy * 0.006)));
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current.active = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };
  const panelMetrics =
    expanded || sizePreset === 'lg'
      ? { width: 420, canvasHeight: 300 }
      : sizePreset === 'md'
        ? { width: 320, canvasHeight: 230 }
        : { width: 250, canvasHeight: 180 };

  return (
    <div
      className="absolute bottom-3 left-3 z-10 overflow-hidden rounded-lg"
      style={{
        width: panelMetrics.width,
        backgroundColor: 'rgba(31, 41, 55, 0.92)',
        border: '1px solid rgba(212, 175, 55, 0.35)',
      }}
    >
      <div
        className="flex cursor-pointer items-center justify-between px-2 py-1 select-none"
        style={{ borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.08)' }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-300">
          Bearing Assembly
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="rounded px-1 text-[9px] text-gray-300 hover:bg-white/10"
            title={expanded ? 'Collapse panel' : 'Expand panel'}
          >
            {expanded ? 'Min' : 'Max'}
          </button>
          <span className="text-[10px] text-gray-500">{collapsed ? '\u25B2' : '\u25BC'}</span>
        </div>
      </div>
      {!collapsed && (
        <>
          {bearingList.length > 1 && (
            <div
              className="flex items-center justify-center gap-2 py-1"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <button
                type="button"
                onClick={() => {
                  const nextIdx = (selectedIdx - 1 + bearingList.length) % bearingList.length;
                  setActiveBearing(bearingList[nextIdx]?.id ?? null);
                }}
                className="px-1 text-[10px] text-gray-400 hover:text-gray-200"
              >
                &lt;
              </button>
              <span className="min-w-[90px] text-center font-mono text-[9px] text-gray-300">
                Bearing {bearing.id} ({selectedIdx + 1}/{bearingList.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  const nextIdx = (selectedIdx + 1) % bearingList.length;
                  setActiveBearing(bearingList[nextIdx]?.id ?? null);
                }}
                className="px-1 text-[10px] text-gray-400 hover:text-gray-200"
              >
                &gt;
              </button>
            </div>
          )}
          <div
            className="flex items-center justify-between gap-2 px-2 py-1"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDragMode('rotate')}
                className={`rounded px-1 text-[8px] ${dragMode === 'rotate' ? 'bg-yellow-500/25 text-yellow-300' : 'text-gray-300 hover:bg-white/10'}`}
              >
                Rotate
              </button>
              <button
                type="button"
                onClick={() => setDragMode('pan')}
                className={`rounded px-1 text-[8px] ${dragMode === 'pan' ? 'bg-yellow-500/25 text-yellow-300' : 'text-gray-300 hover:bg-white/10'}`}
              >
                Pan
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewZoom(1);
                  setViewPan({ x: 0, y: 0 });
                  setViewYaw(-Math.PI / 4);
                  setViewPitch(0.62);
                }}
                className="rounded px-1 text-[8px] text-gray-300 hover:bg-white/10"
              >
                Reset
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSizePreset('sm')}
                className={`rounded px-1 text-[8px] ${sizePreset === 'sm' ? 'bg-yellow-500/25 text-yellow-300' : 'text-gray-300 hover:bg-white/10'}`}
              >
                S
              </button>
              <button
                type="button"
                onClick={() => setSizePreset('md')}
                className={`rounded px-1 text-[8px] ${sizePreset === 'md' ? 'bg-yellow-500/25 text-yellow-300' : 'text-gray-300 hover:bg-white/10'}`}
              >
                M
              </button>
              <button
                type="button"
                onClick={() => setSizePreset('lg')}
                className={`rounded px-1 text-[8px] ${sizePreset === 'lg' ? 'bg-yellow-500/25 text-yellow-300' : 'text-gray-300 hover:bg-white/10'}`}
              >
                L
              </button>
              <label className="ml-1 flex cursor-pointer items-center gap-1 text-[8px] text-gray-300">
                <input
                  type="checkbox"
                  checked={showOrbit}
                  onChange={(e) => setShowOrbit(e.target.checked)}
                  className="h-2.5 w-2.5 accent-yellow-500"
                />
                Orbit
              </label>
              <label className="ml-1 flex cursor-pointer items-center gap-1 text-[8px] text-gray-300">
                <input
                  type="checkbox"
                  checked={transparent}
                  onChange={(e) => setTransparent(e.target.checked)}
                  className="h-2.5 w-2.5 accent-yellow-500"
                />
                Xray
              </label>
            </div>
          </div>
          <div className="px-1 pt-1">
            <div
              className="w-full rounded bg-slate-900/30"
              style={{ height: panelMetrics.canvasHeight }}
            >
              <canvas
                ref={canvasRef}
                className="h-full w-full cursor-grab rounded active:cursor-grabbing"
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
            </div>
          </div>
          <div className="px-2 py-1 text-[8px] text-gray-400">
            Step {currentTimeStep} | dX {relDx.toFixed(3)} dY {relDy.toFixed(3)} dZ{' '}
            {relDz.toFixed(3)}
          </div>
        </>
      )}
    </div>
  );
}
