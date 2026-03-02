# Fixed-Base Investigation (2026-03-02)

## Scope
- Requested review items:
  - Default bridge model (`3-Span Girder Bridge (Fixed-Base)`)
  - Bay-Build fixed option behavior
- Constraint: no major solver/modeling changes in this pass.

## Checks Performed

1. Inspected the fixed bridge preset support restraints in:
   - `frontend/public/models/three-span-bridge-fixed.json`
2. Inspected solver base-shear aggregation logic in:
   - `backend/app/services/solver.py`
3. Cross-checked Bay-Build fixed boundary-condition assumptions in:
   - `frontend/src/features/bay-build/generateBayFrame.ts`
   - `frontend/src/features/bay-build/__tests__/generateBayFrame.test.ts`

## Findings

1. The bridge preset labeled "Fixed-Base" is not fully fixed at abutments.
   - Node restraints at abutments are `[false, true, true, false, false, false]`.
   - Count summary from preset:
     - `fully_fixed`: `4` nodes
     - `abutment_style_release`: `12` nodes
     - `total_nodes`: `36`
   - Interpretation:
     - Longitudinal translation (DOF 1) is released at abutments.
     - This behaves closer to expansion/roller support behavior than fully fixed abutments.

2. Base-shear extraction currently includes only fully fixed nodes.
   - In `solver.py`, fixed nodes are classified with `all(fixity == 1)`.
   - Reactions from partially restrained abutment nodes are excluded from peak base-shear summation.
   - This can make "fixed" bridge metrics look inconsistent with engineering expectation if abutment restraint reactions are expected in reported totals.

3. Bay-Build fixed option uses full base fixity by construction.
   - Base nodes are fully fixed (`[true, true, true, true, true, true]`) in fixed mode.
   - No obvious boundary-condition bug found in generation logic during this pass.
   - If behavior still looks off, likely contributors are modeling assumptions (rigid diaphragm idealization, section sizing stiffness, loading/setup choices), not a simple fixity assignment bug.

## Recommended Next Diagnostic (No Major Rewrite)

1. Add a "Support Condition Summary" panel in the UI before run:
   - Count fully fixed vs partially restrained supports.
   - Explicitly list released DOFs.
2. For bridge presets specifically, rename or relabel support mode where appropriate:
   - e.g., "Fixed Piers + Expansion Abutments" if abutments are intentionally released longitudinally.
3. Add an optional solver metric:
   - Report base shear by support group (`fully_fixed`, `partially_restrained`) so reaction attribution is explicit.
