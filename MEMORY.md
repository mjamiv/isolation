# MEMORY

## Session Update (2026-03-04 — Frontend Clarity/Usability Polish)
- Implemented a full frontend clarity pass focused on content hierarchy, readability, and scanability across layout, toolbar, status, comparison, results, and property views.
- Core UX updates shipped:
  - Right panel now auto-switches to `Results` on analysis completion.
  - Right-panel tabpanel DOM order now matches tab order.
  - Model Tree opens with `Nodes` and `Elements` expanded by default.
  - Toolbar actions are visually grouped; status bar units are explicitly labeled.
  - Comparison labels now use explicit wording (`Isolated`, `Fixed-Base`, `Demand/Capacity`) with consistent toggle styling.
  - Analysis dialog validation errors now scroll into view and are wired with `aria-describedby`.
  - Results/Properties tables include clearer units and improved empty-state guidance.
  - Added typography scale tokens in `frontend/src/index.css` with shared UI text utility classes.
  - Added sticky results summary header and tuned narrow viewport metric card layout.
- Quick QA/tuning pass completed:
  - Increased dark-theme contrast in status/model info and empty-state icon treatments.
  - Improved narrow-width behavior for comparison metrics and toolbar control shrink behavior.

## Key Decisions (2026-03-04)
- Prioritized clarity and usability over visual novelty for this iteration.
- Kept changes additive and low-risk (class-level/styling + light structural UI logic), with no solver or API behavior changes.
- Used a two-pass implementation flow: priority UX fixes first, then non-priority typography/sticky-header polish.

## Verification (2026-03-04)
- Frontend lint checks passed after each pass:
  - `cd frontend && npm run lint` (pass)
- Targeted lint diagnostics on edited files: no IDE lints reported.
- Frontend and backend dev servers restarted fresh and confirmed running:
  - frontend: `http://localhost:5173`
  - backend: `http://localhost:8000`

## Current State (2026-03-04)
- Branch: `main` (tracking `origin/main`).
- Working tree includes frontend clarity/polish updates plus documentation updates for wrap-up.
- Untracked local artifacts still present: `.mcp.json`, `frontend/test-results/`, `frontend/sh-thd-1772693459`.

## Known Issues / Next Steps (2026-03-04)
- Existing frontend type-check failures remain in `frontend/src/services/api.ts` and `frontend/src/features/analysis/useRunComparison.ts` (pre-existing to this UI pass).
- Optional next pass: mobile-only label abbreviations and density tuning for extra-small widths.

## Completed Work (2026-03-03 — Full Findings Remediation)
- Implemented end-to-end remediation from multi-agent review findings across backend security, abuse resistance, frontend accessibility/UX, maintainability refactors, and CI security checks.
- Backend hardening:
  - Added optional API-key auth scaffold in `backend/app/core/security.py` and applied dependency to models/analysis/results/comparison routers.
  - Added in-memory rate limiting in `backend/app/core/rate_limit.py` with default and heavy-endpoint limits wired from `backend/app/main.py`.
  - Added safe public analysis error reporting (`error` + `error_code`) while preserving internal exception details server-side in `backend/app/routers/analysis.py`.
  - Enforced simulation abuse bounds: schema caps for `num_steps`, `num_modes`, and ground motion record length; runtime duration checks in analysis/comparison time-history execution.
  - Normalized router prefix style for analysis/comparison to align with other API routers.
  - Updated `backend/Dockerfile` to run as non-root user.
- Frontend UX/accessibility:
  - Added ARIA tab semantics for right panel tabs and corresponding tabpanels in `frontend/src/features/layout/AppLayout.tsx`.
  - Replaced blocking browser confirm with `ConfirmDialog` for model reset in `frontend/src/features/layout/Toolbar.tsx`.
  - Added ARIA labels for display mode controls and slider inputs in Bay/Bent build dialogs.
  - Strengthened focus-visible styling in `frontend/src/index.css`.
  - Added responsive baseline with explicit Tailwind breakpoints and mobile stacked AppLayout fallback.
- Frontend maintainability:
  - Stabilized `useRunAsync` callback behavior via `useRef` config indirection.
  - Extracted shared display-default helper `frontend/src/features/analysis/applyPostAnalysisDisplayDefaults.ts` and reused in analysis/comparison hooks.
  - Refactored API normalizers in `frontend/src/services/api.ts` to reduce duplication and improve typing (`unknown`-first parsing helpers).
  - Unified `deleteModel` onto shared response/error handling path.
- Security ops:
  - Added `.github/workflows/dependency-audit.yml` to run `npm audit` and `pip-audit` (non-blocking initial rollout).

## Verification (2026-03-03 — Full Findings Remediation)
- Frontend: `cd frontend && npm run lint` (pass)
- Frontend: `cd frontend && npm run test -- --run` (pass, `490/490`)
- Backend: `cd backend && source .venv/bin/activate && pytest tests/ -q` (pass, `128 passed, 2 skipped`)
- Note: `ruff` command unavailable in current backend environment during verification.

