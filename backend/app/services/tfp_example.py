"""Complete working example: 1-DOF structure on a Triple Friction Pendulum bearing.

This script builds a minimal model with a single TFP isolator beneath a
lumped mass, applies a sinusoidal ground motion, and runs a nonlinear
time-history analysis. It demonstrates the full workflow from model
construction through result extraction.

Run directly::

    python -m backend.app.services.tfp_example

Or from the project root::

    cd /Users/mjamiv/coding/isolation
    python backend/app/services/tfp_example.py

TFP Parameters (realistic values for a building isolator):
    - Surfaces 1 & 3 (inner):  mu_slow=0.012, mu_fast=0.018
    - Surfaces 2 & 4 (outer):  mu_slow=0.018, mu_fast=0.030
    - Velocity transition rate:  0.4 for all surfaces
    - Effective radii:  L1=L3=0.4 m, L2=2.0 m
    - Displacement capacities:  d1=d3=0.05 m, d2=0.4 m
    - Vertical load:  W = 1000 kN
    - Yield displacement:  uy = 0.001 m
    - Vertical stiffness factor:  kvt = 100
    - Minimum vertical force ratio:  minFv = 0.1
    - Convergence tolerance:  tol = 1e-8
"""

from __future__ import annotations

import math
import sys
from typing import Any

import openseespy.opensees as ops


def run_tfp_example() -> dict[str, Any]:
    """Build and analyse a 1-DOF structure on a TFP bearing.

    Returns:
        A dictionary containing:
        - ``time``: list of time values (s).
        - ``bearing_disp``: horizontal displacement history of the bearing (m).
        - ``bearing_force``: horizontal force history in the bearing (kN).
        - ``mass_disp``: absolute displacement of the lumped mass (m).
        - ``peak_disp``: peak bearing displacement (m).
        - ``peak_force``: peak bearing force (kN).
    """
    ops.wipe()

    try:
        # ==================================================================
        # 1) Model geometry  --  2D, 3 DOF per node (ux, uy, rz)
        # ==================================================================
        ops.model("basic", "-ndm", 2, "-ndf", 3)

        # Node 1: ground (fixed)
        # Node 2: top of bearing / lumped mass
        ops.node(1, 0.0, 0.0)
        ops.node(2, 0.0, 0.0)  # same location -- zero-length bearing

        # Fix the base completely
        ops.fix(1, 1, 1, 1)

        # ==================================================================
        # 2) Friction models -- 4 velocity-dependent surfaces
        # ==================================================================
        #   frictionModel VelDependent tag mu_slow mu_fast transRate
        #
        # Surface 1 (inner slider, bottom):
        ops.frictionModel("VelDependent", 1, 0.012, 0.018, 0.4)
        # Surface 2 (outer slider, bottom):
        ops.frictionModel("VelDependent", 2, 0.018, 0.030, 0.4)
        # Surface 3 (inner slider, top):
        ops.frictionModel("VelDependent", 3, 0.012, 0.018, 0.4)
        # Surface 4 (outer slider, top):
        ops.frictionModel("VelDependent", 4, 0.018, 0.030, 0.4)

        # ==================================================================
        # 3) TFP bearing element
        # ==================================================================
        # element TripleFrictionPendulum eleTag iNode jNode
        #   frnTag1 frnTag2 frnTag3 frnTag4
        #   L1 L2 L3
        #   d1 d2 d3
        #   W uy kvt minFv tol

        L1 = 0.4    # effective radius surface 1 (m)
        L2 = 2.0    # effective radius surface 2 (m)
        L3 = 0.4    # effective radius surface 3 (m)
        d1 = 0.05   # displacement capacity surface 1 (m)
        d2 = 0.40   # displacement capacity surface 2 (m)
        d3 = 0.05   # displacement capacity surface 3 (m)
        W  = 1000.0 # vertical load (kN)
        uy = 0.001   # yield displacement (m)
        kvt = 100.0  # vertical stiffness factor
        min_fv = 0.1 # minimum vertical force ratio
        tol = 1.0e-8 # convergence tolerance

        ops.element(
            "TripleFrictionPendulum", 1,  # eleTag
            1, 2,                          # iNode, jNode
            1, 2, 3, 4,                    # frnTag1..4
            L1, L2, L3,                    # radii
            d1, d2, d3,                    # displacement capacities
            W, uy, kvt, min_fv, tol,       # bearing properties
        )

        # ==================================================================
        # 4) Mass at the top node
        # ==================================================================
        g = 9.81  # m/s^2
        mass = W / g  # ~101.94 kg  (kN / (m/s^2) -> kN*s^2/m)
        ops.mass(2, mass, mass, 0.0)  # translational mass in X and Y; no rotational

        # ==================================================================
        # 5) Sinusoidal ground motion
        # ==================================================================
        dt = 0.005           # time step (s)
        duration = 10.0      # total duration (s)
        freq_hz = 1.0        # excitation frequency (Hz)
        amplitude = 0.3 * g  # 0.3 g peak acceleration

        num_gm_points = int(duration / dt) + 1
        gm_accel = [
            amplitude * math.sin(2.0 * math.pi * freq_hz * i * dt)
            for i in range(num_gm_points)
        ]

        # Time series and uniform excitation pattern
        ops.timeSeries("Path", 1, "-dt", dt, "-values", *gm_accel)
        ops.pattern("UniformExcitation", 1, 1, "-accel", 1)  # direction 1 = X

        # ==================================================================
        # 6) Rayleigh damping (2 % critically damped at fundamental period)
        # ==================================================================
        try:
            eigenvalues = ops.eigen(1)
            omega1 = math.sqrt(eigenvalues[0]) if eigenvalues[0] > 0 else 2.0 * math.pi
        except Exception:
            omega1 = 2.0 * math.pi  # fallback ~1 Hz
        zeta = 0.02
        alpha_m = 2.0 * zeta * omega1
        ops.rayleigh(alpha_m, 0.0, 0.0, 0.0)

        # ==================================================================
        # 7) Analysis objects
        # ==================================================================
        ops.constraints("Transformation")
        ops.numberer("RCM")
        ops.system("BandGeneral")
        ops.test("NormDispIncr", 1.0e-8, 30)
        ops.algorithm("Newton")
        ops.integrator("Newmark", 0.5, 0.25)
        ops.analysis("Transient")

        # ==================================================================
        # 8) Run time-history analysis -- record at every step
        # ==================================================================
        num_steps = int(duration / dt)
        time_list: list[float] = []
        bearing_disp_list: list[float] = []
        bearing_force_list: list[float] = []
        mass_disp_list: list[float] = []

        current_time = 0.0
        converged_steps = 0

        for step in range(num_steps):
            ok = ops.analyze(1, dt)

            if ok != 0:
                # Fallback strategy: try ModifiedNewton
                ops.algorithm("ModifiedNewton")
                ok = ops.analyze(1, dt)
                ops.algorithm("Newton")

            if ok != 0:
                # Second fallback: reduce step size
                for sub in range(10):
                    ok = ops.analyze(1, dt / 10.0)
                    if ok != 0:
                        break
                if ok != 0:
                    print(f"[WARNING] Analysis failed at step {step}, t={current_time:.4f} s")
                    break

            current_time += dt
            converged_steps += 1

            # Record bearing displacement (relative displacement between nodes)
            disp_top = ops.nodeDisp(2, 1)   # DOF 1 = horizontal
            disp_bot = ops.nodeDisp(1, 1)
            rel_disp = disp_top - disp_bot

            # Record bearing force via element response
            try:
                elem_force = ops.eleResponse(1, "basicForce")
                horiz_force = elem_force[0] if elem_force else 0.0
            except Exception:
                horiz_force = 0.0

            time_list.append(current_time)
            bearing_disp_list.append(rel_disp)
            bearing_force_list.append(horiz_force)
            mass_disp_list.append(disp_top)

        # ==================================================================
        # 9) Summary
        # ==================================================================
        peak_disp = max(abs(d) for d in bearing_disp_list) if bearing_disp_list else 0.0
        peak_force = max(abs(f) for f in bearing_force_list) if bearing_force_list else 0.0

        results: dict[str, Any] = {
            "time": time_list,
            "bearing_disp": bearing_disp_list,
            "bearing_force": bearing_force_list,
            "mass_disp": mass_disp_list,
            "peak_disp": peak_disp,
            "peak_force": peak_force,
            "converged_steps": converged_steps,
            "total_steps": num_steps,
            "dt": dt,
            "duration": duration,
        }

        return results

    finally:
        ops.wipe()


