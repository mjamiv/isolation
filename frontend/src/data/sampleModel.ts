/**
 * Sample 3-story, 2-bay steel moment frame for IsoVis demonstration.
 *
 * Geometry:
 *   - 3 stories @ 144 in. (12 ft) each
 *   - 2 bays @ 288 in. (24 ft) each
 *   - Single frame in the X-Z plane
 *
 * Members:
 *   - Columns: W14x68  (A=20.0 in^2, I=722 in^4)
 *   - Beams:   W24x68  (A=20.1 in^2, I=1830 in^4)
 *
 * Supports:
 *   - Fixed at base (nodes 1, 2, 3)
 *
 * Loads:
 *   - Gravity: ~1 kip/in distributed on beams, applied as equivalent
 *     nodal loads at beam-column joints:
 *       Interior nodes: -72 kips (Fy)
 *       Exterior nodes: -36 kips (Fy)
 *
 * Optional TFP bearing at interior base column (node 2) for demo.
 *
 * Units: kip, in, sec
 */

import type {
  StructuralModel,
  Node,
  Material,
  Section,
  Element,
  TFPBearing,
  Load,
  GroundMotion,
} from '../types/model.ts';

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

const nodes: Node[] = [
  // Base nodes (story 0)
  { id: 1, coords: [0, 0, 0], fixity: [1, 1, 1, 1, 1, 1] },
  { id: 2, coords: [288, 0, 0], fixity: [1, 1, 1, 1, 1, 1] },
  { id: 3, coords: [576, 0, 0], fixity: [1, 1, 1, 1, 1, 1] },

  // Story 1 (z = 144 in.)
  { id: 4, coords: [0, 0, 144], fixity: [0, 0, 0, 0, 0, 0] },
  { id: 5, coords: [288, 0, 144], fixity: [0, 0, 0, 0, 0, 0] },
  { id: 6, coords: [576, 0, 144], fixity: [0, 0, 0, 0, 0, 0] },

  // Story 2 (z = 288 in.)
  { id: 7, coords: [0, 0, 288], fixity: [0, 0, 0, 0, 0, 0] },
  { id: 8, coords: [288, 0, 288], fixity: [0, 0, 0, 0, 0, 0] },
  { id: 9, coords: [576, 0, 288], fixity: [0, 0, 0, 0, 0, 0] },

  // Story 3 / Roof (z = 432 in.)
  { id: 10, coords: [0, 0, 432], fixity: [0, 0, 0, 0, 0, 0] },
  { id: 11, coords: [288, 0, 432], fixity: [0, 0, 0, 0, 0, 0] },
  { id: 12, coords: [576, 0, 432], fixity: [0, 0, 0, 0, 0, 0] },

  // TFP bearing anchor node (below node 2, for the bearing element)
  { id: 100, coords: [288, 0, -1], fixity: [1, 1, 1, 1, 1, 1] },
];

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

const materials: Material[] = [
  {
    id: 1,
    type: 'Steel02',
    name: 'A992 Steel',
    params: {
      Fy: 50, // ksi — yield strength
      E: 29000, // ksi — elastic modulus
      b: 0.01, // strain-hardening ratio
      R0: 18,
      cR1: 0.925,
      cR2: 0.15,
    },
  },
  {
    id: 2,
    type: 'Elastic',
    name: 'Elastic Steel (columns)',
    params: {
      E: 29000, // ksi
    },
  },
  {
    id: 3,
    type: 'Elastic',
    name: 'Elastic Steel (beams)',
    params: {
      E: 29000, // ksi
    },
  },
];

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

const sections: Section[] = [
  {
    id: 1,
    type: 'WideFlange',
    name: 'W14x68 (Column)',
    materialId: 2,
    properties: {
      A: 20.0, // in^2
      Iz: 722, // in^4 — strong-axis moment of inertia
      Iy: 121, // in^4 — weak-axis moment of inertia
      d: 14.04, // in — depth
      bf: 10.035, // in — flange width
      tf: 0.72, // in — flange thickness
      tw: 0.415, // in — web thickness
      J: 3.01, // in^4 — torsional constant
    },
  },
  {
    id: 2,
    type: 'WideFlange',
    name: 'W24x68 (Beam)',
    materialId: 3,
    properties: {
      A: 20.1, // in^2
      Iz: 1830, // in^4 — strong-axis moment of inertia
      Iy: 70.4, // in^4 — weak-axis moment of inertia
      d: 23.73, // in — depth
      bf: 8.965, // in — flange width
      tf: 0.585, // in — flange thickness
      tw: 0.415, // in — web thickness
      J: 1.87, // in^4 — torsional constant
    },
  },
];

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

