# IsoVis

A web-based Triple Friction Pendulum (TFP) bearing simulation and visualization platform.

IsoVis provides an interactive 3D environment for modeling, simulating, and analyzing the seismic response of Triple Friction Pendulum isolators using OpenSeesPy as the computational engine and React Three Fiber for real-time 3D rendering.

## Current Status

Phases 1 through 5 are complete. The app provides:

### Session Update — 2026-03-05 (Bearing Assembly UX & WebGL Stability)
- **Bearing Assembly iso viewer overhaul** — replaced second WebGL `Canvas` with a lightweight 2D canvas renderer to eliminate `Context Lost` crashes; added interactive rotate/pan/zoom controls, size presets (S/M/L), expandable Max mode, optional orbit overlay, Xray transparency toggle, and Reset button.
- **Bearing selection sync** — Assembly and Orbit viewers now share a single `activeBearingId` in `displayStore`; prev/next in either panel updates both.
- **Bearing vertical-scale fix (Bent Build)** — assembly kinematics now use relative displacement only (`dispJ − dispI`), not absolute node offsets, fixing exaggerated vertical separation in Bent Build models.
- **WebGL context exhaustion fix** — switched all Plotly charts from `scattergl` to `scatter` (SVG) across TimeHistoryResults, PushoverResults, and ComparisonPanel; removed the second Three.js Canvas from the assembly widget; only the main 3D viewer retains a WebGL context.
- **Diaphragm deformation sync** — diaphragm planes now use the same z-up displacement convention as the frame (`zUpData || hasBearings`), fixing non-deflecting slabs during time-history playback.
- **Time-step reset on new results** — `analysisStore.setResults` now resets `currentTimeStep` to 0 and stops playback, preventing out-of-range reads that caused white screens on consecutive runs.
- **Playback driver bounds guard** — `PlaybackDriver` now clamps `currentTimeStep` to valid range when results change.

### Session Update — 2026-03-05 (Parallel UX/Analysis Implementation)
- **Time-history blank-panel hardening** — fixed a post-run crash path by normalizing missing/partial `peakValues` in API time-history responses and adding safe metric fallbacks in `TimeHistoryResults`.
- **Separated element response charts** — Time-history element results now render **Shear** and **Moment** in separate charts for readability when moment magnitudes dominate.
- **Deformed diaphragm rendering** — diaphragm planes now follow active deformed node positions (static, pushover, and time-history playback), using the same displacement/scale conventions as other deformed overlays.
- **Selection-driven result filtering** — selecting nodes/elements in the 3D viewer now auto-syncs corresponding selectors in Results views.
- **Model Tree default collapse** — all Model Tree sections now initialize collapsed by default.
- **Bearing visualization redesign** — removed in-scene bearing assembly rendering from the main structural scene and added a dedicated isometric **Bearing Assembly** window that tracks displacement with global deformation scaling.
- **Bearing Orbit controls cleanup** — removed non-working magnification buttons from the Bearing Orbits panel while keeping orbit playback behavior intact.
- **Comparison status clarity** — bottom status bar now reflects comparison lifecycle (`Running Comparison`, `Comparison Complete`, `Comparison Error`) instead of remaining at `Ready`.
- **Pushover diagnostics hardening** — improved 3D hinge demand extraction and added elastic-only diagnostic messaging to clarify why some pushover runs remain linear.

### Phase 1 — Model Editor & 3D Viewer
- **3D structural viewer** with interactive node/element selection, hover highlighting, and support symbols
- **Model Editor** (left panel) with accordion sections for nodes, elements, sections, materials, and bearings — all with inline editing
- **Property Inspector** (right panel) showing read-only details for selected nodes and elements
- **3D labels** on nodes and elements, visible on hover, selection, or global toggle
- **Viewer controls** for display mode, grid, axes, labels, deformation scale, force diagrams, and color maps
- **Model import** — "Load Model" dropdown with 6 presets (20-Story Tower, 2-Story 2x2, 3-Span Bridge — each fixed/isolated) and JSON file import
- **Startup model** — bay-build generated 1x1x1 steel frame (fixed base, rigid diaphragms, 50% live load) auto-loaded on startup

