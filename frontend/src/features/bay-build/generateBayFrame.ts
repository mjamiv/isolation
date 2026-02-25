// ── Parametric bay-frame generator ────────────────────────────────────
// Pure function: BayBuildParams -> ModelJSON (no side effects).

import type {
  Node,
  Element,
  Section,
  Material,
  TFPBearing,
  PointLoad,
  FrictionSurface,
  RigidDiaphragm,
} from '@/types/storeModel';
import type { ModelJSON } from '@/types/modelJSON';
import type { BayBuildParams } from './bayBuildTypes';
import {
  selectSteelColumnSection,
  selectSteelBeamSection,
  computeConcreteColumnSection,
  computeConcreteBeamSection,
} from './sectionTables';
import type { SteelSectionData } from './sectionTables';

// ── Constants ────────────────────────────────────────────────────────

const FLOOR_LOAD_PSF = 120;

/** Restraint tuples */
const FIXED: [boolean, boolean, boolean, boolean, boolean, boolean] = [
  true,
  true,
  true,
  true,
  true,
  true,
];
const FREE: [boolean, boolean, boolean, boolean, boolean, boolean] = [
  false,
  false,
  false,
  false,
  false,
  false,
];

// ── Helpers ──────────────────────────────────────────────────────────

/** Column letter label: 0->A, 1->B, ... */
function colLabel(ix: number): string {
  return String.fromCharCode(65 + ix);
}

/** Deterministic node ID from grid position + level. */
function makeNodeId(
  ix: number,
  iz: number,
  level: number,
  colsX: number,
  nodesPerFloor: number,
): number {
  return level * nodesPerFloor + iz * colsX + ix + 1;
}

/**
 * Compute the tributary area (in sq ft) for a node at grid position
 * (ix, iz) given the bay widths in feet.
 */
function tributaryAreaSqFt(
  ix: number,
  iz: number,
  baysX: number,
  baysZ: number,
  bayWidthXft: number,
  bayWidthZft: number,
): number {
  const isEdgeX = ix === 0 || ix === baysX;
  const isEdgeZ = iz === 0 || iz === baysZ;
  const tribX = isEdgeX ? bayWidthXft / 2 : bayWidthXft;
  const tribZ = isEdgeZ ? bayWidthZft / 2 : bayWidthZft;
  return tribX * tribZ;
}

/**
 * Build a SteelSectionData -> Section, assigning an id.
 */
function toSection(id: number, data: SteelSectionData): Section {
  return {
    id,
    name: data.name,
    area: data.area,
    Ix: data.Ix,
    Iy: data.Iy,
    Zx: data.Zx,
    d: data.d,
    bf: data.bf,
    tw: data.tw,
    tf: data.tf,
  };
}

/**
 * Determine which column-tier index (0-based) applies for a given story.
 * story is 0-indexed from the bottom. totalStories is the total number
 * of stories. Returns `storiesBelow = totalStories - story` clamped to [1,10].
 */
function storiesBelowForStory(story: number, totalStories: number): number {
  return Math.max(1, Math.min(10, totalStories - story));
}

/**
 * Map storiesBelow to a tier index (0-4) corresponding to the 5 tiers
 * in the section tables: 1-2, 3-4, 5-6, 7-8, 9-10.
 */
function tierIndex(storiesBelow: number): number {
  return Math.min(4, Math.floor((Math.max(1, storiesBelow) - 1) / 2));
}

// ── Main Generator ───────────────────────────────────────────────────

