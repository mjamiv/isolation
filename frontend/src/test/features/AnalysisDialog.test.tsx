/**
 * Tests for the AnalysisDialog component (Phase 4 additions).
 *
 * Covers the pushover option in the analysis type selector,
 * pushover parameter rendering, and pushover validation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalysisDialog } from '@/features/analysis/AnalysisDialog';
import { useModelStore } from '@/stores/modelStore';

// Mock useRunAnalysis to avoid real API calls
vi.mock('@/features/analysis/useRunAnalysis', () => ({
  useRunAnalysis: () => ({
    run: vi.fn(),
    submitting: false,
  }),
}));

const getModelState = () => useModelStore.getState();

beforeEach(() => {
  getModelState().clearModel();
});

// ---------------------------------------------------------------------------
// Pushover in type selector
// ---------------------------------------------------------------------------

describe('AnalysisDialog — pushover option', () => {
  it('renders the Pushover button in analysis type selector', () => {
    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Pushover')).toBeInTheDocument();
  });

  it('renders all four analysis type buttons', () => {
    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Static')).toBeInTheDocument();
    expect(screen.getByText('Modal')).toBeInTheDocument();
    expect(screen.getByText('Time-History')).toBeInTheDocument();
    expect(screen.getByText('Pushover')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Pushover params
// ---------------------------------------------------------------------------

describe('AnalysisDialog — pushover params', () => {
  it('shows pushover parameters when pushover type is selected', () => {
    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByText('Pushover'));

    expect(screen.getByText('Target Disp (in)')).toBeInTheDocument();
    expect(screen.getByText('Disp Increment (in)')).toBeInTheDocument();
    expect(screen.getByText('Push Direction')).toBeInTheDocument();
    expect(screen.getByText('Load Pattern')).toBeInTheDocument();
  });

  it('shows X and Y push direction buttons', () => {
    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByText('Pushover'));

    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('Y')).toBeInTheDocument();
  });

  it('shows Uniform and First-Mode load pattern buttons', () => {
    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByText('Pushover'));

    expect(screen.getByText('Uniform')).toBeInTheDocument();
    expect(screen.getByText('First-Mode')).toBeInTheDocument();
  });

  it('does not show pushover params when static is selected', () => {
    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByText('Static'));

    expect(screen.queryByText('Target Disp (in)')).not.toBeInTheDocument();
    expect(screen.queryByText('Push Direction')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Pushover validation
// ---------------------------------------------------------------------------

describe('AnalysisDialog — pushover validation', () => {
  it('shows validation error when pushover selected with no loads', () => {
    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByText('Pushover'));

    expect(screen.getByText('Pushover analysis requires at least one load defined.')).toBeInTheDocument();
  });

  it('does not show validation error when pushover selected with loads', () => {
    // Add a load to the model store
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

    expect(screen.queryByText('Pushover analysis requires at least one load defined.')).not.toBeInTheDocument();
  });

  it('disables run button when validation fails', () => {
    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByText('Pushover'));

    const runButton = screen.getByText('Run');
    expect(runButton).toBeDisabled();
  });
});