## Current State (2026-03-03 — Full Findings Remediation)
- Branch: `main` (tracking `origin/main`).
- Working tree contains the remediation implementation across backend/frontend plus wrap-up doc updates.
- Untracked local artifacts present: `.mcp.json`, `frontend/test-results/`.

## Next Steps (2026-03-03 — Full Findings Remediation)
- Decide whether to keep or clean untracked local artifacts (`.mcp.json`, `frontend/test-results/`).
- Optionally move dependency audit workflow from non-blocking to blocking once baseline vulnerabilities are triaged.
- Run a focused browser E2E pass outside sandbox constraints to validate the new responsive/tab semantics path.

## Completed Work (2026-03-03 — Session Wrap-Up 2)
- Updated Bent Build startup defaults to a simple straight 3-span baseline (no horizontal/vertical curve profile) by simplifying `DEFAULT_BENT_BUILD_SHOWCASE_PARAMS` in `frontend/src/features/bent-build/bentBuildTypes.ts`.
- Updated bent-build tests to reflect the simple baseline defaults (no chord nodes, no default bearings, flat profile) in `frontend/src/features/bent-build/__tests__/generateBentFrame.test.ts`.
- Fixed bundled 3-span preset model JSONs to use panel diaphragms instead of a single global diaphragm:
  - `frontend/public/models/three-span-bridge-fixed.json`
  - `frontend/public/models/three-span-bridge-isolated.json`
- Added preset sync automation:
  - script: `frontend/scripts/regenerate-three-span-diaphragms.mjs`
  - npm command: `cd frontend && npm run sync:three-span-diaphragms`
- Created code commit: `554bf8d` (`fix(bent-build): simplify defaults and sync 3-span presets`).

## Verification (2026-03-03 — Session Wrap-Up 2)
- `cd frontend && npm test -- src/features/bent-build/__tests__/generateBentFrame.test.ts` (`136 passed`).
- Ran `cd frontend && npm run sync:three-span-diaphragms` and confirmed both preset files produce `15` diaphragms.
- JSON parse checks for both updated preset files passed.

## Current State (2026-03-03 — Session Wrap-Up 2)
- Branch: `main` (tracking `origin/main`).
- Working tree before docs commit:
  - modified: `README.md`
  - untracked: `.mcp.json`

## Completed Work (2026-03-03)
- Restored bent-build rigid diaphragm generation from a single global deck diaphragm to panel-based diaphragms in `frontend/src/features/bent-build/generateBentFrame.ts`.
- Implemented deterministic panel generation per adjacent girder pair and longitudinal segment using:
  - `diaphragmCount = (numGirders - 1) * numSpans * chordsPerSpan`
  - accepted check: `3 spans`, `5 girders`, `chordsPerSpan=1` => `12` diaphragms.
- Updated bent-build diaphragm tests in `frontend/src/features/bent-build/__tests__/generateBentFrame.test.ts` to assert panel-count behavior and remove single-diaphragm assumptions.
- Kept/bundled viewer-side bearing visualization improvements and kinematics alignment updates:
  - `frontend/src/features/viewer-3d/BearingSymbols.tsx`
  - `frontend/src/features/viewer-3d/SupportSymbols.tsx`
  - `frontend/src/features/viewer-3d/tfpKinematics.ts`
  - `frontend/src/test/features/tfpKinematics.test.ts`
- Created code commit: `1c6ed3b` (`fix(bent-build): restore panel diaphragms and stabilize support behavior`).

## Key Decisions / Tradeoffs (2026-03-03)
- Chose panel-based diaphragm topology (from earlier working behavior) over per-support-line or single-global diaphragm behavior.
- Used the explicit panel formula as the primary acceptance contract to prevent future regressions.
- Preserved existing support modeling rules (monolithic FIX piers vs explicit EXP/isolated constraints) while reintroducing panel diaphragms.

## Verification (2026-03-03)
- `cd frontend && npm test -- src/features/bent-build/__tests__/generateBentFrame.test.ts src/test/features/tfpKinematics.test.ts` (`145 passed`).
- `cd frontend && npm test -- src/test/services/modelSerializer.test.ts` (`21 passed`).
- Lint diagnostics on edited bent-build files: no errors.

## Current State (2026-03-03)
- Branch: `main` (tracking `origin/main`).
- Working tree after code commit:
  - modified: `README.md`
  - untracked: `.mcp.json`
- Pending wrap-up docs commit to capture this session in repo docs.

## Completed Work (2026-03-02 — Session Closeout)
- Shipped and merged Bent Build showcase defaults via PR `#1`:
  - merge commit: `78d2356015ac2284a3b88dc7fbea0bce2aa6aa51`
  - feature commit: `c26a2ca`
- Bent Build now opens in a comparison-ready configuration:
  - steel, `3` spans (`100-140-100 ft`)
  - support mode: `isolated` at `bearing` level
  - active horizontal curve (`station=70 ft`, `delta=18 deg`, `R=1200 ft`, right)
  - active vertical profile (`station=170 ft`, `elev=4.25 ft`, `exit=-2%`, `L=180 ft`)
  - `4` chords/span for curved discretization
