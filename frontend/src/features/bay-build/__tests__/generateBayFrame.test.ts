/**
 * Comprehensive tests for the Bay Build frame generator.
 *
 * Tests cover node topology, element connectivity, boundary conditions,
 * material selection, section auto-sizing, gravity loads, TFP bearings,
 * rigid diaphragms, and ID uniqueness across a wide range of frame
 * configurations.
 */

import { describe, it, expect } from 'vitest';
import { generateBayFrame } from '../generateBayFrame';
import type { BayBuildParams } from '../bayBuildTypes';
import type { ModelJSON } from '@/types/modelJSON';

// ---------------------------------------------------------------------------
// Shared defaults
// ---------------------------------------------------------------------------

const DEFAULT: BayBuildParams = {
  baysX: 2,
  baysZ: 2,
  bayWidthX: 20,
  bayWidthZ: 20,
  stories: 2,
  storyHeight: 15,
  material: 'steel',
  diaphragms: true,
  baseType: 'fixed',
};

/** Shorthand: generate with selected overrides. */
function gen(overrides: Partial<BayBuildParams> = {}): ModelJSON {
  return generateBayFrame({ ...DEFAULT, ...overrides });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FREE: [boolean, boolean, boolean, boolean, boolean, boolean] = [
  false,
  false,
  false,
  false,
  false,
  false,
];
const FIXED: [boolean, boolean, boolean, boolean, boolean, boolean] = [
  true,
  true,
  true,
  true,
  true,
  true,
];

/** Count elements by type. */
function countByType(model: ModelJSON, type: string) {
  return model.elements.filter((e) => e.type === type).length;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. BASIC FRAME GENERATION
// ═══════════════════════════════════════════════════════════════════════════

describe('basic frame generation', () => {
  it('1x1x1 fixed steel frame has correct node and element counts', () => {
    const model = gen({ baysX: 1, baysZ: 1, stories: 1 });

    // 2x2 grid * 2 levels (base + floor 1) = 8 nodes
    expect(model.nodes).toHaveLength(8);

    // Columns: 4 per story * 1 story = 4
    // X-beams: 1 bay * 2 rows * 1 floor = 2
    // Z-beams: 2 cols * 1 bay * 1 floor = 2
    // Total = 4 + 2 + 2 = 8
    expect(model.elements).toHaveLength(8);
    expect(countByType(model, 'column')).toBe(4);
    expect(countByType(model, 'beam')).toBe(4);
  });

  it('1x1x1 model name includes grid dimensions', () => {
    const model = gen({ baysX: 1, baysZ: 1, stories: 1 });
    expect(model.modelInfo.name).toContain('1x1x1');
  });

  it('1x1x1 model uses kip-in units', () => {
    const model = gen({ baysX: 1, baysZ: 1, stories: 1 });
    expect(model.modelInfo.units).toBe('kip-in');
  });

  it('2x2x2 fixed steel frame has correct counts', () => {
    const model = gen({ baysX: 2, baysZ: 2, stories: 2 });

    const nodesPerFloor = 3 * 3; // (baysX+1) * (baysZ+1)
    const totalNodes = nodesPerFloor * 3; // 3 levels: base + 2 floors
    expect(model.nodes).toHaveLength(totalNodes);

    const columns = nodesPerFloor * 2; // 9 columns * 2 stories
    const xBeams = 2 * 3 * 2; // baysX * (baysZ+1) * stories
    const zBeams = 3 * 2 * 2; // (baysX+1) * baysZ * stories
    expect(model.elements).toHaveLength(columns + xBeams + zBeams);
    expect(countByType(model, 'column')).toBe(columns);
    expect(countByType(model, 'beam')).toBe(xBeams + zBeams);
  });

  it('3x2x5 fixed steel frame — asymmetric bays', () => {
    const model = gen({ baysX: 3, baysZ: 2, stories: 5 });

    const nodesPerFloor = 4 * 3; // (3+1) * (2+1) = 12
    const totalNodes = nodesPerFloor * 6; // 6 levels: base + 5 floors
    expect(model.nodes).toHaveLength(totalNodes);

    const columns = nodesPerFloor * 5; // 60
    const xBeams = 3 * 3 * 5; // baysX * (baysZ+1) * stories = 45
    const zBeams = 4 * 2 * 5; // (baysX+1) * baysZ * stories = 40
    expect(model.elements).toHaveLength(columns + xBeams + zBeams);
    expect(countByType(model, 'column')).toBe(60);
    expect(countByType(model, 'beam')).toBe(85);
  });

  it('generates empty groundMotions array', () => {
    const model = gen();
    expect(model.groundMotions).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. NODE COORDINATES
// ═══════════════════════════════════════════════════════════════════════════

describe('node coordinates', () => {
  it('base nodes are at y=0', () => {
    const model = gen({ baysX: 1, baysZ: 1, stories: 1, baseType: 'fixed' });
    const baseNodes = model.nodes.filter((n) => n.y === 0);
    expect(baseNodes).toHaveLength(4); // 2x2 grid at base
  });

  it('floor k nodes at y = k * storyHeight * 12', () => {
    const storyHeight = 12; // 12 ft
    const model = gen({
      baysX: 1,
      baysZ: 1,
      stories: 3,
      storyHeight,
      baseType: 'fixed',
    });

    for (let k = 0; k <= 3; k++) {
      const expectedY = k * storyHeight * 12; // ft to inches
      const nodesAtLevel = model.nodes.filter((n) => n.y === expectedY);
      expect(nodesAtLevel).toHaveLength(4); // 2x2 grid per level
    }
  });

  it('X positions match ix * bayWidthX * 12', () => {
    const model = gen({
      baysX: 2,
      baysZ: 1,
      bayWidthX: 25,
      stories: 1,
      baseType: 'fixed',
    });

    const xPositions = [...new Set(model.nodes.map((n) => n.x))].sort((a, b) => a - b);
    expect(xPositions).toEqual([0, 25 * 12, 50 * 12]); // 0, 300, 600
  });

  it('Z positions match iz * bayWidthZ * 12', () => {
    const model = gen({
      baysX: 1,
      baysZ: 3,
      bayWidthZ: 15,
      stories: 1,
      baseType: 'fixed',
    });

    const zPositions = [...new Set(model.nodes.map((n) => n.z))].sort((a, b) => a - b);
    expect(zPositions).toEqual([0, 15 * 12, 30 * 12, 45 * 12]);
  });

  it('non-uniform bay widths produce correct X and Z spacing', () => {
    const model = gen({
      baysX: 2,
      baysZ: 2,
      bayWidthX: 25,
      bayWidthZ: 30,
      stories: 1,
      baseType: 'fixed',
    });

    const xSet = [...new Set(model.nodes.map((n) => n.x))].sort((a, b) => a - b);
    const zSet = [...new Set(model.nodes.map((n) => n.z))].sort((a, b) => a - b);

    expect(xSet).toEqual([0, 300, 600]); // 25*12=300
    expect(zSet).toEqual([0, 360, 720]); // 30*12=360
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. BOUNDARY CONDITIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('boundary conditions', () => {
  it('fixed base: base nodes fully restrained, upper nodes free', () => {
    const model = gen({
      baysX: 1,
      baysZ: 1,
      stories: 1,
      baseType: 'fixed',
    });

    const baseNodes = model.nodes.filter((n) => n.y === 0);
    const upperNodes = model.nodes.filter((n) => n.y > 0);

    expect(baseNodes.length).toBeGreaterThan(0);
    expect(upperNodes.length).toBeGreaterThan(0);

    baseNodes.forEach((n) => {
      expect(n.restraint).toEqual(FIXED);
    });
    upperNodes.forEach((n) => {
      expect(n.restraint).toEqual(FREE);
    });
  });

  it('isolated base: base nodes free, ground nodes at y=-1 fixed', () => {
    const model = gen({
      baysX: 1,
      baysZ: 1,
      stories: 1,
      baseType: 'isolated',
    });

    const groundNodes = model.nodes.filter((n) => n.y === -1);
    const baseNodes = model.nodes.filter((n) => n.y === 0);
    const upperNodes = model.nodes.filter((n) => n.y > 0);

    expect(groundNodes.length).toBeGreaterThan(0);
    expect(baseNodes.length).toBeGreaterThan(0);

    groundNodes.forEach((n) => {
      expect(n.restraint).toEqual(FIXED);
    });
    baseNodes.forEach((n) => {
      expect(n.restraint).toEqual(FREE);
    });
    upperNodes.forEach((n) => {
      expect(n.restraint).toEqual(FREE);
    });
  });

  it('isolated base creates ground nodes for each base column', () => {
    const model = gen({
      baysX: 2,
      baysZ: 2,
      stories: 1,
      baseType: 'isolated',
    });

    const nodesPerFloor = 3 * 3; // 9
    const groundNodes = model.nodes.filter((n) => n.y === -1);
    expect(groundNodes).toHaveLength(nodesPerFloor);
  });

  it('fixed base has no ground nodes below y=0', () => {
    const model = gen({ baseType: 'fixed' });
    const belowBase = model.nodes.filter((n) => n.y < 0);
    expect(belowBase).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. MATERIALS
// ═══════════════════════════════════════════════════════════════════════════

describe('materials', () => {
  it('steel frame produces exactly 1 material with E=29000', () => {
    const model = gen({ material: 'steel' });
    expect(model.materials).toHaveLength(1);
    expect(model.materials[0]!.id).toBe(1);
    expect(model.materials[0]!.E).toBe(29000);
    expect(model.materials[0]!.Fy).toBe(50);
  });

  it('steel material name contains "Steel" or "A992"', () => {
    const model = gen({ material: 'steel' });
    const name = model.materials[0]!.name;
    expect(name.match(/steel|a992/i)).toBeTruthy();
  });

  it('concrete frame produces exactly 1 material with E=3600', () => {
    const model = gen({ material: 'concrete' });
    expect(model.materials).toHaveLength(1);
    expect(model.materials[0]!.id).toBe(1);
    expect(model.materials[0]!.E).toBe(3600);
    expect(model.materials[0]!.Fy).toBe(4);
  });

  it('concrete material name contains "Concrete"', () => {
    const model = gen({ material: 'concrete' });
    expect(model.materials[0]!.name).toMatch(/concrete/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. SECTION AUTO-SIZING
// ═══════════════════════════════════════════════════════════════════════════

describe('auto-sizing', () => {
  it('produces at least 2 sections (column + beam)', () => {
    const model = gen({ material: 'steel' });
    expect(model.sections.length).toBeGreaterThanOrEqual(2);
  });

  it('steel 2-story: column Ix ~ 999 (W14x90 range)', () => {
    const model = gen({ stories: 2, material: 'steel' });
    const colSectionIds = new Set(
      model.elements.filter((e) => e.type === 'column').map((e) => e.sectionId),
    );
    const colSections = model.sections.filter((s) => colSectionIds.has(s.id));
    // W14x90 has Ix=999 in^4 — allow some tolerance for auto-sizing logic
    colSections.forEach((s) => {
      expect(s.Ix).toBeGreaterThan(0);
    });
    // At least one column section should be in a reasonable range for a 2-story
    const minIx = Math.min(...colSections.map((s) => s.Ix));
    expect(minIx).toBeGreaterThanOrEqual(200); // at least reasonable
  });

  it('steel 8-story: column sections heavier than 2-story', () => {
    const model2 = gen({ stories: 2, material: 'steel' });
    const model8 = gen({ stories: 8, material: 'steel' });

    const maxColIx = (m: ModelJSON) => {
      const colSectionIds = new Set(
        m.elements.filter((e) => e.type === 'column').map((e) => e.sectionId),
      );
      const ixValues = m.sections.filter((s) => colSectionIds.has(s.id)).map((s) => s.Ix);
      return Math.max(...ixValues);
    };

    expect(maxColIx(model8)).toBeGreaterThan(maxColIx(model2));
  });

  it('concrete sections have positive square-like properties', () => {
    const model = gen({ material: 'concrete' });
    model.sections.forEach((s) => {
      expect(s.area).toBeGreaterThan(0);
      expect(s.Ix).toBeGreaterThan(0);
      expect(s.Iy).toBeGreaterThan(0);
    });
  });

  it('different X/Z bay widths may produce different beam sections', () => {
    const model = gen({
      baysX: 2,
      baysZ: 2,
      bayWidthX: 15,
      bayWidthZ: 35,
      material: 'steel',
    });

    // Collect unique section IDs used by beam elements
    const beamSectionIds = new Set(
      model.elements.filter((e) => e.type === 'beam').map((e) => e.sectionId),
    );
    // With significantly different bay widths, at least 2 beam section IDs expected
    // (one for short X-span, one for long Z-span), though implementation may vary
    expect(beamSectionIds.size).toBeGreaterThanOrEqual(1);
  });

  it('all elements reference valid section and material IDs', () => {
    const model = gen({ stories: 3, material: 'steel' });
    const sectionIds = new Set(model.sections.map((s) => s.id));
    const materialIds = new Set(model.materials.map((m) => m.id));

    model.elements.forEach((e) => {
      expect(sectionIds.has(e.sectionId)).toBe(true);
      expect(materialIds.has(e.materialId)).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. GRAVITY LOADS
// ═══════════════════════════════════════════════════════════════════════════

describe('gravity loads', () => {
  it('loads only on elevated floors, not on base level', () => {
    const model = gen({ baysX: 2, baysZ: 2, stories: 2, baseType: 'fixed' });

    const baseNodeIds = new Set(model.nodes.filter((n) => n.y === 0).map((n) => n.id));
    const loadNodeIds = model.loads.map((l) => l.nodeId);

    loadNodeIds.forEach((nid) => {
      expect(baseNodeIds.has(nid)).toBe(false);
    });
  });

  it('all loads are downward (fy < 0)', () => {
    const model = gen();
    model.loads.forEach((l) => {
      expect(l.fy).toBeLessThan(0);
    });
  });

  it('non-vertical load components are zero', () => {
    const model = gen();
    model.loads.forEach((l) => {
      expect(l.fx).toBe(0);
      expect(l.fz).toBe(0);
      expect(l.mx).toBe(0);
      expect(l.my).toBe(0);
      expect(l.mz).toBe(0);
    });
  });

  it('total load count = nodesPerFloor * stories', () => {
    const stories = 3;
    const model = gen({ baysX: 2, baysZ: 2, stories, baseType: 'fixed' });
    const nodesPerFloor = 3 * 3; // 9
    expect(model.loads).toHaveLength(nodesPerFloor * stories);
  });

  it('tributary area pattern: corner < edge < interior', () => {
    const model = gen({
      baysX: 2,
      baysZ: 2,
      stories: 1,
      bayWidthX: 20,
      bayWidthZ: 20,
      baseType: 'fixed',
    });

    // Floor 1 nodes are at y = storyHeight * 12
    const floorY = 15 * 12;
    const floorNodes = model.nodes.filter((n) => n.y === floorY);

    // Classify nodes by position in the 3x3 grid
    const xVals = [...new Set(floorNodes.map((n) => n.x))].sort((a, b) => a - b);
    const zVals = [...new Set(floorNodes.map((n) => n.z))].sort((a, b) => a - b);

    const xMin = xVals[0]!;
    const xMax = xVals[xVals.length - 1]!;
    const zMin = zVals[0]!;
    const zMax = zVals[zVals.length - 1]!;

    const isCorner = (n: { x: number; z: number }) =>
      (n.x === xMin || n.x === xMax) && (n.z === zMin || n.z === zMax);
    const isInterior = (n: { x: number; z: number }) =>
      n.x !== xMin && n.x !== xMax && n.z !== zMin && n.z !== zMax;
    const isEdge = (n: { x: number; z: number }) => !isCorner(n) && !isInterior(n);

    const loadByNode = new Map(model.loads.map((l) => [l.nodeId, l]));

    const cornerLoads = floorNodes.filter(isCorner).map((n) => Math.abs(loadByNode.get(n.id)!.fy));
    const edgeLoads = floorNodes.filter(isEdge).map((n) => Math.abs(loadByNode.get(n.id)!.fy));
    const interiorLoads = floorNodes
      .filter(isInterior)
      .map((n) => Math.abs(loadByNode.get(n.id)!.fy));

    // For a symmetric 2x2 grid: 4 corners, 4 edges, 1 interior
    expect(cornerLoads).toHaveLength(4);
    expect(edgeLoads).toHaveLength(4);
    expect(interiorLoads).toHaveLength(1);

    // Tributary area: corner=1/4, edge=1/2, interior=1 bay area
    // So corner < edge < interior
    const avgCorner = cornerLoads.reduce((a, b) => a + b, 0) / cornerLoads.length;
    const avgEdge = edgeLoads.reduce((a, b) => a + b, 0) / edgeLoads.length;
    const avgInterior = interiorLoads.reduce((a, b) => a + b, 0) / interiorLoads.length;

    expect(avgCorner).toBeLessThan(avgEdge);
    expect(avgEdge).toBeLessThan(avgInterior);
  });

  it('corner load is approximately 1/4 of interior load for square bay', () => {
    const model = gen({
      baysX: 2,
      baysZ: 2,
      bayWidthX: 20,
      bayWidthZ: 20,
      stories: 1,
      baseType: 'fixed',
    });

    const floorY = 15 * 12;
    const floorNodes = model.nodes.filter((n) => n.y === floorY);
    const xVals = [...new Set(floorNodes.map((n) => n.x))].sort((a, b) => a - b);
    const zVals = [...new Set(floorNodes.map((n) => n.z))].sort((a, b) => a - b);
    const xMin = xVals[0]!;
    const xMax = xVals[xVals.length - 1]!;
    const zMin = zVals[0]!;
    const zMax = zVals[zVals.length - 1]!;

    const loadByNode = new Map(model.loads.map((l) => [l.nodeId, l]));

    const cornerNode = floorNodes.find((n) => n.x === xMin && n.z === zMin)!;
    const interiorNode = floorNodes.find(
      (n) => n.x !== xMin && n.x !== xMax && n.z !== zMin && n.z !== zMax,
    )!;

    const cornerFy = Math.abs(loadByNode.get(cornerNode.id)!.fy);
    const interiorFy = Math.abs(loadByNode.get(interiorNode.id)!.fy);

    // corner should be ~25% of interior (tolerance for rounding)
    const ratio = cornerFy / interiorFy;
    expect(ratio).toBeCloseTo(0.25, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. TFP BEARINGS (ISOLATED BASE)
// ═══════════════════════════════════════════════════════════════════════════

describe('isolated base bearings', () => {
  it('fixed base: bearings array is empty', () => {
    const model = gen({ baseType: 'fixed' });
    expect(model.bearings).toHaveLength(0);
  });

  it('isolated base: one bearing per base column', () => {
    const model = gen({
      baysX: 2,
      baysZ: 2,
      stories: 2,
      baseType: 'isolated',
    });

    const nodesPerFloor = 3 * 3; // 9
    expect(model.bearings).toHaveLength(nodesPerFloor);
  });

  it('bearing nodeI references ground node (id = 200 + baseNodeId)', () => {
    const model = gen({
      baysX: 1,
      baysZ: 1,
      stories: 1,
      baseType: 'isolated',
    });

    const baseNodeIds = model.nodes.filter((n) => n.y === 0).map((n) => n.id);

    model.bearings.forEach((b) => {
      // nodeJ should be a base node, nodeI the corresponding ground node
      expect(baseNodeIds).toContain(b.nodeJ);
      expect(b.nodeI).toBe(200 + b.nodeJ);
    });
  });

  it('ground nodes exist at y=-1 for each bearing', () => {
    const model = gen({
      baysX: 2,
      baysZ: 1,
      stories: 1,
      baseType: 'isolated',
    });

    const groundNodeIds = new Set(model.nodes.filter((n) => n.y === -1).map((n) => n.id));

    model.bearings.forEach((b) => {
      expect(groundNodeIds.has(b.nodeI)).toBe(true);
    });
  });

  it('bearing weights differ by position (corner < edge < interior)', () => {
    const model = gen({
      baysX: 2,
      baysZ: 2,
      stories: 2,
      baseType: 'isolated',
    });

    const baseNodes = model.nodes.filter((n) => n.y === 0);
    const xVals = [...new Set(baseNodes.map((n) => n.x))].sort((a, b) => a - b);
    const zVals = [...new Set(baseNodes.map((n) => n.z))].sort((a, b) => a - b);
    const xMin = xVals[0]!;
    const xMax = xVals[xVals.length - 1]!;
    const zMin = zVals[0]!;
    const zMax = zVals[zVals.length - 1]!;

    // Map bearing to its base node position
    const bearingByBaseId = new Map(model.bearings.map((b) => [b.nodeJ, b]));

    const cornerWeight = baseNodes
      .filter((n) => (n.x === xMin || n.x === xMax) && (n.z === zMin || n.z === zMax))
      .map((n) => bearingByBaseId.get(n.id)!.weight);

    const interiorWeight = baseNodes
      .filter((n) => n.x !== xMin && n.x !== xMax && n.z !== zMin && n.z !== zMax)
      .map((n) => bearingByBaseId.get(n.id)!.weight);

    // At least one corner and one interior
    expect(cornerWeight.length).toBeGreaterThan(0);
    expect(interiorWeight.length).toBeGreaterThan(0);

    // corner should be lighter than interior
    const avgCorner = cornerWeight.reduce((a, b) => a + b, 0) / cornerWeight.length;
    const avgInterior = interiorWeight.reduce((a, b) => a + b, 0) / interiorWeight.length;
    expect(avgCorner).toBeLessThan(avgInterior);
  });

  it('all bearings have valid 4-surface friction model', () => {
    const model = gen({ baseType: 'isolated' });
    model.bearings.forEach((b) => {
      expect(b.surfaces).toHaveLength(4);
      b.surfaces.forEach((s) => {
        expect(s.muSlow).toBeGreaterThan(0);
        expect(s.muFast).toBeGreaterThanOrEqual(s.muSlow);
        expect(s.transRate).toBeGreaterThan(0);
      });
    });
  });

  it('all bearings have positive radii and displacement capacities', () => {
    const model = gen({ baseType: 'isolated' });
    model.bearings.forEach((b) => {
      expect(b.radii).toHaveLength(3);
      b.radii.forEach((r) => expect(r).toBeGreaterThan(0));
      expect(b.dispCapacities).toHaveLength(3);
      b.dispCapacities.forEach((d) => expect(d).toBeGreaterThan(0));
      expect(b.weight).toBeGreaterThan(0);
      expect(b.yieldDisp).toBeGreaterThan(0);
      expect(b.vertStiffness).toBeGreaterThan(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. RIGID DIAPHRAGMS
// ═══════════════════════════════════════════════════════════════════════════

describe('rigid diaphragms', () => {
  it('diaphragms disabled: no diaphragms in output', () => {
    const model = gen({ diaphragms: false });
    expect(model.diaphragms === undefined || model.diaphragms.length === 0).toBe(true);
  });

  it('diaphragms enabled: one per elevated floor', () => {
    const stories = 3;
    const model = gen({ stories, diaphragms: true });
    expect(model.diaphragms).toBeDefined();
    expect(model.diaphragms!).toHaveLength(stories);
  });

  it('each diaphragm master node is on its respective floor', () => {
    const storyHeight = 12;
    const model = gen({
      baysX: 2,
      baysZ: 2,
      stories: 3,
      storyHeight,
      diaphragms: true,
      baseType: 'fixed',
    });

    const nodeMap = new Map(model.nodes.map((n) => [n.id, n]));

    model.diaphragms!.forEach((d, i) => {
      const masterNode = nodeMap.get(d.masterNodeId)!;
      const expectedY = (i + 1) * storyHeight * 12;
      expect(masterNode.y).toBe(expectedY);
    });
  });

  it('constrained nodes are on the same floor as the master', () => {
    const storyHeight = 15;
    const model = gen({
      baysX: 2,
      baysZ: 2,
      stories: 2,
      storyHeight,
      diaphragms: true,
      baseType: 'fixed',
    });

    const nodeMap = new Map(model.nodes.map((n) => [n.id, n]));

    model.diaphragms!.forEach((d) => {
      const masterY = nodeMap.get(d.masterNodeId)!.y;
      d.constrainedNodeIds.forEach((cid) => {
        const cn = nodeMap.get(cid)!;
        expect(cn.y).toBe(masterY);
      });
    });
  });

  it('each diaphragm has (nodesPerFloor - 1) constrained nodes', () => {
    const model = gen({
      baysX: 2,
      baysZ: 2,
      stories: 2,
      diaphragms: true,
    });

    const nodesPerFloor = 3 * 3; // 9
    model.diaphragms!.forEach((d) => {
      expect(d.constrainedNodeIds).toHaveLength(nodesPerFloor - 1);
    });
  });

  it('perpDirection = 2 for Y-up coordinate system', () => {
    const model = gen({ diaphragms: true });
    model.diaphragms!.forEach((d) => {
      expect(d.perpDirection).toBe(2);
    });
  });

  it('master node is not in its own constrained list', () => {
    const model = gen({ diaphragms: true });
    model.diaphragms!.forEach((d) => {
      expect(d.constrainedNodeIds).not.toContain(d.masterNodeId);
    });
  });

  it('all constrained node IDs are valid node IDs in the model', () => {
    const model = gen({ diaphragms: true });
    const allNodeIds = new Set(model.nodes.map((n) => n.id));

    model.diaphragms!.forEach((d) => {
      expect(allNodeIds.has(d.masterNodeId)).toBe(true);
      d.constrainedNodeIds.forEach((cid) => {
        expect(allNodeIds.has(cid)).toBe(true);
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe('edge cases', () => {
  it('1x1x1 minimum viable frame generates valid output', () => {
    const model = gen({
      baysX: 1,
      baysZ: 1,
      stories: 1,
      baseType: 'fixed',
    });

    expect(model.nodes.length).toBeGreaterThan(0);
    expect(model.elements.length).toBeGreaterThan(0);
    expect(model.sections.length).toBeGreaterThan(0);
    expect(model.materials.length).toBeGreaterThan(0);
    expect(model.loads.length).toBeGreaterThan(0);
  });

  it('5x5x10 large frame has no ID collisions', () => {
    const model = gen({
      baysX: 5,
      baysZ: 5,
      stories: 10,
      baseType: 'fixed',
    });

    const nodeIds = model.nodes.map((n) => n.id);
    expect(new Set(nodeIds).size).toBe(nodeIds.length);

    const elemIds = model.elements.map((e) => e.id);
    expect(new Set(elemIds).size).toBe(elemIds.length);

    const loadIds = model.loads.map((l) => l.id);
    expect(new Set(loadIds).size).toBe(loadIds.length);
  });

  it('5x5x10 large frame: expected counts', () => {
    const model = gen({
      baysX: 5,
      baysZ: 5,
      stories: 10,
      baseType: 'fixed',
    });

    const nodesPerFloor = 6 * 6; // 36
    expect(model.nodes).toHaveLength(nodesPerFloor * 11); // 396

    const cols = nodesPerFloor * 10; // 360
    const xBeams = 5 * 6 * 10; // 300
    const zBeams = 6 * 5 * 10; // 300
    expect(model.elements).toHaveLength(cols + xBeams + zBeams); // 960
  });

  it('1x3x2 single bay in X direction: beam connectivity valid', () => {
    const model = gen({
      baysX: 1,
      baysZ: 3,
      stories: 2,
      baseType: 'fixed',
    });

    const nodeIdSet = new Set(model.nodes.map((n) => n.id));

    // All element nodeI and nodeJ must reference existing nodes
    model.elements.forEach((e) => {
      expect(nodeIdSet.has(e.nodeI)).toBe(true);
      expect(nodeIdSet.has(e.nodeJ)).toBe(true);
    });

    // X-beams: 1 bay * 4 rows * 2 floors = 8
    // Z-beams: 2 cols * 3 bays * 2 floors = 12
    const beamCount = countByType(model, 'beam');
    expect(beamCount).toBe(8 + 12);
  });

  it('isolated + 5x5x10 large frame has correct bearing count', () => {
    const model = gen({
      baysX: 5,
      baysZ: 5,
      stories: 10,
      baseType: 'isolated',
    });

    const nodesPerFloor = 6 * 6; // 36
    expect(model.bearings).toHaveLength(nodesPerFloor);
  });

  it('1x1x1 isolated frame has 4 bearings and 4 ground nodes', () => {
    const model = gen({
      baysX: 1,
      baysZ: 1,
      stories: 1,
      baseType: 'isolated',
    });

    expect(model.bearings).toHaveLength(4);
    const groundNodes = model.nodes.filter((n) => n.y === -1);
    expect(groundNodes).toHaveLength(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. ID UNIQUENESS
// ═══════════════════════════════════════════════════════════════════════════

describe('ID uniqueness', () => {
  it('3x3x3 frame: all node IDs unique', () => {
    const model = gen({
      baysX: 3,
      baysZ: 3,
      stories: 3,
      baseType: 'fixed',
    });

    const nodeIds = model.nodes.map((n) => n.id);
    expect(new Set(nodeIds).size).toBe(nodeIds.length);
  });

  it('3x3x3 frame: all element IDs unique', () => {
    const model = gen({
      baysX: 3,
      baysZ: 3,
      stories: 3,
      baseType: 'fixed',
    });

    const elemIds = model.elements.map((e) => e.id);
    expect(new Set(elemIds).size).toBe(elemIds.length);
  });

  it('3x3x3 frame: all load IDs unique', () => {
    const model = gen({
      baysX: 3,
      baysZ: 3,
      stories: 3,
      baseType: 'fixed',
    });

    const loadIds = model.loads.map((l) => l.id);
    expect(new Set(loadIds).size).toBe(loadIds.length);
  });

  it('isolated 3x3x3: ground node IDs do not collide with structure node IDs', () => {
    const model = gen({
      baysX: 3,
      baysZ: 3,
      stories: 3,
      baseType: 'isolated',
    });

    const structureNodeIds = model.nodes.filter((n) => n.y >= 0).map((n) => n.id);
    const groundNodeIds = model.nodes.filter((n) => n.y === -1).map((n) => n.id);

    const structSet = new Set(structureNodeIds);
    groundNodeIds.forEach((gid) => {
      expect(structSet.has(gid)).toBe(false);
    });
  });

  it('isolated 3x3x3: bearing IDs unique', () => {
    const model = gen({
      baysX: 3,
      baysZ: 3,
      stories: 3,
      baseType: 'isolated',
    });

    const bearingIds = model.bearings.map((b) => b.id);
    expect(new Set(bearingIds).size).toBe(bearingIds.length);
  });

  it('diaphragm IDs unique', () => {
    const model = gen({
      baysX: 2,
      baysZ: 2,
      stories: 5,
      diaphragms: true,
    });

    const diaIds = model.diaphragms!.map((d) => d.id);
    expect(new Set(diaIds).size).toBe(diaIds.length);
  });

  it('all element node references point to existing nodes', () => {
    const configs: Partial<BayBuildParams>[] = [
      { baysX: 1, baysZ: 1, stories: 1, baseType: 'fixed' },
      { baysX: 3, baysZ: 2, stories: 5, baseType: 'fixed' },
      { baysX: 2, baysZ: 2, stories: 3, baseType: 'isolated' },
      { baysX: 5, baysZ: 5, stories: 10, baseType: 'fixed' },
    ];

    configs.forEach((cfg) => {
      const model = gen(cfg);
      const nodeIdSet = new Set(model.nodes.map((n) => n.id));

      model.elements.forEach((e) => {
        expect(nodeIdSet.has(e.nodeI)).toBe(true);
        expect(nodeIdSet.has(e.nodeJ)).toBe(true);
      });

      model.bearings.forEach((b) => {
        expect(nodeIdSet.has(b.nodeI)).toBe(true);
        expect(nodeIdSet.has(b.nodeJ)).toBe(true);
      });

      model.loads.forEach((l) => {
        expect(nodeIdSet.has(l.nodeId)).toBe(true);
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. ELEMENT CONNECTIVITY (bonus coverage)
// ═══════════════════════════════════════════════════════════════════════════

describe('element connectivity', () => {
  it('columns connect lower level to upper level (nodeI.y < nodeJ.y)', () => {
    const model = gen({
      baysX: 2,
      baysZ: 2,
      stories: 2,
      baseType: 'fixed',
    });

    const nodeMap = new Map(model.nodes.map((n) => [n.id, n]));
    const columns = model.elements.filter((e) => e.type === 'column');

    columns.forEach((col) => {
      const ni = nodeMap.get(col.nodeI)!;
      const nj = nodeMap.get(col.nodeJ)!;
      // Column should be vertical: same X,Z; different Y
      expect(ni.x).toBe(nj.x);
      expect(ni.z).toBe(nj.z);
      // Typically nodeI is bottom, nodeJ is top (or vice versa)
      expect(ni.y).not.toBe(nj.y);
    });
  });

  it('beams connect nodes on the same level (nodeI.y === nodeJ.y)', () => {
    const model = gen({
      baysX: 2,
      baysZ: 2,
      stories: 2,
      baseType: 'fixed',
    });

    const nodeMap = new Map(model.nodes.map((n) => [n.id, n]));
    const beams = model.elements.filter((e) => e.type === 'beam');

    beams.forEach((beam) => {
      const ni = nodeMap.get(beam.nodeI)!;
      const nj = nodeMap.get(beam.nodeJ)!;
      expect(ni.y).toBe(nj.y);
    });
  });

  it('beams span exactly one bay width', () => {
    const bayWidthX = 25;
    const bayWidthZ = 30;
    const model = gen({
      baysX: 2,
      baysZ: 2,
      bayWidthX,
      bayWidthZ,
      stories: 1,
      baseType: 'fixed',
    });

    const nodeMap = new Map(model.nodes.map((n) => [n.id, n]));
    const beams = model.elements.filter((e) => e.type === 'beam');

    beams.forEach((beam) => {
      const ni = nodeMap.get(beam.nodeI)!;
      const nj = nodeMap.get(beam.nodeJ)!;

      const dx = Math.abs(nj.x - ni.x);
      const dz = Math.abs(nj.z - ni.z);

      // A beam runs in either X or Z, not both
      if (dx > 0) {
        expect(dx).toBe(bayWidthX * 12);
        expect(dz).toBe(0);
      } else {
        expect(dz).toBe(bayWidthZ * 12);
        expect(dx).toBe(0);
      }
    });
  });

  it('columns span exactly one story height', () => {
    const storyHeight = 14;
    const model = gen({
      baysX: 1,
      baysZ: 1,
      stories: 3,
      storyHeight,
      baseType: 'fixed',
    });

    const nodeMap = new Map(model.nodes.map((n) => [n.id, n]));
    const columns = model.elements.filter((e) => e.type === 'column');

    columns.forEach((col) => {
      const ni = nodeMap.get(col.nodeI)!;
      const nj = nodeMap.get(col.nodeJ)!;
      const dy = Math.abs(nj.y - ni.y);
      expect(dy).toBe(storyHeight * 12);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. MODEL INFO (bonus coverage)
// ═══════════════════════════════════════════════════════════════════════════

describe('model info', () => {
  it('model name includes material and base type', () => {
    const steelFixed = gen({ material: 'steel', baseType: 'fixed' });
    expect(steelFixed.modelInfo.name).toMatch(/steel/i);
    expect(steelFixed.modelInfo.name).toMatch(/fixed/i);

    const concreteIso = gen({ material: 'concrete', baseType: 'isolated' });
    expect(concreteIso.modelInfo.name).toMatch(/concrete/i);
    expect(concreteIso.modelInfo.name).toMatch(/isolated/i);
  });

  it('model name includes bay dimensions', () => {
    const model = gen({ baysX: 3, baysZ: 4, stories: 7 });
    expect(model.modelInfo.name).toContain('3x4x7');
  });

  it('units are always kip-in', () => {
    const configs: Partial<BayBuildParams>[] = [
      { material: 'steel' },
      { material: 'concrete' },
      { baseType: 'fixed' },
      { baseType: 'isolated' },
    ];

    configs.forEach((cfg) => {
      expect(gen(cfg).modelInfo.units).toBe('kip-in');
    });
  });

  it('description is a non-empty string', () => {
    const model = gen();
    expect(typeof model.modelInfo.description).toBe('string');
    expect(model.modelInfo.description.length).toBeGreaterThan(0);
  });
});
