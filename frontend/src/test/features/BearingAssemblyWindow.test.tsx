import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BearingAssemblyWindow } from '@/features/viewer-3d/BearingAssemblyWindow';
import {
  buildBearingAssemblyPieces,
  summarizeBearingAssembly,
} from '@/features/viewer-3d/bearingAssemblyUi';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useComparisonStore } from '@/stores/comparisonStore';
import { useDisplayStore } from '@/stores/displayStore';
import { useModelStore } from '@/stores/modelStore';
import type { AnalysisResults } from '@/types/analysis';

function seedAssemblyState() {
  useModelStore.getState().clearModel();
  useAnalysisStore.getState().resetAnalysis();
  useComparisonStore.getState().resetComparison();
  useDisplayStore.setState({
    showBearingDisplacement: true,
    bearingVerticalScale: 1,
    activeBearingId: null,
    selectedNodeIds: new Set(),
    selectedElementIds: new Set(),
    selectedBearingIds: new Set(),
    hoveredElementId: null,
    hoveredNodeId: null,
    hoveredBearingId: null,
  });

  const model = useModelStore.getState();
  model.addNode({
    id: 1,
    x: 0,
    y: 0,
    z: 0,
    restraint: [true, true, true, true, true, true],
  });
  model.addNode({
    id: 2,
    x: 0,
    y: 12,
    z: 0,
    restraint: [false, false, false, false, false, false],
  });
  model.addBearing({
    id: 1,
    nodeI: 1,
    nodeJ: 2,
    surfaces: [
      { type: 'VelDependent', muSlow: 0.01, muFast: 0.02, transRate: 0.5 },
      { type: 'VelDependent', muSlow: 0.01, muFast: 0.02, transRate: 0.5 },
      { type: 'VelDependent', muSlow: 0.02, muFast: 0.04, transRate: 0.5 },
      { type: 'VelDependent', muSlow: 0.02, muFast: 0.04, transRate: 0.5 },
    ],
    radii: [16, 84, 16],
    dispCapacities: [2, 16, 2],
    weight: 150,
    yieldDisp: 0.04,
    vertStiffness: 10000,
    minVertForce: 0.1,
    tolerance: 1e-8,
    label: 'Pier 1',
  });

  const results: AnalysisResults = {
    analysisId: 'analysis-1',
    modelId: 'model-1',
    type: 'time_history',
    status: 'complete',
    progress: 1,
    results: {
      dt: 0.02,
      totalTime: 0.04,
      timeSteps: [
        {
          step: 0,
          time: 0,
          nodeDisplacements: {
            1: [0, 0, 0, 0, 0, 0],
            2: [0, 0, 0, 0, 0, 0],
          },
          elementForces: {},
          bearingResponses: {},
        },
        {
          step: 1,
          time: 0.02,
          nodeDisplacements: {
            1: [0, 0, 0, 0, 0, 0],
            2: [5, 1, 0, 0, 0, 0],
          },
          elementForces: {},
          bearingResponses: {},
        },
      ],
      peakValues: {
        maxDrift: { value: 0, story: 0, step: 0 },
        maxAcceleration: { value: 0, floor: 0, step: 0 },
        maxBaseShear: { value: 0, step: 0 },
        maxBearingDisp: { value: 5, bearingId: 1, step: 1 },
      },
    },
  };

  useAnalysisStore.getState().setResults(results);
  useAnalysisStore.getState().setTimeStep(1);
}

describe('bearingAssemblyUi helpers', () => {
  it('keeps stage labels aligned with sequential stage travel', () => {
    const summary = summarizeBearingAssembly(null, 5, 1, 0, [2, 16, 2]);
    expect(summary.stageTravel).toEqual([2, 3, 0]);
    expect(summary.engagedStage).toBe(2);
    expect(summary.totalPlanDisp).toBeCloseTo(5);

    const pieces = buildBearingAssemblyPieces({
      relDx: 5,
      relDy: 1,
      relDz: 0,
      stageCapacities: [2, 16, 2],
      radius: 18,
      gap: 9,
      plateThickness: 2,
    });

    expect(pieces.find((piece) => piece.id === 'stage1Slider')?.x).toBeCloseTo(2);
    expect(pieces.find((piece) => piece.id === 'stage2Slider')?.x).toBeCloseTo(5);
  });
});

describe('BearingAssemblyWindow', () => {
  beforeEach(() => {
    seedAssemblyState();
  });

  it('renders the interactive legend and panel controls without changing the assembly mechanics', () => {
    const { container } = render(<BearingAssemblyWindow />);

    expect(screen.getByText('Bearing Assembly')).toBeInTheDocument();
    expect(screen.getByText('Isolation Mechanism')).toBeInTheDocument();
    expect(screen.getByText('Stage Travel')).toBeInTheDocument();
    expect(screen.getAllByText('Foundation plate')).toHaveLength(2);
    expect(screen.getByText('Drag rotate. Hold Shift to pan. Scroll to zoom.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /set expanded panel size/i }));
    expect(container.querySelector('.bearing-assembly-panel')?.getAttribute('data-size')).toBe(
      'expanded',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByText('Stage Travel')).not.toBeInTheDocument();
  });
});
