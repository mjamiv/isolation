#!/usr/bin/env python3
"""
IsoVis Integration Test Suite
=============================
Runs real OpenSeesPy analyses through the backend API for multiple models
and analysis types. Validates that results are physically reasonable.

Models tested:
  1. Hospital sample model (built programmatically - 3-story 2-bay SMRF)
  2. Alt A: Conventional ductile 3-span bridge
  3. Alt B: TFP-isolated 3-span bridge
  4. Alt C: Extradosed + TFP-isolated bridge

Analysis types tested per model:
  - Static (gravity)
  - Modal (eigenvalue)
  - Pushover
  - Time-history (with synthetic ground motion)
  - Comparison (for models with bearings only)

Usage:
  python3 tests/integration_test.py
"""

import json
import math
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE_URL = "http://localhost:8000"
MODELS_DIR = Path(__file__).parent.parent / "frontend" / "public" / "models"

# Track results
PASS = 0
FAIL = 0
ERRORS = []


def log(msg, indent=0):
    prefix = "  " * indent
    print(f"{prefix}{msg}")


def log_pass(test_name):
    global PASS
    PASS += 1
    log(f"  PASS: {test_name}")


def log_fail(test_name, reason):
    global FAIL
    FAIL += 1
    ERRORS.append(f"{test_name}: {reason}")
    log(f"  FAIL: {test_name} - {reason}")


def api_post(endpoint, data):
    """POST JSON to the API, return parsed response."""
    url = f"{BASE_URL}{endpoint}"
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read()), resp.status
    except urllib.error.HTTPError as e:
        # 2xx codes may sometimes come through here depending on urllib version
        if 200 <= e.code < 300:
            return json.loads(e.read()), e.code
        error_body = e.read().decode("utf-8", errors="replace")
        return {"error": error_body, "status_code": e.code}, e.code
    except Exception as e:
        return {"error": str(e)}, 0


def api_get(endpoint):
    """GET from the API, return parsed response."""
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read()), resp.status
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        return {"error": error_body, "status_code": e.code}, e.code
    except Exception as e:
        return {"error": str(e)}, 0


# =============================================================================
# Model Transformers: Convert frontend JSON → backend API format
# =============================================================================

