/**
 * Tests for the ResultsPanel component.
 *
 * Verifies that the correct results sub-component is rendered
 * based on the analysis type, including the new pushover type.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResultsPanel } from '@/features/results/ResultsPanel';
import { useAnalysisStore } from '@/stores/analysisStore';
import type { AnalysisResults, PushoverResults, HingeState } from '@/types/analysis';

// Mock react-plotly.js to avoid loading the full 4.7MB Plotly bundle
vi.mock('react-plotly.js', () => ({
  __esModule: true,
  default: () => <div data-testid="plotly-chart">Chart</div>,
}));

const getState = () => useAnalysisStore.getState();

beforeEach(() => {
  getState().resetAnalysis();
});

// ---------------------------------------------------------------------------
// No results state
// ---------------------------------------------------------------------------

describe('ResultsPanel — no results', () => {
  it('shows placeholder when no results available', () => {
    render(<ResultsPanel />);
    expect(screen.getByText(/No analysis results available/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Static analysis results
// ---------------------------------------------------------------------------

describe('ResultsPanel — static results', () => {
  it('renders StaticResults for static analysis type', () => {
    const mockResults: AnalysisResults = {
      analysisId: 'test-001',
      modelId: 'model-001',
      type: 'static',
      status: 'complete',
      progress: 1,
      results: {
        nodeDisplacements: { 1: [0.01, -0.02, 0, 0, 0, 0] },
        elementForces: {},
        reactions: { 101: [10, 50, 0, 0, 0, 0] },
      },
    };
    getState().setResults(mockResults);
    getState().setAnalysisType('static');

    render(<ResultsPanel />);
    expect(screen.getByText('Static Analysis')).toBeInTheDocument();
    expect(screen.getByText('Node Displacements')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Modal analysis results
// ---------------------------------------------------------------------------

describe('ResultsPanel — modal results', () => {
  it('renders ModalResults for modal analysis type', () => {
    const mockResults: AnalysisResults = {
      analysisId: 'test-002',
      modelId: 'model-001',
      type: 'modal',
      status: 'complete',
      progress: 1,
      results: {
        periods: [0.85, 0.30],
        frequencies: [1.18, 3.33],
        modeShapes: {},
        massParticipation: {
          1: { x: 0.82, y: 0.0, z: 0.0 },
          2: { x: 0.10, y: 0.0, z: 0.0 },
        },
      },
    };
    getState().setResults(mockResults);
    getState().setAnalysisType('modal');

    render(<ResultsPanel />);
    expect(screen.getByText('Modal Analysis')).toBeInTheDocument();
    expect(screen.getByText('Mode Properties')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Pushover analysis results
// ---------------------------------------------------------------------------

describe('ResultsPanel — pushover results', () => {
  it('renders PushoverResults for pushover analysis type', () => {
    const pushoverData: PushoverResults = {
      capacityCurve: [
        { baseShear: 0, roofDisplacement: 0 },
        { baseShear: 100, roofDisplacement: 5 },
      ],
      maxBaseShear: 100,
      maxRoofDisplacement: 5,
      ductilityRatio: 3.0,
    };

    const mockResults: AnalysisResults = {
      analysisId: 'test-003',
      modelId: 'model-001',
      type: 'pushover',
      status: 'complete',
      progress: 1,
      results: pushoverData,
    };
    getState().setResults(mockResults);
    getState().setAnalysisType('pushover');

    render(<ResultsPanel />);
    expect(screen.getByText('Pushover Analysis')).toBeInTheDocument();
    expect(screen.getByText('Max Base Shear:')).toBeInTheDocument();
    expect(screen.getByText('Capacity Curve')).toBeInTheDocument();
  });

  it('renders pushover with hinge states', () => {
    const hingeStates: HingeState[] = [
      {
        elementId: 1,
        end: 'i',
        rotation: 0.001,
        moment: 500,
        performanceLevel: 'IO',
        demandCapacityRatio: 0.5,
      },
    ];

    const pushoverData: PushoverResults = {
      capacityCurve: [{ baseShear: 0, roofDisplacement: 0 }],
      maxBaseShear: 100,
      maxRoofDisplacement: 5,
      ductilityRatio: 3.0,
    };

    const mockResults: AnalysisResults = {
      analysisId: 'test-004',
      modelId: 'model-001',
      type: 'pushover',
      status: 'complete',
      progress: 1,
      results: pushoverData,
      hingeStates,
    };
    getState().setResults(mockResults);
    getState().setAnalysisType('pushover');

    render(<ResultsPanel />);
    expect(screen.getByText('Plastic Hinge States')).toBeInTheDocument();
  });

  it('shows wall time when available', () => {
    const mockResults: AnalysisResults = {
      analysisId: 'test-005',
      modelId: 'model-001',
      type: 'pushover',
      status: 'complete',
      progress: 1,
      results: {
        capacityCurve: [],
        maxBaseShear: 0,
        maxRoofDisplacement: 0,
        ductilityRatio: 0,
      },
      wallTime: 2.56,
    };
    getState().setResults(mockResults);
    getState().setAnalysisType('pushover');

    render(<ResultsPanel />);
    expect(screen.getByText('2.56s')).toBeInTheDocument();
  });
});
