/**
 * Tests for AnalysisDialog auto-select ground motion behavior.
 *
 * Verifies that switching to time-history auto-selects the first GM.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalysisDialog } from '@/features/analysis/AnalysisDialog';
import { useModelStore } from '@/stores/modelStore';

// Mock both hooks to avoid real API calls
vi.mock('@/features/analysis/useRunAnalysis', () => ({
  useRunAnalysis: () => ({
    run: vi.fn(),
    submitting: false,
  }),
}));

vi.mock('@/features/analysis/useRunComparison', () => ({
  useRunComparison: () => ({
    run: vi.fn(),
    submitting: false,
  }),
}));

const getModelState = () => useModelStore.getState();

beforeEach(() => {
  getModelState().clearModel();
});

describe('AnalysisDialog — auto-select ground motion', () => {
  it('auto-selects first GM when switching to time-history with GMs available', () => {
    // Load sample model which includes ground motions
    getModelState().loadSampleModel();

    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);

    // Switch to time-history
    fireEvent.click(screen.getByText('Time-History'));

    // The GM select should have a value (not the empty "Select..." option)
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('1');
  });

  it('does not show "Please select a ground motion" error when GMs are available', () => {
    getModelState().loadSampleModel();

    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Time-History'));

    expect(screen.queryByText('Please select a ground motion record.')).not.toBeInTheDocument();
  });

  it('shows ground motion names in the select dropdown', () => {
    getModelState().loadSampleModel();

    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Time-History'));

    expect(screen.getByText('El Centro 1940 (Approx)')).toBeInTheDocument();
    expect(screen.getByText('Near-Fault Pulse')).toBeInTheDocument();
    expect(screen.getByText('Harmonic Sweep')).toBeInTheDocument();
    expect(screen.getByText('Long-Duration Subduction')).toBeInTheDocument();
  });

  it('still shows error when no ground motions exist', () => {
    // Don't load sample model — empty ground motions
    render(<AnalysisDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Time-History'));

    expect(screen.getByText('Time-history analysis requires at least one ground motion.')).toBeInTheDocument();
  });
});
