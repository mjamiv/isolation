import { describe, it, expect } from 'vitest';
import type { TimeStep } from '@/types/analysis';
import {
  computeTfpStageOffsets,
  extractPlanDisplacement,
  extractOrbitPoints,
} from '@/features/viewer-3d/tfpKinematics';

function makeStep(nodeI: [number, number, number], nodeJ: [number, number, number]): TimeStep {
  return {
    step: 0,
    time: 0,
    nodeDisplacements: {
      1: [nodeI[0], nodeI[1], nodeI[2], 0, 0, 0],
      2: [nodeJ[0], nodeJ[1], nodeJ[2], 0, 0, 0],
    },
    elementForces: {},
    bearingResponses: {},
  };
}

describe('tfpKinematics — computeTfpStageOffsets', () => {
  it('returns zero offsets for zero displacement', () => {
    const out = computeTfpStageOffsets(0, 0, [6, 25, 6]);
    expect(out.slider1).toEqual([0, 0]);
    expect(out.slider2).toEqual([0, 0]);
    expect(out.slider3).toEqual([0, 0]);
    expect(out.stageTravel).toEqual([0, 0, 0]);
  });

  it('moves only stage 1 when within first capacity', () => {
    const out = computeTfpStageOffsets(3, 4, [6, 25, 6]); // |u| = 5
    expect(out.stageTravel).toEqual([5, 0, 0]);
    expect(out.cappedMagnitude).toBeCloseTo(5, 6);
    expect(out.slider1[0]).toBeCloseTo(3, 6);
    expect(out.slider1[1]).toBeCloseTo(4, 6);
    expect(out.slider2[0]).toBeCloseTo(3, 6);
    expect(out.slider3[1]).toBeCloseTo(4, 6);
  });

  it('progresses sequentially into stages 2 and 3', () => {
    const out = computeTfpStageOffsets(20, 0, [6, 10, 6]);
    expect(out.stageTravel).toEqual([6, 10, 4]);
    expect(out.slider1[0]).toBeCloseTo(6, 6);
    expect(out.slider2[0]).toBeCloseTo(16, 6);
    expect(out.slider3[0]).toBeCloseTo(20, 6);
  });

  it('caps travel at total staged capacity', () => {
    const out = computeTfpStageOffsets(50, 0, [6, 10, 6]); // capacity sum = 22
    expect(out.stageTravel).toEqual([6, 10, 6]);
    expect(out.cappedMagnitude).toBeCloseTo(22, 6);
    expect(out.slider3[0]).toBeCloseTo(22, 6);
  });
});

describe('tfpKinematics — extractPlanDisplacement', () => {
  it('maps backend dof 1->X and dof 2->Z in frontend plan', () => {
    const step = makeStep([1.5, -0.5, 7], [4.25, 2.0, 9]); // dz uses 2nd component
    const out = extractPlanDisplacement(step, 1, 2);
    expect(out.dx).toBeCloseTo(2.75, 6);
    expect(out.dz).toBeCloseTo(2.5, 6);
    expect(out.magnitude).toBeCloseTo(Math.hypot(2.75, 2.5), 6);
  });

  it('returns zeros when nodeJ displacement is missing', () => {
    const step: TimeStep = {
      step: 0,
      time: 0,
      nodeDisplacements: { 1: [1, 2, 3, 0, 0, 0] },
      elementForces: {},
      bearingResponses: {},
    };
    expect(extractPlanDisplacement(step, 1, 2)).toEqual({ dx: 0, dz: 0, magnitude: 0 });
  });
});

describe('tfpKinematics — extractOrbitPoints', () => {
  it('decimates long records and always includes final point', () => {
    const steps: TimeStep[] = [];
    for (let i = 0; i < 40; i++) {
      steps.push(makeStep([0, 0, 0], [i, i * 0.5, 0]));
    }

    const orbit = extractOrbitPoints(steps, 1, 2, 10);
    expect(orbit.length).toBeLessThanOrEqual(11); // <= maxPoints + final append
    const last = orbit[orbit.length - 1];
    expect(last).toEqual([39, 19.5]);
  });
});
