import type { DeadLoadComponents } from './bentBuildTypes';

/**
 * AASHTO LRFD lane count: INT(roadwayWidth / 12), minimum 1 if width >= 20ft.
 */
export function aashtoLaneCount(roadwayWidthFt: number): number {
  if (roadwayWidthFt < 20) return 0;
  return Math.max(1, Math.floor(roadwayWidthFt / 12));
}

/**
 * AASHTO LRFD multiple presence factor.
 * 1 lane: 1.20, 2 lanes: 1.00, 3 lanes: 0.85, 4+ lanes: 0.65
 */
export function aashtoMPF(numLanes: number): number {
  if (numLanes <= 0) return 0;
  if (numLanes === 1) return 1.2;
  if (numLanes === 2) return 1.0;
  if (numLanes === 3) return 0.85;
  return 0.65;
}

/**
 * Total AASHTO lane load in klf for the full roadway width.
 * 0.64 klf/lane * number of lanes * MPF.
 */
export function aashtoLaneLoadKlf(roadwayWidthFt: number): number {
  const lanes = aashtoLaneCount(roadwayWidthFt);
  return 0.64 * lanes * aashtoMPF(lanes);
}

/**
 * Compute the gravity load at a single girder node.
 *
 * @param deadLoads - Dead load component values
 * @param tribLengthFt - Tributary span length in feet (half-span for abutments, avg for piers)
 * @param spacingFt - Girder spacing in feet
 * @param overhangFt - Overhang width in feet
 * @param isExterior - Whether this is an exterior girder
 * @param roadwayWidthFt - Total roadway width in feet
 * @param numGirders - Total number of girders
 * @param llPercent - AASHTO LL percentage (0-100)
 * @returns Object with deadLoadKips, liveLoadKips, totalKips
 */
export function computeGirderNodeLoad(
  deadLoads: DeadLoadComponents,
  tribLengthFt: number,
  spacingFt: number,
  overhangFt: number,
  isExterior: boolean,
  roadwayWidthFt: number,
  numGirders: number,
  llPercent: number,
): { deadLoadKips: number; liveLoadKips: number; totalKips: number } {
  // Tributary width for this girder
  const tribWidthFt = isExterior ? spacingFt / 2 + overhangFt : spacingFt;
  const tribAreaSqFt = tribWidthFt * tribLengthFt;

  // PSF dead load components applied over tributary area
  const psfTotal =
    deadLoads.overlayPsf +
    deadLoads.crossFramesPsf +
    deadLoads.utilitiesPsf +
    deadLoads.fwsPsf +
    deadLoads.miscPsf;
  let deadLoadKips = (psfTotal * tribAreaSqFt) / 1000;

  // Barriers (klf, exterior girders only)
  if (isExterior) {
    deadLoadKips += deadLoads.barrierKlf * tribLengthFt;
  }

  // Live load: total lane load distributed equally among girders
  let liveLoadKips = 0;
  if (llPercent > 0) {
    const totalLaneLoadKlf = aashtoLaneLoadKlf(roadwayWidthFt);
    liveLoadKips = (totalLaneLoadKlf * tribLengthFt * (llPercent / 100)) / numGirders;
  }

  return {
    deadLoadKips,
    liveLoadKips,
    totalKips: deadLoadKips + liveLoadKips,
  };
}
