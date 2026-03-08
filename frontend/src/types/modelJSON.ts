import type {
  Node,
  Element,
  Section,
  Material,
  TFPBearing,
  PointLoad,
  GroundMotionRecord,
  RigidDiaphragm,
  EqualDOFConstraint,
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
  equalDofConstraints?: EqualDOFConstraint[];
}

export interface UrlPresetModel {
  label: string;
  kind: 'url';
  url: string;
}

export interface StartupPresetModel {
  label: string;
  kind: 'startup';
  presetId:
    | 'theFrameFixed'
    | 'theFrameIsolated'
    | 'longSpanPavilionFixed'
    | 'longSpanPavilionIsolated';
}

export type PresetModel = UrlPresetModel | StartupPresetModel;

export const PRESET_MODELS: PresetModel[] = [
  { label: 'The Frame (Fixed)', kind: 'startup', presetId: 'theFrameFixed' },
  { label: 'The Frame (Isolated)', kind: 'startup', presetId: 'theFrameIsolated' },
  {
    label: 'Long-Span Pavilion (Fixed)',
    kind: 'startup',
    presetId: 'longSpanPavilionFixed',
  },
  {
    label: 'Long-Span Pavilion (Isolated)',
    kind: 'startup',
    presetId: 'longSpanPavilionIsolated',
  },
  { label: '20-Story Tower (Fixed)', kind: 'url', url: '/models/twenty-story.json' },
  { label: '20-Story Tower (Isolated)', kind: 'url', url: '/models/twenty-story-isolated.json' },
  { label: '2-Story 2x2 (Fixed)', kind: 'url', url: '/models/two-story-2x2-fixed.json' },
  { label: '2-Story 2x2 (Isolated)', kind: 'url', url: '/models/two-story-2x2-isolated.json' },
  { label: '3-Span Bridge (Fixed)', kind: 'url', url: '/models/three-span-bridge-fixed.json' },
  {
    label: '3-Span Bridge (Isolated)',
    kind: 'url',
    url: '/models/three-span-bridge-isolated.json',
  },
  {
    label: 'Apple Park (Isolated)',
    kind: 'url',
    url: '/models/apple-park-isolated.json',
  },
  {
    label: 'LA City Hall (Isolated)',
    kind: 'url',
    url: '/models/la-city-hall-isolated.json',
  },
];
