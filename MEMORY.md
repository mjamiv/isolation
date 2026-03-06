# MEMORY

## Session Update (2026-03-05 — Bearing Assembly 3D Rendering & Interaction Fixes)
- Fixed bearing assembly rotation:
  - Root cause: pointer events on the assembly canvas were bubbling up to the parent Three.js `<Canvas>`, causing the main scene to rotate instead of the bearing view.
  - Added `e.stopPropagation()` to all pointer handlers (down/move/up) on the canvas and the panel container div.
- Rewrote `drawPlate` for proper 3D rendering:
  - Directional lighting with a fixed light direction (top-right-front).
  - `shadeFace()` applies brightness modulation based on face normal dot product with light.
  - Back-face culling using 2D cross-product of projected quad edges — back-facing side quads are skipped.
  - Front/back face distinction — face closer to camera drawn last (on top) with brighter shading.
  - Depth-sorted plate draw order: all 7 assembly pieces are sorted by `project().depth` before rendering.
  - Increased segment count from 24 to 32 for smoother cylinder outlines.
- Fixed displacement scale normalization:
  - Changed `scaleFactor` to `localScale = 1` for bearing-local displacements.
  - Orbit points and plate offsets now use raw displacements (inches) instead of global deformation amplification.
  - Removed unused `scaleFactor` import from displayStore.
- Added load case presets to AnalysisDialog:
  - `DIRECTION_PRESETS` array with 11 preset options (X only, Y only, Z only, X+Z combos, X+Y+Z combos).
  - Dropdown in time-history section populates directionScales state.

## Session Update (2026-03-05 — Bearing Assembly UX & WebGL Stability)
- Overhauled Bearing Assembly iso viewer:
  - Replaced second WebGL `Canvas` with 2D canvas renderer to fix `Context Lost` crashes.
  - Added interactive controls: drag-rotate, drag-pan (Shift+drag), scroll-zoom, Reset button.
  - Added size presets (S/M/L), expandable Max/Min toggle.
  - Added optional orbit overlay (faint full trace + active highlighted trace + current marker).
  - Added Xray transparency toggle.
  - Stage offsets now use actual bearing `dispCapacities` for kinematic accuracy.
- Fixed bearing selection sync:
  - Both Assembly and Orbits panels share a single `activeBearingId` in `displayStore`.
  - Prev/next navigation in either panel updates both simultaneously.
  - Eliminated local index state race that caused desync.
- Fixed Bent Build vertical-scale bug:
  - Assembly kinematics now use relative displacement (`dispJ − dispI`), not absolute node offsets.
- Fixed WebGL context exhaustion (white screen):
  - All Plotly charts switched from `scattergl` to `scatter` (SVG rendering).
  - Removed second Three.js Canvas from assembly widget.
  - Only the main 3D viewer retains a WebGL context.
- Fixed diaphragm deformation sync:
  - DiaphragmPlanes now uses `zUpData || hasBearings` for displacement mapping.
  - Added `currentTimeStep` dependency so diaphragms recompute each frame during playback.
- Fixed white screen on consecutive runs:
  - `analysisStore.setResults` now resets `currentTimeStep` to 0 and stops playback.
  - `PlaybackDriver` clamps `currentTimeStep` to valid range when results change.

## Key Files Updated This Session
- `frontend/src/features/viewer-3d/BearingAssemblyWindow.tsx` — rotation fix, 3D rendering overhaul, displacement scale normalization
- `frontend/src/features/analysis/AnalysisDialog.tsx` — load case presets dropdown

## Decisions and Rationale
- Used `stopPropagation()` on all pointer events because the bearing assembly panel sits atop the main Three.js Canvas; without it, drag events reach `OrbitControls` and rotate the wrong scene.
- Used directional lighting + back-face culling rather than a simple flat fill so rotation produces visible shading changes — critical for a 2D canvas renderer where there's no GPU-side lighting.
- Used `localScale = 1` instead of `scaleFactor` because the bearing assembly view needs displacements proportional to bearing physical geometry (radius ~12-36 inches), not the 100x amplified deformation scale used by the main structural scene.

## Known Issues
- `frontend/src/services/api.ts` has pre-existing TypeScript typing debt (~17 errors).
- Bearing assembly 2D renderer lacks perspective correction (fixed isometric projection).
- Bearing assembly rotation is still a known area of concern — user has reported it multiple times. The event propagation fix should resolve it but needs live verification.

## Current State
- Branch: `main` (tracking `origin/main`).
- 4 modified files to commit: `BearingAssemblyWindow.tsx`, `AnalysisDialog.tsx`, `package.json`, `package-lock.json`.
- Backend on `:8000`, frontend on `:5173`.

## Next Steps
- Verify bearing rotation works correctly in live browser testing.
- Clean up `frontend/src/services/api.ts` type debt.
- Consider adding axis gizmo to bearing assembly view for orientation reference.
- Add `frontend/.playwright-browsers/` and `frontend/test-results/` to `.gitignore`.
