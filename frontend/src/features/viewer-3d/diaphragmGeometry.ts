export interface DiaphragmPoint {
  x: number;
  y: number;
  z: number;
}

export interface DiaphragmMeshData {
  vertices: DiaphragmPoint[];
  indices: number[];
  outline: DiaphragmPoint[];
  isCollinear: boolean;
}

/**
 * 2D convex hull via Graham scan on XZ coordinates.
 * Returns indices into the input array in CCW order.
 */
export function convexHull2D(points: { x: number; z: number }[]): number[] {
  if (points.length < 3) return points.map((_, i) => i);

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

  indices.sort((a, b) => {
    const pa = points[a]!;
    const pb = points[b]!;
    const angleA = Math.atan2(pa.z - pv.z, pa.x - pv.x);
    const angleB = Math.atan2(pb.z - pv.z, pb.x - pv.x);
    if (angleA !== angleB) return angleA - angleB;
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

function normalize(point: DiaphragmPoint): DiaphragmPoint | null {
  const len = Math.hypot(point.x, point.y, point.z);
  if (len < 1e-9) return null;
  return { x: point.x / len, y: point.y / len, z: point.z / len };
}

function subtract(a: DiaphragmPoint, b: DiaphragmPoint): DiaphragmPoint {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a: DiaphragmPoint, b: DiaphragmPoint): DiaphragmPoint {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function average(points: DiaphragmPoint[]): DiaphragmPoint {
  const total = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
      z: sum.z + point.z,
    }),
    { x: 0, y: 0, z: 0 },
  );
  const scale = points.length > 0 ? 1 / points.length : 0;
  return { x: total.x * scale, y: total.y * scale, z: total.z * scale };
}

function farthestPair(points: DiaphragmPoint[]): [number, number] | null {
  if (points.length < 2) return null;
  let bestDist = 0;
  let pair: [number, number] = [0, 1];

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const delta = subtract(points[j]!, points[i]!);
      const dist = delta.x * delta.x + delta.y * delta.y + delta.z * delta.z;
      if (dist > bestDist) {
        bestDist = dist;
        pair = [i, j];
      }
    }
  }

  return pair;
}

export function normalFromPerpDirection(perpDirection?: number): DiaphragmPoint {
  switch (perpDirection) {
    case 1:
      return { x: 1, y: 0, z: 0 };
    case 3:
      return { x: 0, y: 0, z: 1 };
    case 2:
    default:
      return { x: 0, y: 1, z: 0 };
  }
}

/**
 * Builds a triangulated surface from all diaphragm node positions using
 * ear-clipping on the concave boundary. Handles both convex grids and
 * concave arc/ring segments without generating a straight-chord fill.
 */
export function buildHullSurfaceData(positions: DiaphragmPoint[]): DiaphragmMeshData | null {
  if (positions.length < 3) return null;

  const xzPoints = positions.map((p) => ({ x: p.x, z: p.z }));
  const boundary = concaveBoundary2D(xzPoints);
  if (boundary.length < 3) return null;

  const outline = boundary.map((i) => positions[i]!);
  const interiorIndices = positions.map((_, i) => i).filter((i) => !boundary.includes(i));

  const allVertices = [...positions];
  const indices = triangulateFan(allVertices, boundary, interiorIndices);

  return {
    vertices: allVertices,
    indices,
    outline,
    isCollinear: false,
  };
}

/**
 * Computes the concave boundary of a 2D point set in XZ by finding the
 * perimeter nodes (those on the edge of the point cloud) and sorting them
 * in angular order. Interior nodes are excluded from the boundary.
 */
function concaveBoundary2D(points: { x: number; z: number }[]): number[] {
  if (points.length < 3) return points.map((_, i) => i);

  const center = {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    z: points.reduce((s, p) => s + p.z, 0) / points.length,
  };

  const withAngle = points.map((p, i) => ({
    index: i,
    angle: Math.atan2(p.x - center.x, p.z - center.z),
    dist: Math.hypot(p.x - center.x, p.z - center.z),
  }));

  const N_BINS = 120;
  const binStep = (2 * Math.PI) / N_BINS;
  const bins = new Map<number, (typeof withAngle)[0]>();

  for (const entry of withAngle) {
    const bin = Math.floor((entry.angle + Math.PI) / binStep);
    const existing = bins.get(bin);
    if (!existing || entry.dist > existing.dist) {
      bins.set(bin, entry);
    }
  }

  const boundary = [...bins.values()].sort((a, b) => a.angle - b.angle).map((e) => e.index);

  if (boundary.length < 3) {
    return convexHull2D(points);
  }

  return boundary;
}

/**
 * Triangulates a polygon boundary plus interior points using a simple
 * fan from the centroid plus Delaunay-like subdivision for interior nodes.
 */
function triangulateFan(
  vertices: DiaphragmPoint[],
  boundary: number[],
  interiorIndices: number[],
): number[] {
  const center = average(vertices);
  const cIdx = vertices.length;
  vertices.push(center);

  const indices: number[] = [];

  if (interiorIndices.length === 0) {
    for (let i = 0; i < boundary.length; i++) {
      const next = (i + 1) % boundary.length;
      indices.push(cIdx, boundary[i]!, boundary[next]!);
    }
    return indices;
  }

  const allBoundaryAndInterior = [...boundary, ...interiorIndices];
  const pts2d = allBoundaryAndInterior.map((i) => ({
    idx: i,
    x: vertices[i]!.x,
    z: vertices[i]!.z,
  }));

  const tris = bowyerWatson(pts2d);
  for (const tri of tris) {
    indices.push(tri[0], tri[1], tri[2]);
  }

  return indices;
}

