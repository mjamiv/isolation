import type { TFPBearing } from '@/types/storeModel';
import { computeTfpStageOffsets } from './tfpKinematics';

export type BearingAssemblyPieceId =
  | 'foundationPlate'
  | 'lowerConcavePlate'
  | 'lowerArticulatedCore'
  | 'stage1Slider'
  | 'stage2Slider'
  | 'upperConcavePlate'
  | 'upperArticulatedCore';

export interface BearingAssemblyPiece {
  id: BearingAssemblyPieceId;
  badge: number;
  label: string;
  description: string;
  fill: string;
  x: number;
  y: number;
  z: number;
  r: number;
  h: number;
}

export interface BearingAssemblyProjectionParams {
  cssW: number;
  cssH: number;
  relDx: number;
  relDz: number;
  radius: number;
  fullOrbitPoints: [number, number, number][];
  viewZoom: number;
  viewPanX: number;
  viewPanY: number;
  viewYaw: number;
  viewPitch: number;
}

export interface BearingAssemblySummary {
  totalPlanDisp: number;
  totalVerticalDisp: number;
  totalCapacity: number;
  totalUtilization: number;
  stageTravel: [number, number, number];
  stageUtilization: [number, number, number];
  engagedStage: 0 | 1 | 2 | 3;
  engagedStageLabel: string;
  cappedPlanDisp: number;
  overflow: number;
}

const EPSILON = 1e-6;

export const ASSEMBLY_LABEL_OFFSETS: Record<BearingAssemblyPieceId, { x: number; y: number }> = {
  foundationPlate: { x: -30, y: 22 },
  lowerConcavePlate: { x: -46, y: -8 },
  lowerArticulatedCore: { x: -38, y: -34 },
  stage1Slider: { x: 20, y: -22 },
  stage2Slider: { x: 22, y: -4 },
  upperConcavePlate: { x: 28, y: -18 },
  upperArticulatedCore: { x: 30, y: -42 },
};

export function buildBearingAssemblyPieces(params: {
  relDx: number;
  relDy: number;
  relDz: number;
  stageCapacities: [number, number, number];
  radius: number;
  gap: number;
  plateThickness: number;
}): BearingAssemblyPiece[] {
  const { relDx, relDy, relDz, stageCapacities, radius, gap, plateThickness } = params;
  const offsets = computeTfpStageOffsets(relDx, relDz, stageCapacities);
  const [s1x, s1z] = offsets.slider1;
  const [s2x, s2z] = offsets.slider2;

  return [
    {
      id: 'foundationPlate',
      badge: 1,
      label: 'Foundation plate',
      description: 'Fixed base plate anchored to the lower node.',
      fill: '#64748b',
      x: 0,
      y: -plateThickness * 1.8,
      z: 0,
      r: radius * 0.96,
      h: plateThickness * 2.2,
    },
    {
      id: 'lowerConcavePlate',
      badge: 2,
      label: 'Lower concave plate',
      description: 'Primary lower sliding surface for the isolation stack.',
      fill: '#cbd5e1',
      x: 0,
      y: 0,
      z: 0,
      r: radius,
      h: plateThickness,
    },
    {
      id: 'lowerArticulatedCore',
      badge: 3,
      label: 'Lower articulated core',
      description: 'Inner seat that transfers load into the first slider.',
      fill: '#94a3b8',
      x: 0,
      y: plateThickness * 0.85,
      z: 0,
      r: radius * 0.55,
      h: plateThickness * 0.9,
    },
    {
      id: 'stage1Slider',
      badge: 4,
      label: 'Stage 1 slider',
      description: 'First sliding stage. Travel is capped by d1.',
      fill: '#22d3ee',
      x: s1x,
      y: gap * 0.35,
      z: s1z,
      r: radius * 0.22,
      h: plateThickness * 1.1,
    },
    {
      id: 'stage2Slider',
      badge: 5,
      label: 'Stage 2 slider',
      description: 'Second-stage articulated slider carrying the cumulative plan offset.',
      fill: '#f59e0b',
      x: s2x,
      y: gap * 0.56,
      z: s2z,
      r: radius * 0.32,
      h: plateThickness * 1.05,
    },
    {
      id: 'upperConcavePlate',
      badge: 6,
      label: 'Upper concave plate',
      description: 'Upper sliding surface attached to the supported node.',
      fill: '#e2e8f0',
      x: relDx,
      y: gap + relDy,
      z: relDz,
      r: radius,
      h: plateThickness,
    },
    {
      id: 'upperArticulatedCore',
      badge: 7,
      label: 'Upper articulated core',
      description: 'Top cap that follows the upper node displacement.',
      fill: '#f8fafc',
      x: relDx,
      y: gap + relDy - plateThickness * 0.85,
      z: relDz,
      r: radius * 0.55,
      h: plateThickness * 0.9,
    },
  ];
}

