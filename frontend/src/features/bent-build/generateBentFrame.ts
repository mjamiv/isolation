// ── Parametric bent-frame bridge generator ─────────────────────────────
// Pure function: BentBuildParams -> ModelJSON (no side effects).

import type {
  Node,
  Element,
  Section,
  Material,
  TFPBearing,
  PointLoad,
  FrictionSurface,
  RigidDiaphragm,
  EqualDOFConstraint,
} from '@/types/storeModel';
import type { ModelJSON } from '@/types/modelJSON';
import type { BentBuildParams } from './bentBuildTypes';
import {
  selectSteelGirderSection,
  selectConcreteGirderSection,
  selectConcreteColumnSection,
  computePierCapSection,
} from './bentSectionTables';
import { computeGirderNodeLoad } from './bentLoadCalc';
import type { SteelSectionData } from '../bay-build/sectionTables';

// ── Node ID Functions ─────────────────────────────────────────────────

function deckNodeId(sli: number, gi: number, numGirders: number): number {
  return sli * numGirders + gi + 1;
}

function baseNodeId(pi: number, ci: number, maxCols: number): number {
  return 500 + pi * maxCols + ci + 1;
}

function capNodeId(pi: number, gi: number, numGirders: number): number {
  return 1000 + pi * numGirders + gi + 1;
}

function groundNodeId(pi: number, ci: number, maxCols: number): number {
  return 2000 + pi * maxCols + ci + 1;
}

// ── Restraint Constants ───────────────────────────────────────────────

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
const ROLLER: [boolean, boolean, boolean, boolean, boolean, boolean] = [
  false,
  true,
  true,
  false,
  false,
  false,
]; // Ty+Tz fixed, rest free

// ── Helpers ───────────────────────────────────────────────────────────

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

/** Find the cap node closest in Z to a given column Z position. */
function closestCapNodeGi(colZ: number, girderZPositions: number[]): number {
  let bestGi = 0;
  let bestDist = Infinity;
  for (let gi = 0; gi < girderZPositions.length; gi++) {
    const dist = Math.abs(girderZPositions[gi]! - colZ);
    if (dist < bestDist) {
      bestDist = dist;
      bestGi = gi;
    }
  }
  return bestGi;
}

/** Compute column Z positions for a given number of bent columns. */
function computeColumnZPositions(numBentColumns: number, totalGirderWidth: number): number[] {
  const positions: number[] = [];
  if (numBentColumns === 1) {
    positions.push(totalGirderWidth / 2);
  } else {
    for (let ci = 0; ci < numBentColumns; ci++) {
      positions.push((ci * totalGirderWidth) / (numBentColumns - 1));
    }
  }
  return positions;
}

// ── Main Generator ────────────────────────────────────────────────────

