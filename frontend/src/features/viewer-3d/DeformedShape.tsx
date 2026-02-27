import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useComparisonStore } from '@/stores/comparisonStore';
import type { StaticResults, TimeHistoryResults, PushoverResults } from '@/types/analysis';

const DEFORMED_COLOR = '#22d3ee'; // cyan-400
const OVERLAY_COLOR = '#f97316'; // orange-500
const DEFORMED_OPACITY = 0.7;
const NODE_RADIUS = 2;
const NODE_SEGMENTS = 8;

/** Number of interpolation segments per member for smooth curves. */
const CURVE_SEGMENTS = 12;

interface DiscretizationData {
  map: Record<number, { nodeChain: number[]; subElementIds: number[] }>;
  internalCoords: Record<number, number[]>;
}

// ---------------------------------------------------------------------------
// Hermite beam shape functions
// ---------------------------------------------------------------------------

/**
 * Hermite shape function N2(ξ) = ξ·(1−ξ)² — controls rotation at I end.
 * This produces the cubic curvature contribution from the I-end rotation.
 */
function hN2(xi: number): number {
  return xi * (1 - xi) * (1 - xi);
}

/**
 * Hermite shape function N4(ξ) = ξ²·(ξ−1) — controls rotation at J end.
 * This produces the cubic curvature contribution from the J-end rotation.
 */
function hN4(xi: number): number {
  return xi * xi * (xi - 1);
}

/**
 * Compute the in-plane normal for a member axis.
 * For 2D frames (Z≈0), returns the 90° rotation in-plane: (−ay, ax, 0).
 * For 3D frames, uses cross product with a reference up vector.
 */
function memberNormal(pI: THREE.Vector3, pJ: THREE.Vector3): THREE.Vector3 {
  const axis = new THREE.Vector3().subVectors(pJ, pI).normalize();

  // 2D frame: both nodes near Z=0 → use in-plane normal
  if (Math.abs(pI.z) < 1e-3 && Math.abs(pJ.z) < 1e-3) {
    return new THREE.Vector3(-axis.y, axis.x, 0).normalize();
  }

  // 3D: cross with up vector, avoiding singularity for vertical members
  let up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(axis.dot(up)) > 0.9) {
    up = new THREE.Vector3(1, 0, 0);
  }
  return new THREE.Vector3().crossVectors(axis, up).normalize();
}

/**
 * Generate a smooth cubic curve along a deformed member using Hermite
 * beam interpolation.
 *
 * The deformed endpoints define the chord, and the rotational DOFs
 * at each end add the cubic curvature that shows how the member
 * actually bends (double curvature for columns, single curvature
 * for beams, etc.).
 *
 * Math: P(ξ) = lerp(pI_def, pJ_def, ξ) + v_extra(ξ)·normal
 *   where v_extra(ξ) = [N2(ξ)·θI + N4(ξ)·θJ] · L · scaleFactor
 */
function memberCurve(
  pIDef: THREE.Vector3,
  pJDef: THREE.Vector3,
  pIOrig: THREE.Vector3,
  pJOrig: THREE.Vector3,
  rotI: number,
  rotJ: number,
  sf: number,
  segments: number,
): THREE.Vector3[] {
  const L = pIOrig.distanceTo(pJOrig);
  if (L < 1e-9) return [pIDef.clone(), pJDef.clone()];

  const normal = memberNormal(pIOrig, pJOrig);
  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const xi = i / segments;

    // Cubic deviation from chord due to end rotations
    const vExtra = (hN2(xi) * rotI + hN4(xi) * rotJ) * L * sf;

    points.push(
      new THREE.Vector3(
        pIDef.x + xi * (pJDef.x - pIDef.x) + vExtra * normal.x,
        pIDef.y + xi * (pJDef.y - pIDef.y) + vExtra * normal.y,
        pIDef.z + xi * (pJDef.z - pIDef.z) + vExtra * normal.z,
      ),
    );
  }

  return points;
}

// ---------------------------------------------------------------------------
// Displaced-node map builder
// ---------------------------------------------------------------------------

/**
 * Build a displaced-node map from a displacement record.
 *
 * For 2D frames (ndf=3), disp = [dx, dy, rz, 0, 0, 0] — only dx and dy
 * are positional displacements; rz is a rotation and must NOT be applied
 * to the Z coordinate.
 *
 * For 3D frames (ndf=6), disp = [dx, dy, dz, rx, ry, rz] — all three
 * translational components are applied.
 */
