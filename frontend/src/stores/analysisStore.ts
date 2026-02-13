import { create } from 'zustand';

// ── Inline types ──────────────────────────────────────────────────────

export type AnalysisStatus = 'idle' | 'running' | 'complete' | 'error';

export interface ModalResult {
  modeNumber: number;
  period: number;       // seconds
  frequency: number;    // Hz
  massParticipation: { x: number; y: number; z: number };
}

export interface TimeHistoryPoint {
  time: number;
  displacement: number;
  velocity: number;
  acceleration: number;
  baseShear: number;
}

export interface ElementForces {
  elementId: number;
  axial: number;
  shearY: number;
  shearZ: number;
  momentY: number;
  momentZ: number;
  torsion: number;
}

export interface TimeHistoryData {
  dt: number;
  nSteps: number;
  groundMotion: number[];
  responses: Map<number, TimeHistoryPoint[]>; // nodeId -> array of time points
}

export interface AnalysisResults {
  modalResults: ModalResult[];
  maxDisplacement: number;
  maxBaseShear: number;
  maxDrift: number;
  elementForces: Map<number, ElementForces[]>; // elementId -> forces at each time step
  peakDrifts: Map<number, number>;             // storyNumber -> peak drift ratio
}

// ── Store interface ───────────────────────────────────────────────────

interface AnalysisState {
  status: AnalysisStatus;
  progress: number;        // 0 - 100
  currentStep: number;
  totalSteps: number;
  results: AnalysisResults | null;
  timeHistory: TimeHistoryData | null;
  currentTimeStep: number;
  isPlaying: boolean;
  playbackSpeed: number;   // multiplier: 0.25, 0.5, 1, 2, 4
  error: string | null;

  // Actions
  startAnalysis: () => void;
  setProgress: (progress: number, currentStep: number, totalSteps: number) => void;
  setResults: (results: AnalysisResults) => void;
  setTimeHistory: (data: TimeHistoryData) => void;
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
  results: null,
  timeHistory: null,
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

  setProgress: (progress, currentStep, totalSteps) =>
    set({ progress, currentStep, totalSteps }),

  setResults: (results) =>
    set({
      results,
      status: 'complete',
      progress: 100,
    }),

  setTimeHistory: (data) =>
    set({ timeHistory: data }),

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
      results: null,
      timeHistory: null,
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
