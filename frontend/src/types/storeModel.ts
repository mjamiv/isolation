export interface Node {
  id: number;
  x: number;
  y: number;
  z: number;
  restraint: [boolean, boolean, boolean, boolean, boolean, boolean]; // Tx,Ty,Tz,Rx,Ry,Rz
  mass?: number;
  label?: string;
}

export interface Element {
  id: number;
  type: 'column' | 'beam' | 'pierCap' | 'brace' | 'bearing';
  nodeI: number;
  nodeJ: number;
  sectionId: number;
  materialId: number;
  releases?: [boolean, boolean, boolean, boolean, boolean, boolean]; // moment releases at I,J
  label?: string;
}

/** Section properties. Lengths in inches (d, bf, tw, tf); area in², I in⁴, Zx in³. */
export interface Section {
  id: number;
  name: string;
  area: number;
  Ix: number;
  Iy: number;
  Zx: number;
  d: number;
  bf: number;
  tw: number;
  tf: number;
}

/** Material. E and Fy in ksi, density in pcf. */
export interface Material {
  id: number;
  name: string;
  E: number;
  Fy: number;
  density: number;
  nu: number;
}

export type FrictionModelType = 'Coulomb' | 'VelDependent' | 'VelPressureDep';

/**
 * Friction surface for TFP bearing. Surfaces 1-2 (inner pair) and 3-4 (outer pair) share values.
 * muSlow/muFast: friction coefficients (typically 0.02–0.15); transRate: velocity transition (in/s).
 */
export interface FrictionSurface {
  type: FrictionModelType;
  muSlow: number;
  muFast: number;
  transRate: number;
}

/**
 * Triple Friction Pendulum bearing. OpenSeesPy TripleFrictionPendulum requires Z-up (DOF 3 = compression).
 * radii: [L1, L2, L3] effective pendulum radii (length units, e.g. in). dispCapacities: [d1, d2, d3] (length).
 * vertStiffness: elastic spring (can be large); kvt (tension) is separate and must stay low (~1.0) for convergence.
 */
export interface TFPBearing {
  id: number;
  nodeI: number;
  nodeJ: number;
  surfaces: [FrictionSurface, FrictionSurface, FrictionSurface, FrictionSurface];
  radii: [number, number, number]; // [L1, L2, L3] effective pendulum radii (length units)
  dispCapacities: [number, number, number]; // [d1, d2, d3] displacement capacities (length units)
  weight: number; // vertical load on bearing (force units)
  yieldDisp: number; // yield displacement for initial stiffness
  vertStiffness: number; // vertical stiffness factor
  minVertForce: number; // minimum vertical force ratio
  tolerance: number; // Newton-Raphson convergence tolerance
  label?: string;
}

export interface PointLoad {
  id: number;
  nodeId: number;
  fx: number;
  fy: number;
  fz: number;
  mx: number;
  my: number;
  mz: number;
}

/**
 * Ground motion record. direction: 1=X, 2=Y, 3=Z. scaleFactor: g→accel units (e.g. 386.4 for in/s²).
 */
export interface GroundMotionRecord {
  id: number;
  name: string;
  dt: number;
  acceleration: number[];
  direction: 1 | 2 | 3;
  scaleFactor: number;
}

/**
 * Rigid diaphragm constraint. All constrained nodes move together in-plane; perpDirection (2=Y, 3=Z)
 * is the out-of-plane axis. Serialized with Y/Z swap for backend Z-up convention.
 */
export interface RigidDiaphragm {
  id: number;
  masterNodeId: number;
  constrainedNodeIds: number[];
  perpDirection: 2 | 3;
  label?: string;
}

/**
 * EqualDOF constraint (e.g. bridge deck-to-cap link). retainedNodeId: master; constrainedNodeId: slave.
 * dofs: DOF indices (e.g. [2] vertical, [2,3] vertical+transverse).
 */
export interface EqualDOFConstraint {
  id: number;
  retainedNodeId: number;
  constrainedNodeId: number;
  dofs: number[];
  label?: string;
}

export interface StructuralModel {
  name: string;
  units: string;
  description: string;
}
