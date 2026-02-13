"""Shared pytest fixtures for the IsoVis backend test suite.

Provides reusable model data, bearing configurations, ground motion
records, and a FastAPI TestClient for integration tests.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import pytest

FIXTURES_DIR = Path(__file__).parent / "tests" / "fixtures"


# ---------------------------------------------------------------------------
# Structural model fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def sample_model() -> dict[str, Any]:
    """Return a complete 3-story, 2-bay steel moment frame model dict.

    The model is loaded from the JSON fixture file and represents a
    structure with 12 nodes, 15 elements (9 columns + 6 beams), gravity
    loads, and A992 steel material.
    """
    with open(FIXTURES_DIR / "sample_model.json") as f:
        return json.load(f)


@pytest.fixture()
def sample_tfp_bearing() -> dict[str, Any]:
    """Return a TFP bearing configuration dict with realistic parameters.

    Four velocity-dependent friction surfaces, three effective radii,
    three displacement capacities, and a 1000 kN vertical load.
    """
    with open(FIXTURES_DIR / "sample_tfp_bearing.json") as f:
        return json.load(f)


@pytest.fixture()
def sample_ground_motion() -> dict[str, Any]:
    """Return a simple sinusoidal ground motion record.

    Parameters:
        - Peak acceleration: 0.5 g
        - Frequency: 1 Hz
        - Duration: 20 seconds
        - dt: 0.01 s
    """
    g = 9.81  # m/s^2
    dt = 0.01
    duration = 20.0
    freq_hz = 1.0
    amplitude = 0.5 * g

    num_points = int(duration / dt) + 1
    acceleration = [
        amplitude * math.sin(2.0 * math.pi * freq_hz * i * dt)
        for i in range(num_points)
    ]

    return {
        "dt": dt,
        "acceleration": acceleration,
        "direction": 1,
        "scale_factor": 1.0,
        "duration": duration,
        "pga": amplitude,
        "frequency": freq_hz,
    }


# ---------------------------------------------------------------------------
# FastAPI TestClient
# ---------------------------------------------------------------------------


@pytest.fixture()
def api_client():
    """Return a FastAPI TestClient for the IsoVis application.

    The client resets the in-memory model and analysis stores before
    each test so tests remain isolated.
    """
    from fastapi.testclient import TestClient

    from app.main import app
    from app.routers.models import _model_store
    from app.routers.analysis import _analysis_store

    # Clear stores for isolation
    _model_store.clear()
    _analysis_store.clear()

    return TestClient(app)


# ---------------------------------------------------------------------------
# Analysis parameter fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def analysis_params_static() -> dict[str, Any]:
    """Return static (gravity) analysis parameters."""
    return {"type": "static"}


@pytest.fixture()
def analysis_params_modal() -> dict[str, Any]:
    """Return modal analysis parameters requesting 6 modes."""
    return {"type": "modal", "num_modes": 6}


@pytest.fixture()
def analysis_params_time_history(sample_ground_motion: dict) -> dict[str, Any]:
    """Return time-history analysis parameters with ground motion."""
    return {
        "type": "time_history",
        "dt": sample_ground_motion["dt"],
        "num_steps": len(sample_ground_motion["acceleration"]),
        "ground_motions": [
            {
                "dt": sample_ground_motion["dt"],
                "acceleration": sample_ground_motion["acceleration"],
                "direction": 1,
                "scale_factor": 1.0,
            }
        ],
    }
