import { describe, expect, it } from 'vitest';
import {
  buildHullSurfaceData,
  buildRibbonStripData,
  normalFromPerpDirection,
} from '@/features/viewer-3d/diaphragmGeometry';

describe('diaphragmGeometry', () => {
  it('preserves displaced node elevations for non-collinear diaphragm hulls', () => {
    const mesh = buildHullSurfaceData([
      { x: 0, y: 180, z: 0 },
      { x: 240, y: 192, z: 0 },
      { x: 240, y: 204, z: 240 },
      { x: 0, y: 198, z: 240 },
    ]);

    expect(mesh).not.toBeNull();
    expect(mesh!.outline.map((point) => point.y)).toEqual([180, 192, 204, 198]);
    expect(mesh!.vertices[0]!.y).toBeCloseTo(193.5, 6);
  });

  it('builds a deformed ribbon strip that follows local node elevations', () => {
    const mesh = buildRibbonStripData(
      [
        { x: 0, y: 180, z: 0 },
        { x: 120, y: 186, z: 0 },
        { x: 240, y: 198, z: 0 },
      ],
      12,
      normalFromPerpDirection(2),
    );

    expect(mesh).not.toBeNull();
    expect(mesh!.vertices).toHaveLength(6);
    expect(mesh!.vertices[0]!.y).toBeCloseTo(180, 6);
    expect(mesh!.vertices[2]!.y).toBeCloseTo(186, 6);
    expect(mesh!.vertices[4]!.y).toBeCloseTo(198, 6);
    expect(mesh!.indices).toHaveLength(12);
  });
});
