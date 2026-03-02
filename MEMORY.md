# MEMORY

## Completed Work (2026-03-02)
- Rebased this session on a clean baseline by discarding earlier in-progress edits per user direction.
- Updated startup autoload model to Bay Build `1x1x1` steel frame (`fixed` base, rigid diaphragms) with startup gravity loads scaled to `50% LL`.
- Set Model Tree panels to default collapsed and condensed Viewer Controls into collapsible sections (`Scene`, `Display`, `Element Properties`, `Deformation`, `Results`) with default collapsed state.
- Fixed sticky/non-starting play behavior by replacing the `useFrame` playback stepping dependency with a requestAnimationFrame time-accumulator driver in `PlaybackDriver`.
- Updated post-analysis/post-comparison defaults:
  - Deformed shape on with scale factor `100`
  - Force diagrams and color maps off by default
  - Bearing displacement default on for isolation-bearing models
  - Base shear arrows default on for pushover
  - Comparison overlay default on for comparison runs
  - Time-history playback resets to step `0` and paused on new results
- Retained/verified detailed staged TFP bearing rendering updates: lower-concave orbit emphasis, top-assembly stage-following displacement, vertical bearing exaggeration control.
- Added fixed-base anomaly investigation note: bridge "fixed-base" preset currently behaves as fixed piers + expansion-like abutments; base-shear metric currently sums only fully fixed nodes.
- Added/updated targeted tests for startup model defaults and analysis/comparison display default behavior.

## Key Decisions / Tradeoffs
- Implemented `50% LL` as startup-load scaling in `loadSampleModel()` because Bay Build currently has no explicit startup dead/live split controls.
- Fixed playback reliability at the driver layer (time stepping) rather than only UI controls; this addresses both Results and Compare panes consistently.
- Investigated fixed-base anomalies without major solver or model rewrites per request; documented findings and low-risk next diagnostics instead.

## Current State
- Verified locally this session:
  - `npm test -- --run src/test/stores/modelStore.test.ts src/test/features/App.test.tsx src/test/features/analysisDisplayDefaults.test.tsx` (`33` passed)
  - `npm test -- --run src/test/stores/displayStore.test.ts src/test/stores/analysisStore.test.ts src/test/stores/analysisStore-phase4.test.ts` (`58` passed)
  - `npm test -- --run src/test/features/ComparisonPanel.test.tsx src/test/features/AnalysisDialog-comparison.test.tsx` (`28` passed)
  - `npm run type-check` (pass)
- Research artifact created:
  - `reports/fixed-base-investigation-2026-03-02.md`
- Not yet verified this session:
  - Full frontend suite
  - Backend/unit/integration suites
  - Manual browser QA for startup defaults, panel-collapse UX, playback behavior, and post-run auto-toggles

## Next Steps
- Run manual browser QA for:
  - startup Bay Build `1x1x1` model + `50% LL` expectation
  - Results/Compare playback auto-start and stability
  - default collapsed control/panel UX
  - post-analysis default visualization toggles
- Decide whether the bridge preset label should be changed to reflect released abutment DOFs (or update restraints to true full fixed-base behavior).
- If base-shear interpretation clarity is needed, add support-group reaction breakdown (fully fixed vs partially restrained) to results.
