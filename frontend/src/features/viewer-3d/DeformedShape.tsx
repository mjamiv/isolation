import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useComparisonStore } from '@/stores/comparisonStore';
import type { StaticResults, TimeHistoryResults, PushoverResults } from '@/types/analysis';

const DEFORMED_COLOR = '#D4AF37'; // gold
const OVERLAY_COLOR = '#FACC15'; // yellow-400
const DEFORMED_OPACITY = 0.5;
const NODE_RADIUS = 2;
const NODE_SEGMENTS = 8;

/** Helper to build a displaced-node map from a displacement record. */
function buildDisplacedNodeMap(
  nodes: Map<number, { x: number; y: number; z: number }>,
  disps: Record<number | string, number[]> | null,
  scaleFactor: number,
): Map<number, THREE.Vector3> | null {
  if (!disps) return null;
  const map = new Map<number, THREE.Vector3>();
  for (const [nodeId, node] of nodes) {
    const disp = disps[nodeId] ?? disps[String(nodeId)];
    if (disp && disp.length >= 3) {
      map.set(
        nodeId,
        new THREE.Vector3(
          node.x + disp[0]! * scaleFactor,
          node.y + disp[1]! * scaleFactor,
          node.z + disp[2]! * scaleFactor,
        ),
      );
    } else if (disp && disp.length >= 2) {
      map.set(
        nodeId,
        new THREE.Vector3(node.x + disp[0]! * scaleFactor, node.y + disp[1]! * scaleFactor, node.z),
      );
    } else {
      map.set(nodeId, new THREE.Vector3(node.x, node.y, node.z));
    }
  }
  return map;
}

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
    () => buildDisplacedNodeMap(nodes, displacements, scaleFactor),
    [nodes, displacements, scaleFactor],
  );

  // Extract discretization data from current results
  const discretizationData = useMemo(() => {
    if (!results?.results) return null;
    const r = results.results as StaticResults | PushoverResults | TimeHistoryResults;
    if ('discretizationMap' in r && r.discretizationMap && r.internalNodeCoords) {
      return {
        map: r.discretizationMap,
        internalCoords: r.internalNodeCoords,
      };
    }
    return null;
  }, [results]);

  // Extended displaced node map: includes internal discretization nodes
  const extendedDisplacedNodes = useMemo(() => {
    if (!displacedNodes || !discretizationData || !displacements) return null;

    const extended = new Map(displacedNodes);
    const { internalCoords } = discretizationData;

    for (const [nodeIdStr, coords] of Object.entries(internalCoords)) {
      const nodeId = Number(nodeIdStr);
      if (extended.has(nodeId)) continue;
      if (!coords || coords.length < 2) continue;

      const baseX = coords[0]!;
      const baseY = coords[1]!;
      const baseZ = coords.length >= 3 ? coords[2]! : 0;

      // Look up displacement for this internal node
      const disp = displacements[nodeId] ?? displacements[String(nodeId) as unknown as number];
      if (disp && disp.length >= 3) {
        extended.set(
          nodeId,
          new THREE.Vector3(
            baseX + disp[0]! * scaleFactor,
            baseY + disp[1]! * scaleFactor,
            baseZ + disp[2]! * scaleFactor,
          ),
        );
      } else if (disp && disp.length >= 2) {
        extended.set(
          nodeId,
          new THREE.Vector3(baseX + disp[0]! * scaleFactor, baseY + disp[1]! * scaleFactor, baseZ),
        );
      } else {
        // No displacement data for internal node — use base position
        extended.set(nodeId, new THREE.Vector3(baseX, baseY, baseZ));
      }
    }

    return extended;
  }, [displacedNodes, discretizationData, displacements, scaleFactor]);

  // Overlay displacements (fixed-base variant)
  const overlayDisplacedNodes = useMemo(() => {
    if (!showComparisonOverlay || !comparisonFixedBase) return null;

    // Time-history comparison: animate fixed-base from TH step data
    if (comparisonType === 'time_history' && comparisonFixedBase.timeHistoryResults) {
      const thResults = comparisonFixedBase.timeHistoryResults;
      const step = thResults.timeSteps[currentTimeStep];
      return buildDisplacedNodeMap(nodes, step?.nodeDisplacements ?? null, scaleFactor);
    }

    // Pushover comparison: use static pushover displacements
    const fbDisps = (
      comparisonFixedBase.pushoverResults as PushoverResults & {
        nodeDisplacements?: Record<string, number[]>;
      }
    ).nodeDisplacements;

    return buildDisplacedNodeMap(nodes, fbDisps ?? null, scaleFactor);
  }, [
    nodes,
    showComparisonOverlay,
    comparisonFixedBase,
    comparisonType,
    currentTimeStep,
    scaleFactor,
  ]);

  const elementArray = useMemo(() => Array.from(elements.values()), [elements]);

  // Set of element IDs that have discretization data
  const discretizedElementIds = useMemo(() => {
    if (!discretizationData) return new Set<number>();
    return new Set(Object.keys(discretizationData.map).map(Number));
  }, [discretizationData]);

  const nodePositions = useMemo(() => {
    if (!displacedNodes) return [];
    return Array.from(displacedNodes.values());
  }, [displacedNodes]);

  const overlayNodePositions = useMemo(() => {
    if (!overlayDisplacedNodes) return [];
    return Array.from(overlayDisplacedNodes.values());
  }, [overlayDisplacedNodes]);

  if (!showDeformed || !displacedNodes) return null;

  // Choose the node map for primary rendering (extended if discretization available)
  const primaryNodeMap = extendedDisplacedNodes ?? displacedNodes;

  return (
    <group>
      {/* Primary deformed members (gold - isolated / main) */}
      {elementArray.map((element) => {
        // If this element has discretization data, render polyline through node chain
        if (discretizationData && discretizedElementIds.has(element.id)) {
          const entry = discretizationData.map[element.id];
          if (!entry) return null;
          const { nodeChain } = entry;
          const points: THREE.Vector3[] = [];
          for (const nid of nodeChain) {
            const pos = primaryNodeMap.get(nid);
            if (pos) points.push(pos);
          }
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
        }

        // Non-discretized element: single line
        const posI = displacedNodes.get(element.nodeI);
        const posJ = displacedNodes.get(element.nodeJ);
        if (!posI || !posJ) return null;

        return (
          <Line
            key={element.id}
            points={[posI, posJ]}
            color={DEFORMED_COLOR}
            lineWidth={2}
            transparent
            opacity={DEFORMED_OPACITY}
          />
        );
      })}

      {/* Primary deformed node points (only store nodes, not internal) */}
      {nodePositions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[NODE_RADIUS, NODE_SEGMENTS, NODE_SEGMENTS]} />
          <meshStandardMaterial color={DEFORMED_COLOR} transparent opacity={DEFORMED_OPACITY} />
        </mesh>
      ))}

      {/* Overlay deformed members (orange - fixed-base) */}
      {overlayDisplacedNodes &&
        elementArray.map((element) => {
          const posI = overlayDisplacedNodes.get(element.nodeI);
          const posJ = overlayDisplacedNodes.get(element.nodeJ);
          if (!posI || !posJ) return null;

          return (
            <Line
              key={`overlay-${element.id}`}
              points={[posI, posJ]}
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
