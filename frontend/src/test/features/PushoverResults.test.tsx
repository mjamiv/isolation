/**
 * Tests for the PushoverResults component.
 *
 * Covers summary stats rendering, capacity curve placeholder,
 * hinge state table, and edge cases for empty data.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PushoverResults } from '@/features/results/PushoverResults';
import type { PushoverResults as PushoverResultsType, HingeState } from '@/types/analysis';

// Mock react-plotly.js to avoid loading the full 4.7MB Plotly bundle in tests
vi.mock('react-plotly.js', () => ({
  __esModule: true,
  default: () => <div data-testid="plotly-chart">Chart</div>,
}));

function makePushoverData(overrides: Partial<PushoverResultsType> = {}): PushoverResultsType {
  return {
    capacityCurve: [
      { baseShear: 0, roofDisplacement: 0 },
      { baseShear: 50, roofDisplacement: 2 },
      { baseShear: 100, roofDisplacement: 5 },
      { baseShear: 120, roofDisplacement: 10 },
    ],
    maxBaseShear: 120,
    maxRoofDisplacement: 10,
    ductilityRatio: 4.5,
    ...overrides,
  };
}

function makeHingeStates(): HingeState[] {
  return [
    {
      elementId: 1,
      end: 'i',
      rotation: 0.00123,
      moment: 450.5,
      performanceLevel: 'IO',
      demandCapacityRatio: 0.65,
    },
    {
      elementId: 2,
      end: 'j',
      rotation: 0.00456,
      moment: 800.2,
      performanceLevel: 'LS',
      demandCapacityRatio: 0.85,
    },
    {
      elementId: 3,
      end: 'i',
      rotation: 0.01234,
      moment: 950.0,
      performanceLevel: 'CP',
      demandCapacityRatio: 1.02,
    },
  ];
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

describe('PushoverResults — summary stats', () => {
  it('renders max base shear', () => {
    render(<PushoverResults data={makePushoverData()} />);
    expect(screen.getByText('Max Base Shear:')).toBeInTheDocument();
    expect(screen.getByText('120.00 kip')).toBeInTheDocument();
  });

  it('renders max roof displacement', () => {
    render(<PushoverResults data={makePushoverData()} />);
    expect(screen.getByText('Max Roof Disp:')).toBeInTheDocument();
    expect(screen.getByText('10.0000 in')).toBeInTheDocument();
  });

  it('renders ductility ratio', () => {
    render(<PushoverResults data={makePushoverData()} />);
    expect(screen.getByText('Ductility Ratio:')).toBeInTheDocument();
    expect(screen.getByText('4.50')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Capacity curve chart
// ---------------------------------------------------------------------------

describe('PushoverResults — capacity curve', () => {
  it('renders chart heading', () => {
    render(<PushoverResults data={makePushoverData()} />);
    expect(screen.getByText('Capacity Curve')).toBeInTheDocument();
  });

  it('renders the Plotly chart component', () => {
    render(<PushoverResults data={makePushoverData()} />);
    expect(screen.getByTestId('plotly-chart')).toBeInTheDocument();
  });

  it('handles empty capacity curve gracefully', () => {
    const data = makePushoverData({ capacityCurve: [] });
    render(<PushoverResults data={data} />);
    // Should still render without errors
    expect(screen.getByText('Capacity Curve')).toBeInTheDocument();
    expect(screen.getByTestId('plotly-chart')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Hinge state table
// ---------------------------------------------------------------------------

describe('PushoverResults — hinge states', () => {
  it('renders hinge state table when hingeStates provided', () => {
    const hingeStates = makeHingeStates();
    render(<PushoverResults data={makePushoverData()} hingeStates={hingeStates} />);
    expect(screen.getByText('Plastic Hinge States')).toBeInTheDocument();
  });

  it('renders correct number of hinge rows', () => {
    const hingeStates = makeHingeStates();
    render(<PushoverResults data={makePushoverData()} hingeStates={hingeStates} />);
    // 3 hinges = 3 body rows, plus header row = 4 <tr> elements
    const rows = screen.getAllByRole('row');
    // header + 3 data rows
    expect(rows).toHaveLength(4);
  });

  it('renders element IDs in hinge table', () => {
    const hingeStates = makeHingeStates();
    render(<PushoverResults data={makePushoverData()} hingeStates={hingeStates} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders performance levels with correct text', () => {
    const hingeStates = makeHingeStates();
    render(<PushoverResults data={makePushoverData()} hingeStates={hingeStates} />);
    expect(screen.getByText('IO')).toBeInTheDocument();
    expect(screen.getByText('LS')).toBeInTheDocument();
    expect(screen.getByText('CP')).toBeInTheDocument();
  });

  it('does not render hinge table when no hingeStates', () => {
    render(<PushoverResults data={makePushoverData()} />);
    expect(screen.queryByText('Plastic Hinge States')).not.toBeInTheDocument();
  });

  it('does not render hinge table when hingeStates is empty', () => {
    render(<PushoverResults data={makePushoverData()} hingeStates={[]} />);
    expect(screen.queryByText('Plastic Hinge States')).not.toBeInTheDocument();
  });
});
