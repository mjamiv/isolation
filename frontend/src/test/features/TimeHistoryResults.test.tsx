import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimeHistoryResults } from '@/features/results/TimeHistoryResults';
import { useDisplayStore } from '@/stores/displayStore';

vi.mock('react-plotly.js', () => ({
  __esModule: true,
  default: () => <div data-testid="plotly-chart">Chart</div>,
}));

const mockData = {
  timeSteps: [
    {
      step: 0,
      time: 0,
      nodeDisplacements: {
        1: [0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number],
        2: [0.1, 0, 0, 0, 0, 0] as [number, number, number, number, number, number],
      },
      elementForces: {
        10: [0, 1, 2, 0, 3, 4],
        11: [0, 2, 3, 0, 4, 5],
      },
      bearingResponses: {},
    },
    {
      step: 1,
      time: 0.1,
      nodeDisplacements: {
        1: [0.01, 0, 0, 0, 0, 0] as [number, number, number, number, number, number],
        2: [0.12, 0, 0, 0, 0, 0] as [number, number, number, number, number, number],
      },
      elementForces: {
        10: [0, 1.5, 2.5, 0, 3.5, 4.5],
        11: [0, 2.5, 3.5, 0, 4.5, 5.5],
      },
      bearingResponses: {},
    },
  ],
  dt: 0.1,
  totalTime: 0.1,
  peakValues: {
    maxDrift: { value: 0, story: 0, step: 0 },
    maxAcceleration: { value: 0, floor: 0, step: 0 },
    maxBaseShear: { value: 0, step: 0 },
    maxBearingDisp: { value: 0, bearingId: 0, step: 0 },
  },
};

describe('TimeHistoryResults', () => {
  beforeEach(() => {
    useDisplayStore.setState({
      selectedNodeIds: new Set<number>(),
      selectedElementIds: new Set<number>(),
    });
  });

  it('renders separate shear and moment sections', async () => {
    render(<TimeHistoryResults data={mockData} />);

    expect(await screen.findByText('Shear')).toBeInTheDocument();
    expect(await screen.findByText('Moment')).toBeInTheDocument();
  });

  it('auto-syncs node and element selectors from 3D selection store', async () => {
    useDisplayStore.setState({
      selectedNodeIds: new Set<number>([2]),
      selectedElementIds: new Set<number>([11]),
    });

    render(<TimeHistoryResults data={mockData} />);

    const selectors = await screen.findAllByRole('combobox');
    expect(selectors[0]).toHaveValue('2');
    expect(selectors[1]).toHaveValue('11');
  });
});
