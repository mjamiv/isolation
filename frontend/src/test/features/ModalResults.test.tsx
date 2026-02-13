/**
 * Tests for the ModalResults component.
 *
 * Covers mode table rendering, number of modes,
 * and summary information.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModalResults } from '@/features/results/ModalResults';
import type { ModalResults as ModalResultsType } from '@/types/analysis';

function makeModalData(numModes = 3): ModalResultsType {
  const periods: number[] = [];
  const frequencies: number[] = [];
  const modeShapes: Record<number, Record<number, [number, number, number]>> = {};
  const massParticipation: Record<number, { x: number; y: number; z: number }> = {};

  for (let i = 0; i < numModes; i++) {
    const modeNum = i + 1;
    periods.push(0.85 / modeNum);
    frequencies.push(modeNum * 1.18);
    modeShapes[modeNum] = { 1: [0.5 / modeNum, 0.3 / modeNum, 0] };
    massParticipation[modeNum] = {
      x: 0.8 / modeNum,
      y: 0.05,
      z: 0.0,
    };
  }

  return { periods, frequencies, modeShapes, massParticipation };
}

// ---------------------------------------------------------------------------
// Mode properties table
// ---------------------------------------------------------------------------

describe('ModalResults — mode table', () => {
  it('renders Mode Properties heading', () => {
    render(<ModalResults data={makeModalData(3)} />);
    expect(screen.getByText('Mode Properties')).toBeInTheDocument();
  });

  it('renders correct number of mode rows', () => {
    render(<ModalResults data={makeModalData(5)} />);
    // Header row + 5 mode rows = 6 total rows
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(6);
  });

  it('renders 1-based mode numbers', () => {
    render(<ModalResults data={makeModalData(3)} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders table headers', () => {
    render(<ModalResults data={makeModalData()} />);
    expect(screen.getByText('Mode')).toBeInTheDocument();
    expect(screen.getByText('Period (s)')).toBeInTheDocument();
    expect(screen.getByText('Freq (Hz)')).toBeInTheDocument();
    expect(screen.getByText('MPx')).toBeInTheDocument();
    expect(screen.getByText('MPy')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Summary section
// ---------------------------------------------------------------------------

describe('ModalResults — summary', () => {
  it('renders fundamental period', () => {
    const data = makeModalData(3);
    render(<ModalResults data={data} />);
    const expectedPeriod = data.periods[0]!.toFixed(4);
    expect(screen.getByText(new RegExp(`${expectedPeriod}s`))).toBeInTheDocument();
  });

  it('renders number of modes extracted', () => {
    render(<ModalResults data={makeModalData(5)} />);
    expect(screen.getByText('5 modes extracted')).toBeInTheDocument();
  });

  it('renders singular mode text for 1 mode', () => {
    render(<ModalResults data={makeModalData(1)} />);
    expect(screen.getByText('1 mode extracted')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Mass participation display
// ---------------------------------------------------------------------------

describe('ModalResults — mass participation', () => {
  it('renders mass participation as percentage', () => {
    const data: ModalResultsType = {
      periods: [0.85],
      frequencies: [1.18],
      modeShapes: {},
      massParticipation: {
        1: { x: 0.82, y: 0.05, z: 0.0 },
      },
    };
    render(<ModalResults data={data} />);
    expect(screen.getByText('82.0%')).toBeInTheDocument();
    expect(screen.getByText('5.0%')).toBeInTheDocument();
  });
});
