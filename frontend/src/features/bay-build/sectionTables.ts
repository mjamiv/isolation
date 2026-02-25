// ── Section lookup tables for steel W-shapes and concrete rectangles ──
// All properties in kip-in units (in, in^2, in^4, in^3).

/** Shape data matching the Section interface fields (minus id/name). */
export interface SteelSectionData {
  name: string;
  area: number;
  Ix: number;
  Iy: number;
  Zx: number;
  d: number;
  bf: number;
  tw: number;
  tf: number;
}

// ── Steel Column Sections (W14 family, keyed by max stories-below) ───

const STEEL_COLUMN_TIERS: readonly { maxBelow: number; data: SteelSectionData }[] = [
  {
    maxBelow: 2,
    data: {
      name: 'W14x90',
      area: 26.5,
      Ix: 999,
      Iy: 362,
      Zx: 136,
      d: 14.02,
      bf: 14.74,
      tw: 0.44,
      tf: 0.71,
    },
  },
  {
    maxBelow: 4,
    data: {
      name: 'W14x132',
      area: 38.8,
      Ix: 1530,
      Iy: 548,
      Zx: 209,
      d: 14.66,
      bf: 14.73,
      tw: 0.645,
      tf: 1.03,
    },
  },
  {
    maxBelow: 6,
    data: {
      name: 'W14x176',
      area: 51.8,
      Ix: 2140,
      Iy: 838,
      Zx: 281,
      d: 15.22,
      bf: 15.65,
      tw: 0.83,
      tf: 1.31,
    },
  },
  {
    maxBelow: 8,
    data: {
      name: 'W14x257',
      area: 75.6,
      Ix: 3400,
      Iy: 1290,
      Zx: 415,
      d: 16.38,
      bf: 15.995,
      tw: 1.175,
      tf: 1.89,
    },
  },
  {
    maxBelow: 10,
    data: {
      name: 'W14x370',
      area: 109,
      Ix: 5440,
      Iy: 1990,
      Zx: 607,
      d: 17.92,
      bf: 16.475,
      tw: 1.655,
      tf: 2.66,
    },
  },
];

// ── Steel Beam Sections (keyed by max span in feet) ──────────────────

const STEEL_BEAM_TIERS: readonly { maxSpanFt: number; data: SteelSectionData }[] = [
  {
    maxSpanFt: 20,
    data: {
      name: 'W18x50',
      area: 14.7,
      Ix: 800,
      Iy: 40.1,
      Zx: 101,
      d: 17.99,
      bf: 7.495,
      tw: 0.355,
      tf: 0.57,
    },
  },
  {
    maxSpanFt: 25,
    data: {
      name: 'W21x62',
      area: 18.3,
      Ix: 1330,
      Iy: 57.5,
      Zx: 144,
      d: 20.99,
      bf: 8.24,
      tw: 0.4,
      tf: 0.615,
    },
  },
  {
    maxSpanFt: 30,
    data: {
      name: 'W24x84',
      area: 24.7,
      Ix: 2370,
      Iy: 94.4,
      Zx: 224,
      d: 24.1,
      bf: 9.02,
      tw: 0.47,
      tf: 0.77,
    },
  },
  {
    maxSpanFt: 35,
    data: {
      name: 'W27x94',
      area: 27.7,
      Ix: 3270,
      Iy: 124,
      Zx: 278,
      d: 26.92,
      bf: 9.99,
      tw: 0.49,
      tf: 0.745,
    },
  },
  {
    maxSpanFt: 40,
    data: {
      name: 'W30x116',
      area: 34.2,
      Ix: 4930,
      Iy: 164,
      Zx: 378,
      d: 30.01,
      bf: 10.495,
      tw: 0.565,
      tf: 0.85,
    },
  },
];

// ── Concrete Column Sections (square, keyed by max stories-below) ────

const CONCRETE_COLUMN_TIERS: readonly { maxBelow: number; size: number }[] = [
  { maxBelow: 2, size: 16 },
  { maxBelow: 4, size: 20 },
  { maxBelow: 6, size: 24 },
  { maxBelow: 8, size: 28 },
  { maxBelow: 10, size: 32 },
];

// ── Lookup helpers ───────────────────────────────────────────────────

/**
 * Select a W14 column section based on the number of stories
 * remaining below the current story (1-indexed).
 */
export function selectSteelColumnSection(storiesBelow: number): SteelSectionData {
  const clamped = Math.max(1, Math.min(10, storiesBelow));
  for (const tier of STEEL_COLUMN_TIERS) {
    if (clamped <= tier.maxBelow) return tier.data;
  }
  // Fallback to heaviest (should not happen with clamped input)
  return STEEL_COLUMN_TIERS[STEEL_COLUMN_TIERS.length - 1]!.data;
}

/**
 * Select a steel beam section based on span length in feet.
 */
export function selectSteelBeamSection(spanFt: number): SteelSectionData {
  const clamped = Math.max(10, Math.min(40, spanFt));
  for (const tier of STEEL_BEAM_TIERS) {
    if (clamped <= tier.maxSpanFt) return tier.data;
  }
  // Fallback to longest span section
  return STEEL_BEAM_TIERS[STEEL_BEAM_TIERS.length - 1]!.data;
}

/**
 * Compute a square concrete column section for a given number of
 * stories below. Returns the same SteelSectionData shape so sections
 * can be created uniformly.
 */
export function computeConcreteColumnSection(storiesBelow: number): SteelSectionData {
  const clamped = Math.max(1, Math.min(10, storiesBelow));
  let size = CONCRETE_COLUMN_TIERS[0]!.size;
  for (const tier of CONCRETE_COLUMN_TIERS) {
    if (clamped <= tier.maxBelow) {
      size = tier.size;
      break;
    }
  }
  const area = size * size;
  const Ix = (size * Math.pow(size, 3)) / 12;
  const Zx = (size * Math.pow(size, 2)) / 4;
  return {
    name: `${size}x${size} RC Col`,
    area,
    Ix,
    Iy: Ix, // square section
    Zx,
    d: size,
    bf: size,
    tw: size, // solid rectangle convention
    tf: size,
  };
}

/**
 * Compute a rectangular concrete beam section for a given span in feet.
 * Uses span/depth ratio of 16 and width = max(12, depth/2).
 */
export function computeConcreteBeamSection(spanFt: number): SteelSectionData {
  const depthIn = (spanFt * 12) / 16;
  const widthIn = Math.max(12, depthIn * 0.5);
  const area = widthIn * depthIn;
  const Ix = (widthIn * Math.pow(depthIn, 3)) / 12;
  const Iy = (depthIn * Math.pow(widthIn, 3)) / 12;
  const Zx = (widthIn * Math.pow(depthIn, 2)) / 4;
  return {
    name: `${Math.round(widthIn)}x${Math.round(depthIn)} RC Beam`,
    area,
    Ix,
    Iy,
    Zx,
    d: depthIn,
    bf: widthIn,
    tw: widthIn, // solid rectangle convention
    tf: depthIn,
  };
}
