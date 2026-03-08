import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useComparisonStore } from '@/stores/comparisonStore';
import { useDisplayStore } from '@/stores/displayStore';
import { useModelStore } from '@/stores/modelStore';
import type { TimeHistoryResults } from '@/types/analysis';
import type { BearingAssemblyPiece, BearingAssemblyPieceId } from './bearingAssemblyUi';
import {
  ASSEMBLY_LABEL_OFFSETS,
  buildBearingAssemblyPieces,
  clampPercent,
  createBearingAssemblyProjector,
  formatSignedValue,
  summarizeBearingAssembly,
} from './bearingAssemblyUi';
import { extractOrbitPoints } from './tfpKinematics';
import { toViewerTranslation, useActiveDisplacements } from './useActiveDisplacements';

interface AssemblyDrawParams {
  relDx: number;
  relDz: number;
  pieces: BearingAssemblyPiece[];
  fullOrbitPoints: [number, number, number][];
  orbitPoints: [number, number, number][];
  radius: number;
  viewZoom: number;
  viewPanX: number;
  viewPanY: number;
  viewYaw: number;
  viewPitch: number;
  showOrbit: boolean;
  highlightPieceId: BearingAssemblyPieceId | null;
}

type PanelSize = 'compact' | 'detail' | 'expanded';
type ViewPreset = 'iso' | 'front' | 'plan';

const PANEL_LAYOUTS: Record<PanelSize, { panelWidth: number; canvasHeight: number }> = {
  compact: { panelWidth: 300, canvasHeight: 200 },
  detail: { panelWidth: 388, canvasHeight: 252 },
  expanded: { panelWidth: 540, canvasHeight: 332 },
};

const VIEW_PRESETS: Record<ViewPreset, { label: string; yaw: number; pitch: number }> = {
  iso: { label: 'Iso', yaw: -Math.PI / 4, pitch: 0.62 },
  front: { label: 'Front', yaw: 0, pitch: 0.3 },
  plan: { label: 'Plan', yaw: -Math.PI / 4, pitch: 1.24 },
};