def print_results(results: dict[str, Any]) -> None:
    """Pretty-print summary of TFP analysis results.

    Args:
        results: Dictionary returned by :func:`run_tfp_example`.
    """
    print("=" * 60)
    print("  TFP Bearing Example -- Nonlinear Time-History Results")
    print("=" * 60)
    print(f"  Duration:          {results['duration']:.1f} s")
    print(f"  Time step:         {results['dt']:.4f} s")
    print(f"  Converged steps:   {results['converged_steps']} / {results['total_steps']}")
    print(f"  Peak bearing disp: {results['peak_disp']:.6f} m")
    print(f"  Peak bearing force:{results['peak_force']:.2f} kN")
    print("-" * 60)

    # Print first and last 5 time steps
    t = results["time"]
    bd = results["bearing_disp"]
    bf = results["bearing_force"]

    print(f"  {'Time (s)':>10}  {'Bearing Disp (m)':>18}  {'Bearing Force (kN)':>20}")
    print(f"  {'-'*10}  {'-'*18}  {'-'*20}")

    n_show = min(5, len(t))
    for i in range(n_show):
        print(f"  {t[i]:10.4f}  {bd[i]:18.8f}  {bf[i]:20.4f}")

    if len(t) > 10:
        print(f"  {'...':>10}  {'...':>18}  {'...':>20}")
        for i in range(len(t) - n_show, len(t)):
            print(f"  {t[i]:10.4f}  {bd[i]:18.8f}  {bf[i]:20.4f}")

    print("=" * 60)

    # Hysteresis summary
    if bd and bf:
        print("\n  Force-Displacement Hysteresis Summary:")
        print(f"    Max positive disp:  {max(bd):.6f} m")
        print(f"    Max negative disp:  {min(bd):.6f} m")
        print(f"    Max positive force: {max(bf):.2f} kN")
        print(f"    Max negative force: {min(bf):.2f} kN")
        print()


if __name__ == "__main__":
    print("Running TFP bearing example...")
    print()
    try:
        results = run_tfp_example()
        print_results(results)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
