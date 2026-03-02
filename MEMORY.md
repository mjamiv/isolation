# MEMORY

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
- Git status: clean except untracked `.mcp.json`
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
