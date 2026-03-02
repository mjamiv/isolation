import { create } from 'zustand';
import type {
  Node,
  Element,
  Section,
  Material,
  TFPBearing,
  FrictionSurface,
  FrictionModelType,
  PointLoad,
  GroundMotionRecord,
  RigidDiaphragm,
  EqualDOFConstraint,
  StructuralModel,
} from '@/types/storeModel';
import type { ModelJSON } from '@/types/modelJSON';
import { generateBayFrame } from '@/features/bay-build/generateBayFrame';
import type { BayBuildParams } from '@/features/bay-build/bayBuildTypes';

// Re-export types for backward compat
export type {
  Node,
  Element,
  Section,
  Material,
  TFPBearing,
  FrictionSurface,
  FrictionModelType,
  PointLoad,
  GroundMotionRecord,
  RigidDiaphragm,
  EqualDOFConstraint,
  StructuralModel,
};

// ── Constants ────────────────────────────────────────────────────────

/** Ground motion record IDs (ordered by increasing peak acceleration) */
const GM_IDS = {
  SERVICEABILITY: 1,
  SUBDUCTION: 2,
  HARMONIC: 3,
  EL_CENTRO: 4,
  NEAR_FAULT: 5,
} as const;

/** Startup default model: bay-build 1x1x1 steel frame with rigid diaphragms. */
const STARTUP_BAY_PARAMS: BayBuildParams = {
  baysX: 1,
  baysZ: 1,
  bayWidthX: 20,
  bayWidthZ: 20,
  stories: 1,
  storyHeight: 15,
  material: 'steel',
  diaphragms: true,
  baseType: 'fixed',
};

const STARTUP_LIVE_LOAD_FACTOR = 0.5;

// ── Ground motion generators ─────────────────────────────────────────

/** Scale factor converting g to in/s^2 for kip-in units. */
const G_TO_IN_S2 = 386.4;

/** Normalize raw acceleration to a target PGA and build a GroundMotionRecord. */
function buildGM(
  id: number,
  name: string,
  dt: number,
  rawAcc: number[],
  targetPGA: number,
): GroundMotionRecord {
  const peak = Math.max(...rawAcc.map(Math.abs));
  const scale = peak > 0 ? targetPGA / peak : 1;
  return {
    id,
    name,
    dt,
    acceleration: rawAcc.map((a) => a * scale),
    direction: 1,
    scaleFactor: G_TO_IN_S2,
  };
}

function generateServiceability(): GroundMotionRecord {
  const dt = 0.02;
  const n = 500; // 10 seconds
  const acc: number[] = [];
  // Frequencies typical of moderate shallow crustal events (2-6 Hz)
  const freqs = [2.0, 3.5, 5.0];
  const amps = [0.04, 0.06, 0.03];
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    // Envelope: quick ramp (0-1s), sustain (1-4s), gradual decay (4-10s)
    let env: number;
    if (t < 1) env = t;
    else if (t < 4) env = 1;
    else env = Math.exp(-0.4 * (t - 4));
    // Multi-frequency synthesis
    let sig = 0;
    for (let f = 0; f < freqs.length; f++) {
      sig += amps[f]! * Math.sin(2 * Math.PI * freqs[f]! * t + f * 1.1);
    }
    acc.push(env * sig);
  }
  return buildGM(GM_IDS.SERVICEABILITY, 'Design 50 (Serviceability)', dt, acc, 0.1);
}

