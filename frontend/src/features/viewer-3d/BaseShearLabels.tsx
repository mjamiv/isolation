import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useModelBounds } from './useModelBounds';
import type { StaticResults, PushoverResults } from '@/types/analysis';

// ── Formatting ──────────────────────────────────────────────────────────

function formatShear(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  if (v >= 1) return v.toFixed(1);
  return v.toFixed(2);
}

// ── Color interpolation ─────────────────────────────────────────────────

const COLOR_LOW = new THREE.Color('#facc15'); // yellow-400
const COLOR_HIGH = new THREE.Color('#dc2626'); // red-600

function shearColor(ratio: number): THREE.Color {
  const c = new THREE.Color();
  c.lerpColors(COLOR_LOW, COLOR_HIGH, Math.min(ratio, 1));
  return c;
}

// ── Shared geometry constants ───────────────────────────────────────────

const SHAFT_SEGMENTS = 8;
const HEAD_SEGMENTS = 8;

// ── Arrow data type ─────────────────────────────────────────────────────

interface ArrowData {
  nodeId: number;
  x: number;
  y: number;
  z: number;
  /** Horizontal reaction component along the model's X-axis. */
  hx: number;
  /** Horizontal reaction component along the model's horizontal-Z (Y-up) or Y (Z-up) axis. */
  hz: number;
  shear: number;
}

// ── Single arrow sub-component ──────────────────────────────────────────

