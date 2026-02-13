/**
 * Barrel export for all IsoVis type definitions.
 *
 * Usage:
 *   import type { StructuralModel, AnalysisResults } from '@/types';
 *   import { VIEW_PRESETS, HINGE_COLORS } from '@/types';
 */

// --- Model types -----------------------------------------------------------
export type {
  ModelInfo,
  Node,
  MaterialType,
  Material,
  SectionType,
  Section,
  GeometricTransform,
  Element,
  FrictionModelType,
  FrictionModel,
  TFPBearing,
  PointLoad,
  DistributedLoad,
  Load,
  GroundMotion,
  StructuralModel,
} from './model.ts';

// --- Analysis types --------------------------------------------------------
export type {
  AnalysisType,
  Algorithm,
  Integrator,
  AnalysisParams,
  StaticResults,
  ModalResults,
  BearingResponse,
  TimeStep,
  PeakValues,
  TimeHistoryResults,
  PerformanceLevel,
  HingeState,
  AnalysisStatus,
  AnalysisResults,
} from './analysis.ts';

// --- Display types ---------------------------------------------------------
export type {
  DisplayMode,
  ForceType,
  ColorMapType,
  ViewPreset,
  ColorStop,
  AnimationState,
  SelectionState,
} from './display.ts';

export { VIEW_PRESETS, HINGE_COLORS, DC_COLORS } from './display.ts';

// --- Protocol types --------------------------------------------------------
export type {
  DefineModelMessage,
  RunAnalysisMessage,
  CancelAnalysisMessage,
  RequestResultsMessage,
  ClientMessage,
  AnalysisStartedMessage,
  AnalysisProgressMessage,
  StepResultsMessage,
  AnalysisCompleteMessage,
  AnalysisErrorMessage,
  AnalysisWarningMessage,
  ServerMessage,
} from './protocol.ts';
