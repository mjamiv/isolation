#!/usr/bin/env python3
"""Generate 5-Story 3D Steel Office models (fixed-base and TFP-isolated)."""

import json
import os

# ── Geometry ──────────────────────────────────────────────────────────
BAYS_X = 3          # bays in X direction
BAYS_Z = 3          # bays in Z direction
BAY_WIDTH = 360.0   # 30 ft = 360 in
FIRST_STORY_H = 180.0  # 15 ft = 180 in
TYPICAL_STORY_H = 156.0  # 13 ft = 156 in
NUM_STORIES = 5

NX = BAYS_X + 1  # 4 grid lines in X
NZ = BAYS_Z + 1  # 4 grid lines in Z
NODES_PER_LEVEL = NX * NZ  # 16

# Story heights (cumulative, in inches)
STORY_HEIGHTS = []
h = 0.0
for s in range(1, NUM_STORIES + 1):
    h += FIRST_STORY_H if s == 1 else TYPICAL_STORY_H
    STORY_HEIGHTS.append(h)
# [180, 336, 492, 648, 804]

# ── Material & Sections ──────────────────────────────────────────────
MATERIAL = {
    "id": 1,
    "name": "A992 Gr50 Steel",
    "E": 29000.0,
    "Fy": 50.0,
    "density": 0.000284,
    "nu": 0.3,
}

SECTIONS = [
    {
        "id": 1,
        "name": "W14x132 (Columns)",
        "area": 38.8,
        "Ix": 1530.0,
        "Iy": 548.0,
        "Zx": 234.0,
        "d": 14.66,
        "bf": 14.725,
        "tw": 0.645,
        "tf": 1.03,
    },
    {
        "id": 2,
        "name": "W24x68 (Beams)",
        "area": 20.1,
        "Ix": 1830.0,
        "Iy": 70.4,
        "Zx": 177.0,
        "d": 23.73,
        "bf": 8.965,
        "tw": 0.415,
        "tf": 0.585,
    },
]

COL_SECTION_ID = 1
BEAM_SECTION_ID = 2
MAT_ID = 1

# ── Floor loads (75 psf) ─────────────────────────────────────────────
# Tributary areas (30 ft bays):
#   Corner:   15 × 15 = 225 ft²  → 225 × 75 = 16,875 lb ≈ 16.9 kip
#   Edge:     15 × 30 = 450 ft²  → 450 × 75 = 33,750 lb ≈ 33.75 kip
#   Interior: 30 × 30 = 900 ft²  → 900 × 75 = 67,500 lb ≈ 67.5 kip
LOAD_CORNER = -16.875    # kip (negative = downward in Y)
LOAD_EDGE = -33.75
LOAD_INTERIOR = -67.5


def grid_index(ix, iz):
    """Grid index within a level (0-based)."""
    return iz * NX + ix


def node_id_at(level, ix, iz):
    """Node ID: level 0 = base (1–16), level 1–5 = stories (17–96)."""
    return level * NODES_PER_LEVEL + grid_index(ix, iz) + 1


def trib_load(ix, iz):
    """Return gravity load (kip) for a node based on its grid position."""
    x_edge = ix == 0 or ix == BAYS_X
    z_edge = iz == 0 or iz == BAYS_Z
    if x_edge and z_edge:
        return LOAD_CORNER
    elif x_edge or z_edge:
        return LOAD_EDGE
    else:
        return LOAD_INTERIOR


def col_label(ix, iz):
    """Column label like A1, B3."""
    return f"{chr(65 + ix)}{iz + 1}"


