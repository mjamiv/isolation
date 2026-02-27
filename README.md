# IsoVis

A web-based Triple Friction Pendulum (TFP) bearing simulation and visualization platform.

IsoVis provides an interactive 3D environment for modeling, simulating, and analyzing the seismic response of Triple Friction Pendulum isolators using OpenSeesPy as the computational engine and React Three Fiber for real-time 3D rendering.

## Current Status

Phases 1 through 5 are complete. The app provides:

### Phase 1 — Model Editor & 3D Viewer
- **3D structural viewer** with interactive node/element selection, hover highlighting, and support symbols
- **Model Editor** (left panel) with accordion sections for nodes, elements, sections, materials, and bearings — all with inline editing
- **Property Inspector** (right panel) showing read-only details for selected nodes and elements
- **3D labels** on nodes and elements, visible on hover, selection, or global toggle
- **Viewer controls** for display mode, grid, axes, labels, deformation scale, force diagrams, and color maps
- **Model import** — "Load Model" dropdown with 6 presets (20-Story Tower, 2-Story 2x2, 3-Span Bridge — each fixed/isolated) and JSON file import
- **Sample model** — 3-story 2-bay steel moment frame auto-loaded on startup

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
- **Time-history playback** — industry-grade transport controls (play/pause, step forward/back, skip to start/end, loop toggle) with custom scrubber timeline, speed pills (0.25x-4x), keyboard shortcuts (Space, Arrow keys, Home/End, L), and `useFrame`-based step driver synchronized with 3D viewer
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
- **Auto-load on startup** — sample model loads automatically on first render, so the app is immediately interactive with a 3D model visible
- **5 built-in ground motions** — sample model ships with realistic synthetic records ordered by increasing intensity:
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
- **3-span girder bridge** — 80'-100'-80' continuous steel girder bridge with 6 W36x150 girders at 8'-0" spacing, W24x84 abutment cross-beams, RC pier caps (4'x5' concrete, Ix=864,000 in⁴), 2-column W14x132 portal frame piers, rigid diaphragms at all support lines, and 120 psf composite concrete deck dead load. Fixed model has roller abutments (Ty+Tz only). Isolated variant has 24 TFP bearings at all girder support points with upsized pier bearings (R_eff=180", dispCap=30") and RC pier cap beams below the isolation plane
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
- **Span/girder layout** — 1-8 spans with per-span lengths, 3-10 girders, steel (W30-W44) or concrete (AASHTO Type II-VI) girder sections, adjustable roadway width and overhang
- **Pier configuration** — 1-4 bent columns per pier with independent heights, concrete circular RC columns (36-60in) auto-sized by height
- **Support modes** — Conventional (FIX monolithic or EXP expansion with equalDOF constraints) with auto-stabilization for mechanism-prone all-EXP cases (single-column bents auto-promote Pier 1 to FIX; multi-column all-EXP adds one longitudinal anchor equalDOF), and Isolated (bearing-level TFP at all girder support points, or column-base TFP)
- **Pier cap beams** — distinct `pierCap` element type rendered in stone/gray (substructure) vs gold girders (superstructure); strong-axis section orientation for gravity bending (Ix > Iy); section depth offsets place deck nodes at girder centroid and cap nodes at cap centroid for realistic rigid end geometry
- **AASHTO loads** — dead load components (deck slab, overlay, barriers, utilities, future wearing surface, misc), AASHTO lane live load with multi-presence factors
- **Rigid diaphragms** — single deck-level diaphragm containing all deck nodes (support lines + chord stations) for full in-plane rigidity, with optional `includeDiaphragms` toggle (perpDirection=2)
- **Robust bearing sizing** — TFP bearings use lower friction (inner mu 0.02/0.06, outer 0.04/0.10), larger displacement capacities [6, 25, 6] inches, and weight-scaled vertical stiffness for improved convergence under larger earthquakes
- **Live 3D preview** — model regenerates as any parameter changes
- **132 unit tests** — full coverage of node topology, element connectivity, section sizing, loads, bearings, equalDOF, deck diaphragm, conventional-support stability logic, section orientation, and deck/cap offsets

### 3D Viewer Enhancements
- **Dynamic scene sizing** — grid, floor plane, camera, orbit controls, fog, and shadows all scale dynamically based on model bounding box via `useModelBounds` hook; models from small 2-story frames to 20-story towers and 3-span bridges always fit cleanly
- **Scene environments** — 4 selectable environment presets (Studio, Outdoor, Dark, Blueprint) with procedural lighting, backgrounds, and ground treatments; no external HDR files
- **Node visibility** — nodes render with bright gold color and emissive glow, clearly visible against all backgrounds
- **Bearing orbit overlay** — collapsible plan-view panel showing real-time isolation bearing displacement orbits during time-history playback with amplification presets (1x-50x), prev/next navigation, and capacity circles
- **Global bearing hysteresis** — hysteresis loop charts use global node displacements and global element forces (not element-local `basicDisplacement`/`basicForce`), producing correct nonlinear loops for multi-directional excitation

### Bug Fixes & Polish
- **3D display modes** — Extruded mode renders semi-transparent box cross-sections with wireframe edges; Solid mode renders opaque lit geometry with MeshStandardMaterial. Both use actual section dimensions (depth, flange width) from the model.
- **Analysis dialog state** — comparison mode checkbox and lambda factor inputs now properly reset when switching analysis types or reopening the dialog
- **Load pattern fix** — pushover load pattern values now match backend expectations (`linear`/`first_mode` instead of `uniform`/`firstMode`)
- **Empty tab states** — Results and Compare tabs show centered placeholder messages when no analysis/comparison data exists, with guidance on what to do next
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

### Docker (All Services)

```bash
docker-compose up
```

This starts the frontend dev server, backend API, and Redis.

## Development

```bash
# Frontend tests (471 tests across 22 suites)
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
```

Pre-commit hooks (husky + lint-staged) automatically run ESLint and Prettier on staged `.ts`/`.tsx` files.

## License

Private - All rights reserved.
