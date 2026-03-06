# MEMORY

## Session Update (2026-03-06 — 3D Viewer Corner Fix)
- Removed dark corner artifact in 3D viewer: stripped CSS radial/linear gradient from the viewer wrapper div in AppLayout.tsx and set WebGL canvas `alpha: false` so the Three.js scene background fills the entire viewport

## Key Files Updated This Session
- `frontend/src/features/layout/AppLayout.tsx` — removed dark gradient background from viewer wrapper (desktop + mobile)
- `frontend/src/features/viewer-3d/Viewer3D.tsx` — changed canvas `alpha: true` to `alpha: false`

## Decisions and Rationale
- The CSS gradient (`#09111f` → `#050914`) behind the canvas was bleeding through corners because the WebGL context had alpha enabled; the scene already manages its own background via SceneEnvironment, so neither the CSS gradient nor alpha transparency was needed

## Current State
- Branch: `main` (tracking `origin/main`)
- 5 environment presets: Test Lab, Studio, Outdoor, Dark, Blueprint

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
- Consider further environment tuning (Test Lab lighting, Blueprint grid density)
- Turn the browser smoke test into a checked-in Playwright spec
- Investigate the frontend Vitest `--localstorage-file` warning
- If continuing viewer polish: scene art direction, material tuning, label treatment