export function summarizeBearingAssembly(
  bearing: TFPBearing | null,
  relDx: number,
  relDy: number,
  relDz: number,
  stageCapacities: [number, number, number],
): BearingAssemblySummary {
  const offsets = computeTfpStageOffsets(relDx, relDz, stageCapacities);
  const totalCapacity = stageCapacities.reduce((sum, value) => sum + value, 0);
  const stageUtilization = stageCapacities.map((capacity, index) =>
    capacity > EPSILON ? offsets.stageTravel[index]! / capacity : 0,
  ) as [number, number, number];
  const totalUtilization = totalCapacity > EPSILON ? offsets.totalMagnitude / totalCapacity : 0;

  let engagedStage: 0 | 1 | 2 | 3 = 0;
  if (offsets.stageTravel[2] > EPSILON) engagedStage = 3;
  else if (offsets.stageTravel[1] > EPSILON) engagedStage = 2;
  else if (offsets.stageTravel[0] > EPSILON) engagedStage = 1;

  const labelBase = bearing?.label ? `${bearing.label}` : 'Bearing';
  const engagedStageLabel =
    engagedStage === 0 ? `${labelBase} centered` : `${labelBase} in Stage ${engagedStage}`;

  return {
    totalPlanDisp: offsets.totalMagnitude,
    totalVerticalDisp: relDy,
    totalCapacity,
    totalUtilization,
    stageTravel: offsets.stageTravel,
    stageUtilization,
    engagedStage,
    engagedStageLabel,
    cappedPlanDisp: offsets.cappedMagnitude,
    overflow: Math.max(0, offsets.totalMagnitude - offsets.cappedMagnitude),
  };
}

export function createBearingAssemblyProjector(params: BearingAssemblyProjectionParams) {
  const {
    cssW,
    cssH,
    relDx,
    relDz,
    radius,
    fullOrbitPoints,
    viewZoom,
    viewPanX,
    viewPanY,
    viewYaw,
    viewPitch,
  } = params;

  const cosY = Math.cos(viewYaw);
  const sinY = Math.sin(viewYaw);
  const cosP = Math.cos(viewPitch);
  const sinP = Math.sin(viewPitch);

  let orbitExtent = 0;
  for (const p of fullOrbitPoints) {
    orbitExtent = Math.max(orbitExtent, Math.abs(p[0]), Math.abs(p[2]));
  }

  const viewExtent = Math.max(
    radius * 4,
    Math.abs(relDx) + Math.abs(relDz) + radius * 2.5,
    orbitExtent + radius * 1.2,
    32,
  );
  const scale = (Math.min(cssW, cssH) / (viewExtent * 1.15)) * viewZoom;
  const cx = cssW * 0.5 + viewPanX;
  const cy = cssH * 0.58 + viewPanY;

  return (x: number, y: number, z: number) => {
    const xr = x * cosY - z * sinY;
    const zr = x * sinY + z * cosY;
    const yr = y * cosP - zr * sinP;
    const depth = y * sinP + zr * cosP;
    return { x: cx + xr * scale, y: cy - yr * scale, depth };
  };
}

export function clampPercent(value: number): string {
  return `${Math.max(0, Math.min(100, value * 100)).toFixed(0)}%`;
}

export function formatSignedValue(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(2)}`;
}
