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

export function buildHullSurfaceData(positions: DiaphragmPoint[]): DiaphragmMeshData | null {
  if (positions.length < 3) return null;

  const hullIndices = convexHull2D(positions.map((point) => ({ x: point.x, z: point.z })));
  if (hullIndices.length < 3) return null;

  const outline = hullIndices.map((index) => positions[index]!);
  const center = average(outline);
  const vertices = [center, ...outline];
  const indices: number[] = [];

  for (let i = 1; i <= outline.length; i++) {
    const next = i === outline.length ? 1 : i + 1;
    indices.push(0, i, next);
  }

  return {
    vertices,
    indices,
    outline,
    isCollinear: false,
  };
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
