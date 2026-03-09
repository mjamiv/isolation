# MEMORY

## Session Update (2026-03-09 — YOLO-MOAS Full Repo Upgrade)
- Ran Y.O.L.O-M.O.A.S: 5 agent leads × 2 sub-agents = 15 total agents swept the codebase
- **Frontend Design**: 19 changes — mobile tab layout, WCAG accessibility (aria-labels, focus rings, keyboard nav, skip link, semantic landmarks, toast aria-live), systematic contrast bumps across all panels
- **Code Simplifier**: 7 changes — 4 nested ternaries → if/else, dead code removal (redundant `pass`, identity prop), named `ModelBounds` type
- **Security**: 7 changes — security headers middleware (CSP, X-Frame-Options, etc.), Docker Compose hardening (Redis localhost-only, read-only FS, no-new-privileges, memory limits), WebSocket origin validation, in-memory store limits (100 models/500 analyses with FIFO eviction), Pydantic schema validation on model metadata
- **Performance**: 12 changes — React.memo on 8 Three.js components, useShallow selectors (ViewerControls 30+ → 2), shared module-scope geometries/materials, lazy-loaded 4 heavy panels (ComparisonPanel, AnalysisDialog, BayBuildDialog, BentBuildDialog)
- **Documentation**: README restructured (390 → 155 lines), JSDoc on 5 frontend files (stores, types)
- Fixed pre-existing diaphragmGeometry test (outline ordering + centroid vertex index after Delaunay change)
- All 51 changes passed independent checker review with 0 reverts

## Key Files Updated This Session
- 36 files modified across frontend and backend (see git diff --stat)
- `backend/app/main.py` — security headers middleware, CORS hardening
- `backend/app/core/config.py` — MAX_MODELS, MAX_ANALYSES limits
- `backend/app/routers/analysis.py` — WebSocket origin validation, store limits
- `backend/app/routers/models.py` — model store limits with FIFO eviction
- `backend/app/schemas/model.py` — typed ModelInfoSchema with validation
- `docker-compose.yml` — Redis localhost-only, read-only FS, memory limits
- `frontend/src/features/layout/AppLayout.tsx` — mobile tabs, semantic HTML, lazy ComparisonPanel
- `frontend/src/features/controls/ViewerControls.tsx` — useShallow selectors, accessibility
- `frontend/src/features/viewer-3d/*.tsx` — React.memo, shared geometries/materials
- `frontend/src/stores/*.ts`, `frontend/src/types/storeModel.ts` — JSDoc documentation

## Decisions and Rationale
- CSP uses `unsafe-inline`/`unsafe-eval` because Plotly.js and Tailwind require them
- Shared module-scope Three.js objects persist for app lifetime (intentional — tiny memory)
- Mobile layout uses tab-based navigation instead of cramped 3-panel split
- In-memory store limits use FIFO eviction (oldest first) to prevent DoS

## Current State
- Branch: `main` (tracking `origin/main`)
- All tests pass: 511 frontend (Vitest), 128 backend (pytest)
- TypeScript type-check clean
- 12 model presets available

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
- Diaphragm geometry uses Delaunay triangulation (Bowyer-Watson) for concave/arc segments, ribbon strips for collinear/bridge
- All Plotly charts use SVG `scatter` (not `scattergl`) to avoid WebGL context exhaustion
- Only the main 3D viewer holds a WebGL context
- Frontend: Vite + React + Zustand + R3F + Radix UI + Plotly
- Backend: FastAPI + OpenSeesPy (x86_64 Rosetta on Apple Silicon)

## Next Steps
- Debug why `/api/results/<analysisId>` is returning null/empty isolated time-history payloads
- Re-run the live bearing smoke test after the backend fix
- Turn the browser smoke test into a checked-in Playwright spec
- Manual QA of the new mobile tab layout
- Enable `AUTH_REQUIRED` for production deployment
