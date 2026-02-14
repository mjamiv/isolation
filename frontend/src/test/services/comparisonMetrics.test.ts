/**
 * Tests for the comparison metrics pure functions.
 *
 * These are the most testable part of Phase 5: pure input → output
 * functions with no side effects or store dependencies.
 */

import { describe, it, expect } from 'vitest';
import {
  computeBaseShear,
  countHingesByLevel,
  computeBearingDemands,
} from '@/services/comparisonMetrics';
import type { VariantResult } from '@/types/comparison';
import type { HingeState } from '@/types/analysis';
import type { TFPBearing, FrictionSurface } from '@/types/storeModel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeFrictionSurface = (): FrictionSurface => ({
  type: 'VelDependent',
  muSlow: 0.01,
  muFast: 0.02,
  transRate: 0.4,
});

const makeBearing = (id: number, d1: number, d2: number, d3: number): TFPBearing => ({
  id,
  nodeI: id * 10,
  nodeJ: id * 10 + 1,
  surfaces: [
    makeFrictionSurface(),
    makeFrictionSurface(),
    makeFrictionSurface(),
    makeFrictionSurface(),
  ],
  radii: [100, 200, 100] as [number, number, number],
  dispCapacities: [d1, d2, d3] as [number, number, number],
  weight: 50,
  yieldDisp: 0.001,
  vertStiffness: 100,
  minVertForce: 0.1,
  tolerance: 1e-8,
});

const makeVariantResult = (overrides?: Partial<VariantResult>): VariantResult => ({
  pushoverResults: {
    capacityCurve: [
      { baseShear: 10, roofDisplacement: 0.5 },
      { baseShear: 20, roofDisplacement: 1.0 },
    ],
    maxBaseShear: 20,
    maxRoofDisplacement: 1.0,
    ductilityRatio: 1.5,
  },
  hingeStates: [],
  maxBaseShear: 20,
  maxRoofDisplacement: 1.0,
  ...overrides,
});

// ---------------------------------------------------------------------------
// computeBaseShear
// ---------------------------------------------------------------------------

describe('computeBaseShear', () => {
  it('computes correct base shear values and reduction', () => {
    const isolated = makeVariantResult({ maxBaseShear: 30 });
    const fixedBase = makeVariantResult({ maxBaseShear: 60 });

    const result = computeBaseShear(isolated, fixedBase);

    expect(result.isolatedBaseShear).toBe(30);
    expect(result.fixedBaseBaseShear).toBe(60);
    expect(result.reductionPercent).toBe(50);
  });

  it('returns 0% reduction when fixed-base shear is 0', () => {
    const isolated = makeVariantResult({ maxBaseShear: 10 });
    const fixedBase = makeVariantResult({ maxBaseShear: 0 });

    const result = computeBaseShear(isolated, fixedBase);

    expect(result.reductionPercent).toBe(0);
  });

  it('returns negative reduction when isolated is larger', () => {
    const isolated = makeVariantResult({ maxBaseShear: 80 });
    const fixedBase = makeVariantResult({ maxBaseShear: 60 });

    const result = computeBaseShear(isolated, fixedBase);

    // (60 - 80) / 60 * 100 = -33.33%
    expect(result.reductionPercent).toBeCloseTo(-33.33, 1);
  });
});

// ---------------------------------------------------------------------------
// countHingesByLevel
// ---------------------------------------------------------------------------

describe('countHingesByLevel', () => {
  it('returns zero counts when no hinges exist', () => {
    const result = countHingesByLevel([], []);

    expect(result).toEqual([
      { level: 'IO', isolatedCount: 0, fixedBaseCount: 0 },
      { level: 'LS', isolatedCount: 0, fixedBaseCount: 0 },
      { level: 'CP', isolatedCount: 0, fixedBaseCount: 0 },
    ]);
  });

  it('counts hinges correctly for both variants', () => {
    const isoHinges: HingeState[] = [
      { elementId: 1, end: 'i', rotation: 0.01, moment: 100, performanceLevel: 'IO', demandCapacityRatio: 1.2 },
    ];
    const fbHinges: HingeState[] = [
      { elementId: 1, end: 'i', rotation: 0.01, moment: 100, performanceLevel: 'IO', demandCapacityRatio: 1.2 },
      { elementId: 2, end: 'j', rotation: 0.02, moment: 200, performanceLevel: 'IO', demandCapacityRatio: 1.5 },
      { elementId: 3, end: 'i', rotation: 0.03, moment: 300, performanceLevel: 'LS', demandCapacityRatio: 2.1 },
      { elementId: 4, end: 'j', rotation: 0.05, moment: 500, performanceLevel: 'CP', demandCapacityRatio: 3.5 },
    ];

    const result = countHingesByLevel(isoHinges, fbHinges);

    expect(result[0]).toEqual({ level: 'IO', isolatedCount: 1, fixedBaseCount: 2 });
    expect(result[1]).toEqual({ level: 'LS', isolatedCount: 0, fixedBaseCount: 1 });
    expect(result[2]).toEqual({ level: 'CP', isolatedCount: 0, fixedBaseCount: 1 });
  });

  it('ignores hinges with non-IO/LS/CP performance levels', () => {
    const hinges: HingeState[] = [
      { elementId: 1, end: 'i', rotation: 0.001, moment: 50, performanceLevel: 'elastic', demandCapacityRatio: 0.5 },
      { elementId: 2, end: 'j', rotation: 0.1, moment: 700, performanceLevel: 'beyondCP', demandCapacityRatio: 4.0 },
    ];

    const result = countHingesByLevel(hinges, []);

    expect(result[0]!.isolatedCount).toBe(0);
    expect(result[1]!.isolatedCount).toBe(0);
    expect(result[2]!.isolatedCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeBearingDemands
// ---------------------------------------------------------------------------

describe('computeBearingDemands', () => {
  it('computes demands for each bearing', () => {
    const isolated = makeVariantResult({ maxRoofDisplacement: 5.0 });
    const bearings = new Map<number, TFPBearing>([
      [1, makeBearing(1, 2, 4, 2)],
      [2, makeBearing(2, 3, 6, 3)],
    ]);

    const result = computeBearingDemands(isolated, bearings);

    expect(result).toHaveLength(2);
    expect(result[0]!.bearingId).toBe(1);
    expect(result[0]!.capacity).toBe(8); // 2 + 4 + 2
    expect(result[0]!.demand).toBe(4); // 5.0 * 0.8
    expect(result[0]!.dcRatio).toBeCloseTo(0.5);

    expect(result[1]!.bearingId).toBe(2);
    expect(result[1]!.capacity).toBe(12); // 3 + 6 + 3
    expect(result[1]!.demand).toBe(4); // 5.0 * 0.8
    expect(result[1]!.dcRatio).toBeCloseTo(0.333, 2);
  });

  it('returns empty array when no bearings exist', () => {
    const isolated = makeVariantResult();
    const result = computeBearingDemands(isolated, new Map());
    expect(result).toEqual([]);
  });
});
