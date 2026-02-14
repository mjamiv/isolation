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

export function DeformedShape() {
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);
  const showDeformed = useDisplayStore((s) => s.showDeformed);
  const scaleFactor = useDisplayStore((s) => s.scaleFactor);
  const showComparisonOverlay = useDisplayStore((s) => s.showComparisonOverlay);
  const results = useAnalysisStore((s) => s.results);
  const currentTimeStep = useAnalysisStore((s) => s.currentTimeStep);
  const comparisonFixedBase = useComparisonStore((s) => s.fixedBase);

  const displacements = useMemo(() => {
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
  }, [results, currentTimeStep]);

  const displacedNodes = useMemo(() => {
    if (!displacements) return null;
    const map = new Map<number, THREE.Vector3>();
    for (const [nodeId, node] of nodes) {
      const disp = displacements[nodeId];
      if (disp) {
        map.set(
          nodeId,
          new THREE.Vector3(
            node.x + disp[0] * scaleFactor,
            node.y + disp[1] * scaleFactor,
            node.z + disp[2] * scaleFactor,
          ),
        );
      } else {
        map.set(nodeId, new THREE.Vector3(node.x, node.y, node.z));
      }
    }
    return map;
  }, [nodes, displacements, scaleFactor]);

  // Fixed-base overlay displacements (from comparison results)
  const overlayDisplacedNodes = useMemo(() => {
    if (!showComparisonOverlay || !comparisonFixedBase) return null;

    const fbDisps = (
      comparisonFixedBase.pushoverResults as PushoverResults & {
        nodeDisplacements?: Record<string, number[]>;
      }
    ).nodeDisplacements;
    if (!fbDisps) return null;

    const map = new Map<number, THREE.Vector3>();
    for (const [nodeId, node] of nodes) {
      const disp = fbDisps[String(nodeId)];
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
          new THREE.Vector3(
            node.x + disp[0]! * scaleFactor,
            node.y + disp[1]! * scaleFactor,
            node.z,
          ),
        );
      } else {
        map.set(nodeId, new THREE.Vector3(node.x, node.y, node.z));
      }
    }
    return map;
  }, [nodes, showComparisonOverlay, comparisonFixedBase, scaleFactor]);

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

  return (
    <group>
      {/* Primary deformed members (gold - isolated / main) */}
      {elementArray.map((element) => {
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

      {/* Primary deformed node points */}
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
