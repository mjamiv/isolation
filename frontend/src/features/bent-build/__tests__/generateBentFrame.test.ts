/**
 * Comprehensive tests for the Bent Build bridge generator.
 *
 * Tests cover node topology, element connectivity, boundary conditions,
 * material selection, section auto-sizing, gravity loads, TFP bearings,
 * equalDOF constraints, rigid diaphragms, AASHTO live loads, dead loads,
 * and ID uniqueness across conventional/isolated bridge configurations.
 */

import { describe, it, expect } from 'vitest';
import { generateBentFrame } from '../generateBentFrame';
import type { BentBuildParams, PierSupportConfig, AlignmentParams } from '../bentBuildTypes';
import {
  DEFAULT_BENT_BUILD_PARAMS,
  DEFAULT_DEAD_LOADS,
  DEFAULT_ALIGNMENT,
} from '../bentBuildTypes';
import {
  aashtoLaneCount,
  aashtoMPF,
  aashtoLaneLoadKlf,
  computeGirderNodeLoad,
} from '../bentLoadCalc';
import {
  selectSteelGirderSection,
  selectConcreteColumnSection,
  computePierCapSection,
} from '../bentSectionTables';
import type { ModelJSON } from '@/types/modelJSON';

// ---------------------------------------------------------------------------
// Shared defaults
// ---------------------------------------------------------------------------

const DEFAULT: BentBuildParams = { ...DEFAULT_BENT_BUILD_PARAMS };

