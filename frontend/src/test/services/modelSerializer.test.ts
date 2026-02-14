/**
 * Tests for the model serializer service.
 *
 * Verifies that the frontend Zustand store format is correctly
 * converted to the backend StructuralModel schema format.
 */

import { describe, it, expect } from 'vitest';
import { serializeModel } from '@/services/modelSerializer';
import type {
  Node,
  Element,
  Section,
  Material,
  TFPBearing,
  FrictionSurface,
  PointLoad,
  GroundMotionRecord,
} from '@/types/storeModel';

function makeStore(overrides: Partial<Parameters<typeof serializeModel>[0]> = {}) {
  return {
    model: { name: 'Test', units: 'kip-in', description: 'Test model' },
    nodes: new Map<number, Node>(),
    elements: new Map<number, Element>(),
    sections: new Map<number, Section>(),
    materials: new Map<number, Material>(),
    bearings: new Map<number, TFPBearing>(),
    loads: new Map<number, PointLoad>(),
    groundMotions: new Map<number, GroundMotionRecord>(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Node serialization
// ---------------------------------------------------------------------------

describe('modelSerializer — nodes', () => {
  it('converts Node x/y/z to coords array', () => {
    const nodes = new Map<number, Node>();
    nodes.set(1, {
      id: 1,
      x: 10,
      y: 20,
      z: 30,
      restraint: [false, false, false, false, false, false],
    });
    const result = serializeModel(makeStore({ nodes }));

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]!.coords).toEqual([10, 20, 30]);
  });

  it('converts boolean restraint to numeric fixity', () => {
    const nodes = new Map<number, Node>();
    nodes.set(1, { id: 1, x: 0, y: 0, z: 0, restraint: [true, true, true, false, false, false] });
    const result = serializeModel(makeStore({ nodes }));

    expect(result.nodes[0]!.fixity).toEqual([1, 1, 1, 0, 0, 0]);
  });

  it('converts fully fixed restraint', () => {
    const nodes = new Map<number, Node>();
    nodes.set(1, { id: 1, x: 0, y: 0, z: 0, restraint: [true, true, true, true, true, true] });
    const result = serializeModel(makeStore({ nodes }));

    expect(result.nodes[0]!.fixity).toEqual([1, 1, 1, 1, 1, 1]);
  });
});

// ---------------------------------------------------------------------------
// Element serialization
// ---------------------------------------------------------------------------

describe('modelSerializer — elements', () => {
  it('maps column type to elasticBeamColumn', () => {
    const elements = new Map<number, Element>();
    elements.set(1, { id: 1, type: 'column', nodeI: 1, nodeJ: 2, sectionId: 1, materialId: 1 });
    const result = serializeModel(makeStore({ elements }));

    expect(result.elements[0]!.type).toBe('elasticBeamColumn');
    expect(result.elements[0]!.nodes).toEqual([1, 2]);
    expect(result.elements[0]!.transform).toBe('Linear');
  });

  it('maps beam type to elasticBeamColumn', () => {
    const elements = new Map<number, Element>();
    elements.set(1, { id: 1, type: 'beam', nodeI: 3, nodeJ: 4, sectionId: 2, materialId: 1 });
    const result = serializeModel(makeStore({ elements }));

    expect(result.elements[0]!.type).toBe('elasticBeamColumn');
  });

  it('maps bearing type to TripleFrictionPendulum', () => {
    const elements = new Map<number, Element>();
    elements.set(1, { id: 1, type: 'bearing', nodeI: 1, nodeJ: 2, sectionId: 1, materialId: 1 });
    const result = serializeModel(makeStore({ elements }));

    expect(result.elements[0]!.type).toBe('TripleFrictionPendulum');
  });
});

// ---------------------------------------------------------------------------
// Section serialization
// ---------------------------------------------------------------------------

describe('modelSerializer — sections', () => {
  it('converts section properties to backend format', () => {
    const materials = new Map<number, Material>();
    materials.set(1, { id: 1, name: 'Steel', E: 29000, Fy: 50, density: 490, nu: 0.3 });

    const sections = new Map<number, Section>();
    sections.set(1, {
      id: 1,
      name: 'W14x68',
      area: 20.0,
      Ix: 723,
      Iy: 121,
      Zx: 115,
      d: 14.04,
      bf: 10.035,
      tw: 0.415,
      tf: 0.72,
    });

    const result = serializeModel(makeStore({ sections, materials }));

    expect(result.sections[0]!.type).toBe('Elastic');
    expect(result.sections[0]!.properties.A).toBe(20.0);
    expect(result.sections[0]!.properties.Iz).toBe(723);
    expect(result.sections[0]!.materialId).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Material serialization
// ---------------------------------------------------------------------------

describe('modelSerializer — materials', () => {
  it('converts material to backend format', () => {
    const materials = new Map<number, Material>();
    materials.set(1, { id: 1, name: 'A992 Steel', E: 29000, Fy: 50, density: 490, nu: 0.3 });
    const result = serializeModel(makeStore({ materials }));

    expect(result.materials[0]!.type).toBe('Elastic');
    expect(result.materials[0]!.params.E).toBe(29000);
  });
});

// ---------------------------------------------------------------------------
// Load serialization
// ---------------------------------------------------------------------------

describe('modelSerializer — loads', () => {
  it('converts PointLoad to nodeLoad format', () => {
    const loads = new Map<number, PointLoad>();
    loads.set(1, { id: 1, nodeId: 5, fx: 10, fy: -50, fz: 0, mx: 0, my: 0, mz: 0 });
    const result = serializeModel(makeStore({ loads }));

    expect(result.loads).toHaveLength(1);
    const load = result.loads[0]!;
    expect(load.type).toBe('nodal');
    expect(load.values).toEqual([10, -50, 0, 0, 0, 0]);
    expect('nodeId' in load && load.nodeId).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Ground motion serialization
// ---------------------------------------------------------------------------

describe('modelSerializer — groundMotions', () => {
  it('converts GroundMotionRecord to backend format', () => {
    const groundMotions = new Map<number, GroundMotionRecord>();
    groundMotions.set(1, {
      id: 1,
      name: 'Test GM',
      dt: 0.01,
      acceleration: [0.1, 0.2, 0.3],
      direction: 1,
      scaleFactor: 1.5,
    });
    const result = serializeModel(makeStore({ groundMotions }));

    expect(result.groundMotions).toHaveLength(1);
    expect(result.groundMotions[0]!.dt).toBe(0.01);
    expect(result.groundMotions[0]!.direction).toBe(1);
    expect(result.groundMotions[0]!.scaleFactor).toBe(1.5);
    expect(result.groundMotions[0]!.acceleration).toEqual([0.1, 0.2, 0.3]);
  });
});

// ---------------------------------------------------------------------------
// Bearing serialization
// ---------------------------------------------------------------------------

function makeTestBearing(id: number): TFPBearing {
  const inner: FrictionSurface = {
    type: 'VelDependent',
    muSlow: 0.012,
    muFast: 0.018,
    transRate: 0.4,
  };
  const outer: FrictionSurface = {
    type: 'VelDependent',
    muSlow: 0.018,
    muFast: 0.03,
    transRate: 0.4,
  };
  return {
    id,
    nodeI: 101,
    nodeJ: 1,
    surfaces: [{ ...inner }, { ...inner }, { ...outer }, { ...outer }],
    radii: [16, 84, 16],
    dispCapacities: [2, 16, 2],
    weight: 150,
    yieldDisp: 0.04,
    vertStiffness: 10000,
    minVertForce: 0.1,
    tolerance: 1e-8,
  };
}

describe('modelSerializer — bearings', () => {
  it('serializes a TFP bearing with all properties', () => {
    const bearings = new Map<number, TFPBearing>();
    bearings.set(1, makeTestBearing(1));
    const result = serializeModel(makeStore({ bearings }));

    expect(result.bearings).toHaveLength(1);
    const b = result.bearings[0]!;
    expect(b.id).toBe(1);
    expect(b.nodes).toEqual([101, 1]);
    expect(b.frictionModels).toHaveLength(4);
    expect(b.frictionModels[0].muSlow).toBe(0.012);
    expect(b.frictionModels[0].muFast).toBe(0.018);
    expect(b.frictionModels[0].transRate).toBe(0.4);
    expect(b.radii).toEqual([16, 84, 16]);
    expect(b.dispCapacities).toEqual([2, 16, 2]);
    expect(b.weight).toBe(150);
    expect(b.uy).toBe(0.04);
    expect(b.kvt).toBe(1.0);
    expect(b.vertStiffness).toBe(10000);
    expect(b.minFv).toBe(0.1);
    expect(b.tol).toBe(1e-8);
  });

  it('returns empty bearings when none in store', () => {
    const result = serializeModel(makeStore());
    expect(result.bearings).toHaveLength(0);
  });

  it('serializes multiple bearings', () => {
    const bearings = new Map<number, TFPBearing>();
    bearings.set(1, makeTestBearing(1));
    bearings.set(2, makeTestBearing(2));
    bearings.set(3, makeTestBearing(3));
    const result = serializeModel(makeStore({ bearings }));
    expect(result.bearings).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// ModelInfo
// ---------------------------------------------------------------------------

describe('modelSerializer — modelInfo', () => {
  it('uses model name from store', () => {
    const result = serializeModel(makeStore());
    expect(result.modelInfo.name).toBe('Test');
    expect(result.modelInfo.units).toBe('kip-in');
    expect(result.modelInfo.ndm).toBe(3);
    expect(result.modelInfo.ndf).toBe(6);
  });

  it('uses "Untitled" when model is null', () => {
    const result = serializeModel(makeStore({ model: null }));
    expect(result.modelInfo.name).toBe('Untitled');
  });
});

describe('modelSerializer — Z-up conversion', () => {
  it('swaps Y/Z coordinates and load components when bearings are present', () => {
    const bearings = new Map<number, TFPBearing>();
    bearings.set(1, makeTestBearing(1));

    const nodes = new Map<number, Node>();
    nodes.set(1, {
      id: 1,
      x: 10,
      y: 20,
      z: 30,
      restraint: [false, false, false, false, false, false],
    });

    const loads = new Map<number, PointLoad>();
    loads.set(1, { id: 1, nodeId: 1, fx: 1, fy: 2, fz: 3, mx: 4, my: 5, mz: 6 });

    const result = serializeModel(makeStore({ bearings, nodes, loads }));

    expect(result.modelInfo.zUp).toBe(true);
    expect(result.nodes[0]!.coords).toEqual([10, 30, 20]);
    expect(result.loads[0]!.values).toEqual([1, 3, 2, 4, 6, 5]);
  });
});

// ---------------------------------------------------------------------------
// Full round-trip (sample model)
// ---------------------------------------------------------------------------

describe('modelSerializer — sample model round-trip', () => {
  it('serializes the sample model with all collections', () => {
    const nodes = new Map<number, Node>();
    nodes.set(1, { id: 1, x: 0, y: 0, z: 0, restraint: [true, true, true, true, true, true] });
    nodes.set(2, { id: 2, x: 288, y: 0, z: 0, restraint: [true, true, true, true, true, true] });
    nodes.set(3, {
      id: 3,
      x: 0,
      y: 144,
      z: 0,
      restraint: [false, false, false, false, false, false],
    });

    const materials = new Map<number, Material>();
    materials.set(1, { id: 1, name: 'Steel', E: 29000, Fy: 50, density: 490, nu: 0.3 });

    const sections = new Map<number, Section>();
    sections.set(1, {
      id: 1,
      name: 'W14x68',
      area: 20,
      Ix: 723,
      Iy: 121,
      Zx: 115,
      d: 14.04,
      bf: 10.035,
      tw: 0.415,
      tf: 0.72,
    });

    const elements = new Map<number, Element>();
    elements.set(1, { id: 1, type: 'column', nodeI: 1, nodeJ: 3, sectionId: 1, materialId: 1 });

    const loads = new Map<number, PointLoad>();
    loads.set(1, { id: 1, nodeId: 3, fx: 0, fy: -50, fz: 0, mx: 0, my: 0, mz: 0 });

    const result = serializeModel(makeStore({ nodes, materials, sections, elements, loads }));

    expect(result.nodes).toHaveLength(3);
    expect(result.materials).toHaveLength(1);
    expect(result.sections).toHaveLength(1);
    expect(result.elements).toHaveLength(1);
    expect(result.loads).toHaveLength(1);
    expect(result.groundMotions).toHaveLength(0);
    expect(result.bearings).toHaveLength(0);
  });
});