export function generateBentFrame(params: BentBuildParams): ModelJSON {
  const {
    numSpans,
    spanLengths,
    numGirders,
    girderType,
    roadwayWidth,
    overhang,
    numBentColumns,
    columnHeights,
    supportMode,
    pierSupports,
    isolationLevel,
    deadLoads,
    aashtoLLPercent,
  } = params;

  const numPiers = numSpans - 1;
  const numSupportLines = numSpans + 1; // abutments + piers

  // ── 1. Unit conversions (ft -> in) ──────────────────────────────────

  const spanLengthsIn = spanLengths.map((s) => s * 12);
  const girderSpacingIn = (roadwayWidth * 12 - 2 * overhang * 12) / (numGirders - 1);
  const girderSpacingFt = girderSpacingIn / 12;
  const totalGirderWidth = girderSpacingIn * (numGirders - 1);

  // Support X positions (cumulative span lengths)
  const supportX: number[] = [0];
  for (let i = 0; i < numSpans; i++) {
    supportX.push(supportX[i]! + spanLengthsIn[i]!);
  }

  // Girder Z positions
  const girderZ: number[] = [];
  for (let gi = 0; gi < numGirders; gi++) {
    girderZ.push(gi * girderSpacingIn);
  }

  // Deck elevation at each support line
  const deckY: number[] = [];
  for (let sli = 0; sli < numSupportLines; sli++) {
    if (numPiers === 0) {
      // Single span: default 20 ft
      deckY.push(240);
    } else if (sli === 0) {
      // Abt1: match first pier height
      deckY.push(columnHeights[0]! * 12);
    } else if (sli === numSupportLines - 1) {
      // Abt2: match last pier height
      deckY.push(columnHeights[numPiers - 1]! * 12);
    } else {
      // Pier
      deckY.push(columnHeights[sli - 1]! * 12);
    }
  }

  // Column Z positions within each bent
  const columnZPositions = computeColumnZPositions(numBentColumns, totalGirderWidth);

  // Determine the max column height for section sizing
  const maxColHeightFt = numPiers > 0 ? Math.max(...columnHeights) : 20;

  // ── 2. Generate Sections ────────────────────────────────────────────

  const sections: Section[] = [];
  let nextSectionId = 1;

  // Girder section (use longest span)
  const maxSpanFt = Math.max(...spanLengths);
  const girderSectionData =
    girderType === 'steel'
      ? selectSteelGirderSection(maxSpanFt)
      : selectConcreteGirderSection(maxSpanFt);
  const girderSectionId = nextSectionId++;
  sections.push(toSection(girderSectionId, girderSectionData));

  // Column section (always concrete circular)
  const colSectionData = selectConcreteColumnSection(maxColHeightFt);
  const colSectionId = nextSectionId++;
  sections.push(toSection(colSectionId, colSectionData));

  // Pier cap section (always RC)
  const pierCapData = computePierCapSection(girderSpacingIn, colSectionData.d);
  const pierCapSectionId = nextSectionId++;
  sections.push(toSection(pierCapSectionId, pierCapData));

  // Cross-beam section
  let crossBeamSectionId: number;
  if (girderType === 'steel') {
    // W24x84 for steel bridges
    const w24x84: SteelSectionData = {
      name: 'W24x84',
      area: 24.7,
      Ix: 2370,
      Iy: 94.4,
      Zx: 224,
      d: 24.1,
      bf: 9.02,
      tw: 0.47,
      tf: 0.77,
    };
    crossBeamSectionId = nextSectionId++;
    sections.push(toSection(crossBeamSectionId, w24x84));
  } else {
    // Concrete: reuse pier cap section
    crossBeamSectionId = pierCapSectionId;
  }

  // ── 3. Generate Materials ───────────────────────────────────────────

  const materials: Material[] = [];
  let steelMatId: number | undefined;
  let concreteMatId: number;

  if (girderType === 'steel') {
    steelMatId = 1;
    materials.push({
      id: 1,
      name: 'A992 Gr50 Steel',
      E: 29000,
      Fy: 50,
      density: 0.000284,
      nu: 0.3,
    });
    concreteMatId = 2;
    materials.push({
      id: 2,
      name: "Concrete f'c=4ksi",
      E: 3600,
      Fy: 4,
      density: 0.0000868,
      nu: 0.2,
    });
  } else {
    concreteMatId = 1;
    materials.push({
      id: 1,
      name: "Concrete f'c=4ksi",
      E: 3600,
      Fy: 4,
      density: 0.0000868,
      nu: 0.2,
    });
  }

  const girderMatId = girderType === 'steel' ? steelMatId! : concreteMatId;
  const crossBeamMatId = girderType === 'steel' ? steelMatId! : concreteMatId;

  // ── 4. Determine which support lines need cap nodes ─────────────────
  // Cap nodes are separate from deck nodes for:
  // - EXP piers (conventional mode)
  // - Bearing-level isolation (all support lines)

  function pierNeedsSeparateCap(pi: number): boolean {
    if (supportMode === 'isolated' && isolationLevel === 'bearing') return true;
    if (supportMode === 'conventional') {
      const cfg = pierSupports[pi]!;
      return cfg.type === 'EXP';
    }
    return false;
  }

  function abutmentNeedsSeparateCap(): boolean {
    return supportMode === 'isolated' && isolationLevel === 'bearing';
  }

  // ── 5. Generate Nodes ───────────────────────────────────────────────

  const nodes: Node[] = [];

  // Deck nodes at every support line
  for (let sli = 0; sli < numSupportLines; sli++) {
    const isAbutment = sli === 0 || sli === numSupportLines - 1;
    const pierIdx = sli - 1; // only valid for non-abutments

    for (let gi = 0; gi < numGirders; gi++) {
      let restraint: [boolean, boolean, boolean, boolean, boolean, boolean];

      if (isAbutment) {
        if (abutmentNeedsSeparateCap()) {
          // Isolated bearing at abutment: deck nodes are free
          restraint = [...FREE];
        } else {
          // Conventional: abutment deck nodes are rollers
          restraint = [...ROLLER];
        }
      } else {
        // Pier support line
        if (supportMode === 'isolated' && isolationLevel === 'bearing') {
          // Bearing-level isolation: deck nodes free
          restraint = [...FREE];
        } else if (supportMode === 'conventional' && pierSupports[pierIdx]!.type === 'EXP') {
          // EXP pier: deck nodes free (constrained via equalDOF)
          restraint = [...FREE];
        } else {
          // FIX pier or col-base isolation: deck shared with cap, free
          restraint = [...FREE];
        }
      }

      // For bearing-level: deck nodes sit 1" above cap
      const nodeY =
        !isAbutment && pierNeedsSeparateCap(pierIdx)
          ? deckY[sli]! + 1
          : isAbutment && abutmentNeedsSeparateCap()
            ? deckY[sli]!
            : deckY[sli]!;

      nodes.push({
        id: deckNodeId(sli, gi, numGirders),
        x: supportX[sli]!,
        y: nodeY,
        z: girderZ[gi]!,
        restraint,
        mass: 0,
        label: `Deck SL${sli + 1} G${gi + 1}`,
      });
    }
  }

  // Cap nodes (for piers with separate cap, and for abutments in bearing-level isolation)
  for (let pi = 0; pi < numPiers; pi++) {
    if (!pierNeedsSeparateCap(pi)) continue;
    const sli = pi + 1;
    const capY = deckY[sli]!;
    for (let gi = 0; gi < numGirders; gi++) {
      nodes.push({
        id: capNodeId(pi, gi, numGirders),
        x: supportX[sli]!,
        y: capY,
        z: girderZ[gi]!,
        restraint: [...FREE],
        mass: 0,
        label: `Cap P${pi + 1} G${gi + 1}`,
      });
    }
  }

  // Abutment cap nodes for bearing-level isolation
  if (abutmentNeedsSeparateCap()) {
    // Abt1 cap nodes (use pi index = numPiers for abt1, numPiers+1 for abt2 in capNodeId space)
    // But capNodeId uses pi. For abutments we use a different approach:
    // Abt1 cap nodes: 1000 + numPiers * numGirders + gi + 1
    // Abt2 cap nodes: 1000 + (numPiers+1) * numGirders + gi + 1
    const abt1CapPi = numPiers; // virtual pier index for abt1
    const abt2CapPi = numPiers + 1; // virtual pier index for abt2

    for (let gi = 0; gi < numGirders; gi++) {
      // Abt1 cap: 1" below deck
      nodes.push({
        id: capNodeId(abt1CapPi, gi, numGirders),
        x: supportX[0]!,
        y: deckY[0]! - 1,
        z: girderZ[gi]!,
        restraint: [...ROLLER],
        mass: 0,
        label: `Cap Abt1 G${gi + 1}`,
      });
    }

    for (let gi = 0; gi < numGirders; gi++) {
      // Abt2 cap: 1" below deck
      nodes.push({
        id: capNodeId(abt2CapPi, gi, numGirders),
        x: supportX[numSupportLines - 1]!,
        y: deckY[numSupportLines - 1]! - 1,
        z: girderZ[gi]!,
        restraint: [...ROLLER],
        mass: 0,
        label: `Cap Abt2 G${gi + 1}`,
      });
    }
  }

  // Base nodes for piers
  for (let pi = 0; pi < numPiers; pi++) {
    const sli = pi + 1;
    const isColBaseIsolation = supportMode === 'isolated' && isolationLevel === 'base';

    for (let ci = 0; ci < numBentColumns; ci++) {
      const colZ = columnZPositions[ci]!;
      const restraint: [boolean, boolean, boolean, boolean, boolean, boolean] = isColBaseIsolation
        ? [...FREE]
        : [...FIXED];

      nodes.push({
        id: baseNodeId(pi, ci, numBentColumns),
        x: supportX[sli]!,
        y: 0,
        z: colZ,
        restraint,
        mass: 0,
        label: `Base P${pi + 1} C${ci + 1}`,
      });
    }
  }

  // Ground nodes for column-base isolation
  if (supportMode === 'isolated' && isolationLevel === 'base') {
    for (let pi = 0; pi < numPiers; pi++) {
      const sli = pi + 1;
      for (let ci = 0; ci < numBentColumns; ci++) {
        const colZ = columnZPositions[ci]!;
        nodes.push({
          id: groundNodeId(pi, ci, numBentColumns),
          x: supportX[sli]!,
          y: -1,
          z: colZ,
          restraint: [...FIXED],
          mass: 0,
          label: `Ground P${pi + 1} C${ci + 1}`,
        });
      }
    }
  }

  // ── 6. Generate Elements ────────────────────────────────────────────

  const elements: Element[] = [];
  let nextElementId = 1;

  // 6a. Girders: numGirders per span, connecting consecutive support-line deck nodes
  for (let span = 0; span < numSpans; span++) {
    const sliI = span;
    const sliJ = span + 1;
    for (let gi = 0; gi < numGirders; gi++) {
      elements.push({
        id: nextElementId++,
        type: 'beam',
        nodeI: deckNodeId(sliI, gi, numGirders),
        nodeJ: deckNodeId(sliJ, gi, numGirders),
        sectionId: girderSectionId,
        materialId: girderMatId,
        label: `Girder Span${span + 1} G${gi + 1}`,
      });
    }
  }

  // 6b. Cross-beams at deck level (at every support line)
  for (let sli = 0; sli < numSupportLines; sli++) {
    for (let gi = 0; gi < numGirders - 1; gi++) {
      elements.push({
        id: nextElementId++,
        type: 'beam',
        nodeI: deckNodeId(sli, gi, numGirders),
        nodeJ: deckNodeId(sli, gi + 1, numGirders),
        sectionId: crossBeamSectionId,
        materialId: crossBeamMatId,
        label: `XBeam SL${sli + 1} G${gi + 1}-${gi + 2}`,
      });
    }
  }

  // 6c. Pier cap beams (when cap is separate from deck)
  for (let pi = 0; pi < numPiers; pi++) {
    if (!pierNeedsSeparateCap(pi)) continue;
    for (let gi = 0; gi < numGirders - 1; gi++) {
      elements.push({
        id: nextElementId++,
        type: 'beam',
        nodeI: capNodeId(pi, gi, numGirders),
        nodeJ: capNodeId(pi, gi + 1, numGirders),
        sectionId: pierCapSectionId,
        materialId: concreteMatId,
        label: `PierCap P${pi + 1} G${gi + 1}-${gi + 2}`,
      });
    }
  }

  // 6d. Columns: connect base to deck/cap
  for (let pi = 0; pi < numPiers; pi++) {
    const hasSeparateCap = pierNeedsSeparateCap(pi);

    for (let ci = 0; ci < numBentColumns; ci++) {
      const colZ = columnZPositions[ci]!;
      const bNodeId = baseNodeId(pi, ci, numBentColumns);

      // Find the top node to connect to
      let topNodeId: number;
      if (hasSeparateCap) {
        // Connect to the closest cap node in Z
        const closestGi = closestCapNodeGi(colZ, girderZ);
        topNodeId = capNodeId(pi, closestGi, numGirders);
      } else {
        // FIX pier or col-base isolation: connect base to deck (shared)
        const sli = pi + 1;
        const closestGi = closestCapNodeGi(colZ, girderZ);
        topNodeId = deckNodeId(sli, closestGi, numGirders);
      }

      elements.push({
        id: nextElementId++,
        type: 'column',
        nodeI: bNodeId,
        nodeJ: topNodeId,
        sectionId: colSectionId,
        materialId: concreteMatId,
        label: `Col P${pi + 1} C${ci + 1}`,
      });
    }
  }

  // ── 7. Generate Gravity Loads ───────────────────────────────────────

  const loads: PointLoad[] = [];
  let nextLoadId = 1;

  for (let sli = 0; sli < numSupportLines; sli++) {
    const isAbutment = sli === 0 || sli === numSupportLines - 1;

    // Tributary length in feet
    let tribLengthFt: number;
    if (isAbutment) {
      if (sli === 0) {
        tribLengthFt = spanLengths[0]! / 2;
      } else {
        tribLengthFt = spanLengths[numSpans - 1]! / 2;
      }
    } else {
      // Pier: average of adjacent spans
      const leftSpan = spanLengths[sli - 1]!;
      const rightSpan = spanLengths[sli]!;
      tribLengthFt = (leftSpan + rightSpan) / 2;
    }

    for (let gi = 0; gi < numGirders; gi++) {
      const isExterior = gi === 0 || gi === numGirders - 1;
      const result = computeGirderNodeLoad(
        deadLoads,
        tribLengthFt,
        girderSpacingFt,
        overhang,
        isExterior,
        roadwayWidth,
        numGirders,
        aashtoLLPercent,
      );

      loads.push({
        id: nextLoadId++,
        nodeId: deckNodeId(sli, gi, numGirders),
        fx: 0,
        fy: -result.totalKips,
        fz: 0,
        mx: 0,
        my: 0,
        mz: 0,
      });
    }
  }

  // ── 8. Generate TFP Bearings (isolated mode only) ───────────────────

  const bearings: TFPBearing[] = [];

  if (supportMode === 'isolated') {
    let bearingId = 1;

    const innerSurface: FrictionSurface = {
      type: 'VelDependent',
      muSlow: 0.04,
      muFast: 0.08,
      transRate: 25,
    };
    const outerSurface: FrictionSurface = {
      type: 'VelDependent',
      muSlow: 0.06,
      muFast: 0.12,
      transRate: 25,
    };

    if (isolationLevel === 'bearing') {
      // TFP bearing per girder per support line
      const abt1CapPi = numPiers;
      const abt2CapPi = numPiers + 1;

      for (let sli = 0; sli < numSupportLines; sli++) {
        const isAbutment = sli === 0 || sli === numSupportLines - 1;

        for (let gi = 0; gi < numGirders; gi++) {
          // Weight = gravity load at this node
          const isAbt1 = sli === 0;
          const tribLengthFt = isAbt1
            ? spanLengths[0]! / 2
            : sli === numSupportLines - 1
              ? spanLengths[numSpans - 1]! / 2
              : (spanLengths[sli - 1]! + spanLengths[sli]!) / 2;
          const isExterior = gi === 0 || gi === numGirders - 1;
          const loadResult = computeGirderNodeLoad(
            deadLoads,
            tribLengthFt,
            girderSpacingFt,
            overhang,
            isExterior,
            roadwayWidth,
            numGirders,
            aashtoLLPercent,
          );

          let nodeI: number;
          if (isAbutment) {
            const capPi = sli === 0 ? abt1CapPi : abt2CapPi;
            nodeI = capNodeId(capPi, gi, numGirders);
          } else {
            const pi = sli - 1;
            nodeI = capNodeId(pi, gi, numGirders);
          }

          bearings.push({
            id: bearingId++,
            nodeI,
            nodeJ: deckNodeId(sli, gi, numGirders),
            surfaces: [innerSurface, outerSurface, outerSurface, innerSurface],
            radii: [20, 140, 20],
            dispCapacities: [3, 18, 3],
            weight: loadResult.totalKips,
            yieldDisp: 0.08,
            vertStiffness: 9000,
            minVertForce: 0.1,
            tolerance: 1e-8,
            label: `TFP SL${sli + 1} G${gi + 1}`,
          });
        }
      }
    } else {
      // Column-base isolation: TFP bearing per column per pier
      for (let pi = 0; pi < numPiers; pi++) {
        const sli = pi + 1;

        // Total tributary gravity for this pier across all girders
        const tribLengthFt = (spanLengths[sli - 1]! + spanLengths[sli]!) / 2;
        let totalPierLoad = 0;
        for (let gi = 0; gi < numGirders; gi++) {
          const isExterior = gi === 0 || gi === numGirders - 1;
          const loadResult = computeGirderNodeLoad(
            deadLoads,
            tribLengthFt,
            girderSpacingFt,
            overhang,
            isExterior,
            roadwayWidth,
            numGirders,
            aashtoLLPercent,
          );
          totalPierLoad += loadResult.totalKips;
        }
        const perColWeight = totalPierLoad / numBentColumns;

        for (let ci = 0; ci < numBentColumns; ci++) {
          bearings.push({
            id: bearingId++,
            nodeI: groundNodeId(pi, ci, numBentColumns),
            nodeJ: baseNodeId(pi, ci, numBentColumns),
            surfaces: [innerSurface, outerSurface, outerSurface, innerSurface],
            radii: [20, 140, 20],
            dispCapacities: [3, 18, 3],
            weight: perColWeight,
            yieldDisp: 0.08,
            vertStiffness: 9000,
            minVertForce: 0.1,
            tolerance: 1e-8,
            label: `TFP P${pi + 1} C${ci + 1}`,
          });
        }
      }
    }
  }

  // ── 9. Generate equalDOF Constraints (conventional EXP only) ────────

  const equalDofConstraints: EqualDOFConstraint[] = [];

  if (supportMode === 'conventional') {
    let eqId = 1;
    for (let pi = 0; pi < numPiers; pi++) {
      const cfg = pierSupports[pi]!;
      if (cfg.type !== 'EXP') continue;
      const sli = pi + 1;
      const dofs = cfg.guided ? [2, 3] : [2];

      for (let gi = 0; gi < numGirders; gi++) {
        equalDofConstraints.push({
          id: eqId++,
          retainedNodeId: capNodeId(pi, gi, numGirders),
          constrainedNodeId: deckNodeId(sli, gi, numGirders),
          dofs,
          label: `EqDOF P${pi + 1} G${gi + 1}`,
        });
      }
    }
  }

  // ── 10. Generate Rigid Diaphragms ───────────────────────────────────

  const diaphragms: RigidDiaphragm[] = [];
  let diaId = 1;

  for (let sli = 0; sli < numSupportLines; sli++) {
    const masterNodeId = deckNodeId(sli, 0, numGirders);
    const constrainedNodeIds: number[] = [];
    for (let gi = 1; gi < numGirders; gi++) {
      constrainedNodeIds.push(deckNodeId(sli, gi, numGirders));
    }

    let label: string;
    if (sli === 0) {
      label = 'Abt1';
    } else if (sli === numSupportLines - 1) {
      label = 'Abt2';
    } else {
      label = `Pier ${sli}`;
    }

    diaphragms.push({
      id: diaId++,
      masterNodeId,
      constrainedNodeIds,
      perpDirection: 2 as const,
      label,
    });
  }

  // ── 11. Build Model Name ────────────────────────────────────────────

  const modelName = buildModelName(params, numSpans, numPiers);

  // ── 12. Assemble ModelJSON ──────────────────────────────────────────

  const supportDesc = buildSupportDesc(params, numPiers);

  const modelJSON: ModelJSON = {
    modelInfo: {
      name: modelName,
      units: 'kip-in',
      description: `${numSpans}-span ${girderType} girder bridge (${supportDesc})`,
    },
    nodes,
    elements,
    sections,
    materials,
    bearings,
    loads,
    groundMotions: [],
    diaphragms,
    equalDofConstraints: equalDofConstraints.length > 0 ? equalDofConstraints : undefined,
  };

  return modelJSON;
}

