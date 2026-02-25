// ── COGO Alignment Geometry Engine ──────────────────────────────────────
// Pure functions for horizontal curves (circular arcs) and vertical
// curves (parabolic profiles).  All inputs in FEET, all outputs in INCHES.

import type { AlignmentParams, HorizontalPI, VerticalPVI } from './bentBuildTypes';

// ── Types ───────────────────────────────────────────────────────────────

export interface AlignmentPoint2D {
  x: number; // inches
  z: number; // inches
  bearing: number; // radians from +X axis (CCW positive)
}

export interface AlignmentPoint3D {
  x: number; // inches
  y: number; // inches (elevation)
  z: number; // inches
  bearing: number; // radians
}

// ── Constants ───────────────────────────────────────────────────────────

const DEG2RAD = Math.PI / 180;
const FT2IN = 12;

// ── Horizontal Alignment ────────────────────────────────────────────────

/**
 * Evaluate horizontal alignment at a given station (arc-length along
 * centerline). Walks tangent-curve-tangent segments for each PI.
 *
 * @param stationFt Arc-length station in feet
 * @param entryBearing Entry bearing in degrees from +X axis
 * @param horizontalPIs Array of horizontal PIs (sorted by station)
 * @returns {AlignmentPoint2D} Position (inches) and bearing (radians)
 */
export function evaluateHorizontalAlignment(
  stationFt: number,
  entryBearing: number,
  horizontalPIs: HorizontalPI[],
): AlignmentPoint2D {
  // Start position (at station 0) and bearing
  let x = 0; // feet
  let z = 0; // feet
  let bearing = entryBearing * DEG2RAD; // radians
  let currentStation = 0; // feet (arc-length consumed)

  for (const pi of horizontalPIs) {
    if (pi.radius <= 0) continue; // skip invalid

    const deltaRad = pi.deflectionAngle * DEG2RAD;
    const arcLen = pi.radius * deltaRad; // arc length
    const pcStation = pi.station; // PC station
    const ptStation = pcStation + arcLen; // PT station

    // Advance along tangent to PC (or to target if before PC)
    if (stationFt <= pcStation) {
      const dist = stationFt - currentStation;
      x += dist * Math.cos(bearing);
      z += dist * Math.sin(bearing);
      return { x: x * FT2IN, z: z * FT2IN, bearing };
    }

    // Advance to PC
    const distToPC = pcStation - currentStation;
    x += distToPC * Math.cos(bearing);
    z += distToPC * Math.sin(bearing);
    currentStation = pcStation;

    // Check if target is within the curve
    if (stationFt <= ptStation) {
      const arcDist = stationFt - pcStation;
      const sweepAngle = arcDist / pi.radius; // radians swept
      const sign = pi.direction === 'R' ? -1 : 1;

      // Center of curve: perpendicular to tangent at PC
      const perpAngle = bearing + sign * (Math.PI / 2);
      const cx = x + pi.radius * Math.cos(perpAngle);
      const cz = z + pi.radius * Math.sin(perpAngle);

      // Point on arc: rotate from PC around center
      const startAngle = Math.atan2(z - cz, x - cx);
      const pointAngle = startAngle + sign * sweepAngle;

      const px = cx + pi.radius * Math.cos(pointAngle);
      const pz = cz + pi.radius * Math.sin(pointAngle);

      // Bearing at this point (tangent to circle)
      const newBearing = bearing + sign * sweepAngle;

      return { x: px * FT2IN, z: pz * FT2IN, bearing: newBearing };
    }

    // Advance through entire curve
    {
      const sweepAngle = deltaRad;
      const sign = pi.direction === 'R' ? -1 : 1;

      const perpAngle = bearing + sign * (Math.PI / 2);
      const cx = x + pi.radius * Math.cos(perpAngle);
      const cz = z + pi.radius * Math.sin(perpAngle);

      const startAngle = Math.atan2(z - cz, x - cx);
      const pointAngle = startAngle + sign * sweepAngle;

      x = cx + pi.radius * Math.cos(pointAngle);
      z = cz + pi.radius * Math.sin(pointAngle);

      bearing = bearing + sign * sweepAngle;
      currentStation = ptStation;
    }
  }

  // Past all curves — extend along final tangent
  const dist = stationFt - currentStation;
  x += dist * Math.cos(bearing);
  z += dist * Math.sin(bearing);
  return { x: x * FT2IN, z: z * FT2IN, bearing };
}

// ── Vertical Alignment ──────────────────────────────────────────────────

