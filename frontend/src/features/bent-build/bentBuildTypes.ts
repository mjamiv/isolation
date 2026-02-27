export interface PierSupportConfig {
  type: 'FIX' | 'EXP';
  guided: boolean; // only relevant for EXP — constrains transverse DOF
}

export interface DeadLoadComponents {
  overlayPsf: number; // default 25
  barrierKlf: number; // default 0.4
  crossFramesPsf: number; // default 5
  utilitiesPsf: number; // default 5
  fwsPsf: number; // default 25
  miscPsf: number; // default 5
}

// ── COGO Alignment Types ─────────────────────────────────────────────

export interface HorizontalPI {
  station: number; // ft — station of PC (point of curvature)
  deflectionAngle: number; // degrees — total deflection through curve
  radius: number; // ft — curve radius
  direction: 'L' | 'R'; // curve turns left or right
}

export interface VerticalPVI {
  station: number; // ft — station of PVI
  elevation: number; // ft — elevation at PVI
  exitGrade: number; // % — grade after this PVI
  curveLength: number; // ft — parabolic curve length (0 = sharp grade break)
}

export interface AlignmentParams {
  refElevation: number; // ft — elevation at station 0
  entryBearing: number; // degrees from +X axis (default 0 = due East)
  entryGrade: number; // % — initial grade
  horizontalPIs: HorizontalPI[];
  verticalPVIs: VerticalPVI[];
  chordsPerSpan: number; // 1 = straight chords (default), 5-10 = smooth curve
}

export const DEFAULT_ALIGNMENT: AlignmentParams = {
  refElevation: 0,
  entryBearing: 0,
  entryGrade: 0,
  horizontalPIs: [],
  verticalPVIs: [],
  chordsPerSpan: 1,
};

// ── Main Params ──────────────────────────────────────────────────────

export interface BentBuildParams {
  numSpans: number; // 1-8
  spanLengths: number[]; // feet, one per span
  numGirders: number; // 3-10
  girderType: 'steel' | 'concrete';
  roadwayWidth: number; // feet
  overhang: number; // feet (default 3.5)
  numBentColumns: number; // 1-4
  columnHeights: number[]; // feet, one per pier
  supportMode: 'conventional' | 'isolated';
  pierSupports: PierSupportConfig[]; // one per pier (conventional mode)
  isolationLevel: 'bearing' | 'base'; // (isolated mode)
  deadLoads: DeadLoadComponents;
  aashtoLLPercent: number; // 0-100
  slopePercent: number; // -8 to 8, grade slope %
  alignment?: AlignmentParams; // COGO alignment (undefined = straight)
  includeDiaphragms: boolean; // default true — rigid deck diaphragm
}

export const DEFAULT_DEAD_LOADS: DeadLoadComponents = {
  overlayPsf: 25,
  barrierKlf: 0.4,
  crossFramesPsf: 5,
  utilitiesPsf: 5,
  fwsPsf: 25,
  miscPsf: 5,
};

export const DEFAULT_BENT_BUILD_PARAMS: BentBuildParams = {
  numSpans: 3,
  spanLengths: [80, 100, 80],
  numGirders: 6,
  girderType: 'steel',
  roadwayWidth: 40,
  overhang: 3.5,
  numBentColumns: 2,
  columnHeights: [20, 20],
  supportMode: 'conventional',
  pierSupports: [
    { type: 'FIX', guided: false },
    { type: 'FIX', guided: false },
  ],
  isolationLevel: 'bearing',
  deadLoads: { ...DEFAULT_DEAD_LOADS },
  aashtoLLPercent: 0,
  slopePercent: 0,
  includeDiaphragms: true,
};
