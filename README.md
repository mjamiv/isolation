# IsoVis

A web-based Triple Friction Pendulum (TFP) bearing simulation and visualization platform.

IsoVis provides an interactive 3D environment for modeling, simulating, and analyzing the seismic response of Triple Friction Pendulum isolators using OpenSeesPy as the computational engine and React Three Fiber for real-time 3D rendering.

## Current Status

Phases 1 and 2 are complete. The app provides:

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

Phase 3 (advanced bearing modeling, nonlinear analysis, pushover) is not yet started.

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
        viewer-3d/   # 3D canvas, NodePoints, MemberLines, SupportSymbols, Labels
        model-editor/# Accordion-based model tree with inline editing (loads, ground motions)
        property-inspector/ # Read-only property panel for selections
        controls/    # ViewerControls (display toggles, scale, color map)
        analysis/    # AnalysisDialog, useRunAnalysis hook
        results/     # ResultsPanel, StaticResults, ModalResults, TimeHistoryResults
      services/      # API client, WebSocket client, model serializer
      stores/        # Zustand stores (modelStore, displayStore, analysisStore)
      types/         # Shared TypeScript interfaces (storeModel.ts, analysis.ts, model.ts)
  backend/           # FastAPI server
    app/
      core/          # Configuration, settings
      routers/       # API route handlers
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
# Frontend tests (75 tests across 5 suites)
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
