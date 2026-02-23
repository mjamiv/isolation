#!/usr/bin/env python3
"""
Integration tests for the new/fixed models:
  1. 20-Story Steel Tower (with out-of-plane restraints fix)
  2. 5-Story 3D Office (Fixed-Base)
  3. 5-Story 3D Office (TFP Isolated)

Usage:
  python3 tests/test_new_models.py
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

PASS = 0
FAIL = 0
ERRORS = []


def log(msg, indent=0):
    prefix = "  " * indent
    print(f"{prefix}{msg}")


def log_pass(test_name):
    global PASS
    PASS += 1
    log(f"  ✓ PASS: {test_name}")


def log_fail(test_name, reason):
    global FAIL
    FAIL += 1
    ERRORS.append(f"{test_name}: {reason}")
    log(f"  ✗ FAIL: {test_name} — {reason}")


def api_post(endpoint, data):
    url = f"{BASE_URL}{endpoint}"
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            return json.loads(resp.read()), resp.status
    except urllib.error.HTTPError as e:
        if 200 <= e.code < 300:
            return json.loads(e.read()), e.code
        error_body = e.read().decode("utf-8", errors="replace")
        return {"error": error_body, "status_code": e.code}, e.code
    except Exception as e:
        return {"error": str(e)}, 0


def api_get(endpoint):
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


def generate_el_centro_motion(dt=0.02, duration=10.0, pga=0.35):
    n = int(duration / dt)
    accel = []
    for i in range(n):
        t = i * dt
        a = pga * math.exp(-0.15 * t) * (
            0.6 * math.sin(2 * math.pi * 1.5 * t)
            + 0.3 * math.sin(2 * math.pi * 3.2 * t)
            + 0.1 * math.sin(2 * math.pi * 0.8 * t)
        )
        accel.append(round(a, 6))
    return accel, dt, n


def transform_model(frontend_json, ndm=None, ndf=None):
    """Convert frontend model JSON to backend API format."""
    info = frontend_json.get("modelInfo", {})
    has_bearings = bool(frontend_json.get("bearings"))

    if ndm is None:
        ndm = 3 if has_bearings else 3  # All our new models are 3D
    if ndf is None:
        ndf = 6  # All our new models use 6 DOF

    z_up = has_bearings and ndm == 3

    nodes = []
    for n in frontend_json.get("nodes", []):
        x = n.get("x", 0)
        y = n.get("y", 0)
        z = n.get("z", 0)

        if z_up:
            coords = [x, z, y]
        else:
            coords = [x, y, z]

        restraint = n.get("restraint", [])
        fixity = []
        for r in restraint[:ndf]:
            fixity.append(1 if r else 0)
        while len(fixity) < ndf:
            fixity.append(0)

        nodes.append({"id": n["id"], "coords": coords, "fixity": fixity})

    materials = []
    for m in frontend_json.get("materials", []):
        materials.append({
            "id": m["id"],
            "type": "Elastic",
            "name": m.get("name", f"Material {m['id']}"),
            "params": {"E": m["E"]},
        })

    sections = []
    for s in frontend_json.get("sections", []):
        props = {"A": s["area"], "Iz": s["Ix"]}
        if ndm >= 3:
            props["Iy"] = s.get("Iy", s["Ix"])
            props["G"] = 11154.0  # G = E / 2(1+v) ≈ 29000 / 2.6
            props["J"] = s.get("Iy", s["Ix"]) * 0.5
        sections.append({
            "id": s["id"],
            "type": "Elastic",
            "name": s.get("name", f"Section {s['id']}"),
            "properties": props,
            "material_id": frontend_json["materials"][0]["id"],
        })

    elements = []
    for e in frontend_json.get("elements", []):
        elements.append({
            "id": e["id"],
            "type": "elasticBeamColumn",
            "nodes": [e["nodeI"], e["nodeJ"]],
            "section_id": e.get("sectionId", 1),
            "transform": "Linear",
        })

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
            "uy": b.get("yieldDisp", 0.04),
            "kvt": 1.0,
            "vert_stiffness": b.get("vertStiffness", 50000),
            "min_fv": b.get("minVertForce", 0.1),
            "tol": 1e-5,
        })

    loads = []
    for ld in frontend_json.get("loads", []):
        if z_up:
            values = [
                ld.get("fx", 0), ld.get("fz", 0), ld.get("fy", 0),
                ld.get("mx", 0), ld.get("mz", 0), ld.get("my", 0),
            ]
        else:
            values = [
                ld.get("fx", 0), ld.get("fy", 0), ld.get("fz", 0),
                ld.get("mx", 0), ld.get("my", 0), ld.get("mz", 0),
            ]
        loads.append({"type": "nodal", "node_id": ld["nodeId"], "values": values})

    model_info = {"name": info.get("name", "Untitled"), "units": info.get("units", "kip-in"), "ndm": ndm, "ndf": ndf}
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


# ── Test Runners ──────────────────────────────────────────────────────

def submit_model(model_data, name):
    log(f"\n  Submitting model: {name}")
    resp, status = api_post("/api/models", model_data)
    if 200 <= status < 300:
        model_id = resp.get("model_id")
        log(f"    → model_id: {model_id}")
        return model_id
    else:
        log_fail(f"{name}/submit", f"HTTP {status}: {resp.get('error', 'unknown')[:300]}")
        return None


def test_static(model_id, name):
    test = f"{name}/static"
    log(f"\n  Running static analysis...")
    resp, status = api_post("/api/analysis/run", {
        "model_id": model_id,
        "params": {"type": "static"},
    })
    if not (200 <= status < 300):
        log_fail(test, f"HTTP {status}: {resp.get('error', 'unknown')[:300]}")
        return None
    if resp.get("status") == "failed":
        log_fail(test, f"Analysis failed: {resp.get('error', 'unknown')[:300]}")
        return None

    results = resp.get("results", {})
    disps = results.get("node_displacements", {})
    reactions = results.get("reactions", {})

    if not disps:
        log_fail(test, "No node displacements returned")
        return None
    if not reactions:
        log_fail(test, "No reactions returned")
        return None

    total_vert_reaction = 0
    for node_id, rxn in reactions.items():
        if rxn:
            total_vert_reaction += max(abs(v) for v in rxn)

    max_disp = 0
    for node_id, d in disps.items():
        for v in d:
            max_disp = max(max_disp, abs(v))

    log(f"    Max displacement: {max_disp:.6f}")
    log(f"    Total vert reaction: {total_vert_reaction:.1f}")
    log(f"    Nodes with disps: {len(disps)}, Reaction nodes: {len(reactions)}")
    log_pass(test)
    return resp


def test_modal(model_id, name, num_modes=5, expected_T1_range=None):
    test = f"{name}/modal"
    log(f"\n  Running modal analysis ({num_modes} modes)...")
    resp, status = api_post("/api/analysis/run", {
        "model_id": model_id,
        "params": {"type": "modal", "num_modes": num_modes},
    })
    if not (200 <= status < 300):
        log_fail(test, f"HTTP {status}: {resp.get('error', 'unknown')[:300]}")
        return None
    if resp.get("status") == "failed":
        log_fail(test, f"Analysis failed: {resp.get('error', 'unknown')[:300]}")
        return None

    results = resp.get("results", {})
    periods = results.get("periods", [])

    if not periods:
        log_fail(test, "No periods returned")
        return None

    for i, p in enumerate(periods):
        if p <= 0:
            log_fail(test, f"Period {i+1} is non-positive: {p}")
            return None

    if expected_T1_range:
        T1 = periods[0]
        lo, hi = expected_T1_range
        if not (lo <= T1 <= hi):
            log_fail(test, f"T1={T1:.4f}s outside [{lo}, {hi}]s")
            return None

    log(f"    Periods: {[f'{p:.4f}s' for p in periods[:5]]}")
    log(f"    T1 = {periods[0]:.4f}s")
    log_pass(test)
    return resp


def test_pushover(model_id, name, target_disp=10.0, num_steps=50):
    test = f"{name}/pushover"
    log(f"\n  Running pushover (target={target_disp})...")
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
        log_fail(test, f"HTTP {status}: {resp.get('error', 'unknown')[:300]}")
        return None
    if resp.get("status") == "failed":
        log_fail(test, f"Analysis failed: {resp.get('error', 'unknown')[:300]}")
        return None

    results = resp.get("results", {})
    curve = results.get("capacity_curve", [])
    max_shear = results.get("max_base_shear", 0)
    max_disp = results.get("max_roof_displacement", 0)

    if not curve:
        log_fail(test, "No capacity curve returned")
        return None
    if max_shear <= 0:
        log_fail(test, f"Max base shear non-positive: {max_shear}")
        return None

    log(f"    Capacity curve points: {len(curve)}")
    log(f"    Max base shear: {max_shear:.1f} kip")
    log(f"    Max roof displacement: {max_disp:.4f} in")
    log_pass(test)
    return resp


def test_time_history(model_id, name, has_bearings=False):
    test = f"{name}/time_history"
    accel, dt, n_steps = generate_el_centro_motion(dt=0.02, duration=10.0, pga=0.35)
    log(f"\n  Running time-history ({n_steps} steps, dt={dt}s)...")

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
                "scale_factor": 386.4,
            }],
        },
    })
    if not (200 <= status < 300):
        log_fail(test, f"HTTP {status}: {resp.get('error', 'unknown')[:300]}")
        return None
    if resp.get("status") == "failed":
        log_fail(test, f"Analysis failed: {resp.get('error', 'unknown')[:300]}")
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

    peak_disp = 0
    peak_node = None
    for node_id, dof_data in disps.items():
        for dof, values in dof_data.items():
            for v in values:
                if abs(v) > peak_disp:
                    peak_disp = abs(v)
                    peak_node = node_id

    log(f"    Time steps: {len(time_arr)}")
    log(f"    Nodes with disps: {len(disps)}")
    log(f"    Peak displacement: {peak_disp:.4f} (node {peak_node})")

    if has_bearings and bearing_resp:
        log(f"    Bearing responses: {len(bearing_resp)} bearings")
        for bid, data in list(bearing_resp.items())[:3]:
            if "displacement" in data:
                peak_bd = max(abs(v) for v in data["displacement"]) if data["displacement"] else 0
                log(f"      Bearing {bid} peak disp: {peak_bd:.4f}")

    log_pass(test)
    return resp


def test_comparison(model_id, name, target_disp=10.0):
    test = f"{name}/comparison"
    log(f"\n  Running comparison...")
    resp, status = api_post("/api/comparison/run", {
        "model_id": model_id,
        "params": {
            "type": "pushover",
            "target_displacement": target_disp,
            "num_steps": 50,
            "load_pattern": "linear",
        },
        "lambda_factors": {"lambda_min": 0.85, "lambda_max": 1.8},
    })
    if not (200 <= status < 300):
        log_fail(test, f"HTTP {status}: {resp.get('error', 'unknown')[:300]}")
        return None
    if resp.get("status") == "failed" or resp.get("error"):
        log_fail(test, f"Comparison failed: {resp.get('error', 'unknown')[:300]}")
        return None

    isolated = resp.get("isolated", {})
    fixed_base = resp.get("fixed_base", {})
    if not isolated or not fixed_base:
        log_fail(test, "Missing isolated or fixed-base results")
        return None

    iso_shear = isolated.get("max_base_shear", 0)
    fix_shear = fixed_base.get("max_base_shear", 0)
    reduction = (1 - iso_shear / fix_shear) * 100 if fix_shear > 0 else 0

    log(f"    Isolated base shear: {iso_shear:.1f} kip")
    log(f"    Fixed-base base shear: {fix_shear:.1f} kip")
    log(f"    Reduction: {reduction:.1f}%")
    log_pass(test)
    return resp


def run_model_suite(model_data, name, has_bearings=False, pushover_target=10.0,
                    expected_T1_range=None):
    log(f"\n{'='*60}")
    log(f"MODEL: {name}")
    log(f"{'='*60}")
    log(f"  Nodes: {len(model_data.get('nodes', []))}")
    log(f"  Elements: {len(model_data.get('elements', []))}")
    log(f"  Bearings: {len(model_data.get('bearings', []))}")
    log(f"  Loads: {len(model_data.get('loads', []))}")
    log(f"  NDM: {model_data.get('model_info', {}).get('ndm', '?')}, NDF: {model_data.get('model_info', {}).get('ndf', '?')}")

    model_id = submit_model(model_data, name)
    if not model_id:
        return

    t0 = time.time()
    test_static(model_id, name)
    log(f"    Time: {time.time()-t0:.1f}s")

    t0 = time.time()
    test_modal(model_id, name, num_modes=5, expected_T1_range=expected_T1_range)
    log(f"    Time: {time.time()-t0:.1f}s")

    t0 = time.time()
    test_pushover(model_id, name, target_disp=pushover_target)
    log(f"    Time: {time.time()-t0:.1f}s")

    t0 = time.time()
    test_time_history(model_id, name, has_bearings=has_bearings)
    log(f"    Time: {time.time()-t0:.1f}s")

    if has_bearings:
        t0 = time.time()
        test_comparison(model_id, name, target_disp=pushover_target)
        log(f"    Time: {time.time()-t0:.1f}s")


def main():
    global PASS, FAIL, ERRORS

    log("=" * 60)
    log("Integration Tests: New & Fixed Models")
    log("=" * 60)
    log(f"Backend: {BASE_URL}")

    # Verify backend
    try:
        req = urllib.request.Request(f"{BASE_URL}/docs")
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status != 200:
                log(f"ERROR: Backend not responding (HTTP {resp.status})")
                sys.exit(1)
    except Exception as e:
        log(f"ERROR: Cannot reach backend: {e}")
        sys.exit(1)
    log("Backend is alive!\n")

    t_start = time.time()

    # ── 1. 20-Story Tower (with out-of-plane restraints fix) ──
    log("Loading 20-story tower model...")
    tower_raw = json.loads((MODELS_DIR / "twenty-story.json").read_text())
    tower = transform_model(tower_raw, ndm=3, ndf=6)
    run_model_suite(
        tower,
        name="20-Story Tower (3D fixed restraints)",
        has_bearings=False,
        pushover_target=10.0,
        expected_T1_range=(0.5, 5.0),
    )

    # ── 2. 5-Story Office Fixed-Base ──
    log("\nLoading 5-story office fixed-base model...")
    office_fixed_raw = json.loads((MODELS_DIR / "five-story-office-fixed.json").read_text())
    office_fixed = transform_model(office_fixed_raw, ndm=3, ndf=6)
    run_model_suite(
        office_fixed,
        name="5-Story Office (Fixed-Base)",
        has_bearings=False,
        pushover_target=5.0,
        expected_T1_range=(0.1, 5.0),
    )

    # ── 3. 5-Story Office Isolated ──
    log("\nLoading 5-story office isolated model...")
    office_iso_raw = json.loads((MODELS_DIR / "five-story-office-isolated.json").read_text())
    office_iso = transform_model(office_iso_raw)  # auto ndm=3, ndf=6, z_up for bearings
    run_model_suite(
        office_iso,
        name="5-Story Office (TFP Isolated)",
        has_bearings=True,
        pushover_target=5.0,
        expected_T1_range=(0.1, 10.0),
    )

    # ── Summary ──
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