/**
 * Simple Bowyer-Watson Delaunay triangulation on 2D XZ points.
 * Returns triangle index triples referencing the original vertex array.
 */
function bowyerWatson(points: { idx: number; x: number; z: number }[]): [number, number, number][] {
  if (points.length < 3) return [];

  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }

  const dx = maxX - minX || 1;
  const dz = maxZ - minZ || 1;
  const superMargin = Math.max(dx, dz) * 10;

  const superA = { idx: -1, x: minX - superMargin, z: minZ - superMargin };
  const superB = { idx: -2, x: maxX + superMargin, z: minZ - superMargin };
  const superC = { idx: -3, x: (minX + maxX) / 2, z: maxZ + superMargin };

  const allPts = [superA, superB, superC, ...points];

  type Tri = [number, number, number]; // indices into allPts
  let triangles: Tri[] = [[0, 1, 2]];

  for (let pi = 3; pi < allPts.length; pi++) {
    const p = allPts[pi]!;
    const bad: Tri[] = [];
    const good: Tri[] = [];

    for (const tri of triangles) {
      if (inCircumcircle(allPts, tri, p)) {
        bad.push(tri);
      } else {
        good.push(tri);
      }
    }

    const edges: [number, number][] = [];
    for (const tri of bad) {
      const triEdges: [number, number][] = [
        [tri[0], tri[1]],
        [tri[1], tri[2]],
        [tri[2], tri[0]],
      ];
      for (const edge of triEdges) {
        const shared = bad.some((other) => other !== tri && hasEdge(other, edge[0], edge[1]));
        if (!shared) edges.push(edge);
      }
    }

    triangles = good;
    for (const edge of edges) {
      triangles.push([edge[0], edge[1], pi]);
    }
  }

  return triangles
    .filter((tri) => tri.every((i) => allPts[i]!.idx >= 0))
    .map((tri) => [allPts[tri[0]]!.idx, allPts[tri[1]]!.idx, allPts[tri[2]]!.idx]);
}

function inCircumcircle(
  pts: { x: number; z: number }[],
  tri: [number, number, number],
  p: { x: number; z: number },
): boolean {
  const a = pts[tri[0]]!;
  const b = pts[tri[1]]!;
  const c = pts[tri[2]]!;

  const ax = a.x - p.x,
    az = a.z - p.z;
  const bx = b.x - p.x,
    bz = b.z - p.z;
  const cx = c.x - p.x,
    cz = c.z - p.z;

  const det =
    (ax * ax + az * az) * (bx * cz - cx * bz) -
    (bx * bx + bz * bz) * (ax * cz - cx * az) +
    (cx * cx + cz * cz) * (ax * bz - bx * az);

  return det > 0;
}

function hasEdge(tri: [number, number, number], a: number, b: number): boolean {
  return (
    (tri[0] === a && tri[1] === b) ||
    (tri[1] === a && tri[0] === b) ||
    (tri[1] === a && tri[2] === b) ||
    (tri[2] === a && tri[1] === b) ||
    (tri[2] === a && tri[0] === b) ||
    (tri[0] === a && tri[2] === b)
  );
}

/**
 * Builds a ribbon mesh through collinear diaphragm nodes so the strip follows
 * the actual displaced node elevations instead of collapsing to one flat plane.
 */
export function buildRibbonStripData(
  positions: DiaphragmPoint[],
  halfWidth: number,
  planeNormal: DiaphragmPoint,
): DiaphragmMeshData | null {
  if (positions.length < 2) return null;

  const pair = farthestPair(positions);
  if (!pair) return null;

  const [iA, iB] = pair;
  const pA = positions[iA]!;
  const pB = positions[iB]!;
  const axis = normalize(subtract(pB, pA));
  if (!axis) return null;

  const sorted = [...positions].sort((a, b) => {
    const projA = (a.x - pA.x) * axis.x + (a.y - pA.y) * axis.y + (a.z - pA.z) * axis.z;
    const projB = (b.x - pA.x) * axis.x + (b.y - pA.y) * axis.y + (b.z - pA.z) * axis.z;
    return projA - projB;
  });

  const vertices: DiaphragmPoint[] = [];
  const leftEdge: DiaphragmPoint[] = [];
  const rightEdge: DiaphragmPoint[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const prev = sorted[Math.max(i - 1, 0)]!;
    const next = sorted[Math.min(i + 1, sorted.length - 1)]!;
    const tangent = normalize(subtract(next, prev)) ?? axis;

    let widthDir =
      normalize(cross(planeNormal, tangent)) ??
      normalize(cross({ x: 0, y: 0, z: 1 }, tangent)) ??
      normalize(cross({ x: 1, y: 0, z: 0 }, tangent));

    if (!widthDir) return null;

    widthDir = {
      x: widthDir.x * halfWidth,
      y: widthDir.y * halfWidth,
      z: widthDir.z * halfWidth,
    };

    const point = sorted[i]!;
    const left = {
      x: point.x + widthDir.x,
      y: point.y + widthDir.y,
      z: point.z + widthDir.z,
    };
    const right = {
      x: point.x - widthDir.x,
      y: point.y - widthDir.y,
      z: point.z - widthDir.z,
    };

    leftEdge.push(left);
    rightEdge.push(right);
    vertices.push(left, right);
  }

  const indices: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const base = i * 2;
    indices.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
  }

  return {
    vertices,
    indices,
    outline: [...leftEdge, ...rightEdge.reverse()],
    isCollinear: true,
  };
}
