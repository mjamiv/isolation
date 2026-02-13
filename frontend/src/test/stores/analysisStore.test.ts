/**
 * Tests for the analysis Zustand store.
 *
 * Covers initial state, result updates, time step management,
 * and playback toggling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAnalysisStore } from '@/stores/analysisStore';
import type { AnalysisResults } from '@/stores/analysisStore';

const getState = () => useAnalysisStore.getState();

beforeEach(() => {
  getState().resetAnalysis();
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('analysisStore — initial state', () => {
  it('initializes as idle with no results', () => {
    expect(getState().status).toBe('idle');
    expect(getState().results).toBeNull();
  });

  it('initializes with zero progress', () => {
    expect(getState().progress).toBe(0);
    expect(getState().currentStep).toBe(0);
    expect(getState().totalSteps).toBe(0);
  });

  it('initializes with playback stopped', () => {
    expect(getState().isPlaying).toBe(false);
    expect(getState().playbackSpeed).toBe(1);
    expect(getState().currentTimeStep).toBe(0);
  });

  it('initializes with no error', () => {
    expect(getState().error).toBeNull();
  });

  it('initializes with no time history', () => {
    expect(getState().timeHistory).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// startAnalysis
// ---------------------------------------------------------------------------

describe('analysisStore — startAnalysis', () => {
  it('sets status to running and clears previous state', () => {
    // Simulate a completed analysis first
    const mockResults: AnalysisResults = {
      modalResults: [],
      maxDisplacement: 1.5,
      maxBaseShear: 100,
      maxDrift: 0.02,
      elementForces: new Map(),
      peakDrifts: new Map(),
    };
    getState().setResults(mockResults);
    expect(getState().status).toBe('complete');

    // Now start a new analysis
    getState().startAnalysis();
    expect(getState().status).toBe('running');
    expect(getState().progress).toBe(0);
    expect(getState().results).toBeNull();
    expect(getState().error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setResults
// ---------------------------------------------------------------------------

describe('analysisStore — setResults', () => {
  it('updates results and changes status to complete', () => {
    const mockResults: AnalysisResults = {
      modalResults: [
        { modeNumber: 1, period: 0.85, frequency: 1.18, massParticipation: { x: 0.82, y: 0.0, z: 0.0 } },
        { modeNumber: 2, period: 0.30, frequency: 3.33, massParticipation: { x: 0.10, y: 0.0, z: 0.0 } },
      ],
      maxDisplacement: 2.1,
      maxBaseShear: 150.5,
      maxDrift: 0.015,
      elementForces: new Map(),
      peakDrifts: new Map([[1, 0.012], [2, 0.015], [3, 0.010]]),
    };

    getState().startAnalysis();
    getState().setResults(mockResults);

    expect(getState().status).toBe('complete');
    expect(getState().progress).toBe(100);
    expect(getState().results).toBe(mockResults);
    expect(getState().results!.modalResults).toHaveLength(2);
    expect(getState().results!.maxDisplacement).toBe(2.1);
  });
});

// ---------------------------------------------------------------------------
// setProgress
// ---------------------------------------------------------------------------

describe('analysisStore — setProgress', () => {
  it('updates progress, currentStep, and totalSteps', () => {
    getState().startAnalysis();
    getState().setProgress(45, 450, 1000);

    expect(getState().progress).toBe(45);
    expect(getState().currentStep).toBe(450);
    expect(getState().totalSteps).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// setTimeStep
// ---------------------------------------------------------------------------

describe('analysisStore — setTimeStep', () => {
  it('updates current time step', () => {
    getState().setTimeStep(42);
    expect(getState().currentTimeStep).toBe(42);
  });

  it('can be set to 0', () => {
    getState().setTimeStep(100);
    getState().setTimeStep(0);
    expect(getState().currentTimeStep).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// togglePlayback
// ---------------------------------------------------------------------------

describe('analysisStore — togglePlayback', () => {
  it('flips isPlaying from false to true', () => {
    expect(getState().isPlaying).toBe(false);
    getState().togglePlayback();
    expect(getState().isPlaying).toBe(true);
  });

  it('flips isPlaying from true to false', () => {
    getState().togglePlayback(); // now true
    getState().togglePlayback(); // now false
    expect(getState().isPlaying).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// setError
// ---------------------------------------------------------------------------

describe('analysisStore — setError', () => {
  it('sets error message and changes status to error', () => {
    getState().startAnalysis();
    getState().setError('Convergence failure at step 42');

    expect(getState().status).toBe('error');
    expect(getState().error).toBe('Convergence failure at step 42');
  });
});

// ---------------------------------------------------------------------------
// setPlaybackSpeed
// ---------------------------------------------------------------------------

describe('analysisStore — setPlaybackSpeed', () => {
  it('updates playback speed multiplier', () => {
    getState().setPlaybackSpeed(4);
    expect(getState().playbackSpeed).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// resetAnalysis
// ---------------------------------------------------------------------------

describe('analysisStore — resetAnalysis', () => {
  it('resets all state back to idle defaults', () => {
    // Set up dirty state
    getState().startAnalysis();
    getState().setProgress(75, 750, 1000);
    getState().togglePlayback();
    getState().setTimeStep(500);

    getState().resetAnalysis();

    expect(getState().status).toBe('idle');
    expect(getState().progress).toBe(0);
    expect(getState().currentStep).toBe(0);
    expect(getState().totalSteps).toBe(0);
    expect(getState().results).toBeNull();
    expect(getState().timeHistory).toBeNull();
    expect(getState().currentTimeStep).toBe(0);
    expect(getState().isPlaying).toBe(false);
    expect(getState().error).toBeNull();
  });
});
