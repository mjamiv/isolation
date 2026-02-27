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
 * Build a single continuous rectangle spanning the full extent of collinear
 * diaphragm nodes (e.g., a transverse deck strip across bridge girders).
 * Instead of N-1 separate panels between adjacent nodes, this creates ONE
 * rectangle from the first to the last node, inflated by `halfWidth`
 * perpendicular to the line direction. This eliminates internal edge lines
 * and produces a clean continuous band.
 */
function buildCollinearStrip(
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

  // Sort positions along the line direction to find first and last
  const sorted = [...positions].sort((a, b) => {
    const projA = (a.x - pA.x) * dirX + (a.z - pA.z) * dirZ;
    const projB = (b.x - pA.x) * dirX + (b.z - pA.z) * dirZ;
    return projA - projB;
  });

  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const avgY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;

  // Four corners of the single rectangle
  const c0x = first.x + nx * halfWidth;
  const c0z = first.z + nz * halfWidth;
  const c1x = last.x + nx * halfWidth;
  const c1z = last.z + nz * halfWidth;
  const c2x = last.x - nx * halfWidth;
  const c2z = last.z - nz * halfWidth;
  const c3x = first.x - nx * halfWidth;
  const c3z = first.z - nz * halfWidth;

  // Build geometry: 4 vertices, 2 triangles
  const verts = new Float32Array([c0x, avgY, c0z, c1x, avgY, c1z, c2x, avgY, c2z, c3x, avgY, c3z]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);

  // Edge geometry: 4 line segments forming one closed rectangle
  const edgeVerts = new Float32Array([
    c0x,
    avgY,
    c0z,
    c1x,
    avgY,
    c1z, // top edge
    c1x,
    avgY,
    c1z,
    c2x,
    avgY,
    c2z, // right edge
    c2x,
    avgY,
    c2z,
    c3x,
    avgY,
    c3z, // bottom edge
    c3x,
    avgY,
    c3z,
    c0x,
    avgY,
    c0z, // left edge
  ]);
  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgeVerts, 3));

  return { geometry, edgeGeometry };
}

/**
 * Offset convex hull vertices outward along bisector normals so the
 * rendered slab extends past node centerlines (deck overhangs / slab edges).
 */
function inflateHull(pts: { x: number; z: number }[], offset: number): { x: number; z: number }[] {
  if (offset <= 0 || pts.length < 3) return pts;
  const n = pts.length;
  const result: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]!;
    const curr = pts[i]!;
    const next = pts[(i + 1) % n]!;
    // Edge vectors
    const e1x = curr.x - prev.x,
      e1z = curr.z - prev.z;
    const e2x = next.x - curr.x,
      e2z = next.z - curr.z;
    // Outward normals (rotate 90° CW for CCW hull)
    const len1 = Math.sqrt(e1x * e1x + e1z * e1z) || 1;
    const len2 = Math.sqrt(e2x * e2x + e2z * e2z) || 1;
    const n1x = e1z / len1,
      n1z = -e1x / len1;
    const n2x = e2z / len2,
      n2z = -e2x / len2;
    // Bisector
    let bx = n1x + n2x,
      bz = n1z + n2z;
    const bLen = Math.sqrt(bx * bx + bz * bz) || 1;
    bx /= bLen;
    bz /= bLen;
    const dot = bx * n1x + bz * n1z;
    const scale = dot > 0.1 ? offset / dot : offset;
    result.push({ x: curr.x + bx * scale, z: curr.z + bz * scale });
  }
  return result;
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

    const result: DiaphragmMesh[] = [];

    for (const d of diaphragms.values()) {
      // Collect all node positions (master + constrained)
      const allNodeIds = [d.masterNodeId, ...d.constrainedNodeIds];
      const positions: { x: number; y: number; z: number }[] = [];
      for (const nid of allNodeIds) {
        const node = nodes.get(nid);
        if (node) positions.push({ x: node.x, y: node.y, z: node.z });
      }

      if (positions.length < 2) continue;

      // Project to XZ plane for convex hull
      const xzPoints = positions.map((p) => ({ x: p.x, z: p.z }));
      const hullIndices = convexHull2D(xzPoints);

      // Collinear case (bridge girders at same station): render inter-girder panels
      if (hullIndices.length < 3 || positions.length < 3) {
        const panels = buildCollinearStrip(positions, stripHalfWidth);
        if (!panels) continue;
        result.push({
          id: d.id,
          geometry: panels.geometry,
          edgeGeometry: panels.edgeGeometry,
          isCollinear: true,
        });
        continue;
      }

      // Non-collinear case: convex hull polygon (buildings, multi-bay frames)
      const avgY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;

      // Create shape from inflated hull points in XZ plane
      const hullPts = hullIndices.map((i) => xzPoints[i]!);
      const inflated = inflateHull(hullPts, stripHalfWidth);
      const shape = new THREE.Shape();
      shape.moveTo(inflated[0]!.x, inflated[0]!.z);
      for (let i = 1; i < inflated.length; i++) {
        shape.lineTo(inflated[i]!.x, inflated[i]!.z);
      }
      shape.closePath();

      const geometry = new THREE.ShapeGeometry(shape);
      // ShapeGeometry creates in XY — rotate to XZ (horizontal plane)
      geometry.rotateX(Math.PI / 2);
      geometry.translate(0, avgY, 0);

      // Edge geometry from inflated hull vertices
      const edgePoints: THREE.Vector3[] = [];
      for (let i = 0; i < inflated.length; i++) {
        edgePoints.push(new THREE.Vector3(inflated[i]!.x, avgY, inflated[i]!.z));
      }
      const edgeGeometry = new THREE.BufferGeometry().setFromPoints(edgePoints);

      result.push({ id: d.id, geometry, edgeGeometry, isCollinear: false });
    }

    return result;
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