export function generateBayFrame(params: BayBuildParams): ModelJSON {
  const {
    baysX,
    baysZ,
    bayWidthX: bayWidthXft,
    bayWidthZ: bayWidthZft,
    stories,
    storyHeight: storyHeightFt,
    material,
    diaphragms: wantDiaphragms,
    baseType,
  } = params;

  // ── 1. Unit conversion (ft -> in) ───────────────────────────────
  const bayWidthXin = bayWidthXft * 12;
  const bayWidthZin = bayWidthZft * 12;
  const storyHeightIn = storyHeightFt * 12;

  // ── 2. Grid dimensions ──────────────────────────────────────────
  const colsX = baysX + 1;
  const colsZ = baysZ + 1;
  const nodesPerFloor = colsX * colsZ;

  /** Shorthand for the node ID function. */
  function nid(ix: number, iz: number, level: number): number {
    return makeNodeId(ix, iz, level, colsX, nodesPerFloor);
  }

  // ── 3. Generate Nodes ───────────────────────────────────────────
  const nodes: Node[] = [];

  for (let k = 0; k <= stories; k++) {
    for (let iz = 0; iz <= baysZ; iz++) {
      for (let ix = 0; ix <= baysX; ix++) {
        const isBase = k === 0;
        const restraint: [boolean, boolean, boolean, boolean, boolean, boolean] =
          isBase && baseType === 'fixed' ? [...FIXED] : [...FREE];

        nodes.push({
          id: nid(ix, iz, k),
          x: ix * bayWidthXin,
          y: k * storyHeightIn,
          z: iz * bayWidthZin,
          restraint,
          mass: 0,
          label: `L${k} ${colLabel(ix)}${iz + 1}`,
        });
      }
    }
  }

  // ── 4. Ground Nodes (isolated only) ─────────────────────────────
  if (baseType === 'isolated') {
    for (let iz = 0; iz <= baysZ; iz++) {
      for (let ix = 0; ix <= baysX; ix++) {
        const baseNodeId = nid(ix, iz, 0);
        nodes.push({
          id: 200 + baseNodeId,
          x: ix * bayWidthXin,
          y: -1,
          z: iz * bayWidthZin,
          restraint: [...FIXED],
          mass: 0,
          label: `Ground ${colLabel(ix)}${iz + 1}`,
        });
      }
    }
  }

  // ── 5. Generate Sections ────────────────────────────────────────
  const sections: Section[] = [];
  let nextSectionId = 1;

  // Column sections: one per unique tier
  const colSectionByTier = new Map<number, number>(); // tierIdx -> sectionId
  const usedColumnTiers = new Set<number>();

  for (let story = 0; story < stories; story++) {
    const sb = storiesBelowForStory(story, stories);
    usedColumnTiers.add(tierIndex(sb));
  }

  // Sort tiers so section IDs are in ascending order of tier
  const sortedColumnTiers = [...usedColumnTiers].sort((a, b) => a - b);
  for (const ti of sortedColumnTiers) {
    // Representative storiesBelow for each tier: tier 0 -> 1, tier 1 -> 3, etc.
    const representativeSB = ti * 2 + 1;
    const data =
      material === 'steel'
        ? selectSteelColumnSection(representativeSB)
        : computeConcreteColumnSection(representativeSB);
    const sectionId = nextSectionId++;
    sections.push(toSection(sectionId, data));
    colSectionByTier.set(ti, sectionId);
  }

  // Beam sections: one for X-span, one for Z-span (may be the same)
  const beamXData =
    material === 'steel'
      ? selectSteelBeamSection(bayWidthXft)
      : computeConcreteBeamSection(bayWidthXft);
  const beamZData =
    material === 'steel'
      ? selectSteelBeamSection(bayWidthZft)
      : computeConcreteBeamSection(bayWidthZft);

  const beamXSectionId = nextSectionId++;
  sections.push(toSection(beamXSectionId, beamXData));

  // Only create a separate Z-beam section if it differs from the X-beam
  let beamZSectionId: number;
  if (beamXData.name === beamZData.name) {
    beamZSectionId = beamXSectionId;
  } else {
    beamZSectionId = nextSectionId++;
    sections.push(toSection(beamZSectionId, beamZData));
  }

  // ── 6. Generate Material ────────────────────────────────────────
  const materials: Material[] = [];
  if (material === 'steel') {
    materials.push({
      id: 1,
      name: 'A992 Gr50 Steel',
      E: 29000,
      Fy: 50,
      density: 0.000284,
      nu: 0.3,
    });
  } else {
    materials.push({
      id: 1,
      name: "Concrete f'c=4ksi",
      E: 3600,
      Fy: 4,
      density: 0.0000868,
      nu: 0.2,
    });
  }

  // ── 7. Generate Elements ────────────────────────────────────────
  const elements: Element[] = [];
  let nextElementId = 1;

  // 7a. Columns
  for (let story = 0; story < stories; story++) {
    const sb = storiesBelowForStory(story, stories);
    const ti = tierIndex(sb);
    const sectionId = colSectionByTier.get(ti)!;

    for (let iz = 0; iz <= baysZ; iz++) {
      for (let ix = 0; ix <= baysX; ix++) {
        elements.push({
          id: nextElementId++,
          type: 'column',
          nodeI: nid(ix, iz, story),
          nodeJ: nid(ix, iz, story + 1),
          sectionId,
          materialId: 1,
          label: `Col ${colLabel(ix)}${iz + 1} Story ${story + 1}`,
        });
      }
    }
  }

  // 7b. X-direction Beams (elevated floors only)
  for (let k = 1; k <= stories; k++) {
    for (let iz = 0; iz <= baysZ; iz++) {
      for (let ix = 0; ix < baysX; ix++) {
        elements.push({
          id: nextElementId++,
          type: 'beam',
          nodeI: nid(ix, iz, k),
          nodeJ: nid(ix + 1, iz, k),
          sectionId: beamXSectionId,
          materialId: 1,
          label: `Beam L${k} Row ${iz + 1} X-Bay ${ix + 1}`,
        });
      }
    }
  }

  // 7c. Z-direction Beams (elevated floors only)
  for (let k = 1; k <= stories; k++) {
    for (let ix = 0; ix <= baysX; ix++) {
      for (let iz = 0; iz < baysZ; iz++) {
        elements.push({
          id: nextElementId++,
          type: 'beam',
          nodeI: nid(ix, iz, k),
          nodeJ: nid(ix, iz + 1, k),
          sectionId: beamZSectionId,
          materialId: 1,
          label: `Beam L${k} Col ${colLabel(ix)} Z-Bay ${iz + 1}`,
        });
      }
    }
  }

  // ── 8. Generate Gravity Loads ───────────────────────────────────
  const loads: PointLoad[] = [];
  let nextLoadId = 1;

  for (let k = 1; k <= stories; k++) {
    for (let iz = 0; iz <= baysZ; iz++) {
      for (let ix = 0; ix <= baysX; ix++) {
        const tribArea = tributaryAreaSqFt(ix, iz, baysX, baysZ, bayWidthXft, bayWidthZft);
        const loadKips = (FLOOR_LOAD_PSF * tribArea) / 1000;
        loads.push({
          id: nextLoadId++,
          nodeId: nid(ix, iz, k),
          fx: 0,
          fy: -loadKips,
          fz: 0,
          mx: 0,
          my: 0,
          mz: 0,
        });
      }
    }
  }

  // ── 9. Generate TFP Bearings (if isolated) ──────────────────────
  const bearings: TFPBearing[] = [];

  if (baseType === 'isolated') {
    let bearingId = 1;

    for (let iz = 0; iz <= baysZ; iz++) {
      for (let ix = 0; ix <= baysX; ix++) {
        const baseNodeId = nid(ix, iz, 0);

        // Sum gravity loads at all floors for this column position
        let tributaryWeight = 0;
        for (let k = 1; k <= stories; k++) {
          const tribArea = tributaryAreaSqFt(ix, iz, baysX, baysZ, bayWidthXft, bayWidthZft);
          tributaryWeight += (FLOOR_LOAD_PSF * tribArea) / 1000;
        }

        const surface: FrictionSurface = {
          type: 'VelDependent',
          muSlow: 0.06,
          muFast: 0.12,
          transRate: 25,
        };
        const innerSurface: FrictionSurface = {
          type: 'VelDependent',
          muSlow: 0.015,
          muFast: 0.03,
          transRate: 25,
        };

        bearings.push({
          id: bearingId++,
          nodeI: 200 + baseNodeId,
          nodeJ: baseNodeId,
          surfaces: [innerSurface, surface, surface, innerSurface] as [
            FrictionSurface,
            FrictionSurface,
            FrictionSurface,
            FrictionSurface,
          ],
          radii: [20, 140, 20] as [number, number, number],
          dispCapacities: [3, 18, 3] as [number, number, number],
          weight: tributaryWeight,
          yieldDisp: 0.08,
          vertStiffness: 9000,
          minVertForce: 0.1,
          tolerance: 1e-8,
          label: `TFP ${colLabel(ix)}${iz + 1}`,
        });
      }
    }
  }

  // ── 10. Generate Rigid Diaphragms (if enabled) ──────────────────
  const diaphragms: RigidDiaphragm[] = [];

  if (wantDiaphragms) {
    for (let k = 1; k <= stories; k++) {
      const masterNodeId = nid(0, 0, k);
      const constrainedNodeIds: number[] = [];

      for (let iz = 0; iz <= baysZ; iz++) {
        for (let ix = 0; ix <= baysX; ix++) {
          const id = nid(ix, iz, k);
          if (id !== masterNodeId) {
            constrainedNodeIds.push(id);
          }
        }
      }

      diaphragms.push({
        id: k,
        masterNodeId,
        constrainedNodeIds,
        perpDirection: 2 as const,
        label: k === stories ? 'Roof' : `Floor ${k}`,
      });
    }
  }

  // ── 11. Assemble ModelJSON ──────────────────────────────────────
  const matLabel = material === 'steel' ? 'Steel' : 'Concrete';
  const baseLabel = baseType === 'fixed' ? 'Fixed' : 'Isolated';

  const modelJSON: ModelJSON = {
    modelInfo: {
      name: `Bay Build: ${baysX}x${baysZ}x${stories} ${matLabel} (${baseLabel})`,
      units: 'kip-in',
      description: `${baysX}x${baysZ} bay, ${stories}-story ${matLabel.toLowerCase()} moment frame (${baseLabel.toLowerCase()} base)`,
    },
    nodes,
    elements,
    sections,
    materials,
    bearings,
    loads,
    groundMotions: [],
    diaphragms: wantDiaphragms ? diaphragms : undefined,
  };

  return modelJSON;
}
