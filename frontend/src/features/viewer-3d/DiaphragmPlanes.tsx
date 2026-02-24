import { useMemo } from 'react';
import * as THREE from 'three';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';

/**
 * 2D convex hull via Graham scan on XZ coordinates.
 * Returns indices into the input array in CCW order.
 */
function convexHull2D(points: { x: number; z: number }[]): number[] {
  if (points.length < 3) return points.map((_, i) => i);

  // Find lowest-Z (then leftmost-X) point as pivot
  let pivot = 0;
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    const best = points[pivot]!;
    if (p.z < best.z || (p.z === best.z && p.x < best.x)) {
      pivot = i;
    }
  }

  const indices = points.map((_, i) => i).filter((i) => i !== pivot);
  const pv = points[pivot]!;

  // Sort by polar angle from pivot
  indices.sort((a, b) => {
    const pa = points[a]!;
    const pb = points[b]!;
    const angleA = Math.atan2(pa.z - pv.z, pa.x - pv.x);
    const angleB = Math.atan2(pb.z - pv.z, pb.x - pv.x);
    if (angleA !== angleB) return angleA - angleB;
    // Closer first for same angle
    const distA = (pa.x - pv.x) ** 2 + (pa.z - pv.z) ** 2;
    const distB = (pb.x - pv.x) ** 2 + (pb.z - pv.z) ** 2;
    return distA - distB;
  });

  const stack = [pivot, indices[0]!];
  for (let i = 1; i < indices.length; i++) {
    const idx = indices[i]!;
    while (stack.length > 1) {
      const top = points[stack[stack.length - 1]!]!;
      const sec = points[stack[stack.length - 2]!]!;
      const cur = points[idx]!;
      const cross = (top.x - sec.x) * (cur.z - sec.z) - (top.z - sec.z) * (cur.x - sec.x);
      if (cross > 0) break;
      stack.pop();
    }
    stack.push(idx);
  }

  return stack;
}

export function DiaphragmPlanes() {
  const diaphragms = useModelStore((s) => s.diaphragms);
  const nodes = useModelStore((s) => s.nodes);
  const showDiaphragms = useDisplayStore((s) => s.showDiaphragms);

  const meshes = useMemo(() => {
    if (!showDiaphragms || diaphragms.size === 0) return [];

    return Array.from(diaphragms.values())
      .map((d) => {
        // Collect all node positions (master + constrained)
        const allNodeIds = [d.masterNodeId, ...d.constrainedNodeIds];
        const positions: { x: number; y: number; z: number }[] = [];
        for (const nid of allNodeIds) {
          const node = nodes.get(nid);
          if (node) positions.push({ x: node.x, y: node.y, z: node.z });
        }

        if (positions.length < 3) return null;

        // Project to XZ plane for convex hull
        const xzPoints = positions.map((p) => ({ x: p.x, z: p.z }));
        const hullIndices = convexHull2D(xzPoints);

        if (hullIndices.length < 3) return null;

        // Average Y level for the diaphragm plane
        const avgY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;

        // Create shape from hull points in XZ plane
        const shape = new THREE.Shape();
        const first = positions[hullIndices[0]!]!;
        shape.moveTo(first.x, first.z);
        for (let i = 1; i < hullIndices.length; i++) {
          const pt = positions[hullIndices[i]!]!;
          shape.lineTo(pt.x, pt.z);
        }
        shape.closePath();

        const geometry = new THREE.ShapeGeometry(shape);
        // ShapeGeometry creates in XY — rotate to XZ (horizontal plane)
        geometry.rotateX(Math.PI / 2);
        geometry.translate(0, avgY, 0);

        // Edge geometry from hull vertices (no closing point — lineLoop auto-closes)
        const edgePoints: THREE.Vector3[] = [];
        for (let i = 0; i < hullIndices.length; i++) {
          const pt = positions[hullIndices[i]!]!;
          edgePoints.push(new THREE.Vector3(pt.x, avgY, pt.z));
        }
        const edgeGeometry = new THREE.BufferGeometry().setFromPoints(edgePoints);

        return { id: d.id, geometry, edgeGeometry };
      })
      .filter(Boolean) as {
      id: number;
      geometry: THREE.ShapeGeometry;
      edgeGeometry: THREE.BufferGeometry;
    }[];
  }, [diaphragms, nodes, showDiaphragms]);

  if (!showDiaphragms || meshes.length === 0) return null;

  return (
    <group>
      {meshes.map((m) => (
        <group key={m.id}>
          <mesh geometry={m.geometry}>
            <meshBasicMaterial
              color="#d4af37"
              transparent
              opacity={0.15}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <lineLoop geometry={m.edgeGeometry}>
            <lineBasicMaterial color="#d4af37" transparent opacity={0.6} />
          </lineLoop>
        </group>
      ))}
    </group>
  );
}