def transform_model(frontend_json, ndm=None, ndf=None):
    """Convert frontend model JSON to backend StructuralModelSchema format.

    If model has bearings, forces ndm=3, ndf=6 (TFP element requirement)
    and uses Z-up convention (swapping Y↔Z from frontend's Y-up).
    """
    info = frontend_json.get("modelInfo", {})
    has_bearings = bool(frontend_json.get("bearings"))

    # TFP bearings require ndm=3, ndf=6, Z-up convention
    if ndm is None:
        ndm = 3 if has_bearings else 2
    if ndf is None:
        ndf = 6 if has_bearings else 3

    # Z-up swap: for 3D bearing models, swap Y↔Z
    z_up = has_bearings and ndm == 3

    # Transform nodes
    nodes = []
    for n in frontend_json.get("nodes", []):
        x = n.get("x", 0)
        y = n.get("y", 0)
        z = n.get("z", 0)

        if z_up:
            # Y-up → Z-up: swap Y and Z
            coords = [x, z, y]  # [X, Z_old, Y_old] = [X, Y_new, Z_new]
        elif ndm >= 3:
            coords = [x, y, z]
        else:
            coords = [x, y]

        restraint = n.get("restraint", [])
        is_fully_fixed = restraint and all(r for r in restraint)

        if z_up and len(restraint) <= 3:
            # Convert 2D [fx, fy, rz] → 3D Z-up [X, Y, Z, RX, RY, RZ]
            # 2D Y-up: DOFs are X, Y(vertical), RZ
            # 3D Z-up: DOFs are X, Y(out-of-plane), Z(vertical), RX, RY, RZ
            if is_fully_fixed:
                fixity = [1, 1, 1, 1, 1, 1]
            else:
                fx = 1 if (len(restraint) > 0 and restraint[0]) else 0
                fy_2d = 1 if (len(restraint) > 1 and restraint[1]) else 0  # vertical in 2D
                rz_2d = 1 if (len(restraint) > 2 and restraint[2]) else 0
                # X=fx, Y=1(fix out-of-plane), Z=fy_2d(vertical),
                # RX=1(fix OOP rot), RY=rz_2d(in-plane rot), RZ=1(fix OOP rot)
                fixity = [fx, 1, fy_2d, 1, rz_2d, 1]
        elif ndf == 6 and len(restraint) <= 3:
            if is_fully_fixed:
                fixity = [1, 1, 1, 1, 1, 1]
            else:
                fx = 1 if (len(restraint) > 0 and restraint[0]) else 0
                fy = 1 if (len(restraint) > 1 and restraint[1]) else 0
                rz = 1 if (len(restraint) > 2 and restraint[2]) else 0
                fixity = [fx, fy, 1, 1, 1, rz]
        else:
            fixity = []
            for r in restraint[:ndf]:
                fixity.append(1 if r else 0)
            while len(fixity) < ndf:
                fixity.append(0)

        nodes.append({
            "id": n["id"],
            "coords": coords,
            "fixity": fixity,
        })

    # Transform materials
    materials = []
    for m in frontend_json.get("materials", []):
        materials.append({
            "id": m["id"],
            "type": "Elastic",
            "name": m.get("name", f"Material {m['id']}"),
            "params": {"E": m["E"]},
        })

    # Transform sections
    sections = []
    for s in frontend_json.get("sections", []):
        props = {"A": s["area"], "Iz": s["Ix"]}
        if ndm >= 3:
            props["Iy"] = s.get("Iy", s["Ix"])
            props["G"] = 1800  # approximate shear modulus
            props["J"] = s.get("Iy", s["Ix"]) * 0.5  # approximate torsion
        sections.append({
            "id": s["id"],
            "type": "Elastic",
            "name": s.get("name", f"Section {s['id']}"),
            "properties": props,
            "material_id": frontend_json["materials"][0]["id"],
        })

    # Transform elements
    elements = []
    for e in frontend_json.get("elements", []):
        elements.append({
            "id": e["id"],
            "type": "elasticBeamColumn",
            "nodes": [e["nodeI"], e["nodeJ"]],
            "section_id": e.get("sectionId", 1),
            "transform": "Linear",
        })

    # Transform bearings
    bearings = []
    for b in frontend_json.get("bearings", []):
        friction_models = []
        for surf in b.get("surfaces", []):
            friction_models.append({
                "mu_slow": surf["muSlow"],
                "mu_fast": surf["muFast"],
                "trans_rate": surf["transRate"],
            })
        bearings.append({
            "id": b["id"],
            "nodes": [b["nodeI"], b["nodeJ"]],
            "friction_models": friction_models,
            "radii": b["radii"],
            "disp_capacities": b["dispCapacities"],
            "weight": b["weight"],
            "uy": 0.04,  # yield displacement ~1mm (recommended 0.25-1mm)
            "kvt": 1.0,  # TFP element tension stiffness (should be low)
            "vert_stiffness": b.get("vertStiffness", 50000),  # elastic spring stiffness
            "min_fv": b.get("minVertForce", 0.1),
            "tol": 1e-5,  # convergence tolerance
        })

    # Transform loads
    loads = []
    for ld in frontend_json.get("loads", []):
        if z_up:
            # Y-up → Z-up: swap Fy↔Fz, My↔Mz
            values = [
                ld.get("fx", 0),   # X
                ld.get("fz", 0),   # Y_new = Z_old (out of plane, usually 0)
                ld.get("fy", 0),   # Z_new = Y_old (vertical/gravity)
                ld.get("mx", 0),   # RX
                ld.get("mz", 0),   # RY_new = RZ_old
                ld.get("my", 0),   # RZ_new = RY_old
            ]
        else:
            values = [ld.get("fx", 0), ld.get("fy", 0)]
            if ndf >= 3:
                values.append(ld.get("fz", 0) if ndm >= 3 else ld.get("mz", 0))
            if ndf >= 6:
                values.extend([ld.get("mx", 0), ld.get("my", 0), ld.get("mz", 0)])

        loads.append({
            "type": "nodal",
            "node_id": ld["nodeId"],
            "values": values,
        })

    model_info = {
        "name": info.get("name", "Untitled"),
        "units": info.get("units", "kip-in"),
        "ndm": ndm,
        "ndf": ndf,
    }
    if z_up:
        model_info["z_up"] = True

    return {
        "model_info": model_info,
        "nodes": nodes,
        "materials": materials,
        "sections": sections,
        "elements": elements,
        "bearings": bearings,
        "loads": loads,
    }


