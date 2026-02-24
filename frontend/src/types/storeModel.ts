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
  type: 'column' | 'beam' | 'brace' | 'bearing';
  nodeI: number;
  nodeJ: number;
  sectionId: number;
  materialId: number;
  releases?: [boolean, boolean, boolean, boolean, boolean, boolean]; // moment releases at I,J
  label?: string;
}

export interface Section {
  id: number;
  name: string;
  area: number; // in^2
  Ix: number; // in^4 — strong axis
  Iy: number; // in^4 — weak axis
  Zx: number; // in^3 — plastic modulus
  d: number; // depth in inches
  bf: number; // flange width in inches
  tw: number; // web thickness in inches
  tf: number; // flange thickness in inches
}

export interface Material {
  id: number;
  name: string;
  E: number; // ksi
  Fy: number; // ksi
  density: number; // pcf
  nu: number; // Poisson ratio
}

export type FrictionModelType = 'Coulomb' | 'VelDependent' | 'VelPressureDep';

export interface FrictionSurface {
  type: FrictionModelType;
  muSlow: number;
  muFast: number;
  transRate: number;
}

export interface TFPBearing {
  id: number;
  nodeI: number;
  nodeJ: number;
  surfaces: [FrictionSurface, FrictionSurface, FrictionSurface, FrictionSurface];
  radii: [number, number, number]; // [L1, L2, L3] effective pendulum radii
  dispCapacities: [number, number, number]; // [d1, d2, d3] displacement capacities
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

export interface GroundMotionRecord {
  id: number;
  name: string;
  dt: number;
  acceleration: number[];
  direction: 1 | 2 | 3;
  scaleFactor: number;
}

export interface RigidDiaphragm {
  id: number;
  masterNodeId: number;
  constrainedNodeIds: number[];
  perpDirection: 2 | 3;
  label?: string;
}

export interface StructuralModel {
  name: string;
  units: string;
  description: string;
}