def generate_fixed_model():
    """Generate the fixed-base 5-story office model."""
    nodes = []
    elements = []
    loads = []
    elem_id = 1
    load_id = 1

    # ── Base nodes (level 0): fully fixed ──
    for iz in range(NZ):
        for ix in range(NX):
            nid = node_id_at(0, ix, iz)
            nodes.append({
                "id": nid,
                "x": round(ix * BAY_WIDTH, 1),
                "y": 0.0,
                "z": round(iz * BAY_WIDTH, 1),
                "restraint": [True, True, True, True, True, True],
                "mass": 0,
                "label": f"Base {col_label(ix, iz)}",
            })

    # ── Story nodes (levels 1–5): all DOF free ──
    for level in range(1, NUM_STORIES + 1):
        y = STORY_HEIGHTS[level - 1]
        for iz in range(NZ):
            for ix in range(NX):
                nid = node_id_at(level, ix, iz)
                mass_val = round(abs(trib_load(ix, iz)) / 386.4, 2)
                nodes.append({
                    "id": nid,
                    "x": round(ix * BAY_WIDTH, 1),
                    "y": round(y, 1),
                    "z": round(iz * BAY_WIDTH, 1),
                    "restraint": [False, False, False, False, False, False],
                    "mass": mass_val,
                    "label": f"Story {level} {col_label(ix, iz)}",
                })

    # ── Columns: connect level to level+1 at each grid point ──
    for level in range(NUM_STORIES):
        for iz in range(NZ):
            for ix in range(NX):
                ni = node_id_at(level, ix, iz)
                nj = node_id_at(level + 1, ix, iz)
                elements.append({
                    "id": elem_id,
                    "type": "column",
                    "nodeI": ni,
                    "nodeJ": nj,
                    "sectionId": COL_SECTION_ID,
                    "materialId": MAT_ID,
                    "label": f"Col {col_label(ix, iz)} Story {level + 1}",
                })
                elem_id += 1

    # ── Beams in X direction: at each story level ──
    for level in range(1, NUM_STORIES + 1):
        for iz in range(NZ):
            for ix in range(BAYS_X):
                ni = node_id_at(level, ix, iz)
                nj = node_id_at(level, ix + 1, iz)
                elements.append({
                    "id": elem_id,
                    "type": "beam",
                    "nodeI": ni,
                    "nodeJ": nj,
                    "sectionId": BEAM_SECTION_ID,
                    "materialId": MAT_ID,
                    "label": f"Beam-X {col_label(ix, iz)}-{col_label(ix+1, iz)} Story {level}",
                })
                elem_id += 1

    # ── Beams in Z direction: at each story level ──
    for level in range(1, NUM_STORIES + 1):
        for ix in range(NX):
            for iz in range(BAYS_Z):
                ni = node_id_at(level, ix, iz)
                nj = node_id_at(level, ix, iz + 1)
                elements.append({
                    "id": elem_id,
                    "type": "beam",
                    "nodeI": ni,
                    "nodeJ": nj,
                    "sectionId": BEAM_SECTION_ID,
                    "materialId": MAT_ID,
                    "label": f"Beam-Z {col_label(ix, iz)}-{col_label(ix, iz+1)} Story {level}",
                })
                elem_id += 1

    # ── Gravity loads at every story node ──
    for level in range(1, NUM_STORIES + 1):
        for iz in range(NZ):
            for ix in range(NX):
                nid = node_id_at(level, ix, iz)
                fy = trib_load(ix, iz)
                loads.append({
                    "id": load_id,
                    "nodeId": nid,
                    "fx": 0, "fy": round(fy, 3), "fz": 0,
                    "mx": 0, "my": 0, "mz": 0,
                })
                load_id += 1

    # Verify counts
    assert len(nodes) == 96, f"Expected 96 nodes, got {len(nodes)}"
    n_cols = NUM_STORIES * NODES_PER_LEVEL  # 5 × 16 = 80
    n_beams_x = NUM_STORIES * NZ * BAYS_X   # 5 × 4 × 3 = 60
    n_beams_z = NUM_STORIES * NX * BAYS_Z   # 5 × 4 × 3 = 60
    assert len(elements) == n_cols + n_beams_x + n_beams_z == 200, \
        f"Expected 200 elements, got {len(elements)}"
    assert len(loads) == 80, f"Expected 80 loads, got {len(loads)}"

    return {
        "modelInfo": {
            "name": "5-Story 3D Steel Office (Fixed-Base)",
            "description": (
                "5-story 3D steel moment frame office building, 3×3 bays @ 30 ft, "
                "15 ft first floor + 13 ft typical. W14×132 columns, W24×68 beams. "
                "Floor load 75 psf. A992 Gr50 steel. Fixed-base."
            ),
            "units": "kip-in",
        },
        "nodes": nodes,
        "elements": elements,
        "sections": SECTIONS,
        "materials": [MATERIAL],
        "bearings": [],
        "loads": loads,
        "groundMotions": [],
    }


