import type {
  Node,
  Element,
  Section,
  Material,
  TFPBearing,
  PointLoad,
  GroundMotionRecord,
  RigidDiaphragm,
} from './storeModel';

/** Shape of an importable model JSON file (arrays, not Maps). */
export interface ModelJSON {
  modelInfo: {
    name: string;
    units: string;
    description: string;
  };
  nodes: Node[];
  elements: Element[];
  sections: Section[];
  materials: Material[];
  bearings: TFPBearing[];
  loads: PointLoad[];
  groundMotions: GroundMotionRecord[];
  diaphragms?: RigidDiaphragm[];
}

export interface PresetModel {
  label: string;
  url: string;
}

export const PRESET_MODELS: PresetModel[] = [
  { label: '20-Story Tower (Fixed)', url: '/models/twenty-story.json' },
  { label: '20-Story Tower (Isolated)', url: '/models/twenty-story-isolated.json' },
  { label: '2-Story 2x2 (Fixed)', url: '/models/two-story-2x2-fixed.json' },
  { label: '2-Story 2x2 (Isolated)', url: '/models/two-story-2x2-isolated.json' },
];
