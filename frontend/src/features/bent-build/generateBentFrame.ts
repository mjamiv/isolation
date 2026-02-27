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
import type { BentBuildParams, AlignmentParams } from './bentBuildTypes';
import { DEFAULT_ALIGNMENT } from './bentBuildTypes';
import { evaluateAlignment, applyTransverseOffset, spanStations } from './alignmentGeometry';
import type { AlignmentPoint3D } from './alignmentGeometry';
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

/** Node IDs for intermediate chord points within a span. */
function chordNodeId(
  span: number,
  chord: number,
  gi: number,
  maxChordsPerSpan: number,
  numGirders: number,
): number {
  return 3000 + span * (maxChordsPerSpan - 1) * numGirders + chord * numGirders + gi + 1;
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

/** Find the girder index whose transverse offset is closest to a column offset. */
function closestGirderIndex(colOffset: number, girderOffsets: number[]): number {
  let bestGi = 0;
  let bestDist = Infinity;
  for (let gi = 0; gi < girderOffsets.length; gi++) {
    const dist = Math.abs(girderOffsets[gi]! - colOffset);
    if (dist < bestDist) {
      bestDist = dist;
      bestGi = gi;
    }
  }
  return bestGi;
}

/** Compute column transverse offsets centered on alignment (in inches). */
function computeColumnOffsets(numBentColumns: number, totalGirderWidth: number): number[] {
  const offsets: number[] = [];
  if (numBentColumns === 1) {
    offsets.push(0); // centered on alignment
  } else {
    for (let ci = 0; ci < numBentColumns; ci++) {
      offsets.push((ci * totalGirderWidth) / (numBentColumns - 1) - totalGirderWidth / 2);
    }
  }
  return offsets;
}

/** Legacy column Z positions (absolute, starting from 0) for backward compat. */
function computeColumnOffsetsLegacy(numBentColumns: number, totalGirderWidth: number): number[] {
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
    slopePercent = 0,
    alignment,
    includeDiaphragms = true,
  } = params;

  const numPiers = numSpans - 1;
  const numSupportLines = numSpans + 1; // abutments + piers

  // ── 1. Unit conversions (ft -> in) & Alignment setup ────────────────

  const girderSpacingIn = (roadwayWidth * 12 - 2 * overhang * 12) / (numGirders - 1);
  const girderSpacingFt = girderSpacingIn / 12;
  const totalGirderWidth = girderSpacingIn * (numGirders - 1);

  // Build effective alignment: backward-compatible with slopePercent when undefined
  const effectiveAlignment: AlignmentParams = alignment
    ? alignment
    : {
        ...DEFAULT_ALIGNMENT,
        entryGrade: slopePercent,
      };

  const chordsPerSpan = effectiveAlignment.chordsPerSpan || 1;

  // Support stations (cumulative span lengths in feet, arc-length along alignment)
  const supportStationsFt: number[] = [0];
  for (let i = 0; i < numSpans; i++) {
    supportStationsFt.push(supportStationsFt[i]! + spanLengths[i]!);
  }

  // Reference deck elevation: max column height (in inches), minimum 240" (20 ft)
  const referenceDeckY = numPiers > 0 ? Math.max(240, ...columnHeights.map((h) => h * 12)) : 240;

  // Evaluate alignment at each support line
  const alignmentPoints: AlignmentPoint3D[] = [];
  for (let sli = 0; sli < numSupportLines; sli++) {
    alignmentPoints.push(evaluateAlignment(supportStationsFt[sli]!, effectiveAlignment));
  }

  // Girder transverse offsets (in inches)
  // When alignment is active, center on alignment (offset from CL).
  // When no alignment, use legacy positions starting from 0 for backward compat.
  const girderOffsets: number[] = [];
  if (alignment) {
    for (let gi = 0; gi < numGirders; gi++) {
      girderOffsets.push(gi * girderSpacingIn - totalGirderWidth / 2);
    }
  } else {
    for (let gi = 0; gi < numGirders; gi++) {
      girderOffsets.push(gi * girderSpacingIn);
    }
  }

  // Deck elevation at each support line (alignment Y + reference height)
  const deckY: number[] = [];
  for (let sli = 0; sli < numSupportLines; sli++) {
    deckY.push(referenceDeckY + alignmentPoints[sli]!.y);
  }

  // Column transverse offsets (in inches)
  // When alignment is active, center on alignment. When legacy, use old absolute positions.
  const columnOffsets = alignment
    ? computeColumnOffsets(numBentColumns, totalGirderWidth)
    : computeColumnOffsetsLegacy(numBentColumns, totalGirderWidth);

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

  // ── Section depth offsets for realistic node geometry ─────────────────

  const girderDepth = girderSectionData.d;
  const pierCapDepth = pierCapData.d;
  const halfGirder = girderDepth / 2;
  const halfCap = pierCapDepth / 2;

  // ── 4. Determine which support lines need cap nodes ─────────────────
  // Cap nodes are separate from deck nodes for:
  // - EXP piers (conventional mode)
  // - Bearing-level isolation (all support lines)

  function pierNeedsSeparateCap(_pi: number): boolean {
    // All piers get separate cap nodes so pier cap beams are always concrete
    return true;
  }

  function abutmentNeedsSeparateCap(): boolean {
    return supportMode === 'isolated' && isolationLevel === 'bearing';
  }

  // ── Helper: compute XZ coords for a node at a given support line + offset ──

  function deckNodeCoords(sli: number, gi: number): { x: number; z: number } {
    if (!alignment) {
      // Legacy path: direct coords for backward compat (no floating-point noise)
      return { x: supportStationsFt[sli]! * 12, z: girderOffsets[gi]! };
    }
    const ap = alignmentPoints[sli]!;
    return applyTransverseOffset(ap, girderOffsets[gi]!);
  }

  function colNodeCoords(pi: number, ci: number): { x: number; z: number } {
    const sli = pi + 1;
    if (!alignment) {
      return { x: supportStationsFt[sli]! * 12, z: columnOffsets[ci]! };
    }
    const ap = alignmentPoints[sli]!;
    return applyTransverseOffset(ap, columnOffsets[ci]!);
  }

  // ── 5. Generate Nodes ───────────────────────────────────────────────

  const nodes: Node[] = [];

  // Deck nodes at every support line
  for (let sli = 0; sli < numSupportLines; sli++) {
    const isAbutment = sli === 0 || sli === numSupportLines - 1;

    for (let gi = 0; gi < numGirders; gi++) {
      let restraint: [boolean, boolean, boolean, boolean, boolean, boolean];

      if (isAbutment) {
        if (abutmentNeedsSeparateCap()) {
          restraint = [...FREE];
        } else {
          restraint = [...ROLLER];
        }
      } else {
        restraint = [...FREE];
      }

      const nodeY = deckY[sli]! + halfGirder;
      const { x, z } = deckNodeCoords(sli, gi);

      nodes.push({
        id: deckNodeId(sli, gi, numGirders),
        x,
        y: nodeY,
        z,
        restraint,
        mass: 0,
        label: `Deck SL${sli + 1} G${gi + 1}`,
      });
    }
  }

  // Intermediate chord nodes for curved spans
  if (chordsPerSpan > 1) {
    for (let span = 0; span < numSpans; span++) {
      const startFt = supportStationsFt[span]!;
      const endFt = supportStationsFt[span + 1]!;
      const interiorStations = spanStations(startFt, endFt, chordsPerSpan);

      for (let ci = 0; ci < interiorStations.length; ci++) {
        const stFt = interiorStations[ci]!;
        const ap = evaluateAlignment(stFt, effectiveAlignment);
        const chordY = referenceDeckY + ap.y + halfGirder;

        for (let gi = 0; gi < numGirders; gi++) {
          const { x, z } = applyTransverseOffset(ap, girderOffsets[gi]!);
          nodes.push({
            id: chordNodeId(span, ci, gi, chordsPerSpan, numGirders),
            x,
            y: chordY,
            z,
            restraint: [...FREE],
            mass: 0,
            label: `Chord Span${span + 1} C${ci + 1} G${gi + 1}`,
          });
        }
      }
    }
  }

  // Cap nodes (for piers with separate cap, and for abutments in bearing-level isolation)
  for (let pi = 0; pi < numPiers; pi++) {
    if (!pierNeedsSeparateCap(pi)) continue;
    const sli = pi + 1;
    const capY = deckY[sli]! - halfCap;
    for (let gi = 0; gi < numGirders; gi++) {
      const { x, z } = deckNodeCoords(sli, gi);
      nodes.push({
        id: capNodeId(pi, gi, numGirders),
        x,
        y: capY,
        z,
        restraint: [...FREE],
        mass: 0,
        label: `Cap P${pi + 1} G${gi + 1}`,
      });
    }
  }

  // Abutment cap nodes for bearing-level isolation
  if (abutmentNeedsSeparateCap()) {
    const abt1CapPi = numPiers;
    const abt2CapPi = numPiers + 1;

    for (let gi = 0; gi < numGirders; gi++) {
      const { x, z } = deckNodeCoords(0, gi);
      nodes.push({
        id: capNodeId(abt1CapPi, gi, numGirders),
        x,
        y: deckY[0]! - 1,
        z,
        restraint: [...ROLLER],
        mass: 0,
        label: `Cap Abt1 G${gi + 1}`,
      });
    }

    for (let gi = 0; gi < numGirders; gi++) {
      const { x, z } = deckNodeCoords(numSupportLines - 1, gi);
      nodes.push({
        id: capNodeId(abt2CapPi, gi, numGirders),
        x,
        y: deckY[numSupportLines - 1]! - 1,
        z,
        restraint: [...ROLLER],
        mass: 0,
        label: `Cap Abt2 G${gi + 1}`,
      });
    }
  }

  // Base nodes for piers — base extends DOWN from deck elevation
  for (let pi = 0; pi < numPiers; pi++) {
    const sli = pi + 1;
    const isColBaseIsolation = supportMode === 'isolated' && isolationLevel === 'base';
    const baseY = deckY[sli]! - (columnHeights[pi] ?? 20) * 12;

    for (let ci = 0; ci < numBentColumns; ci++) {
      const { x, z } = colNodeCoords(pi, ci);
      const restraint: [boolean, boolean, boolean, boolean, boolean, boolean] = isColBaseIsolation
        ? [...FREE]
        : [...FIXED];

      nodes.push({
        id: baseNodeId(pi, ci, numBentColumns),
        x,
        y: baseY,
        z,
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
      const baseY = deckY[sli]! - (columnHeights[pi] ?? 20) * 12;
      for (let ci = 0; ci < numBentColumns; ci++) {
        const { x, z } = colNodeCoords(pi, ci);
        nodes.push({
          id: groundNodeId(pi, ci, numBentColumns),
          x,
          y: baseY - 1,
          z,
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

  // 6a. Girders: numGirders per span, with optional chord discretization
  for (let span = 0; span < numSpans; span++) {
    for (let gi = 0; gi < numGirders; gi++) {
      if (chordsPerSpan <= 1) {
        // Single element per span per girder
        elements.push({
          id: nextElementId++,
          type: 'beam',
          nodeI: deckNodeId(span, gi, numGirders),
          nodeJ: deckNodeId(span + 1, gi, numGirders),
          sectionId: girderSectionId,
          materialId: girderMatId,
          label: `Girder Span${span + 1} G${gi + 1}`,
        });
      } else {
        // Chord-discretized: connect support → chord₁ → chord₂ → ... → support
        const numInterior = chordsPerSpan - 1;
        // First chord: support line → first intermediate node
        elements.push({
          id: nextElementId++,
          type: 'beam',
          nodeI: deckNodeId(span, gi, numGirders),
          nodeJ: chordNodeId(span, 0, gi, chordsPerSpan, numGirders),
          sectionId: girderSectionId,
          materialId: girderMatId,
          label: `Girder Span${span + 1} G${gi + 1} C1`,
        });
        // Interior chords
        for (let ci = 0; ci < numInterior - 1; ci++) {
          elements.push({
            id: nextElementId++,
            type: 'beam',
            nodeI: chordNodeId(span, ci, gi, chordsPerSpan, numGirders),
            nodeJ: chordNodeId(span, ci + 1, gi, chordsPerSpan, numGirders),
            sectionId: girderSectionId,
            materialId: girderMatId,
            label: `Girder Span${span + 1} G${gi + 1} C${ci + 2}`,
          });
        }
        // Last chord: last intermediate → next support line
        elements.push({
          id: nextElementId++,
          type: 'beam',
          nodeI: chordNodeId(span, numInterior - 1, gi, chordsPerSpan, numGirders),
          nodeJ: deckNodeId(span + 1, gi, numGirders),
          sectionId: girderSectionId,
          materialId: girderMatId,
          label: `Girder Span${span + 1} G${gi + 1} C${chordsPerSpan}`,
        });
      }
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
        type: 'pierCap',
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
      const colOffset = columnOffsets[ci]!;
      const bNodeId = baseNodeId(pi, ci, numBentColumns);

      // Find the top node to connect to
      let topNodeId: number;
      if (hasSeparateCap) {
        const closestGi = closestGirderIndex(colOffset, girderOffsets);
        topNodeId = capNodeId(pi, closestGi, numGirders);
      } else {
        const sli = pi + 1;
        const closestGi = closestGirderIndex(colOffset, girderOffsets);
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
      muSlow: 0.02,
      muFast: 0.06,
      transRate: 25,
    };
    const outerSurface: FrictionSurface = {
      type: 'VelDependent',
      muSlow: 0.04,
      muFast: 0.1,
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
            dispCapacities: [6, 25, 6],
            weight: loadResult.totalKips,
            yieldDisp: 0.08,
            vertStiffness: Math.max(9000, loadResult.totalKips * 50),
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
            dispCapacities: [6, 25, 6],
            weight: perColWeight,
            yieldDisp: 0.08,
            vertStiffness: Math.max(9000, perColWeight * 50),
            minVertForce: 0.1,
            tolerance: 1e-8,
            label: `TFP P${pi + 1} C${ci + 1}`,
          });
        }
      }
    }
  }

  // ── 9. Generate equalDOF Constraints ────────────────────────────────

  const equalDofConstraints: EqualDOFConstraint[] = [];

  if (supportMode === 'conventional') {
    let eqId = 1;
    let hasLongitudinalFixPier = false;
    const hasUserFixPier = Array.from({ length: numPiers }, (_, pi) => {
      const cfg = pierSupports[pi] ?? { type: 'FIX' as const, guided: false };
      return cfg.type === 'FIX';
    }).some(Boolean);
    // Single-column bents with all EXP supports are mechanism-prone.
    // Promote Pier 1 to FIX to keep the generated model constructible/stable.
    const forceFixPier0 = !hasUserFixPier && numBentColumns === 1 && numPiers > 0;

    for (let pi = 0; pi < numPiers; pi++) {
      const cfg = pierSupports[pi] ?? { type: 'FIX' as const, guided: false };
      const sli = pi + 1;
      const effectiveType = forceFixPier0 && pi === 0 ? 'FIX' : cfg.type;
      const autoFixed = forceFixPier0 && pi === 0;
      if (effectiveType === 'FIX') {
        hasLongitudinalFixPier = true;
      }

      let dofs: number[];
      if (effectiveType === 'FIX') {
        // Pinned connection: translations constrained, rotations free
        // Girders sit on cap — bending rotations do not transfer to substructure
        dofs = [1, 2, 3];
      } else {
        // EXP: vertical only, or vertical + transverse if guided
        dofs = cfg.guided ? [2, 3] : [2];
      }

      for (let gi = 0; gi < numGirders; gi++) {
        equalDofConstraints.push({
          id: eqId++,
          retainedNodeId: capNodeId(pi, gi, numGirders),
          constrainedNodeId: deckNodeId(sli, gi, numGirders),
          dofs,
          label: autoFixed
            ? `EqDOF P${pi + 1} G${gi + 1} [Auto-FIX]`
            : `EqDOF P${pi + 1} G${gi + 1}`,
        });
      }
    }

    // Stabilize all-EXP conventional layouts by adding one longitudinal anchor.
    // Without any FIX pier, the deck can become a longitudinal rigid-body mechanism.
    if (!hasLongitudinalFixPier && numPiers > 0) {
      const anchorGi = closestGirderIndex(columnOffsets[0]!, girderOffsets);
      equalDofConstraints.push({
        id: eqId++,
        retainedNodeId: capNodeId(0, anchorGi, numGirders),
        constrainedNodeId: deckNodeId(1, anchorGi, numGirders),
        dofs: [1],
        label: `EqDOF Anchor P1 G${anchorGi + 1}`,
      });
    }
  }

  // ── 10. Generate Rigid Diaphragms ───────────────────────────────────
  // Single deck-level diaphragm containing ALL deck nodes (support-line +
  // chord nodes).  The deck slab acts as one rigid body in-plane.

  const diaphragms: RigidDiaphragm[] = [];

  if (includeDiaphragms && numGirders >= 2) {
    // Collect diaphragm node IDs — always use deck nodes.
    // The solver handles DOF conflicts between rigidDiaphragm and equalDOF
    // by filtering overlapping DOFs before applying equalDOF constraints.
    const allDiaphragmNodeIds: number[] = [];

    for (let sli = 0; sli < numSupportLines; sli++) {
      for (let gi = 0; gi < numGirders; gi++) {
        allDiaphragmNodeIds.push(deckNodeId(sli, gi, numGirders));
      }
    }

    if (chordsPerSpan > 1) {
      for (let span = 0; span < numSpans; span++) {
        for (let ci = 0; ci < chordsPerSpan - 1; ci++) {
          for (let gi = 0; gi < numGirders; gi++) {
            allDiaphragmNodeIds.push(chordNodeId(span, ci, gi, chordsPerSpan, numGirders));
          }
        }
      }
    }

    const masterNodeId = allDiaphragmNodeIds[0]!;
    const constrainedNodeIds = allDiaphragmNodeIds.slice(1);

    diaphragms.push({
      id: 1,
      masterNodeId,
      constrainedNodeIds,
      perpDirection: 2 as const,
      label: 'Deck',
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
