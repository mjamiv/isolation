import { create } from 'zustand';
import type {
  AnalysisType,
  AnalysisResults,
} from '@/types/analysis';

// Re-export the canonical types from analysis.ts for backward compat
export type { AnalysisResults };

// ── Store types ──────────────────────────────────────────────────────

export type AnalysisStatus = 'idle' | 'running' | 'complete' | 'error';

// ── Store interface ───────────────────────────────────────────────────

interface AnalysisState {
  status: AnalysisStatus;
  progress: number;        // 0 - 100
  currentStep: number;
  totalSteps: number;
  analysisId: string | null;
  analysisType: AnalysisType | null;
  results: AnalysisResults | null;
  currentTimeStep: number;
  isPlaying: boolean;
  playbackSpeed: number;   // multiplier: 0.25, 0.5, 1, 2, 4
  error: string | null;

  // Actions
  startAnalysis: () => void;
  setAnalysisId: (id: string) => void;
  setAnalysisType: (type: AnalysisType) => void;
  setProgress: (progress: number, currentStep: number, totalSteps: number) => void;
  setResults: (results: AnalysisResults) => void;
  setError: (error: string) => void;
  resetAnalysis: () => void;
  setTimeStep: (step: number) => void;
  togglePlayback: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setIsPlaying: (playing: boolean) => void;
}

// ── Store implementation ──────────────────────────────────────────────

export const useAnalysisStore = create<AnalysisState>((set) => ({
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
  error: null,

  startAnalysis: () =>
    set({
      status: 'running',
      progress: 0,
      currentStep: 0,
      totalSteps: 0,
      results: null,
      error: null,
    }),

  setAnalysisId: (id) =>
    set({ analysisId: id }),

  setAnalysisType: (type) =>
    set({ analysisType: type }),

  setProgress: (progress, currentStep, totalSteps) =>
    set({ progress, currentStep, totalSteps }),

  setResults: (results) =>
    set({
      results,
      status: 'complete',
      progress: 100,
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
      error: null,
    }),

  setTimeStep: (step) =>
    set({ currentTimeStep: step }),

  togglePlayback: () =>
    set((state) => ({ isPlaying: !state.isPlaying })),

  setPlaybackSpeed: (speed) =>
    set({ playbackSpeed: speed }),

  setIsPlaying: (playing) =>
    set({ isPlaying: playing }),
}));
