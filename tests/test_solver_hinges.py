from backend.app.services.solver import _build_pushover_hinge_diagnostic, _compute_hinge_states


def test_compute_hinge_states_uses_3d_moment_components():
    model = {
        "materials": [{"id": 1, "type": "Steel02", "params": {"Fy": 50.0, "E": 29000.0}}],
        "sections": [
            {
                "id": 1,
                "type": "Elastic",
                "material_id": 1,
                "properties": {"Iz": 1000.0, "Iy": 600.0, "d": 20.0, "b": 12.0},
            }
        ],
        "elements": [{"id": 101, "type": "elasticBeamColumn", "section_id": 1}],
    }
    element_forces = {
        "101": [
            0.0,
            3.0,
            2.0,
            0.0,
            6000.0,
            100.0,
            0.0,
            2.0,
            1.0,
            0.0,
            5500.0,
            50.0,
        ]
    }

    hinges = _compute_hinge_states(model, element_forces)
    assert len(hinges) == 2
    assert hinges[0]["moment"] == 6000.0
    assert hinges[1]["moment"] == 5500.0
    assert any(h["performance_level"] in {"IO", "LS", "CP"} for h in hinges)


def test_hinge_diagnostic_reports_elastic_material_models():
    model = {"materials": [{"id": 1, "type": "Elastic", "params": {"E": 29000.0}}]}
    hinge_states = [
        {"performance_level": None, "demand_capacity_ratio": 0.42},
        {"performance_level": None, "demand_capacity_ratio": 0.39},
    ]

    diagnostic = _build_pushover_hinge_diagnostic(model, hinge_states)
    assert diagnostic is not None
    assert "Elastic" in diagnostic
