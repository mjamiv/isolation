"""Tests for the TFP bearing example script.

Verifies that the complete 1-DOF structure + TFP bearing simulation
runs to completion and produces reasonable results.

All tests require openseespy and are skipped gracefully if it is
not available.
"""

from __future__ import annotations

import pytest

# Skip the entire module if openseespy is not installed or incompatible
try:
    import openseespy.opensees  # noqa: F401
except (ImportError, RuntimeError):
    pytest.skip("openseespy not available on this platform", allow_module_level=True)


@pytest.fixture()
def tfp_results():
    """Run the TFP example and cache results for all tests in this module."""
    from app.services.tfp_example import run_tfp_example

    return run_tfp_example()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.slow
class TestTFPExample:
    """Integration tests for the TFP bearing example."""

    def test_runs_to_completion(self, tfp_results):
        """TFP example runs to completion without errors."""
        assert tfp_results is not None
        assert "time" in tfp_results
        assert "bearing_disp" in tfp_results
        assert "bearing_force" in tfp_results
        assert "mass_disp" in tfp_results

    def test_returned_displacements_have_expected_length(self, tfp_results):
        """Returned displacement list should have entries for each converged step."""
        time_vals = tfp_results["time"]
        bearing_disp = tfp_results["bearing_disp"]
        bearing_force = tfp_results["bearing_force"]
        mass_disp = tfp_results["mass_disp"]

        # All arrays should be the same length
        assert len(bearing_disp) == len(time_vals)
        assert len(bearing_force) == len(time_vals)
        assert len(mass_disp) == len(time_vals)

        # Should have completed a reasonable number of steps
        converged = tfp_results["converged_steps"]
        total = tfp_results["total_steps"]
        # At least 50% of steps should have converged for the results
        # to be meaningful
        assert converged > total * 0.5, (
            f"Only {converged}/{total} steps converged"
        )

    def test_peak_displacement_in_reasonable_range(self, tfp_results):
        """Peak bearing displacement should be > 0 and < 1.0 m."""
        peak_disp = tfp_results["peak_disp"]

        # Should have non-zero displacement (the bearing is moving)
        assert peak_disp > 0, "Peak displacement should be positive"

        # Should be within a physically reasonable range for a TFP bearing
        # with these parameters (radii ~0.4-2.0m, 0.3g excitation)
        assert peak_disp < 1.0, (
            f"Peak displacement {peak_disp:.4f} m exceeds 1.0 m -- "
            "check bearing parameters or ground motion amplitude"
        )

    def test_force_displacement_data_is_non_empty(self, tfp_results):
        """Force-displacement data lists should be non-empty."""
        bearing_disp = tfp_results["bearing_disp"]
        bearing_force = tfp_results["bearing_force"]

        assert len(bearing_disp) > 0, "Bearing displacement list is empty"
        assert len(bearing_force) > 0, "Bearing force list is empty"

        # Should have some non-zero force values
        has_nonzero_force = any(abs(f) > 1e-12 for f in bearing_force)
        assert has_nonzero_force, "All bearing forces are zero"

    def test_peak_force_is_positive(self, tfp_results):
        """Peak bearing force should be positive."""
        peak_force = tfp_results["peak_force"]
        assert peak_force > 0, "Peak force should be positive"

    def test_time_values_are_monotonically_increasing(self, tfp_results):
        """Time values should increase monotonically."""
        time_vals = tfp_results["time"]
        for i in range(1, len(time_vals)):
            assert time_vals[i] > time_vals[i - 1], (
                f"Time is not monotonic at index {i}: "
                f"{time_vals[i - 1]} >= {time_vals[i]}"
            )