function ShearArrow({
  item,
  arrowLength,
  shaftRadius,
  headRadius,
  headLength,
  color,
  forceUnit,
}: {
  item: ArrowData;
  arrowLength: number;
  shaftRadius: number;
  headRadius: number;
  headLength: number;
  color: THREE.Color;
  forceUnit: string;
}) {
  const dirX = item.hx;
  const dirZ = item.hz;
  const mag = Math.sqrt(dirX * dirX + dirZ * dirZ);

  // Normalized horizontal direction
  const dir =
    mag > 1e-10 ? new THREE.Vector3(dirX / mag, 0, dirZ / mag) : new THREE.Vector3(1, 0, 0);

  // Quaternion: rotate from default Y-up to horizontal shear direction
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return q;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir.x, dir.y, dir.z]);

  const shaftLength = arrowLength - headLength;
  const hexColor = `#${color.getHexString()}`;

  return (
    <group position={[item.x, item.y, item.z]}>
      <group quaternion={quaternion}>
        {/* Shaft */}
        <mesh position={[0, shaftLength / 2, 0]}>
          <cylinderGeometry args={[shaftRadius, shaftRadius, shaftLength, SHAFT_SEGMENTS]} />
          <meshBasicMaterial color={color} />
        </mesh>
        {/* Cone head */}
        <mesh position={[0, shaftLength + headLength / 2, 0]}>
          <coneGeometry args={[headRadius, headLength, HEAD_SEGMENTS]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>

      {/* Value label below the arrow origin */}
      <Html position={[0, -shaftRadius * 5, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          className="whitespace-nowrap rounded-md px-2 py-1 text-center font-mono text-[11px] font-bold leading-tight shadow-lg shadow-black/40 ring-1"
          style={{
            backgroundColor: `${hexColor}22`,
            color: hexColor,
            borderColor: `${hexColor}66`,
            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          }}
        >
          V={formatShear(item.shear)} {forceUnit}
        </div>
      </Html>
    </group>
  );
}

// ── Shared hook: compute arrow data from reactions ──────────────────────

function useBaseShearData() {
  const nodes = useModelStore((s) => s.nodes);
  const bearings = useModelStore((s) => s.bearings);
  const model = useModelStore((s) => s.model);
  const showBaseShearLabels = useDisplayStore((s) => s.showBaseShearLabels);
  const analysisResults = useAnalysisStore((s) => s.results);

  return useMemo(() => {
    if (!showBaseShearLabels || !analysisResults || !model) return [];

    const inner = analysisResults.results;
    if (!inner) return [];

    let reactions: Record<number, [number, number, number, number, number, number]> | undefined;
    if (analysisResults.type === 'static') {
      reactions = (inner as StaticResults).reactions;
    } else if (analysisResults.type === 'pushover') {
      reactions = (inner as PushoverResults).reactions;
    }
    if (!reactions) return [];

    // Z-up models (with bearings) have reaction layout [Fx, Fy, Fz, ...]
    // where Fz is vertical. Y-up models have [Fx, Fy, Fz, ...] where Fy
    // is vertical.  Pick the two horizontal DOF indices accordingly.
    const isZUp = bearings.size > 0;
    const hIdx0 = 0; // Fx is always horizontal
    const hIdx1 = isZUp ? 1 : 2; // Fy (Z-up) or Fz (Y-up)

    // Collect fully-fixed base nodes: nodes where all three translational
    // DOFs are restrained.  This catches column bases (fixed models) AND
    // ground nodes below bearings (isolated models).
    const baseNodeIds = new Set<number>();
    for (const node of nodes.values()) {
      const r = node.restraint;
      if (r[0] && r[1] && r[2]) {
        baseNodeIds.add(node.id);
      }
    }

    const items: ArrowData[] = [];
    for (const [nodeIdStr, reaction] of Object.entries(reactions)) {
      const nodeId = Number(nodeIdStr);
      if (!baseNodeIds.has(nodeId)) continue;

      const node = nodes.get(nodeId);
      if (!node) continue;

      const hx = Array.isArray(reaction) ? (reaction[hIdx0] ?? 0) : 0;
      const hz = Array.isArray(reaction) ? (reaction[hIdx1] ?? 0) : 0;
      const shear = Math.sqrt(hx * hx + hz * hz);

      if (shear > 0.01) {
        items.push({ nodeId, x: node.x, y: node.y, z: node.z, hx, hz, shear });
      }
    }
    return items;
  }, [showBaseShearLabels, analysisResults, model, nodes, bearings]);
}

// ── 3D Arrows (renders inside Canvas) ───────────────────────────────────

export function BaseShearLabels() {
  const model = useModelStore((s) => s.model);
  const arrowData = useBaseShearData();
  const bounds = useModelBounds();

  const arrowSizing = useMemo(() => {
    if (arrowData.length === 0) return null;

    const maxShear = Math.max(...arrowData.map((d) => d.shear));

    // Arrow length: 8–25% of model max dimension, proportional to shear
    const baseLength = bounds.maxDimension * 0.08;
    const maxArrowLength = bounds.maxDimension * 0.25;
    const shaftRadius = bounds.maxDimension * 0.004;
    const headRadius = shaftRadius * 3;
    const headLength = headRadius * 2.5;

    return { maxShear, baseLength, maxArrowLength, shaftRadius, headRadius, headLength };
  }, [arrowData, bounds.maxDimension]);

  if (arrowData.length === 0 || !arrowSizing) return null;

  const units = model?.units ?? 'kip-in';
  const forceUnit = units.startsWith('kN') ? 'kN' : units.startsWith('lb') ? 'lb' : 'kip';

  return (
    <group>
      {arrowData.map((item) => {
        const ratio = item.shear / arrowSizing.maxShear;
        const arrowLength = Math.max(
          arrowSizing.baseLength,
          arrowSizing.baseLength + (arrowSizing.maxArrowLength - arrowSizing.baseLength) * ratio,
        );
        const color = shearColor(ratio);

        return (
          <ShearArrow
            key={`shear-${String(item.nodeId)}`}
            item={item}
            arrowLength={arrowLength}
            shaftRadius={arrowSizing.shaftRadius}
            headRadius={arrowSizing.headRadius}
            headLength={arrowSizing.headLength}
            color={color}
            forceUnit={forceUnit}
          />
        );
      })}
    </group>
  );
}

// ── Summary overlay (renders outside Canvas, in Viewer3D.tsx) ───────────

export function BaseShearSummary() {
  const model = useModelStore((s) => s.model);
  const arrowData = useBaseShearData();

  if (arrowData.length === 0) return null;

  const totalShear = arrowData.reduce((sum, d) => sum + d.shear, 0);
  const units = model?.units ?? 'kip-in';
  const forceUnit = units.startsWith('kN') ? 'kN' : units.startsWith('lb') ? 'lb' : 'kip';
  const count = arrowData.length;

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
      <div className="rounded-lg bg-gray-900/90 px-4 py-2 text-center shadow-xl ring-1 ring-red-500/30 backdrop-blur-sm">
        <div className="text-[10px] font-medium uppercase tracking-widest text-gray-400">
          Total Base Shear
        </div>
        <div className="text-lg font-bold tabular-nums text-red-400">
          V = {formatShear(totalShear)} {forceUnit}
        </div>
        <div className="text-[10px] text-gray-500">
          {count} column{count !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