function generateElCentro(): GroundMotionRecord {
  const dt = 0.02;
  const n = 750; // 15 seconds
  const acc: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    // Envelope: ramp up 0-2s, sustain 2-6s, decay 6-15s
    let env: number;
    if (t < 2) env = t / 2;
    else if (t < 6) env = 1;
    else env = Math.exp(-0.3 * (t - 6));
    // Multi-frequency content
    const sig =
      0.18 * Math.sin(2 * Math.PI * 1.5 * t) +
      0.12 * Math.sin(2 * Math.PI * 3.2 * t + 0.7) +
      0.08 * Math.sin(2 * Math.PI * 5.8 * t + 1.3) +
      0.05 * Math.sin(2 * Math.PI * 8.1 * t + 2.1);
    acc.push(env * sig);
  }
  return buildGM(GM_IDS.EL_CENTRO, 'El Centro 1940 (Approx)', dt, acc, 0.35);
}

function generateNearFaultPulse(): GroundMotionRecord {
  const dt = 0.02;
  const n = 400; // 8 seconds
  const acc: number[] = [];
  const tp = 1.5; // pulse period
  const t0 = 2.5; // pulse center time
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    // Gabor wavelet: Gaussian-enveloped cosine
    const tau = (t - t0) / (tp / 2);
    const envelope = Math.exp(-tau * tau);
    acc.push(envelope * Math.cos((2 * Math.PI * t) / tp));
  }
  return buildGM(GM_IDS.NEAR_FAULT, 'Near-Fault Pulse', dt, acc, 0.5);
}

function generateHarmonicSweep(): GroundMotionRecord {
  const dt = 0.01;
  const n = 1200; // 12 seconds
  const acc: number[] = [];
  const f0 = 0.5; // start freq Hz
  const f1 = 10; // end freq Hz
  const dur = n * dt;
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    // Linear chirp: instantaneous freq = f0 + (f1-f0)*t/dur
    const phase = 2 * Math.PI * (f0 * t + (0.5 * (f1 - f0) * t * t) / dur);
    // Trapezoidal envelope
    let env: number;
    if (t < 1) env = t;
    else if (t > dur - 1) env = dur - t;
    else env = 1;
    acc.push(env * Math.sin(phase));
  }
  return buildGM(GM_IDS.HARMONIC, 'Harmonic Sweep', dt, acc, 0.25);
}

function generateLongDurationSubduction(): GroundMotionRecord {
  const dt = 0.02;
  const n = 1500; // 30 seconds
  const acc: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    // Slow envelope: ramp 0-5s, sustain 5-20s, decay 20-30s
    let env: number;
    if (t < 5) env = t / 5;
    else if (t < 20) env = 1;
    else env = Math.exp(-0.2 * (t - 20));
    // Low-frequency dominated content
    const sig =
      0.08 * Math.sin(2 * Math.PI * 0.3 * t) +
      0.06 * Math.sin(2 * Math.PI * 0.7 * t + 0.5) +
      0.04 * Math.sin(2 * Math.PI * 1.2 * t + 1.0) +
      0.03 * Math.sin(2 * Math.PI * 2.0 * t + 1.5);
    acc.push(env * sig);
  }
  return buildGM(GM_IDS.SUBDUCTION, 'Long-Duration Subduction', dt, acc, 0.15);
}

// ── Store interface ───────────────────────────────────────────────────

interface ModelState {
  model: StructuralModel | null;
  nodes: Map<number, Node>;
  elements: Map<number, Element>;
  sections: Map<number, Section>;
  materials: Map<number, Material>;
  bearings: Map<number, TFPBearing>;
  diaphragms: Map<number, RigidDiaphragm>;
  equalDofConstraints: Map<number, EqualDOFConstraint>;
  loads: Map<number, PointLoad>;
  groundMotions: Map<number, GroundMotionRecord>;

  // Model actions
  setModel: (model: StructuralModel) => void;

  // Node CRUD
  addNode: (node: Node) => void;
  updateNode: (id: number, updates: Partial<Node>) => void;
  removeNode: (id: number) => void;

  // Element CRUD
  addElement: (element: Element) => void;
  updateElement: (id: number, updates: Partial<Element>) => void;
  removeElement: (id: number) => void;

  // Section CRUD
  addSection: (section: Section) => void;
  updateSection: (id: number, updates: Partial<Section>) => void;
  removeSection: (id: number) => void;

