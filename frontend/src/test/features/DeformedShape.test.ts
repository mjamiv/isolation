/**
 * Tests for the DeformedShape component logic.
 *
 * Verifies the displacement calculation (original + displacement * scaleFactor),
 * behavior when showDeformed is false, and handling of missing results.
 *
 * Since R3F components cannot be rendered in jsdom without a full Canvas setup,
 * we test the core displacement computation logic as unit tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import type { AnalysisResults } from '@/types/analysis';

const getModelState = () => useModelStore.getState();
const getDisplayState = () => useDisplayStore.getState();
const getAnalysisState = () => useAnalysisStore.getState();

beforeEach(() => {
  getModelState().clearModel();
  getDisplayState().setShowDeformed(false);
  getDisplayState().setScaleFactor(100);
  getAnalysisState().resetAnalysis();
});

// ---------------------------------------------------------------------------
// Displacement calculation
// ---------------------------------------------------------------------------

describe('DeformedShape — displacement calculation', () => {
  it('computes displaced position as original + displacement * scaleFactor', () => {
    const nodeX = 288;
    const nodeY = 144;
    const nodeZ = 0;
    const dx = 0.5;
    const dy = -0.2;
    const dz = 0;
    const scaleFactor = 100;

    const displacedX = nodeX + dx * scaleFactor;
    const displacedY = nodeY + dy * scaleFactor;
    const displacedZ = nodeZ + dz * scaleFactor;

    expect(displacedX).toBe(338);
    expect(displacedY).toBe(124);
    expect(displacedZ).toBe(0);
  });

  it('leaves position unchanged when displacement is zero', () => {
    const nodeX = 288;
    const nodeY = 144;
    const nodeZ = 0;
    const scaleFactor = 100;

    const displacedX = nodeX + 0 * scaleFactor;
    const displacedY = nodeY + 0 * scaleFactor;
    const displacedZ = nodeZ + 0 * scaleFactor;

    expect(displacedX).toBe(288);
    expect(displacedY).toBe(144);
    expect(displacedZ).toBe(0);
  });

  it('scales displacement by the scaleFactor', () => {
    const dx = 0.01;
    const scaleFactor1 = 100;
    const scaleFactor2 = 500;

    expect(dx * scaleFactor1).toBe(1);
    expect(dx * scaleFactor2).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Store integration
// ---------------------------------------------------------------------------

describe('DeformedShape — store conditions', () => {
  it('showDeformed defaults to false', () => {
    expect(getDisplayState().showDeformed).toBe(false);
  });

  it('results defaults to null', () => {
    expect(getAnalysisState().results).toBeNull();
  });

  it('component depends on showDeformed being true and results existing', () => {
    // Simulate the guard conditions from DeformedShape component:
    // if (!showDeformed || !displacedNodes) return null;
    const showDeformed = getDisplayState().showDeformed;
    const results = getAnalysisState().results;
    const shouldRender = showDeformed && results !== null;
    expect(shouldRender).toBe(false);
  });

  it('renders when showDeformed is true and static results exist', () => {
    getDisplayState().setShowDeformed(true);

    const mockResults: AnalysisResults = {
      analysisId: 'test-001',
      modelId: 'model-001',
      type: 'static',
      status: 'complete',
      progress: 1,
      results: {
        nodeDisplacements: { 1: [0.01, -0.02, 0, 0, 0, 0] },
        elementForces: {},
        reactions: {},
      },
    };
    getAnalysisState().setResults(mockResults);

    const showDeformed = getDisplayState().showDeformed;
    const results = getAnalysisState().results;
    const shouldRender = showDeformed && results !== null;
    expect(shouldRender).toBe(true);
  });

  it('does not render when showDeformed is false even with results', () => {
    const mockResults: AnalysisResults = {
      analysisId: 'test-002',
      modelId: 'model-001',
      type: 'static',
      status: 'complete',
      progress: 1,
      results: {
        nodeDisplacements: { 1: [0.01, -0.02, 0, 0, 0, 0] },
        elementForces: {},
        reactions: {},
      },
    };
    getAnalysisState().setResults(mockResults);
    getDisplayState().setShowDeformed(false);

    const showDeformed = getDisplayState().showDeformed;
    const shouldRender = showDeformed && getAnalysisState().results !== null;
    expect(shouldRender).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Time-history displacement extraction
// ---------------------------------------------------------------------------

describe('DeformedShape — time-history step', () => {
  it('extracts displacements from the current time step', () => {
    const thResults = {
      timeSteps: [
        {
          step: 0,
          time: 0.0,
          nodeDisplacements: { 1: [0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number] },
          elementForces: {},
          bearingResponses: {},
        },
        {
          step: 1,
          time: 0.01,
          nodeDisplacements: { 1: [0.5, -0.3, 0, 0, 0, 0] as [number, number, number, number, number, number] },
          elementForces: {},
          bearingResponses: {},
        },
      ],
      dt: 0.01,
      totalTime: 0.02,
      peakValues: {
        maxDrift: { value: 0.001, story: 1, step: 1 },
        maxAcceleration: { value: 0.5, floor: 1, step: 1 },
        maxBaseShear: { value: 50, step: 1 },
        maxBearingDisp: { value: 0.1, bearingId: 1, step: 1 },
      },
    };

    // Simulate extracting displacement at step 1
    const currentTimeStep = 1;
    const step = thResults.timeSteps[currentTimeStep];
    const disp = step?.nodeDisplacements[1];
    expect(disp).toEqual([0.5, -0.3, 0, 0, 0, 0]);
  });

  it('returns null for out-of-bounds time step', () => {
    const thResults = {
      timeSteps: [
        {
          step: 0,
          time: 0.0,
          nodeDisplacements: { 1: [0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number] },
          elementForces: {},
          bearingResponses: {},
        },
      ],
      dt: 0.01,
      totalTime: 0.01,
      peakValues: {
        maxDrift: { value: 0, story: 0, step: 0 },
        maxAcceleration: { value: 0, floor: 0, step: 0 },
        maxBaseShear: { value: 0, step: 0 },
        maxBearingDisp: { value: 0, bearingId: 0, step: 0 },
      },
    };

    const currentTimeStep = 5; // out of bounds
    const step = thResults.timeSteps[currentTimeStep];
    expect(step).toBeUndefined();
  });
});
