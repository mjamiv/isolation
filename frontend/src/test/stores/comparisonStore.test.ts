/**
 * Tests for the comparison Zustand store.
 *
 * Covers initial state, lifecycle (start, set results, reset),
 * error handling, and summary storage.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useComparisonStore } from '@/stores/comparisonStore';
import type { ComparisonRun, ComparisonSummary, VariantResult } from '@/types/comparison';

const getState = () => useComparisonStore.getState();

const mockVariantResult: VariantResult = {
  pushoverResults: {
    capacityCurve: [
      { baseShear: 10, roofDisplacement: 0.5 },
      { baseShear: 25, roofDisplacement: 1.0 },
      { baseShear: 35, roofDisplacement: 2.0 },
    ],
    maxBaseShear: 35,
    maxRoofDisplacement: 2.0,
    ductilityRatio: 1.5,
  },
  hingeStates: [
    {
      elementId: 1,
      end: 'i',
      rotation: 0.01,
      moment: 500,
      performanceLevel: 'IO',
      demandCapacityRatio: 1.2,
    },
  ],
  maxBaseShear: 35,
  maxRoofDisplacement: 2.0,
};

const mockComparisonRun: ComparisonRun = {
  comparisonId: 'cmp-001',
  modelId: 'model-001',
  status: 'complete',
  isolated: mockVariantResult,
  isolatedUpper: null,
  isolatedLower: null,
  fixedBase: { ...mockVariantResult, maxBaseShear: 60, maxRoofDisplacement: 3.0 },
  lambdaFactors: null,
};

beforeEach(() => {
  getState().resetComparison();
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('comparisonStore — initial state', () => {
  it('initializes as idle with no results', () => {
    expect(getState().status).toBe('idle');
    expect(getState().comparisonId).toBeNull();
    expect(getState().isolated).toBeNull();
    expect(getState().fixedBase).toBeNull();
  });

  it('initializes with no lambda factors or summary', () => {
    expect(getState().lambdaFactors).toBeNull();
    expect(getState().summary).toBeNull();
    expect(getState().error).toBeNull();
  });

  it('initializes upper/lower bound slots as null', () => {
    expect(getState().isolatedUpper).toBeNull();
    expect(getState().isolatedLower).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// startComparison
// ---------------------------------------------------------------------------

describe('comparisonStore — startComparison', () => {
  it('sets status to running and clears previous state', () => {
    getState().setResults(mockComparisonRun);
    expect(getState().status).toBe('complete');

    getState().startComparison();
    expect(getState().status).toBe('running');
    expect(getState().isolated).toBeNull();
    expect(getState().fixedBase).toBeNull();
    expect(getState().error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setResults
// ---------------------------------------------------------------------------

describe('comparisonStore — setResults', () => {
  it('stores isolated and fixed-base results', () => {
    getState().setResults(mockComparisonRun);

    expect(getState().status).toBe('complete');
    expect(getState().comparisonId).toBe('cmp-001');
    expect(getState().isolated).toBeTruthy();
    expect(getState().fixedBase).toBeTruthy();
    expect(getState().isolated!.maxBaseShear).toBe(35);
    expect(getState().fixedBase!.maxBaseShear).toBe(60);
  });

  it('stores lambda factors when provided', () => {
    const runWithLambda: ComparisonRun = {
      ...mockComparisonRun,
      lambdaFactors: { min: 0.85, max: 1.8 },
      isolatedUpper: { ...mockVariantResult, maxBaseShear: 40 },
      isolatedLower: { ...mockVariantResult, maxBaseShear: 30 },
    };

    getState().setResults(runWithLambda);

    expect(getState().lambdaFactors).toEqual({ min: 0.85, max: 1.8 });
    expect(getState().isolatedUpper).toBeTruthy();
    expect(getState().isolatedLower).toBeTruthy();
    expect(getState().isolatedUpper!.maxBaseShear).toBe(40);
    expect(getState().isolatedLower!.maxBaseShear).toBe(30);
  });

  it('sets status to error when run has error status', () => {
    const errorRun: ComparisonRun = {
      ...mockComparisonRun,
      status: 'error',
      error: 'Solver failed',
      isolated: null,
      fixedBase: null,
    };

    getState().setResults(errorRun);
    expect(getState().status).toBe('error');
    expect(getState().error).toBe('Solver failed');
  });
});

// ---------------------------------------------------------------------------
// setSummary
// ---------------------------------------------------------------------------

describe('comparisonStore — setSummary', () => {
  it('stores computed summary metrics', () => {
    const summary: ComparisonSummary = {
      driftProfiles: [
        { story: 1, height: 144, isolatedDrift: 0.005, fixedBaseDrift: 0.012 },
      ],
      baseShear: {
        isolatedBaseShear: 35,
        fixedBaseBaseShear: 60,
        reductionPercent: 41.7,
      },
      bearingDemands: [],
      hingeDistribution: [
        { level: 'IO', isolatedCount: 1, fixedBaseCount: 4 },
        { level: 'LS', isolatedCount: 0, fixedBaseCount: 2 },
        { level: 'CP', isolatedCount: 0, fixedBaseCount: 0 },
      ],
    };

    getState().setSummary(summary);
    expect(getState().summary).toEqual(summary);
  });
});

// ---------------------------------------------------------------------------
// setError
// ---------------------------------------------------------------------------

describe('comparisonStore — setError', () => {
  it('sets error message and status to error', () => {
    getState().startComparison();
    getState().setError('Analysis timeout');

    expect(getState().status).toBe('error');
    expect(getState().error).toBe('Analysis timeout');
  });
});

// ---------------------------------------------------------------------------
// resetComparison
// ---------------------------------------------------------------------------

describe('comparisonStore — resetComparison', () => {
  it('resets all state back to idle defaults', () => {
    getState().setResults(mockComparisonRun);
    getState().setSummary({
      driftProfiles: [],
      baseShear: { isolatedBaseShear: 0, fixedBaseBaseShear: 0, reductionPercent: 0 },
      bearingDemands: [],
      hingeDistribution: [],
    });

    getState().resetComparison();

    expect(getState().status).toBe('idle');
    expect(getState().comparisonId).toBeNull();
    expect(getState().isolated).toBeNull();
    expect(getState().fixedBase).toBeNull();
    expect(getState().isolatedUpper).toBeNull();
    expect(getState().isolatedLower).toBeNull();
    expect(getState().lambdaFactors).toBeNull();
    expect(getState().summary).toBeNull();
    expect(getState().error).toBeNull();
  });
});
