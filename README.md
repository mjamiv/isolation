# IsoVis

A web-based Triple Friction Pendulum (TFP) bearing simulation and visualization platform.

IsoVis provides an interactive 3D environment for modeling, simulating, and analyzing the seismic response of Triple Friction Pendulum isolators using OpenSeesPy as the computational engine and React Three Fiber for real-time 3D rendering.

## Tech Stack

### Frontend
- **React 18** with TypeScript (strict mode)
- **React Three Fiber / Drei** for 3D visualization
- **Zustand** for state management
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
      components/    # Shared UI components
      features/      # Feature-based modules
      stores/        # Zustand state stores
      types/         # TypeScript type definitions
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
# Frontend tests
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
