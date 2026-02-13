import { create } from 'zustand';

// ── Inline types ──────────────────────────────────────────────────────

export type DisplayMode = 'wireframe' | 'extruded' | 'solid';
export type ForceType = 'moment' | 'shear' | 'axial' | 'none';
export type ColorMapType = 'none' | 'demandCapacity' | 'displacement' | 'stress';

interface DisplayState {
  // Rendering
  displayMode: DisplayMode;
  showDeformed: boolean;
  scaleFactor: number;
  showLabels: boolean;
  showGrid: boolean;
  showAxes: boolean;

  // Force diagrams
  showForces: boolean;
  forceType: ForceType;

  // Color mapping
  colorMap: ColorMapType;

  // Selection
  selectedNodeIds: Set<number>;
  selectedElementIds: Set<number>;
  hoveredElementId: number | null;
  hoveredNodeId: number | null;

  // Setters
  setDisplayMode: (mode: DisplayMode) => void;
  setShowDeformed: (show: boolean) => void;
  setScaleFactor: (factor: number) => void;
  setShowLabels: (show: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setShowAxes: (show: boolean) => void;
  setShowForces: (show: boolean) => void;
  setForceType: (type: ForceType) => void;
  setColorMap: (map: ColorMapType) => void;

  // Selection actions
  selectNode: (id: number, multi?: boolean) => void;
  selectElement: (id: number, multi?: boolean) => void;
  clearSelection: () => void;
  setHoveredElement: (id: number | null) => void;
  setHoveredNode: (id: number | null) => void;
}

// ── Store implementation ──────────────────────────────────────────────

export const useDisplayStore = create<DisplayState>((set) => ({
  // Default display state
  displayMode: 'wireframe',
  showDeformed: false,
  scaleFactor: 100,
  showLabels: false,
  showGrid: true,
  showAxes: true,
  showForces: false,
  forceType: 'none',
  colorMap: 'none',

  // Default selection state
  selectedNodeIds: new Set(),
  selectedElementIds: new Set(),
  hoveredElementId: null,
  hoveredNodeId: null,

  // ── Display setters ──────────────────────────────
  setDisplayMode: (mode) => set({ displayMode: mode }),
  setShowDeformed: (show) => set({ showDeformed: show }),
  setScaleFactor: (factor) => set({ scaleFactor: factor }),
  setShowLabels: (show) => set({ showLabels: show }),
  setShowGrid: (show) => set({ showGrid: show }),
  setShowAxes: (show) => set({ showAxes: show }),
  setShowForces: (show) => set({ showForces: show }),
  setForceType: (type) => set({ forceType: type }),
  setColorMap: (map) => set({ colorMap: map }),

  // ── Selection actions ────────────────────────────
  selectNode: (id, multi = false) =>
    set((state) => {
      const selectedNodeIds = new Set(multi ? state.selectedNodeIds : []);
      if (selectedNodeIds.has(id)) {
        selectedNodeIds.delete(id);
      } else {
        selectedNodeIds.add(id);
      }
      return { selectedNodeIds };
    }),

  selectElement: (id, multi = false) =>
    set((state) => {
      const selectedElementIds = new Set(multi ? state.selectedElementIds : []);
      if (selectedElementIds.has(id)) {
        selectedElementIds.delete(id);
      } else {
        selectedElementIds.add(id);
      }
      return { selectedElementIds };
    }),

  clearSelection: () =>
    set({
      selectedNodeIds: new Set(),
      selectedElementIds: new Set(),
    }),

  setHoveredElement: (id) => set({ hoveredElementId: id }),
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
}));
