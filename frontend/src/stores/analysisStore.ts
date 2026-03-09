import { create } from 'zustand';
import type { AnalysisType, AnalysisResults } from '@/types/analysis';

// Re-export the canonical types from analysis.ts for backward compat
export type { AnalysisResults };

// ── Store types ──────────────────────────────────────────────────────

export type AnalysisStatus = 'idle' | 'running' | 'complete' | 'error';

interface CachedAnalysis {
  results: AnalysisResults;
  analysisType: AnalysisType;
}

// ── Store interface ───────────────────────────────────────────────────

/**
 * Analysis store state. Playback (currentTimeStep, isPlaying, playbackSpeed, loopPlayback) drives
 * time-history and mode-shape animation; setResults resets currentTimeStep to 0 and stops playback
 * to avoid out-of-range reads. resultCache preserves results per model name when switching presets
 * within a session; restoreFromCache restores without re-running.
 */
interface AnalysisState {
  status: AnalysisStatus;
  progress: number; // 0 - 100
  currentStep: number;
  totalSteps: number;
  analysisId: string | null;
  analysisType: AnalysisType | null;
  results: AnalysisResults | null;
  /** Index into time-history steps; clamped by PlaybackDriver when results change. */
  currentTimeStep: number;
  isPlaying: boolean;
  /** Playback speed multiplier (0.25, 0.5, 1, 2, 4). */
  playbackSpeed: number;
  loopPlayback: boolean;
  selectedModeNumber: number | null;
  error: string | null;
  /** Per-model result cache keyed by model name. Session-scoped; switching presets preserves cached results. */
  resultCache: Map<string, CachedAnalysis>;

  // Actions
  startAnalysis: () => void;
  setAnalysisId: (id: string) => void;
  setAnalysisType: (type: AnalysisType) => void;
  setProgress: (progress: number, currentStep: number, totalSteps: number) => void;
  /** Sets results, status=complete, progress=100, currentTimeStep=0, isPlaying=false. */
  setResults: (results: AnalysisResults) => void;
  setError: (error: string) => void;
  resetAnalysis: () => void;
  /** Save current results to cache under model name. No-op if results or analysisType is null. */
  saveToCache: (modelName: string) => void;
  /** Restore cached results for model name; resets playback state. Returns true if cache hit. */
  restoreFromCache: (modelName: string) => boolean;
  setTimeStep: (step: number) => void;
  togglePlayback: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setLoopPlayback: (loop: boolean) => void;
  setSelectedModeNumber: (mode: number | null) => void;
}

// ── Store implementation ──────────────────────────────────────────────

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  status: 'idle',
  progress: 0,
  currentStep: 0,
  totalSteps: 0,
  analysisId: null,
  analysisType: null,
  results: null,
  currentTimeStep: 0,
  isPlaying: false,
  playbackSpeed: 1,
  loopPlayback: true,
  selectedModeNumber: null,
  error: null,
  resultCache: new Map(),

  startAnalysis: () =>
    set({
      status: 'running',
      progress: 0,
      currentStep: 0,
      totalSteps: 0,
      results: null,
      error: null,
    }),

  setAnalysisId: (id) => set({ analysisId: id }),

  setAnalysisType: (type) => set({ analysisType: type }),

  setProgress: (progress, currentStep, totalSteps) => set({ progress, currentStep, totalSteps }),

  setResults: (results) =>
    set({
      results,
      status: 'complete',
      progress: 100,
      currentTimeStep: 0,
      isPlaying: false,
    }),

  setError: (error) =>
    set({
      error,
      status: 'error',
    }),

  resetAnalysis: () =>
    set({
      status: 'idle',
      progress: 0,
      currentStep: 0,
      totalSteps: 0,
      analysisId: null,
      analysisType: null,
      results: null,
      currentTimeStep: 0,
      isPlaying: false,
      loopPlayback: true,
      selectedModeNumber: null,
      error: null,
    }),

  saveToCache: (modelName) => {
    const { results, analysisType, resultCache } = get();
    if (!results || !analysisType) return;
    const next = new Map(resultCache);
    next.set(modelName, { results, analysisType });
    set({ resultCache: next });
  },

  restoreFromCache: (modelName) => {
    const cached = get().resultCache.get(modelName);
    if (!cached) return false;
    set({
      results: cached.results,
      analysisType: cached.analysisType,
      status: 'complete',
      progress: 100,
      currentTimeStep: 0,
      isPlaying: false,
      loopPlayback: true,
      selectedModeNumber: null,
      error: null,
    });
    return true;
  },

  setTimeStep: (step) => set({ currentTimeStep: step }),

  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setLoopPlayback: (loop) => set({ loopPlayback: loop }),

  setSelectedModeNumber: (mode) => set({ selectedModeNumber: mode }),
}));