function drawAssembly(canvas: HTMLCanvasElement, params: AssemblyDrawParams) {
  const {
    relDx,
    relDz,
    pieces,
    fullOrbitPoints,
    orbitPoints,
    radius,
    viewZoom,
    viewPanX,
    viewPanY,
    viewYaw,
    viewPitch,
    showOrbit,
    highlightPieceId,
  } = params;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 220;
  const cssH = canvas.clientHeight || 160;
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const project = createBearingAssemblyProjector({
    cssW,
    cssH,
    relDx,
    relDz,
    radius,
    fullOrbitPoints,
    viewZoom,
    viewPanX,
    viewPanY,
    viewYaw,
    viewPitch,
  });

  const SEGS = 28;
  const lightDir = { x: 0.35, y: 0.65, z: -0.67 };
  const lightLen = Math.sqrt(lightDir.x ** 2 + lightDir.y ** 2 + lightDir.z ** 2);
  lightDir.x /= lightLen;
  lightDir.y /= lightLen;
  lightDir.z /= lightLen;

  const hasFocusedPiece = highlightPieceId != null;

  const shade = (base: string, nDotL: number): string => {
    const m = base.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) return base;
    const br = 0.45 + 0.55 * Math.max(0, nDotL);
    const rc = Math.min(255, Math.round(parseInt(m[1]!, 16) * br));
    const gc = Math.min(255, Math.round(parseInt(m[2]!, 16) * br));
    const bc = Math.min(255, Math.round(parseInt(m[3]!, 16) * br));
    return `rgb(${rc},${gc},${bc})`;
  };

  const drawPlate = (piece: BearingAssemblyPiece) => {
    const { x, y, z, r, h, fill, id } = piece;
    const isFocused = highlightPieceId === id;
    const alpha = hasFocusedPiece ? (isFocused ? 0.98 : 0.28) : 0.94;
    ctx.globalAlpha = alpha;

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

    if (isFocused) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  };

  const bgGradient = ctx.createLinearGradient(0, 0, cssW, cssH);
  bgGradient.addColorStop(0, '#09111f');
  bgGradient.addColorStop(1, '#020617');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, cssW, cssH);

  const glow = ctx.createRadialGradient(
    cssW * 0.34,
    cssH * 0.24,
    0,
    cssW * 0.34,
    cssH * 0.24,
    cssW,
  );
  glow.addColorStop(0, 'rgba(34,211,238,0.08)');
  glow.addColorStop(1, 'rgba(34,211,238,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, cssW, cssH);

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

  if (showOrbit && fullOrbitPoints.length > 1) {
    ctx.strokeStyle = hasFocusedPiece ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)';
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
    ctx.strokeStyle = 'rgba(34,211,238,0.88)';
    ctx.lineWidth =
      highlightPieceId === 'stage1Slider' || highlightPieceId === 'stage2Slider' ? 2.2 : 1.4;
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
    ctx.arc(cur.x, cur.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#22d3ee';
    ctx.fill();
  }

  const sortedPieces = [...pieces].sort(
    (a, b) => project(a.x, a.y, a.z).depth - project(b.x, b.y, b.z).depth,
  );
  for (const piece of sortedPieces) drawPlate(piece);

  ctx.globalAlpha = 1;
  ctx.font = '10px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(`dX ${relDx.toFixed(2)} in`, 10, cssH - 10);
  ctx.textAlign = 'right';
  ctx.fillText(`dZ ${relDz.toFixed(2)} in`, cssW - 10, cssH - 10);
  ctx.textAlign = 'left';
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
  const [showLegend, setShowLegend] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [panelSize, setPanelSize] = useState<PanelSize>('detail');
  const [viewZoom, setViewZoom] = useState(1);
  const [viewPan, setViewPan] = useState({ x: 0, y: 0 });
  const [viewYaw, setViewYaw] = useState(VIEW_PRESETS.iso.yaw);
  const [viewPitch, setViewPitch] = useState(VIEW_PRESETS.iso.pitch);
  const [focusedPieceId, setFocusedPieceId] = useState<BearingAssemblyPieceId | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });

  const layout = PANEL_LAYOUTS[panelSize];
  const canvasWidth = layout.panelWidth - 28;

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

  const pieces = useMemo(
    () =>
      buildBearingAssemblyPieces({
        relDx,
        relDy,
        relDz,
        stageCapacities,
        radius,
        gap,
        plateThickness,
      }),
    [relDx, relDy, relDz, stageCapacities, radius, gap, plateThickness],
  );

  const summary = useMemo(
    () => summarizeBearingAssembly(bearing, relDx, relDy, relDz, stageCapacities),
    [bearing, relDx, relDy, relDz, stageCapacities],
  );
  const stageRows = useMemo(
    () =>
      summary.stageTravel.map((travel, index) => ({
        index,
        travel,
        capacity: stageCapacities[index] ?? 0,
        utilization: summary.stageUtilization[index] ?? 0,
      })),
    [summary.stageTravel, summary.stageUtilization, stageCapacities],
  );

  const labelAnchors = useMemo(() => {
    if (!showLabels || panelSize === 'compact') return [];
    const project = createBearingAssemblyProjector({
      cssW: canvasWidth,
      cssH: layout.canvasHeight,
      relDx,
      relDz,
      radius,
      fullOrbitPoints,
      viewZoom,
      viewPanX: viewPan.x,
      viewPanY: viewPan.y,
      viewYaw,
      viewPitch,
    });

    return pieces.map((piece) => {
      const anchor = project(piece.x, piece.y + piece.h * 0.45, piece.z);
      const offset = ASSEMBLY_LABEL_OFFSETS[piece.id];
      return {
        ...piece,
        left: anchor.x + offset.x,
        top: anchor.y + offset.y,
      };
    });
  }, [
    showLabels,
    panelSize,
    canvasWidth,
    layout.canvasHeight,
    relDx,
    relDz,
    radius,
    fullOrbitPoints,
    viewZoom,
    viewPan.x,
    viewPan.y,
    viewYaw,
    viewPitch,
    pieces,
  ]);

  useEffect(() => {
    if (!showBearingDisplacement || !bearing || !nodeI || !nodeJ) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawAssembly(canvas, {
      relDx,
      relDz,
      pieces,
      fullOrbitPoints,
      orbitPoints,
      radius,
      viewZoom,
      viewPanX: viewPan.x,
      viewPanY: viewPan.y,
      viewYaw,
      viewPitch,
      showOrbit,
      highlightPieceId: focusedPieceId,
    });
  }, [
    relDx,
    relDz,
    pieces,
    fullOrbitPoints,
    orbitPoints,
    radius,
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
    focusedPieceId,
    panelSize,
  ]);

  if (!showBearingDisplacement || !bearing || !nodeI || !nodeJ) return null;

  const applyViewPreset = (preset: ViewPreset) => {
    setViewYaw(VIEW_PRESETS[preset].yaw);
    setViewPitch(VIEW_PRESETS[preset].pitch);
  };

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
    setViewYaw(VIEW_PRESETS.iso.yaw);
    setViewPitch(VIEW_PRESETS.iso.pitch);
    setFocusedPieceId(null);
  };

  return (
    <div
      className="bearing-assembly-panel viewer-overlay-card"
      data-size={panelSize}
      style={{ width: layout.panelWidth }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="viewer-overlay-header bearing-assembly-header">
        <div>
          <div className="viewer-overlay-kicker">Isolation Mechanism</div>
          <div className="viewer-overlay-title">Bearing Assembly</div>
          <div className="bearing-assembly-subtitle">
            <span>{bearing.label ?? `Brg ${bearing.id}`}</span>
            <span className="bearing-assembly-subtitle-dot" />
            <span>
              {selectedIdx + 1}/{bearingList.length}
            </span>
            <span className="bearing-assembly-subtitle-dot" />
            <span>{summary.engagedStage === 0 ? 'Centered' : `Stage ${summary.engagedStage}`}</span>
          </div>
        </div>
        <div className="viewer-overlay-stack">
          <div className="viewer-chip viewer-chip--muted">
            util {clampPercent(summary.totalUtilization)}
          </div>
          <button
            type="button"
            className="viewer-tool-button"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? 'Open' : 'Hide'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="viewer-overlay-body">
          <div className="viewer-overlay-toolbar bearing-assembly-toolbar">
            <div className="viewer-overlay-stack">
              {bearingList.length > 1 && (
                <>
                  <button
                    type="button"
                    className="viewer-tool-button"
                    aria-label="Previous bearing"
                    onClick={prevBearing}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    className="viewer-tool-button"
                    aria-label="Next bearing"
                    onClick={nextBearing}
                  >
                    Next
                  </button>
                </>
              )}
            </div>
            <div className="viewer-overlay-stack">
              {(['compact', 'detail', 'expanded'] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  className="viewer-tool-button"
                  data-active={panelSize === size}
                  aria-label={`Set ${size} panel size`}
                  onClick={() => setPanelSize(size)}
                >
                  {size === 'compact' ? 'S' : size === 'detail' ? 'M' : 'L'}
                </button>
              ))}
              <button type="button" className="viewer-tool-button" onClick={resetView}>
                Reset
              </button>
            </div>
          </div>

          <div className="bearing-assembly-control-row">
            <div className="viewer-overlay-stack">
              {(
                Object.entries(VIEW_PRESETS) as [
                  ViewPreset,
                  { label: string; yaw: number; pitch: number },
                ][]
              ).map(([preset, config]) => (
                <button
                  key={preset}
                  type="button"
                  className="viewer-tool-button"
                  data-active={
                    Math.abs(viewYaw - config.yaw) < 0.08 &&
                    Math.abs(viewPitch - config.pitch) < 0.08
                  }
                  onClick={() => applyViewPreset(preset)}
                >
                  {config.label}
                </button>
              ))}
            </div>
            <div className="viewer-overlay-stack">
              <button
                type="button"
                className="viewer-tool-button"
                data-active={showOrbit}
                onClick={() => setShowOrbit((v) => !v)}
              >
                Orbit
              </button>
              <button
                type="button"
                className="viewer-tool-button"
                data-active={showLabels}
                onClick={() => setShowLabels((v) => !v)}
              >
                Labels
              </button>
              {panelSize !== 'compact' && (
                <button
                  type="button"
                  className="viewer-tool-button"
                  data-active={showLegend}
                  onClick={() => setShowLegend((v) => !v)}
                >
                  Legend
                </button>
              )}
            </div>
          </div>

          <div className="bearing-assembly-canvas-shell">
            <div className="bearing-assembly-canvas-frame" style={{ height: layout.canvasHeight }}>
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

              {showLabels && panelSize !== 'compact' && (
                <div className="bearing-assembly-label-layer">
                  {labelAnchors.map((piece) => (
                    <button
                      key={piece.id}
                      type="button"
                      className="bearing-assembly-callout"
                      data-active={focusedPieceId === piece.id}
                      style={{ left: piece.left, top: piece.top }}
                      onMouseEnter={() => setFocusedPieceId(piece.id)}
                      onMouseLeave={() => setFocusedPieceId(null)}
                    >
                      <span
                        className="bearing-assembly-callout-badge"
                        style={{ backgroundColor: piece.fill }}
                      >
                        {piece.badge}
                      </span>
                      <span className="bearing-assembly-callout-label">{piece.label}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="bearing-assembly-canvas-hint">
                Drag rotate. Hold Shift to pan. Scroll to zoom.
              </div>
            </div>
          </div>

          <div className="bearing-assembly-stat-grid">
            <div className="bearing-assembly-stat-card">
              <span className="bearing-assembly-stat-label">Plan travel</span>
              <strong>{summary.totalPlanDisp.toFixed(2)} in</strong>
            </div>
            <div className="bearing-assembly-stat-card">
              <span className="bearing-assembly-stat-label">Vertical offset</span>
              <strong>{formatSignedValue(summary.totalVerticalDisp)} in</strong>
            </div>
            <div className="bearing-assembly-stat-card">
              <span className="bearing-assembly-stat-label">Tracked capacity</span>
              <strong>{summary.totalCapacity.toFixed(2)} in</strong>
            </div>
            <div className="bearing-assembly-stat-card">
              <span className="bearing-assembly-stat-label">Current state</span>
              <strong>
                {summary.engagedStage === 0 ? 'Centered' : `Stage ${summary.engagedStage}`}
              </strong>
            </div>
          </div>

          {panelSize !== 'compact' && (
            <>
              <div className="viewer-overlay-section">
                <div className="bearing-assembly-section-title">Stage Travel</div>
                <div className="bearing-assembly-stage-list">
                  {stageRows.map((row) => (
                    <div key={row.index} className="bearing-assembly-stage-row">
                      <div className="bearing-assembly-stage-head">
                        <span>Stage {row.index + 1}</span>
                        <span>
                          {row.travel.toFixed(2)} / {row.capacity.toFixed(2)} in
                        </span>
                      </div>
                      <div className="bearing-assembly-stage-track">
                        <div
                          className="bearing-assembly-stage-fill"
                          style={{ width: clampPercent(row.utilization) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {summary.overflow > 0 && (
                  <div className="bearing-assembly-overflow-note">
                    Rendered travel exceeds tracked capacity by {summary.overflow.toFixed(2)} in.
                  </div>
                )}
              </div>

              <div className="viewer-overlay-section">
                <div className="bearing-assembly-section-title">Bearing Data</div>
                <div className="bearing-assembly-data-grid">
                  <div className="bearing-assembly-data-item">
                    <span>Nodes</span>
                    <strong>
                      {bearing.nodeI} → {bearing.nodeJ}
                    </strong>
                  </div>
                  <div className="bearing-assembly-data-item">
                    <span>Radii</span>
                    <strong>{bearing.radii.map((value) => value.toFixed(1)).join(' / ')}</strong>
                  </div>
                  <div className="bearing-assembly-data-item">
                    <span>Capacities</span>
                    <strong>
                      {bearing.dispCapacities.map((value) => value.toFixed(1)).join(' / ')}
                    </strong>
                  </div>
                  <div className="bearing-assembly-data-item">
                    <span>Weight</span>
                    <strong>{bearing.weight.toFixed(1)}</strong>
                  </div>
                  <div className="bearing-assembly-data-item">
                    <span>Yield disp</span>
                    <strong>{bearing.yieldDisp.toFixed(3)}</strong>
                  </div>
                  <div className="bearing-assembly-data-item">
                    <span>Vertical scale</span>
                    <strong>{bearingVerticalScale.toFixed(2)}x</strong>
                  </div>
                </div>
              </div>

              {showLegend && (
                <div className="viewer-overlay-section">
                  <div className="bearing-assembly-section-title">Legend</div>
                  <div className="bearing-assembly-legend">
                    {pieces.map((piece) => (
                      <button
                        key={piece.id}
                        type="button"
                        className="bearing-assembly-legend-item"
                        data-active={focusedPieceId === piece.id}
                        onMouseEnter={() => setFocusedPieceId(piece.id)}
                        onMouseLeave={() => setFocusedPieceId(null)}
                      >
                        <span className="bearing-assembly-legend-index">{piece.badge}</span>
                        <span
                          className="bearing-assembly-legend-swatch"
                          style={{ backgroundColor: piece.fill }}
                        />
                        <span className="bearing-assembly-legend-copy">
                          <strong>{piece.label}</strong>
                          <span>{piece.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="viewer-overlay-footer">
            <span>{summary.engagedStageLabel}</span>
            <span className="viewer-overlay-metric">
              dX {formatSignedValue(relDx)} | dY {formatSignedValue(relDy)} | dZ{' '}
              {formatSignedValue(relDz)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
