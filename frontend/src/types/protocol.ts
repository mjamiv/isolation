/**
 * WebSocket message protocol definitions for IsoVis.
 *
 * Defines the typed contract between the browser client and the
 * FastAPI/WebSocket backend for real-time analysis streaming.
 *
 * Wire format: JSON with snake_case keys (Python convention).
 * The WebSocket client translates to/from camelCase on the TS side.
 */

import type { AnalysisParams } from './analysis.ts';
import type { TimeStep } from './analysis.ts';
import type { StructuralModel } from './model.ts';

// ---------------------------------------------------------------------------
// Client -> Server Messages
// ---------------------------------------------------------------------------

export interface DefineModelMessage {
  action: 'define_model';
  model: StructuralModel;
}

export interface RunAnalysisMessage {
  action: 'run_analysis';
  analysisId: string;
  params: AnalysisParams;
}

export interface CancelAnalysisMessage {
  action: 'cancel_analysis';
  analysisId: string;
}

export interface RequestResultsMessage {
  action: 'request_results';
  analysisId: string;
  /** Inclusive step range [startStep, endStep]. */
  stepRange: [number, number];
}

export type ClientMessage =
  | DefineModelMessage
  | RunAnalysisMessage
  | CancelAnalysisMessage
  | RequestResultsMessage;

// ---------------------------------------------------------------------------
// Server -> Client Messages
// ---------------------------------------------------------------------------

export interface AnalysisStartedMessage {
  event: 'analysis_started';
  analysisId: string;
  totalSteps: number;
}

export interface AnalysisProgressMessage {
  event: 'analysis_progress';
  step: number;
  time: number;
  convergence: boolean;
}

export interface StepResultsMessage {
  event: 'step_results';
  step: number;
  data: TimeStep;
}

export interface AnalysisCompleteMessage {
  event: 'analysis_complete';
  analysisId: string;
  wallTime: number;
}

export interface AnalysisErrorMessage {
  event: 'analysis_error';
  step: number;
  message: string;
}

export interface AnalysisWarningMessage {
  event: 'analysis_warning';
  message: string;
}

export type ServerMessage =
  | AnalysisStartedMessage
  | AnalysisProgressMessage
  | StepResultsMessage
  | AnalysisCompleteMessage
  | AnalysisErrorMessage
  | AnalysisWarningMessage;
