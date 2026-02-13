"""Unit tests for the OpenSeesPy solver module.

Tests cover model building, static analysis, and modal analysis.
All tests require openseespy to be installed and are skipped
gracefully otherwise.
"""

from __future__ import annotations

import pytest

try:
    import openseespy.opensees as ops  # noqa: F401
except (ImportError, RuntimeError):
    pytest.skip("openseespy not available on this platform", allow_module_level=True)


# ---------------------------------------------------------------------------
# Minimal 2-node beam model for solver tests
# ---------------------------------------------------------------------------


def _minimal_beam_model() -> dict:
    """Return a minimal 2-node cantilever beam model dict.

    A single beam from node 1 (fixed) to node 2 (free) with an
    elastic material and section. This is the simplest model that
    exercises the full build_model path.
    """
    return {
        "model_info": {"name": "Cantilever", "ndm": 2, "ndf": 3},
        "nodes": [
            {"id": 1, "coords": [0.0, 0.0], "fixity": [1, 1, 1]},
            {"id": 2, "coords": [100.0, 0.0], "fixity": []},
        ],
        "materials": [
            {"id": 1, "type": "Elastic", "name": "Steel", "params": {"E": 29000.0}},
        ],
        "sections": [
            {
                "id": 1,
                "type": "WideFlange",
                "name": "W14x68",
                "properties": {"A": 20.0, "Iz": 722.0, "Iy": 121.0, "E": 29000.0},
                "material_id": 1,
            },
        ],
        "elements": [
            {
                "id": 1,
                "type": "elasticBeamColumn",
                "nodes": [1, 2],
                "section_id": 1,
                "transform": "Linear",
            },
        ],
        "bearings": [],
        "loads": [
            {"type": "nodal", "node_id": 2, "values": [0.0, -10.0, 0.0]},
        ],
    }


# ---------------------------------------------------------------------------
# build_model
# ---------------------------------------------------------------------------


@pytest.mark.slow
class TestBuildModel:
    """Tests for the build_model function."""

    def test_build_model_creates_opensees_model(self):
        """build_model creates an OpenSees model without errors."""
        from app.services.solver import build_model

        ops.wipe()
        model_data = _minimal_beam_model()
        # Should not raise any exceptions
        build_model(model_data)
        ops.wipe()

    def test_build_model_creates_correct_nodes(self):
        """After build_model, nodes should exist in the domain."""
        from app.services.solver import build_model

        ops.wipe()
        model_data = _minimal_beam_model()
        build_model(model_data)

        # Node 2 (free end) should have coords (100, 0)
        coord = ops.nodeCoord(2)
        assert coord[0] == pytest.approx(100.0)
        assert coord[1] == pytest.approx(0.0)
        ops.wipe()


# ---------------------------------------------------------------------------
# run_static_analysis
# ---------------------------------------------------------------------------


@pytest.mark.slow
class TestStaticAnalysis:
    """Tests for the run_static_analysis function."""

    def test_returns_expected_displacement_format(self):
        """run_static_analysis returns dict with node_displacements key."""
        from app.services.solver import run_static_analysis

        model_data = _minimal_beam_model()
        results = run_static_analysis(model_data)

        assert "node_displacements" in results
        assert "element_forces" in results
        assert "reactions" in results

        # Should have displacements for both nodes
        assert "1" in results["node_displacements"]
        assert "2" in results["node_displacements"]

        # Displacements should be lists of floats
        disp = results["node_displacements"]["2"]
        assert isinstance(disp, list)
        assert len(disp) == 3  # ndf=3

    def test_free_end_deflects_under_load(self):
        """The free end should have non-zero displacement under load."""
        from app.services.solver import run_static_analysis

        model_data = _minimal_beam_model()
        results = run_static_analysis(model_data)

        # Node 2 should deflect downward (negative Y displacement)
        disp_y = results["node_displacements"]["2"][1]
        assert disp_y < 0, f"Expected negative Y displacement, got {disp_y}"

    def test_fixed_end_has_zero_displacement(self):
        """The fixed end should have approximately zero displacement."""
        from app.services.solver import run_static_analysis

        model_data = _minimal_beam_model()
        results = run_static_analysis(model_data)

        disp = results["node_displacements"]["1"]
        for d in disp:
            assert d == pytest.approx(0.0, abs=1e-10)


# ---------------------------------------------------------------------------
# run_modal_analysis
# ---------------------------------------------------------------------------


@pytest.mark.slow
class TestModalAnalysis:
    """Tests for the run_modal_analysis function."""

    def test_returns_periods_and_mode_shapes(self):
        """run_modal_analysis returns periods, frequencies, mode_shapes."""
        from app.services.solver import run_modal_analysis

        model_data = _minimal_beam_model()
        # Assign mass to the free node for eigenvalue analysis
        model_data["loads"] = [
            {"type": "nodal", "node_id": 2, "values": [0.0, -10.0, 0.0]},
        ]
        results = run_modal_analysis(model_data, num_modes=1)

        assert "periods" in results
        assert "frequencies" in results
        assert "mode_shapes" in results

        assert len(results["periods"]) == 1
        assert len(results["frequencies"]) == 1
        # Period should be positive
        assert results["periods"][0] > 0

    def test_frequency_equals_inverse_period(self):
        """Frequency should equal 1/period."""
        from app.services.solver import run_modal_analysis

        model_data = _minimal_beam_model()
        model_data["loads"] = [
            {"type": "nodal", "node_id": 2, "values": [0.0, -10.0, 0.0]},
        ]
        results = run_modal_analysis(model_data, num_modes=1)

        T = results["periods"][0]
        f = results["frequencies"][0]
        assert f == pytest.approx(1.0 / T, rel=1e-6)