  // Material CRUD
  addMaterial: (material: Material) => void;
  updateMaterial: (id: number, updates: Partial<Material>) => void;
  removeMaterial: (id: number) => void;

  // Bearing CRUD
  addBearing: (bearing: TFPBearing) => void;
  updateBearing: (id: number, updates: Partial<TFPBearing>) => void;
  removeBearing: (id: number) => void;

  // Diaphragm CRUD
  addDiaphragm: (diaphragm: RigidDiaphragm) => void;
  updateDiaphragm: (id: number, updates: Partial<RigidDiaphragm>) => void;
  removeDiaphragm: (id: number) => void;

  // EqualDOF CRUD
  addEqualDofConstraint: (constraint: EqualDOFConstraint) => void;
  updateEqualDofConstraint: (id: number, updates: Partial<EqualDOFConstraint>) => void;
  removeEqualDofConstraint: (id: number) => void;

  // Load CRUD
  addLoad: (load: PointLoad) => void;
  updateLoad: (id: number, updates: Partial<PointLoad>) => void;
  removeLoad: (id: number) => void;

  // Ground Motion CRUD
  addGroundMotion: (gm: GroundMotionRecord) => void;
  updateGroundMotion: (id: number, updates: Partial<GroundMotionRecord>) => void;
  removeGroundMotion: (id: number) => void;

  // Model loaders
  loadSampleModel: () => void;
  loadModelFromJSON: (json: ModelJSON) => void;
  clearModel: () => void;
}

// ── Store implementation ──────────────────────────────────────────────