### Phase 2 — Load Editing, Analysis Runner & Results
- **Load Editor** — CRUD for point loads with node selector and force fields; gravity loads auto-created with sample model
- **Ground Motion Editor** — add/edit ground motion records with sample 1 Hz sinusoidal generator
- **Analysis Dialog** — configure and run Static, Modal, or Time-History analyses with type-specific parameters, multi-direction ground motion selection (X/Y/Z checkboxes), and validation
- **Analysis Pipeline** — model serialization, backend submission, status polling, and result fetching via `useRunAnalysis` hook
- **Results Panel** — right panel tab with type-routed views:
  - Static: node displacement and support reaction tables with max highlighting
  - Modal: period, frequency, and mass participation table
  - Time-History: Plotly charts for displacement vs time and bearing hysteresis
- **Model Serializer** — converts Zustand store format to backend `StructuralModel` schema

### Phase 3 — TFP Bearing Model
- **4-surface friction model** — full OpenSeesPy `TripleFrictionPendulum` type with `FrictionSurface` (Coulomb, VelDependent, VelPressureDep), inner/outer pair editing (surfaces 1-2 share values, surfaces 3-4 share values)
- **Bearing CRUD** — BearingList with add/delete and BearingRow with full edit mode (node connectivity, friction params, radii, displacement capacities, advanced section)
- **3D bearing symbols** — purple semi-transparent cylinders at bearing midpoints, click-to-select with shift-multiselect
- **Bearing property inspector** — read-only tables for connectivity, geometry, friction surfaces, and advanced params
- **Bearing serialization** — full round-trip serialization to backend `TripleFrictionPendulum` format
- **Base-isolated sample model** — 3 ground nodes (fixed), 3 base nodes (free), 3 TFP bearings with realistic VelDependent friction
- **Backend consistency** — `transRate` to `trans_rate` snake_case fix across schemas, solver, tests, and fixtures

### Phase 4 — Pushover Analysis, Mode Shapes & Playback
- **Pushover analysis** — displacement-controlled static pushover via OpenSeesPy `DisplacementControl` integrator with linear or first-mode proportional load patterns
- **Pushover UI** — AnalysisDialog supports pushover type with target displacement, push direction, load pattern, and increment controls
- **Pushover results** — capacity curve (base shear vs roof displacement) plotted with Plotly, summary stats (max base shear, ductility ratio), and plastic hinge state table
- **Mode shape visualization** — 3D animated mode shapes using `useFrame()` sinusoidal oscillation; mode selector dropdown and Visualize toggle in ModalResults panel
- **Deformed shape rendering** — semi-transparent blue overlay showing displaced node/member positions for static and time-history results, scaled by user-configurable scale factor
- **Plastic hinge visualization** — color-coded spheres at element ends showing IO/LS/CP performance levels (7 states from elastic/gray to collapse/black)
- **Time-history playback** — industry-grade transport controls (play/pause, step forward/back, skip to start/end, loop toggle) with custom scrubber timeline, speed pills (0.25x-4x), keyboard shortcuts (Space, Arrow keys, Home/End, L), and a requestAnimationFrame-based step driver synchronized with 3D viewer
- **Enhanced backend results** — static results include deformed shape data; modal results include real mass participation ratios; pushover returns capacity curve, hinge states, and deformed shape

### Phase 5 — Ductile vs Isolated Comparison, Lambda Factors & Summary Dashboards
- **Comparison framework** — side-by-side pushover and time-history analysis of isolated (with bearings) vs fixed-base (ductile) structural systems via a single "Run Comparison" workflow
- **Auto-generated fixed-base variant** — backend removes bearings, fixes base nodes, and cleans up orphaned nodes/diaphragms/constraints to create a valid ductile comparison model automatically
- **ASCE 7-22 Chapter 17 lambda factors** — optional upper/lower bound property modification factors (default 0.85/1.8) that scale bearing friction coefficients for bounding analysis
- **Comparison dashboard** — accordion-based "Compare" tab in the right panel with:
  - Capacity curve overlay (isolated nominal + upper/lower bounds + fixed-base, 4 traces)
  - Key metrics bar (base shear reduction %, isolated/fixed-base shear values)
  - Inter-story drift profile (horizontal bar chart, both variants)
  - Base shear comparison (bar chart + reduction percentage)
  - Bearing demand/capacity ratios (color-coded green/yellow/red with D/C table)
  - Hinge distribution (IO/LS/CP counts grouped by variant)