// ── Naming Helpers ────────────────────────────────────────────────────

function buildModelName(params: BentBuildParams, numSpans: number, numPiers: number): string {
  const matLabel = params.girderType === 'steel' ? 'Steel' : 'Concrete';

  if (params.supportMode === 'isolated') {
    const levelLabel =
      params.isolationLevel === 'bearing' ? 'Isolated-Bearing' : 'Isolated-ColBase';
    return `Bent Build: ${numSpans}-Span ${matLabel} (${levelLabel})`;
  }

  if (numPiers === 0) {
    return `Bent Build: 1-Span ${matLabel} (Conventional)`;
  }

  // Conventional with piers: describe pier support types
  const types = params.pierSupports.slice(0, numPiers).map((p) => p.type);
  const uniqueTypes = [...new Set(types)];

  if (uniqueTypes.length === 1) {
    return `Bent Build: ${numSpans}-Span ${matLabel} (${uniqueTypes[0]!}/${uniqueTypes[0]!})`;
  }
  return `Bent Build: ${numSpans}-Span ${matLabel} (${types.join('/')})`;
}

function buildSupportDesc(params: BentBuildParams, numPiers: number): string {
  if (params.supportMode === 'isolated') {
    return params.isolationLevel === 'bearing'
      ? 'bearing-level isolation'
      : 'column-base isolation';
  }
  if (numPiers === 0) return 'conventional, no piers';
  const types = params.pierSupports.slice(0, numPiers).map((p) => p.type);
  return `conventional ${types.join('/')}`;
}