const elements: Element[] = [
  // --- Columns (story 1) ---
  { id: 1, type: 'elasticBeamColumn', nodes: [1, 4], sectionId: 1, transform: 'PDelta' },
  { id: 2, type: 'elasticBeamColumn', nodes: [2, 5], sectionId: 1, transform: 'PDelta' },
  { id: 3, type: 'elasticBeamColumn', nodes: [3, 6], sectionId: 1, transform: 'PDelta' },

  // --- Columns (story 2) ---
  { id: 4, type: 'elasticBeamColumn', nodes: [4, 7], sectionId: 1, transform: 'PDelta' },
  { id: 5, type: 'elasticBeamColumn', nodes: [5, 8], sectionId: 1, transform: 'PDelta' },
  { id: 6, type: 'elasticBeamColumn', nodes: [6, 9], sectionId: 1, transform: 'PDelta' },

  // --- Columns (story 3) ---
  { id: 7, type: 'elasticBeamColumn', nodes: [7, 10], sectionId: 1, transform: 'PDelta' },
  { id: 8, type: 'elasticBeamColumn', nodes: [8, 11], sectionId: 1, transform: 'PDelta' },
  { id: 9, type: 'elasticBeamColumn', nodes: [9, 12], sectionId: 1, transform: 'PDelta' },

  // --- Beams (story 1) ---
  { id: 10, type: 'elasticBeamColumn', nodes: [4, 5], sectionId: 2, transform: 'Linear' },
  { id: 11, type: 'elasticBeamColumn', nodes: [5, 6], sectionId: 2, transform: 'Linear' },

  // --- Beams (story 2) ---
  { id: 12, type: 'elasticBeamColumn', nodes: [7, 8], sectionId: 2, transform: 'Linear' },
  { id: 13, type: 'elasticBeamColumn', nodes: [8, 9], sectionId: 2, transform: 'Linear' },

  // --- Beams (story 3 / roof) ---
  { id: 14, type: 'elasticBeamColumn', nodes: [10, 11], sectionId: 2, transform: 'Linear' },
  { id: 15, type: 'elasticBeamColumn', nodes: [11, 12], sectionId: 2, transform: 'Linear' },
];

// ---------------------------------------------------------------------------
// TFP Bearing (demo at interior base column)
// ---------------------------------------------------------------------------

const bearings: TFPBearing[] = [
  {
    id: 1,
    nodes: [100, 2],
    frictionModels: [
      { type: 'VelDependent', muSlow: 0.012, muFast: 0.018, transRate: 0.3 },
      { type: 'VelDependent', muSlow: 0.052, muFast: 0.075, transRate: 0.3 },
      { type: 'VelDependent', muSlow: 0.052, muFast: 0.075, transRate: 0.3 },
      { type: 'VelDependent', muSlow: 0.012, muFast: 0.018, transRate: 0.3 },
    ],
    radii: [16, 84, 16],
    dispCapacities: [2.0, 16.0, 2.0],
    weight: 144,
    uy: 0.01,
    kvt: 100,
    minFv: 0.1,
    tol: 1e-8,
  },
];

// ---------------------------------------------------------------------------
// Loads
// ---------------------------------------------------------------------------

const loads: Load[] = [
  // Story 1 gravity loads (equivalent nodal)
  { type: 'nodeLoad', nodeId: 4, values: [0, 0, -36, 0, 0, 0] },
  { type: 'nodeLoad', nodeId: 5, values: [0, 0, -72, 0, 0, 0] },
  { type: 'nodeLoad', nodeId: 6, values: [0, 0, -36, 0, 0, 0] },

  // Story 2 gravity loads
  { type: 'nodeLoad', nodeId: 7, values: [0, 0, -36, 0, 0, 0] },
  { type: 'nodeLoad', nodeId: 8, values: [0, 0, -72, 0, 0, 0] },
  { type: 'nodeLoad', nodeId: 9, values: [0, 0, -36, 0, 0, 0] },

  // Story 3 / Roof gravity loads (reduced for roof)
  { type: 'nodeLoad', nodeId: 10, values: [0, 0, -24, 0, 0, 0] },
  { type: 'nodeLoad', nodeId: 11, values: [0, 0, -48, 0, 0, 0] },
  { type: 'nodeLoad', nodeId: 12, values: [0, 0, -24, 0, 0, 0] },
];

// ---------------------------------------------------------------------------
// Ground Motions (placeholder sine pulse for demo)
// ---------------------------------------------------------------------------

/**
 * Generate a simple sinusoidal acceleration pulse for demonstration.
 * Real analyses would load actual ground motion records.
 */
function generateSinePulse(
  numPoints: number,
  dt: number,
  amplitude: number,
  frequency: number,
): number[] {
  const acc: number[] = [];
  for (let i = 0; i < numPoints; i++) {
    const t = i * dt;
    // Sine pulse with linear ramp-up/ramp-down envelope
    const envelope = Math.sin((Math.PI * t) / (numPoints * dt));
    acc.push(amplitude * envelope * Math.sin(2 * Math.PI * frequency * t));
  }
  return acc;
}

const groundMotions: GroundMotion[] = [
  {
    id: 1,
    name: 'Demo Sine Pulse (X-direction)',
    dt: 0.01,
    acceleration: generateSinePulse(2000, 0.01, 0.4, 1.5),
    direction: 1,
    scaleFactor: 1.0,
  },
];

// ---------------------------------------------------------------------------
// Complete Sample Model
// ---------------------------------------------------------------------------

export const sampleModel: StructuralModel = {
  modelInfo: {
    name: '3-Story 2-Bay Steel Moment Frame',
    units: { force: 'kip', length: 'in', time: 'sec' },
    ndm: 2,
    ndf: 3,
  },
  nodes,
  materials,
  sections,
  elements,
  bearings,
  diaphragms: [],
  equalDofConstraints: [],
  loads,
  groundMotions,
};
