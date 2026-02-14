import { useMemo } from 'react';
import * as THREE from 'three';
import { useModelStore } from '@/stores/modelStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import type { PerformanceLevel } from '@/types/analysis';

const HINGE_RADIUS = 4; // model units (inches)
const HINGE_SEGMENTS = 12;

const HINGE_COLORS: Record<PerformanceLevel, string> = {
  elastic: '#9ca3af',
  yield: '#FACC15',
  IO: '#D4AF37',
  LS: '#f97316',
  CP: '#ef4444',
  beyondCP: '#991b1b',
  collapse: '#171717',
};

interface HingeData {
  id: string;
  position: THREE.Vector3;
  color: string;
}

export function PlasticHinges() {
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);
  const results = useAnalysisStore((s) => s.results);

  const hinges = useMemo((): HingeData[] => {
    if (!results?.hingeStates || results.hingeStates.length === 0) return [];

    const hingeData: HingeData[] = [];

    for (const hinge of results.hingeStates) {
      const element = elements.get(hinge.elementId);
      if (!element) continue;

      const nodeId = hinge.end === 'i' ? element.nodeI : element.nodeJ;
      const node = nodes.get(nodeId);
      if (!node) continue;

      hingeData.push({
        id: `${hinge.elementId}-${hinge.end}`,
        position: new THREE.Vector3(node.x, node.y, node.z),
        color: HINGE_COLORS[hinge.performanceLevel],
      });
    }

    return hingeData;
  }, [results, elements, nodes]);

  if (hinges.length === 0) return null;

  return (
    <group>
      {hinges.map((hinge) => (
        <mesh key={hinge.id} position={hinge.position}>
          <sphereGeometry args={[HINGE_RADIUS, HINGE_SEGMENTS, HINGE_SEGMENTS]} />
          <meshStandardMaterial
            color={hinge.color}
            emissive={hinge.color}
            emissiveIntensity={0.4}
          />
        </mesh>
      ))}
    </group>
  );
}
