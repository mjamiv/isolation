import type {
  Node,
  Element,
  Section,
  Material,
  TFPBearing,
  PointLoad,
  GroundMotionRecord,
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
}

export interface PresetModel {
  label: string;
  /** URL to fetch, or null for the built-in sample model. */
  url: string | null;
}

export const PRESET_MODELS: PresetModel[] = [
  { label: '3-Story Hospital Frame', url: null },
  { label: '20-Story Steel Tower', url: '/models/twenty-story.json' },
  { label: 'IBR Alt A: Ductile Bridge', url: '/models/alt-a-ductile.json' },
  { label: 'IBR Alt B: TFP Isolated', url: '/models/alt-b-isolated.json' },
  { label: 'IBR Alt C: Extradosed + TFP', url: '/models/alt-c-extradosed.json' },
  { label: '2-Story 2x2-Bay (Fixed)', url: '/models/two-story-2x2-fixed.json' },
  { label: '2-Story 2x2-Bay (Isolated)', url: '/models/two-story-2x2-isolated.json' },
  { label: '5-Story Office (Fixed)', url: '/models/five-story-office-fixed.json' },
  { label: '5-Story Office (Isolated)', url: '/models/five-story-office-isolated.json' },
];