- **3D overlay visualization** — dual deformed shapes in the 3D viewer (blue for isolated, orange for fixed-base) toggled from the comparison panel
- **Time-history comparison** — full side-by-side time-history comparison with reaction-based peak base shear (computed from `ops.nodeReaction` at fixed nodes) and roof displacement metrics, toast notification feedback, and optional chaining for type-safe variant access
- **AnalysisDialog integration** — "Run Comparison" checkbox appears when model has bearings and pushover or time-history is selected; lambda min/max inputs toggle below for pushover

### Auto-Load & Default Analysis Setup
- **Auto-load on startup** — the bay-build 1x1x1 steel startup model (fixed base, rigid diaphragms, 50% LL) loads automatically on first render, so the app is immediately interactive with a 3D model visible
- **5 built-in ground motions** — the startup model ships with realistic synthetic records ordered by increasing intensity:
  - Design 50 (Serviceability) — 2-6 Hz shallow crustal, ~0.10g peak, 10s
  - Long-Duration Subduction — low-frequency dominated, ~0.15g sustained, 30s
  - Harmonic Sweep — chirp 0.5-10Hz, 0.25g peak, 12s
  - El Centro 1940 (Approx) — multi-frequency with envelope, ~0.35g peak, 15s
  - Near-Fault Pulse — Gabor wavelet, ~0.5g peak, 8s
- **Auto-select ground motion** — switching to Time-History analysis auto-selects the first available record, eliminating the manual selection step

### Engineering Analysis Report
- **Full seismic analysis report** — self-contained HTML report (`engineering_report.html`) comparing ductile (fixed-base) vs base-isolated performance for a 3-story hospital essential facility
- **Structure**: St. Claire Memorial Hospital Critical Care Wing — 2-bay, 3-story SMRF with TFP bearings (W14x132 columns, W24x76 beams, W=450 kips)
- **7 inline SVG diagrams** — structural elevation, TFP bearing cross-section, mode shape comparison, pushover capacity curves, drift profiles, base shear bars, plastic hinge map
- **AASHTO compliance** — 12 code checks per AASHTO Guide Specs for Seismic Isolation Design (4th Ed.) and ASCE 7-22 Ch.17, all PASS
- **Key results**: 64% base shear reduction, 93% drift reduction, 0 plastic hinges (vs 15 fixed-base), performance upgraded from Life Safety to Immediate Occupancy
- **Supporting documents**: `analysis_calculations.md` (984 lines of step-by-step calculations), `aashto_compliance.md` (1,029 lines of detailed code compliance review)

### Model Import & Session Persistence
- **Load Model dropdown** — toolbar dropdown with 6 focused presets and an "Import JSON File..." option
- **Preset models**: 20-Story Tower (Fixed/Isolated), 2-Story 2x2 (Fixed/Isolated), 3-Span Bridge (Fixed/Isolated)
- **20-story steel tower** — 1-bay 20'x20' moment frame, 3 column tiers (W14x500/370/257), 3 beam tiers (W36x300/W30x211/W24x146), T1=1.41s, fully verified with all 4 analysis types
- **3-span girder bridge** — 80'-100'-80' continuous steel girder bridge with 6 W36x150 girders at 8'-0" spacing, W24x84 abutment cross-beams, RC pier caps (5'x6' concrete, Ix=1,866,240 in⁴), 2-column W14x257 portal frame piers with 3 sub-elements per column (intermediate nodes at 1/3 and 2/3 height), panel deck diaphragms (`(numGirders - 1) * numSpans * chordsPerSpan`), and 120 psf composite concrete deck dead load. Fixed model has roller abutments (36 nodes, 50 elements). Isolated variant has 24 TFP bearings at all girder support points with upsized pier bearings (R_eff=180", dispCap=30") and RC pier cap beams below the isolation plane (60 nodes, 60 elements)
- **Auto-generated ground motions** — models imported without ground motion records automatically get 5 synthetic records (Serviceability, Subduction, Harmonic, El Centro, Near-Fault) ordered by intensity, enabling immediate time-history analysis starting from low-amplitude events
- **JSON file import** — load any arbitrary model JSON via file picker with validation and toast notifications
- **Session result caching** — analysis results are cached per model name; switching between presets preserves results within a dev session without re-running analyses