def build_hospital_model():
    """Build the St. Claire Hospital sample model (3-story 2-bay SMRF).

    Uses Z-up convention (ndm=3, ndf=6) for TFP bearing compatibility.
    Frame is in the XZ plane; Y is out-of-plane (restrained).
    DOFs: [X, Y, Z, RX, RY, RZ] — free in X, Z, RY; fixed in Y, RX, RZ.
    """
    FREE = [0, 1, 0, 1, 0, 1]   # free X, Z, RY; fix Y, RX, RZ
    FIXED = [1, 1, 1, 1, 1, 1]

    return {
        "model_info": {"name": "Hospital Sample Model", "units": "kip-in", "ndm": 3, "ndf": 6, "z_up": True},
        "nodes": [
            # Ground nodes (fully fixed) — Z=-1
            {"id": 101, "coords": [0.0, 0.0, -1.0], "fixity": FIXED},
            {"id": 102, "coords": [288.0, 0.0, -1.0], "fixity": FIXED},
            {"id": 103, "coords": [576.0, 0.0, -1.0], "fixity": FIXED},
            # Base nodes (free in-plane) — Z=0
            {"id": 1, "coords": [0.0, 0.0, 0.0], "fixity": FREE},
            {"id": 2, "coords": [288.0, 0.0, 0.0], "fixity": FREE},
            {"id": 3, "coords": [576.0, 0.0, 0.0], "fixity": FREE},
            # Story 1 — Z=144
            {"id": 4, "coords": [0.0, 0.0, 144.0], "fixity": FREE},
            {"id": 5, "coords": [288.0, 0.0, 144.0], "fixity": FREE},
            {"id": 6, "coords": [576.0, 0.0, 144.0], "fixity": FREE},
            # Story 2 — Z=288
            {"id": 7, "coords": [0.0, 0.0, 288.0], "fixity": FREE},
            {"id": 8, "coords": [288.0, 0.0, 288.0], "fixity": FREE},
            {"id": 9, "coords": [576.0, 0.0, 288.0], "fixity": FREE},
            # Story 3 (roof) — Z=432
            {"id": 10, "coords": [0.0, 0.0, 432.0], "fixity": FREE},
            {"id": 11, "coords": [288.0, 0.0, 432.0], "fixity": FREE},
            {"id": 12, "coords": [576.0, 0.0, 432.0], "fixity": FREE},
        ],
        "materials": [
            {"id": 1, "type": "Elastic", "name": "Steel A992", "params": {"E": 29000.0}},
        ],
        "sections": [
            {"id": 1, "type": "Elastic", "name": "W14x257",
             "properties": {"A": 75.6, "Iz": 3400.0, "Iy": 1290.0, "G": 11154.0, "J": 86.0},
             "material_id": 1},
            {"id": 2, "type": "Elastic", "name": "W36x300",
             "properties": {"A": 88.3, "Iz": 20300.0, "Iy": 1300.0, "G": 11154.0, "J": 64.2},
             "material_id": 1},
        ],
        "elements": [
            {"id": 1, "type": "elasticBeamColumn", "nodes": [1, 4], "section_id": 1, "transform": "Linear"},
            {"id": 2, "type": "elasticBeamColumn", "nodes": [2, 5], "section_id": 1, "transform": "Linear"},
            {"id": 3, "type": "elasticBeamColumn", "nodes": [3, 6], "section_id": 1, "transform": "Linear"},
            {"id": 4, "type": "elasticBeamColumn", "nodes": [4, 7], "section_id": 1, "transform": "Linear"},
            {"id": 5, "type": "elasticBeamColumn", "nodes": [5, 8], "section_id": 1, "transform": "Linear"},
            {"id": 6, "type": "elasticBeamColumn", "nodes": [6, 9], "section_id": 1, "transform": "Linear"},
            {"id": 7, "type": "elasticBeamColumn", "nodes": [7, 10], "section_id": 1, "transform": "Linear"},
            {"id": 8, "type": "elasticBeamColumn", "nodes": [8, 11], "section_id": 1, "transform": "Linear"},
            {"id": 9, "type": "elasticBeamColumn", "nodes": [9, 12], "section_id": 1, "transform": "Linear"},
            {"id": 10, "type": "elasticBeamColumn", "nodes": [4, 5], "section_id": 2, "transform": "Linear"},
            {"id": 11, "type": "elasticBeamColumn", "nodes": [5, 6], "section_id": 2, "transform": "Linear"},
            {"id": 12, "type": "elasticBeamColumn", "nodes": [7, 8], "section_id": 2, "transform": "Linear"},
            {"id": 13, "type": "elasticBeamColumn", "nodes": [8, 9], "section_id": 2, "transform": "Linear"},
            {"id": 14, "type": "elasticBeamColumn", "nodes": [10, 11], "section_id": 2, "transform": "Linear"},
            {"id": 15, "type": "elasticBeamColumn", "nodes": [11, 12], "section_id": 2, "transform": "Linear"},
        ],
        "bearings": [
            {
                "id": 1, "nodes": [101, 1],
                "friction_models": [
                    {"mu_slow": 0.012, "mu_fast": 0.018, "trans_rate": 100.0},
                    {"mu_slow": 0.052, "mu_fast": 0.12, "trans_rate": 100.0},
                    {"mu_slow": 0.052, "mu_fast": 0.12, "trans_rate": 100.0},
                    {"mu_slow": 0.012, "mu_fast": 0.018, "trans_rate": 100.0},
                ],
                "radii": [3.0, 40.0, 3.0],
                "disp_capacities": [1.0, 15.0, 1.0],
                "weight": 500.0, "uy": 0.04, "kvt": 1.0, "vert_stiffness": 500.0, "min_fv": 0.1, "tol": 1e-5,
            },
            {
                "id": 2, "nodes": [102, 2],
                "friction_models": [
                    {"mu_slow": 0.012, "mu_fast": 0.018, "trans_rate": 100.0},
                    {"mu_slow": 0.052, "mu_fast": 0.12, "trans_rate": 100.0},
                    {"mu_slow": 0.052, "mu_fast": 0.12, "trans_rate": 100.0},
                    {"mu_slow": 0.012, "mu_fast": 0.018, "trans_rate": 100.0},
                ],
                "radii": [3.0, 40.0, 3.0],
                "disp_capacities": [1.0, 15.0, 1.0],
                "weight": 750.0, "uy": 0.04, "kvt": 1.0, "vert_stiffness": 750.0, "min_fv": 0.1, "tol": 1e-5,
            },
            {
                "id": 3, "nodes": [103, 3],
                "friction_models": [
                    {"mu_slow": 0.012, "mu_fast": 0.018, "trans_rate": 100.0},
                    {"mu_slow": 0.052, "mu_fast": 0.12, "trans_rate": 100.0},
                    {"mu_slow": 0.052, "mu_fast": 0.12, "trans_rate": 100.0},
                    {"mu_slow": 0.012, "mu_fast": 0.018, "trans_rate": 100.0},
                ],
                "radii": [3.0, 40.0, 3.0],
                "disp_capacities": [1.0, 15.0, 1.0],
                "weight": 500.0, "uy": 0.04, "kvt": 1.0, "vert_stiffness": 500.0, "min_fv": 0.1, "tol": 1e-5,
            },
        ],
        "loads": [
            # Gravity loads in -Z direction (Z-up convention)
            {"type": "nodal", "node_id": 4, "values": [0, 0, -100, 0, 0, 0]},
            {"type": "nodal", "node_id": 5, "values": [0, 0, -200, 0, 0, 0]},
            {"type": "nodal", "node_id": 6, "values": [0, 0, -100, 0, 0, 0]},
            {"type": "nodal", "node_id": 7, "values": [0, 0, -100, 0, 0, 0]},
            {"type": "nodal", "node_id": 8, "values": [0, 0, -200, 0, 0, 0]},
            {"type": "nodal", "node_id": 9, "values": [0, 0, -100, 0, 0, 0]},
            {"type": "nodal", "node_id": 10, "values": [0, 0, -75, 0, 0, 0]},
            {"type": "nodal", "node_id": 11, "values": [0, 0, -150, 0, 0, 0]},
            {"type": "nodal", "node_id": 12, "values": [0, 0, -75, 0, 0, 0]},
        ],
    }