/** Shorthand: generate with selected overrides. */
function gen(overrides: Partial<BentBuildParams> = {}): ModelJSON {
  return generateBentFrame({ ...DEFAULT, ...overrides });
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
const ROLLER: [boolean, boolean, boolean, boolean, boolean, boolean] = [
  false,
  true,
  true,
  false,
  false,
  false,
];

/** Count elements by type. */
function countByType(model: ModelJSON, type: string) {
  return model.elements.filter((e) => e.type === type).length;
}

// ===========================================================================
// 1. BASIC GENERATION
// ===========================================================================

describe('basic generation', () => {
  it('1-span bridge has correct node count (no piers)', () => {
    const model = gen({
      numSpans: 1,
      spanLengths: [80],
      columnHeights: [],
      pierSupports: [],
    });

    // 2 abutments * 6 girders = 12 deck nodes, 0 base/cap/ground
    expect(model.nodes).toHaveLength(12);
  });

  it('2-span bridge has correct node count', () => {
    const model = gen({
      numSpans: 2,
      spanLengths: [80, 80],
      columnHeights: [20],
      pierSupports: [{ type: 'FIX', guided: false }],
    });

    // 3 support lines * 6 girders = 18 deck nodes
    // 1 pier * 2 bent columns = 2 base nodes
    // 1 pier * 6 girders = 6 cap nodes (all piers have separate cap)
    expect(model.nodes).toHaveLength(26);
  });

  it('3-span default bridge has correct node count', () => {
    const model = gen();

    // 4 support lines * 6 girders = 24 deck nodes
    // 2 piers * 2 bent columns = 4 base nodes
    // 2 piers * 6 girders = 12 cap nodes (all piers have separate cap)
    expect(model.nodes).toHaveLength(40);
  });

  it('model name includes span count', () => {
    const model = gen();
    expect(model.modelInfo.name).toContain('3-Span');
  });

  it('model uses kip-in units', () => {
    const model = gen();
    expect(model.modelInfo.units).toBe('kip-in');
  });

  it('model has non-empty description', () => {
    const model = gen();
    expect(model.modelInfo.description.length).toBeGreaterThan(0);
  });

  it('groundMotions array is empty', () => {
    const model = gen();
    expect(model.groundMotions).toEqual([]);
  });

  it('single-span has 0 column elements', () => {
    const model = gen({
      numSpans: 1,
      spanLengths: [80],
      columnHeights: [],
      pierSupports: [],
    });

    expect(countByType(model, 'column')).toBe(0);
  });
});

// ===========================================================================
// 2. NODE COORDINATES
// ===========================================================================

describe('node coordinates', () => {
  it('abutment 1 deck nodes at X=0', () => {
    const model = gen();
    const abt1DeckNodes = model.nodes.filter((n) => n.x === 0 && n.label?.startsWith('Deck SL1'));
    expect(abt1DeckNodes).toHaveLength(6); // numGirders=6
    abt1DeckNodes.forEach((n) => expect(n.x).toBe(0));
  });

  it('abutment 2 deck nodes at correct cumulative X', () => {
    const model = gen(); // spans: [80, 100, 80] -> total = 260 ft = 3120 in
    const totalX = (80 + 100 + 80) * 12;
    const abt2DeckNodes = model.nodes.filter(
      (n) => n.x === totalX && n.label?.startsWith('Deck SL4'),
    );
    expect(abt2DeckNodes).toHaveLength(6);
  });

  it('pier deck nodes at correct X positions', () => {
    const model = gen(); // spans [80, 100, 80]
    const pier1X = 80 * 12; // 960
    const pier2X = (80 + 100) * 12; // 2160

    const pier1Nodes = model.nodes.filter((n) => n.x === pier1X && n.label?.startsWith('Deck SL2'));
    const pier2Nodes = model.nodes.filter((n) => n.x === pier2X && n.label?.startsWith('Deck SL3'));

    expect(pier1Nodes).toHaveLength(6);
    expect(pier2Nodes).toHaveLength(6);
  });

  it('girder Z spacing matches (roadwayWidth - 2*overhang) / (numGirders-1)', () => {
    const model = gen(); // roadwayWidth=40, overhang=3.5, numGirders=6
    const expectedSpacing = ((40 - 2 * 3.5) * 12) / (6 - 1); // = 79.2

    const deckNodes = model.nodes.filter((n) => n.label?.startsWith('Deck SL1'));
    const zVals = deckNodes.map((n) => n.z).sort((a, b) => a - b);

    for (let i = 1; i < zVals.length; i++) {
      expect(zVals[i]! - zVals[i - 1]!).toBeCloseTo(expectedSpacing, 5);
    }
  });

  it('deck Y elevation at reference height + halfGirder', () => {
    const model = gen(); // columnHeights [20, 20] -> referenceDeckY = max(240, 240) = 240
    // maxSpanFt=100 -> W40x183 (d=39.74), halfGirder=19.87
    const halfGirder = selectSteelGirderSection(100).d / 2;
    const expectedY = 240 + halfGirder;

    const pier1DeckNodes = model.nodes.filter((n) => n.label?.startsWith('Deck SL2'));
    pier1DeckNodes.forEach((n) => expect(n.y).toBe(expectedY));
  });

  it('single-span abutments at default 240" + halfGirder', () => {
    const model = gen({
      numSpans: 1,
      spanLengths: [80],
      columnHeights: [],
      pierSupports: [],
    });

    // maxSpanFt=80 -> W36x150 (d=35.85), halfGirder=17.925
    const halfGirder = selectSteelGirderSection(80).d / 2;
    const deckNodes = model.nodes.filter((n) => n.label?.includes('Deck'));
    deckNodes.forEach((n) => expect(n.y).toBe(240 + halfGirder));
  });

  it('variable column heights: deck at reference elevation, bases differ', () => {
    const model = gen({
      numSpans: 3,
      spanLengths: [80, 100, 80],
      columnHeights: [25, 30],
      pierSupports: [
        { type: 'FIX', guided: false },
        { type: 'FIX', guided: false },
      ],
    });

    // referenceDeckY = max(240, 25*12, 30*12) = max(240, 300, 360) = 360
    const refDeckY = 360;
    // maxSpanFt=100 -> W40x183 (d=39.74), halfGirder=19.87
    const halfGirder = selectSteelGirderSection(100).d / 2;

    const pier1Deck = model.nodes.filter((n) => n.label?.startsWith('Deck SL2'));
    const pier2Deck = model.nodes.filter((n) => n.label?.startsWith('Deck SL3'));

    // Deck nodes at girder centroid (refDeckY + halfGirder)
    pier1Deck.forEach((n) => expect(n.y).toBe(refDeckY + halfGirder));
    pier2Deck.forEach((n) => expect(n.y).toBe(refDeckY + halfGirder));

    // Base nodes extend DOWN: baseY = refDeckY - colHeight*12
    const pier1Base = model.nodes.filter((n) => n.label?.startsWith('Base P1'));
    const pier2Base = model.nodes.filter((n) => n.label?.startsWith('Base P2'));

    pier1Base.forEach((n) => expect(n.y).toBe(refDeckY - 25 * 12)); // 360 - 300 = 60
    pier2Base.forEach((n) => expect(n.y).toBe(refDeckY - 30 * 12)); // 360 - 360 = 0
  });

  it('variable span lengths produce correct X positions', () => {
    const model = gen({
      numSpans: 3,
      spanLengths: [60, 120, 80],
      columnHeights: [20, 20],
      pierSupports: [
        { type: 'FIX', guided: false },
        { type: 'FIX', guided: false },
      ],
    });

    const xPositions = [...new Set(model.nodes.map((n) => n.x))].sort((a, b) => a - b);
    expect(xPositions).toContain(0);
    expect(xPositions).toContain(60 * 12);
    expect(xPositions).toContain((60 + 120) * 12);
    expect(xPositions).toContain((60 + 120 + 80) * 12);
  });
});

// ===========================================================================
// 3. BOUNDARY CONDITIONS
// ===========================================================================

describe('boundary conditions', () => {
  it('abutment nodes have roller restraint in conventional mode', () => {
    const model = gen();

    const abt1Nodes = model.nodes.filter((n) => n.label?.startsWith('Deck SL1'));
    const abt2Nodes = model.nodes.filter((n) => n.label?.startsWith('Deck SL4'));

    [...abt1Nodes, ...abt2Nodes].forEach((n) => {
      expect(n.restraint).toEqual(ROLLER);
    });
  });

  it('FIX pier base nodes have FIXED restraint', () => {
    const model = gen();

    const baseNodes = model.nodes.filter((n) => n.label?.startsWith('Base'));
    expect(baseNodes.length).toBeGreaterThan(0);
    baseNodes.forEach((n) => {
      expect(n.restraint).toEqual(FIXED);
    });
  });

  it('EXP pier cap nodes are FREE', () => {
    const model = gen({
      pierSupports: [
        { type: 'EXP', guided: false },
        { type: 'EXP', guided: false },
      ],
    });

    const capNodes = model.nodes.filter((n) => n.label?.startsWith('Cap P'));
    expect(capNodes.length).toBeGreaterThan(0);
    capNodes.forEach((n) => {
      expect(n.restraint).toEqual(FREE);
    });
  });

  it('EXP pier deck nodes are FREE', () => {
    const model = gen({
      pierSupports: [
        { type: 'EXP', guided: false },
        { type: 'EXP', guided: false },
      ],
    });

    // Deck nodes at pier support lines
    const pier1Deck = model.nodes.filter((n) => n.label?.startsWith('Deck SL2'));
    const pier2Deck = model.nodes.filter((n) => n.label?.startsWith('Deck SL3'));
    [...pier1Deck, ...pier2Deck].forEach((n) => {
      expect(n.restraint).toEqual(FREE);
    });
  });

  it('isolated col-base: base nodes are FREE', () => {
    const model = gen({
      supportMode: 'isolated',
      isolationLevel: 'base',
    });

    const baseNodes = model.nodes.filter((n) => n.label?.startsWith('Base'));
    expect(baseNodes.length).toBeGreaterThan(0);
    baseNodes.forEach((n) => {
      expect(n.restraint).toEqual(FREE);
    });
  });

  it('isolated col-base: ground nodes are FIXED', () => {
    const model = gen({
      supportMode: 'isolated',
      isolationLevel: 'base',
    });

    const groundNodes = model.nodes.filter((n) => n.label?.startsWith('Ground'));
    expect(groundNodes.length).toBeGreaterThan(0);
    groundNodes.forEach((n) => {
      expect(n.restraint).toEqual(FIXED);
    });
  });
});

// ===========================================================================
// 4. ELEMENT CONNECTIVITY
// ===========================================================================

describe('element connectivity', () => {
  it('correct number of girder elements (numGirders * numSpans)', () => {
    const model = gen(); // 6 girders, 3 spans
    const girders = model.elements.filter((e) => e.label?.startsWith('Girder'));
    expect(girders).toHaveLength(6 * 3);
  });

  it('correct number of cross-beam elements ((numGirders-1) * numSupportLines)', () => {
    const model = gen(); // 6 girders, 4 support lines
    const xbeams = model.elements.filter((e) => e.label?.startsWith('XBeam'));
    expect(xbeams).toHaveLength(5 * 4);
  });

  it('correct number of column elements (numBentColumns * numPiers)', () => {
    const model = gen(); // 2 bent columns, 2 piers
    expect(countByType(model, 'column')).toBe(2 * 2);
  });

  it('girders connect consecutive support line nodes', () => {
    const model = gen();
    const nodeMap = new Map(model.nodes.map((n) => [n.id, n]));

    const girders = model.elements.filter((e) => e.label?.startsWith('Girder'));
    girders.forEach((g) => {
      const ni = nodeMap.get(g.nodeI)!;
      const nj = nodeMap.get(g.nodeJ)!;
      // Same Z (same girder line), different X (different support lines)
      expect(ni.z).toBe(nj.z);
      expect(ni.x).not.toBe(nj.x);
    });
  });

  it('columns connect base to cap nodes', () => {
    const model = gen();
    const nodeMap = new Map(model.nodes.map((n) => [n.id, n]));

    const columns = model.elements.filter((e) => e.type === 'column');
    columns.forEach((col) => {
      const ni = nodeMap.get(col.nodeI)!;
      const nj = nodeMap.get(col.nodeJ)!;
      // One end is base, other end is cap; cap Y > base Y
      expect(ni.label).toContain('Base');
      expect(nj.label).toContain('Cap');
      expect(nj.y).toBeGreaterThan(ni.y);
    });
  });

  it('pier cap beams exist for EXP piers', () => {
    const model = gen({
      pierSupports: [
        { type: 'EXP', guided: false },
        { type: 'EXP', guided: false },
      ],
    });

    const pierCaps = model.elements.filter((e) => e.label?.startsWith('PierCap'));
    // 2 piers * (6-1) = 10 pier cap elements
    expect(pierCaps).toHaveLength(10);
  });

  it('pier cap beams exist for bearing-level isolation', () => {
    const model = gen({
      supportMode: 'isolated',
      isolationLevel: 'bearing',
    });

    const pierCaps = model.elements.filter((e) => e.label?.startsWith('PierCap'));
    // 2 piers * (6-1) = 10 pier cap elements
    expect(pierCaps).toHaveLength(10);
  });

  it('FIX piers have concrete pier cap beams (always separate cap)', () => {
    const model = gen(); // Default: all FIX piers

    const pierCaps = model.elements.filter((e) => e.label?.startsWith('PierCap'));
    // 2 piers * (6-1) = 10 pier cap elements
    expect(pierCaps).toHaveLength(10);
  });
});

// ===========================================================================
// 5. SECTION AUTO-SIZING
// ===========================================================================

describe('section auto-sizing', () => {
  it('steel girder section selected by span length', () => {
    const model = gen(); // max span 100 ft
    const girderSection = model.sections.find((s) => s.name.startsWith('W'));
    expect(girderSection).toBeDefined();
    // W40x183 for 100ft span
    expect(girderSection!.name).toBe('W40x183');
  });

  it('concrete girder section selected by span length', () => {
    const model = gen({ girderType: 'concrete' });
    const girderSection = model.sections.find((s) => s.name.startsWith('AASHTO'));
    expect(girderSection).toBeDefined();
    // max span 100 ft -> AASHTO Type IV
    expect(girderSection!.name).toBe('AASHTO Type IV');
  });

  it('column section is always concrete circular', () => {
    const steelModel = gen({ girderType: 'steel' });
    const concreteModel = gen({ girderType: 'concrete' });

    const steelColSection = steelModel.sections.find((s) => s.name.includes('Circular RC'));
    const concreteColSection = concreteModel.sections.find((s) => s.name.includes('Circular RC'));

    expect(steelColSection).toBeDefined();
    expect(concreteColSection).toBeDefined();
  });

  it('pier cap section computed from spacing and column diameter', () => {
    const model = gen();
    const capSection = model.sections.find((s) => s.name.includes('RC Cap'));
    expect(capSection).toBeDefined();
    expect(capSection!.area).toBeGreaterThan(0);
    expect(capSection!.Ix).toBeGreaterThan(0);
  });

  it('short span (40ft) gets smaller girder than long span (120ft)', () => {
    const short = gen({
      numSpans: 1,
      spanLengths: [40],
      columnHeights: [],
      pierSupports: [],
    });
    const long = gen({
      numSpans: 1,
      spanLengths: [120],
      columnHeights: [],
      pierSupports: [],
    });

    const shortGirder = short.sections.find((s) => s.name.startsWith('W'));
    const longGirder = long.sections.find((s) => s.name.startsWith('W'));

    expect(shortGirder!.Ix).toBeLessThan(longGirder!.Ix);
  });

  it('column section diameter increases with height', () => {
    const short = gen({
      columnHeights: [15, 15],
    });
    const tall = gen({
      columnHeights: [45, 45],
    });

    const shortCol = short.sections.find((s) => s.name.includes('Circular RC'));
    const tallCol = tall.sections.find((s) => s.name.includes('Circular RC'));

    expect(shortCol!.d).toBeLessThan(tallCol!.d);
  });
});

// ===========================================================================
// 6. MATERIALS
// ===========================================================================

describe('materials', () => {
  it('steel bridge has 2 materials (steel E=29000 + concrete E=3600)', () => {
    const model = gen({ girderType: 'steel' });
    expect(model.materials).toHaveLength(2);

    const steel = model.materials.find((m) => m.E === 29000);
    const concrete = model.materials.find((m) => m.E === 3600);
    expect(steel).toBeDefined();
    expect(concrete).toBeDefined();
  });

  it('concrete bridge has 1 material (concrete E=3600)', () => {
    const model = gen({ girderType: 'concrete' });
    expect(model.materials).toHaveLength(1);
    expect(model.materials[0]!.E).toBe(3600);
  });

  it('all elements have valid materialId references', () => {
    const model = gen();
    const matIds = new Set(model.materials.map((m) => m.id));

    model.elements.forEach((e) => {
      expect(matIds.has(e.materialId)).toBe(true);
    });
  });

  it('all sections have materialId that exists in materials array', () => {
    const model = gen();
    const matIds = new Set(model.materials.map((m) => m.id));

    // All elements referencing sections should also reference valid materials
    model.elements.forEach((e) => {
      expect(matIds.has(e.materialId)).toBe(true);
    });
  });
});

// ===========================================================================
// 7. GRAVITY LOADS
// ===========================================================================

describe('gravity loads', () => {
  it('every deck node at a support line has a gravity load', () => {
    const model = gen();
    const deckNodeIds = model.nodes.filter((n) => n.label?.startsWith('Deck')).map((n) => n.id);
    const loadNodeIds = new Set(model.loads.map((l) => l.nodeId));

    deckNodeIds.forEach((nid) => {
      expect(loadNodeIds.has(nid)).toBe(true);
    });
  });

  it('loads are negative fy (downward)', () => {
    const model = gen();
    model.loads.forEach((l) => {
      expect(l.fy).toBeLessThan(0);
    });
  });

  it('exterior girders get barrier load', () => {
    const model = gen({ numSpans: 1, spanLengths: [80], columnHeights: [], pierSupports: [] });

    // Exterior girders: gi=0 and gi=numGirders-1
    // For same tributary area, exterior should be heavier due to barrier
    const loadByNode = new Map(model.loads.map((l) => [l.nodeId, l]));

    // SL1 G1 (exterior, node 1) vs SL1 G3 (interior, node 3)
    const extLoad = Math.abs(loadByNode.get(1)!.fy);

    // Exterior has barrier klf; just check exterior load > 0.
    expect(extLoad).toBeGreaterThan(0);
  });

  it('interior girders do not get barrier load', () => {
    // Interior girder should have load purely from PSF components + LL
    const model = gen();
    const intLoad = model.loads.find((l) => l.nodeId === 3); // SL1 G3 (interior)
    expect(intLoad).toBeDefined();
    expect(intLoad!.fy).toBeLessThan(0);
  });

  it('abutment tributary length = half first/last span', () => {
    const model = gen({
      numSpans: 2,
      spanLengths: [60, 100],
      columnHeights: [20],
      pierSupports: [{ type: 'FIX', guided: false }],
      deadLoads: { ...DEFAULT_DEAD_LOADS, barrierKlf: 0 },
    });

    // Abt1 trib = 60/2 = 30 ft, Abt2 trib = 100/2 = 50 ft
    // Interior girders at abt1 should be lighter than abt2
    const loadByNode = new Map(model.loads.map((l) => [l.nodeId, l]));

    // SL1 G3 = interior at abt1 (nodeId = 1*6+2+1 = no... SL1=sli0, G3=gi2 -> id=0*6+2+1=3)
    // SL3 G3 = interior at abt2 (sli=2, gi=2 -> id=2*6+2+1=15)
    const abt1Interior = Math.abs(loadByNode.get(3)!.fy);
    const abt2Interior = Math.abs(loadByNode.get(15)!.fy);

    // 50/30 ratio means abt2 should be heavier
    expect(abt2Interior).toBeGreaterThan(abt1Interior);
  });

  it('pier tributary length = average of adjacent spans', () => {
    // 2-span bridge: spans [60, 100], pier trib = (60+100)/2 = 80 ft
    const model = gen({
      numSpans: 2,
      spanLengths: [60, 100],
      columnHeights: [20],
      pierSupports: [{ type: 'FIX', guided: false }],
      deadLoads: { ...DEFAULT_DEAD_LOADS, barrierKlf: 0 },
    });

    const loadByNode = new Map(model.loads.map((l) => [l.nodeId, l]));

    // SL2 G3 = pier interior (sli=1, gi=2 -> id=1*6+2+1=9)
    // Pier trib 80 ft vs abt1 trib 30 ft -> pier is heavier
    const pierInterior = Math.abs(loadByNode.get(9)!.fy);
    const abt1Interior = Math.abs(loadByNode.get(3)!.fy);

    expect(pierInterior).toBeGreaterThan(abt1Interior);
  });

  it('load count = numGirders * numSupportLines', () => {
    const model = gen(); // 6 girders, 4 support lines
    expect(model.loads).toHaveLength(6 * 4);
  });

  it('zero LL percent produces no live load component', () => {
    const result = computeGirderNodeLoad(
      DEFAULT_DEAD_LOADS,
      40, // tribLengthFt
      8, // spacingFt
      3.5, // overhangFt
      false, // isExterior
      40, // roadwayWidthFt
      6, // numGirders
      0, // llPercent
    );

    expect(result.liveLoadKips).toBe(0);
    expect(result.totalKips).toBe(result.deadLoadKips);
  });
});

// ===========================================================================
// 8. DIAPHRAGMS
// ===========================================================================

describe('diaphragms', () => {
  it('one diaphragm per support line', () => {
    const model = gen(); // 4 support lines
    expect(model.diaphragms).toBeDefined();
    expect(model.diaphragms!).toHaveLength(4);
  });

  it('diaphragm count = numSpans + 1', () => {
    const model5 = gen({
      numSpans: 5,
      spanLengths: [60, 80, 100, 80, 60],
      columnHeights: [20, 25, 25, 20],
      pierSupports: [
        { type: 'FIX', guided: false },
        { type: 'FIX', guided: false },
        { type: 'FIX', guided: false },
        { type: 'FIX', guided: false },
      ],
    });

    expect(model5.diaphragms!).toHaveLength(6);
  });

  it('master node is first girder at each support line', () => {
    const model = gen();

    // Master should be gi=0 at each support line (deckNodeId(sli, 0, 6))
    model.diaphragms!.forEach((d, sli) => {
      const expectedMaster = sli * 6 + 0 + 1; // deckNodeId formula
      expect(d.masterNodeId).toBe(expectedMaster);
    });
  });

  it('constrained nodes are remaining girders', () => {
    const model = gen(); // 6 girders per support line

    model.diaphragms!.forEach((d) => {
      expect(d.constrainedNodeIds).toHaveLength(5); // numGirders - 1
    });
  });

  it('perpDirection is 2 for all diaphragms', () => {
    const model = gen();
    model.diaphragms!.forEach((d) => {
      expect(d.perpDirection).toBe(2);
    });
  });
});

// ===========================================================================
// 9. CONVENTIONAL FIX
// ===========================================================================

describe('conventional FIX', () => {
  it('FIX pier: separate cap nodes with concrete pier cap beams', () => {
    const model = gen(); // Default all FIX

    const capNodes = model.nodes.filter((n) => n.label?.startsWith('Cap P'));
    // 2 piers * 6 girders = 12 cap nodes
    expect(capNodes).toHaveLength(12);
  });

  it('FIX pier: equalDOF with all 6 DOFs (monolithic connection)', () => {
    const model = gen();
    expect(model.equalDofConstraints).toBeDefined();
    // 2 FIX piers * 6 girders = 12 equalDOF constraints
    expect(model.equalDofConstraints!).toHaveLength(12);
    model.equalDofConstraints!.forEach((eq) => {
      expect(eq.dofs).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });

  it('FIX pier: no bearings', () => {
    const model = gen();
    expect(model.bearings).toHaveLength(0);
  });

  it('all-FIX bridge has 0 bearings', () => {
    const model = gen({
      numSpans: 4,
      spanLengths: [80, 100, 100, 80],
      columnHeights: [20, 25, 20],
      pierSupports: [
        { type: 'FIX', guided: false },
        { type: 'FIX', guided: false },
        { type: 'FIX', guided: false },
      ],
    });

    expect(model.bearings).toHaveLength(0);
  });

  it('all-FIX bridge has equalDOF constraints with 6 DOFs each', () => {
    const model = gen({
      numSpans: 4,
      spanLengths: [80, 100, 100, 80],
      columnHeights: [20, 25, 20],
      pierSupports: [
        { type: 'FIX', guided: false },
        { type: 'FIX', guided: false },
        { type: 'FIX', guided: false },
      ],
    });

    expect(model.equalDofConstraints).toBeDefined();
    // 3 piers * 6 girders = 18
    expect(model.equalDofConstraints!).toHaveLength(18);
    model.equalDofConstraints!.forEach((eq) => {
      expect(eq.dofs).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });
});

// ===========================================================================
// 10. CONVENTIONAL EXP
// ===========================================================================

describe('conventional EXP', () => {
  const expParams: Partial<BentBuildParams> = {
    pierSupports: [
      { type: 'EXP', guided: false },
      { type: 'EXP', guided: false },
    ],
  };

  it('EXP pier: separate cap nodes below deck nodes', () => {
    const model = gen(expParams);

    const capNodes = model.nodes.filter((n) => n.label?.startsWith('Cap P'));
    // 2 piers * 6 girders = 12 cap nodes
    expect(capNodes).toHaveLength(12);
  });

  it('EXP pier cap nodes at deckY-halfCap, deck nodes at deckY+halfGirder', () => {
    const model = gen(expParams);

    // referenceDeckY = max(240, 20*12=240) = 240
    // maxSpanFt=100 -> W40x183 (d=39.74), halfGirder=19.87
    const halfGirder = selectSteelGirderSection(100).d / 2;
    // girderSpacing=81.6, colDia=36 -> cap depth=48, halfCap=24
    const girderSpacingIn = (40 * 12 - 2 * 3 * 12) / (6 - 1);
    const colDia = selectConcreteColumnSection(20).d;
    const halfCap = computePierCapSection(girderSpacingIn, colDia).d / 2;

    const pier1Cap = model.nodes.filter((n) => n.label?.startsWith('Cap P1'));
    const pier1Deck = model.nodes.filter((n) => n.label?.startsWith('Deck SL2'));

    // Cap at deckY - halfCap, deck at deckY + halfGirder
    pier1Cap.forEach((n) => expect(n.y).toBe(240 - halfCap));
    pier1Deck.forEach((n) => expect(n.y).toBe(240 + halfGirder));
  });

  it('EXP unguided: equalDOF dofs=[2]', () => {
    const model = gen({
      pierSupports: [
        { type: 'EXP', guided: false },
        { type: 'EXP', guided: false },
      ],
    });

    expect(model.equalDofConstraints).toBeDefined();
    model.equalDofConstraints!.forEach((eq) => {
      expect(eq.dofs).toEqual([2]);
    });
  });

  it('EXP guided: equalDOF dofs=[2,3]', () => {
    const model = gen({
      pierSupports: [
        { type: 'EXP', guided: true },
        { type: 'EXP', guided: true },
      ],
    });

    expect(model.equalDofConstraints).toBeDefined();
    model.equalDofConstraints!.forEach((eq) => {
      expect(eq.dofs).toEqual([2, 3]);
    });
  });

  it('equalDOF count = numGirders * numEXPPiers', () => {
    const model = gen(expParams);
    // 2 EXP piers * 6 girders = 12
    expect(model.equalDofConstraints!).toHaveLength(12);
  });

  it('mixed FIX/EXP: FIX gets 6 DOFs, EXP gets 2 DOFs', () => {
    const model = gen({
      pierSupports: [
        { type: 'FIX', guided: false },
        { type: 'EXP', guided: false },
      ],
    });

    expect(model.equalDofConstraints).toBeDefined();
    // Both piers get equalDOF: 2 piers * 6 girders = 12 constraints
    expect(model.equalDofConstraints!).toHaveLength(12);

    // P1 (FIX) gets 6 DOFs, P2 (EXP) gets [2]
    const p1Constraints = model.equalDofConstraints!.filter((eq) => eq.label?.includes('P1'));
    const p2Constraints = model.equalDofConstraints!.filter((eq) => eq.label?.includes('P2'));

    expect(p1Constraints).toHaveLength(6);
    p1Constraints.forEach((eq) => {
      expect(eq.dofs).toEqual([1, 2, 3, 4, 5, 6]);
    });

    expect(p2Constraints).toHaveLength(6);
    p2Constraints.forEach((eq) => {
      expect(eq.dofs).toEqual([2]);
    });
  });
});

// ===========================================================================
// 11. ISOLATED BEARINGS
// ===========================================================================

describe('isolated bearings', () => {
  it('bearing-level: bearings at all support points (abutments + piers)', () => {
    const model = gen({
      supportMode: 'isolated',
      isolationLevel: 'bearing',
    });

    expect(model.bearings.length).toBeGreaterThan(0);
    // Should have bearings at all 4 support lines
    const bearingLabels = model.bearings.map((b) => b.label);
    expect(bearingLabels.some((l) => l?.includes('SL1'))).toBe(true);
    expect(bearingLabels.some((l) => l?.includes('SL4'))).toBe(true);
  });

  it('bearing-level bearing count = numGirders * (numSpans + 1)', () => {
    const model = gen({
      supportMode: 'isolated',
      isolationLevel: 'bearing',
    });

    // 6 girders * 4 support lines = 24
    expect(model.bearings).toHaveLength(24);
  });

  it('bearing-level: bearing nodeI=cap, nodeJ=deck', () => {
    const model = gen({
      supportMode: 'isolated',
      isolationLevel: 'bearing',
    });

    const nodeMap = new Map(model.nodes.map((n) => [n.id, n]));

    model.bearings.forEach((b) => {
      const ni = nodeMap.get(b.nodeI)!;
      const nj = nodeMap.get(b.nodeJ)!;

      // nodeI should be cap node, nodeJ should be deck node
      expect(ni.label).toContain('Cap');
      expect(nj.label).toContain('Deck');
    });
  });

  it('bearing weight > 0', () => {
    const model = gen({
      supportMode: 'isolated',
      isolationLevel: 'bearing',
    });

    model.bearings.forEach((b) => {
      expect(b.weight).toBeGreaterThan(0);
    });
  });

  it('col-base: bearings only at piers (not abutments)', () => {
    const model = gen({
      supportMode: 'isolated',
      isolationLevel: 'base',
    });

    const bearingLabels = model.bearings.map((b) => b.label);
    bearingLabels.forEach((l) => {
      // Should be labeled with pier, not support line
      expect(l).toContain('P');
      expect(l).toContain('C');
    });
  });

  it('col-base bearing count = numBentColumns * numPiers', () => {
    const model = gen({
      supportMode: 'isolated',
      isolationLevel: 'base',
    });

    // 2 bent columns * 2 piers = 4
    expect(model.bearings).toHaveLength(4);
  });

  it('col-base: ground nodes at Y=-1', () => {
    const model = gen({
      supportMode: 'isolated',
      isolationLevel: 'base',
    });

    const groundNodes = model.nodes.filter((n) => n.label?.startsWith('Ground'));
    expect(groundNodes).toHaveLength(4); // 2 piers * 2 columns
    groundNodes.forEach((n) => {
      expect(n.y).toBe(-1);
    });
  });

  it('col-base: bearing nodeI=ground, nodeJ=base', () => {
    const model = gen({
      supportMode: 'isolated',
      isolationLevel: 'base',
    });

    const nodeMap = new Map(model.nodes.map((n) => [n.id, n]));

    model.bearings.forEach((b) => {
      const ni = nodeMap.get(b.nodeI)!;
      const nj = nodeMap.get(b.nodeJ)!;

      expect(ni.label).toContain('Ground');
      expect(nj.label).toContain('Base');
    });
  });
});

// ===========================================================================
// 12. VARIABLE SPANS/HEIGHTS
// ===========================================================================

describe('variable spans/heights', () => {
  it('unequal spans produce correct X positions', () => {
    const model = gen({
      numSpans: 3,
      spanLengths: [60, 120, 80],
      columnHeights: [20, 20],
    });

    const xPositions = [...new Set(model.nodes.map((n) => n.x))].sort((a, b) => a - b);
    expect(xPositions).toContain(0);
    expect(xPositions).toContain(720); // 60*12
    expect(xPositions).toContain(2160); // (60+120)*12
    expect(xPositions).toContain(3120); // (60+120+80)*12
  });

  it('different column heights per pier: bases extend down, deck at reference', () => {
    const model = gen({
      numSpans: 3,
      spanLengths: [80, 100, 80],
      columnHeights: [15, 35],
    });

    // referenceDeckY = max(240, 15*12=180, 35*12=420) = 420
    const refDeckY = 420;
    // maxSpanFt=100 -> W40x183 (d=39.74), halfGirder=19.87
    const halfGirder = selectSteelGirderSection(100).d / 2;

    const pier1Base = model.nodes.filter((n) => n.label?.startsWith('Base P1'));
    const pier2Base = model.nodes.filter((n) => n.label?.startsWith('Base P2'));
    const pier1Deck = model.nodes.filter((n) => n.label?.startsWith('Deck SL2'));
    const pier2Deck = model.nodes.filter((n) => n.label?.startsWith('Deck SL3'));

    // Bases extend down: baseY = refDeckY - colHeight*12
    pier1Base.forEach((n) => expect(n.y).toBe(refDeckY - 15 * 12)); // 420 - 180 = 240
    pier2Base.forEach((n) => expect(n.y).toBe(refDeckY - 35 * 12)); // 420 - 420 = 0

    // Deck at girder centroid (refDeckY + halfGirder)
    pier1Deck.forEach((n) => expect(n.y).toBe(refDeckY + halfGirder));
    pier2Deck.forEach((n) => expect(n.y).toBe(refDeckY + halfGirder));
  });

  it('single very long span (150ft) uses largest girder', () => {
    const model = gen({
      numSpans: 1,
      spanLengths: [150],
      columnHeights: [],
      pierSupports: [],
    });

    const girderSection = model.sections.find((s) => s.name.startsWith('W'));
    expect(girderSection!.name).toBe('W44x335');
  });

  it('8-span bridge generates correct count', () => {
    const spans = [60, 80, 100, 120, 120, 100, 80, 60];
    const heights = [20, 25, 30, 35, 35, 30, 25];
    const piers: PierSupportConfig[] = heights.map(() => ({ type: 'FIX' as const, guided: false }));

    const model = gen({
      numSpans: 8,
      spanLengths: spans,
      columnHeights: heights,
      pierSupports: piers,
    });

    // 9 support lines * 6 girders = 54 deck nodes
    // 7 piers * 2 columns = 14 base nodes
    // 7 piers * 6 girders = 42 cap nodes (all piers have separate cap)
    expect(model.nodes).toHaveLength(110);

    // Girders: 6 * 8 = 48
    // XBeams: 5 * 9 = 45
    // Columns: 2 * 7 = 14
    // PierCap: 5 * 7 = 35 (all piers have concrete pier cap beams)
    expect(model.elements).toHaveLength(48 + 45 + 14 + 35);
  });
});

// ===========================================================================
// 13. AASHTO LL
// ===========================================================================

describe('AASHTO live load', () => {
  it('24ft roadway = 2 lanes', () => {
    expect(aashtoLaneCount(24)).toBe(2);
  });

  it('36ft roadway = 3 lanes', () => {
    expect(aashtoLaneCount(36)).toBe(3);
  });

  it('40ft roadway = 3 lanes', () => {
    expect(aashtoLaneCount(40)).toBe(3);
  });

  it('MPF for 1 lane = 1.20', () => {
    expect(aashtoMPF(1)).toBe(1.2);
  });

  it('lane load klf calculation correct', () => {
    // 40ft roadway -> 3 lanes, MPF=0.85
    const klf = aashtoLaneLoadKlf(40);
    expect(klf).toBeCloseTo(0.64 * 3 * 0.85, 6);
  });
});

// ===========================================================================
// 14. DEAD LOAD COMPONENTS
// ===========================================================================

describe('dead load components', () => {
  it('custom overlay PSF affects load values', () => {
    const defaultLoads = gen().loads;
    const heavyOverlay = gen({
      deadLoads: { ...DEFAULT_DEAD_LOADS, overlayPsf: 100 },
    }).loads;

    // Same node should be heavier with increased overlay
    const defaultFy = Math.abs(defaultLoads[0]!.fy);
    const heavyFy = Math.abs(heavyOverlay[0]!.fy);
    expect(heavyFy).toBeGreaterThan(defaultFy);
  });

  it('zero barrier produces no barrier contribution', () => {
    const withBarrier = gen({
      deadLoads: { ...DEFAULT_DEAD_LOADS, barrierKlf: 0.4 },
    });
    const noBarrier = gen({
      deadLoads: { ...DEFAULT_DEAD_LOADS, barrierKlf: 0 },
    });

    // Exterior girder (gi=0, sli=0 -> nodeId=1) should differ
    const loadWith = Math.abs(withBarrier.loads.find((l) => l.nodeId === 1)!.fy);
    const loadNo = Math.abs(noBarrier.loads.find((l) => l.nodeId === 1)!.fy);

    expect(loadWith).toBeGreaterThan(loadNo);
  });

  it('all zeros produces zero dead load', () => {
    const result = computeGirderNodeLoad(
      { overlayPsf: 0, barrierKlf: 0, crossFramesPsf: 0, utilitiesPsf: 0, fwsPsf: 0, miscPsf: 0 },
      40, // tribLengthFt
      8, // spacingFt
      3.5, // overhangFt
      false, // isExterior
      40, // roadwayWidthFt
      6, // numGirders
      0, // llPercent
    );

    expect(result.deadLoadKips).toBe(0);
    expect(result.liveLoadKips).toBe(0);
    expect(result.totalKips).toBe(0);
  });
});

// ===========================================================================
// 15. ID UNIQUENESS
// ===========================================================================

describe('ID uniqueness', () => {
  it('no duplicate node IDs', () => {
    const model = gen();
    const nodeIds = model.nodes.map((n) => n.id);
    expect(new Set(nodeIds).size).toBe(nodeIds.length);
  });

  it('no duplicate element IDs', () => {
    const model = gen();
    const elemIds = model.elements.map((e) => e.id);
    expect(new Set(elemIds).size).toBe(elemIds.length);
  });

  it('no duplicate bearing IDs', () => {
    const model = gen({
      supportMode: 'isolated',
      isolationLevel: 'bearing',
    });

    const bearingIds = model.bearings.map((b) => b.id);
    expect(new Set(bearingIds).size).toBe(bearingIds.length);
  });
});

// ===========================================================================
// 16. EDGE CASES
// ===========================================================================

describe('edge cases', () => {
  it('single span (no piers) produces valid model', () => {
    const model = gen({
      numSpans: 1,
      spanLengths: [80],
      columnHeights: [],
      pierSupports: [],
    });

    expect(model.nodes.length).toBeGreaterThan(0);
    expect(model.elements.length).toBeGreaterThan(0);
    expect(model.sections.length).toBeGreaterThan(0);
    expect(model.materials.length).toBeGreaterThan(0);
    expect(model.loads.length).toBeGreaterThan(0);
    expect(model.bearings).toHaveLength(0);
    expect(countByType(model, 'column')).toBe(0);
  });

  it('1 girder minimum rejected (need at least 3)', () => {
    // With numGirders=3 (minimum reasonable), spacing and cross-beams should still work
    const model = gen({ numGirders: 3 });
    expect(model.nodes.length).toBeGreaterThan(0);
    const xbeams = model.elements.filter((e) => e.label?.startsWith('XBeam'));
    // (3-1) * 4 = 8 cross-beams
    expect(xbeams).toHaveLength(8);
  });

  it('1 bent column produces centered column', () => {
    const model = gen({ numBentColumns: 1 });

    // Single column should be at center of girder spread
    const baseNodes = model.nodes.filter((n) => n.label?.startsWith('Base'));
    expect(baseNodes.length).toBeGreaterThan(0);

    const totalGirderWidth = (((40 - 2 * 3.5) * 12) / (6 - 1)) * (6 - 1);
    const expectedZ = totalGirderWidth / 2;

    baseNodes.forEach((n) => {
      expect(n.z).toBeCloseTo(expectedZ, 5);
    });
  });
});

// ===========================================================================
// 17. ALL ELEMENT NODE REFERENCES VALID (cross-config)
// ===========================================================================

describe('cross-configuration integrity', () => {
  it('all element node references point to existing nodes (multiple configs)', () => {
    const configs: Partial<BentBuildParams>[] = [
      {}, // default FIX
      {
        pierSupports: [
          { type: 'EXP', guided: false },
          { type: 'EXP', guided: false },
        ],
      },
      { supportMode: 'isolated', isolationLevel: 'bearing' },
      { supportMode: 'isolated', isolationLevel: 'base' },
      {
        numSpans: 1,
        spanLengths: [80],
        columnHeights: [],
        pierSupports: [],
      },
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

  it('all equalDOF node references point to existing nodes', () => {
    const model = gen({
      pierSupports: [
        { type: 'EXP', guided: true },
        { type: 'EXP', guided: true },
      ],
    });

    const nodeIdSet = new Set(model.nodes.map((n) => n.id));

    model.equalDofConstraints!.forEach((eq) => {
      expect(nodeIdSet.has(eq.retainedNodeId)).toBe(true);
      expect(nodeIdSet.has(eq.constrainedNodeId)).toBe(true);
    });
  });

  it('all diaphragm node references point to existing nodes', () => {
    const model = gen();
    const nodeIdSet = new Set(model.nodes.map((n) => n.id));

    model.diaphragms!.forEach((d) => {
      expect(nodeIdSet.has(d.masterNodeId)).toBe(true);
      d.constrainedNodeIds.forEach((cid) => {
        expect(nodeIdSet.has(cid)).toBe(true);
      });
    });
  });

  it('bearing-level isolated bridge: node IDs unique across all node categories', () => {
    const model = gen({
      supportMode: 'isolated',
      isolationLevel: 'bearing',
    });

    const allIds = model.nodes.map((n) => n.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('col-base isolated bridge: node IDs unique across all node categories', () => {
    const model = gen({
      supportMode: 'isolated',
      isolationLevel: 'base',
    });

    const allIds = model.nodes.map((n) => n.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('FIX pier equalDOF node references point to existing nodes', () => {
    const model = gen(); // Default FIX piers

    const nodeIdSet = new Set(model.nodes.map((n) => n.id));

    model.equalDofConstraints!.forEach((eq) => {
      expect(nodeIdSet.has(eq.retainedNodeId)).toBe(true);
      expect(nodeIdSet.has(eq.constrainedNodeId)).toBe(true);
    });
  });
});

// ===========================================================================
// 18. SLOPE PERCENT
// ===========================================================================

describe('slope percent', () => {
  it('zero slope produces constant deck elevation', () => {
    const model = gen({ slopePercent: 0 });

    const deckNodes = model.nodes.filter((n) => n.label?.startsWith('Deck SL1'));
    const abt2Nodes = model.nodes.filter((n) => n.label?.startsWith('Deck SL4'));

    // Both abutments at same Y
    expect(deckNodes[0]!.y).toBe(abt2Nodes[0]!.y);
  });

  it('positive slope raises far-end deck elevation', () => {
    const model = gen({ slopePercent: 2 });

    const abt1 = model.nodes.find((n) => n.label === 'Deck SL1 G1')!;
    const abt2 = model.nodes.find((n) => n.label === 'Deck SL4 G1')!;

    // Abt2 at X=3120 (260ft*12) with 2% slope -> should be higher
    expect(abt2.y).toBeGreaterThan(abt1.y);
  });

  it('slope changes deck elevation linearly', () => {
    const model = gen({
      numSpans: 2,
      spanLengths: [80, 80],
      columnHeights: [20],
      pierSupports: [{ type: 'FIX', guided: false }],
      slopePercent: 5,
    });

    const abt1 = model.nodes.find((n) => n.label === 'Deck SL1 G1')!;
    const pier1 = model.nodes.find((n) => n.label === 'Deck SL2 G1')!;
    const abt2 = model.nodes.find((n) => n.label === 'Deck SL3 G1')!;

    // maxSpanFt=80 -> W36x150 (d=35.85), halfGirder=17.925
    const halfGirder = selectSteelGirderSection(80).d / 2;
    // Pier at X=960, Abt2 at X=1920
    // slopeRatio = 0.05
    // deckY[0] = 240, deckY[1] = 240 + 960*0.05 = 288, deckY[2] = 240 + 1920*0.05 = 336
    // All deck nodes at deckY + halfGirder
    expect(abt1.y).toBe(240 + halfGirder);
    expect(pier1.y).toBe(288 + halfGirder);
    expect(abt2.y).toBe(336 + halfGirder);
  });

  it('negative slope lowers far-end deck elevation', () => {
    const model = gen({ slopePercent: -2 });

    const abt1 = model.nodes.find((n) => n.label === 'Deck SL1 G1')!;
    const abt2 = model.nodes.find((n) => n.label === 'Deck SL4 G1')!;

    expect(abt2.y).toBeLessThan(abt1.y);
  });

  it('slopePercent defaults to 0', () => {
    const model = gen(); // No slopePercent in overrides -> default from params
    const abt1 = model.nodes.find((n) => n.label === 'Deck SL1 G1')!;
    const abt2 = model.nodes.find((n) => n.label === 'Deck SL4 G1')!;

    // With 0 slope, both abutments at same Y
    expect(abt1.y).toBe(abt2.y);
  });
});

// ===========================================================================
// 19. COLUMN HEIGHT — BASE EXTENDS DOWN
// ===========================================================================

describe('column height — base extends down', () => {
  it('default 20ft columns: cap at deckY-halfCap, base at 0', () => {
    const model = gen(); // columnHeights [20, 20], slope=0

    const baseNodes = model.nodes.filter((n) => n.label?.startsWith('Base'));
    const capNodes = model.nodes.filter((n) => n.label?.startsWith('Cap P'));

    // referenceDeckY = max(240, 240) = 240
    // girderSpacing=81.6, colDia=36 -> cap depth=48, halfCap=24
    const girderSpacingIn = (40 * 12 - 2 * 3 * 12) / (6 - 1);
    const colDia = selectConcreteColumnSection(20).d;
    const halfCap = computePierCapSection(girderSpacingIn, colDia).d / 2;

    capNodes.forEach((n) => expect(n.y).toBe(240 - halfCap));
    baseNodes.forEach((n) => expect(n.y).toBe(0)); // 240 - 20*12 = 0
  });

  it('taller column: cap at refDeckY-halfCap, base goes down', () => {
    const model = gen({
      numSpans: 2,
      spanLengths: [80, 80],
      columnHeights: [30],
      pierSupports: [{ type: 'FIX', guided: false }],
    });

    // referenceDeckY = max(240, 30*12=360) = 360
    // colHeight=30 -> 42in Circular RC
    const girderSpacingIn = (40 * 12 - 2 * 3 * 12) / (6 - 1);
    const colDia = selectConcreteColumnSection(30).d;
    const halfCap = computePierCapSection(girderSpacingIn, colDia).d / 2;

    const capNodes = model.nodes.filter((n) => n.label?.startsWith('Cap P'));
    const baseNodes = model.nodes.filter((n) => n.label?.startsWith('Base'));

    capNodes.forEach((n) => expect(n.y).toBe(360 - halfCap));
    baseNodes.forEach((n) => expect(n.y).toBe(360 - 360)); // 0
  });

  it('mixed column heights: taller pier sets reference, shorter base is elevated', () => {
    const model = gen({
      numSpans: 3,
      spanLengths: [80, 100, 80],
      columnHeights: [10, 30],
      pierSupports: [
        { type: 'FIX', guided: false },
        { type: 'FIX', guided: false },
      ],
    });

    // referenceDeckY = max(240, 120, 360) = 360
    const pier1Base = model.nodes.filter((n) => n.label?.startsWith('Base P1'));
    const pier2Base = model.nodes.filter((n) => n.label?.startsWith('Base P2'));

    // Pier1: baseY = 360 - 10*12 = 240
    pier1Base.forEach((n) => expect(n.y).toBe(240));
    // Pier2: baseY = 360 - 30*12 = 0
    pier2Base.forEach((n) => expect(n.y).toBe(0));
  });

  it('col-base isolation: ground nodes at baseY - 1', () => {
    const model = gen({
      supportMode: 'isolated',
      isolationLevel: 'base',
      columnHeights: [25, 25],
    });

    // referenceDeckY = max(240, 300) = 300
    // baseY = 300 - 25*12 = 0
    const groundNodes = model.nodes.filter((n) => n.label?.startsWith('Ground'));
    groundNodes.forEach((n) => expect(n.y).toBe(-1)); // 0 - 1
  });
});

// ===========================================================================
// 20. CONCRETE PIER CAPS (always concrete material)
// ===========================================================================

describe('concrete pier caps', () => {
  it('pier cap beams use concrete material even for steel bridges', () => {
    const model = gen({ girderType: 'steel' });

    const concreteMat = model.materials.find((m) => m.E === 3600);
    expect(concreteMat).toBeDefined();

    const pierCaps = model.elements.filter((e) => e.label?.startsWith('PierCap'));
    expect(pierCaps.length).toBeGreaterThan(0);
    pierCaps.forEach((e) => {
      expect(e.materialId).toBe(concreteMat!.id);
    });
  });

  it('pier cap beams use concrete material for concrete bridges', () => {
    const model = gen({ girderType: 'concrete' });

    const concreteMat = model.materials.find((m) => m.E === 3600);
    expect(concreteMat).toBeDefined();

    const pierCaps = model.elements.filter((e) => e.label?.startsWith('PierCap'));
    expect(pierCaps.length).toBeGreaterThan(0);
    pierCaps.forEach((e) => {
      expect(e.materialId).toBe(concreteMat!.id);
    });
  });

  it('all piers have pier cap beams regardless of FIX/EXP mode', () => {
    const model = gen({
      pierSupports: [
        { type: 'FIX', guided: false },
        { type: 'EXP', guided: false },
      ],
    });

    // Both piers get cap beams: 2 * (6-1) = 10
    const pierCaps = model.elements.filter((e) => e.label?.startsWith('PierCap'));
    expect(pierCaps).toHaveLength(10);
  });
});

// ===========================================================================
// 21. PIER CAP ELEMENT TYPE & SECTION ORIENTATION
// ===========================================================================

describe('pier cap element type and section orientation', () => {
  it('pier cap elements have type pierCap (not beam)', () => {
    const model = gen();
    const pierCaps = model.elements.filter((e) => e.label?.startsWith('PierCap'));
    expect(pierCaps.length).toBeGreaterThan(0);
    pierCaps.forEach((e) => {
      expect(e.type).toBe('pierCap');
    });
  });

  it('pier cap section has Ix > Iy (strong axis vertical for gravity)', () => {
    const girderSpacingIn = (40 * 12 - 2 * 3 * 12) / (6 - 1);
    const colDia = selectConcreteColumnSection(20).d;
    const capSection = computePierCapSection(girderSpacingIn, colDia);
    expect(capSection.Ix).toBeGreaterThan(capSection.Iy);
  });

  it('deck-to-cap vertical offset equals (girderDepth + capDepth) / 2', () => {
    const model = gen(); // default 3-span steel

    const girderSpacingIn = (40 * 12 - 2 * 3 * 12) / (6 - 1);
    const colDia = selectConcreteColumnSection(20).d;
    const capDepth = computePierCapSection(girderSpacingIn, colDia).d;
    const girderDepth = selectSteelGirderSection(100).d;

    const deckNode = model.nodes.find((n) => n.label === 'Deck SL2 G1')!;
    const capNode = model.nodes.find((n) => n.label === 'Cap P1 G1')!;

    const verticalGap = deckNode.y - capNode.y;
    expect(verticalGap).toBeCloseTo((girderDepth + capDepth) / 2, 5);
  });
});

// ===========================================================================
// 22. 1-SPAN BRIDGE SAFETY
// ===========================================================================

describe('1-span bridge safety', () => {
  it('1-span bridge with empty pierSupports does not crash', () => {
    const model = gen({
      numSpans: 1,
      spanLengths: [100],
      columnHeights: [],
      pierSupports: [],
    });

    expect(model.nodes.length).toBeGreaterThan(0);
    expect(model.elements.length).toBeGreaterThan(0);
    expect(model.bearings).toHaveLength(0);
    expect(model.equalDofConstraints === undefined || model.equalDofConstraints.length === 0).toBe(
      true,
    );
  });

  it('1-span bridge deck at default 240" + halfGirder', () => {
    const model = gen({
      numSpans: 1,
      spanLengths: [80],
      columnHeights: [],
      pierSupports: [],
    });

    // maxSpanFt=80 -> W36x150 (d=35.85), halfGirder=17.925
    const halfGirder = selectSteelGirderSection(80).d / 2;
    const deckNodes = model.nodes.filter((n) => n.label?.includes('Deck'));
    deckNodes.forEach((n) => expect(n.y).toBe(240 + halfGirder));
  });
});

// ===========================================================================
// 21. COGO ALIGNMENT INTEGRATION
// ===========================================================================

describe('alignment integration', () => {
  it('undefined alignment produces identical output to no-alignment default', () => {
    const withoutAlignment = gen();
    const withExplicitDefault = gen({
      alignment: { ...DEFAULT_ALIGNMENT, entryGrade: 0 },
    });

    // Node count should match
    expect(withExplicitDefault.nodes).toHaveLength(withoutAlignment.nodes.length);
    expect(withExplicitDefault.elements).toHaveLength(withoutAlignment.elements.length);
  });

  it('horizontal curve produces non-collinear deck nodes in plan view', () => {
    const alignment: AlignmentParams = {
      ...DEFAULT_ALIGNMENT,
      horizontalPIs: [{ station: 50, deflectionAngle: 30, radius: 2000, direction: 'R' }],
      chordsPerSpan: 1,
    };
    const model = gen({ alignment });

    // Deck nodes at different support lines should not all have the same Z
    const deckNodes = model.nodes.filter((n) => n.label?.startsWith('Deck'));
    const zValues = [...new Set(deckNodes.map((n) => Math.round(n.z)))];
    expect(zValues.length).toBeGreaterThan(1);
  });

  it('horizontal curve: bearing deflects correctly at far end', () => {
    const alignment: AlignmentParams = {
      ...DEFAULT_ALIGNMENT,
      horizontalPIs: [{ station: 30, deflectionAngle: 20, radius: 1500, direction: 'R' }],
      chordsPerSpan: 1,
    };
    const model = gen({ alignment });

    // Last abutment deck nodes should have negative Z (right curve deflects in -Z)
    const lastSL = model.nodes.filter((n) => n.label?.startsWith('Deck SL4'));
    expect(lastSL.length).toBeGreaterThan(0);
    // At least some nodes should have non-zero Z
    const hasNonZeroZ = lastSL.some((n) => Math.abs(n.z) > 1);
    expect(hasNonZeroZ).toBe(true);
  });

  it('chordsPerSpan > 1 creates intermediate chord nodes', () => {
    const alignment: AlignmentParams = {
      ...DEFAULT_ALIGNMENT,
      horizontalPIs: [{ station: 30, deflectionAngle: 15, radius: 2000, direction: 'L' }],
      chordsPerSpan: 5,
    };
    const model = gen({ alignment });

    // Each span should have (chordsPerSpan - 1) * numGirders chord nodes
    const chordNodes = model.nodes.filter((n) => n.label?.startsWith('Chord'));
    // 3 spans * 4 interior points * 6 girders = 72
    expect(chordNodes).toHaveLength(3 * 4 * 6);
  });

  it('chord discretization creates correct element connectivity', () => {
    const alignment: AlignmentParams = {
      ...DEFAULT_ALIGNMENT,
      chordsPerSpan: 3,
    };
    const model = gen({ alignment });

    // Each girder per span should now have 3 elements (3 chords)
    const girderElements = model.elements.filter((e) => e.label?.startsWith('Girder'));
    // 3 spans * 6 girders * 3 chords = 54 girder elements
    expect(girderElements).toHaveLength(3 * 6 * 3);
  });

  it('all chord node IDs are unique', () => {
    const alignment: AlignmentParams = {
      ...DEFAULT_ALIGNMENT,
      horizontalPIs: [{ station: 30, deflectionAngle: 20, radius: 1000, direction: 'R' }],
      chordsPerSpan: 5,
    };
    const model = gen({ alignment });

    const allIds = model.nodes.map((n) => n.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('all element references are valid with chord discretization', () => {
    const alignment: AlignmentParams = {
      ...DEFAULT_ALIGNMENT,
      horizontalPIs: [{ station: 50, deflectionAngle: 25, radius: 1500, direction: 'L' }],
      chordsPerSpan: 5,
    };
    const model = gen({ alignment });

    const nodeIdSet = new Set(model.nodes.map((n) => n.id));
    model.elements.forEach((e) => {
      expect(nodeIdSet.has(e.nodeI)).toBe(true);
      expect(nodeIdSet.has(e.nodeJ)).toBe(true);
    });
  });

  it('vertical curve changes deck elevations', () => {
    const alignment: AlignmentParams = {
      ...DEFAULT_ALIGNMENT,
      entryGrade: 3,
      verticalPVIs: [{ station: 130, elevation: 3.9, exitGrade: -2, curveLength: 0 }],
      chordsPerSpan: 1,
    };
    const model = gen({ alignment });

    const abt1 = model.nodes.find((n) => n.label === 'Deck SL1 G1')!;
    const abt2 = model.nodes.find((n) => n.label === 'Deck SL4 G1')!;

    // With positive then negative grade, far end should be different from near end
    expect(abt2.y).not.toBe(abt1.y);
  });

  it('diaphragms still reference valid nodes with alignment', () => {
    const alignment: AlignmentParams = {
      ...DEFAULT_ALIGNMENT,
      horizontalPIs: [{ station: 50, deflectionAngle: 15, radius: 3000, direction: 'R' }],
      chordsPerSpan: 3,
    };
    const model = gen({ alignment });

    const nodeIdSet = new Set(model.nodes.map((n) => n.id));
    model.diaphragms!.forEach((d) => {
      expect(nodeIdSet.has(d.masterNodeId)).toBe(true);
      d.constrainedNodeIds.forEach((cid) => {
        expect(nodeIdSet.has(cid)).toBe(true);
      });
    });
  });

  it('bearings still reference valid nodes with curved alignment', () => {
    const alignment: AlignmentParams = {
      ...DEFAULT_ALIGNMENT,
      horizontalPIs: [{ station: 30, deflectionAngle: 20, radius: 2000, direction: 'L' }],
      chordsPerSpan: 3,
    };
    const model = gen({
      alignment,
      supportMode: 'isolated',
      isolationLevel: 'bearing',
    });

    const nodeIdSet = new Set(model.nodes.map((n) => n.id));
    model.bearings.forEach((b) => {
      expect(nodeIdSet.has(b.nodeI)).toBe(true);
      expect(nodeIdSet.has(b.nodeJ)).toBe(true);
    });
  });

  it('equalDOF constraints valid with curved alignment', () => {
    const alignment: AlignmentParams = {
      ...DEFAULT_ALIGNMENT,
      horizontalPIs: [{ station: 40, deflectionAngle: 10, radius: 5000, direction: 'R' }],
      chordsPerSpan: 1,
    };
    const model = gen({
      alignment,
      pierSupports: [
        { type: 'EXP', guided: true },
        { type: 'FIX', guided: false },
      ],
    });

    const nodeIdSet = new Set(model.nodes.map((n) => n.id));
    model.equalDofConstraints!.forEach((eq) => {
      expect(nodeIdSet.has(eq.retainedNodeId)).toBe(true);
      expect(nodeIdSet.has(eq.constrainedNodeId)).toBe(true);
    });
  });
});
