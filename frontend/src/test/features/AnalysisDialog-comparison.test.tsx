/**
 * Tests for AnalysisDialog comparison toggle (Phase 5).
 *
 * Covers the comparison checkbox rendering, lambda factor inputs,
 * button label changes, and time-history comparison flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalysisDialog } from '@/features/analysis/AnalysisDialog';
import { useModelStore } from '@/stores/modelStore';
import type { FrictionSurface } from '@/types/storeModel';

const mockRunAnalysis = vi.fn();
const mockRunComparison = vi.fn();

// Mock both hooks to avoid real API calls
vi.mock('@/features/analysis/useRunAnalysis', () => ({
  useRunAnalysis: () => ({
    run: mockRunAnalysis,
    submitting: false,
  }),
}));

vi.mock('@/features/analysis/useRunComparison', () => ({
  useRunComparison: () => ({
    run: mockRunComparison,
    submitting: false,
  }),
}));

const getModelState = () => useModelStore.getState();

const makeFrictionSurface = (): FrictionSurface => ({
  type: 'VelDependent',
  muSlow: 0.01,
  muFast: 0.02,
  transRate: 0.4,
});

beforeEach(() => {
  getModelState().clearModel();
  mockRunAnalysis.mockReset();
  mockRunComparison.mockReset();
});

function setupWithBearingsAndLoads() {
  // Add a load
  getModelState().addLoad({
    id: 1,
    nodeId: 1,
    fx: 10,
    fy: -100,
    fz: 0,
    mx: 0,
    my: 0,
    mz: 0,
  });

  // Add a bearing
  getModelState().addBearing({
    id: 1,
    nodeI: 101,
    nodeJ: 1,
    surfaces: [
      makeFrictionSurface(),
      makeFrictionSurface(),
      makeFrictionSurface(),
      makeFrictionSurface(),
    ],
    radii: [100, 200, 100] as [number, number, number],
    dispCapacities: [2, 4, 2] as [number, number, number],
    weight: 50,
    yieldDisp: 0.001,
    vertStiffness: 100,
    minVertForce: 0.1,
    tolerance: 1e-8,
  });
}

// ---------------------------------------------------------------------------
// Comparison toggle visibility
// ---------------------------------------------------------------------------

describe('AnalysisDialog — comparison toggle', () => {
  it('does not show comparison toggle when no bearings exist', () => {
    getModelState().addLoad({
      id: 1,
      nodeId: 1,
      fx: 10,
      fy: 0,
      fz: 0,
      mx: 0,
      my: 0,
      mz: 0,
    });

    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Pushover'));

    expect(screen.queryByText(/run comparison/i)).not.toBeInTheDocument();
  });

  it('shows comparison toggle when bearings exist and pushover selected', () => {
    setupWithBearingsAndLoads();

    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Pushover'));

    expect(screen.getByText(/run comparison.*isolated vs fixed-base/i)).toBeInTheDocument();
  });

  it('does not show comparison toggle for non-pushover analysis', () => {
    setupWithBearingsAndLoads();

    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Modal'));

    expect(screen.queryByText(/run comparison/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Lambda factor inputs
// ---------------------------------------------------------------------------

describe('AnalysisDialog — lambda factors', () => {
  it('shows lambda toggle when comparison is checked', () => {
    setupWithBearingsAndLoads();

    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Pushover'));

    // Check the comparison checkbox
    const checkbox = screen
      .getByText(/run comparison/i)
      .closest('label')!
      .querySelector('input')!;
    fireEvent.click(checkbox);

    expect(screen.getByText(/lambda factors.*asce 7-22/i)).toBeInTheDocument();
  });

  it('shows lambda min/max inputs when lambda toggle is checked', () => {
    setupWithBearingsAndLoads();

    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Pushover'));

    // Check comparison
    const compCheckbox = screen
      .getByText(/run comparison/i)
      .closest('label')!
      .querySelector('input')!;
    fireEvent.click(compCheckbox);

    // Check lambda
    const lambdaCheckbox = screen
      .getByText(/lambda factors/i)
      .closest('label')!
      .querySelector('input')!;
    fireEvent.click(lambdaCheckbox);

    expect(screen.getByText('Lambda Min')).toBeInTheDocument();
    expect(screen.getByText('Lambda Max')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Button label
// ---------------------------------------------------------------------------

describe('AnalysisDialog — button label', () => {
  it('shows "Run Comparison" when comparison mode is on', () => {
    setupWithBearingsAndLoads();

    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Pushover'));

    const checkbox = screen
      .getByText(/run comparison/i)
      .closest('label')!
      .querySelector('input')!;
    fireEvent.click(checkbox);

    expect(screen.getByText('Run Comparison')).toBeInTheDocument();
  });

  it('shows "Run" when comparison mode is off', () => {
    setupWithBearingsAndLoads();

    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Pushover'));

    // The regular Run button should be visible
    expect(screen.getByText('Run')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Time-history comparison
// ---------------------------------------------------------------------------

function setupWithBearingsAndGroundMotions() {
  setupWithBearingsAndLoads();

  // Add ground motions
  getModelState().addGroundMotion({
    id: 1,
    name: 'El Centro',
    dt: 0.02,
    acceleration: Array.from({ length: 100 }, () => Math.random() * 0.1),
    direction: 1 as 1 | 2 | 3,
    scaleFactor: 0.35,
  });
}

describe('AnalysisDialog — time-history comparison toggle', () => {
  it('shows comparison toggle when bearings exist and time-history selected', () => {
    setupWithBearingsAndGroundMotions();

    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Time-History'));

    expect(screen.getByText(/run comparison.*isolated vs fixed-base/i)).toBeInTheDocument();
  });

  it('shows animated overlay description for time-history comparison', () => {
    setupWithBearingsAndGroundMotions();

    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Time-History'));

    const checkbox = screen
      .getByText(/run comparison/i)
      .closest('label')!
      .querySelector('input')!;
    fireEvent.click(checkbox);

    expect(screen.getByText(/animated overlay/i)).toBeInTheDocument();
  });

  it('does not show lambda factors for time-history comparison', () => {
    setupWithBearingsAndGroundMotions();

    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Time-History'));

    const checkbox = screen
      .getByText(/run comparison/i)
      .closest('label')!
      .querySelector('input')!;
    fireEvent.click(checkbox);

    // Lambda factors are pushover-only
    expect(screen.queryByText(/lambda factors/i)).not.toBeInTheDocument();
  });

  it('shows "Run Comparison" button for time-history comparison', () => {
    setupWithBearingsAndGroundMotions();

    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Time-History'));

    const checkbox = screen
      .getByText(/run comparison/i)
      .closest('label')!
      .querySelector('input')!;
    fireEvent.click(checkbox);

    expect(screen.getByText('Run Comparison')).toBeInTheDocument();
  });

  it('calls runComparison (not runAnalysis) when time-history comparison is submitted', () => {
    setupWithBearingsAndGroundMotions();
    const onOpenChange = vi.fn();

    render(<AnalysisDialog open={true} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByText('Time-History'));

    // Enable comparison mode
    const checkbox = screen
      .getByText(/run comparison/i)
      .closest('label')!
      .querySelector('input')!;
    fireEvent.click(checkbox);

    // Click Run Comparison
    fireEvent.click(screen.getByText('Run Comparison'));

    // Should call runComparison, not runAnalysis
    expect(mockRunComparison).toHaveBeenCalledTimes(1);
    expect(mockRunAnalysis).not.toHaveBeenCalled();

    // Should close the dialog
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('passes time_history type in comparison params', () => {
    setupWithBearingsAndGroundMotions();

    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Time-History'));

    const checkbox = screen
      .getByText(/run comparison/i)
      .closest('label')!
      .querySelector('input')!;
    fireEvent.click(checkbox);

    fireEvent.click(screen.getByText('Run Comparison'));

    const [params] = mockRunComparison.mock.calls[0]!;
    expect(params.type).toBe('time_history');
    expect(params.groundMotions).toBeDefined();
    expect(params.groundMotions!.length).toBeGreaterThan(0);
  });
});
