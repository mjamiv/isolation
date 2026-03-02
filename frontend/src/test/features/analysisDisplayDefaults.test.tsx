import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRunAnalysis } from '@/features/analysis/useRunAnalysis';
import { useRunComparison } from '@/features/analysis/useRunComparison';
import { useDisplayStore } from '@/stores/displayStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useModelStore } from '@/stores/modelStore';
import type { AnalysisResults } from '@/types/analysis';
import type { ComparisonRun } from '@/types/comparison';

let capturedConfig: {
  onResult?: (result: unknown) => void;
} = {};

vi.mock('@/features/analysis/useRunAsync', () => ({
  useRunAsync: (config: unknown) => {
    capturedConfig = config as { onResult?: (result: unknown) => void };
    return { run: vi.fn(), submitting: false };
  },
}));

const getDisplayState = () => useDisplayStore.getState();
const getAnalysisState = () => useAnalysisStore.getState();
const getModelState = () => useModelStore.getState();

function resetDisplayState() {
  const s = getDisplayState();
  s.setShowDeformed(false);
  s.setHideUndeformed(true);
  s.setScaleFactor(12);
  s.setShowForces(true);
  s.setForceType('moment');
  s.setColorMap('stress');
  s.setShowComparisonOverlay(false);
  s.setShowBearingDisplacement(false);
  s.setShowBaseShearLabels(false);
}

beforeEach(() => {
  capturedConfig = {};
  getAnalysisState().resetAnalysis();
  getModelState().clearModel();
  resetDisplayState();
});

describe('useRunAnalysis — post-analysis display defaults', () => {
  it('applies deformed-shape defaults and isolation toggle for isolated time-history results', () => {
    renderHook(() => useRunAnalysis());
    getAnalysisState().setTimeStep(42);
    getAnalysisState().setIsPlaying(true);

    getModelState().addBearing({
      id: 1,
      nodeI: 1,
      nodeJ: 2,
      surfaces: [
        { type: 'VelDependent', muSlow: 0.01, muFast: 0.02, transRate: 0.5 },
        { type: 'VelDependent', muSlow: 0.01, muFast: 0.02, transRate: 0.5 },
        { type: 'VelDependent', muSlow: 0.01, muFast: 0.02, transRate: 0.5 },
        { type: 'VelDependent', muSlow: 0.01, muFast: 0.02, transRate: 0.5 },
      ],
      radii: [16, 84, 16],
      dispCapacities: [2, 16, 2],
      weight: 100,
      yieldDisp: 0.05,
      vertStiffness: 10000,
      minVertForce: 0.1,
      tolerance: 1e-8,
    });

    const result: AnalysisResults = {
      analysisId: 'a1',
      modelId: 'm1',
      type: 'time_history',
      status: 'complete',
      progress: 1,
      results: {
        dt: 0.02,
        totalTime: 0.04,
        timeSteps: [],
        peakValues: {
          maxDrift: { value: 0, story: 0, step: 0 },
          maxAcceleration: { value: 0, floor: 0, step: 0 },
          maxBaseShear: { value: 0, step: 0 },
          maxBearingDisp: { value: 0, bearingId: 1, step: 0 },
        },
      },
    };

    capturedConfig.onResult?.(result);

    const s = getDisplayState();
    expect(s.showDeformed).toBe(true);
    expect(s.hideUndeformed).toBe(false);
    expect(s.scaleFactor).toBe(100);
    expect(s.showForces).toBe(false);
    expect(s.forceType).toBe('none');
    expect(s.colorMap).toBe('none');
    expect(s.showComparisonOverlay).toBe(false);
    expect(s.showBearingDisplacement).toBe(true);
    expect(s.showBaseShearLabels).toBe(false);
    expect(getAnalysisState().currentTimeStep).toBe(0);
    expect(getAnalysisState().isPlaying).toBe(false);
  });

  it('enables base shear arrows by default for pushover results', () => {
    renderHook(() => useRunAnalysis());

    const result: AnalysisResults = {
      analysisId: 'a2',
      modelId: 'm2',
      type: 'pushover',
      status: 'complete',
      progress: 1,
      results: {
        capacityCurve: [{ baseShear: 10, roofDisplacement: 1 }],
        maxBaseShear: 10,
        maxRoofDisplacement: 1,
        ductilityRatio: 1,
      },
    };

    capturedConfig.onResult?.(result);
    expect(getDisplayState().showBaseShearLabels).toBe(true);
  });
});

describe('useRunComparison — post-comparison display defaults', () => {
  it('enables comparison overlay and resets playback defaults', () => {
    renderHook(() => useRunComparison());

    getAnalysisState().setTimeStep(99);
    getAnalysisState().setIsPlaying(true);
    getDisplayState().setShowComparisonOverlay(false);
    getDisplayState().setShowBaseShearLabels(false);

    const result: ComparisonRun = {
      comparisonId: 'c1',
      modelId: 'm3',
      status: 'complete',
      comparisonType: 'time_history',
      isolated: {
        timeHistoryResults: {
          dt: 0.02,
          totalTime: 0.04,
          timeSteps: [],
          peakValues: {
            maxDrift: { value: 0, story: 0, step: 0 },
            maxAcceleration: { value: 0, floor: 0, step: 0 },
            maxBaseShear: { value: 0, step: 0 },
            maxBearingDisp: { value: 0, bearingId: 1, step: 0 },
          },
        },
        maxBaseShear: 0,
        maxRoofDisplacement: 0,
      },
      isolatedUpper: null,
      isolatedLower: null,
      fixedBase: {
        timeHistoryResults: null,
        maxBaseShear: 0,
        maxRoofDisplacement: 0,
      },
      lambdaFactors: null,
    };

    capturedConfig.onResult?.(result);

    const display = getDisplayState();
    const analysis = getAnalysisState();
    expect(display.showDeformed).toBe(true);
    expect(display.scaleFactor).toBe(100);
    expect(display.showForces).toBe(false);
    expect(display.forceType).toBe('none');
    expect(display.colorMap).toBe('none');
    expect(display.showComparisonOverlay).toBe(true);
    expect(display.showBearingDisplacement).toBe(true);
    expect(display.showBaseShearLabels).toBe(false);
    expect(analysis.currentTimeStep).toBe(0);
    expect(analysis.isPlaying).toBe(false);
  });
});
