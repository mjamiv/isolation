import { create } from 'zustand';
import type {
  Node,
  Element,
  Section,
  Material,
  TFPBearing,
  StructuralModel,
} from '@/types/storeModel';

// Re-export types for backward compat
export type { Node, Element, Section, Material, TFPBearing, StructuralModel };

// ── Store interface ───────────────────────────────────────────────────

interface ModelState {
  model: StructuralModel | null;
  nodes: Map<number, Node>;
  elements: Map<number, Element>;
  sections: Map<number, Section>;
  materials: Map<number, Material>;
  bearings: Map<number, TFPBearing>;

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

  // Demo loader
  loadSampleModel: () => void;
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

  // ── Clear ────────────────────────────────────────
  clearModel: () =>
    set({
      model: null,
      nodes: new Map(),
      elements: new Map(),
      sections: new Map(),
      materials: new Map(),
      bearings: new Map(),
    }),

  // ── Sample model loader ──────────────────────────
  loadSampleModel: () => {
    const fixedRestraint: [boolean, boolean, boolean, boolean, boolean, boolean] =
      [true, true, true, true, true, true];
    const freeRestraint: [boolean, boolean, boolean, boolean, boolean, boolean] =
      [false, false, false, false, false, false];

    const nodes = new Map<number, Node>();

    const columnXPositions = [0, 288, 576]; // inches
    const storyHeights = [0, 144, 288, 432]; // inches

    let nodeId = 1;
    for (const y of storyHeights) {
      for (const x of columnXPositions) {
        nodes.set(nodeId, {
          id: nodeId,
          x,
          y,
          z: 0,
          restraint: y === 0 ? fixedRestraint : freeRestraint,
          label: `N${nodeId}`,
        });
        nodeId++;
      }
    }

    const materials = new Map<number, Material>();
    materials.set(1, {
      id: 1,
      name: 'A992 Steel',
      E: 29000,
      Fy: 50,
      density: 490,
      nu: 0.3,
    });

    const sections = new Map<number, Section>();
    sections.set(1, {
      id: 1,
      name: 'W14x68',
      area: 20.0,
      Ix: 723,
      Iy: 121,
      Zx: 115,
      d: 14.04,
      bf: 10.035,
      tw: 0.415,
      tf: 0.720,
    });
    sections.set(2, {
      id: 2,
      name: 'W24x68',
      area: 20.1,
      Ix: 1830,
      Iy: 70.4,
      Zx: 177,
      d: 23.73,
      bf: 8.965,
      tw: 0.415,
      tf: 0.585,
    });

    const elements = new Map<number, Element>();
    let elemId = 1;

    for (let story = 0; story < 3; story++) {
      for (let col = 0; col < 3; col++) {
        const iNode = story * 3 + col + 1;
        const jNode = (story + 1) * 3 + col + 1;
        elements.set(elemId, {
          id: elemId,
          type: 'column',
          nodeI: iNode,
          nodeJ: jNode,
          sectionId: 1,
          materialId: 1,
          label: `COL${elemId}`,
        });
        elemId++;
      }
    }

    for (let floor = 1; floor <= 3; floor++) {
      for (let bay = 0; bay < 2; bay++) {
        const iNode = floor * 3 + bay + 1;
        const jNode = floor * 3 + bay + 2;
        elements.set(elemId, {
          id: elemId,
          type: 'beam',
          nodeI: iNode,
          nodeJ: jNode,
          sectionId: 2,
          materialId: 1,
          label: `BM${elemId}`,
        });
        elemId++;
      }
    }

    set({
      model: {
        name: '3-Story 2-Bay Steel Moment Frame',
        units: 'kip-in',
        description:
          'Sample 3-story, 2-bay steel moment frame with W14x68 columns and W24x68 beams. Fixed base supports.',
      },
      nodes,
      elements,
      sections,
      materials,
      bearings: new Map(),
    });
  },
}));
