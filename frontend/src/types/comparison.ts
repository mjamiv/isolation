/**
 * Type definitions for the ductile vs isolated comparison framework.
 *
 * Supports paired analysis results (isolated + fixed-base), ASCE 7-22
 * Chapter 17 lambda factor bounds, and summary dashboard metrics.
 */

import type { AnalysisParams, PushoverResults, HingeState, TimeHistoryResults } from './analysis';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type BoundType = 'nominal' | 'upper' | 'lower';

export interface LambdaFactors {
  /** Lower-bound property modification factor (default 0.85). */
  min: number;
  /** Upper-bound property modification factor (default 1.8). */
  max: number;
}

export interface ComparisonParams {
  /** Base analysis parameters (pushover). */
  analysisParams: AnalysisParams;
  /** Optional lambda factors for upper/lower bound runs. */
  lambdaFactors?: LambdaFactors;
}

// ---------------------------------------------------------------------------
// Model Variants
// ---------------------------------------------------------------------------

export type ModelVariant = 'isolated' | 'fixedBase';

// ---------------------------------------------------------------------------
// Comparison Results
// ---------------------------------------------------------------------------

export interface VariantResult {
  /** Pushover capacity curve data (populated for pushover comparisons). */
  pushoverResults?: PushoverResults | null;
  /** Time-history results (populated for time-history comparisons). */
  timeHistoryResults?: TimeHistoryResults | null;
  /** Plastic hinge states at final step. */
  hingeStates?: HingeState[];
  /** Max base shear achieved. */
  maxBaseShear: number;
  /** Max roof displacement achieved. */
  maxRoofDisplacement: number;
}

export interface ComparisonRun {
  comparisonId: string;
  modelId: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  /** Type of comparison analysis performed. */
  comparisonType?: 'pushover' | 'time_history';
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
  /** Error message if failed. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Dashboard Metrics
// ---------------------------------------------------------------------------

export interface DriftProfile {
  /** Story index (0 = ground, 1 = first story, etc.). */
  story: number;
  /** Story height (inches). */
  height: number;
  /** Drift ratio for isolated system. */
  isolatedDrift: number;
  /** Drift ratio for fixed-base system. */
  fixedBaseDrift: number;
}

export interface BaseShearComparison {
  /** Max base shear for isolated system (kips). */
  isolatedBaseShear: number;
  /** Max base shear for fixed-base system (kips). */
  fixedBaseBaseShear: number;
  /** Percentage reduction in base shear: (fixed - isolated) / fixed * 100. */
  reductionPercent: number;
}

export interface BearingDemand {
  bearingId: number;
  /** Peak displacement demand (inches). */
  demand: number;
  /** Displacement capacity (inches). */
  capacity: number;
  /** Demand/capacity ratio. */
  dcRatio: number;
}

export interface HingeDistribution {
  /** Performance level label. */
  level: 'IO' | 'LS' | 'CP';
  /** Count for isolated system. */
  isolatedCount: number;
  /** Count for fixed-base system. */
  fixedBaseCount: number;
}

export interface ComparisonSummary {
  driftProfiles: DriftProfile[];
  baseShear: BaseShearComparison;
  bearingDemands: BearingDemand[];
  hingeDistribution: HingeDistribution[];
}
