#!/usr/bin/env python3
"""
Submit the 20-story steel tower model and run a full seismic time-history analysis.
Requires the backend to be running at http://localhost:8000.
"""

import json
import math
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE_URL = "http://localhost:8000"
MODEL_PATH = Path(__file__).parent.parent / "frontend" / "public" / "models" / "twenty-story.json"


def api_post(endpoint, data):
    url = f"{BASE_URL}{endpoint}"
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return json.loads(resp.read()), resp.status
    except urllib.error.HTTPError as e:
        if 200 <= e.code < 300:
            return json.loads(e.read()), e.code
        error_body = e.read().decode("utf-8", errors="replace")
        return {"error": error_body, "status_code": e.code}, e.code
    except Exception as e:
        return {"error": str(e)}, 0


def generate_el_centro_motion(dt=0.02, duration=15.0, pga=0.35):
    """Generate a synthetic El Centro-like ground motion."""
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


def transform_model(frontend_json):
    """Convert frontend model JSON to backend StructuralModelSchema format.
    No bearings → 2D model (ndm=2, ndf=3).
    """
    info = frontend_json.get("modelInfo", {})
    ndm = 2
    ndf = 3

    nodes = []
    for n in frontend_json.get("nodes", []):
        x = n.get("x", 0)
        y = n.get("y", 0)
        coords = [x, y]

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

    loads = []
    for ld in frontend_json.get("loads", []):
        values = [ld.get("fx", 0), ld.get("fy", 0), ld.get("mz", 0)]
        loads.append({
            "type": "nodal",
            "node_id": ld["nodeId"],
            "values": values,
        })

    return {
        "model_info": {
            "name": info.get("name", "20-Story Tower"),
            "units": info.get("units", "kip-in"),
            "ndm": ndm,
            "ndf": ndf,
        },
        "nodes": nodes,
        "materials": materials,
        "sections": sections,
        "elements": elements,
        "bearings": [],
        "loads": loads,
    }


def main():
    print("=" * 60)
    print("20-STORY STEEL TOWER — SEISMIC TIME-HISTORY ANALYSIS")
    print("=" * 60)

    # Load the model
    print(f"\n1. Loading model from {MODEL_PATH.name}...")
    with open(MODEL_PATH) as f:
        frontend_json = json.load(f)
    print(f"   Nodes: {len(frontend_json['nodes'])}, Elements: {len(frontend_json['elements'])}")
    print(f"   Sections: {len(frontend_json['sections'])}, Loads: {len(frontend_json['loads'])}")

    # Transform to backend format
    print("\n2. Transforming to backend format (ndm=2, ndf=3)...")
    model_data = transform_model(frontend_json)
    print(f"   Model info: {model_data['model_info']}")

    # Submit model
    print("\n3. Submitting model to backend...")
    resp, status = api_post("/api/models", model_data)
    if not (200 <= status < 300):
        print(f"   ERROR: HTTP {status}: {resp}")
        sys.exit(1)
    model_id = resp.get("model_id")
    print(f"   Model ID: {model_id}")

    # === MODAL ANALYSIS FIRST ===
    print("\n4. Running modal analysis (10 modes)...")
    resp, status = api_post("/api/analysis/run", {
        "model_id": model_id,
        "params": {"type": "modal", "num_modes": 10},
    })
    if 200 <= status < 300 and resp.get("status") != "failed":
        results = resp.get("results", {})
        periods = results.get("periods", [])
        print(f"   Natural periods (first 10 modes):")
        for i, p in enumerate(periods[:10]):
            freq = 1.0 / p if p > 0 else 0
            print(f"     Mode {i+1}: T = {p:.4f} s  (f = {freq:.3f} Hz)")

        mass_part = results.get("mass_participation", {})
        try:
            if isinstance(mass_part, dict):
                # dict of mode_num -> {x, y, z} or mode_num -> [vals]
                print(f"   Mass participation data: {len(mass_part)} modes")
            elif isinstance(mass_part, list):
                print(f"   Mass participation data: {len(mass_part)} modes")
        except Exception:
            pass
    else:
        print(f"   Modal analysis failed: {resp}")

    # === TIME-HISTORY ANALYSIS ===
    print("\n5. Generating El Centro synthetic ground motion...")
    accel, dt, n_steps = generate_el_centro_motion(dt=0.02, duration=15.0, pga=0.35)
    print(f"   Duration: 15.0 s, dt: {dt} s, steps: {n_steps}")
    print(f"   PGA: 0.35g, scale_factor: 386.4 (g → in/s²)")

    print("\n6. Running seismic time-history analysis...")
    print("   (This may take 30-120 seconds for a 20-story frame...)")
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
        print(f"   ERROR: HTTP {status}: {resp}")
        sys.exit(1)

    if resp.get("status") == "failed":
        print(f"   ERROR: Analysis failed: {resp.get('error', 'unknown')}")
        sys.exit(1)

    results = resp.get("results", {})
    time_arr = results.get("time", [])
    disps = results.get("node_displacements", {})

    print(f"\n{'=' * 60}")
    print("RESULTS")
    print(f"{'=' * 60}")
    print(f"   Time steps returned: {len(time_arr)}")
    print(f"   Duration: {time_arr[-1]:.2f} s" if time_arr else "   Duration: N/A")
    print(f"   Nodes with displacement data: {len(disps)}")

    # Find peak displacements per story
    # Nodes: 1,2 = base (fixed), 3-42 = stories 1-20 (left, right pairs)
    print(f"\n   Story-by-story peak X-displacement (DOF 1):")
    print(f"   {'Story':<8} {'Node':<8} {'Peak X (in)':<14} {'Peak X (mm)':<14} {'Drift Ratio':<12}")
    print(f"   {'-'*56}")

    story_height = 144.0  # 12 ft in inches
    prev_peak = 0

    for story in range(1, 21):
        left_node = str(2 * story + 1)  # nodes 3,5,7,...,41
        right_node = str(2 * story + 2)  # nodes 4,6,8,...,42

        peak = 0
        peak_node_id = left_node
        for nid in [left_node, right_node]:
            if nid in disps:
                dof_data = disps[nid]
                # DOF 1 = X direction
                x_key = "1"
                if x_key in dof_data:
                    vals = dof_data[x_key]
                    node_peak = max(abs(v) for v in vals) if vals else 0
                    if node_peak > peak:
                        peak = node_peak
                        peak_node_id = nid

        drift = (peak - prev_peak) / story_height if story > 0 else 0
        prev_peak = peak
        print(f"   {story:<8} {peak_node_id:<8} {peak:<14.4f} {peak*25.4:<14.2f} {drift:<12.6f}")

    # Find overall peak
    overall_peak = 0
    overall_node = ""
    for node_id, dof_data in disps.items():
        for dof, values in dof_data.items():
            for v in values:
                if abs(v) > overall_peak:
                    overall_peak = abs(v)
                    overall_node = node_id

    print(f"\n   PEAK DISPLACEMENT: {overall_peak:.4f} in ({overall_peak*25.4:.2f} mm) at node {overall_node}")
    print(f"   Building height: {20 * 144.0 / 12:.0f} ft ({20 * 144.0:.0f} in)")
    print(f"   Roof drift ratio: {overall_peak / (20 * 144.0):.6f}")
    print(f"\n{'=' * 60}")
    print("ANALYSIS COMPLETE")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