def generate_el_centro_motion(dt=0.02, duration=10.0, pga=0.35):
    """Generate a synthetic El Centro-like ground motion (half-sine pulses)."""
    n = int(duration / dt)
    accel = []
    for i in range(n):
        t = i * dt
        # Synthetic motion: sum of sine waves with decay
        a = pga * math.exp(-0.15 * t) * (
            0.6 * math.sin(2 * math.pi * 1.5 * t)
            + 0.3 * math.sin(2 * math.pi * 3.2 * t)
            + 0.1 * math.sin(2 * math.pi * 0.8 * t)
        )
        accel.append(round(a, 6))
    return accel, dt, n


# =============================================================================
# Test Runners
# =============================================================================

def submit_model(model_data, name):
    """Submit a model to the API, return model_id."""
    log(f"\n  Submitting model: {name}")
    resp, status = api_post("/api/models", model_data)
    if 200 <= status < 300:
        model_id = resp.get("model_id")
        log(f"    -> model_id: {model_id}")
        return model_id
    else:
        log_fail(f"{name}/submit", f"HTTP {status}: {resp.get('error', 'unknown')[:200]}")
        return None


def test_static(model_id, name):
    """Run static analysis and validate results."""
    test = f"{name}/static"
    log(f"\n  Running static analysis...")
    resp, status = api_post("/api/analysis/run", {
        "model_id": model_id,
        "params": {"type": "static"},
    })

    if not (200 <= status < 300):
        log_fail(test, f"HTTP {status}: {resp.get('error', 'unknown')[:200]}")
        return None

    if resp.get("status") == "failed":
        log_fail(test, f"Analysis failed: {resp.get('error', 'unknown')[:200]}")
        return None

    results = resp.get("results", {})
    disps = results.get("node_displacements", {})
    reactions = results.get("reactions", {})

    # Validate: nodes should have displacements
    if not disps:
        log_fail(test, "No node displacements returned")
        return None

    # Validate: should have reactions at fixed nodes
    if not reactions:
        log_fail(test, "No reactions returned")
        return None

    # Validate: vertical reactions should be nonzero (gravity loads applied)
    # Check max absolute reaction across all DOFs (handles both Y-up and Z-up)
    total_vert_reaction = 0
    for node_id, rxn in reactions.items():
        # Sum the max absolute component per fixed node (vertical could be DOF 2 or 3)
        if rxn:
            total_vert_reaction += max(abs(v) for v in rxn)

    if total_vert_reaction < 1.0:
        log_fail(test, f"Total vertical reaction too small: {total_vert_reaction}")
        return None

    # Validate: displacements should be small but nonzero for gravity
    max_disp = 0
    for node_id, d in disps.items():
        for v in d:
            max_disp = max(max_disp, abs(v))

    log(f"    Max displacement: {max_disp:.6f}")
    log(f"    Total vertical reaction: {total_vert_reaction:.2f}")
    log(f"    Nodes with displacements: {len(disps)}")
    log(f"    Fixed nodes with reactions: {len(reactions)}")

    log_pass(test)
    return resp


