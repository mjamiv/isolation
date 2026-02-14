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
- **Sample model** — 3-story 2-bay steel moment frame loadable from the toolbar

### Phase 2 — Load Editing, Analysis Runner & Results
- **Load Editor** — CRUD for point loads with node selector and force fields; gravity loads auto-created with sample model
- **Ground Motion Editor** — add/edit ground motion records with sample 1 Hz sinusoidal generator
- **Analysis Dialog** — configure and run Static, Modal, or Time-History analyses with type-specific parameters and validation
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
- **Time-history playback** — play/pause, speed control (0.25x-4x), time scrub slider, and `useFrame`-based step driver synchronized with 3D viewer
- **Enhanced backend results** — static results include deformed shape data; modal results include real mass participation ratios; pushover returns capacity curve, hinge states, and deformed shape

### Phase 5 — Ductile vs Isolated Comparison, Lambda Factors & Summary Dashboards
- **Comparison framework** — side-by-side pushover analysis of isolated (with bearings) vs fixed-base (ductile) structural systems via a single "Run Comparison" workflow
- **Auto-generated fixed-base variant** — backend removes bearings and fixes base nodes to create the ductile comparison model automatically
- **ASCE 7-22 Chapter 17 lambda factors** — optional upper/lower bound property modification factors (default 0.85/1.8) that scale bearing friction coefficients for bounding analysis
- **Comparison dashboard** — accordion-based "Compare" tab in the right panel with:
  - Capacity curve overlay (isolated nominal + upper/lower bounds + fixed-base, 4 traces)
  - Key metrics bar (base shear reduction %, isolated/fixed-base shear values)
  - Inter-story drift profile (horizontal bar chart, both variants)
  - Base shear comparison (bar chart + reduction percentage)
  - Bearing demand/capacity ratios (color-coded green/yellow/red with D/C table)
  - Hinge distribution (IO/LS/CP counts grouped by variant)
- **3D overlay visualization** — dual deformed shapes in the 3D viewer (blue for isolated, orange for fixed-base) toggled from the comparison panel
- **AnalysisDialog integration** — "Run Comparison" checkbox appears when model has bearings and pushover is selected; lambda min/max inputs toggle below

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
  frontend/          # React + Three.js client
    src/
      components/ui/ # Shared UI primitives (FormField, IconButton, ConfirmDialog, etc.)
      features/
        layout/      # AppLayout, Toolbar, StatusBar
        viewer-3d/   # 3D canvas, NodePoints, MemberLines, SupportSymbols, BearingSymbols, Labels, DeformedShape, ModeShapeAnimation, PlasticHinges, PlaybackDriver
        model-editor/# Accordion-based model tree with inline editing (loads, ground motions, bearings)
        property-inspector/ # Read-only property panel for selections
        controls/    # ViewerControls (display toggles, scale, color map)
        analysis/    # AnalysisDialog, useRunAnalysis, useRunComparison hooks
        results/     # ResultsPanel, StaticResults, ModalResults, TimeHistoryResults, PushoverResults, PlaybackControls
        comparison/  # ComparisonPanel, DriftProfileChart, BaseShearComparison, BearingDemandCapacity, HingeDistribution
      services/      # API client, WebSocket client, model serializer, comparison metrics
      stores/        # Zustand stores (modelStore, displayStore, analysisStore, comparisonStore)
      types/         # Shared TypeScript interfaces (storeModel.ts, analysis.ts, model.ts)
  backend/           # FastAPI server
    app/
      core/          # Configuration, settings
      routers/       # API route handlers (analysis, models, results, comparison)
      services/      # Business logic, OpenSeesPy
      schemas/       # Pydantic models
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

### Backend Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API server starts at `http://localhost:8000`.

### Docker (All Services)

```bash
docker-compose up
```

This starts the frontend dev server, backend API, and Redis.

## Development

```bash
# Frontend tests (184 tests across 16 suites)
cd frontend && npm test

# Frontend lint
cd frontend && npm run lint

# Backend tests
cd backend && pytest

# Type checking
cd frontend && npx tsc --noEmit
```

## License

Private - All rights reserved.
