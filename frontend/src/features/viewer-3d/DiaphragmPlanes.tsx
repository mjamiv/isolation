import { useMemo } from 'react';
import * as THREE from 'three';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';
import { useModelBounds } from './useModelBounds';

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

/**
 * Build individual rectangular panels between each pair of adjacent
 * collinear diaphragm nodes (e.g., cross-frames between bridge girders).
 * Each panel spans from node[i] to node[i+1], inflated perpendicular
 * to the line direction by `halfWidth`.
 */
function buildCollinearPanels(
  positions: { x: number; y: number; z: number }[],
  halfWidth: number,
): { geometry: THREE.BufferGeometry; edgeGeometry: THREE.BufferGeometry } | null {
  if (positions.length < 2) return null;

  // Find the two extreme points to determine the line direction
  let bestDist = 0;
  let iA = 0;
  let iB = 1;
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dx = positions[j]!.x - positions[i]!.x;
      const dz = positions[j]!.z - positions[i]!.z;
      const d = dx * dx + dz * dz;
      if (d > bestDist) {
        bestDist = d;
        iA = i;
        iB = j;
      }
    }
  }

  const pA = positions[iA]!;
  const pB = positions[iB]!;
  const dx = pB.x - pA.x;
  const dz = pB.z - pA.z;
  const lineLen = Math.sqrt(dx * dx + dz * dz);
  if (lineLen < 1e-6) return null;

  // Line direction and perpendicular normal
  const dirX = dx / lineLen;
  const dirZ = dz / lineLen;
  const nx = -dirZ;
  const nz = dirX;

  // Sort positions along the line direction
  const sorted = [...positions].sort((a, b) => {
    const projA = (a.x - pA.x) * dirX + (a.z - pA.z) * dirZ;
    const projB = (b.x - pA.x) * dirX + (b.z - pA.z) * dirZ;
    return projA - projB;
  });

  const avgY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
  const numPanels = sorted.length - 1;

  // Build combined geometry: 4 verts per panel, 2 triangles per panel
  const verts = new Float32Array(numPanels * 4 * 3);
  const panelIndices: number[] = [];
  const edgePoints: THREE.Vector3[] = [];

  for (let i = 0; i < numPanels; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    const baseIdx = i * 4;

    // Four corners of this panel
    const c0x = a.x + nx * halfWidth;
    const c0z = a.z + nz * halfWidth;
    const c1x = b.x + nx * halfWidth;
    const c1z = b.z + nz * halfWidth;
    const c2x = b.x - nx * halfWidth;
    const c2z = b.z - nz * halfWidth;
    const c3x = a.x - nx * halfWidth;
    const c3z = a.z - nz * halfWidth;

    // Vertices
    verts[(baseIdx + 0) * 3] = c0x;
    verts[(baseIdx + 0) * 3 + 1] = avgY;
    verts[(baseIdx + 0) * 3 + 2] = c0z;
    verts[(baseIdx + 1) * 3] = c1x;
    verts[(baseIdx + 1) * 3 + 1] = avgY;
    verts[(baseIdx + 1) * 3 + 2] = c1z;
    verts[(baseIdx + 2) * 3] = c2x;
    verts[(baseIdx + 2) * 3 + 1] = avgY;
    verts[(baseIdx + 2) * 3 + 2] = c2z;
    verts[(baseIdx + 3) * 3] = c3x;
    verts[(baseIdx + 3) * 3 + 1] = avgY;
    verts[(baseIdx + 3) * 3 + 2] = c3z;

    // Two triangles for this quad
    panelIndices.push(baseIdx, baseIdx + 1, baseIdx + 2);
    panelIndices.push(baseIdx, baseIdx + 2, baseIdx + 3);

    // Edge outline for this panel (closed rectangle)
    edgePoints.push(
      new THREE.Vector3(c0x, avgY, c0z),
      new THREE.Vector3(c1x, avgY, c1z),
      new THREE.Vector3(c2x, avgY, c2z),
      new THREE.Vector3(c3x, avgY, c3z),
      new THREE.Vector3(c0x, avgY, c0z), // close the loop
    );
    // Separator (NaN break) so lineSegments can draw separate rectangles
    if (i < numPanels - 1) {
      edgePoints.push(new THREE.Vector3(NaN, NaN, NaN));
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geometry.setIndex(panelIndices);

  // Edge geometry: use line segments (pairs of points) for individual panel outlines
  const edgeVerts: number[] = [];
  for (let i = 0; i < numPanels; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    const c0x = a.x + nx * halfWidth;
    const c0z = a.z + nz * halfWidth;
    const c1x = b.x + nx * halfWidth;
    const c1z = b.z + nz * halfWidth;
    const c2x = b.x - nx * halfWidth;
    const c2z = b.z - nz * halfWidth;
    const c3x = a.x - nx * halfWidth;
    const c3z = a.z - nz * halfWidth;

    // 4 edges per panel = 8 line segment endpoints
    edgeVerts.push(c0x, avgY, c0z, c1x, avgY, c1z); // top edge
    edgeVerts.push(c1x, avgY, c1z, c2x, avgY, c2z); // right edge
    edgeVerts.push(c2x, avgY, c2z, c3x, avgY, c3z); // bottom edge
    edgeVerts.push(c3x, avgY, c3z, c0x, avgY, c0z); // left edge
  }

  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgeVerts, 3));

  return { geometry, edgeGeometry };
}

