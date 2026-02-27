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
    _define_rigid_diaphragms,
    _discretize_elements,
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
    @staticmethod
    def _minimal_3d_model(*, z_up: bool) -> dict:
        model_info: dict[str, object] = {"name": "3D Test", "ndm": 3, "ndf": 6}
        if z_up:
            model_info["z_up"] = True

        return {
            "model_info": model_info,
            "nodes": [
                {"id": 1, "coords": [0.0, 0.0, 0.0], "fixity": [1, 1, 1, 1, 1, 1]},
                {"id": 2, "coords": [10.0, 0.0, 0.0], "fixity": [0, 0, 0, 0, 0, 0]},
            ],
            "materials": [
                {"id": 1, "type": "Elastic", "name": "Steel", "params": {"E": 29000.0}},
            ],
            "sections": [
                {
                    "id": 1,
                    "type": "Elastic",
                    "name": "Rect",
                    "properties": {"A": 20.0, "Iz": 722.0, "Iy": 121.0, "G": 11154.0, "J": 50.0},
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
            "loads": [],
        }

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

    def test_3d_y_up_keeps_section_axes_and_uses_y_up_reference(self):
        model = self._minimal_3d_model(z_up=False)
        build_model(model)

        _mock_ops.geomTransf.assert_called_once_with("Linear", 1, 0.0, 1.0, 0.0)
        elem_args = _mock_ops.element.call_args_list[0][0]
        # elasticBeamColumn(..., A, E, G, J, Iy, Iz, transfTag)
        assert elem_args[0] == "elasticBeamColumn"
        assert elem_args[8] == pytest.approx(121.0)  # Iy unchanged for Y-up
        assert elem_args[9] == pytest.approx(722.0)  # Iz unchanged for Y-up

    def test_3d_z_up_swaps_section_axes_and_uses_z_up_reference(self):
        model = self._minimal_3d_model(z_up=True)
        build_model(model)

        _mock_ops.geomTransf.assert_called_once_with("Linear", 1, 0.0, 0.0, 1.0)
        elem_args = _mock_ops.element.call_args_list[0][0]
        assert elem_args[0] == "elasticBeamColumn"
        assert elem_args[8] == pytest.approx(722.0)  # Iy <- Iz for Z-up
        assert elem_args[9] == pytest.approx(121.0)  # Iz <- Iy for Z-up


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

    def test_uses_algorithm_fallback_when_first_step_fails(self, minimal_2d_model):
        _mock_ops.analyze.side_effect = [-1, 0]
        _mock_ops.nodeDisp.return_value = 0.0
        _mock_ops.nodeReaction.return_value = 0.0
        _mock_ops.eleResponse.return_value = [0.0] * 6

        result = run_static_analysis(minimal_2d_model)

        assert "node_displacements" in result
        assert call("ModifiedNewton") in _mock_ops.algorithm.call_args_list


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


# ---------------------------------------------------------------------------
# eleResponse uses "localForce" (not "force")
# ---------------------------------------------------------------------------


class TestEleResponseUsesLocalForce:
    """Verify that eleResponse is called with 'localForce' for beam/column
    elements in static, time-history, and pushover analyses."""

    def test_static_uses_local_force(self, minimal_2d_model):
        _mock_ops.analyze.return_value = 0
        _mock_ops.nodeDisp.return_value = 0.0
        _mock_ops.nodeReaction.return_value = 0.0
        _mock_ops.eleResponse.return_value = [0.0] * 6

        run_static_analysis(minimal_2d_model)

        # All eleResponse calls for beam-column elements should use "localForce"
        ele_resp_calls = _mock_ops.eleResponse.call_args_list
        assert len(ele_resp_calls) > 0
        for c in ele_resp_calls:
            assert c[0][1] == "localForce", (
                f"Expected 'localForce' but got '{c[0][1]}'"
            )

    def test_time_history_uses_local_force(self, minimal_2d_model):
        _mock_ops.analyze.return_value = 0
        _mock_ops.eigen.return_value = [100.0]
        _mock_ops.nodeDisp.return_value = 0.0
        _mock_ops.eleResponse.return_value = [0.0] * 6

        run_time_history(minimal_2d_model, [0.1, 0.2], dt=0.01, num_steps=2)

        # Filter eleResponse calls for beam elements (not bearings)
        ele_resp_calls = _mock_ops.eleResponse.call_args_list
        beam_calls = [c for c in ele_resp_calls if c[0][1] not in ("basicForce", "basicDisplacement")]
        assert len(beam_calls) > 0
        for c in beam_calls:
            assert c[0][1] == "localForce", (
                f"Expected 'localForce' but got '{c[0][1]}'"
            )

    def test_pushover_uses_local_force(self, minimal_2d_model):
        _mock_ops.analyze.return_value = 0
        _mock_ops.nodeDisp.return_value = 0.5
        _mock_ops.nodeReaction.return_value = -10.0
        _mock_ops.eleResponse.return_value = [0.0] * 6

        run_pushover_analysis(
            minimal_2d_model, target_displacement=5.0, num_steps=3
        )

        # All eleResponse calls for beam-column elements should use "localForce"
        ele_resp_calls = _mock_ops.eleResponse.call_args_list
        beam_calls = [c for c in ele_resp_calls if c[0][1] not in ("basicForce", "basicDisplacement")]
        assert len(beam_calls) > 0
        for c in beam_calls:
            assert c[0][1] == "localForce", (
                f"Expected 'localForce' but got '{c[0][1]}'"
            )

    def test_bearing_still_uses_basic_force(self, three_story_frame_model):
        """Bearings should use 'basicForce'/'basicDisplacement' (plus 'globalForce'), not 'localForce'."""
        _mock_ops.analyze.return_value = 0
        _mock_ops.eigen.return_value = [100.0]
        _mock_ops.nodeDisp.return_value = 0.0
        _mock_ops.eleResponse.return_value = [0.0] * 12

        run_time_history(
            three_story_frame_model, [0.1], dt=0.01, num_steps=1
        )

        ele_resp_calls = _mock_ops.eleResponse.call_args_list
        # Bearing element tags are 10001, 10002, 10003 (10000 + bearing id)
        bearing_tags = {10000 + b["id"] for b in three_story_frame_model["bearings"]}
        bearing_calls = [
            c for c in ele_resp_calls if c[0][0] in bearing_tags
        ]
        assert len(bearing_calls) > 0
        allowed = ("basicForce", "basicDisplacement", "globalForce")
        for c in bearing_calls:
            assert c[0][1] in allowed, (
                f"Bearing eleResponse should use {allowed}, got '{c[0][1]}'"
            )


# ---------------------------------------------------------------------------
# _discretize_elements fixity propagation
# ---------------------------------------------------------------------------


class TestDiscretizeFixityPropagation:
    """Verify that internal nodes created by _discretize_elements inherit
    fixity from their endpoint nodes (bitwise AND)."""

    def test_2d_in_3d_fixity_propagated(self):
        """When both endpoints have 2D-in-3D fixity [0,0,1,1,1,0],
        internal nodes should inherit the same pattern."""
        model = {
            "model_info": {"ndm": 3, "ndf": 6},
            "nodes": [
                {"id": 1, "coords": [0.0, 0.0, 0.0], "fixity": [0, 0, 1, 1, 1, 0]},
                {"id": 2, "coords": [100.0, 0.0, 0.0], "fixity": [0, 0, 1, 1, 1, 0]},
            ],
            "elements": [
                {"id": 1, "type": "elasticBeamColumn", "nodes": [1, 2], "section_id": 1},
            ],
            "bearings": [],
        }

        result_data, disc_map, int_coords = _discretize_elements(model, ratio=10)

        # 9 internal nodes should be created (ratio=10 -> 9 internal)
        internal_nodes = [
            n for n in result_data["nodes"]
            if n["id"] not in (1, 2)
        ]
        assert len(internal_nodes) == 9

        # Each internal node should have fixity [0,0,1,1,1,0]
        for node in internal_nodes:
            assert node["fixity"] == [0, 0, 1, 1, 1, 0], (
                f"Node {node['id']} has wrong fixity {node['fixity']}, "
                f"expected [0, 0, 1, 1, 1, 0]"
            )

    def test_all_free_endpoints_produce_free_internal(self):
        """When endpoints are all-free [0,0,0,0,0,0], internal nodes
        should also be all-free."""
        model = {
            "model_info": {"ndm": 3, "ndf": 6},
            "nodes": [
                {"id": 1, "coords": [0.0, 0.0, 0.0], "fixity": [0, 0, 0, 0, 0, 0]},
                {"id": 2, "coords": [100.0, 0.0, 0.0], "fixity": [0, 0, 0, 0, 0, 0]},
            ],
            "elements": [
                {"id": 1, "type": "elasticBeamColumn", "nodes": [1, 2], "section_id": 1},
            ],
            "bearings": [],
        }

        result_data, disc_map, int_coords = _discretize_elements(model, ratio=3)

        internal_nodes = [
            n for n in result_data["nodes"]
            if n["id"] not in (1, 2)
        ]
        assert len(internal_nodes) == 2

        for node in internal_nodes:
            assert node["fixity"] == [0, 0, 0, 0, 0, 0], (
                f"Node {node['id']} should be all-free"
            )

    def test_mixed_fixity_uses_bitwise_and(self):
        """When one endpoint is fixed [1,1,1,1,1,1] and the other free
        [0,0,0,0,0,0], AND produces all-free internal nodes."""
        model = {
            "model_info": {"ndm": 3, "ndf": 6},
            "nodes": [
                {"id": 1, "coords": [0.0, 0.0, 0.0], "fixity": [1, 1, 1, 1, 1, 1]},
                {"id": 2, "coords": [100.0, 0.0, 0.0], "fixity": [0, 0, 0, 0, 0, 0]},
            ],
            "elements": [
                {"id": 1, "type": "elasticBeamColumn", "nodes": [1, 2], "section_id": 1},
            ],
            "bearings": [],
        }

        result_data, disc_map, int_coords = _discretize_elements(model, ratio=2)

        internal_nodes = [
            n for n in result_data["nodes"]
            if n["id"] not in (1, 2)
        ]
        assert len(internal_nodes) == 1
        assert internal_nodes[0]["fixity"] == [0, 0, 0, 0, 0, 0]

    def test_2d_model_fixity_propagated(self):
        """2D model (ndf=3) with fixed endpoint produces correct internal fixity."""
        model = {
            "model_info": {"ndm": 2, "ndf": 3},
            "nodes": [
                {"id": 1, "coords": [0.0, 0.0], "fixity": [1, 1, 1]},
                {"id": 2, "coords": [100.0, 0.0], "fixity": [0, 0, 0]},
            ],
            "elements": [
                {"id": 1, "type": "elasticBeamColumn", "nodes": [1, 2], "section_id": 1},
            ],
            "bearings": [],
        }

        result_data, disc_map, int_coords = _discretize_elements(model, ratio=2)

        internal_nodes = [
            n for n in result_data["nodes"]
            if n["id"] not in (1, 2)
        ]
        assert len(internal_nodes) == 1
        # AND of [1,1,1] and [0,0,0] = [0,0,0]
        assert internal_nodes[0]["fixity"] == [0, 0, 0]

    def test_empty_fixity_treated_as_free(self):
        """Nodes with empty fixity lists should be treated as all-free."""
        model = {
            "model_info": {"ndm": 2, "ndf": 3},
            "nodes": [
                {"id": 1, "coords": [0.0, 0.0], "fixity": []},
                {"id": 2, "coords": [100.0, 0.0], "fixity": []},
            ],
            "elements": [
                {"id": 1, "type": "elasticBeamColumn", "nodes": [1, 2], "section_id": 1},
            ],
            "bearings": [],
        }

        result_data, disc_map, int_coords = _discretize_elements(model, ratio=2)

        internal_nodes = [
            n for n in result_data["nodes"]
            if n["id"] not in (1, 2)
        ]
        assert len(internal_nodes) == 1
        assert internal_nodes[0]["fixity"] == [0, 0, 0]


# ---------------------------------------------------------------------------
# Rigid diaphragm tests
# ---------------------------------------------------------------------------


class TestDefineRigidDiaphragms:
    """Tests for _define_rigid_diaphragms helper."""

    def test_calls_rigid_diaphragm_for_each_entry(self):
        """Each diaphragm dict should produce one ops.rigidDiaphragm call."""
        diaphragms = [
            {"perp_direction": 3, "master_node_id": 10, "constrained_node_ids": [11, 12, 13]},
            {"perp_direction": 3, "master_node_id": 20, "constrained_node_ids": [21, 22]},
        ]
        _define_rigid_diaphragms(diaphragms)
        calls = _mock_ops.rigidDiaphragm.call_args_list
        assert len(calls) == 2
        assert calls[0] == call(3, 10, 11, 12, 13)
        assert calls[1] == call(3, 20, 21, 22)

    def test_empty_list_no_calls(self):
        """An empty diaphragm list should not call ops.rigidDiaphragm."""
        _define_rigid_diaphragms([])
        _mock_ops.rigidDiaphragm.assert_not_called()

    def test_single_constrained_node(self):
        """A diaphragm with one slave node should work."""
        _define_rigid_diaphragms([
            {"perp_direction": 2, "master_node_id": 5, "constrained_node_ids": [6]},
        ])
        _mock_ops.rigidDiaphragm.assert_called_once_with(2, 5, 6)

    def test_build_model_without_diaphragms_key(self):
        """build_model should not fail when model_data has no diaphragms key."""
        model = {
            "model_info": {"ndm": 2, "ndf": 3},
            "nodes": [
                {"id": 1, "coords": [0.0, 0.0], "fixity": [1, 1, 1]},
            ],
            "materials": [{"id": 1, "type": "Elastic", "params": {"E": 29000}}],
            "sections": [{"id": 1, "type": "Elastic", "properties": {"A": 10, "Iz": 100}, "material_id": 1}],
            "elements": [],
            "bearings": [],
        }
        # Should not raise — diaphragms key is optional
        build_model(model)
        _mock_ops.rigidDiaphragm.assert_not_called()

    def test_build_model_with_diaphragms(self):
        """build_model should call rigidDiaphragm when diaphragms are provided."""
        model = {
            "model_info": {"ndm": 3, "ndf": 6},
            "nodes": [
                {"id": 10, "coords": [0.0, 0.0, 180.0], "fixity": [0, 0, 0, 0, 0, 0]},
                {"id": 11, "coords": [240.0, 0.0, 180.0], "fixity": [0, 0, 0, 0, 0, 0]},
                {"id": 12, "coords": [480.0, 0.0, 180.0], "fixity": [0, 0, 0, 0, 0, 0]},
            ],
            "materials": [{"id": 1, "type": "Elastic", "params": {"E": 29000}}],
            "sections": [{"id": 1, "type": "Elastic", "properties": {"A": 10, "Iz": 100}, "material_id": 1}],
            "elements": [],
            "bearings": [],
            "diaphragms": [
                {"perp_direction": 3, "master_node_id": 10, "constrained_node_ids": [11, 12]},
            ],
        }
        build_model(model)
        _mock_ops.rigidDiaphragm.assert_called_once_with(3, 10, 11, 12)

    def test_overlapping_panels_merged_into_single_call(self):
        """Panel diaphragms sharing edge nodes should merge into one constraint."""
        # Two panels sharing nodes 2 and 4:
        #   Panel A: master=1, constrained=[2,3,4]
        #   Panel B: master=2, constrained=[4,5,6]
        # Should merge into one call: master=1, slaves=[2,3,4,5,6]
        diaphragms = [
            {"perp_direction": 3, "master_node_id": 1, "constrained_node_ids": [2, 3, 4]},
            {"perp_direction": 3, "master_node_id": 2, "constrained_node_ids": [4, 5, 6]},
        ]
        _define_rigid_diaphragms(diaphragms)
        _mock_ops.rigidDiaphragm.assert_called_once_with(3, 1, 2, 3, 4, 5, 6)

    def test_disjoint_panels_stay_separate(self):
        """Non-overlapping diaphragms should each produce their own call."""
        diaphragms = [
            {"perp_direction": 3, "master_node_id": 1, "constrained_node_ids": [2, 3]},
            {"perp_direction": 3, "master_node_id": 10, "constrained_node_ids": [11, 12]},
        ]
        _define_rigid_diaphragms(diaphragms)
        calls = _mock_ops.rigidDiaphragm.call_args_list
        assert len(calls) == 2

    def test_different_perp_directions_stay_separate(self):
        """Diaphragms with different perpendicular directions should not merge."""
        diaphragms = [
            {"perp_direction": 2, "master_node_id": 1, "constrained_node_ids": [2, 3]},
            {"perp_direction": 3, "master_node_id": 1, "constrained_node_ids": [2, 3]},
        ]
        _define_rigid_diaphragms(diaphragms)
        calls = _mock_ops.rigidDiaphragm.call_args_list
        assert len(calls) == 2


class TestDiscretizationDiaphragmAugmentation:
    """Internal nodes from discretized floor beams should be added to diaphragm constraints."""

    def test_internal_nodes_added_to_diaphragm(self):
        """Discretizing a beam whose endpoints are in a diaphragm should
        add the internal nodes to that diaphragm's constrained list."""
        model = {
            "model_info": {"ndm": 3, "ndf": 6},
            "nodes": [
                {"id": 1, "coords": [0.0, 0.0, 180.0], "fixity": [0, 0, 0, 0, 0, 0]},
                {"id": 2, "coords": [240.0, 0.0, 180.0], "fixity": [0, 0, 0, 0, 0, 0]},
            ],
            "elements": [
                {"id": 1, "type": "elasticBeamColumn", "nodes": [1, 2],
                 "section_id": 1, "transform": "Linear"},
            ],
            "bearings": [],
            "diaphragms": [
                {"perp_direction": 3, "master_node_id": 1, "constrained_node_ids": [2]},
            ],
        }
        data, disc_map, _ = _discretize_elements(model, ratio=3)
        # With ratio=3: 2 internal nodes created on the beam between nodes 1 and 2
        diaph = data["diaphragms"][0]
        # Original constrained = [2], plus 2 internal nodes = 3 total
        assert len(diaph["constrained_node_ids"]) == 3
        # All internal nodes from the chain should be in the constrained list
        chain = disc_map[1]["node_chain"]
        for nid in chain[1:-1]:
            assert nid in diaph["constrained_node_ids"]

    def test_column_internal_nodes_not_added(self):
        """Internal nodes from a column (one endpoint not in diaphragm)
        should NOT be added to the diaphragm."""
        model = {
            "model_info": {"ndm": 3, "ndf": 6},
            "nodes": [
                {"id": 1, "coords": [0.0, 0.0, 0.0], "fixity": [1, 1, 1, 1, 1, 1]},
                {"id": 2, "coords": [0.0, 0.0, 180.0], "fixity": [0, 0, 0, 0, 0, 0]},
                {"id": 3, "coords": [240.0, 0.0, 180.0], "fixity": [0, 0, 0, 0, 0, 0]},
            ],
            "elements": [
                # Column: node 1 (ground) to node 2 (floor) — only node 2 is in diaphragm
                {"id": 1, "type": "elasticBeamColumn", "nodes": [1, 2],
                 "section_id": 1, "transform": "Linear"},
                # Floor beam: both in diaphragm
                {"id": 2, "type": "elasticBeamColumn", "nodes": [2, 3],
                 "section_id": 1, "transform": "Linear"},
            ],
            "bearings": [],
            "diaphragms": [
                {"perp_direction": 3, "master_node_id": 2, "constrained_node_ids": [3]},
            ],
        }
        data, disc_map, _ = _discretize_elements(model, ratio=3)
        diaph = data["diaphragms"][0]
        # Only 2 internal nodes from the floor beam should be added (not from column)
        assert len(diaph["constrained_node_ids"]) == 3  # original [3] + 2 from beam
        # Column internal nodes should NOT be in the list
        column_chain = disc_map[1]["node_chain"]
        for nid in column_chain[1:-1]:
            assert nid not in diaph["constrained_node_ids"]

    def test_no_diaphragms_no_error(self):
        """Discretization with no diaphragms should not error."""
        model = {
            "model_info": {"ndm": 3, "ndf": 6},
            "nodes": [
                {"id": 1, "coords": [0.0, 0.0, 0.0], "fixity": [0, 0, 0, 0, 0, 0]},
                {"id": 2, "coords": [0.0, 0.0, 100.0], "fixity": [0, 0, 0, 0, 0, 0]},
            ],
            "elements": [
                {"id": 1, "type": "elasticBeamColumn", "nodes": [1, 2],
                 "section_id": 1, "transform": "Linear"},
            ],
            "bearings": [],
        }
        data, _, _ = _discretize_elements(model, ratio=3)
        assert "diaphragms" not in data