export const useModelStore = create<ModelState>((set) => ({
  model: null,
  nodes: new Map(),
  elements: new Map(),
  sections: new Map(),
  materials: new Map(),
  bearings: new Map(),
  diaphragms: new Map(),
  equalDofConstraints: new Map(),
  loads: new Map(),
  groundMotions: new Map(),

  // ── Model ────────────────────────────────────────
  setModel: (model) => set({ model }),

  // ── Node CRUD ────────────────────────────────────
  addNode: (node) =>
    set((state) => {
      const nodes = new Map(state.nodes);
      nodes.set(node.id, node);
      return { nodes };
    }),

  updateNode: (id, updates) =>
    set((state) => {
      const nodes = new Map(state.nodes);
      const existing = nodes.get(id);
      if (existing) {
        nodes.set(id, { ...existing, ...updates });
      }
      return { nodes };
    }),

  removeNode: (id) =>
    set((state) => {
      const nodes = new Map(state.nodes);
      nodes.delete(id);
      return { nodes };
    }),

  // ── Element CRUD ─────────────────────────────────
  addElement: (element) =>
    set((state) => {
      const elements = new Map(state.elements);
      elements.set(element.id, element);
      return { elements };
    }),

  updateElement: (id, updates) =>
    set((state) => {
      const elements = new Map(state.elements);
      const existing = elements.get(id);
      if (existing) {
        elements.set(id, { ...existing, ...updates });
      }
      return { elements };
    }),

  removeElement: (id) =>
    set((state) => {
      const elements = new Map(state.elements);
      elements.delete(id);
      return { elements };
    }),

  // ── Section CRUD ─────────────────────────────────
  addSection: (section) =>
    set((state) => {
      const sections = new Map(state.sections);
      sections.set(section.id, section);
      return { sections };
    }),

  updateSection: (id, updates) =>
    set((state) => {
      const sections = new Map(state.sections);
      const existing = sections.get(id);
      if (existing) {
        sections.set(id, { ...existing, ...updates });
      }
      return { sections };
    }),

  removeSection: (id) =>
    set((state) => {
      const sections = new Map(state.sections);
      sections.delete(id);
      return { sections };
    }),

  // ── Material CRUD ────────────────────────────────
  addMaterial: (material) =>
    set((state) => {
      const materials = new Map(state.materials);
      materials.set(material.id, material);
      return { materials };
    }),

  updateMaterial: (id, updates) =>
    set((state) => {
      const materials = new Map(state.materials);
      const existing = materials.get(id);
      if (existing) {
        materials.set(id, { ...existing, ...updates });
      }
      return { materials };
    }),

  removeMaterial: (id) =>
    set((state) => {
      const materials = new Map(state.materials);
      materials.delete(id);
      return { materials };
    }),

  // ── Bearing CRUD ─────────────────────────────────
  addBearing: (bearing) =>
    set((state) => {
      const bearings = new Map(state.bearings);
      bearings.set(bearing.id, bearing);
      return { bearings };
    }),

  updateBearing: (id, updates) =>
    set((state) => {
      const bearings = new Map(state.bearings);
      const existing = bearings.get(id);
      if (existing) {
        bearings.set(id, { ...existing, ...updates });
      }
      return { bearings };
    }),

  removeBearing: (id) =>
    set((state) => {
      const bearings = new Map(state.bearings);
      bearings.delete(id);
      return { bearings };
    }),

  // ── Diaphragm CRUD ────────────────────────────────
  addDiaphragm: (diaphragm) =>
    set((state) => {
      const diaphragms = new Map(state.diaphragms);
      diaphragms.set(diaphragm.id, diaphragm);
      return { diaphragms };
    }),

  updateDiaphragm: (id, updates) =>
    set((state) => {
      const diaphragms = new Map(state.diaphragms);
      const existing = diaphragms.get(id);
      if (existing) {
        diaphragms.set(id, { ...existing, ...updates });
      }
      return { diaphragms };
    }),

  removeDiaphragm: (id) =>
    set((state) => {
      const diaphragms = new Map(state.diaphragms);
      diaphragms.delete(id);
      return { diaphragms };
    }),

  // ── EqualDOF CRUD ────────────────────────────────
  addEqualDofConstraint: (constraint) =>
    set((state) => {
      const equalDofConstraints = new Map(state.equalDofConstraints);
      equalDofConstraints.set(constraint.id, constraint);
      return { equalDofConstraints };
    }),

  updateEqualDofConstraint: (id, updates) =>
    set((state) => {
      const equalDofConstraints = new Map(state.equalDofConstraints);
      const existing = equalDofConstraints.get(id);
      if (existing) {
        equalDofConstraints.set(id, { ...existing, ...updates });
      }
      return { equalDofConstraints };
    }),

  removeEqualDofConstraint: (id) =>
    set((state) => {
      const equalDofConstraints = new Map(state.equalDofConstraints);
      equalDofConstraints.delete(id);
      return { equalDofConstraints };
    }),

  // ── Load CRUD ─────────────────────────────────
  addLoad: (load) =>
    set((state) => {
      const loads = new Map(state.loads);
      loads.set(load.id, load);
      return { loads };
    }),

  updateLoad: (id, updates) =>
    set((state) => {
      const loads = new Map(state.loads);
      const existing = loads.get(id);
      if (existing) {
        loads.set(id, { ...existing, ...updates });
      }
      return { loads };
    }),

  removeLoad: (id) =>
    set((state) => {
      const loads = new Map(state.loads);
      loads.delete(id);
      return { loads };
    }),

  // ── Ground Motion CRUD ────────────────────────
  addGroundMotion: (gm) =>
    set((state) => {
      const groundMotions = new Map(state.groundMotions);
      groundMotions.set(gm.id, gm);
      return { groundMotions };
    }),

  updateGroundMotion: (id, updates) =>
    set((state) => {
      const groundMotions = new Map(state.groundMotions);
      const existing = groundMotions.get(id);
      if (existing) {
        groundMotions.set(id, { ...existing, ...updates });
      }
      return { groundMotions };
    }),

  removeGroundMotion: (id) =>
    set((state) => {
      const groundMotions = new Map(state.groundMotions);
      groundMotions.delete(id);
      return { groundMotions };
    }),

  // ── Load from JSON ──────────────────────────────
  loadModelFromJSON: (json: ModelJSON) => {
    const toMap = <T extends { id: number }>(arr: T[]): Map<number, T> =>
      new Map(arr.map((item) => [item.id, item]));

    // Generate default ground motions if the JSON has none
    const gmMap: Map<number, GroundMotionRecord> =
      json.groundMotions.length > 0
        ? toMap(json.groundMotions)
        : new Map<number, GroundMotionRecord>([
            [GM_IDS.SERVICEABILITY, generateServiceability()],
            [GM_IDS.SUBDUCTION, generateLongDurationSubduction()],
            [GM_IDS.HARMONIC, generateHarmonicSweep()],
            [GM_IDS.EL_CENTRO, generateElCentro()],
            [GM_IDS.NEAR_FAULT, generateNearFaultPulse()],
          ]);

    set({
      model: {
        name: json.modelInfo.name,
        units: json.modelInfo.units,
        description: json.modelInfo.description,
      },
      nodes: toMap(json.nodes),
      elements: toMap(json.elements),
      sections: toMap(json.sections),
      materials: toMap(json.materials),
      bearings: toMap(json.bearings),
      diaphragms: json.diaphragms ? toMap(json.diaphragms) : new Map(),
      equalDofConstraints: json.equalDofConstraints ? toMap(json.equalDofConstraints) : new Map(),
      loads: toMap(json.loads),
      groundMotions: gmMap,
    });
  },

  // ── Clear ────────────────────────────────────────
  clearModel: () =>
    set({
      model: null,
      nodes: new Map(),
      elements: new Map(),
      sections: new Map(),
      materials: new Map(),
      bearings: new Map(),
      diaphragms: new Map(),
      equalDofConstraints: new Map(),
      loads: new Map(),
      groundMotions: new Map(),
    }),

  // ── Sample model loader ──────────────────────────
  loadSampleModel: () => {
    const startup = generateBayFrame(STARTUP_BAY_PARAMS);
    startup.modelInfo = {
      ...startup.modelInfo,
      name: 'Bay Build: 1x1x1 Steel (Fixed, 50% LL)',
      description:
        'Startup bay-build model: 1x1x1 steel frame with rigid diaphragms, fixed base, and 50% live load.',
    };

    // Startup scenario uses reduced live-load participation (50% LL).
    startup.loads = startup.loads.map((load) => ({
      ...load,
      fy: load.fy * STARTUP_LIVE_LOAD_FACTOR,
    }));
    const toMap = <T extends { id: number }>(arr: T[]): Map<number, T> =>
      new Map(arr.map((item) => [item.id, item]));

    set({
      model: {
        name: startup.modelInfo.name,
        units: startup.modelInfo.units,
        description: startup.modelInfo.description,
      },
      nodes: toMap(startup.nodes),
      elements: toMap(startup.elements),
      sections: toMap(startup.sections),
      materials: toMap(startup.materials),
      bearings: toMap(startup.bearings),
      diaphragms: startup.diaphragms ? toMap(startup.diaphragms) : new Map(),
      equalDofConstraints: startup.equalDofConstraints
        ? toMap(startup.equalDofConstraints)
        : new Map(),
      loads: toMap(startup.loads),
      groundMotions: new Map<number, GroundMotionRecord>([
        [GM_IDS.SERVICEABILITY, generateServiceability()],
        [GM_IDS.SUBDUCTION, generateLongDurationSubduction()],
        [GM_IDS.HARMONIC, generateHarmonicSweep()],
        [GM_IDS.EL_CENTRO, generateElCentro()],
        [GM_IDS.NEAR_FAULT, generateNearFaultPulse()],
      ]),
    });
  },
}));