### Multi-Directional Time History & Element Property Labels
- **Simultaneous XYZ excitation** — time-history analysis supports multiple concurrent ground motion directions; backend creates separate `UniformExcitation` patterns per direction with unique tags
- **Per-direction scaling** — AnalysisDialog shows X/Y/Z direction inputs with percentage scaling (e.g., 100% X + 30% Z) for realistic multi-directional excitation
- **Y-Z direction swap** — for isolated (bearing) models, the frontend automatically maps Y↔Z directions to match the backend Z-up convention required by TFP elements
- **Element mass labels** — toggle "Show Mass" in Viewer Controls to display tributary mass at element midpoints, derived from gravity loads (`|Fy|/g`) with unit-aware formatting (kip-in, kN-m, etc.)
- **Element stiffness labels** — toggle "Show Stiffness" to display EI/L (flexural) or EA/L (axial) stiffness at element midpoints
- **Adaptive label formatting** — values use appropriate precision: k/M suffixes for large values, 3 decimals for small values, scientific notation for very small values

### Integration Testing & Solver Hardening
- **23/23 integration tests passing** — end-to-end tests through real OpenSeesPy backend across 4 models (Hospital SMRF, Alt A Ductile Bridge, Alt B Isolated Bridge, Alt C Extradosed+TFP) and 5 analysis types (static, modal, pushover, time-history, comparison)
- **Z-up convention for TFP bearings** — TripleFrictionPendulum element requires DOF 3 (Z) as compression direction; solver and test harness auto-convert Y-up models to Z-up for bearing models
- **Bearing parameter separation** — `vert_stiffness` (elastic spring, can be large) vs `kvt` (TFP tension stiffness, must be low ~1.0); prevents convergence failures on bridge-scale models
- **Robust gravity preload** — 50 incremental steps with sub-stepping fallback (10 mini-steps), loosened tolerance (1e-4), multi-algorithm cascade (Newton → ModifiedNewton → KrylovNewton)
- **Static analysis fallback cascade** — non-isolated static runs now use practical convergence settings (`NormDispIncr 1e-6, 100`) with staged fallbacks (ModifiedNewton, KrylovNewton, looser tolerance, then 10 sub-steps) before declaring failure
- **Time-history robustness** — `wipeAnalysis()` between gravity (Static) and transient phases, sub-stepping for failed time steps, relaxed tolerance (1e-5)
- **Per-element vecxz vectors** — 3D elements compute geometric transformation vectors from element direction (vertical→(1,0,0), horizontal→(0,0,1)) to avoid singularities

### Member Discretization & Force Diagram Improvements
- **5:1 member discretization** — backend `_discretize_elements()` splits each `elasticBeamColumn` into 5 sub-elements with 4 internal nodes for improved analytical accuracy across all 4 analysis types
- **In-plane force diagrams** — 2D planar frames (X-Y plane) now project force diagrams in-plane using rotated normals instead of cross-product Z-direction normals
- **Curved deformed shapes** — `DeformedShape` renders polylines through internal discretization nodes, showing member curvature under load
- **Station-based force diagrams** — `ForceDiagrams` assembles values at each member station from discretized sub-element end forces (`i`/`j`) and renders contiguous strips along the full member chain
- **Solver-aligned 3D orientation** — force/moment diagram normals now mirror backend local-axis (`vecxz`) conventions, including z-up isolated-model mapping
- **Discretization data pipeline** — backend returns `discretization_map` and `internal_node_coords` through API normalizers to frontend result types (`StaticResults`, `PushoverResults`, `TimeHistoryResults`)

