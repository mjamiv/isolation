import { create } from 'zustand';

// ── Inline types ──────────────────────────────────────────────────────

export type DisplayMode = 'wireframe' | 'extruded' | 'solid';
export type ForceType = 'moment' | 'shear' | 'axial' | 'none';
export type ColorMapType = 'none' | 'demandCapacity' | 'displacement' | 'stress';
export type EnvironmentPreset = 'studio' | 'outdoor' | 'dark' | 'blueprint';

interface DisplayState {
  // Scene environment
  environment: EnvironmentPreset;

  // Rendering
  displayMode: DisplayMode;
  showDeformed: boolean;
  hideUndeformed: boolean;
  scaleFactor: number;
  showLabels: boolean;
  showGrid: boolean;
  showAxes: boolean;
  showMassLabels: boolean;
  showStiffnessLabels: boolean;
  showDiaphragms: boolean;

  // Force diagrams
  showForces: boolean;
  forceType: ForceType;
  forceScale: number;

  // Color mapping
  colorMap: ColorMapType;

  // Results overlays
  showBearingDisplacement: boolean;

  // Comparison overlay
  showComparisonOverlay: boolean;

  // Selection
  selectedNodeIds: Set<number>;
  selectedElementIds: Set<number>;
  selectedBearingIds: Set<number>;
  hoveredElementId: number | null;
  hoveredNodeId: number | null;
  hoveredBearingId: number | null;

  // Setters
  setEnvironment: (preset: EnvironmentPreset) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  setShowDeformed: (show: boolean) => void;
  setHideUndeformed: (hide: boolean) => void;
  setScaleFactor: (factor: number) => void;
  setShowLabels: (show: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setShowAxes: (show: boolean) => void;
  setShowMassLabels: (show: boolean) => void;
  setShowStiffnessLabels: (show: boolean) => void;
  setShowDiaphragms: (show: boolean) => void;
  setShowForces: (show: boolean) => void;
  setForceType: (type: ForceType) => void;
  setForceScale: (scale: number) => void;
  setColorMap: (map: ColorMapType) => void;
  setShowBearingDisplacement: (show: boolean) => void;
  setShowComparisonOverlay: (show: boolean) => void;

  // Selection actions
  selectNode: (id: number, multi?: boolean) => void;
  selectElement: (id: number, multi?: boolean) => void;
  selectBearing: (id: number, multi?: boolean) => void;
  clearSelection: () => void;
  setHoveredElement: (id: number | null) => void;
  setHoveredNode: (id: number | null) => void;
  setHoveredBearing: (id: number | null) => void;
}

// ── Store implementation ──────────────────────────────────────────────

export const useDisplayStore = create<DisplayState>((set) => ({
  // Default scene state
  environment: 'studio',

  // Default display state
  displayMode: 'wireframe',
  showDeformed: false,
  hideUndeformed: false,
  scaleFactor: 100,
  showLabels: false,
  showGrid: true,
  showAxes: true,
  showMassLabels: false,
  showStiffnessLabels: false,
  showDiaphragms: true,
  showForces: false,
  forceType: 'none',
  forceScale: 1,
  colorMap: 'none',

  // Default results overlay state
  showBearingDisplacement: false,

  // Default comparison state
  showComparisonOverlay: false,

  // Default selection state
  selectedNodeIds: new Set(),
  selectedElementIds: new Set(),
  selectedBearingIds: new Set(),
  hoveredElementId: null,
  hoveredNodeId: null,
  hoveredBearingId: null,

  // ── Scene setters ─────────────────────────────────
  setEnvironment: (preset) => set({ environment: preset }),

  // ── Display setters ──────────────────────────────
  setDisplayMode: (mode) => set({ displayMode: mode }),
  setShowDeformed: (show) => set({ showDeformed: show }),
  setHideUndeformed: (hide) => set({ hideUndeformed: hide }),
  setScaleFactor: (factor) => set({ scaleFactor: factor }),
  setShowLabels: (show) => set({ showLabels: show }),
  setShowGrid: (show) => set({ showGrid: show }),
  setShowAxes: (show) => set({ showAxes: show }),
  setShowMassLabels: (show) => set({ showMassLabels: show }),
  setShowStiffnessLabels: (show) => set({ showStiffnessLabels: show }),
  setShowDiaphragms: (show) => set({ showDiaphragms: show }),
  setShowForces: (show) => set({ showForces: show }),
  setForceType: (type) => set({ forceType: type }),
  setForceScale: (scale) => set({ forceScale: scale }),
  setColorMap: (map) => set({ colorMap: map }),
  setShowBearingDisplacement: (show) => set({ showBearingDisplacement: show }),
  setShowComparisonOverlay: (show) => set({ showComparisonOverlay: show }),

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

  selectBearing: (id, multi = false) =>
    set((state) => {
      const selectedBearingIds = new Set(multi ? state.selectedBearingIds : []);
      if (selectedBearingIds.has(id)) {
        selectedBearingIds.delete(id);
      } else {
        selectedBearingIds.add(id);
      }
      return { selectedBearingIds };
    }),

  clearSelection: () =>
    set({
      selectedNodeIds: new Set(),
      selectedElementIds: new Set(),
      selectedBearingIds: new Set(),
    }),

  setHoveredElement: (id) => set({ hoveredElementId: id }),
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setHoveredBearing: (id) => set({ hoveredBearingId: id }),
}));