def generate_isolated_model(fixed_model):
    """Generate the TFP-isolated variant from the fixed model."""
    import copy
    model = copy.deepcopy(fixed_model)
    model["modelInfo"]["name"] = "5-Story 3D Steel Office (TFP Isolated)"
    model["modelInfo"]["description"] = (
        "5-story 3D steel moment frame office building, 3×3 bays @ 30 ft, "
        "15 ft first floor + 13 ft typical. W14×132 columns, W24×68 beams. "
        "Floor load 75 psf. A992 Gr50 steel. Triple Friction Pendulum (TFP) "
        "isolation at all 16 base columns."
    )

    GROUND_NODE_START = 201

    # ── Change base nodes from fixed to free ──
    for node in model["nodes"]:
        if node["id"] <= NODES_PER_LEVEL:  # base nodes 1–16
            node["restraint"] = [False, False, False, False, False, False]

    # ── Add ground nodes at y = -1, fully fixed ──
    ground_nodes = []
    for iz in range(NZ):
        for ix in range(NX):
            gid = GROUND_NODE_START + grid_index(ix, iz)
            ground_nodes.append({
                "id": gid,
                "x": round(ix * BAY_WIDTH, 1),
                "y": -1.0,
                "z": round(iz * BAY_WIDTH, 1),
                "restraint": [True, True, True, True, True, True],
                "mass": 0,
                "label": f"Ground {col_label(ix, iz)}",
            })
    model["nodes"].extend(ground_nodes)

    # ── Add 16 TFP bearings with per-column tributary weights ──
    # TFP bearing parameters sized for a 5-story office building:
    #   Main radius 168 in → T_eff = 2π√(168/386.4) ≈ 4.14s (good shift from T_fixed ≈ 3.7s)
    #   Inner radii 20 in (building-class TFP, generous for smooth transitions)
    #   Displacement capacities: inner 4 in, main 25 in (ample for MCE)
    #   Higher friction for stability: inner μ 0.015/0.03, outer μ 0.06/0.12
    #   Larger uy=0.08 for smoother elastic-to-sliding transition (aids convergence)
    bearings = []
    for iz in range(NZ):
        for ix in range(NX):
            b_id = grid_index(ix, iz) + 1  # 1–16
            ground_nid = GROUND_NODE_START + grid_index(ix, iz)
            base_nid = node_id_at(0, ix, iz)

            # Bearing weight = total tributary gravity from all 5 floors above
            col_weight = round(abs(trib_load(ix, iz)) * NUM_STORIES, 1)
            # Vertical stiffness proportional to load (~150× weight)
            v_stiff = round(150.0 * col_weight, 0)

            bearings.append({
                "id": b_id,
                "nodeI": ground_nid,
                "nodeJ": base_nid,
                "surfaces": [
                    {"type": "VelDependent", "muSlow": 0.015, "muFast": 0.030, "transRate": 25},
                    {"type": "VelDependent", "muSlow": 0.060, "muFast": 0.120, "transRate": 25},
                    {"type": "VelDependent", "muSlow": 0.060, "muFast": 0.120, "transRate": 25},
                    {"type": "VelDependent", "muSlow": 0.015, "muFast": 0.030, "transRate": 25},
                ],
                "radii": [20.0, 168.0, 20.0],
                "dispCapacities": [4.0, 25.0, 4.0],
                "weight": col_weight,
                "yieldDisp": 0.08,
                "vertStiffness": v_stiff,
                "minVertForce": 0.1,
                "tolerance": 1e-8,
                "label": f"TFP Bearing {col_label(ix, iz)}",
            })
    model["bearings"] = bearings

    assert len(model["nodes"]) == 112, f"Expected 112 nodes, got {len(model['nodes'])}"
    assert len(model["bearings"]) == 16, f"Expected 16 bearings, got {len(model['bearings'])}"

    return model


def main():
    out_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "models")
    os.makedirs(out_dir, exist_ok=True)

    # Fixed-base
    fixed = generate_fixed_model()
    fixed_path = os.path.join(out_dir, "five-story-office-fixed.json")
    with open(fixed_path, "w") as f:
        json.dump(fixed, f, indent=2)
    print(f"✓ Fixed-base: {len(fixed['nodes'])} nodes, {len(fixed['elements'])} elements, "
          f"{len(fixed['loads'])} loads → {fixed_path}")

    # Isolated
    isolated = generate_isolated_model(fixed)
    iso_path = os.path.join(out_dir, "five-story-office-isolated.json")
    with open(iso_path, "w") as f:
        json.dump(isolated, f, indent=2)
    print(f"✓ Isolated: {len(isolated['nodes'])} nodes, {len(isolated['elements'])} elements, "
          f"{len(isolated['bearings'])} bearings, {len(isolated['loads'])} loads → {iso_path}")


if __name__ == "__main__":
    main()