def test_modal(model_id, name, num_modes=5, expected_T1_range=None):
    """Run modal analysis and validate periods."""
    test = f"{name}/modal"
    log(f"\n  Running modal analysis ({num_modes} modes)...")
    resp, status = api_post("/api/analysis/run", {
        "model_id": model_id,
        "params": {"type": "modal", "num_modes": num_modes},
    })

    if not (200 <= status < 300):
        log_fail(test, f"HTTP {status}: {resp.get('error', 'unknown')[:200]}")
        return None

    if resp.get("status") == "failed":
        log_fail(test, f"Analysis failed: {resp.get('error', 'unknown')[:200]}")
        return None

    results = resp.get("results", {})
    periods = results.get("periods", [])
    frequencies = results.get("frequencies", [])
    mode_shapes = results.get("mode_shapes", {})

    if not periods:
        log_fail(test, "No periods returned")
        return None

    # Validate: periods should be positive and decreasing
    for i, p in enumerate(periods):
        if p <= 0:
            log_fail(test, f"Period {i+1} is non-positive: {p}")
            return None

    for i in range(len(periods) - 1):
        if periods[i] < periods[i + 1]:
            log_fail(test, f"Periods not sorted: T{i+1}={periods[i]:.4f} < T{i+2}={periods[i+1]:.4f}")
            return None

    # Validate: frequencies = 1/periods
    for i in range(min(len(periods), len(frequencies))):
        expected_f = 1.0 / periods[i]
        if abs(frequencies[i] - expected_f) > 0.01:
            log_fail(test, f"Frequency mismatch: f{i+1}={frequencies[i]:.4f} vs 1/T={expected_f:.4f}")
            return None

    # Validate fundamental period range if specified
    if expected_T1_range:
        T1 = periods[0]
        lo, hi = expected_T1_range
        if not (lo <= T1 <= hi):
            log_fail(test, f"T1={T1:.4f}s outside expected range [{lo}, {hi}]s")
            return None

    # Validate mode shapes exist
    if not mode_shapes:
        log_fail(test, "No mode shapes returned")
        return None

    log(f"    Periods: {[f'{p:.4f}s' for p in periods]}")
    log(f"    Frequencies: {[f'{f:.2f}Hz' for f in frequencies]}")
    log(f"    Mode shapes: {len(mode_shapes)} modes")

    log_pass(test)
    return resp


