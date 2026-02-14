"""Common fixtures for backend tests.

Provides reusable model data fixtures for solver and API tests.
"""

from __future__ import annotations

import pytest


@pytest.fixture()
def minimal_2d_model() -> dict:
    """Minimal 2-node cantilever beam (2D, ndf=3).

    Node 1 fixed at origin, node 2 free at x=100.
    Single elastic beam-column with 10 kip downward load at free end.
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
                "properties": {"A": 20.0, "Iz": 722.0, "Iy": 121.0, "E": 29000.0, "d": 14.04},
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


@pytest.fixture()
def three_story_frame_model() -> dict:
    """3-story 2-bay frame with base-isolated bearings.

    Ground nodes 101-103 at y=-1, base nodes 1-3 at y=0.
    Stories at y=144, 288, 432 (inches). Bearings connect ground to base.
    """
    nodes = [
        # Ground nodes (fixed)
        {"id": 101, "coords": [0.0, -1.0], "fixity": [1, 1, 1]},
        {"id": 102, "coords": [288.0, -1.0], "fixity": [1, 1, 1]},
        {"id": 103, "coords": [576.0, -1.0], "fixity": [1, 1, 1]},
        # Base nodes (free, bearing tops)
        {"id": 1, "coords": [0.0, 0.0], "fixity": []},
        {"id": 2, "coords": [288.0, 0.0], "fixity": []},
        {"id": 3, "coords": [576.0, 0.0], "fixity": []},
        # Story 1
        {"id": 4, "coords": [0.0, 144.0], "fixity": []},
        {"id": 5, "coords": [288.0, 144.0], "fixity": []},
        {"id": 6, "coords": [576.0, 144.0], "fixity": []},
        # Story 2
        {"id": 7, "coords": [0.0, 288.0], "fixity": []},
        {"id": 8, "coords": [288.0, 288.0], "fixity": []},
        {"id": 9, "coords": [576.0, 288.0], "fixity": []},
        # Story 3 (roof)
        {"id": 10, "coords": [0.0, 432.0], "fixity": []},
        {"id": 11, "coords": [288.0, 432.0], "fixity": []},
        {"id": 12, "coords": [576.0, 432.0], "fixity": []},
    ]

    materials = [
        {"id": 1, "type": "Elastic", "name": "A992 Steel", "params": {"E": 29000.0}},
    ]

    sections = [
        {
            "id": 1,
            "type": "WideFlange",
            "name": "W14x68",
            "properties": {"A": 20.0, "Iz": 722.0, "Iy": 121.0, "E": 29000.0, "d": 14.04},
            "material_id": 1,
        },
        {
            "id": 2,
            "type": "WideFlange",
            "name": "W24x68",
            "properties": {"A": 20.1, "Iz": 1830.0, "Iy": 70.4, "E": 29000.0, "d": 23.73},
            "material_id": 1,
        },
    ]

    # Columns (9) and beams (6)
    elements = []
    eid = 1
    # Columns: 3 per story, 3 stories
    for story in range(3):
        for col in range(3):
            i_node = story * 3 + col + 1
            j_node = (story + 1) * 3 + col + 1
            elements.append({
                "id": eid,
                "type": "elasticBeamColumn",
                "nodes": [i_node, j_node],
                "section_id": 1,
                "transform": "Linear",
            })
            eid += 1

    # Beams: 2 per floor, 3 floors
    for floor in range(1, 4):
        for bay in range(2):
            i_node = floor * 3 + bay + 1
            j_node = floor * 3 + bay + 2
            elements.append({
                "id": eid,
                "type": "elasticBeamColumn",
                "nodes": [i_node, j_node],
                "section_id": 2,
                "transform": "Linear",
            })
            eid += 1

    bearings = []
    for i in range(3):
        bearings.append({
            "id": i + 1,
            "nodes": [101 + i, i + 1],
            "friction_models": [
                {"mu_slow": 0.012, "mu_fast": 0.018, "trans_rate": 0.4},
                {"mu_slow": 0.012, "mu_fast": 0.018, "trans_rate": 0.4},
                {"mu_slow": 0.018, "mu_fast": 0.030, "trans_rate": 0.4},
                {"mu_slow": 0.018, "mu_fast": 0.030, "trans_rate": 0.4},
            ],
            "radii": [16, 84, 16],
            "disp_capacities": [2, 16, 2],
            "weight": 150,
            "uy": 0.04,
            "kvt": 10000,
            "min_fv": 0.1,
            "tol": 1e-8,
        })

    loads = []
    load_id = 1
    # Gravity loads on all free structural nodes above base
    for node in nodes:
        if node["coords"][1] > 0:
            loads.append({
                "type": "nodal",
                "node_id": node["id"],
                "values": [0.0, -50.0, 0.0],
            })
            load_id += 1

    return {
        "model_info": {"name": "3-Story Base-Isolated Frame", "ndm": 2, "ndf": 3},
        "nodes": nodes,
        "materials": materials,
        "sections": sections,
        "elements": elements,
        "bearings": bearings,
        "loads": loads,
    }


@pytest.fixture()
def empty_model() -> dict:
    """Model with no nodes, elements, or loads."""
    return {
        "model_info": {"ndm": 2, "ndf": 3},
        "nodes": [],
        "materials": [],
        "sections": [],
        "elements": [],
        "bearings": [],
        "loads": [],
    }
