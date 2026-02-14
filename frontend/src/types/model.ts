/**
 * Canonical structural model type definitions for IsoVis.
 *
 * These types mirror the backend Pydantic schemas (snake_case in JSON)
 * but use camelCase for idiomatic TypeScript. The API client layer
 * handles the camelCase <-> snake_case translation.
 *
 * Backend schema source: backend/app/schemas/model.py
 */

// ---------------------------------------------------------------------------
// Model Metadata
// ---------------------------------------------------------------------------

export interface ModelInfo {
  name: string;
  units: { force: string; length: string; time: string };
  ndm: 2 | 3;
  ndf: 3 | 6;
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

export interface Node {
  id: number;
  coords: [number, number, number];
  /** Boundary-condition flags per DOF: 1 = fixed, 0 = free. */
  fixity: [number, number, number, number, number, number];
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

/** Supported OpenSees material types (non-exhaustive). */
export type MaterialType =
  | 'Elastic'
  | 'Steel02'
  | 'Concrete02'
  | 'Hysteretic'
  | 'ElasticPP'
  | string;

export interface Material {
  id: number;
  type: MaterialType;
  name: string;
  params: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/** Supported OpenSees section types (non-exhaustive). */
export type SectionType =
  | 'WideFlange'
  | 'Rectangular'
  | 'Circular'
  | 'FiberSection'
  | 'Elastic'
  | string;

export interface Section {
  id: number;
  type: SectionType;
  name: string;
  properties: Record<string, number>;
  materialId: number;
}

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

export type GeometricTransform = 'Linear' | 'PDelta' | 'Corotational';

export interface Element {
  id: number;
  type: string; // e.g. 'elasticBeamColumn', 'forceBeamColumn', 'truss'
  nodes: [number, number];
  sectionId: number;
  transform: GeometricTransform;
}

// ---------------------------------------------------------------------------
// Friction Model & TFP Bearing
// ---------------------------------------------------------------------------

export type FrictionModelType = 'Coulomb' | 'VelDependent' | 'VelPressureDep';

export interface FrictionModel {
  type: FrictionModelType;
  muSlow: number;
  muFast: number;
  transRate: number;
}

/**
 * Triple Friction Pendulum Bearing element.
 *
 * Four friction surfaces with velocity-dependent friction, three effective
 * pendulum radii, and three displacement capacities.
 */
export interface TFPBearing {
  id: number;
  nodes: [number, number];
  frictionModels: [FrictionModel, FrictionModel, FrictionModel, FrictionModel];
  /** Effective radii of curvature [L1, L2, L3]. */
  radii: [number, number, number];
  /** Displacement capacities [d1, d2, d3]. */
  dispCapacities: [number, number, number];
  /** Vertical load on bearing (force units). */
  weight: number;
  /** Yield displacement for initial stiffness calculation. */
  uy: number;
  /** Vertical stiffness factor. */
  kvt: number;
  /** Minimum vertical force ratio. */
  minFv: number;
  /** Newton-Raphson convergence tolerance. */
  tol: number;
}

// ---------------------------------------------------------------------------
// Loads
// ---------------------------------------------------------------------------

export interface PointLoad {
  type: 'nodeLoad';
  nodeId: number;
  /** Force/moment values: [Fx, Fy, Fz, Mx, My, Mz]. */
  values: [number, number, number, number, number, number];
}

export interface DistributedLoad {
  type: 'elementLoad';
  elementId: number;
  values: number[];
  direction: 'local' | 'global';
}

export type Load = PointLoad | DistributedLoad;

// ---------------------------------------------------------------------------
// Ground Motion
// ---------------------------------------------------------------------------

export interface GroundMotion {
  id: number;
  name: string;
  /** Time step of the acceleration record (seconds). */
  dt: number;
  /** Acceleration values (consistent units). */
  acceleration: number[];
  /** DOF direction: 1 = X, 2 = Y, 3 = Z. */
  direction: 1 | 2 | 3;
  /** Multiplier applied to the acceleration record. */
  scaleFactor: number;
}

// ---------------------------------------------------------------------------
// Top-Level Structural Model
// ---------------------------------------------------------------------------

/**
 * Complete structural model definition.
 *
 * This is the canonical payload sent to the backend via the REST API.
 * The backend schema `StructuralModelSchema` is the Python equivalent.
 */
export interface StructuralModel {
  modelInfo: ModelInfo;
  nodes: Node[];
  materials: Material[];
  sections: Section[];
  elements: Element[];
  bearings: TFPBearing[];
  loads: Load[];
  groundMotions: GroundMotion[];
}
