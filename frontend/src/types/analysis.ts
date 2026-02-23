/**
 * Analysis configuration and result type definitions for IsoVis.
 *
 * Mirrors backend/app/schemas/results.py while adding the richer
 * TypeScript discriminated-union patterns the frontend needs for
 * safe result handling.
 */

// ---------------------------------------------------------------------------
// Analysis Configuration
// ---------------------------------------------------------------------------

export type AnalysisType = 'static' | 'modal' | 'time_history' | 'pushover';

export type Algorithm = 'Newton' | 'ModifiedNewton' | 'BFGS' | 'KrylovNewton';
export type Integrator = 'Newmark' | 'HHT' | 'GeneralizedAlpha';

export type PushDirection = 'X' | 'Y';
export type LoadPattern = 'linear' | 'first_mode';

export interface GroundMotionInput {
  dt: number;
  acceleration: number[];
  direction: 1 | 2 | 3;
  scaleFactor: number;
}

export interface AnalysisParams {
  type: AnalysisType;
  /** Time step for transient analysis (seconds). */
  dt?: number;
  /** Total number of analysis steps. */
  numSteps?: number;
  /** Number of modes to extract (modal analysis). */
  numModes?: number;
  /** IDs of GroundMotion records to apply (time-history). */
  groundMotionIds?: number[];
  /** Full ground motion records expected by backend solver. */
  groundMotions?: GroundMotionInput[];
  /** Nonlinear solution algorithm. */
  algorithm?: Algorithm;
  /** Time integration scheme. */
  integrator?: Integrator;
  /** Parameters for the selected integrator (e.g. [gamma, beta] for Newmark). */
  integratorParams?: number[];
  /** Newton-Raphson convergence tolerance. */
  convergenceTol?: number;
  /** Maximum Newton-Raphson iterations per step. */
  maxIterations?: number;
  /** Target roof displacement for pushover (inches). */
  targetDisplacement?: number;
  /** Push direction for pushover analysis. */
  pushDirection?: PushDirection;
  /** Lateral load pattern for pushover analysis. */
  loadPattern?: LoadPattern;
  /** Displacement increment for pushover analysis (inches). */
  displacementIncrement?: number;
}

// ---------------------------------------------------------------------------
// Static Results
// ---------------------------------------------------------------------------

export interface StaticResults {
  /** nodeId -> [dx, dy, dz, rx, ry, rz] */
  nodeDisplacements: Record<number, [number, number, number, number, number, number]>;
  /** elementId -> local force vector */
  elementForces: Record<number, number[]>;
  /** Fixed nodeId -> [Fx, Fy, Fz, Mx, My, Mz] */
  reactions: Record<number, [number, number, number, number, number, number]>;
  /** Maps original element ID to its discretized node chain and sub-element IDs. */
  discretizationMap?: Record<number, { nodeChain: number[]; subElementIds: number[] }>;
  /** Maps internal (discretization) node ID to its [x, y, z] coordinates. */
  internalNodeCoords?: Record<number, number[]>;
}

// ---------------------------------------------------------------------------
// Modal Results
// ---------------------------------------------------------------------------

export interface ModalResults {
  /** Natural periods for each mode (seconds). */
  periods: number[];
  /** Natural frequencies for each mode (Hz). */
  frequencies: number[];
  /** mode number -> nodeId -> [dx, dy, dz] */
  modeShapes: Record<number, Record<number, [number, number, number]>>;
  /** mode number -> { x, y, z } mass participation ratios (0..1). */
  massParticipation: Record<number, { x: number; y: number; z: number }>;
}

// ---------------------------------------------------------------------------
// Time-History Results
// ---------------------------------------------------------------------------

export interface BearingResponse {
  /** Lateral displacement [x, y]. */
  displacement: [number, number];
  /** Lateral force [x, y]. */
  force: [number, number];
  /** Vertical (axial) force. */
  axialForce: number;
}

export interface TimeStep {
  step: number;
  time: number;
  /** nodeId -> [dx, dy, dz, rx, ry, rz] */
  nodeDisplacements: Record<number, [number, number, number, number, number, number]>;
  /** elementId -> local force vector */
  elementForces: Record<number, number[]>;
  /** bearingId -> response */
  bearingResponses: Record<number, BearingResponse>;
}

export interface PeakValues {
  maxDrift: { value: number; story: number; step: number };
  maxAcceleration: { value: number; floor: number; step: number };
  maxBaseShear: { value: number; step: number };
  maxBearingDisp: { value: number; bearingId: number; step: number };
}

export interface TimeHistoryResults {
  timeSteps: TimeStep[];
  dt: number;
  totalTime: number;
  peakValues: PeakValues;
  /** Maps original element ID to its discretized node chain and sub-element IDs. */
  discretizationMap?: Record<number, { nodeChain: number[]; subElementIds: number[] }>;
  /** Maps internal (discretization) node ID to its [x, y, z] coordinates. */
  internalNodeCoords?: Record<number, number[]>;
}

// ---------------------------------------------------------------------------
// Pushover Results
// ---------------------------------------------------------------------------

export interface PushoverResults {
  capacityCurve: { baseShear: number; roofDisplacement: number }[];
  maxBaseShear: number;
  maxRoofDisplacement: number;
  ductilityRatio: number;
  nodeDisplacements?: Record<number, [number, number, number, number, number, number]>;
  elementForces?: Record<number, number[]>;
  reactions?: Record<number, [number, number, number, number, number, number]>;
  /** Maps original element ID to its discretized node chain and sub-element IDs. */
  discretizationMap?: Record<number, { nodeChain: number[]; subElementIds: number[] }>;
  /** Maps internal (discretization) node ID to its [x, y, z] coordinates. */
  internalNodeCoords?: Record<number, number[]>;
}

// ---------------------------------------------------------------------------
// Plastic Hinge State (for pushover / nonlinear results)
// ---------------------------------------------------------------------------

export type PerformanceLevel =
  | 'elastic'
  | 'yield'
  | 'IO' // Immediate Occupancy
  | 'LS' // Life Safety
  | 'CP' // Collapse Prevention
  | 'beyondCP'
  | 'collapse';

export interface HingeState {
  elementId: number;
  end: 'i' | 'j';
  rotation: number;
  moment: number;
  performanceLevel: PerformanceLevel;
  demandCapacityRatio: number;
}

// ---------------------------------------------------------------------------
// Unified Analysis Result Envelope
// ---------------------------------------------------------------------------

export type AnalysisStatus = 'pending' | 'running' | 'complete' | 'error';

export interface AnalysisResults {
  analysisId: string;
  modelId: string;
  type: AnalysisType;
  status: AnalysisStatus;
  /** Progress fraction 0..1. */
  progress: number;
  /** Typed results payload; null until status === 'complete'. */
  results: StaticResults | ModalResults | TimeHistoryResults | PushoverResults | null;
  /** Plastic hinge states (populated for pushover / nonlinear analyses). */
  hingeStates?: HingeState[];
  /** Error description if status === 'error'. */
  error?: string;
  /** Wall-clock time of the analysis in seconds. */
  wallTime?: number;
}
