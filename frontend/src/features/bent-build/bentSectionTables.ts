import type { SteelSectionData } from '../bay-build/sectionTables';

// ── Steel Girder Sections (keyed by max span in feet) ──────────────

const STEEL_GIRDER_TIERS: readonly { maxSpanFt: number; data: SteelSectionData }[] = [
  {
    maxSpanFt: 60,
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
  {
    maxSpanFt: 80,
    data: {
      name: 'W36x150',
      area: 44.2,
      Ix: 9040,
      Iy: 270,
      Zx: 581,
      d: 35.85,
      bf: 11.975,
      tw: 0.625,
      tf: 0.94,
    },
  },
  {
    maxSpanFt: 100,
    data: {
      name: 'W40x183',
      area: 53.3,
      Ix: 13300,
      Iy: 331,
      Zx: 774,
      d: 39.74,
      bf: 11.81,
      tw: 0.65,
      tf: 1.07,
    },
  },
  {
    maxSpanFt: 120,
    data: {
      name: 'W44x230',
      area: 67.8,
      Ix: 20800,
      Iy: 415,
      Zx: 1100,
      d: 42.91,
      bf: 12.765,
      tw: 0.71,
      tf: 1.22,
    },
  },
  {
    maxSpanFt: 150,
    data: {
      name: 'W44x335',
      area: 98.5,
      Ix: 31100,
      Iy: 1200,
      Zx: 1620,
      d: 44.02,
      bf: 15.945,
      tw: 1.025,
      tf: 1.77,
    },
  },
];

// ── AASHTO Concrete I-Girder Sections (Type II-VI by span) ─────────

const AASHTO_GIRDER_TIERS: readonly { maxSpanFt: number; data: SteelSectionData }[] = [
  {
    maxSpanFt: 60,
    data: {
      name: 'AASHTO Type II',
      area: 369.1,
      Ix: 50980,
      Iy: 5333,
      Zx: 2833,
      d: 36,
      bf: 12,
      tw: 6,
      tf: 6,
    },
  },
  {
    maxSpanFt: 80,
    data: {
      name: 'AASHTO Type III',
      area: 560.0,
      Ix: 125390,
      Iy: 6186,
      Zx: 5573,
      d: 45,
      bf: 16,
      tw: 7,
      tf: 7,
    },
  },
  {
    maxSpanFt: 100,
    data: {
      name: 'AASHTO Type IV',
      area: 789.0,
      Ix: 260730,
      Iy: 8091,
      Zx: 9657,
      d: 54,
      bf: 20,
      tw: 8,
      tf: 8,
    },
  },
  {
    maxSpanFt: 120,
    data: {
      name: 'AASHTO Type V',
      area: 1013.0,
      Ix: 521180,
      Iy: 16790,
      Zx: 16545,
      d: 63,
      bf: 42,
      tw: 8,
      tf: 5,
    },
  },
  {
    maxSpanFt: 140,
    data: {
      name: 'AASHTO Type VI',
      area: 1085.0,
      Ix: 733320,
      Iy: 16790,
      Zx: 20370,
      d: 72,
      bf: 42,
      tw: 8,
      tf: 5,
    },
  },
];

// ── Concrete Circular Column Sections (keyed by max height in feet) ──

const CONCRETE_COLUMN_TIERS: readonly {
  maxHeightFt: number;
  diameterIn: number;
}[] = [
  { maxHeightFt: 20, diameterIn: 36 },
  { maxHeightFt: 30, diameterIn: 42 },
  { maxHeightFt: 40, diameterIn: 48 },
  { maxHeightFt: 50, diameterIn: 54 },
  { maxHeightFt: Infinity, diameterIn: 60 },
];

// ── Lookup functions ────────────────────────────────────────────────

export function selectSteelGirderSection(spanFt: number): SteelSectionData {
  for (const tier of STEEL_GIRDER_TIERS) {
    if (spanFt <= tier.maxSpanFt) return tier.data;
  }
  return STEEL_GIRDER_TIERS[STEEL_GIRDER_TIERS.length - 1]!.data;
}

export function selectConcreteGirderSection(spanFt: number): SteelSectionData {
  for (const tier of AASHTO_GIRDER_TIERS) {
    if (spanFt <= tier.maxSpanFt) return tier.data;
  }
  return AASHTO_GIRDER_TIERS[AASHTO_GIRDER_TIERS.length - 1]!.data;
}

export function selectConcreteColumnSection(heightFt: number): SteelSectionData {
  let dia = CONCRETE_COLUMN_TIERS[0]!.diameterIn;
  for (const tier of CONCRETE_COLUMN_TIERS) {
    if (heightFt <= tier.maxHeightFt) {
      dia = tier.diameterIn;
      break;
    }
  }
  const r = dia / 2;
  const area = Math.PI * r * r;
  const I = (Math.PI * Math.pow(dia, 4)) / 64;
  const Zx = (Math.PI * Math.pow(dia, 3)) / 32;
  return {
    name: `${dia}in Circular RC`,
    area,
    Ix: I,
    Iy: I, // circular section
    Zx,
    d: dia,
    bf: dia,
    tw: dia, // solid circle convention
    tf: dia,
  };
}

export function computePierCapSection(spacingIn: number, colDiaIn: number): SteelSectionData {
  const depth = Math.max(36, spacingIn / 3);
  const width = Math.max(36, colDiaIn + 12);
  const area = width * depth;
  const Ix = (width * Math.pow(depth, 3)) / 12;
  const Iy = (depth * Math.pow(width, 3)) / 12;
  const Zx = (width * Math.pow(depth, 2)) / 4;
  return {
    name: `${Math.round(width)}x${Math.round(depth)} RC Cap`,
    area,
    Ix,
    Iy,
    Zx,
    d: depth,
    bf: width,
    tw: width,
    tf: depth,
  };
}
