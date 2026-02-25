import { describe, it, expect } from 'vitest';
import {
  evaluateHorizontalAlignment,
  evaluateVerticalAlignment,
  evaluateAlignment,
  applyTransverseOffset,
  spanStations,
} from '../alignmentGeometry';
import type { HorizontalPI, VerticalPVI, AlignmentParams } from '../bentBuildTypes';
import { DEFAULT_ALIGNMENT } from '../bentBuildTypes';

const FT2IN = 12;
const DEG2RAD = Math.PI / 180;

// ── Helpers ──────────────────────────────────────────────────────────────

function approx(actual: number, expected: number, tol = 0.5) {
  expect(actual).toBeCloseTo(expected, -Math.log10(tol));
}

// ═══════════════════════════════════════════════════════════════════════
// 1. HORIZONTAL ALIGNMENT
// ═══════════════════════════════════════════════════════════════════════

describe('evaluateHorizontalAlignment', () => {
  it('straight alignment (no PIs) returns linear coords', () => {
    const p = evaluateHorizontalAlignment(100, 0, []);
    expect(p.x).toBeCloseTo(100 * FT2IN, 1);
    expect(p.z).toBeCloseTo(0, 1);
    expect(p.bearing).toBeCloseTo(0, 5);
  });

  it('straight alignment with 90° bearing', () => {
    const p = evaluateHorizontalAlignment(50, 90, []);
    expect(p.x).toBeCloseTo(0, 0);
    expect(p.z).toBeCloseTo(50 * FT2IN, 1);
  });

  it('straight alignment with 45° bearing', () => {
    const p = evaluateHorizontalAlignment(100, 45, []);
    const expected = 100 * Math.cos(45 * DEG2RAD) * FT2IN;
    expect(p.x).toBeCloseTo(expected, 0);
    expect(p.z).toBeCloseTo(expected, 0);
  });

  it('single right curve: position at PC', () => {
    const pi: HorizontalPI = {
      station: 50,
      deflectionAngle: 30,
      radius: 1000,
      direction: 'R',
    };
    // At PC station, should be on tangent
    const p = evaluateHorizontalAlignment(50, 0, [pi]);
    expect(p.x).toBeCloseTo(50 * FT2IN, 0);
    expect(p.z).toBeCloseTo(0, 0);
    expect(p.bearing).toBeCloseTo(0, 5);
  });

  it('single right curve: bearing deflects right (negative)', () => {
    const pi: HorizontalPI = {
      station: 50,
      deflectionAngle: 30,
      radius: 1000,
      direction: 'R',
    };
    const arcLen = 1000 * 30 * DEG2RAD;
    const ptStation = 50 + arcLen;
    const p = evaluateHorizontalAlignment(ptStation, 0, [pi]);
    // Right curve: bearing decreases (clockwise)
    expect(p.bearing).toBeCloseTo(-30 * DEG2RAD, 3);
  });

  it('single left curve: bearing deflects left (positive)', () => {
    const pi: HorizontalPI = {
      station: 50,
      deflectionAngle: 30,
      radius: 1000,
      direction: 'L',
    };
    const arcLen = 1000 * 30 * DEG2RAD;
    const ptStation = 50 + arcLen;
    const p = evaluateHorizontalAlignment(ptStation, 0, [pi]);
    expect(p.bearing).toBeCloseTo(30 * DEG2RAD, 3);
  });

  it('point past PT continues on deflected tangent', () => {
    const pi: HorizontalPI = {
      station: 50,
      deflectionAngle: 30,
      radius: 1000,
      direction: 'R',
    };
    const arcLen = 1000 * 30 * DEG2RAD;
    const ptStation = 50 + arcLen;
    const pPT = evaluateHorizontalAlignment(ptStation, 0, [pi]);
    const pAfter = evaluateHorizontalAlignment(ptStation + 100, 0, [pi]);

    // Should advance 100ft along deflected bearing from PT
    const expectedBearing = -30 * DEG2RAD;
    approx(pAfter.x, pPT.x + 100 * FT2IN * Math.cos(expectedBearing), 1);
    approx(pAfter.z, pPT.z + 100 * FT2IN * Math.sin(expectedBearing), 1);
  });

  it('R=1000ft, delta=30° right curve: arc length and chord check', () => {
    const R = 1000; // ft
    const delta = 30; // deg
    const pi: HorizontalPI = { station: 0, deflectionAngle: delta, radius: R, direction: 'R' };
    const arcLen = R * delta * DEG2RAD;

    const pPC = evaluateHorizontalAlignment(0, 0, [pi]);
    const pPT = evaluateHorizontalAlignment(arcLen, 0, [pi]);

    // Chord length = 2R sin(delta/2)
    const chordFt = 2 * R * Math.sin((delta * DEG2RAD) / 2);
    const dx = (pPT.x - pPC.x) / FT2IN;
    const dz = (pPT.z - pPC.z) / FT2IN;
    const actualChord = Math.sqrt(dx * dx + dz * dz);
    approx(actualChord, chordFt, 0.5);
  });

  it('compound curves: 2 consecutive PIs accumulate deflection', () => {
    const pis: HorizontalPI[] = [
      { station: 50, deflectionAngle: 20, radius: 1000, direction: 'R' },
      { station: 500, deflectionAngle: 15, radius: 2000, direction: 'R' },
    ];
    const arc2 = 2000 * 15 * DEG2RAD;
    const totalStation = 500 + arc2 + 100;
    const p = evaluateHorizontalAlignment(totalStation, 0, pis);
    // Total deflection = -20 - 15 = -35 degrees
    expect(p.bearing).toBeCloseTo(-35 * DEG2RAD, 3);
  });

  it('reverse curves cancel deflection', () => {
    const pis: HorizontalPI[] = [
      { station: 50, deflectionAngle: 20, radius: 1000, direction: 'R' },
      { station: 500, deflectionAngle: 20, radius: 1000, direction: 'L' },
    ];
    const arc2 = 1000 * 20 * DEG2RAD;
    const p = evaluateHorizontalAlignment(500 + arc2 + 50, 0, pis);
    // Right then left by same angle → net zero
    expect(p.bearing).toBeCloseTo(0, 3);
  });

  it('zero-radius PI is skipped', () => {
    const pi: HorizontalPI = {
      station: 50,
      deflectionAngle: 30,
      radius: 0,
      direction: 'R',
    };
    const p = evaluateHorizontalAlignment(100, 0, [pi]);
    // Should behave as straight
    expect(p.x).toBeCloseTo(100 * FT2IN, 0);
    expect(p.z).toBeCloseTo(0, 0);
  });

  it('station before first PI remains on initial tangent', () => {
    const pi: HorizontalPI = {
      station: 200,
      deflectionAngle: 30,
      radius: 1000,
      direction: 'R',
    };
    const p = evaluateHorizontalAlignment(100, 0, [pi]);
    expect(p.x).toBeCloseTo(100 * FT2IN, 0);
    expect(p.z).toBeCloseTo(0, 0);
    expect(p.bearing).toBeCloseTo(0, 5);
  });

  it('midpoint of curve is at correct distance from center', () => {
    const R = 500; // ft
    const delta = 60; // deg
    const pi: HorizontalPI = { station: 0, deflectionAngle: delta, radius: R, direction: 'R' };
    const midStation = (R * delta * DEG2RAD) / 2;
    const p = evaluateHorizontalAlignment(midStation, 0, [pi]);

    // Center is at (0, -R) in feet (right curve, bearing=0)
    const cx = 0;
    const cz = -R * FT2IN;
    const distFromCenter = Math.sqrt((p.x - cx * FT2IN) ** 2 + (p.z - cz) ** 2);
    approx(distFromCenter, R * FT2IN, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. VERTICAL ALIGNMENT
// ═══════════════════════════════════════════════════════════════════════

describe('evaluateVerticalAlignment', () => {
  it('constant grade (no PVIs) returns linear elevation', () => {
    const elev = evaluateVerticalAlignment(100, 20, 2, []);
    // 20ft + 100ft * 0.02 = 22ft = 264in
    expect(elev).toBeCloseTo(22 * FT2IN, 1);
  });

  it('zero grade returns constant elevation', () => {
    const elev = evaluateVerticalAlignment(500, 10, 0, []);
    expect(elev).toBeCloseTo(10 * FT2IN, 1);
  });

  it('negative grade slopes downward', () => {
    const elev = evaluateVerticalAlignment(100, 20, -3, []);
    expect(elev).toBeCloseTo((20 - 3) * FT2IN, 1);
  });

  it('sharp grade break (curveLength=0): changes grade at PVI', () => {
    const pvi: VerticalPVI = { station: 100, elevation: 22, exitGrade: -1, curveLength: 0 };
    // Before PVI at station 50: elev = 20 + 50*0.02 = 21ft
    const before = evaluateVerticalAlignment(50, 20, 2, [pvi]);
    expect(before).toBeCloseTo(21 * FT2IN, 1);
    // After PVI at station 150: elev = 22 + 50*(-0.01) = 21.5ft
    const after = evaluateVerticalAlignment(150, 20, 2, [pvi]);
    expect(after).toBeCloseTo(21.5 * FT2IN, 1);
  });

  it('sag curve: parabolic low point', () => {
    // Entry grade -3%, exit grade +3%, PVI at station 200, L=100ft
    const pvi: VerticalPVI = {
      station: 200,
      elevation: 14, // 20 + 200*(-0.03) = 14ft
      exitGrade: 3,
      curveLength: 100,
    };
    // PVC at 150, PVT at 250
    // At PVC: elev from tangent = 20 + 150*(-0.03) = 15.5ft
    const elevPVC = evaluateVerticalAlignment(150, 20, -3, [pvi]);
    approx(elevPVC, 15.5 * FT2IN, 1);

    // At PVT: tangent from PVC = 15.5 + 100*(-0.03) = 12.5
    // correction = (0.03-(-0.03))/(2*100) * 100^2 = 3.0
    // total = 12.5 + 3.0 = 15.5ft
    const elevPVT = evaluateVerticalAlignment(250, 20, -3, [pvi]);
    approx(elevPVT, 15.5 * FT2IN, 1);

    // Midpoint should be lower than endpoints (sag curve)
    const elevMid = evaluateVerticalAlignment(200, 20, -3, [pvi]);
    expect(elevMid).toBeLessThan(elevPVC);
  });

  it('crest curve: parabolic high point', () => {
    // Entry grade +3%, exit grade -3%, PVI at station 200, L=100ft
    const pvi: VerticalPVI = {
      station: 200,
      elevation: 26, // 20 + 200*0.03 = 26ft
      exitGrade: -3,
      curveLength: 100,
    };
    const elevMid = evaluateVerticalAlignment(200, 20, 3, [pvi]);
    const elevPVC = evaluateVerticalAlignment(150, 20, 3, [pvi]);
    // Midpoint should be higher than PVC for crest
    expect(elevMid).toBeGreaterThan(elevPVC);
  });

  it('two consecutive PVIs', () => {
    const pvis: VerticalPVI[] = [
      { station: 100, elevation: 22, exitGrade: -2, curveLength: 0 },
      { station: 300, elevation: 18, exitGrade: 1, curveLength: 0 },
    ];
    // After both PVIs: exit grade = +1%
    const elev = evaluateVerticalAlignment(400, 20, 2, pvis);
    // At station 300: elev=18ft, grade=+1%, dist=100 → 18+1=19ft
    expect(elev).toBeCloseTo(19 * FT2IN, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. COMBINED ALIGNMENT
// ═══════════════════════════════════════════════════════════════════════

describe('evaluateAlignment', () => {
  it('default alignment at station 0 returns origin', () => {
    const p = evaluateAlignment(0, DEFAULT_ALIGNMENT);
    expect(p.x).toBeCloseTo(0, 1);
    expect(p.y).toBeCloseTo(0, 1);
    expect(p.z).toBeCloseTo(0, 1);
    expect(p.bearing).toBeCloseTo(0, 5);
  });

  it('straight alignment matches linear coords', () => {
    const alignment: AlignmentParams = {
      ...DEFAULT_ALIGNMENT,
      refElevation: 20,
      entryGrade: 2,
    };
    const p = evaluateAlignment(100, alignment);
    expect(p.x).toBeCloseTo(100 * FT2IN, 0);
    expect(p.z).toBeCloseTo(0, 0);
    expect(p.y).toBeCloseTo(22 * FT2IN, 1);
  });

  it('combined horizontal + vertical produces 3D curve', () => {
    const alignment: AlignmentParams = {
      refElevation: 20,
      entryBearing: 0,
      entryGrade: 2,
      horizontalPIs: [{ station: 50, deflectionAngle: 30, radius: 1000, direction: 'R' }],
      verticalPVIs: [{ station: 200, elevation: 24, exitGrade: -1, curveLength: 0 }],
      chordsPerSpan: 1,
    };
    const p = evaluateAlignment(300, alignment);
    // Should have non-zero Z (horizontal curve) and declining elevation
    expect(p.z).not.toBeCloseTo(0, 0);
    expect(p.bearing).not.toBeCloseTo(0, 3);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. TRANSVERSE OFFSET
// ═══════════════════════════════════════════════════════════════════════

describe('applyTransverseOffset', () => {
  it('zero offset returns same point', () => {
    const result = applyTransverseOffset({ x: 100, z: 200, bearing: 0 }, 0);
    expect(result.x).toBeCloseTo(100, 5);
    expect(result.z).toBeCloseTo(200, 5);
  });

  it('positive offset at bearing=0 shifts +Z', () => {
    const result = applyTransverseOffset({ x: 100, z: 0, bearing: 0 }, 48);
    expect(result.x).toBeCloseTo(100, 1);
    expect(result.z).toBeCloseTo(48, 1);
  });

  it('negative offset at bearing=0 shifts -Z', () => {
    const result = applyTransverseOffset({ x: 100, z: 0, bearing: 0 }, -48);
    expect(result.x).toBeCloseTo(100, 1);
    expect(result.z).toBeCloseTo(-48, 1);
  });

  it('offset at bearing=90° shifts -X', () => {
    // bearing=90° → perpendicular (left) = 180° = -X direction
    const result = applyTransverseOffset({ x: 0, z: 0, bearing: Math.PI / 2 }, 48);
    expect(result.x).toBeCloseTo(-48, 1);
    expect(result.z).toBeCloseTo(0, 0);
  });

  it('offset at 45° bearing shifts diagonally', () => {
    const bearing = Math.PI / 4; // 45°
    const result = applyTransverseOffset({ x: 0, z: 0, bearing }, 100);
    // Perp to 45° is 135°: cos(135°)=-√2/2, sin(135°)=√2/2
    const expected = 100 * Math.SQRT1_2;
    expect(result.x).toBeCloseTo(-expected, 1);
    expect(result.z).toBeCloseTo(expected, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. SPAN STATIONS
// ═══════════════════════════════════════════════════════════════════════

describe('spanStations', () => {
  it('chordsPerSpan=1 returns empty array', () => {
    expect(spanStations(0, 100, 1)).toEqual([]);
  });

  it('chordsPerSpan=2 returns midpoint', () => {
    const s = spanStations(0, 100, 2);
    expect(s).toHaveLength(1);
    expect(s[0]).toBeCloseTo(50, 5);
  });

  it('chordsPerSpan=5 returns 4 interior points', () => {
    const s = spanStations(100, 200, 5);
    expect(s).toHaveLength(4);
    expect(s[0]).toBeCloseTo(120, 5);
    expect(s[1]).toBeCloseTo(140, 5);
    expect(s[2]).toBeCloseTo(160, 5);
    expect(s[3]).toBeCloseTo(180, 5);
  });

  it('works with non-zero start station', () => {
    const s = spanStations(50, 150, 4);
    expect(s).toHaveLength(3);
    expect(s[0]).toBeCloseTo(75, 5);
    expect(s[1]).toBeCloseTo(100, 5);
    expect(s[2]).toBeCloseTo(125, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. EDGE CASES & CONTINUITY
// ═══════════════════════════════════════════════════════════════════════

describe('edge cases', () => {
  it('negative station returns extrapolation behind start', () => {
    const p = evaluateHorizontalAlignment(-10, 0, []);
    expect(p.x).toBeCloseTo(-10 * FT2IN, 0);
  });

  it('very small deflection angle produces minimal offset', () => {
    const pi: HorizontalPI = { station: 0, deflectionAngle: 0.1, radius: 10000, direction: 'R' };
    const arcLen = 10000 * 0.1 * DEG2RAD;
    const p = evaluateHorizontalAlignment(arcLen + 10, 0, [pi]);
    // Z offset should be very small
    expect(Math.abs(p.z)).toBeLessThan(5 * FT2IN);
  });

  it('PC/PT transition is continuous', () => {
    const R = 1000;
    const delta = 30;
    const pi: HorizontalPI = { station: 100, deflectionAngle: delta, radius: R, direction: 'R' };
    const arcLen = R * delta * DEG2RAD;
    const eps = 0.001; // ft

    // Just before and just after PC
    const beforePC = evaluateHorizontalAlignment(100 - eps, 0, [pi]);
    const afterPC = evaluateHorizontalAlignment(100 + eps, 0, [pi]);
    expect(Math.abs(beforePC.x - afterPC.x)).toBeLessThan(1); // inches
    expect(Math.abs(beforePC.z - afterPC.z)).toBeLessThan(1);

    // Just before and just after PT
    const ptStation = 100 + arcLen;
    const beforePT = evaluateHorizontalAlignment(ptStation - eps, 0, [pi]);
    const afterPT = evaluateHorizontalAlignment(ptStation + eps, 0, [pi]);
    expect(Math.abs(beforePT.x - afterPT.x)).toBeLessThan(1);
    expect(Math.abs(beforePT.z - afterPT.z)).toBeLessThan(1);
  });

  it('vertical PVC/PVT transition is continuous', () => {
    const pvi: VerticalPVI = {
      station: 200,
      elevation: 26,
      exitGrade: -3,
      curveLength: 100,
    };
    const eps = 0.001;

    // PVC = 150, PVT = 250
    const beforePVC = evaluateVerticalAlignment(150 - eps, 20, 3, [pvi]);
    const afterPVC = evaluateVerticalAlignment(150 + eps, 20, 3, [pvi]);
    expect(Math.abs(beforePVC - afterPVC)).toBeLessThan(0.5);

    const beforePVT = evaluateVerticalAlignment(250 - eps, 20, 3, [pvi]);
    const afterPVT = evaluateVerticalAlignment(250 + eps, 20, 3, [pvi]);
    expect(Math.abs(beforePVT - afterPVT)).toBeLessThan(0.5);
  });
});
