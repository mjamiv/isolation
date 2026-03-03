# MEMORY

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
