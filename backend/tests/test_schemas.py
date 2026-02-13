"""Tests for Pydantic v2 schema validation.

Validates that the structural model schemas correctly accept valid data
and reject invalid data with appropriate error messages.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.model import (
    AnalysisParamsSchema,
    ElementSchema,
    NodeSchema,
    StructuralModelSchema,
    TFPBearingSchema,
)


# ---------------------------------------------------------------------------
# StructuralModelSchema
# ---------------------------------------------------------------------------


class TestStructuralModelSchema:
    """Tests for the top-level StructuralModelSchema."""

    def test_validates_correct_model(self, sample_model):
        """A complete, well-formed model passes validation."""
        # Convert camelCase keys to snake_case for the schema
        payload = _to_schema_payload(sample_model)
        model = StructuralModelSchema(**payload)
        assert len(model.nodes) == 12
        assert len(model.elements) == 15
        assert len(model.materials) == 1
        assert len(model.sections) == 2

    def test_accepts_empty_model(self):
        """A model with no nodes/elements uses defaults."""
        model = StructuralModelSchema()
        assert model.nodes == []
        assert model.elements == []
        assert model.model_info["ndm"] is not None

    def test_rejects_invalid_element_node_reference(self):
        """An element referencing a non-existent node fails validation."""
        with pytest.raises(ValidationError, match="non-existent node"):
            StructuralModelSchema(
                nodes=[NodeSchema(id=1, coords=[0.0, 0.0])],
                elements=[
                    ElementSchema(id=1, type="elasticBeamColumn", nodes=[1, 999])
                ],
            )

    def test_rejects_invalid_material_reference_in_section(self):
        """A section referencing a non-existent material fails."""
        from app.schemas.model import SectionSchema, MaterialSchema

        with pytest.raises(ValidationError, match="non-existent material"):
            StructuralModelSchema(
                materials=[MaterialSchema(id=1, type="Elastic")],
                sections=[SectionSchema(id=1, type="Elastic", material_id=999)],
            )


# ---------------------------------------------------------------------------
# NodeSchema
# ---------------------------------------------------------------------------


class TestNodeSchema:
    """Tests for individual node validation."""

    def test_valid_node(self):
        """A node with valid coordinates passes."""
        node = NodeSchema(id=1, coords=[0.0, 0.0, 0.0], fixity=[1, 1, 1, 0, 0, 0])
        assert node.id == 1
        assert len(node.coords) == 3

    def test_rejects_missing_coords(self):
        """A node without coords raises ValidationError."""
        with pytest.raises(ValidationError):
            NodeSchema(id=1)  # type: ignore[call-arg]

    def test_rejects_invalid_fixity_values(self):
        """Fixity values must be 0 or 1."""
        with pytest.raises(ValidationError, match="0.*1"):
            NodeSchema(id=1, coords=[0.0, 0.0], fixity=[2, 0, 0])

    def test_rejects_negative_id(self):
        """Node ID must be a positive integer."""
        with pytest.raises(ValidationError):
            NodeSchema(id=-1, coords=[0.0, 0.0])

    def test_rejects_empty_coords(self):
        """Coords must have at least 1 element."""
        with pytest.raises(ValidationError):
            NodeSchema(id=1, coords=[])


# ---------------------------------------------------------------------------
# TFPBearingSchema
# ---------------------------------------------------------------------------


class TestTFPBearingSchema:
    """Tests for TFP bearing parameter validation."""

    def test_validates_bearing_parameters(self, sample_tfp_bearing):
        """A bearing with all required fields passes validation."""
        # The fixture uses camelCase, but TFPBearingSchema expects exact fields.
        bearing = TFPBearingSchema(**sample_tfp_bearing)
        assert bearing.id == 1
        assert len(bearing.friction_models) == 4
        assert len(bearing.radii) == 3
        assert bearing.weight == 1000.0

    def test_rejects_wrong_number_of_friction_models(self):
        """Must have exactly 4 friction models."""
        with pytest.raises(ValidationError):
            TFPBearingSchema(
                id=1,
                nodes=[1, 2],
                friction_models=[
                    {"mu_slow": 0.01, "mu_fast": 0.02, "trans_rate": 0.4},
                ],  # Only 1 instead of 4
                radii=[0.4, 2.0, 0.4],
                disp_capacities=[0.05, 0.4, 0.05],
                weight=1000.0,
            )

    def test_rejects_negative_weight(self):
        """Weight must be positive."""
        with pytest.raises(ValidationError):
            TFPBearingSchema(
                id=1,
                nodes=[1, 2],
                friction_models=[
                    {"mu_slow": 0.01, "mu_fast": 0.02, "trans_rate": 0.4},
                    {"mu_slow": 0.02, "mu_fast": 0.03, "trans_rate": 0.4},
                    {"mu_slow": 0.01, "mu_fast": 0.02, "trans_rate": 0.4},
                    {"mu_slow": 0.02, "mu_fast": 0.03, "trans_rate": 0.4},
                ],
                radii=[0.4, 2.0, 0.4],
                disp_capacities=[0.05, 0.4, 0.05],
                weight=-500.0,
            )


# ---------------------------------------------------------------------------
# AnalysisParamsSchema
# ---------------------------------------------------------------------------


class TestAnalysisParamsSchema:
    """Tests for analysis parameter validation."""

    def test_static_analysis_params(self):
        """Static analysis requires only the type field."""
        params = AnalysisParamsSchema(type="static")
        assert params.type == "static"

    def test_modal_analysis_params(self):
        """Modal analysis gets a default num_modes if not specified."""
        params = AnalysisParamsSchema(type="modal")
        assert params.num_modes == 3  # default applied by validator

    def test_modal_analysis_with_explicit_modes(self):
        """Modal analysis accepts an explicit num_modes."""
        params = AnalysisParamsSchema(type="modal", num_modes=10)
        assert params.num_modes == 10

    def test_time_history_requires_dt(self):
        """Time-history analysis requires dt."""
        with pytest.raises(ValidationError, match="dt"):
            AnalysisParamsSchema(
                type="time_history",
                num_steps=100,
                ground_motions=[
                    {"dt": 0.01, "acceleration": [0.0, 0.1], "direction": 1}
                ],
            )

    def test_time_history_requires_num_steps(self):
        """Time-history analysis requires num_steps."""
        with pytest.raises(ValidationError, match="num_steps"):
            AnalysisParamsSchema(
                type="time_history",
                dt=0.01,
                ground_motions=[
                    {"dt": 0.01, "acceleration": [0.0, 0.1], "direction": 1}
                ],
            )

    def test_time_history_requires_ground_motions(self):
        """Time-history analysis requires ground motion records."""
        with pytest.raises(ValidationError, match="ground_motions"):
            AnalysisParamsSchema(
                type="time_history",
                dt=0.01,
                num_steps=100,
            )

    def test_invalid_analysis_type_rejected(self):
        """Invalid enum values are rejected."""
        with pytest.raises(ValidationError):
            AnalysisParamsSchema(type="invalid_type")  # type: ignore[arg-type]

    def test_valid_time_history_params(self):
        """Complete time-history parameters pass validation."""
        params = AnalysisParamsSchema(
            type="time_history",
            dt=0.01,
            num_steps=2000,
            ground_motions=[
                {"dt": 0.01, "acceleration": [0.0, 0.1, 0.2], "direction": 1}
            ],
        )
        assert params.dt == 0.01
        assert params.num_steps == 2000
        assert len(params.ground_motions) == 1


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _to_schema_payload(model: dict) -> dict:
    """Convert fixture JSON to snake_case keys for StructuralModelSchema."""
    return {
        "model_info": model.get("modelInfo", model.get("model_info", {})),
        "nodes": model.get("nodes", []),
        "materials": model.get("materials", []),
        "sections": [
            {
                "id": s["id"],
                "type": s["type"],
                "name": s.get("name", ""),
                "properties": s.get("properties", {}),
                "material_id": s.get("materialId", s.get("material_id", 1)),
            }
            for s in model.get("sections", [])
        ],
        "elements": [
            {
                "id": e["id"],
                "type": e["type"],
                "nodes": e["nodes"],
                "section_id": e.get("sectionId", e.get("section_id", 0)),
                "transform": e.get("transform", "Linear"),
            }
            for e in model.get("elements", [])
        ],
        "bearings": model.get("bearings", []),
        "loads": [
            {
                "type": load.get("type", "nodal"),
                "node_id": load.get("nodeId", load.get("node_id")),
                "values": load.get("values", []),
            }
            for load in model.get("loads", [])
        ],
    }
