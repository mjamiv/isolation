import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';

/**
 * Renders dashed lines between equalDOF retained/constrained node pairs
 * and between bearing nodeI/nodeJ pairs, showing the deck-to-cap connections.
 *
 * - EqualDOF: cyan lines (#67e8f9)
 * - Bearings: purple lines (#c084fc) — complements BearingSymbols
 */
export function ConstraintLinks() {
  const equalDofConstraints = useModelStore((s) => s.equalDofConstraints);
  const bearings = useModelStore((s) => s.bearings);
  const nodes = useModelStore((s) => s.nodes);
  const showConstraintLinks = useDisplayStore((s) => s.showConstraintLinks);

  const eqRef = useRef<THREE.LineSegments>(null);
  const brgRef = useRef<THREE.LineSegments>(null);

  const { eqGeo, brgGeo } = useMemo(() => {
    if (!showConstraintLinks) return { eqGeo: null, brgGeo: null };

    // EqualDOF constraint lines
    const eqPoints: number[] = [];
    for (const eq of equalDofConstraints.values()) {
      const retained = nodes.get(eq.retainedNodeId);
      const constrained = nodes.get(eq.constrainedNodeId);
      if (!retained || !constrained) continue;
      eqPoints.push(retained.x, retained.y, retained.z);
      eqPoints.push(constrained.x, constrained.y, constrained.z);
    }

    // Bearing node-pair lines
    const brgPoints: number[] = [];
    for (const b of bearings.values()) {
      const nI = nodes.get(b.nodeI);
      const nJ = nodes.get(b.nodeJ);
      if (!nI || !nJ) continue;
      brgPoints.push(nI.x, nI.y, nI.z);
      brgPoints.push(nJ.x, nJ.y, nJ.z);
    }

    const buildGeo = (points: number[]) => {
      if (points.length === 0) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      return geo;
    };

    return { eqGeo: buildGeo(eqPoints), brgGeo: buildGeo(brgPoints) };
  }, [equalDofConstraints, bearings, nodes, showConstraintLinks]);

  // Compute line distances for dashed material rendering
  useEffect(() => {
    if (eqRef.current) eqRef.current.computeLineDistances();
  }, [eqGeo]);
  useEffect(() => {
    if (brgRef.current) brgRef.current.computeLineDistances();
  }, [brgGeo]);

  if (!showConstraintLinks) return null;
  if (!eqGeo && !brgGeo) return null;

  return (
    <group>
      {eqGeo && (
        <lineSegments ref={eqRef} geometry={eqGeo}>
          <lineDashedMaterial color="#67e8f9" dashSize={6} gapSize={4} transparent opacity={0.8} />
        </lineSegments>
      )}
      {brgGeo && (
        <lineSegments ref={brgRef} geometry={brgGeo}>
          <lineDashedMaterial color="#c084fc" dashSize={6} gapSize={4} transparent opacity={0.8} />
        </lineSegments>
      )}
    </group>
  );
}
