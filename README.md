# IsoVis

A web-based Triple Friction Pendulum (TFP) bearing simulation and visualization platform. IsoVis provides an interactive 3D environment for modeling, simulating, and analyzing the seismic response of Triple Friction Pendulum isolators using OpenSeesPy as the computational engine and React Three Fiber for real-time 3D rendering.

## Key Features

- **3D structural viewer** — Interactive node/element/bearing selection, hover highlighting, wireframe/extruded/solid display modes
- **Model editor** — Accordion-based editing for nodes, elements, sections, materials, bearings, diaphragms, loads, and ground motions
- **12 model presets** — The Frame, Long-Span Pavilion, 20-Story Tower, 2-Story 2x2, 3-Span Bridge, Apple Park, LA City Hall, and more (fixed/isolated variants)
- **Bay Build & Bent Build** — Parametric frame and bridge generators with live 3D preview
- **Analysis pipeline** — Static, modal, pushover, and time-history analyses via OpenSeesPy backend
- **Results visualization** — Deformed shapes, mode shapes, plastic hinges, force diagrams, Plotly charts (SVG scatter to avoid WebGL context exhaustion)
- **Time-history playback** — Transport controls, scrubber, speed pills, keyboard shortcuts
- **Ductile vs isolated comparison** — Side-by-side pushover/time-history with ASCE 7-22 lambda factors
- **Rigid diaphragms** — Floor slab modeling with Delaunay triangulation for curved geometries
- **Bearing assembly inspection** — Dedicated 2D canvas overlay (no second WebGL context) with orbit/plan views

## Architecture

- **Frontend**: React 18, TypeScript (strict), Vite 6, React Three Fiber / Drei, Zustand, Radix UI, Tailwind CSS, Plotly.js
- **Backend**: FastAPI, Python 3.11+, OpenSeesPy, NumPy, SciPy, Pydantic v2, Celery + Redis
- **Infrastructure**: Docker (linux/amd64), Docker Compose, Redis

Only **one** WebGL context is allowed — the main 3D viewer. Plotly uses SVG scatter (not scattergl) to avoid context exhaustion.

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- Docker and Docker Compose (optional)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Dev server: `http://localhost:5173`

### Backend (OpenSeesPy via Rosetta)

**CRITICAL**: On Apple Silicon Macs, OpenSeesPy requires an x86_64 conda environment. The backend **must** be started with `isovis-x86` — NOT the local `.venv`.

**VIRTUAL_ENV override**: The `.venv` in `backend/` sets `VIRTUAL_ENV` which overrides conda's PATH. Use `unset VIRTUAL_ENV` and put the conda Python first on PATH.

```bash
# One-time setup
CONDA_SUBDIR=osx-64 conda create -n isovis-x86 python=3.11 -y
conda activate isovis-x86 && conda config --env --set subdir osx-64
pip install openseespy fastapi 'uvicorn[standard]' numpy scipy pydantic pydantic-settings python-multipart websockets

# Start the backend
./start-backend.sh          # normal
./start-backend.sh --reload # with hot-reload
```

API server: `http://localhost:8000`

### Docker (All Services)

```bash
docker-compose up
```

Starts backend API and Redis. Run the frontend separately with `cd frontend && npm run dev`.

### Production Hardening

Optional environment variables: `AUTH_REQUIRED`, `AUTH_API_KEYS`, `RATE_LIMIT_ENABLED`, `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_DEFAULT_MAX`, `RATE_LIMIT_HEAVY_MAX`, `MAX_ANALYSIS_STEPS`, `MAX_MODAL_MODES`, `MAX_GROUND_MOTION_POINTS`, `MAX_SIMULATION_DURATION`.

## Development

```bash
# Frontend tests (511 tests across 28 suites)
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

Pre-commit hooks (husky + lint-staged) run ESLint and Prettier on staged `.ts`/`.tsx` files.

## Project Structure

```
isolation/
  archive/legacy-analysis/   # Archived study outputs and reports
  frontend/
    public/models/           # Preset model JSONs
    src/
      components/ui/         # Shared UI primitives
      features/
        layout/              # AppLayout, Toolbar, StatusBar
        viewer-3d/           # 3D canvas, NodePoints, MemberLines, DeformedShape, etc.
        model-editor/        # Accordion-based model tree
        property-inspector/  # Read-only property panel
        bay-build/           # BayBuildDialog, generateBayFrame
        bent-build/          # BentBuildDialog, generateBentFrame
        controls/            # ViewerControls
        analysis/            # AnalysisDialog, useRunAnalysis, useRunComparison
        playback/            # PlaybackControls
        results/             # ResultsPanel, StaticResults, ModalResults, etc.
        comparison/          # ComparisonPanel
      services/              # API client, model serializer
      stores/                # Zustand stores
      types/                 # TypeScript interfaces
  backend/
    app/
      core/                  # Configuration, settings
      routers/               # API route handlers
      services/              # OpenSeesPy solver
      schemas/               # Pydantic models
    tests/                   # Backend unit tests
  tests/                     # Integration tests
```

## Tech Stack

### Frontend

- React 18, TypeScript (strict), Vite 6
- React Three Fiber / Drei for 3D
- Zustand, Radix UI, Tailwind CSS, Plotly.js
- Vitest, Husky + lint-staged

### Backend

- FastAPI, Python 3.11+
- OpenSeesPy, NumPy, SciPy
- Celery + Redis, Pydantic v2

### Infrastructure

- Docker Compose, Redis

## License

Private - All rights reserved.