/**
 * Evaluate vertical alignment (elevation) at a station.
 * Between PVIs, grade is constant. At each PVI with curveLength > 0,
 * a parabolic vertical curve is applied.
 *
 * @param stationFt Station in feet
 * @param refElevFt Reference elevation at station 0 (feet)
 * @param entryGrade Entry grade in percent (e.g., 2 = 2%)
 * @param verticalPVIs Array of vertical PVIs (sorted by station)
 * @returns Elevation in inches
 */
export function evaluateVerticalAlignment(
  stationFt: number,
  refElevFt: number,
  entryGrade: number,
  verticalPVIs: VerticalPVI[],
): number {
  if (verticalPVIs.length === 0) {
    // Simple constant grade
    return (refElevFt + stationFt * (entryGrade / 100)) * FT2IN;
  }

  // Walk through PVI segments
  let currentGrade = entryGrade / 100; // decimal
  let currentStation = 0;
  let currentElev = refElevFt; // feet

  for (const pvi of verticalPVIs) {
    const L = pvi.curveLength;
    const g1 = currentGrade; // incoming grade (decimal)
    const g2 = pvi.exitGrade / 100; // outgoing grade (decimal)

    if (L <= 0) {
      // Sharp grade break: tangent to PVI, then new grade
      if (stationFt <= pvi.station) {
        const dist = stationFt - currentStation;
        return (currentElev + dist * g1) * FT2IN;
      }
      currentElev = pvi.elevation;
      currentGrade = g2;
      currentStation = pvi.station;
      continue;
    }

    const pvcStation = pvi.station - L / 2;
    const pvtStation = pvi.station + L / 2;

    // Before PVC: on incoming tangent
    if (stationFt <= pvcStation) {
      const dist = stationFt - currentStation;
      return (currentElev + dist * g1) * FT2IN;
    }

    // Advance to PVC on tangent
    const distToPVC = pvcStation - currentStation;
    const elevAtPVC = currentElev + distToPVC * g1;

    // Within parabolic curve (PVC to PVT)
    if (stationFt <= pvtStation) {
      const x = stationFt - pvcStation;
      // Elevation = tangent from PVC + parabolic correction
      const tangentElev = elevAtPVC + g1 * x;
      const correction = ((g2 - g1) / (2 * L)) * x * x;
      return (tangentElev + correction) * FT2IN;
    }

    // Past PVT: advance through entire curve
    {
      const x = L;
      const tangentElev = elevAtPVC + g1 * x;
      const correction = ((g2 - g1) / (2 * L)) * x * x;
      currentElev = tangentElev + correction;
      currentGrade = g2;
      currentStation = pvtStation;
    }
  }

  // Past all PVIs: extend on final grade
  const dist = stationFt - currentStation;
  return (currentElev + dist * currentGrade) * FT2IN;
}

// ── Combined 3D Evaluation ──────────────────────────────────────────────

/**
 * Evaluate full 3D alignment point at a station.
 */
export function evaluateAlignment(stationFt: number, alignment: AlignmentParams): AlignmentPoint3D {
  const horiz = evaluateHorizontalAlignment(
    stationFt,
    alignment.entryBearing,
    alignment.horizontalPIs,
  );
  const elevIn = evaluateVerticalAlignment(
    stationFt,
    alignment.refElevation,
    alignment.entryGrade,
    alignment.verticalPVIs,
  );

  return {
    x: horiz.x,
    y: elevIn,
    z: horiz.z,
    bearing: horiz.bearing,
  };
}

// ── Transverse Offset ───────────────────────────────────────────────────

/**
 * Apply a transverse (perpendicular) offset to a 2D alignment point.
 * Positive offset is to the LEFT of the bearing direction.
 *
 * @param point Alignment point with bearing (radians)
 * @param offsetInches Transverse offset in inches
 * @returns {x, z} in inches
 */
export function applyTransverseOffset(
  point: { x: number; z: number; bearing: number },
  offsetInches: number,
): { x: number; z: number } {
  // Perpendicular to bearing (90° CCW = left)
  const perpAngle = point.bearing + Math.PI / 2;
  return {
    x: point.x + offsetInches * Math.cos(perpAngle),
    z: point.z + offsetInches * Math.sin(perpAngle),
  };
}

// ── Span Stations ───────────────────────────────────────────────────────

/**
 * Generate intermediate stations between two endpoints for chord
 * discretization. Returns `numChords - 1` interior points (excludes
 * start and end stations).
 *
 * @param startFt Start station in feet
 * @param endFt End station in feet
 * @param numChords Number of chords (segments) to divide into
 * @returns Array of intermediate station values in feet
 */
export function spanStations(startFt: number, endFt: number, numChords: number): number[] {
  if (numChords <= 1) return [];
  const stations: number[] = [];
  const step = (endFt - startFt) / numChords;
  for (let i = 1; i < numChords; i++) {
    stations.push(startFt + i * step);
  }
  return stations;
}
