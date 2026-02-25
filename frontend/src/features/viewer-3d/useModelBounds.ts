/**
 * useModelBounds.ts
 *
 * Computes a bounding box from the currently loaded model's node positions.
 * Returns derived sizing values used by the grid, ground planes, camera,
 * orbit controls, and environment components so the scene adapts dynamically
 * to any model size — from a small 2-story frame to a 20-story tower or
 * 3120" bridge to a 5x5 bay build at 2400" span.
 */

import { useMemo } from 'react';
import { useModelStore } from '../../stores/modelStore';

export interface ModelBounds {
  /** Bounding box min corner [x, y, z] */
  min: [number, number, number];
  /** Bounding box max corner [x, y, z] */
  max: [number, number, number];
  /** Center of bounding box [x, y, z] */
  center: [number, number, number];
  /** Span in each axis [dx, dy, dz] */
  size: [number, number, number];
  /** Largest single axis span */
  maxDimension: number;
  /** Recommended grid extent (covers model + generous padding) */
  gridSize: number;
  /** Recommended grid cell size (fine subdivision) */
  cellSize: number;
  /** Recommended grid section size (major gridlines) */
  sectionSize: number;
  /** Recommended camera far plane */
  cameraFar: number;
  /** Recommended orbit maxDistance */
  orbitMaxDistance: number;
  /** Recommended fog far distance */
  fogFar: number;
  /** Recommended shadow camera extent */
  shadowExtent: number;
}

/** Sensible defaults when no model is loaded (matches original hardcoded values) */
const DEFAULT_BOUNDS: ModelBounds = {
  min: [0, 0, 0],
  max: [576, 432, 0],
  center: [288, 216, 0],
  size: [576, 432, 0],
  maxDimension: 576,
  gridSize: 2000,
  cellSize: 48,
  sectionSize: 288,
  cameraFar: 10000,
  orbitMaxDistance: 5000,
  fogFar: 8000,
  shadowExtent: 1500,
};

/**
 * Rounds `value` up to the nearest multiple of `step`.
 */
function ceilTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

/**
 * Picks a "nice" cell size for the grid based on the model extent.
 * Targets roughly 30-60 cells across the grid for readability.
 */
function pickCellSize(maxDim: number): number {
  if (maxDim <= 300) return 12; // small models: 1ft cells
  if (maxDim <= 800) return 24; // medium: 2ft cells
  if (maxDim <= 1500) return 48; // standard: 4ft cells
  if (maxDim <= 3000) return 96; // large: 8ft cells
  return 120; // very large: 10ft cells
}

/**
 * Picks a "nice" section (major gridline) size.
 * Typically 4-8x the cell size, rounded to common engineering intervals.
 */
function pickSectionSize(maxDim: number): number {
  if (maxDim <= 300) return 120; // 10ft
  if (maxDim <= 800) return 240; // 20ft
  if (maxDim <= 1500) return 288; // 24ft
  if (maxDim <= 3000) return 480; // 40ft
  return 600; // 50ft
}

export function useModelBounds(): ModelBounds {
  const nodes = useModelStore((state) => state.nodes);

  return useMemo(() => {
    if (nodes.size === 0) return DEFAULT_BOUNDS;

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    for (const node of nodes.values()) {
      if (node.x < minX) minX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.z < minZ) minZ = node.z;
      if (node.x > maxX) maxX = node.x;
      if (node.y > maxY) maxY = node.y;
      if (node.z > maxZ) maxZ = node.z;
    }

    const dx = maxX - minX;
    const dy = maxY - minY;
    const dz = maxZ - minZ;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;

    // The largest single axis span (at least 100 to avoid degenerate sizing)
    const maxDimension = Math.max(dx, dy, dz, 100);

    // Grid extends 2x-3x beyond the model for generous padding, rounded up
    const gridSize = ceilTo(maxDimension * 3, 100);

    const cellSize = pickCellSize(maxDimension);
    const sectionSize = pickSectionSize(maxDimension);

    // Camera / controls / fog scale with model size
    const cameraFar = Math.max(gridSize * 5, 10000);
    const orbitMaxDistance = Math.max(gridSize * 2.5, 5000);
    const fogFar = Math.max(gridSize * 3, 8000);
    const shadowExtent = Math.max(gridSize * 0.8, 1500);

    return {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      center: [cx, cy, cz],
      size: [dx, dy, dz],
      maxDimension,
      gridSize,
      cellSize,
      sectionSize,
      cameraFar,
      orbitMaxDistance,
      fogFar,
      shadowExtent,
    };
  }, [nodes]);
}
