/**
 * Tests for the ComparisonPanel component.
 *
 * Covers empty state, running state, error state, and full dashboard
 * rendering with mock comparison data.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComparisonPanel } from '@/features/comparison/ComparisonPanel';
import { useComparisonStore } from '@/stores/comparisonStore';
import type { ComparisonRun, VariantResult } from '@/types/comparison';

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