interface DiaphragmMesh {
  id: number;
  geometry: THREE.BufferGeometry;
  edgeGeometry: THREE.BufferGeometry;
  isCollinear: boolean;
}

export function DiaphragmPlanes() {
  const diaphragms = useModelStore((s) => s.diaphragms);
  const nodes = useModelStore((s) => s.nodes);
  const showDiaphragms = useDisplayStore((s) => s.showDiaphragms);
  const bounds = useModelBounds();

  const meshes = useMemo(() => {
    if (!showDiaphragms || diaphragms.size === 0) return [];

    // Panel half-width: ~3% of model extent perpendicular to girder line
    const stripHalfWidth = Math.max(bounds.maxDimension * 0.03, 24);

    return Array.from(diaphragms.values())
      .map((d): DiaphragmMesh | null => {
        // Collect all node positions (master + constrained)
        const allNodeIds = [d.masterNodeId, ...d.constrainedNodeIds];
        const positions: { x: number; y: number; z: number }[] = [];
        for (const nid of allNodeIds) {
          const node = nodes.get(nid);
          if (node) positions.push({ x: node.x, y: node.y, z: node.z });
        }

        if (positions.length < 2) return null;

        // Project to XZ plane for convex hull
        const xzPoints = positions.map((p) => ({ x: p.x, z: p.z }));
        const hullIndices = convexHull2D(xzPoints);

        // Collinear case (bridge girders at same station): render inter-girder panels
        if (hullIndices.length < 3 || positions.length < 3) {
          const panels = buildCollinearPanels(positions, stripHalfWidth);
          if (!panels) return null;
          return {
            id: d.id,
            geometry: panels.geometry,
            edgeGeometry: panels.edgeGeometry,
            isCollinear: true,
          };
        }

        // Non-collinear case: convex hull polygon (buildings, multi-bay frames)
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

        // Edge geometry from hull vertices
        const edgePoints: THREE.Vector3[] = [];
        for (let i = 0; i < hullIndices.length; i++) {
          const pt = positions[hullIndices[i]!]!;
          edgePoints.push(new THREE.Vector3(pt.x, avgY, pt.z));
        }
        const edgeGeometry = new THREE.BufferGeometry().setFromPoints(edgePoints);

        return { id: d.id, geometry, edgeGeometry, isCollinear: false };
      })
      .filter(Boolean) as DiaphragmMesh[];
  }, [diaphragms, nodes, showDiaphragms, bounds.maxDimension]);

  if (!showDiaphragms || meshes.length === 0) return null;

  return (
    <group>
      {meshes.map((m) => (
        <group key={m.id}>
          <mesh geometry={m.geometry}>
            <meshBasicMaterial
              color="#d4af37"
              transparent
              opacity={0.55}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          {m.isCollinear ? (
            <lineSegments geometry={m.edgeGeometry}>
              <lineBasicMaterial color="#d4af37" />
            </lineSegments>
          ) : (
            <lineLoop geometry={m.edgeGeometry}>
              <lineBasicMaterial color="#d4af37" />
            </lineLoop>
          )}
        </group>
      ))}
    </group>
  );
}