### Rigid Diaphragm Constraints
- **Floor slab modeling** — rigid diaphragms constrain all nodes at a floor level to move together in-plane using OpenSeesPy `rigidDiaphragm`, modeling floor slabs and bridge decks
- **Full-stack implementation** — `RigidDiaphragm` type with `masterNodeId`, `constrainedNodeIds`, and `perpDirection` (2=Y-perp, 3=Z-perp), stored in modelStore with full CRUD, serialized with Y/Z perpDirection swap for Z-up backend convention
- **3D visualization** — semi-transparent gold floor planes rendered via convex hull (Graham scan) of floor node XZ positions, with gold edge outlines and display toggle in Viewer Controls
- **Model editor** — DiaphragmList/DiaphragmRow accordion section (same pattern as bearings) with master node dropdown, comma-separated constrained nodes, perpDirection select, and label field
- **Preset models** — both 2-Story 2x2 models (fixed + isolated) ship with 2 diaphragms: Floor 1 (nodes 10-18) and Roof (nodes 19-27)
- **Backend schema validation** — `RigidDiaphragmSchema` Pydantic model with node reference validation in `validate_model_integrity`

### Bay Build — Parametric Frame Generator
- **Real-time parametric building** — "Bay Build" button in toolbar opens a dialog with 6 sliders and 3 option controls to generate 3D moment frames on the fly
- **Grid configuration** — X Bays (1-5), Z Bays (1-5), Bay Width X (10-40 ft), Bay Width Z (10-40 ft), Stories (1-10), Story Height (10-20 ft)
- **Material selection** — Steel (A992 Gr50) or Concrete (f'c=4 ksi) with auto-sized sections from lookup tables
- **Auto-sizing** — steel columns (W14x90 through W14x370) sized by stories below, beams (W18x50 through W30x116) sized by span; concrete columns (16" through 32" square) and beams (depth=span/16)
- **Base type** — Fixed (fully restrained base) or Isolated (TFP bearings at every base column with tributary-weighted properties)
- **Rigid diaphragms** — optional per-floor diaphragm constraints
- **Live 3D preview** — model regenerates in real-time as any slider is dragged, updating the 3D viewer instantly
- **Gravity loads** — 120 psf composite dead+live load distributed by tributary area (corner/edge/interior pattern)
- **67 unit tests** — comprehensive test coverage for node counts, element connectivity, auto-sizing, loads, bearings, diaphragms, and edge cases

### Bent Build — Parametric Bridge Generator
- **Real-time parametric bridge** — "Bent Build" button in toolbar opens a dialog to generate multi-span girder bridges with per-pier support configuration
- **Simple startup preset** — Bent Build opens with a straight steel 3-span conventional bridge (`80-100-80 ft`) with no horizontal/vertical curve profile so baseline geometry is immediately clear
- **Span/girder layout** — 1-8 spans with per-span lengths, 3-10 girders, steel (W30-W44) or concrete (AASHTO Type II-VI) girder sections, adjustable roadway width and overhang
- **Pier configuration** — 1-4 bent columns per pier with independent heights, concrete circular RC columns (36-60in) auto-sized by height
- **Support modes** — Conventional supports use FIX monolithic deck-pier connectivity (no equalDOF links on FIX piers) and EXP expansion behavior via equalDOF constraints, with auto-stabilization for mechanism-prone all-EXP cases (single-column bents auto-promote Pier 1 to FIX; multi-column all-EXP adds one longitudinal anchor equalDOF). Isolated mode supports bearing-level TFP at all girder support points, or column-base TFP with rigid deck-to-cap equalDOF links so only the column base isolates
- **Pier cap beams** — distinct `pierCap` element type rendered in stone/gray (substructure) vs gold girders (superstructure); strong-axis section orientation for gravity bending (Ix > Iy); section depth offsets place deck nodes at girder centroid and cap nodes at cap centroid for realistic rigid end geometry
- **AASHTO loads** — dead load components (deck slab, overlay, barriers, utilities, future wearing surface, misc), AASHTO lane live load with multi-presence factors
- **Panel deck diaphragms** — bent-build creates one rigid diaphragm panel per adjacent girder pair and longitudinal segment, with count `(numGirders - 1) * numSpans * chordsPerSpan` (e.g., `3 spans x 5 girders x 1 chord = 12`)
- **Column discretization** — each pier column is split into 3 sub-elements with intermediate nodes at 1/3 and 2/3 height for improved deformed shape visualization (node ID range 4000+)
- **Robust bearing sizing** — TFP bearings use lower friction (inner mu 0.02/0.06, outer 0.04/0.10), larger displacement capacities [6, 25, 6] inches, and weight-scaled vertical stiffness for improved convergence under larger earthquakes
- **Live 3D preview** — model regenerates as any parameter changes
- **134 unit tests** — full coverage of node topology, element connectivity, section sizing, loads, bearings, equalDOF, diaphragms, conventional-support stability logic, section orientation, and deck/cap offsets

### 3D Viewer Enhancements
- **Dynamic scene sizing** — grid, floor plane, camera, orbit controls, fog, and shadows all scale dynamically based on model bounding box via `useModelBounds` hook; models from small 2-story frames to 20-story towers and 3-span bridges always fit cleanly
- **Scene environments** — 4 selectable environment presets (Studio, Outdoor, Dark, Blueprint) with procedural lighting, backgrounds, and ground treatments; no external HDR files
- **Node visibility** — nodes render with bright gold color and emissive glow, clearly visible against all backgrounds
- **Bearing orbit overlay** — collapsible plan-view panel showing real-time isolation bearing displacement orbits during time-history playback with prev/next navigation and capacity circles
- **Bearing assembly window** — separate isometric overlay window for full bearing assembly displacement visualization (decoupled from the main structural render)
- **Bearing displacement emphasis controls** — compare/deformed rendering supports a dedicated vertical expansion scale (`0.5x` to `3.0x`), and displacement markers are rendered at the lower concave stage for clearer bearing motion interpretation
- **Bearing assembly anchoring** — lower and upper bearing assemblies now follow their connected node displacements directly (node I / node J), and relative displacement orbits are plotted at the lower bearing footprint for clearer interpretation
- **Global bearing hysteresis** — hysteresis loop charts use global node displacements and global element forces (not element-local `basicDisplacement`/`basicForce`), producing correct nonlinear loops for multi-directional excitation

### Bug Fixes & Polish
- **3D display modes** — Extruded mode renders semi-transparent box cross-sections with wireframe edges; Solid mode renders opaque lit geometry with MeshStandardMaterial. Both use actual section dimensions (depth, flange width) from the model.
- **Analysis dialog state** — comparison mode checkbox and lambda factor inputs now properly reset when switching analysis types or reopening the dialog
- **Compare overlay modal isolation** — comparison runs clear selected modal mode and suppress mode-shape animation while overlaying fixed/isolated deformed shapes, preventing a third ghost frame from drifting with mismatched scale
- **Post-analysis display defaults** — completed analyses default to deformed shape on (scale factor 100), force/color-map overlays off; isolation defaults bearing displacement on; pushover defaults base shear arrows on; comparison defaults overlay on
- **Model tree defaults** — Model Tree now opens collapsed by default for cleaner startup navigation
- **Load pattern fix** — pushover load pattern values now match backend expectations (`linear`/`first_mode` instead of `uniform`/`firstMode`)
- **Empty tab states** — Results and Compare tabs show centered placeholder messages when no analysis/comparison data exists, with guidance on what to do next
- **Clarity-first right panel UX** — right panel now auto-focuses `Results` after analysis completion, keeps tabpanel DOM order aligned with tab order, and adds clearer empty-state instructions
- **Content readability polish** — comparison labels use explicit terms (`Isolated`, `Fixed-Base`, `Demand/Capacity`), key results/properties include units, and status/empty-state contrast was tuned for dark theme legibility
- **Responsive metrics polish** — comparison metric cards adapt to narrow viewports and results summary now stays sticky while scrolling
- **Local force diagrams** — Backend switched from global `eleResponse("force")` to local `eleResponse("localForce")` for correct force diagram rendering regardless of element orientation
- **Section property key mangling** — Frontend `keysToSnake` converted property keys like `"A"` → `"_a"` and `"Iz"` → `"_iz"`, causing discretized sub-elements to get default stiffness (A=1, E=1). Backend `_prop()` helper now resolves both original and mangled key formats
- **Fixity propagation** — Internal nodes from member discretization now inherit the intersection of endpoint boundary conditions instead of being all-free

### Review Sprint — Security, UX & Code Quality
- **Theme overhaul** — black/white/gold/yellow color scheme replacing all blue/emerald/amber accents, including Tailwind config, 3D viewer colors, and Plotly chart traces
- **Accessibility** — `aria-label` on all icon buttons, `role="alert"` on validation errors, WCAG AA color contrast fixes, always-visible edit/delete buttons (no hover-only)
- **Toast notifications** — lightweight toast system (Zustand store + Toast component) for analysis success/error feedback, auto-dismiss after 5s
- **Security hardening** — CORS restricted to specific methods/headers, Pydantic `max_length` on all model list fields, sanitized error responses (generic client messages + server-side logging)
- **Dependency pinning** — `~` ranges in package.json, `==` exact versions in requirements.txt, package-lock.json committed
- **Code quality** — generic `useRunAsync()` hook extracted from duplicated analysis/comparison hooks, magic numbers replaced with named constants, 69 backend unit tests for solver.py, husky + lint-staged pre-commit hooks

### Phase 6 — End-to-End Hardening & Remediation (2026-03-03)
- **API auth scaffold** — backend routers now use an environment-gated API key dependency (`AUTH_REQUIRED` + `AUTH_API_KEYS`) so local development remains simple while production can enforce auth
- **Public-safe analysis errors** — analysis status returns stable public error messages/codes while preserving full exception details in server logs only
- **Abuse resistance controls** — upper bounds added for `num_steps`, `num_modes`, and ground motion length; time-history runtime now enforces max simulation duration in both analysis and comparison paths
- **Rate limiting** — in-memory per-client throttling added with stricter limits for heavy compute endpoints and default limits for all API routers
- **Least-privilege container runtime** — backend Docker image now runs as a non-root user
- **UX/accessibility fixes** — right panel now has proper ARIA tab semantics, model reset uses non-blocking dialog, sliders and display mode controls have improved labeling, and focus-visible styling is more prominent
- **Responsive baseline** — toolbar wraps on narrow screens, AppLayout includes a mobile stacked fallback, and Tailwind screen breakpoints are explicitly defined
- **Frontend maintainability** — post-analysis display defaults deduplicated into a shared helper, async run hook callback stability improved, and API normalization/error handling refactored for shared typed flows
- **Security operations** — dependency audit workflow added at `.github/workflows/dependency-audit.yml` (initial non-blocking rollout with `npm audit` and `pip-audit`)

## Tech Stack

### Frontend
- **React 18** with TypeScript (strict mode)
- **React Three Fiber / Drei** for 3D visualization
- **Zustand** for state management
- **Radix UI** for accessible accordion, dialog, and select primitives
- **Tailwind CSS** for styling
- **Plotly.js** for response plots
- **Vite** for build tooling
- **Vitest** for testing
- **Husky + lint-staged** for pre-commit hooks

### Backend
- **FastAPI** with Python 3.11+
- **OpenSeesPy** for structural analysis
- **NumPy / SciPy** for numerical computing
- **Celery + Redis** for async task processing
- **Pydantic v2** for data validation

### Infrastructure
- **Docker Compose** for local development
- **PostgreSQL** for persistent storage (future)
- **Redis** for caching and task queue

## Project Structure

```
isolation/
  ibr-study/                 # IBR seismic isolation study outputs
    models/                  # 3 bridge model JSONs (alt-a, alt-b, alt-c)
  reports/                   # Final deliverables (HTML + PDF)
  engineering_report.html    # Self-contained seismic isolation analysis report
  analysis_calculations.md   # Step-by-step structural engineering calculations
  aashto_compliance.md       # AASHTO code compliance review (12 checks)
  frontend/          # React + Three.js client
    public/models/   # Preset model JSONs served by Vite (IBR bridge alternatives)
    src/
      components/ui/ # Shared UI primitives (FormField, IconButton, ConfirmDialog, etc.)
      features/
        layout/      # AppLayout, Toolbar, StatusBar
        viewer-3d/   # 3D canvas, NodePoints, MemberLines (wireframe/extruded/solid), SupportSymbols, BearingSymbols, DiaphragmPlanes, Labels, ElementPropertyLabels, DeformedShape, ModeShapeAnimation, PlasticHinges, PlaybackDriver, BearingDisplacementView, SceneEnvironment
        model-editor/# Accordion-based model tree with inline editing (loads, ground motions, bearings)
        property-inspector/ # Read-only property panel for selections
        bay-build/   # BayBuildDialog, generateBayFrame, sectionTables, bayBuildTypes
        bent-build/  # BentBuildDialog, generateBentFrame, bentSectionTables, bentBuildTypes, bentLoadCalc
        controls/    # ViewerControls (display toggles, scale, color map)
        analysis/    # AnalysisDialog, useRunAnalysis, useRunComparison, useRunAsync hooks
        playback/    # PlaybackControls (shared transport controls, scrubber, keyboard shortcuts)
        results/     # ResultsPanel, StaticResults, ModalResults, TimeHistoryResults, PushoverResults
        comparison/  # ComparisonPanel, DriftProfileChart, BaseShearComparison, BearingDemandCapacity, HingeDistribution
      services/      # API client, WebSocket client, model serializer, comparison metrics
      stores/        # Zustand stores (modelStore, displayStore, analysisStore, comparisonStore, toastStore)
      types/         # Shared TypeScript interfaces (storeModel.ts, analysis.ts, model.ts, modelJSON.ts)
  backend/           # FastAPI server
    app/
      core/          # Configuration, settings
      routers/       # API route handlers (analysis, models, results, comparison)
      services/      # Business logic, OpenSeesPy solver
      schemas/       # Pydantic models
    tests/           # Backend unit tests (mocked OpenSeesPy)
  tests/             # Integration tests (real OpenSeesPy end-to-end)
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+
- Docker and Docker Compose (optional, for containerized development)

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`.

### Backend Setup (OpenSeesPy via Rosetta)

On Apple Silicon Macs, OpenSeesPy requires an x86_64 conda environment:

```bash
# One-time setup
CONDA_SUBDIR=osx-64 conda create -n isovis-x86 python=3.11 -y
conda activate isovis-x86 && conda config --env --set subdir osx-64
pip install openseespy fastapi 'uvicorn[standard]' numpy scipy pydantic pydantic-settings python-multipart websockets

# Start the backend
./start-backend.sh          # normal
./start-backend.sh --reload # with hot-reload
```

The API server starts at `http://localhost:8000`.

For production-oriented hardening, backend supports optional environment settings:
`AUTH_REQUIRED`, `AUTH_API_KEYS`, `RATE_LIMIT_ENABLED`, `RATE_LIMIT_WINDOW_SECONDS`,
`RATE_LIMIT_DEFAULT_MAX`, `RATE_LIMIT_HEAVY_MAX`, `MAX_ANALYSIS_STEPS`,
`MAX_MODAL_MODES`, `MAX_GROUND_MOTION_POINTS`, and `MAX_SIMULATION_DURATION`.

### Docker (All Services)

```bash
docker-compose up
```

This starts the frontend dev server, backend API, and Redis.

## Development

```bash
# Frontend tests (490 tests across 24 suites)
cd frontend && npm test

# Frontend lint
cd frontend && npm run lint

# Backend unit tests (128 tests with mocked OpenSeesPy)
cd backend && pytest

# Integration tests (23 tests, requires running backend)
./start-backend.sh &
python3 tests/integration_test.py

# Type checking
cd frontend && npx tsc --noEmit

# Regenerate bundled 3-span preset diaphragms from model nodes
cd frontend && npm run sync:three-span-diaphragms
```

Pre-commit hooks (husky + lint-staged) automatically run ESLint and Prettier on staged `.ts`/`.tsx` files.

## License

Private - All rights reserved.
