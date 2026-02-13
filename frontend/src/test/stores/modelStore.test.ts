/**
 * Tests for the model Zustand store.
 *
 * Covers initial state, CRUD operations on nodes, setModel,
 * and the loadSampleModel demo helper.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '@/stores/modelStore';
import type { Node, Element } from '@/stores/modelStore';

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
  it('creates a valid 3-story frame', () => {
    getState().loadSampleModel();
    const state = getState();

    // Model metadata should be populated
    expect(state.model).not.toBeNull();
    expect(state.model!.name).toContain('3-Story');

    // 3 stories x 3 columns + base = 4 levels x 3 = 12 nodes
    expect(state.nodes.size).toBe(12);

    // 9 columns + 6 beams = 15 elements
    expect(state.elements.size).toBe(15);

    // 1 material, 2 sections
    expect(state.materials.size).toBe(1);
    expect(state.sections.size).toBe(2);

    // 9 gravity loads on floor nodes (nodes 4-12)
    expect(state.loads.size).toBe(9);
  });

  it('creates fixed-base nodes at y=0', () => {
    getState().loadSampleModel();
    const nodes = getState().nodes;

    // Nodes 1, 2, 3 are base nodes at y=0 with all DOFs restrained
    for (const id of [1, 2, 3]) {
      const node = nodes.get(id)!;
      expect(node.y).toBe(0);
      expect(node.restraint).toEqual([true, true, true, true, true, true]);
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