- Bent Build dialog now initializes alignment controls and support mode from showcase defaults.

## Key Decisions / Tradeoffs (Session Closeout)
- Kept the shipped merge focused to two product files only:
  - `frontend/src/features/bent-build/bentBuildTypes.ts`
  - `frontend/src/features/bent-build/BentBuildDialog.tsx`
- Avoided bundling unrelated in-progress local edits into the merge to reduce regression surface.

## Current State (Session Closeout)
- Branch: `main` (tracking `origin/main`)
- Git status:
  - `main` is `ahead 1` commit (`173328d`) with this memory update
  - uncommitted tracked changes remain in:
    - `README.md`
    - `frontend/src/features/bent-build/__tests__/generateBentFrame.test.ts`
    - `frontend/src/features/bent-build/generateBentFrame.ts`
    - `frontend/src/features/viewer-3d/BearingSymbols.tsx`
    - `frontend/src/features/viewer-3d/tfpKinematics.ts`
    - `frontend/src/test/features/tfpKinematics.test.ts`
  - untracked: `.mcp.json`
- Verification executed for shipped Bent Build changes:
  - `cd frontend && npm test -- --run src/features/bent-build/__tests__/generateBentFrame.test.ts` (`135 passed`)
  - `cd frontend && npm run type-check` (pass)
  - `cd frontend && npx eslint src/features/bent-build/BentBuildDialog.tsx src/features/bent-build/bentBuildTypes.ts src/features/bent-build/__tests__/generateBentFrame.test.ts` (pass)

## Next Steps (Session Closeout)
- Optional: either ignore `.mcp.json` in git or explicitly track it, to keep status clean.
- Optional QA: run one quick Bent Build -> Time History -> Compare flow to validate first-open UX with the new showcase defaults.

## Completed Work (2026-03-02)
- Fixed bent-build conventional FIX behavior to match the working fixed preset: FIX piers are now monolithic deck-pier connections (no separate cap-node/equalDOF coupling path on FIX lines).
- Preserved EXP and isolated behavior: separate cap/support planes and equalDOF constraints remain where expansion or isolation support behavior requires them.
- Updated bent-build element generation to avoid duplicate deck cross-beam stiffness at monolithic FIX pier lines while keeping concrete `pierCap` members.
- Updated TFP 3D bearing rendering:
  - lower assembly follows displaced node I
  - upper assembly follows displaced node J
  - relative orbit traces are plotted at the lower bearing footprint
  - connection spine added to make top/bottom movement coupling explicit in playback
- Added kinematics helper for consistent solver Z-up to viewer Y-up displacement mapping in bearing visuals.
- Updated bent-build tests to reflect monolithic FIX topology and mixed FIX/EXP equalDOF behavior.
- Added/updated kinematics tests for node displacement mapping and orbit extraction behavior.
- Ran automated browser QA (headless Chrome + Playwright) end-to-end against live local servers:
  - startup model static analysis
  - bent-build default conventional/FIX static analysis
  - 3-span isolated bridge time-history analysis + playback/orbit checks
  - result: `1 passed`

## Key Decisions / Tradeoffs
- Aligned bent-build FIX modeling with the already-stable fixed preset instead of adding more constraint complexity on top of rigid diaphragm handling.
- Kept EXP support behavior constraint-based (equalDOF) so release/guided behavior remains explicit and configurable.
- Switched bearing animation anchoring from staged-offset-only visuals to direct connected-node motion so top/bottom movement is physically consistent across bridge and building models.
- Used temporary, non-committed browser test scaffolding for full QA coverage; removed temporary test files/artifacts after run.

## Current State
- Working tree changes include:
  - `frontend/src/features/bent-build/generateBentFrame.ts`
  - `frontend/src/features/bent-build/__tests__/generateBentFrame.test.ts`
  - `frontend/src/features/viewer-3d/BearingSymbols.tsx`
  - `frontend/src/features/viewer-3d/tfpKinematics.ts`
  - `frontend/src/test/features/tfpKinematics.test.ts`
  - `README.md`
- Verified this session:
  - `cd frontend && npm test -- --run src/features/bent-build/__tests__/generateBentFrame.test.ts src/test/features/tfpKinematics.test.ts` (`143 passed`)
  - `cd frontend && npm run type-check` (pass)
  - Browser E2E flow via Playwright (pass); screenshot artifact: `/tmp/isovis-full-browser-test.png`
- Earlier research artifact retained: `reports/fixed-base-investigation-2026-03-02.md`
- Not run this session:
  - Full frontend test suite
  - Backend unit/integration suites

## Next Steps
- Do quick manual visual QA on bearing motion/orbit readability in:
  - `3-Span Bridge (Isolated)` time-history
  - a building isolation model time-history
- If preparing for integration/release, run full validation:
  - `cd frontend && npm test`
  - `cd backend && pytest`
  - integration run against live backend
- Decide whether to relabel the current bridge “fixed-base” preset to make released abutment DOFs explicit (if keeping current restraint scheme).
