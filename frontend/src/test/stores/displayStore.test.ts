/**
 * Tests for the display Zustand store.
 *
 * Covers initial defaults, setters, and toggle behavior
 * for rendering modes, scale factor, labels, grid, etc.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useDisplayStore } from '@/stores/displayStore';

const getState = () => useDisplayStore.getState();

// Reset the store between tests by re-setting all display defaults.
beforeEach(() => {
  const s = getState();
  s.setDisplayMode('wireframe');
  s.setShowDeformed(false);
  s.setScaleFactor(100);
  s.setShowLabels(false);
  s.setShowGrid(true);
  s.setShowAxes(true);
  s.setShowForces(false);
  s.setForceType('none');
  s.setColorMap('none');
  s.clearSelection();
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('displayStore — initial defaults', () => {
  it('initializes with wireframe mode', () => {
    expect(getState().displayMode).toBe('wireframe');
  });

  it('initializes with scaleFactor 100', () => {
    expect(getState().scaleFactor).toBe(100);
  });

  it('initializes with showDeformed false', () => {
    expect(getState().showDeformed).toBe(false);
  });

  it('initializes with showLabels false', () => {
    expect(getState().showLabels).toBe(false);
  });

  it('initializes with showGrid true', () => {
    expect(getState().showGrid).toBe(true);
  });

  it('initializes with showAxes true', () => {
    expect(getState().showAxes).toBe(true);
  });

  it('initializes with forceType none', () => {
    expect(getState().forceType).toBe('none');
  });

  it('initializes with empty selection sets', () => {
    expect(getState().selectedNodeIds.size).toBe(0);
    expect(getState().selectedElementIds.size).toBe(0);
  });

  it('initializes with null hovered ids', () => {
    expect(getState().hoveredElementId).toBeNull();
    expect(getState().hoveredNodeId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Setters
// ---------------------------------------------------------------------------

describe('displayStore — setDisplayMode', () => {
  it('changes the mode to extruded', () => {
    getState().setDisplayMode('extruded');
    expect(getState().displayMode).toBe('extruded');
  });

  it('changes the mode to solid', () => {
    getState().setDisplayMode('solid');
    expect(getState().displayMode).toBe('solid');
  });
});

describe('displayStore — setScaleFactor', () => {
  it('updates the scale factor', () => {
    getState().setScaleFactor(250);
    expect(getState().scaleFactor).toBe(250);
  });

  it('accepts zero as a scale factor', () => {
    getState().setScaleFactor(0);
    expect(getState().scaleFactor).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Toggles
// ---------------------------------------------------------------------------

describe('displayStore — toggles', () => {
  it('toggles showDeformed correctly', () => {
    expect(getState().showDeformed).toBe(false);
    getState().setShowDeformed(true);
    expect(getState().showDeformed).toBe(true);
    getState().setShowDeformed(false);
    expect(getState().showDeformed).toBe(false);
  });

  it('toggles showLabels correctly', () => {
    expect(getState().showLabels).toBe(false);
    getState().setShowLabels(true);
    expect(getState().showLabels).toBe(true);
  });

  it('toggles showGrid correctly', () => {
    expect(getState().showGrid).toBe(true);
    getState().setShowGrid(false);
    expect(getState().showGrid).toBe(false);
  });

  it('toggles showAxes correctly', () => {
    expect(getState().showAxes).toBe(true);
    getState().setShowAxes(false);
    expect(getState().showAxes).toBe(false);
  });

  it('toggles showForces correctly', () => {
    expect(getState().showForces).toBe(false);
    getState().setShowForces(true);
    expect(getState().showForces).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Force type & color map
// ---------------------------------------------------------------------------

describe('displayStore — setForceType', () => {
  it('changes force type to moment', () => {
    getState().setForceType('moment');
    expect(getState().forceType).toBe('moment');
  });
});

describe('displayStore — setColorMap', () => {
  it('changes color map to displacement', () => {
    getState().setColorMap('displacement');
    expect(getState().colorMap).toBe('displacement');
  });
});

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

describe('displayStore — selection', () => {
  it('selectNode selects a single node', () => {
    getState().selectNode(5);
    expect(getState().selectedNodeIds.has(5)).toBe(true);
    expect(getState().selectedNodeIds.size).toBe(1);
  });

  it('selectNode in multi mode adds to selection', () => {
    getState().selectNode(1);
    getState().selectNode(2, true);
    expect(getState().selectedNodeIds.size).toBe(2);
  });

  it('selectNode without multi replaces selection', () => {
    getState().selectNode(1);
    getState().selectNode(2); // multi=false (default)
    expect(getState().selectedNodeIds.size).toBe(1);
    expect(getState().selectedNodeIds.has(2)).toBe(true);
  });

  it('selectNode toggles off when already selected in multi mode', () => {
    getState().selectNode(1);
    getState().selectNode(1, true); // toggle off
    expect(getState().selectedNodeIds.has(1)).toBe(false);
  });

  it('clearSelection empties both sets', () => {
    getState().selectNode(1);
    getState().selectElement(2);
    getState().clearSelection();
    expect(getState().selectedNodeIds.size).toBe(0);
    expect(getState().selectedElementIds.size).toBe(0);
  });
});
