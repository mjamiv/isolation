# MEMORY

## Completed Work
- Fixed 3D force-diagram rendering to use station-based member results from discretized solver output.
- Updated force-diagram geometry to render contiguous per-station strips (not single per-element quads), so moment/shear diagrams remain continuous along members.
- Aligned force-diagram orientation logic with backend local-axis (`vecxz`) conventions, including z-up isolated model mapping.
- Added deformed-follow behavior for force diagrams so they track displaced geometry when deformation display is enabled.
- Added small validation models:
  - `frontend/public/models/two-story-2x2-fixed.json`
  - `frontend/public/models/two-story-2x2-isolated.json`
- Added preset entries for these models in `frontend/src/types/modelJSON.ts`.
- Updated results panels to use full solver force vectors:
  - Static panel now supports 12-component 3D end-force vectors.
  - Time-history element plot now tracks i/j end traces with correct component selection.
- Fixed z-up modal mode-shape component mapping in `ModeShapeAnimation`.

## Key Decisions / Tradeoffs
- Chose station-by-station assembly from discretized sub-elements to prioritize physical continuity and fidelity over minimal rendering cost.
- For 3D shear/moment component selection, used dominant-magnitude component for clear visualization while still reading exact solver components.
- Kept large-model diagram gating (selection required above threshold) to avoid performance regressions.

## Current State
- Frontend checks are green after changes:
  - `npm run lint`
  - `npm test -- --run` (207/207 passing)
  - `npm run build`
- Repo contains backend and frontend updates in progress on `main` with new model files added.
- README updated to reflect new presets and station-based force-diagram behavior.

## Next Steps
- Perform manual visual QA in browser on:
  - 2-story 2x2 fixed/isolated presets
  - 20-story tower
  - 5-story office fixed/isolated
  for static, modal, time-history, and pushover force diagram orientation/continuity.
- If any remaining orientation mismatches are found, expose explicit local-axis vectors from backend results to remove viewer-side inference.
