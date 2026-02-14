/**
 * Tests for ground motion generators in the sample model.
 *
 * Verifies array lengths, dt values, and peak acceleration ranges
 * for all 4 built-in ground motion records.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '@/stores/modelStore';

const getState = () => useModelStore.getState();

beforeEach(() => {
  getState().clearModel();
});

describe('modelStore — ground motion generators', () => {
  it('loadSampleModel populates 4 ground motions', () => {
    getState().loadSampleModel();
    expect(getState().groundMotions.size).toBe(4);
  });

  it('El Centro record has correct shape', () => {
    getState().loadSampleModel();
    const gm = getState().groundMotions.get(1)!;
    expect(gm.name).toBe('El Centro 1940 (Approx)');
    expect(gm.dt).toBe(0.02);
    expect(gm.acceleration).toHaveLength(750);
    expect(gm.direction).toBe(1);
    expect(gm.scaleFactor).toBe(1.0);
  });

  it('El Centro peak acceleration is ~0.35g', () => {
    getState().loadSampleModel();
    const gm = getState().groundMotions.get(1)!;
    const peak = Math.max(...gm.acceleration.map(Math.abs));
    expect(peak).toBeCloseTo(0.35, 1);
  });

  it('Near-Fault Pulse record has correct shape', () => {
    getState().loadSampleModel();
    const gm = getState().groundMotions.get(2)!;
    expect(gm.name).toBe('Near-Fault Pulse');
    expect(gm.dt).toBe(0.02);
    expect(gm.acceleration).toHaveLength(400);
  });

  it('Near-Fault Pulse peak acceleration is ~0.5g', () => {
    getState().loadSampleModel();
    const gm = getState().groundMotions.get(2)!;
    const peak = Math.max(...gm.acceleration.map(Math.abs));
    expect(peak).toBeCloseTo(0.5, 1);
  });

  it('Harmonic Sweep record has correct shape', () => {
    getState().loadSampleModel();
    const gm = getState().groundMotions.get(3)!;
    expect(gm.name).toBe('Harmonic Sweep');
    expect(gm.dt).toBe(0.01);
    expect(gm.acceleration).toHaveLength(1200);
  });

  it('Harmonic Sweep peak acceleration is ~0.25g', () => {
    getState().loadSampleModel();
    const gm = getState().groundMotions.get(3)!;
    const peak = Math.max(...gm.acceleration.map(Math.abs));
    expect(peak).toBeCloseTo(0.25, 1);
  });

  it('Long-Duration Subduction record has correct shape', () => {
    getState().loadSampleModel();
    const gm = getState().groundMotions.get(4)!;
    expect(gm.name).toBe('Long-Duration Subduction');
    expect(gm.dt).toBe(0.02);
    expect(gm.acceleration).toHaveLength(1500);
  });

  it('Long-Duration Subduction peak acceleration is ~0.15g', () => {
    getState().loadSampleModel();
    const gm = getState().groundMotions.get(4)!;
    const peak = Math.max(...gm.acceleration.map(Math.abs));
    expect(peak).toBeCloseTo(0.15, 1);
  });

  it('all ground motions have valid number arrays (no NaN)', () => {
    getState().loadSampleModel();
    for (const [, gm] of getState().groundMotions) {
      for (const val of gm.acceleration) {
        expect(Number.isFinite(val)).toBe(true);
      }
    }
  });
});
