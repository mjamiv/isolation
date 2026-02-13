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
  area: number;       // in^2
  Ix: number;         // in^4 — strong axis
  Iy: number;         // in^4 — weak axis
  Zx: number;         // in^3 — plastic modulus
  d: number;          // depth in inches
  bf: number;         // flange width in inches
  tw: number;         // web thickness in inches
  tf: number;         // flange thickness in inches
}

export interface Material {
  id: number;
  name: string;
  E: number;          // ksi
  Fy: number;         // ksi
  density: number;    // pcf
  nu: number;         // Poisson ratio
}

export interface TFPBearing {
  id: number;
  nodeId: number;
  R1: number;         // radius of curvature surface 1 (in)
  R2: number;         // radius of curvature surface 2 (in)
  R3: number;         // radius of curvature surface 3 (in)
  mu1: number;        // friction coefficient surface 1
  mu2: number;        // friction coefficient surface 2
  mu3: number;        // friction coefficient surface 3
  d1: number;         // displacement capacity surface 1 (in)
  d2: number;         // displacement capacity surface 2 (in)
  d3: number;         // displacement capacity surface 3 (in)
}

export interface StructuralModel {
  name: string;
  units: string;
  description: string;
}