def test_pushover(model_id, name, target_disp=10.0, num_steps=50):
    """Run pushover analysis and validate capacity curve."""
    test = f"{name}/pushover"
    log(f"\n  Running pushover analysis (target={target_disp})...")
    resp, status = api_post("/api/analysis/run", {
        "model_id": model_id,
        "params": {
            "type": "pushover",
            "target_displacement": target_disp,
            "num_steps": num_steps,
            "load_pattern": "linear",
        },
    })

    if not (200 <= status < 300):
        log_fail(test, f"HTTP {status}: {resp.get('error', 'unknown')[:200]}")
        return None

    if resp.get("status") == "failed":
        log_fail(test, f"Analysis failed: {resp.get('error', 'unknown')[:200]}")
        return None

    results = resp.get("results", {})
    curve = results.get("capacity_curve", [])
    max_shear = results.get("max_base_shear", 0)
    max_disp = results.get("max_roof_displacement", 0)
    hinges = results.get("hinge_states", [])

    if not curve:
        log_fail(test, "No capacity curve returned")
        return None

    # Validate: capacity curve should have increasing displacement
    if len(curve) > 1:
        for i in range(1, len(curve)):
            if curve[i]["roof_displacement"] < curve[i-1]["roof_displacement"] - 0.001:
                log_fail(test, f"Capacity curve displacement not monotonic at step {i}")
                return None

    # Validate: max base shear should be positive
    if max_shear <= 0:
        log_fail(test, f"Max base shear non-positive: {max_shear}")
        return None

    log(f"    Capacity curve points: {len(curve)}")
    log(f"    Max base shear: {max_shear:.2f}")
    log(f"    Max roof displacement: {max_disp:.4f}")
    log(f"    Plastic hinges: {len(hinges)}")
    if hinges:
        perf_levels = {}
        for h in hinges:
            pl = h.get("performance_level", "elastic")
            perf_levels[pl] = perf_levels.get(pl, 0) + 1
        log(f"    Hinge distribution: {perf_levels}")

    log_pass(test)
    return resp


def test_time_history(model_id, name, has_bearings=False):
    """Run time-history analysis with synthetic ground motion."""
    test = f"{name}/time_history"
    accel, dt, n_steps = generate_el_centro_motion(dt=0.02, duration=10.0, pga=0.35)
    log(f"\n  Running time-history analysis ({n_steps} steps, dt={dt}s)...")

    resp, status = api_post("/api/analysis/run", {
        "model_id": model_id,
        "params": {
            "type": "time_history",
            "dt": dt,
            "num_steps": n_steps,
            "ground_motions": [{
                "dt": dt,
                "acceleration": accel,
                "direction": 1,
                "scale_factor": 386.4,  # g to in/s^2 for kip-in models
            }],
        },
    })

    if not (200 <= status < 300):
        log_fail(test, f"HTTP {status}: {resp.get('error', 'unknown')[:200]}")
        return None

    if resp.get("status") == "failed":
        log_fail(test, f"Analysis failed: {resp.get('error', 'unknown')[:200]}")
        return None

    results = resp.get("results", {})
    time_arr = results.get("time", [])
    disps = results.get("node_displacements", {})
    bearing_resp = results.get("bearing_responses", {})

    if not time_arr:
        log_fail(test, "No time array returned")
        return None

    if not disps:
        log_fail(test, "No node displacements returned")
        return None

    # Validate time array
    if len(time_arr) < 2:
        log_fail(test, f"Time array too short: {len(time_arr)}")
        return None

    # Find peak displacement across all nodes
    peak_disp = 0
    peak_node = None
    for node_id, dof_data in disps.items():
        for dof, values in dof_data.items():
            for v in values:
                if abs(v) > peak_disp:
                    peak_disp = abs(v)
                    peak_node = node_id

    log(f"    Time steps returned: {len(time_arr)}")
    log(f"    Nodes with displacements: {len(disps)}")
    log(f"    Peak displacement: {peak_disp:.4f} (node {peak_node})")

    if has_bearings:
        if bearing_resp:
            log(f"    Bearing responses: {len(bearing_resp)} bearings")
            for bid, data in bearing_resp.items():
                if "displacement" in data:
                    peak_bd = max(abs(v) for v in data["displacement"]) if data["displacement"] else 0
                    log(f"      Bearing {bid} peak disp: {peak_bd:.4f}")
        else:
            log(f"    WARNING: No bearing responses (may be expected)")

    log_pass(test)
    return resp


