# MEMORY

## Completed Work
- Fixed time-history comparison flow end-to-end (4 root causes):
  1. No user feedback on comparison start — added toast notification
  2. `VariantResult.pushoverResults` was required but absent for TH — made optional with null guards
  3. Backend `_run_variant_time_history()` returned zero peak metrics — added computation from raw TH data
  4. `generate_fixed_base_variant()` left orphaned nodes/diaphragms/constraints — added cleanup logic
- Replaced bent build strip diaphragms with single deck-level diaphragm (all deck nodes in one rigid body)
- Added `includeDiaphragms` boolean toggle to BentBuildParams + UI checkbox (default: true)
- Improved TFP bearing sizing in bent build: lower friction (inner 0.02/0.06, outer 0.04/0.10), larger disp caps [6,25,6], weight-scaled vertStiffness
- Added 5th ground motion "Design 50 (Serviceability)" at ~0.10g for low-intensity testing
- Reordered all GMs by increasing peak acceleration (0.10g → 0.15g → 0.25g → 0.35g → 0.50g)

## Key Decisions / Tradeoffs
- Single deck diaphragm (not per-span panels) chosen for simplicity — the deck slab acts as one rigid body in-plane
- Bearing friction reduced to improve sliding initiation under moderate earthquakes while maintaining stability
- Displacement capacities doubled ([3,18,3] → [6,25,6]) to provide headroom for 0.5g+ events
- Weight-scaled vertical stiffness (`Math.max(9000, weight*50)`) ensures heavier bearings get proportionally stiffer support

## Current State
- All tests pass: 471 frontend (22 suites), 128 backend (2 skipped), clean TypeScript build
- Comparison works for both pushover AND time-history analysis types
- 5 ground motions available, ordered by intensity
- Bent build diaphragms now cover full deck as single rigid body with optional disable

## Next Steps
- Run live browser QA on comparison feature (time-history with isolated model)
- Test bent build with diaphragms disabled vs enabled to verify solver behavior
- Run integration tests to verify comparison + new GM work end-to-end through real OpenSeesPy
- Consider per-span panel diaphragms if single-deck approach over-constrains long multi-span bridges
