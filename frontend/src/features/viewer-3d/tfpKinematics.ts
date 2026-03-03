import type { TimeStep } from '@/types/analysis';

const EPSILON = 1e-9;

export interface PlanDisplacement {
  dx: number;
  dz: number;
  magnitude: number;
}

export interface NodeViewerDisplacement {
  dx: number;
  dy: number;
  dz: number;
}

export interface TfpStageOffsets {
  slider1: [number, number];
  slider2: [number, number];
  slider3: [number, number];
  direction: [number, number];
  totalMagnitude: number;
  cappedMagnitude: number;
  stageTravel: [number, number, number];
}

function sanitizeCapacity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function splitSequentialTravel(
  totalTravel: number,
  dispCapacities: [number, number, number],
): [number, number, number] {
  const c1 = sanitizeCapacity(dispCapacities[0]);
  const c2 = sanitizeCapacity(dispCapacities[1]);
  const c3 = sanitizeCapacity(dispCapacities[2]);

  const stage1 = Math.min(totalTravel, c1);
  const remainingAfterStage1 = Math.max(0, totalTravel - stage1);
  const stage2 = Math.min(remainingAfterStage1, c2);
  const remainingAfterStage2 = Math.max(0, remainingAfterStage1 - stage2);
  const stage3 = Math.min(remainingAfterStage2, c3);
  return [stage1, stage2, stage3];
}

/**
 * Extract relative plan displacement in frontend axes:
 * - X from backend DOF 1
 * - Z from backend DOF 2 (backend Y, mapped to frontend Z)
 */
export function extractNodeViewerDisplacement(
  step: TimeStep | undefined,
  nodeId: number,
): NodeViewerDisplacement {
  if (!step) return { dx: 0, dy: 0, dz: 0 };
  const disp = step.nodeDisplacements[nodeId];
  if (!disp) return { dx: 0, dy: 0, dz: 0 };

  return {
    dx: disp[0] ?? 0,
    // Bearing models are solved in Z-up; frontend view is Y-up.
    dy: disp[2] ?? 0,
    dz: disp[1] ?? 0,
  };
}

export function extractPlanDisplacement(
  step: TimeStep | undefined,
  nodeI: number,
  nodeJ: number,
): PlanDisplacement {
  if (!step) return { dx: 0, dz: 0, magnitude: 0 };
  if (!step.nodeDisplacements[nodeJ]) return { dx: 0, dz: 0, magnitude: 0 };

  const dispI = extractNodeViewerDisplacement(step, nodeI);
  const dispJ = extractNodeViewerDisplacement(step, nodeJ);

  const dx = dispJ.dx - dispI.dx;
  const dz = dispJ.dz - dispI.dz;
  return { dx, dz, magnitude: Math.hypot(dx, dz) };
}

/**
 * Split total bearing displacement into sequential stage travel:
 * - slider1: first sliding surface
 * - slider2: first + second surfaces
 * - slider3: first + second + third surfaces (top plate offset)
 */
export function computeTfpStageOffsets(
  dx: number,
  dz: number,
  dispCapacities: [number, number, number],
): TfpStageOffsets {
  const totalMagnitude = Math.hypot(dx, dz);
  if (totalMagnitude < EPSILON) {
    return {
      slider1: [0, 0],
      slider2: [0, 0],
      slider3: [0, 0],
      direction: [1, 0],
      totalMagnitude: 0,
      cappedMagnitude: 0,
      stageTravel: [0, 0, 0],
    };
  }

  const dirX = dx / totalMagnitude;
  const dirZ = dz / totalMagnitude;
  const [s1, s2, s3] = splitSequentialTravel(totalMagnitude, dispCapacities);

  const cumulative1 = s1;
  const cumulative2 = s1 + s2;
  const cumulative3 = s1 + s2 + s3;

  return {
    slider1: [dirX * cumulative1, dirZ * cumulative1],
    slider2: [dirX * cumulative2, dirZ * cumulative2],
    slider3: [dirX * cumulative3, dirZ * cumulative3],
    direction: [dirX, dirZ],
    totalMagnitude,
    cappedMagnitude: cumulative3,
    stageTravel: [s1, s2, s3],
  };
}

export function extractOrbitPoints(
  timeSteps: TimeStep[],
  nodeI: number,
  nodeJ: number,
  maxPoints = 160,
): [number, number][] {
  if (timeSteps.length === 0) return [];

  const stride = Math.max(1, Math.floor(timeSteps.length / maxPoints));
  const points: [number, number][] = [];

  for (let i = 0; i < timeSteps.length; i += stride) {
    const { dx, dz } = extractPlanDisplacement(timeSteps[i], nodeI, nodeJ);
    points.push([dx, dz]);
  }

  const lastStep = timeSteps[timeSteps.length - 1];
  const { dx: lastX, dz: lastZ } = extractPlanDisplacement(lastStep, nodeI, nodeJ);
  const lastPoint = points[points.length - 1];
  if (!lastPoint || lastPoint[0] !== lastX || lastPoint[1] !== lastZ) {
    points.push([lastX, lastZ]);
  }

  return points;
}