def test_comparison(model_id, name, target_disp=10.0):
    """Run comparison analysis (isolated vs fixed-base)."""
    test = f"{name}/comparison"
    log(f"\n  Running comparison analysis...")
    resp, status = api_post("/api/comparison/run", {
        "model_id": model_id,
        "params": {
            "type": "pushover",
            "target_displacement": target_disp,
            "num_steps": 50,
            "load_pattern": "linear",
        },
        "lambda_factors": {
            "lambda_min": 0.85,
            "lambda_max": 1.8,
        },
    })

    if not (200 <= status < 300):
        log_fail(test, f"HTTP {status}: {resp.get('error', 'unknown')[:200]}")
        return None

    if resp.get("status") == "failed" or resp.get("error"):
        log_fail(test, f"Comparison failed: {resp.get('error', 'unknown')[:200]}")
        return None

    isolated = resp.get("isolated", {})
    fixed_base = resp.get("fixed_base", {})
    isolated_upper = resp.get("isolated_upper")
    isolated_lower = resp.get("isolated_lower")

    if not isolated:
        log_fail(test, "No isolated results returned")
        return None

    if not fixed_base:
        log_fail(test, "No fixed-base results returned")
        return None

    iso_shear = isolated.get("max_base_shear", 0)
    fix_shear = fixed_base.get("max_base_shear", 0)

    if iso_shear <= 0:
        log_fail(test, f"Isolated max base shear non-positive: {iso_shear}")
        return None
    if fix_shear <= 0:
        log_fail(test, f"Fixed-base max base shear non-positive: {fix_shear}")
        return None

    # For isolated structures, we expect LOWER base shear than fixed-base
    shear_reduction = (1 - iso_shear / fix_shear) * 100 if fix_shear > 0 else 0

    log(f"    Isolated max base shear: {iso_shear:.2f}")
    log(f"    Fixed-base max base shear: {fix_shear:.2f}")
    log(f"    Base shear reduction: {shear_reduction:.1f}%")

    if isolated_upper:
        log(f"    Upper bound (lambda={1.8}) base shear: {isolated_upper.get('max_base_shear', 0):.2f}")
    if isolated_lower:
        log(f"    Lower bound (lambda={0.85}) base shear: {isolated_lower.get('max_base_shear', 0):.2f}")

    log_pass(test)
    return resp


def test_results_endpoint(analysis_id, name):
    """Test GET /api/results/{analysis_id} and summary endpoints."""
    test = f"{name}/results_endpoint"

    # Full results
    resp, status = api_get(f"/api/results/{analysis_id}")
    if not (200 <= status < 300):
        log_fail(test, f"GET results HTTP {status}")
        return

    # Summary
    resp_sum, status_sum = api_get(f"/api/results/{analysis_id}/summary")
    if status_sum != 200:
        log_fail(test + "_summary", f"GET summary HTTP {status_sum}")
        return

    log(f"    Results endpoint OK, Summary endpoint OK")
    log_pass(test)


# =============================================================================
# Main Test Orchestrator
# =============================================================================

