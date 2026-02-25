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
};
