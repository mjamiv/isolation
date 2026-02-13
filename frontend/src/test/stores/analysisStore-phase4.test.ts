/**
 * Tests for Phase 4 additions to the analysis Zustand store.
 *
 * Covers selectedModeNumber, setIsPlaying, and setSelectedModeNumber.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAnalysisStore } from '@/stores/analysisStore';

const getState = () => useAnalysisStore.getState();

beforeEach(() => {
  getState().resetAnalysis();
});

// ---------------------------------------------------------------------------
// selectedModeNumber
// ---------------------------------------------------------------------------

describe('analysisStore — selectedModeNumber', () => {
  it('initializes with null selectedModeNumber', () => {
    expect(getState().selectedModeNumber).toBeNull();
  });

  it('setSelectedModeNumber stores the mode number', () => {
    getState().setSelectedModeNumber(1);
    expect(getState().selectedModeNumber).toBe(1);
  });

  it('setSelectedModeNumber can update to a different mode', () => {
    getState().setSelectedModeNumber(1);
    getState().setSelectedModeNumber(3);
    expect(getState().selectedModeNumber).toBe(3);
  });

  it('setSelectedModeNumber can be set back to null', () => {
    getState().setSelectedModeNumber(2);
    getState().setSelectedModeNumber(null);
    expect(getState().selectedModeNumber).toBeNull();
  });

  it('resetAnalysis clears selectedModeNumber', () => {
    getState().setSelectedModeNumber(5);
    getState().resetAnalysis();
    expect(getState().selectedModeNumber).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setIsPlaying
// ---------------------------------------------------------------------------

describe('analysisStore — setIsPlaying', () => {
  it('sets isPlaying to true', () => {
    getState().setIsPlaying(true);
    expect(getState().isPlaying).toBe(true);
  });

  it('sets isPlaying to false', () => {
    getState().setIsPlaying(true);
    getState().setIsPlaying(false);
    expect(getState().isPlaying).toBe(false);
  });

  it('setIsPlaying is independent of togglePlayback', () => {
    getState().setIsPlaying(true);
    expect(getState().isPlaying).toBe(true);
    getState().togglePlayback();
    expect(getState().isPlaying).toBe(false);
    getState().setIsPlaying(true);
    expect(getState().isPlaying).toBe(true);
  });
});
