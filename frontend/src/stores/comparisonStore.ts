import { create } from 'zustand';
import type {
  ComparisonRun,
  ComparisonSummary,
  LambdaFactors,
  VariantResult,
} from '@/types/comparison';

// ── Store types ──────────────────────────────────────────────────────

export type ComparisonStatus = 'idle' | 'running' | 'complete' | 'error';

// ── Store interface ───────────────────────────────────────────────────

interface ComparisonState {
  status: ComparisonStatus;
  comparisonId: string | null;
  /** Isolated system results (nominal friction). */
  isolated: VariantResult | null;
  /** Isolated with upper-bound lambda factor. */
  isolatedUpper: VariantResult | null;
  /** Isolated with lower-bound lambda factor. */
  isolatedLower: VariantResult | null;
  /** Fixed-base (ductile) system results. */
  fixedBase: VariantResult | null;
  /** Lambda factors used (if any). */
  lambdaFactors: LambdaFactors | null;
  /** Computed summary metrics. */
  summary: ComparisonSummary | null;
  error: string | null;

  // Actions
  startComparison: () => void;
  setComparisonId: (id: string) => void;
  setResults: (run: ComparisonRun) => void;
  setSummary: (summary: ComparisonSummary) => void;
  setError: (error: string) => void;
  resetComparison: () => void;
}

// ── Store implementation ──────────────────────────────────────────────

export const useComparisonStore = create<ComparisonState>((set) => ({
  status: 'idle',
  comparisonId: null,
  isolated: null,
  isolatedUpper: null,
  isolatedLower: null,
  fixedBase: null,
  lambdaFactors: null,
  summary: null,
  error: null,

  startComparison: () =>
    set({
      status: 'running',
      isolated: null,
      isolatedUpper: null,
      isolatedLower: null,
      fixedBase: null,
      lambdaFactors: null,
      summary: null,
      error: null,
    }),

  setComparisonId: (id) =>
    set({ comparisonId: id }),

  setResults: (run) =>
    set({
      status: run.status === 'complete' ? 'complete' : run.status === 'error' ? 'error' : 'running',
      comparisonId: run.comparisonId,
      isolated: run.isolated,
      isolatedUpper: run.isolatedUpper,
      isolatedLower: run.isolatedLower,
      fixedBase: run.fixedBase,
      lambdaFactors: run.lambdaFactors,
      error: run.error ?? null,
    }),

  setSummary: (summary) =>
    set({ summary }),

  setError: (error) =>
    set({ error, status: 'error' }),

  resetComparison: () =>
    set({
      status: 'idle',
      comparisonId: null,
      isolated: null,
      isolatedUpper: null,
      isolatedLower: null,
      fixedBase: null,
      lambdaFactors: null,
      summary: null,
      error: null,
    }),
}));
