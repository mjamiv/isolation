"""Unit tests for solver.py using mocked OpenSeesPy.

These tests verify solver logic (model building, result parsing,
parameter validation, edge cases) without requiring OpenSeesPy
to be installed. All ``ops`` calls are mocked.
"""

from __future__ import annotations

import math
import sys
from unittest.mock import MagicMock, call, patch

import pytest


# ---------------------------------------------------------------------------
# Create a mock openseespy module so we can import solver.py even when
# OpenSeesPy is not installed.
# ---------------------------------------------------------------------------

_mock_ops = MagicMock()
_mock_openseespy = MagicMock()
_mock_openseespy.opensees = _mock_ops

# Patch into sys.modules BEFORE importing solver
sys.modules.setdefault("openseespy", _mock_openseespy)
sys.modules.setdefault("openseespy.opensees", _mock_ops)

from app.services.solver import (  # noqa: E402
    _assign_mass,
    _compute_deformed_shape,
    _compute_hinge_states,
    _find_section,
    _get_material_E,
    apply_lambda_factor,
    build_model,
    generate_fixed_base_variant,
    run_modal_analysis,
    run_pushover_analysis,
    run_static_analysis,
    run_time_history,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_mock():
    """Reset the ops mock before each test so call history is clean."""
    _mock_ops.reset_mock()
    # Clear side_effect/return_value on frequently-used child mocks
    # (reset_mock alone only clears call history, not side_effect)
    for attr in (
        "analyze", "nodeDisp", "nodeReaction", "eleResponse",
        "eigen", "nodeEigenvector", "rayleigh",
    ):
        child = getattr(_mock_ops, attr)
        child.side_effect = None
        child.return_value = MagicMock()
    yield


# ---------------------------------------------------------------------------
# _find_section
# ---------------------------------------------------------------------------


class TestFindSection:
    def test_finds_existing_section(self, minimal_2d_model):
        sec = _find_section(minimal_2d_model, 1)
        assert sec is not None
        assert sec["name"] == "W14x68"

    def test_returns_none_for_missing_section(self, minimal_2d_model):
        assert _find_section(minimal_2d_model, 999) is None

    def test_returns_none_when_no_sections(self, empty_model):
        assert _find_section(empty_model, 1) is None


# ---------------------------------------------------------------------------
# _get_material_E
# ---------------------------------------------------------------------------


class TestGetMaterialE:
    def test_returns_E_for_valid_material(self, minimal_2d_model):
        E = _get_material_E(minimal_2d_model, 1)
        assert E == 29000.0

    def test_returns_default_for_missing_material(self, minimal_2d_model):
        assert _get_material_E(minimal_2d_model, 999) == 1.0

    def test_returns_default_for_none_id(self, minimal_2d_model):
        assert _get_material_E(minimal_2d_model, None) == 1.0


# ---------------------------------------------------------------------------
# _compute_deformed_shape
# ---------------------------------------------------------------------------


class TestComputeDeformedShape:
    def test_adds_displacements_to_coords(self):
        model_data = {
            "nodes": [
                {"id": 1, "coords": [0.0, 0.0]},
                {"id": 2, "coords": [100.0, 0.0]},
            ]
        }
        disps = {"1": [0.0, 0.0], "2": [0.5, -1.0]}
        result = _compute_deformed_shape(model_data, disps, ndm=2)
        assert result["1"] == pytest.approx([0.0, 0.0])
        assert result["2"] == pytest.approx([100.5, -1.0])

    def test_applies_scale_factor(self):
        model_data = {"nodes": [{"id": 1, "coords": [10.0, 20.0]}]}
        disps = {"1": [1.0, 2.0]}
        result = _compute_deformed_shape(model_data, disps, ndm=2, scale_factor=10.0)
        assert result["1"] == pytest.approx([20.0, 40.0])

    def test_missing_displacement_uses_zero(self):
        model_data = {"nodes": [{"id": 5, "coords": [50.0, 60.0]}]}
        disps = {}  # no displacement for node 5
        result = _compute_deformed_shape(model_data, disps, ndm=2)
        assert result["5"] == pytest.approx([50.0, 60.0])


# ---------------------------------------------------------------------------
# _compute_hinge_states
# ---------------------------------------------------------------------------


class TestComputeHingeStates:
    def test_elastic_forces_produce_no_hinges(self, minimal_2d_model):
        # Small forces relative to section capacity -> elastic (perf_level None)
        forces = {"1": [0.0, 0.0, 0.1, 0.0, 0.0, 0.1]}
        hinges = _compute_hinge_states(minimal_2d_model, forces)
        # Should produce hinge entries but with performance_level None
        for h in hinges:
            assert h["performance_level"] is None

    def test_large_forces_produce_hinges(self, minimal_2d_model):
        # Compute My for the section to determine what constitutes "large"
        sec = minimal_2d_model["sections"][0]
        d = sec["properties"]["d"]
        Iz = sec["properties"]["Iz"]
        E = sec["properties"]["E"]
        S = Iz / (d / 2.0)
        My = (E / 200.0) * S

        # Force > 3*My should give CP level
        big_moment = 4 * My
        forces = {"1": [0.0, 0.0, big_moment, 0.0, 0.0, big_moment]}
        hinges = _compute_hinge_states(minimal_2d_model, forces)
        cp_hinges = [h for h in hinges if h["performance_level"] == "CP"]
        assert len(cp_hinges) > 0

    def test_empty_forces_produce_no_hinges(self, minimal_2d_model):
        hinges = _compute_hinge_states(minimal_2d_model, {})
        assert hinges == []

    def test_short_force_vector_skipped(self, minimal_2d_model):
        # Force vector with fewer than 3 entries
        forces = {"1": [0.0, 0.0]}
        hinges = _compute_hinge_states(minimal_2d_model, forces)
        assert hinges == []

    def test_io_level_classification(self, minimal_2d_model):
        sec = minimal_2d_model["sections"][0]
        d = sec["properties"]["d"]
        Iz = sec["properties"]["Iz"]
        E = sec["properties"]["E"]
        S = Iz / (d / 2.0)
        My = (E / 200.0) * S

        # D/C ratio between 1.0 and 2.0 -> IO
        moment = 1.5 * My
        forces = {"1": [0.0, 0.0, moment, 0.0, 0.0, 0.0]}
        hinges = _compute_hinge_states(minimal_2d_model, forces)
        io_hinges = [h for h in hinges if h["performance_level"] == "IO"]
        assert len(io_hinges) == 1

    def test_ls_level_classification(self, minimal_2d_model):
        sec = minimal_2d_model["sections"][0]
        d = sec["properties"]["d"]
        Iz = sec["properties"]["Iz"]
        E = sec["properties"]["E"]
        S = Iz / (d / 2.0)
        My = (E / 200.0) * S

        # D/C ratio between 2.0 and 3.0 -> LS
        moment = 2.5 * My
        forces = {"1": [0.0, 0.0, moment, 0.0, 0.0, 0.0]}
        hinges = _compute_hinge_states(minimal_2d_model, forces)
        ls_hinges = [h for h in hinges if h["performance_level"] == "LS"]
        assert len(ls_hinges) == 1


# ---------------------------------------------------------------------------
# build_model
# ---------------------------------------------------------------------------


class TestBuildModel:
    def test_calls_ops_model_with_ndm_ndf(self, minimal_2d_model):
        build_model(minimal_2d_model)
        _mock_ops.model.assert_called_once_with("basic", "-ndm", 2, "-ndf", 3)

    def test_creates_nodes(self, minimal_2d_model):
        build_model(minimal_2d_model)
        node_calls = _mock_ops.node.call_args_list
        assert len(node_calls) == 2
        # Node 1 at (0, 0)
        assert node_calls[0] == call(1, 0.0, 0.0)
        # Node 2 at (100, 0)
        assert node_calls[1] == call(2, 100.0, 0.0)

    def test_applies_fixity(self, minimal_2d_model):
        build_model(minimal_2d_model)
        _mock_ops.fix.assert_called_once_with(1, 1, 1, 1)

    def test_creates_elastic_beam_column(self, minimal_2d_model):
        build_model(minimal_2d_model)
        elem_calls = _mock_ops.element.call_args_list
        assert len(elem_calls) == 1
        args = elem_calls[0][0]
        assert args[0] == "elasticBeamColumn"
        assert args[1] == 1  # element id
        assert args[2] == 1  # node i
        assert args[3] == 2  # node j

    def test_creates_geometric_transformation(self, minimal_2d_model):
        build_model(minimal_2d_model)
        _mock_ops.geomTransf.assert_called_once_with("Linear", 1)

    def test_defines_materials(self, minimal_2d_model):
        build_model(minimal_2d_model)
        _mock_ops.uniaxialMaterial.assert_called_once_with("Elastic", 1, 29000.0)

    def test_handles_empty_model(self, empty_model):
        build_model(empty_model)
        _mock_ops.model.assert_called_once()
        _mock_ops.node.assert_not_called()
        _mock_ops.element.assert_not_called()

    def test_handles_steel02_material(self, minimal_2d_model):
        minimal_2d_model["materials"] = [
            {"id": 1, "type": "Steel02", "name": "Steel", "params": {"Fy": 50.0, "E": 29000.0, "b": 0.01}},
        ]
        build_model(minimal_2d_model)
        _mock_ops.uniaxialMaterial.assert_called_once_with("Steel02", 1, 50.0, 29000.0, 0.01)

    def test_handles_vel_dependent_friction(self, minimal_2d_model):
        minimal_2d_model["materials"] = [
            {"id": 1, "type": "VelDependent", "name": "Friction", "params": {"mu_slow": 0.01, "mu_fast": 0.02, "trans_rate": 0.4}},
        ]
        build_model(minimal_2d_model)
        _mock_ops.frictionModel.assert_called_once_with("VelDependent", 1, 0.01, 0.02, 0.4)

    def test_handles_truss_element(self, minimal_2d_model):
        minimal_2d_model["elements"] = [
            {"id": 1, "type": "truss", "nodes": [1, 2], "section_id": 1},
        ]
        build_model(minimal_2d_model)
        elem_call = _mock_ops.element.call_args_list[0]
        assert elem_call[0][0] == "Truss"

    def test_handles_zero_length_element(self, minimal_2d_model):
        minimal_2d_model["elements"] = [
            {"id": 1, "type": "zeroLength", "nodes": [1, 2], "section_id": 1},
        ]
        build_model(minimal_2d_model)
        elem_call = _mock_ops.element.call_args_list[0]
        assert elem_call[0][0] == "zeroLength"

    def test_skips_unknown_element_type(self, minimal_2d_model):
        minimal_2d_model["elements"] = [
            {"id": 1, "type": "unknownType", "nodes": [1, 2]},
        ]
        # Should not raise, just log a warning
        build_model(minimal_2d_model)
        # No element should be created via ops.element
        _mock_ops.element.assert_not_called()

    def test_defaults_ndm_ndf(self):
        model = {"nodes": [], "materials": [], "sections": [], "elements": [], "bearings": []}
        build_model(model)
        _mock_ops.model.assert_called_once_with("basic", "-ndm", 2, "-ndf", 3)

    def test_builds_bearings(self, three_story_frame_model):
        build_model(three_story_frame_model)
        # Should create 3 bearings (TripleFrictionPendulum elements)
        tfp_calls = [
            c for c in _mock_ops.element.call_args_list
            if c[0][0] == "TripleFrictionPendulum"
        ]
        assert len(tfp_calls) == 3

        # Should create 12 friction models (4 per bearing)
        friction_calls = _mock_ops.frictionModel.call_args_list
        assert len(friction_calls) == 12


# ---------------------------------------------------------------------------
# run_static_analysis
# ---------------------------------------------------------------------------


class TestRunStaticAnalysis:
    def test_wipes_before_and_after(self, minimal_2d_model):
        _mock_ops.analyze.return_value = 0
        _mock_ops.nodeDisp.return_value = 0.0
        _mock_ops.nodeReaction.return_value = 0.0
        _mock_ops.eleResponse.return_value = [0.0] * 6

        run_static_analysis(minimal_2d_model)

        # First call should be wipe(), last call should be wipe()
        wipe_calls = [c for c in _mock_ops.method_calls if c[0] == "wipe"]
        assert len(wipe_calls) >= 2

    def test_raises_on_convergence_failure(self, minimal_2d_model):
        _mock_ops.analyze.return_value = -1  # failure

        with pytest.raises(RuntimeError, match="failed to converge"):
            run_static_analysis(minimal_2d_model)

    def test_returns_expected_keys(self, minimal_2d_model):
        _mock_ops.analyze.return_value = 0
        _mock_ops.nodeDisp.return_value = 0.0
        _mock_ops.nodeReaction.return_value = 0.0
        _mock_ops.eleResponse.return_value = [0.0] * 6

        result = run_static_analysis(minimal_2d_model)

        assert "node_displacements" in result
        assert "element_forces" in result
        assert "reactions" in result
        assert "deformed_shape" in result

    def test_collects_displacements_for_all_nodes(self, minimal_2d_model):
        _mock_ops.analyze.return_value = 0
        _mock_ops.nodeDisp.side_effect = lambda nid, dof: 0.1 * nid * dof
        _mock_ops.nodeReaction.return_value = 0.0
        _mock_ops.eleResponse.return_value = [0.0] * 6

        result = run_static_analysis(minimal_2d_model)

        assert "1" in result["node_displacements"]
        assert "2" in result["node_displacements"]
        assert len(result["node_displacements"]["1"]) == 3  # ndf=3

    def test_collects_reactions_for_fixed_nodes(self, minimal_2d_model):
        _mock_ops.analyze.return_value = 0
        _mock_ops.nodeDisp.return_value = 0.0
        _mock_ops.nodeReaction.return_value = -5.0
        _mock_ops.eleResponse.return_value = [0.0] * 6

        result = run_static_analysis(minimal_2d_model)

        # Node 1 is fixed, should have reactions
        assert "1" in result["reactions"]
        # Node 2 is free, should not
        assert "2" not in result["reactions"]

    def test_handles_element_response_exception(self, minimal_2d_model):
        _mock_ops.analyze.return_value = 0
        _mock_ops.nodeDisp.return_value = 0.0
        _mock_ops.nodeReaction.return_value = 0.0
        _mock_ops.eleResponse.side_effect = Exception("Element not found")

        result = run_static_analysis(minimal_2d_model)
        # After discretization, original element 1 is split into sub-elements.
        # All sub-elements should still return empty force lists on exception.
        disc_map = result["discretization_map"]
        assert 1 in disc_map
        for sub_id in disc_map[1]["sub_element_ids"]:
            assert result["element_forces"][str(sub_id)] == []

    def test_applies_nodal_loads(self, minimal_2d_model):
        _mock_ops.analyze.return_value = 0
        _mock_ops.nodeDisp.return_value = 0.0
        _mock_ops.nodeReaction.return_value = 0.0
        _mock_ops.eleResponse.return_value = [0.0] * 6

        run_static_analysis(minimal_2d_model)

        _mock_ops.load.assert_called_once_with(2, 0.0, -10.0, 0.0)


# ---------------------------------------------------------------------------
# run_modal_analysis
# ---------------------------------------------------------------------------


class TestRunModalAnalysis:
    def test_returns_expected_keys(self, minimal_2d_model):
        _mock_ops.eigen.return_value = [100.0]
        _mock_ops.nodeEigenvector.return_value = 1.0

        result = run_modal_analysis(minimal_2d_model, num_modes=1)

        assert "periods" in result
        assert "frequencies" in result
        assert "mode_shapes" in result
        assert "mass_participation" in result

    def test_period_and_frequency_computed_correctly(self, minimal_2d_model):
        omega_sq = 100.0  # eigenvalue
        _mock_ops.eigen.return_value = [omega_sq]
        _mock_ops.nodeEigenvector.return_value = 1.0

        result = run_modal_analysis(minimal_2d_model, num_modes=1)

        omega = math.sqrt(omega_sq)
        expected_T = 2.0 * math.pi / omega
        expected_f = 1.0 / expected_T

        assert result["periods"][0] == pytest.approx(expected_T)
        assert result["frequencies"][0] == pytest.approx(expected_f)

    def test_handles_zero_eigenvalue(self, minimal_2d_model):
        _mock_ops.eigen.return_value = [0.0]
        _mock_ops.nodeEigenvector.return_value = 0.0

        result = run_modal_analysis(minimal_2d_model, num_modes=1)

        assert result["periods"][0] == 0.0
        assert result["frequencies"][0] == 0.0

    def test_multiple_modes(self, minimal_2d_model):
        _mock_ops.eigen.return_value = [100.0, 400.0, 900.0]
        _mock_ops.nodeEigenvector.return_value = 1.0

        result = run_modal_analysis(minimal_2d_model, num_modes=3)

        assert len(result["periods"]) == 3
        assert len(result["frequencies"]) == 3

    def test_mode_shapes_keyed_by_free_nodes(self, minimal_2d_model):
        _mock_ops.eigen.return_value = [100.0]
        _mock_ops.nodeEigenvector.return_value = 0.5

        result = run_modal_analysis(minimal_2d_model, num_modes=1)

        # Mode shape for mode 1 should include node 2 (free) but not node 1 (fixed)
        assert "2" in result["mode_shapes"]["1"]
        assert "1" not in result["mode_shapes"]["1"]

    def test_mass_participation_computed(self, minimal_2d_model):
        _mock_ops.eigen.return_value = [100.0]
        _mock_ops.nodeEigenvector.return_value = 1.0

        result = run_modal_analysis(minimal_2d_model, num_modes=1)

        # Should have participation ratios for X and Y (ndm=2)
        assert "X" in result["mass_participation"]
        assert "Y" in result["mass_participation"]
        assert len(result["mass_participation"]["X"]) == 1


# ---------------------------------------------------------------------------
# run_time_history
# ---------------------------------------------------------------------------


class TestRunTimeHistory:
    def test_returns_expected_keys(self, minimal_2d_model):
        _mock_ops.analyze.return_value = 0
        _mock_ops.eigen.return_value = [100.0]
        _mock_ops.nodeDisp.return_value = 0.0
        _mock_ops.eleResponse.return_value = [0.0]

        gm = [0.1, 0.2, -0.1, -0.2, 0.0]
        result = run_time_history(minimal_2d_model, gm, dt=0.01, num_steps=5)

        assert "time" in result
        assert "node_displacements" in result
        assert "bearing_responses" in result

    def test_time_vector_length(self, minimal_2d_model):
        _mock_ops.analyze.return_value = 0
        _mock_ops.eigen.return_value = [100.0]
        _mock_ops.nodeDisp.return_value = 0.0

        result = run_time_history(
            minimal_2d_model, [0.1, 0.2, 0.0], dt=0.02, num_steps=3
        )

        assert len(result["time"]) == 3
        assert result["time"][0] == pytest.approx(0.02)
        assert result["time"][2] == pytest.approx(0.06)

    def test_stops_on_convergence_failure(self, minimal_2d_model):
        # First step succeeds, second fails with both Newton and ModifiedNewton
        _mock_ops.analyze.side_effect = [0, -1, -1]
        _mock_ops.eigen.return_value = [100.0]
        _mock_ops.nodeDisp.return_value = 0.0

        result = run_time_history(
            minimal_2d_model, [0.1, 0.2, 0.3], dt=0.01, num_steps=3
        )

        # Should have only 1 successful step
        assert len(result["time"]) == 1

    def test_tries_modified_newton_on_failure(self, minimal_2d_model):
        # First analyze fails, ModifiedNewton succeeds
        _mock_ops.analyze.side_effect = [
            -1,  # Newton fails
            0,   # ModifiedNewton succeeds
            0,   # step 2 Newton succeeds
        ]
        _mock_ops.eigen.return_value = [100.0]
        _mock_ops.nodeDisp.return_value = 0.0

        result = run_time_history(
            minimal_2d_model, [0.1, 0.2], dt=0.01, num_steps=2
        )

        # Should switch to ModifiedNewton then back
        algo_calls = [c for c in _mock_ops.algorithm.call_args_list]
        algo_args = [c[0][0] for c in algo_calls]
        assert "ModifiedNewton" in algo_args

    def test_records_bearing_responses(self, three_story_frame_model):
        _mock_ops.analyze.return_value = 0
        _mock_ops.eigen.return_value = [100.0]
        _mock_ops.nodeDisp.return_value = 0.0
        _mock_ops.eleResponse.return_value = [0.5]

        result = run_time_history(
            three_story_frame_model, [0.1], dt=0.01, num_steps=1
        )

        # Should have bearing response entries
        assert len(result["bearing_responses"]) == 3
        for bkey in ["1", "2", "3"]:
            assert bkey in result["bearing_responses"]

    def test_rayleigh_damping_uses_first_mode(self, minimal_2d_model):
        _mock_ops.analyze.return_value = 0
        _mock_ops.eigen.return_value = [100.0]
        _mock_ops.nodeDisp.return_value = 0.0

        run_time_history(minimal_2d_model, [0.1], dt=0.01, num_steps=1)

        _mock_ops.rayleigh.assert_called_once()
        a0 = _mock_ops.rayleigh.call_args[0][0]
        # a0 = 2 * zeta * omega1 = 2 * 0.05 * sqrt(100) = 1.0
        assert a0 == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# run_pushover_analysis
# ---------------------------------------------------------------------------


class TestRunPushoverAnalysis:
    def test_returns_expected_keys(self, minimal_2d_model):
        _mock_ops.analyze.return_value = 0
        _mock_ops.nodeDisp.return_value = 0.5
        _mock_ops.nodeReaction.return_value = -10.0
        _mock_ops.eleResponse.return_value = [0.0] * 6

        result = run_pushover_analysis(
            minimal_2d_model, target_displacement=5.0, num_steps=10
        )

        assert "capacity_curve" in result
        assert "hinge_states" in result
        assert "max_base_shear" in result
        assert "max_roof_displacement" in result
        assert "steps" in result
        assert "deformed_shape" in result

    def test_auto_detects_control_node(self, minimal_2d_model):
        _mock_ops.analyze.return_value = 0
        _mock_ops.nodeDisp.return_value = 0.0
        _mock_ops.nodeReaction.return_value = 0.0
        _mock_ops.eleResponse.return_value = [0.0] * 6

        # Node 2 is at y=0, node 1 is at y=0 — both at same height
        # Topmost free node should be node 2 (only free node)
        run_pushover_analysis(
            minimal_2d_model, target_displacement=1.0, num_steps=2
        )

        # DisplacementControl should use node 2 as control
        dc_calls = [
            c for c in _mock_ops.integrator.call_args_list
            if c[0][0] == "DisplacementControl"
        ]
        assert len(dc_calls) == 1
        assert dc_calls[0][0][1] == 2  # control node

    def test_raises_if_no_free_nodes(self, empty_model):
        # Model has no nodes at all
        with pytest.raises(RuntimeError, match="No free nodes"):
            run_pushover_analysis(empty_model, target_displacement=1.0)

    def test_raises_if_all_nodes_fixed(self):
        model = {
            "model_info": {"ndm": 2, "ndf": 3},
            "nodes": [
                {"id": 1, "coords": [0.0, 0.0], "fixity": [1, 1, 1]},
            ],
            "materials": [],
            "sections": [],
            "elements": [],
            "bearings": [],
            "loads": [],
        }
        with pytest.raises(RuntimeError, match="No free nodes"):
            run_pushover_analysis(model, target_displacement=1.0)

    def test_capacity_curve_has_entries(self, minimal_2d_model):
        step_count = 5
        _mock_ops.analyze.return_value = 0
        _mock_ops.nodeDisp.return_value = 1.0
        _mock_ops.nodeReaction.return_value = -20.0
        _mock_ops.eleResponse.return_value = [0.0] * 6

        result = run_pushover_analysis(
            minimal_2d_model, target_displacement=5.0, num_steps=step_count
        )

        assert len(result["capacity_curve"]) == step_count
        for pt in result["capacity_curve"]:
            assert "base_shear" in pt
            assert "roof_displacement" in pt

    def test_stops_on_convergence_failure(self, minimal_2d_model):
        # Succeeds twice, then fails all three algorithms
        _mock_ops.analyze.side_effect = [
            0,  # gravity
            0,  # step 0 Newton
            0,  # step 1 Newton
            -1, -1, -1,  # step 2: Newton, ModifiedNewton, KrylovNewton all fail
        ]
        _mock_ops.nodeDisp.return_value = 1.0
        _mock_ops.nodeReaction.return_value = -10.0
        _mock_ops.eleResponse.return_value = [0.0] * 6

        result = run_pushover_analysis(
            minimal_2d_model, target_displacement=5.0, num_steps=5
        )

        # Only 2 successful steps
        assert len(result["capacity_curve"]) == 2

    def test_first_mode_load_pattern(self, minimal_2d_model):
        _mock_ops.analyze.return_value = 0
        _mock_ops.eigen.return_value = [100.0]
        _mock_ops.nodeEigenvector.return_value = 0.8
        _mock_ops.nodeDisp.return_value = 1.0
        _mock_ops.nodeReaction.return_value = -10.0
        _mock_ops.eleResponse.return_value = [0.0] * 6

        result = run_pushover_analysis(
            minimal_2d_model,
            target_displacement=5.0,
            num_steps=2,
            load_pattern="first_mode",
        )

        assert len(result["capacity_curve"]) == 2
        # Should have called eigen for first mode extraction
        _mock_ops.eigen.assert_called()

    def test_max_base_shear_computed(self, minimal_2d_model):
        _mock_ops.analyze.return_value = 0
        _mock_ops.nodeDisp.return_value = 1.0
        _mock_ops.nodeReaction.side_effect = lambda nid, dof: -25.0 if dof == 1 else 0.0
        _mock_ops.eleResponse.return_value = [0.0] * 6

        result = run_pushover_analysis(
            minimal_2d_model, target_displacement=5.0, num_steps=3
        )

        assert result["max_base_shear"] > 0


# ---------------------------------------------------------------------------
# generate_fixed_base_variant
# ---------------------------------------------------------------------------


class TestGenerateFixedBaseVariant:
    def test_removes_bearings(self, three_story_frame_model):
        variant = generate_fixed_base_variant(three_story_frame_model)
        assert variant["bearings"] == []

    def test_fixes_bearing_top_nodes(self, three_story_frame_model):
        variant = generate_fixed_base_variant(three_story_frame_model)
        # Bearing top nodes are 1, 2, 3
        for node in variant["nodes"]:
            if node["id"] in (1, 2, 3):
                assert node["fixity"] == [1, 1, 1], (
                    f"Node {node['id']} should be fixed"
                )

    def test_does_not_modify_original(self, three_story_frame_model):
        original_bearing_count = len(three_story_frame_model["bearings"])
        generate_fixed_base_variant(three_story_frame_model)
        assert len(three_story_frame_model["bearings"]) == original_bearing_count

    def test_preserves_other_nodes(self, three_story_frame_model):
        variant = generate_fixed_base_variant(three_story_frame_model)
        # Structural nodes above base should remain unfixed
        for node in variant["nodes"]:
            if node["id"] in (4, 5, 6, 7, 8, 9, 10, 11, 12):
                fixity = node.get("fixity", [])
                is_fixed = fixity and all(f == 1 for f in fixity)
                assert not is_fixed, f"Node {node['id']} should remain free"

    def test_handles_model_with_no_bearings(self, minimal_2d_model):
        variant = generate_fixed_base_variant(minimal_2d_model)
        # Should be essentially unchanged
        assert variant["bearings"] == []
        assert len(variant["nodes"]) == len(minimal_2d_model["nodes"])


# ---------------------------------------------------------------------------
# apply_lambda_factor
# ---------------------------------------------------------------------------


class TestApplyLambdaFactor:
    def test_scales_friction_coefficients(self, three_story_frame_model):
        factor = 1.5
        variant = apply_lambda_factor(three_story_frame_model, factor)

        for bearing in variant["bearings"]:
            for fm in bearing["friction_models"]:
                # Original inner surfaces: mu_slow=0.012, mu_fast=0.018
                # Original outer surfaces: mu_slow=0.018, mu_fast=0.030
                # After scaling by 1.5: inner mu_slow=0.018, mu_fast=0.027
                assert fm["mu_slow"] > 0
                assert fm["mu_fast"] > 0

        # Check specific values for first bearing's first friction model
        fm0 = variant["bearings"][0]["friction_models"][0]
        assert fm0["mu_slow"] == pytest.approx(0.012 * 1.5)
        assert fm0["mu_fast"] == pytest.approx(0.018 * 1.5)

    def test_does_not_modify_original(self, three_story_frame_model):
        original_mu = three_story_frame_model["bearings"][0]["friction_models"][0]["mu_slow"]
        apply_lambda_factor(three_story_frame_model, 2.0)
        assert three_story_frame_model["bearings"][0]["friction_models"][0]["mu_slow"] == original_mu

    def test_preserves_radii_and_weight(self, three_story_frame_model):
        variant = apply_lambda_factor(three_story_frame_model, 1.5)
        for orig, scaled in zip(
            three_story_frame_model["bearings"],
            variant["bearings"],
        ):
            assert scaled["radii"] == orig["radii"]
            assert scaled["weight"] == orig["weight"]
            assert scaled["disp_capacities"] == orig["disp_capacities"]

    def test_factor_of_one_is_identity(self, three_story_frame_model):
        variant = apply_lambda_factor(three_story_frame_model, 1.0)
        for orig, scaled in zip(
            three_story_frame_model["bearings"],
            variant["bearings"],
        ):
            for fm_orig, fm_scaled in zip(
                orig["friction_models"], scaled["friction_models"]
            ):
                assert fm_scaled["mu_slow"] == pytest.approx(fm_orig["mu_slow"])
                assert fm_scaled["mu_fast"] == pytest.approx(fm_orig["mu_fast"])

    def test_handles_no_bearings(self, minimal_2d_model):
        variant = apply_lambda_factor(minimal_2d_model, 2.0)
        assert variant["bearings"] == []


# ---------------------------------------------------------------------------
# _assign_mass
# ---------------------------------------------------------------------------


class TestAssignMass:
    def test_assigns_mass_from_gravity_loads(self, minimal_2d_model):
        _assign_mass(minimal_2d_model)
        # Load is -10 kip vertical, mass = 10/9.81
        _mock_ops.mass.assert_called()
        args = _mock_ops.mass.call_args[0]
        assert args[0] == 2  # node id
        expected_mass = 10.0 / 9.81
        assert args[1] == pytest.approx(expected_mass)

    def test_skips_non_negative_vertical_loads(self, minimal_2d_model):
        minimal_2d_model["loads"] = [
            {"type": "nodal", "node_id": 2, "values": [0.0, 10.0, 0.0]},  # upward
        ]
        _assign_mass(minimal_2d_model)
        _mock_ops.mass.assert_not_called()

    def test_assigns_mass_from_bearing_weight(self, three_story_frame_model):
        # Remove regular loads to isolate bearing mass assignment
        three_story_frame_model["loads"] = []
        _assign_mass(three_story_frame_model)
        # Should assign mass from bearing weights (150 kips each)
        mass_calls = _mock_ops.mass.call_args_list
        assert len(mass_calls) == 3
        for c in mass_calls:
            expected_mass = 150.0 / 9.81
            assert c[0][1] == pytest.approx(expected_mass)
