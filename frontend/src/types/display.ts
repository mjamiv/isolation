/**
 * Display, visualization, and rendering type definitions for IsoVis.
 *
 * These types control how the 3D structural model and analysis results
 * are rendered in the Three.js viewport.
 */

// ---------------------------------------------------------------------------
// Rendering Modes
// ---------------------------------------------------------------------------

export type DisplayMode = 'wireframe' | 'extruded' | 'solid';
export type ForceType = 'moment' | 'shear' | 'axial' | 'none';
export type ColorMapType =
  | 'none'
  | 'demandCapacity'
  | 'displacement'
  | 'stress'
  | 'hingeState';

// ---------------------------------------------------------------------------
// Camera / View Presets
// ---------------------------------------------------------------------------

export interface ViewPreset {
  name: string;
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  orthographic: boolean;
}

export const VIEW_PRESETS: Record<string, ViewPreset> = {
  perspective3D: {
    name: '3D',
    position: [500, 500, 500],
    target: [288, 216, 0],
    up: [0, 1, 0],
    orthographic: false,
  },
  planXY: {
    name: 'Plan XY',
    position: [288, 216, 1000],
    target: [288, 216, 0],
    up: [0, 1, 0],
    orthographic: true,
  },
  elevationXZ: {
    name: 'Elevation X',
    position: [288, 1000, 0],
    target: [288, 0, 0],
    up: [0, 0, 1],
    orthographic: true,
  },
  elevationYZ: {
    name: 'Elevation Y',
    position: [1000, 216, 0],
    target: [0, 216, 0],
    up: [0, 1, 0],
    orthographic: true,
  },
} as const;

// ---------------------------------------------------------------------------
// Performance Level Hinge Colors
// ---------------------------------------------------------------------------

/**
 * Color mapping for ASCE 41 performance levels displayed on plastic hinges.
 * Progresses from grey (elastic) through green/yellow/orange to red/black (collapse).
 */
export const HINGE_COLORS: Record<string, string> = {
  elastic: '#808080',
  yield: '#87CEEB',
  IO: '#00AA00',
  'IO-LS': '#CCCC00',
  LS: '#FF8800',
  'LS-CP': '#FF4400',
  CP: '#FF0000',
  beyondCP: '#8B0000',
  collapse: '#000000',
} as const;

// ---------------------------------------------------------------------------
// Demand/Capacity Ratio Color Scale
// ---------------------------------------------------------------------------

export interface ColorStop {
  value: number;
  color: string;
}

/**
 * Continuous color scale for demand-to-capacity ratios.
 * Green (safe) -> yellow (moderate) -> red (critical) -> dark red (exceeded).
 */
export const DC_COLORS: readonly ColorStop[] = [
  { value: 0.0, color: '#006400' },
  { value: 0.25, color: '#00AA00' },
  { value: 0.5, color: '#AAFF00' },
  { value: 0.7, color: '#FFFF00' },
  { value: 0.85, color: '#FF8800' },
  { value: 0.95, color: '#FF4400' },
  { value: 1.0, color: '#FF0000' },
  { value: 1.5, color: '#8B0000' },
] as const;

// ---------------------------------------------------------------------------
// Animation / Playback
// ---------------------------------------------------------------------------

export interface AnimationState {
  playing: boolean;
  currentStep: number;
  totalSteps: number;
  speed: number; // playback speed multiplier (1 = real-time)
  loop: boolean;
}

// ---------------------------------------------------------------------------
// Selection State
// ---------------------------------------------------------------------------

export interface SelectionState {
  selectedNodes: number[];
  selectedElements: number[];
  selectedBearings: number[];
  hoveredNode: number | null;
  hoveredElement: number | null;
}