function buildDisplacedNodeMap(
  nodes: Map<number, { x: number; y: number; z: number }>,
  disps: Record<number | string, number[]> | null,
  scaleFactor: number,
  is2DFrame: boolean,
  internalNodeCoords: Record<number, number[]> | null = null,
  includeInternalNodes = false,
  zUpData = false,
): Map<number, THREE.Vector3> | null {
  if (!disps) return null;
  const map = new Map<number, THREE.Vector3>();

  const displacedPoint = (x: number, y: number, z: number, nodeId: number): THREE.Vector3 => {
    const disp = disps[nodeId] ?? disps[String(nodeId)];
    if (disp && disp.length >= 2) {
      const dx = (disp[0] ?? 0) * scaleFactor;
      // Convert solver Z-up translational components back to viewer Y-up.
      const dyRaw = zUpData ? (disp[2] ?? 0) : (disp[1] ?? 0);
      const dzRaw = zUpData ? (disp[1] ?? 0) : (disp[2] ?? 0);
      const dy = dyRaw * scaleFactor;
      // For 2D frames, disp[2] is rz (rotation) — don't add to Z position.
      const dz = !is2DFrame && disp.length >= 3 ? dzRaw * scaleFactor : 0;
      return new THREE.Vector3(x + dx, y + dy, z + dz);
    }
    return new THREE.Vector3(x, y, z);
  };

  for (const [nodeId, node] of nodes) {
    map.set(nodeId, displacedPoint(node.x, node.y, node.z, nodeId));
  }

  if (includeInternalNodes && internalNodeCoords) {
    for (const [rawNodeId, coords] of Object.entries(internalNodeCoords)) {
      const nodeId = Number(rawNodeId);
      if (!Number.isFinite(nodeId) || map.has(nodeId) || coords.length < 2) continue;
      const x = coords[0] ?? 0;
      const y = zUpData ? (coords[2] ?? 0) : (coords[1] ?? 0);
      const z = zUpData ? (coords[1] ?? 0) : (coords[2] ?? 0);
      map.set(nodeId, displacedPoint(x, y, z, nodeId));
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// DeformedShape component
// ---------------------------------------------------------------------------

export function DeformedShape() {
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);
  const showDeformed = useDisplayStore((s) => s.showDeformed);
  const scaleFactor = useDisplayStore((s) => s.scaleFactor);
  const showComparisonOverlay = useDisplayStore((s) => s.showComparisonOverlay);
  const results = useAnalysisStore((s) => s.results);
  const currentTimeStep = useAnalysisStore((s) => s.currentTimeStep);
  const comparisonFixedBase = useComparisonStore((s) => s.fixedBase);
  const comparisonIsolated = useComparisonStore((s) => s.isolated);
  const comparisonType = useComparisonStore((s) => s.comparisonType);
  const hasBearings = useModelStore((s) => s.bearings.size > 0);

  const primaryDiscretization = useMemo((): DiscretizationData | null => {
    if (comparisonType === 'time_history' && comparisonIsolated?.timeHistoryResults) {
      const r = comparisonIsolated.timeHistoryResults;
      if (r.discretizationMap && r.internalNodeCoords) {
        return { map: r.discretizationMap, internalCoords: r.internalNodeCoords };
      }
      return null;
    }

    if (!results?.results) return null;
    if (
      results.type === 'static' ||
      results.type === 'pushover' ||
      results.type === 'time_history'
    ) {
      const r = results.results as StaticResults | PushoverResults | TimeHistoryResults;
      if (r.discretizationMap && r.internalNodeCoords) {
        return { map: r.discretizationMap, internalCoords: r.internalNodeCoords };
      }
    }
    return null;
  }, [results, comparisonType, comparisonIsolated]);

  // Detect 2D frame: all nodes have Z ≈ 0
  const is2D = useMemo(() => {
    for (const node of nodes.values()) {
      if (Math.abs(node.z) > 1e-3) return false;
    }
    return true;
  }, [nodes]);

  // Primary displacements: prefer comparison TH isolated data when active
  const displacements = useMemo(() => {
    // Time-history comparison: use isolated variant's TH step data
    if (comparisonType === 'time_history' && comparisonIsolated?.timeHistoryResults) {
      const thResults = comparisonIsolated.timeHistoryResults;
      const step = thResults.timeSteps[currentTimeStep];
      return step?.nodeDisplacements ?? null;
    }

    if (!results?.results) return null;

    if (results.type === 'static') {
      return (results.results as StaticResults).nodeDisplacements;
    }

    if (results.type === 'time_history') {
      const thResults = results.results as TimeHistoryResults;
      const step = thResults.timeSteps[currentTimeStep];
      return step?.nodeDisplacements ?? null;
    }

    if (results.type === 'pushover') {
      return (
        (
          results.results as PushoverResults & {
            nodeDisplacements?: Record<number, [number, number, number, number, number, number]>;
          }
        ).nodeDisplacements ?? null
      );
    }

    return null;
  }, [results, currentTimeStep, comparisonType, comparisonIsolated]);

  const displacedNodes = useMemo(
    () => buildDisplacedNodeMap(nodes, displacements, scaleFactor, is2D, null, false, hasBearings),
    [nodes, displacements, scaleFactor, is2D, hasBearings],
  );
  const displacedNodesForLines = useMemo(
    () =>
      buildDisplacedNodeMap(
        nodes,
        displacements,
        scaleFactor,
        is2D,
        primaryDiscretization?.internalCoords ?? null,
        true,
        hasBearings,
      ),
    [nodes, displacements, scaleFactor, is2D, primaryDiscretization, hasBearings],
  );

  // Overlay displacements (fixed-base variant)
  const overlayDisplacedNodes = useMemo(() => {
    if (!showComparisonOverlay || !comparisonFixedBase) return null;

    // Time-history comparison: animate fixed-base from TH step data
    if (comparisonType === 'time_history' && comparisonFixedBase.timeHistoryResults) {
      const thResults = comparisonFixedBase.timeHistoryResults;
      const step = thResults.timeSteps[currentTimeStep];
      return buildDisplacedNodeMap(
        nodes,
        step?.nodeDisplacements ?? null,
        scaleFactor,
        is2D,
        null,
        false,
        hasBearings,
      );
    }

    // Pushover comparison: use static pushover displacements
    const fbDisps = (
      comparisonFixedBase.pushoverResults as
        | (PushoverResults & {
            nodeDisplacements?: Record<string, number[]>;
          })
        | null
        | undefined
    )?.nodeDisplacements;

    return buildDisplacedNodeMap(
      nodes,
      fbDisps ?? null,
      scaleFactor,
      is2D,
      null,
      false,
      hasBearings,
    );
  }, [
    nodes,
    showComparisonOverlay,
    comparisonFixedBase,
    comparisonType,
    currentTimeStep,
    scaleFactor,
    is2D,
    hasBearings,
  ]);
  const overlayDiscretization = useMemo((): DiscretizationData | null => {
    if (!showComparisonOverlay || !comparisonFixedBase) return null;
    if (comparisonType === 'time_history' && comparisonFixedBase.timeHistoryResults) {
      const r = comparisonFixedBase.timeHistoryResults;
      if (r.discretizationMap && r.internalNodeCoords) {
        return { map: r.discretizationMap, internalCoords: r.internalNodeCoords };
      }
      return null;
    }
    const r = comparisonFixedBase.pushoverResults;
    if (r?.discretizationMap && r.internalNodeCoords) {
      return { map: r.discretizationMap, internalCoords: r.internalNodeCoords };
    }
    return null;
  }, [showComparisonOverlay, comparisonFixedBase, comparisonType]);

  // Overlay displacements raw record (for rotation DOFs)
  const overlayDisplacements = useMemo(() => {
    if (!showComparisonOverlay || !comparisonFixedBase) return null;
    if (comparisonType === 'time_history' && comparisonFixedBase.timeHistoryResults) {
      const thResults = comparisonFixedBase.timeHistoryResults;
      const step = thResults.timeSteps[currentTimeStep];
      return step?.nodeDisplacements ?? null;
    }
    const fbDisps = (
      comparisonFixedBase.pushoverResults as
        | (PushoverResults & {
            nodeDisplacements?: Record<string, number[]>;
          })
        | null
        | undefined
    )?.nodeDisplacements;
    return fbDisps ?? null;
  }, [showComparisonOverlay, comparisonFixedBase, comparisonType, currentTimeStep]);
  const overlayDisplacedNodesForLines = useMemo(
    () =>
      buildDisplacedNodeMap(
        nodes,
        overlayDisplacements,
        scaleFactor,
        is2D,
        overlayDiscretization?.internalCoords ?? null,
        true,
        hasBearings,
      ),
    [nodes, overlayDisplacements, scaleFactor, is2D, overlayDiscretization, hasBearings],
  );

  const elementArray = useMemo(() => Array.from(elements.values()), [elements]);

  const nodePositions = useMemo(() => {
    if (!displacedNodes) return [];
    return Array.from(displacedNodes.values());
  }, [displacedNodes]);

  const overlayNodePositions = useMemo(() => {
    if (!overlayDisplacedNodes) return [];
    return Array.from(overlayDisplacedNodes.values());
  }, [overlayDisplacedNodes]);

  if (!showDeformed || !displacedNodes) return null;

  /**
   * Extract rotation for Hermite interpolation.
   * 2D (ndf=3): disp = [dx, dy, rz, 0, 0, 0] → rotation is disp[2]
   * 3D (ndf=6): disp = [dx, dy, dz, rx, ry, rz] → rotation about Z is disp[5]
   *
   * For 3D members, ideally we'd pick the rotation in the member's bending
   * plane, but rz is a reasonable default for most practical frames.
   */
  const getRotation = (
    dispRecord: Record<number | string, number[]> | null,
    nodeId: number,
  ): number => {
    if (!dispRecord) return 0;
    const disp = dispRecord[nodeId] ?? dispRecord[String(nodeId)];
    if (!disp) return 0;
    return is2D ? (disp[2] ?? 0) : (disp[5] ?? 0);
  };

  return (
    <group>
      {/* Primary deformed members — smooth cubic Hermite curves (gold) */}
      {elementArray.map((element) => {
        const lineNodes = displacedNodesForLines ?? displacedNodes;
        const posI = lineNodes?.get(element.nodeI);
        const posJ = lineNodes?.get(element.nodeJ);
        if (!posI || !posJ) return null;

        const origI = nodes.get(element.nodeI);
        const origJ = nodes.get(element.nodeJ);
        if (!origI || !origJ) return null;

        const rotI = getRotation(displacements, element.nodeI);
        const rotJ = getRotation(displacements, element.nodeJ);

        const pIOrig = new THREE.Vector3(origI.x, origI.y, origI.z);
        const pJOrig = new THREE.Vector3(origJ.x, origJ.y, origJ.z);

        const discEntry = primaryDiscretization?.map[element.id];
        const points =
          discEntry && discEntry.nodeChain.length >= 2 && lineNodes
            ? discEntry.nodeChain
                .map((nodeId) => lineNodes.get(nodeId))
                .filter((p): p is THREE.Vector3 => Boolean(p))
            : memberCurve(posI, posJ, pIOrig, pJOrig, rotI, rotJ, scaleFactor, CURVE_SEGMENTS);
        if (points.length < 2) return null;

        return (
          <Line
            key={element.id}
            points={points}
            color={DEFORMED_COLOR}
            lineWidth={2}
            transparent
            opacity={DEFORMED_OPACITY}
          />
        );
      })}

      {/* Primary deformed node points */}
      {nodePositions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[NODE_RADIUS, NODE_SEGMENTS, NODE_SEGMENTS]} />
          <meshStandardMaterial color={DEFORMED_COLOR} transparent opacity={DEFORMED_OPACITY} />
        </mesh>
      ))}

      {/* Overlay deformed members — smooth cubic Hermite curves (yellow) */}
      {overlayDisplacedNodes &&
        elementArray.map((element) => {
          const lineNodes = overlayDisplacedNodesForLines ?? overlayDisplacedNodes;
          const posI = lineNodes?.get(element.nodeI);
          const posJ = lineNodes?.get(element.nodeJ);
          if (!posI || !posJ) return null;

          const origI = nodes.get(element.nodeI);
          const origJ = nodes.get(element.nodeJ);
          if (!origI || !origJ) return null;

          const rotI = getRotation(overlayDisplacements, element.nodeI);
          const rotJ = getRotation(overlayDisplacements, element.nodeJ);

          const pIOrig = new THREE.Vector3(origI.x, origI.y, origI.z);
          const pJOrig = new THREE.Vector3(origJ.x, origJ.y, origJ.z);

          const discEntry = overlayDiscretization?.map[element.id];
          const points =
            discEntry && discEntry.nodeChain.length >= 2 && lineNodes
              ? discEntry.nodeChain
                  .map((nodeId) => lineNodes.get(nodeId))
                  .filter((p): p is THREE.Vector3 => Boolean(p))
              : memberCurve(posI, posJ, pIOrig, pJOrig, rotI, rotJ, scaleFactor, CURVE_SEGMENTS);
          if (points.length < 2) return null;

          return (
            <Line
              key={`overlay-${element.id}`}
              points={points}
              color={OVERLAY_COLOR}
              lineWidth={2}
              transparent
              opacity={DEFORMED_OPACITY}
            />
          );
        })}

      {/* Overlay deformed node points */}
      {overlayNodePositions.map((pos, i) => (
        <mesh key={`overlay-node-${i}`} position={pos}>
          <sphereGeometry args={[NODE_RADIUS, NODE_SEGMENTS, NODE_SEGMENTS]} />
          <meshStandardMaterial color={OVERLAY_COLOR} transparent opacity={DEFORMED_OPACITY} />
        </mesh>
      ))}
    </group>
  );
}
