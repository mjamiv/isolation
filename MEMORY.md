# MEMORY

## Session Update (2026-03-05 — Parallel Orchestrated 8-Item Implementation)
- Implemented the 8-item coordinated UX/viewer/analysis plan across frontend and backend.
- Delivered Results improvements:
  - Split element time-history force plotting into separate **Shear** and **Moment** charts.
  - Added store-driven auto-selection sync from 3D node/element selection into Results selectors.
- Delivered 3D viewer updates:
  - Diaphragm planes now follow active displaced node geometry (static/pushover/time-history).
  - Removed in-scene base bearing rendering from structural scene.
  - Added dedicated isometric bearing window: `frontend/src/features/viewer-3d/BearingAssemblyWindow.tsx`.
  - Removed non-working magnification controls from bearing orbit overlay.
- Delivered UI/status updates:
  - Model Tree now defaults collapsed (removed default-open sections from layout wiring).
  - Status bar now reflects comparison lifecycle (`Running/Complete/Error`) using comparison store priority.
- Delivered pushover/hinge hardening:
  - Backend hinge extraction now handles 3D force vectors using major moment components.
  - Yield-moment estimation improved using section/material properties.
  - Added elastic-only diagnostic message path for pushover outcomes with no yielding.
  - Surfaced diagnostic through comparison/results payloads and frontend display.

## Key Files Added
- `frontend/src/features/viewer-3d/useActiveDisplacements.ts`
- `frontend/src/features/viewer-3d/BearingAssemblyWindow.tsx`
- `frontend/src/test/features/TimeHistoryResults.test.tsx`
- `frontend/src/test/features/StatusBar.test.tsx`
- `tests/test_solver_hinges.py`

## Key Files Updated
- `frontend/src/features/results/TimeHistoryResults.tsx`
- `frontend/src/features/results/StaticResults.tsx`
- `frontend/src/features/viewer-3d/DiaphragmPlanes.tsx`
- `frontend/src/features/viewer-3d/StructuralModel3D.tsx`
- `frontend/src/features/viewer-3d/Viewer3D.tsx`
- `frontend/src/features/viewer-3d/BearingDisplacementView.tsx`
- `frontend/src/features/layout/AppLayout.tsx`
- `frontend/src/features/layout/StatusBar.tsx`
- `backend/app/services/solver.py`
- `backend/app/routers/comparison.py`
- `frontend/src/services/api.ts`
- `frontend/src/types/analysis.ts`
- `frontend/src/types/comparison.ts`
- `frontend/src/features/results/PushoverResults.tsx`
- `frontend/src/features/comparison/ComparisonPanel.tsx`

## Decisions and Rationale
- Unified displacement interpretation with shared helper (`useActiveDisplacements`) to reduce divergence between viewer layers.
- Kept comparison status ownership in `comparisonStore` and made status bar precedence explicit rather than duplicating state transitions.
- Chose separate bearing assembly window instead of in-scene bearing detail to improve readability and reduce visual clutter in the primary structural scene.
- Added explicit elastic-only diagnostics to distinguish physics/modeling expectations from implementation defects.

## Verification
- Frontend targeted tests passed:
  - `cd frontend && npm run test -- src/test/features/TimeHistoryResults.test.tsx src/test/features/StatusBar.test.tsx src/test/features/ResultsPanel.test.tsx src/test/features/ComparisonPanel.test.tsx`
- Note:
  - Frontend `npm run type-check` still reports existing broad typing issues centered in `frontend/src/services/api.ts` (pre-existing debt).
  - Backend unit execution that imports OpenSeesPy can fail in non-Rosetta Python due architecture mismatch; run backend tests via `./start-backend.sh` environment.

## Current State
- Branch: `main` (tracking `origin/main`).
- Working tree includes feature implementation + doc updates.
- Untracked local artifacts present: `.mcp.json`, `frontend/test-results/`, `sh-thd-1772628347`.

## Next Steps
- Clean up `frontend/src/services/api.ts` type debt so `npm run type-check` is green.
- Run manual browser QA against:
  - Time-history results shear/moment readability.
  - Diaphragm deformation playback.
  - Bearing assembly window behavior under varying deformation scales.
- Decide whether local artifacts (`.mcp.json`, `frontend/test-results/`, `sh-thd-*`) should be git-ignored or cleaned.
