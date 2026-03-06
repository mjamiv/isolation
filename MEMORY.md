# MEMORY

## Session Update (2026-03-06 — UI Cleanup, Diaphragm Fix & Environment Simplification)
- Replaced the large HUD card overlay with a compact centered toolbar strip (ViewerHud.tsx)
- Changed default display mode from `solid` to `wireframe` in displayStore
- Fixed API base URL: `API_BASE` now appends `/api` when `VITE_API_URL` is set, fixing 404s on `/models`
- Simplified Test Lab environment: removed `LabEnvelope` (transparent bounding box walls/ceiling) and `FloorBoundary` line loop
- Removed Control Room environment entirely: deleted `ControlRoomEnvironment`, `ControlRoomPanels`, and `controlRoom` from the `EnvironmentPreset` type
- Fixed diaphragm displacement axis bug: `zUpData` in `useActiveDisplacements` was returning `true` for all time-history results regardless of bearings; now derived from `hasBearings` to match `DeformedShape`
- Redesigned Bearing Assembly panel: replaced the heavy overlay-card with a compact 220px panel — canvas-first layout, minimal bottom bar, removed S/M/L/Expand/Collapse/Rotate/Pan/X-Ray controls

## Key Files Updated This Session
- `frontend/src/features/viewer-3d/ViewerHud.tsx` — rewritten as compact toolbar strip
- `frontend/src/features/viewer-3d/BearingAssemblyWindow.tsx` — redesigned as minimal panel
- `frontend/src/features/viewer-3d/SceneEnvironment.tsx` — removed LabEnvelope, FloorBoundary, ControlRoom
- `frontend/src/features/viewer-3d/useActiveDisplacements.ts` — fixed zUpData to use hasBearings
- `frontend/src/features/viewer-3d/DiaphragmPlanes.tsx` — removed redundant hasBearings logic
- `frontend/src/features/controls/ViewerControls.tsx` — dropped controlRoom from environment options
- `frontend/src/stores/displayStore.ts` — wireframe default, removed controlRoom from type
- `frontend/src/services/api.ts` — API_BASE auto-appends /api
- `frontend/src/index.css` — new HUD bar and bearing assembly panel styles
- `frontend/src/test/stores/displayStore.test.ts` — updated for wireframe default

## Decisions and Rationale
- Changed zUpData to derive from hasBearings (model store) instead of analysis type because only bearing models use Z-up coordinates; non-bearing Bay Build models keep Y-up
- Removed Control Room because it added visual complexity without functional value at this stage
- Kept Test Lab lighting and floor intact; only removed the enclosure geometry that was obscuring the model
- Bearing Assembly panel: removed all chrome that duplicated orbit controls or required mode-switching; drag-rotate and shift-drag-pan are discoverable without buttons

## Verification
- `cd frontend && npm run type-check` — passed
- `cd frontend && npx vitest run` — 68 tests passed (displayStore 37, modelStore 29, diaphragmGeometry 2)
- Frontend dev server on `http://127.0.0.1:5174` — HMR picked up all changes
- Backend on `http://127.0.0.1:8001` — relaunched with `isovis-x86` conda env for OpenSeesPy compatibility
- Manual browser testing confirmed: analysis runs, diaphragms deform correctly, bearing assembly renders

## Current State
- Branch: `main` (tracking `origin/main`)
- 5 environment presets: Test Lab, Studio, Outdoor, Dark, Blueprint
- Backend must be launched with `conda activate isovis-x86` (OpenSeesPy is x86_64-only)

## Accumulated Context from Prior Sessions
- Phases 1-5 complete (model editor, analysis runner, TFP bearings, pushover, time-history comparison)
- Generated presets: The Frame (Fixed/Isolated), Long-Span Pavilion (Fixed/Isolated), plus static JSON presets
- Diaphragm geometry uses hull surfaces (non-collinear) and ribbon strips (collinear/bridge)
- All Plotly charts use SVG `scatter` (not `scattergl`) to avoid WebGL context exhaustion
- Only the main 3D viewer holds a WebGL context
- Frontend: Vite + React + Zustand + R3F + Radix UI + Plotly
- Backend: FastAPI + OpenSeesPy (x86_64 Rosetta on Apple Silicon)

## Next Steps
- Consider further environment tuning (Test Lab lighting, Blueprint grid density)
- Turn the browser smoke test into a checked-in Playwright spec
- Investigate the frontend Vitest `--localstorage-file` warning
- If continuing viewer polish: scene art direction, material tuning, label treatment
