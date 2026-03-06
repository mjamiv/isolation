import { create } from 'zustand';

// ── Inline types ──────────────────────────────────────────────────────

export type DisplayMode = 'wireframe' | 'extruded' | 'solid';
export type ForceType = 'moment' | 'shear' | 'axial' | 'none';
export type ColorMapType = 'none' | 'demandCapacity' | 'displacement' | 'stress';
export type EnvironmentPreset = 'studio' | 'outdoor' | 'dark' | 'blueprint' | 'lab';
export type CameraViewPreset = 'iso' | 'plan' | 'front' | 'side';

const MIN_BEARING_VERTICAL_SCALE = 0.5;
const MAX_BEARING_VERTICAL_SCALE = 3;

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
  showBaseShearLabels: boolean;
  showDiaphragms: boolean;
  showConstraintLinks: boolean;

  // Force diagrams
  showForces: boolean;
  forceType: ForceType;
  forceScale: number;

  // Color mapping
  colorMap: ColorMapType;

  // Results overlays
  showBearingDisplacement: boolean;
  bearingVerticalScale: number;

  // Comparison overlay
  showComparisonOverlay: boolean;

  // Camera
  cameraView: CameraViewPreset;
  cameraCommandVersion: number;

  // Selection
  selectedNodeIds: Set<number>;
  selectedElementIds: Set<number>;
  selectedBearingIds: Set<number>;
  activeBearingId: number | null;
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
  setShowBaseShearLabels: (show: boolean) => void;
  setShowDiaphragms: (show: boolean) => void;
  setShowConstraintLinks: (show: boolean) => void;
  setShowForces: (show: boolean) => void;
  setForceType: (type: ForceType) => void;
  setForceScale: (scale: number) => void;
  setColorMap: (map: ColorMapType) => void;
  setShowBearingDisplacement: (show: boolean) => void;
  setBearingVerticalScale: (scale: number) => void;
  setShowComparisonOverlay: (show: boolean) => void;
  setCameraView: (view: CameraViewPreset) => void;
  frameCamera: () => void;
  resetCamera: () => void;

  // Selection actions
  selectNode: (id: number, multi?: boolean) => void;
  selectElement: (id: number, multi?: boolean) => void;
  selectBearing: (id: number, multi?: boolean) => void;
  setActiveBearing: (id: number | null) => void;
  clearSelection: () => void;
  setHoveredElement: (id: number | null) => void;
  setHoveredNode: (id: number | null) => void;
  setHoveredBearing: (id: number | null) => void;
}

// ── Store implementation ──────────────────────────────────────────────

export const useDisplayStore = create<DisplayState>((set) => ({
  // Default scene state
  environment: 'lab',

  // Default display state
  displayMode: 'wireframe',
  showDeformed: false,
  hideUndeformed: false,
  scaleFactor: 100,
  showLabels: false,
  showGrid: false,
  showAxes: false,
  showMassLabels: false,
  showStiffnessLabels: false,
  showBaseShearLabels: false,
  showDiaphragms: true,
  showConstraintLinks: false,
  showForces: false,
  forceType: 'none',
  forceScale: 1,
  colorMap: 'none',

  // Default results overlay state
  showBearingDisplacement: false,
  bearingVerticalScale: 1,

  // Default comparison state
  showComparisonOverlay: false,

  // Default camera state
  cameraView: 'iso',
  cameraCommandVersion: 0,

  // Default selection state
  selectedNodeIds: new Set(),
  selectedElementIds: new Set(),
  selectedBearingIds: new Set(),
  activeBearingId: null,
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
  setShowBaseShearLabels: (show) => set({ showBaseShearLabels: show }),
  setShowDiaphragms: (show) => set({ showDiaphragms: show }),
  setShowConstraintLinks: (show) => set({ showConstraintLinks: show }),
  setShowForces: (show) => set({ showForces: show }),
  setForceType: (type) => set({ forceType: type }),
  setForceScale: (scale) => set({ forceScale: scale }),
  setColorMap: (map) => set({ colorMap: map }),
  setShowBearingDisplacement: (show) => set({ showBearingDisplacement: show }),
  setBearingVerticalScale: (scale) =>
    set({
      bearingVerticalScale: Math.min(
        MAX_BEARING_VERTICAL_SCALE,
        Math.max(MIN_BEARING_VERTICAL_SCALE, scale),
      ),
    }),
  setShowComparisonOverlay: (show) => set({ showComparisonOverlay: show }),
  setCameraView: (view) =>
    set((state) => ({
      cameraView: view,
      cameraCommandVersion: state.cameraCommandVersion + 1,
    })),
  frameCamera: () =>
    set((state) => ({
      cameraCommandVersion: state.cameraCommandVersion + 1,
    })),
  resetCamera: () =>
    set((state) => ({
      cameraView: 'iso',
      cameraCommandVersion: state.cameraCommandVersion + 1,
    })),

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
      const activeBearingId = selectedBearingIds.has(id)
        ? id
        : (selectedBearingIds.values().next().value ?? null);
      return { selectedBearingIds, activeBearingId };
    }),

  setActiveBearing: (id) =>
    set((state) => {
      if (id == null) return { activeBearingId: null };
      const selectedBearingIds = new Set(state.selectedBearingIds);
      selectedBearingIds.add(id);
      return { activeBearingId: id, selectedBearingIds };
    }),

  clearSelection: () =>
    set({
      selectedNodeIds: new Set(),
      selectedElementIds: new Set(),
      selectedBearingIds: new Set(),
      activeBearingId: null,
    }),

  setHoveredElement: (id) => set({ hoveredElementId: id }),
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setHoveredBearing: (id) => set({ hoveredBearingId: id }),
}));
