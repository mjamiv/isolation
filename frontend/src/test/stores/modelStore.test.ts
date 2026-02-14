/**
 * Tests for the model Zustand store.
 *
 * Covers initial state, CRUD operations on nodes, setModel,
 * and the loadSampleModel demo helper.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '@/stores/modelStore';
import type { Node, Element, TFPBearing, FrictionSurface } from '@/stores/modelStore';
import type { ModelJSON } from '@/types/modelJSON';

// Helper: get a fresh snapshot of the store state.
const getState = () => useModelStore.getState();

// Reset the store between tests so they stay independent.
beforeEach(() => {
  getState().clearModel();
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('modelStore — initial state', () => {
  it('initializes with null model', () => {
    expect(getState().model).toBeNull();
  });

  it('initializes with empty maps', () => {
    expect(getState().nodes.size).toBe(0);
    expect(getState().elements.size).toBe(0);
    expect(getState().sections.size).toBe(0);
    expect(getState().materials.size).toBe(0);
    expect(getState().bearings.size).toBe(0);
    expect(getState().loads.size).toBe(0);
    expect(getState().groundMotions.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// setModel
// ---------------------------------------------------------------------------

describe('modelStore — setModel', () => {
  it('setModel correctly populates the model metadata', () => {
    const model = {
      name: 'Test Frame',
      units: 'kip-in',
      description: 'A test model',
    };
    getState().setModel(model);
    expect(getState().model).toEqual(model);
  });
});

// ---------------------------------------------------------------------------
// loadSampleModel
// ---------------------------------------------------------------------------

describe('modelStore — loadSampleModel', () => {
  it('creates a valid base-isolated 3-story frame', () => {
    getState().loadSampleModel();
    const state = getState();

    // Model metadata should be populated
    expect(state.model).not.toBeNull();
    expect(state.model!.name).toContain('Base-Isolated');

    // 12 structure nodes + 3 ground nodes = 15 nodes
    expect(state.nodes.size).toBe(15);

    // 9 columns + 6 beams = 15 elements
    expect(state.elements.size).toBe(15);

    // 1 material, 2 sections
    expect(state.materials.size).toBe(1);
    expect(state.sections.size).toBe(2);

    // 3 TFP bearings
    expect(state.bearings.size).toBe(3);

    // 9 gravity loads on floor nodes above base (y > 0)
    expect(state.loads.size).toBe(9);
  });

  it('creates fixed ground nodes', () => {
    getState().loadSampleModel();
    const nodes = getState().nodes;

    // Ground nodes 101, 102, 103 are fixed
    for (const id of [101, 102, 103]) {
      const node = nodes.get(id)!;
      expect(node.restraint).toEqual([true, true, true, true, true, true]);
    }
  });

  it('creates free base nodes at y=0', () => {
    getState().loadSampleModel();
    const nodes = getState().nodes;

    // Base nodes 1, 2, 3 are free (bearing tops)
    for (const id of [1, 2, 3]) {
      const node = nodes.get(id)!;
      expect(node.y).toBe(0);
      expect(node.restraint).toEqual([false, false, false, false, false, false]);
    }
  });

  it('creates free nodes above ground level', () => {
    getState().loadSampleModel();
    const nodes = getState().nodes;

    // Nodes 4-12 should be free
    for (let id = 4; id <= 12; id++) {
      const node = nodes.get(id)!;
      expect(node.y).toBeGreaterThan(0);
      expect(node.restraint).toEqual([false, false, false, false, false, false]);
    }
  });

  it('creates bearings connecting ground to base nodes', () => {
    getState().loadSampleModel();
    const bearings = getState().bearings;

    expect(bearings.size).toBe(3);

    const b1 = bearings.get(1)!;
    expect(b1.nodeI).toBe(101);
    expect(b1.nodeJ).toBe(1);
    expect(b1.surfaces).toHaveLength(4);
    expect(b1.radii).toEqual([16, 84, 16]);
    expect(b1.dispCapacities).toEqual([2, 16, 2]);
    expect(b1.surfaces[0].type).toBe('VelDependent');
  });
});

// ---------------------------------------------------------------------------
// Node CRUD
// ---------------------------------------------------------------------------

describe('modelStore — addNode', () => {
  it('adds a node to the store', () => {
    const node: Node = {
      id: 100,
      x: 10,
      y: 20,
      z: 0,
      restraint: [false, false, false, false, false, false],
    };
    getState().addNode(node);
    expect(getState().nodes.size).toBe(1);
    expect(getState().nodes.get(100)).toEqual(node);
  });
});

describe('modelStore — removeNode', () => {
  it('removes a node from the store', () => {
    const node: Node = {
      id: 200,
      x: 0,
      y: 0,
      z: 0,
      restraint: [true, true, true, true, true, true],
    };
    getState().addNode(node);
    expect(getState().nodes.has(200)).toBe(true);

    getState().removeNode(200);
    expect(getState().nodes.has(200)).toBe(false);
    expect(getState().nodes.size).toBe(0);
  });
});

describe('modelStore — updateNode', () => {
  it('modifies node properties', () => {
    const node: Node = {
      id: 300,
      x: 0,
      y: 0,
      z: 0,
      restraint: [false, false, false, false, false, false],
    };
    getState().addNode(node);

    getState().updateNode(300, { x: 50, y: 100, label: 'Updated' });

    const updated = getState().nodes.get(300)!;
    expect(updated.x).toBe(50);
    expect(updated.y).toBe(100);
    expect(updated.label).toBe('Updated');
    // Original z value should remain unchanged
    expect(updated.z).toBe(0);
  });

  it('does not create a new node if id does not exist', () => {
    getState().updateNode(999, { x: 10 });
    expect(getState().nodes.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Element CRUD (smoke)
// ---------------------------------------------------------------------------

describe('modelStore — element operations', () => {
  it('addElement and removeElement work correctly', () => {
    const elem: Element = {
      id: 1,
      type: 'beam',
      nodeI: 1,
      nodeJ: 2,
      sectionId: 1,
      materialId: 1,
    };
    getState().addElement(elem);
    expect(getState().elements.size).toBe(1);
    expect(getState().elements.get(1)).toEqual(elem);

    getState().removeElement(1);
    expect(getState().elements.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Bearing CRUD
// ---------------------------------------------------------------------------

function makeTestBearing(id: number): TFPBearing {
  const surface: FrictionSurface = {
    type: 'VelDependent',
    muSlow: 0.01,
    muFast: 0.02,
    transRate: 0.4,
  };
  return {
    id,
    nodeI: 100,
    nodeJ: 1,
    surfaces: [{ ...surface }, { ...surface }, { ...surface }, { ...surface }],
    radii: [16, 84, 16],
    dispCapacities: [2, 16, 2],
    weight: 150,
    yieldDisp: 0.04,
    vertStiffness: 10000,
    minVertForce: 0.1,
    tolerance: 1e-8,
  };
}

describe('modelStore — bearing CRUD', () => {
  it('adds a bearing to the store', () => {
    const bearing = makeTestBearing(1);
    getState().addBearing(bearing);
    expect(getState().bearings.size).toBe(1);
    expect(getState().bearings.get(1)).toEqual(bearing);
  });

  it('updates bearing properties', () => {
    getState().addBearing(makeTestBearing(1));
    getState().updateBearing(1, { weight: 200, nodeJ: 5 });

    const updated = getState().bearings.get(1)!;
    expect(updated.weight).toBe(200);
    expect(updated.nodeJ).toBe(5);
    // Other fields unchanged
    expect(updated.radii).toEqual([16, 84, 16]);
  });

  it('removes a bearing from the store', () => {
    getState().addBearing(makeTestBearing(1));
    expect(getState().bearings.size).toBe(1);

    getState().removeBearing(1);
    expect(getState().bearings.size).toBe(0);
  });

  it('preserves 4-surface structure', () => {
    getState().addBearing(makeTestBearing(1));
    const bearing = getState().bearings.get(1)!;
    expect(bearing.surfaces).toHaveLength(4);
    expect(bearing.surfaces[0].type).toBe('VelDependent');
    expect(bearing.surfaces[0].muSlow).toBe(0.01);
  });

  it('does not update a non-existent bearing', () => {
    getState().updateBearing(999, { weight: 200 });
    expect(getState().bearings.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// loadModelFromJSON
// ---------------------------------------------------------------------------

function makeTestJSON(): ModelJSON {
  return {
    modelInfo: { name: 'Test Bridge', units: 'kip-in', description: 'A test bridge model' },
    nodes: [
      { id: 1, x: 0, y: 0, z: 0, restraint: [true, true, true, true, true, true] },
      { id: 2, x: 100, y: 50, z: 0, restraint: [false, false, false, false, false, false] },
    ],
    elements: [{ id: 1, type: 'column', nodeI: 1, nodeJ: 2, sectionId: 1, materialId: 1 }],
    sections: [
      {
        id: 1,
        name: 'W14x68',
        area: 20,
        Ix: 723,
        Iy: 121,
        Zx: 115,
        d: 14,
        bf: 10,
        tw: 0.4,
        tf: 0.7,
      },
    ],
    materials: [{ id: 1, name: 'Steel', E: 29000, Fy: 50, density: 490, nu: 0.3 }],
    bearings: [],
    loads: [{ id: 1, nodeId: 2, fx: 0, fy: -100, fz: 0, mx: 0, my: 0, mz: 0 }],
    groundMotions: [],
  };
}

describe('modelStore — loadModelFromJSON', () => {
  it('populates all maps from JSON arrays', () => {
    const json = makeTestJSON();
    getState().loadModelFromJSON(json);
    const state = getState();

    expect(state.model).toEqual({
      name: 'Test Bridge',
      units: 'kip-in',
      description: 'A test bridge model',
    });
    expect(state.nodes.size).toBe(2);
    expect(state.nodes.get(1)!.x).toBe(0);
    expect(state.nodes.get(2)!.x).toBe(100);
    expect(state.elements.size).toBe(1);
    expect(state.sections.size).toBe(1);
    expect(state.materials.size).toBe(1);
    expect(state.bearings.size).toBe(0);
    expect(state.loads.size).toBe(1);
    expect(state.groundMotions.size).toBe(0);
  });

  it('replaces existing data when loading a new model', () => {
    // Load sample first
    getState().loadSampleModel();
    expect(getState().nodes.size).toBe(15);
    expect(getState().bearings.size).toBe(3);

    // Load JSON — should fully replace
    getState().loadModelFromJSON(makeTestJSON());
    expect(getState().nodes.size).toBe(2);
    expect(getState().bearings.size).toBe(0);
    expect(getState().model!.name).toBe('Test Bridge');
  });

  it('preserves entity properties through JSON round-trip', () => {
    const json = makeTestJSON();
    getState().loadModelFromJSON(json);

    const node = getState().nodes.get(1)!;
    expect(node.restraint).toEqual([true, true, true, true, true, true]);

    const section = getState().sections.get(1)!;
    expect(section.name).toBe('W14x68');
    expect(section.area).toBe(20);

    const load = getState().loads.get(1)!;
    expect(load.nodeId).toBe(2);
    expect(load.fy).toBe(-100);
  });
});
