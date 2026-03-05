# MEMORY

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
- `frontend/src/features/viewer-3d/BearingAssemblyWindow.tsx` — full rewrite from WebGL to 2D canvas + UX controls
- `frontend/src/features/viewer-3d/BearingDisplacementView.tsx` — bearing sync via `activeBearingId`
- `frontend/src/features/viewer-3d/DiaphragmPlanes.tsx` — z-up + timestep deformation fix
- `frontend/src/features/viewer-3d/PlaybackDriver.tsx` — bounds guard on time step
- `frontend/src/stores/displayStore.ts` — `activeBearingId` + `setActiveBearing` added
- `frontend/src/stores/analysisStore.ts` — `setResults` now resets time step
- `frontend/src/features/results/TimeHistoryResults.tsx` — `scattergl` → `scatter`
- `frontend/src/features/results/PushoverResults.tsx` — `scattergl` → `scatter`
- `frontend/src/features/comparison/ComparisonPanel.tsx` — `scattergl` → `scatter`

## Decisions and Rationale
- Chose 2D canvas over Three.js Canvas for bearing assembly to avoid WebGL context limits; the isometric projection + plate drawing gives adequate visual quality without GPU context overhead.
- Switched Plotly from `scattergl` to `scatter` because each `scattergl` trace allocates a WebGL context; combined with the main Three.js scene this exceeded browser limits (typically 16 contexts).
- Used a single shared `activeBearingId` instead of per-widget local index state to guarantee sync; the ID-driven approach is immune to bearing list ordering differences between widgets.
- Kept bearing orbit as an opt-in toggle in the assembly view since the 2D isometric projection can distort plan-view orbit shapes.

## Known Issues
- `frontend/src/services/api.ts` has pre-existing TypeScript typing debt (`npm run type-check` reports ~17 errors).
- Bearing assembly 2D renderer uses fixed isometric projection angles; no perspective correction.

## Current State
- Branch: `main` (tracking `origin/main`).
- Working tree has 9 modified files ready for commit.
- Backend running on `:8000`, frontend on `:5174`.

## Next Steps
- Clean up `frontend/src/services/api.ts` type debt so `npm run type-check` is green.
- Consider adding a mini axis gizmo to the bearing assembly 2D canvas for orientation reference.
- Run full frontend test suite to verify no regressions from `scatter` switch.
- Decide whether local artifacts (`.mcp.json`, `frontend/test-results/`, `sh-thd-*`) should be git-ignored or cleaned.
