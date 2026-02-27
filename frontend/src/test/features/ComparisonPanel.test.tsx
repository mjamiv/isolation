/**
 * Tests for the ComparisonPanel component.
 *
 * Covers empty state, running state, error state, and full dashboard
 * rendering with mock comparison data for both pushover and time-history.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComparisonPanel } from '@/features/comparison/ComparisonPanel';
import { useComparisonStore } from '@/stores/comparisonStore';
import type { ComparisonRun, VariantResult } from '@/types/comparison';
import type { TimeHistoryResults } from '@/types/analysis';

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
  hingeStates: [],
  maxBaseShear: 35,
  maxRoofDisplacement: 2.0,
};

function makeMockTHResults(peakShear: number, peakDisp: number): TimeHistoryResults {
  return {
    timeSteps: [
      {
        step: 0,
        time: 0.0,
        nodeDisplacements: { 1: [0, 0, 0, 0, 0, 0] },
        elementForces: {},
        bearingResponses: {},
      },
      {
        step: 1,
        time: 0.01,
        nodeDisplacements: { 1: [peakDisp, 0, 0, 0, 0, 0] },
        elementForces: {},
        bearingResponses: {},
      },
    ],
    dt: 0.01,
    totalTime: 0.02,
    peakValues: {
      maxDrift: { value: peakDisp, story: 1, step: 1 },
      maxAcceleration: { value: 0, floor: 0, step: 0 },
      maxBaseShear: { value: peakShear, step: 1 },
      maxBearingDisp: { value: 0, bearingId: 0, step: 0 },
    },
  };
}

const mockTHVariantIsolated: VariantResult = {
  timeHistoryResults: makeMockTHResults(50, 1.5),
  maxBaseShear: 50,
  maxRoofDisplacement: 1.5,
};

const mockTHVariantFixedBase: VariantResult = {
  timeHistoryResults: makeMockTHResults(120, 3.2),
  maxBaseShear: 120,
  maxRoofDisplacement: 3.2,
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
// Empty state
// ---------------------------------------------------------------------------

describe('ComparisonPanel — empty state', () => {
  it('shows empty message when idle', () => {
    render(<ComparisonPanel />);
    expect(screen.getByText(/no comparison data/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Running state
// ---------------------------------------------------------------------------

describe('ComparisonPanel — running state', () => {
  it('shows loading indicator when running', () => {
    getState().startComparison();
    render(<ComparisonPanel />);
    expect(screen.getByText(/running comparison analysis/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe('ComparisonPanel — error state', () => {
  it('shows error message when comparison fails', () => {
    getState().setError('Solver convergence failure');
    render(<ComparisonPanel />);
    expect(screen.getByText(/comparison failed/i)).toBeInTheDocument();
    expect(screen.getByText(/solver convergence failure/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Complete state with data
// ---------------------------------------------------------------------------

describe('ComparisonPanel — with data', () => {
  it('renders comparison header when results exist', () => {
    getState().setResults(mockComparisonRun);
    render(<ComparisonPanel />);
    expect(screen.getByText(/isolated vs fixed-base comparison/i)).toBeInTheDocument();
  });

  it('renders key metrics bar', () => {
    getState().setResults(mockComparisonRun);
    render(<ComparisonPanel />);
    // Multiple elements may contain "shear reduction" (metrics bar + chart)
    expect(screen.getAllByText(/shear reduction/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/iso shear/i)).toBeInTheDocument();
    expect(screen.getByText(/fb shear/i)).toBeInTheDocument();
  });

  it('renders accordion sections for dashboard charts', () => {
    getState().setResults(mockComparisonRun);
    render(<ComparisonPanel />);
    expect(screen.getByText('Capacity Curve')).toBeInTheDocument();
    expect(screen.getByText('Drift Profile')).toBeInTheDocument();
    expect(screen.getByText('Base Shear')).toBeInTheDocument();
    expect(screen.getByText('Bearing D/C')).toBeInTheDocument();
    expect(screen.getByText('Hinge Distribution')).toBeInTheDocument();
  });

  it('renders 3D overlay toggle', () => {
    getState().setResults(mockComparisonRun);
    render(<ComparisonPanel />);
    expect(screen.getByText(/show 3d overlay/i)).toBeInTheDocument();
  });

  it('shows lambda factor info when provided', () => {
    const runWithLambda: ComparisonRun = {
      ...mockComparisonRun,
      lambdaFactors: { min: 0.85, max: 1.8 },
    };
    getState().setResults(runWithLambda);
    render(<ComparisonPanel />);
    expect(screen.getByText(/lambda 0.85\/1.8/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Time-history comparison
// ---------------------------------------------------------------------------

describe('ComparisonPanel — time-history comparison', () => {
  it('renders time-history comparison header', () => {
    const run: ComparisonRun = {
      comparisonId: 'cmp-th-001',
      modelId: 'model-001',
      status: 'complete',
      comparisonType: 'time_history',
      isolated: mockTHVariantIsolated,
      isolatedUpper: null,
      isolatedLower: null,
      fixedBase: mockTHVariantFixedBase,
      lambdaFactors: null,
    };
    getState().setResults(run);
    render(<ComparisonPanel />);
    expect(screen.getByText(/time-history comparison/i)).toBeInTheDocument();
  });

  it('renders shear and displacement metrics for time-history', () => {
    const run: ComparisonRun = {
      comparisonId: 'cmp-th-002',
      modelId: 'model-001',
      status: 'complete',
      comparisonType: 'time_history',
      isolated: mockTHVariantIsolated,
      isolatedUpper: null,
      isolatedLower: null,
      fixedBase: mockTHVariantFixedBase,
      lambdaFactors: null,
    };
    getState().setResults(run);
    render(<ComparisonPanel />);
    expect(screen.getByText(/shear reduction/i)).toBeInTheDocument();
    expect(screen.getByText(/iso shear/i)).toBeInTheDocument();
    expect(screen.getByText(/fb shear/i)).toBeInTheDocument();
    expect(screen.getByText(/disp reduction/i)).toBeInTheDocument();
  });

  it('renders playback controls for time-history comparison', () => {
    const run: ComparisonRun = {
      comparisonId: 'cmp-th-003',
      modelId: 'model-001',
      status: 'complete',
      comparisonType: 'time_history',
      isolated: mockTHVariantIsolated,
      isolatedUpper: null,
      isolatedLower: null,
      fixedBase: mockTHVariantFixedBase,
      lambdaFactors: null,
    };
    getState().setResults(run);
    render(<ComparisonPanel />);
    expect(screen.getByText('Play')).toBeInTheDocument();
    expect(screen.getByText('Playback')).toBeInTheDocument();
  });

  it('renders 3D overlay toggle for time-history comparison', () => {
    const run: ComparisonRun = {
      comparisonId: 'cmp-th-004',
      modelId: 'model-001',
      status: 'complete',
      comparisonType: 'time_history',
      isolated: mockTHVariantIsolated,
      isolatedUpper: null,
      isolatedLower: null,
      fixedBase: mockTHVariantFixedBase,
      lambdaFactors: null,
    };
    getState().setResults(run);
    render(<ComparisonPanel />);
    expect(screen.getByText(/show 3d overlay/i)).toBeInTheDocument();
  });

  it('shows step count for time-history comparison', () => {
    const run: ComparisonRun = {
      comparisonId: 'cmp-th-005',
      modelId: 'model-001',
      status: 'complete',
      comparisonType: 'time_history',
      isolated: mockTHVariantIsolated,
      isolatedUpper: null,
      isolatedLower: null,
      fixedBase: mockTHVariantFixedBase,
      lambdaFactors: null,
    };
    getState().setResults(run);
    render(<ComparisonPanel />);
    expect(screen.getByText('2 steps')).toBeInTheDocument();
  });

  it('does not render pushover accordion sections for time-history', () => {
    const run: ComparisonRun = {
      comparisonId: 'cmp-th-006',
      modelId: 'model-001',
      status: 'complete',
      comparisonType: 'time_history',
      isolated: mockTHVariantIsolated,
      isolatedUpper: null,
      isolatedLower: null,
      fixedBase: mockTHVariantFixedBase,
      lambdaFactors: null,
    };
    getState().setResults(run);
    render(<ComparisonPanel />);
    expect(screen.queryByText('Capacity Curve')).not.toBeInTheDocument();
    expect(screen.queryByText('Hinge Distribution')).not.toBeInTheDocument();
  });

  it('handles variant with no pushoverResults gracefully', () => {
    // Time-history variants do not have pushoverResults
    const run: ComparisonRun = {
      comparisonId: 'cmp-th-007',
      modelId: 'model-001',
      status: 'complete',
      comparisonType: 'time_history',
      isolated: {
        timeHistoryResults: makeMockTHResults(10, 0.5),
        maxBaseShear: 10,
        maxRoofDisplacement: 0.5,
      },
      isolatedUpper: null,
      isolatedLower: null,
      fixedBase: {
        timeHistoryResults: makeMockTHResults(30, 1.0),
        maxBaseShear: 30,
        maxRoofDisplacement: 1.0,
      },
      lambdaFactors: null,
    };
    getState().setResults(run);
    // Should not throw
    render(<ComparisonPanel />);
    expect(screen.getByText(/time-history comparison/i)).toBeInTheDocument();
  });
});