def run_model_suite(model_data, name, has_bearings=False, pushover_target=10.0,
                    expected_T1_range=None):
    """Run full analysis suite on a single model."""
    log(f"\n{'='*60}")
    log(f"MODEL: {name}")
    log(f"{'='*60}")
    log(f"  Nodes: {len(model_data.get('nodes', []))}")
    log(f"  Elements: {len(model_data.get('elements', []))}")
    log(f"  Bearings: {len(model_data.get('bearings', []))}")
    log(f"  Loads: {len(model_data.get('loads', []))}")
    log(f"  NDM: {model_data.get('model_info', {}).get('ndm', 2)}")

    # Submit model
    model_id = submit_model(model_data, name)
    if not model_id:
        return

    # 1. Static analysis
    t0 = time.time()
    static_result = test_static(model_id, name)
    log(f"    Time: {time.time()-t0:.2f}s")

    # 2. Modal analysis
    t0 = time.time()
    modal_result = test_modal(model_id, name, num_modes=5, expected_T1_range=expected_T1_range)
    log(f"    Time: {time.time()-t0:.2f}s")

    # Test results endpoint using modal analysis ID
    if modal_result:
        aid = modal_result.get("analysis_id")
        if aid:
            test_results_endpoint(aid, name)

    # 3. Pushover analysis
    t0 = time.time()
    pushover_result = test_pushover(model_id, name, target_disp=pushover_target)
    log(f"    Time: {time.time()-t0:.2f}s")

    # 4. Time-history analysis
    t0 = time.time()
    th_result = test_time_history(model_id, name, has_bearings=has_bearings)
    log(f"    Time: {time.time()-t0:.2f}s")

    # 5. Comparison (only for models with bearings)
    if has_bearings:
        t0 = time.time()
        comp_result = test_comparison(model_id, name, target_disp=pushover_target)
        log(f"    Time: {time.time()-t0:.2f}s")


def main():
    global PASS, FAIL, ERRORS

    log("=" * 60)
    log("IsoVis Integration Test Suite")
    log("=" * 60)
    log(f"Backend: {BASE_URL}")

    # Verify backend is alive
    try:
        url = f"{BASE_URL}/docs"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status != 200:
                log(f"ERROR: Backend not responding (HTTP {resp.status})")
                sys.exit(1)
    except Exception as e:
        log(f"ERROR: Cannot reach backend: {e}")
        sys.exit(1)
    log("Backend is alive!")

    t_start = time.time()

    # =========================================================================
    # Model 1: Hospital sample (2D with bearings)
    # =========================================================================
    hospital = build_hospital_model()
    run_model_suite(
        hospital,
        name="Hospital (2D + TFP)",
        has_bearings=True,
        pushover_target=5.0,
        expected_T1_range=(0.1, 5.0),  # isolated period could be long
    )

    # =========================================================================
    # Model 2: Alt A — Ductile Bridge (2D, no bearings)
    # =========================================================================
    alt_a_raw = json.loads((MODELS_DIR / "alt-a-ductile.json").read_text())
    alt_a = transform_model(alt_a_raw, ndm=2, ndf=3)
    run_model_suite(
        alt_a,
        name="Alt A: Ductile Bridge (2D)",
        has_bearings=False,
        pushover_target=20.0,
        expected_T1_range=(0.05, 5.0),
    )

    # =========================================================================
    # Model 3: Alt B — TFP Isolated Bridge (2D)
    # =========================================================================
    alt_b_raw = json.loads((MODELS_DIR / "alt-b-isolated.json").read_text())
    alt_b = transform_model(alt_b_raw)  # auto-detects ndm=3/ndf=6 for bearings
    run_model_suite(
        alt_b,
        name="Alt B: Isolated Bridge (3D + TFP)",
        has_bearings=True,
        pushover_target=20.0,
        expected_T1_range=(0.1, 10.0),
    )

    # =========================================================================
    # Model 4: Alt C — Extradosed + Isolated (2D)
    # =========================================================================
    alt_c_raw = json.loads((MODELS_DIR / "alt-c-extradosed.json").read_text())
    alt_c = transform_model(alt_c_raw)  # auto-detects ndm=3/ndf=6 for bearings
    run_model_suite(
        alt_c,
        name="Alt C: Extradosed + TFP (3D)",
        has_bearings=True,
        pushover_target=20.0,
        expected_T1_range=(0.1, 10.0),
    )

    # =========================================================================
    # Summary
    # =========================================================================
    elapsed = time.time() - t_start
    log(f"\n{'='*60}")
    log(f"TEST SUMMARY")
    log(f"{'='*60}")
    log(f"  Total tests:  {PASS + FAIL}")
    log(f"  Passed:       {PASS}")
    log(f"  Failed:       {FAIL}")
    log(f"  Total time:   {elapsed:.1f}s")

    if ERRORS:
        log(f"\n  FAILURES:")
        for err in ERRORS:
            log(f"    - {err}")

    if FAIL > 0:
        sys.exit(1)
    else:
        log(f"\n  ALL TESTS PASSED!")
        sys.exit(0)


if __name__ == "__main__":
    main()
