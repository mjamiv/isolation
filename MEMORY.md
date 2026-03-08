# MEMORY

## Session Update (2026-03-07 — Viewer Cleanup, Landmark Model Presets, Diaphragm Fix)
- Cleaned up 3D viewer base layers: removed the gold-accented environment grid from Test Lab, tightened ContactShadows (opacity 0.45->0.35, blur 2.6->1.8), and aligned the user-toggled grid to the floor plane (`bounds.min[1] - 2 + 0.12`) instead of floating at Y=0
- Built **Apple Park Ring Segment (TFP Isolated)** preset — a 40-degree wedge of the iconic ring building with 162 nodes, 276 elements, 27 EPS TFP bearings (52" displacement capacity), based on real specs (1,532 ft outer diameter, 180 ft ring width, 692 isolators total)
- Built **LA City Hall (Base Isolated)** preset — the 32-story, 460 ft tall steel frame with three setback segments (podium/midrise/tower), 291 nodes, 513 elements, 27 HDR-equivalent bearings (21" displacement capacity), based on the Nabih Youssef et al. 2000 paper
- Fixed structural continuity in LA City Hall: tower columns extend through midrise and podium to the base; midrise columns extend through podium to the base; verified with successful time-history analysis (peak base shear 0.21 kips, max displacement 10.4 in for synthetic pulse)
- Fixed diaphragm rendering for concave geometries: replaced convex hull (which drew a straight chord across arc segments) with Delaunay triangulation (Bowyer-Watson) so diaphragm surfaces follow the actual node perimeter — fixes Apple Park's curved floor slabs

## Key Files Updated This Session
- `frontend/src/features/viewer-3d/SceneEnvironment.tsx` — removed Test Lab environment grid, tightened contact shadows
- `frontend/src/features/viewer-3d/Viewer3D.tsx` — aligned user grid to floor elevation
- `frontend/src/features/viewer-3d/diaphragmGeometry.ts` — replaced convex hull surface with Delaunay triangulation + concave boundary for proper arc/ring diaphragm rendering
- `frontend/src/types/modelJSON.ts` — added Apple Park and LA City Hall to PRESET_MODELS
- `frontend/public/models/apple-park-isolated.json` — new preset (ring segment)
- `frontend/public/models/la-city-hall-isolated.json` — new preset (tall building)

## Decisions and Rationale
- Used a single 40-degree wedge for Apple Park rather than the full ring because modeling 692 bearings on a full circle would be too dense for the viewer and analysis; one of nine independent wedge segments is structurally representative
- Modeled LA City Hall bearings as TFP (the IsoVis element type) with friction properties approximating the real HDR bearing hysteretic damping (~5-8% equivalent), since IsoVis doesn't have a native HDR bearing element
- The diaphragm Delaunay fix is backward-compatible: for convex/rectangular layouts the triangulation produces the same visual as the old convex hull fan

## Current State
- Branch: `main` (tracking `origin/main`)
- 12 model presets in Load Model dropdown (including Apple Park and LA City Hall)
- LA City Hall time-history analysis verified via API with successful completion
- Diaphragm rendering works for both convex grids and concave arc segments

## ⚠ Backend Launch (CRITICAL — read every session)
The backend **must** be started with the `isovis-x86` conda environment — NOT the local `.venv`.
OpenSeesPy ships an x86_64-only `.so`; the conda env runs Python under Rosetta on Apple Silicon.

**IMPORTANT**: The `.venv` in `backend/` sets `VIRTUAL_ENV` which overrides conda's PATH.
You must `unset VIRTUAL_ENV` and put the conda Python first on PATH explicitly.

```bash
cd backend
unset VIRTUAL_ENV
export PATH="/Users/mjamiv/miniforge3/envs/isovis-x86/bin:$PATH"
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Do NOT use `source .venv/bin/activate` or plain `conda activate isovis-x86` (the .venv VIRTUAL_ENV will still shadow it). Always verify with `which python` — it must show `/Users/mjamiv/miniforge3/envs/isovis-x86/bin/python`.

## Accumulated Context from Prior Sessions
- Phases 1-5 complete (model editor, analysis runner, TFP bearings, pushover, time-history comparison)
- Generated presets: The Frame (Fixed/Isolated), Long-Span Pavilion (Fixed/Isolated), plus static JSON presets
- Diaphragm geometry uses hull surfaces (non-collinear) and ribbon strips (collinear/bridge)
- All Plotly charts use SVG `scatter` (not `scattergl`) to avoid WebGL context exhaustion
- Only the main 3D viewer holds a WebGL context
- Frontend: Vite + React + Zustand + R3F + Radix UI + Plotly
- Backend: FastAPI + OpenSeesPy (x86_64 Rosetta on Apple Silicon)

## Next Steps
- Debug why `/api/results/<analysisId>` is returning null/empty isolated time-history payloads (`dt`, `totalTime`, `peakValues`) for the live smoke-tested run
- Re-run the live bearing smoke test after the backend fix and verify nonzero orbit/stage travel in the upgraded panel
- Turn the browser smoke test into a checked-in Playwright spec once the backend payload issue is fixed
- Investigate the frontend Vitest `--localstorage-file` warning
