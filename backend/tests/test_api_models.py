"""Tests for the model CRUD API endpoints.

Endpoints under test:
    POST   /api/models              -- Create a new model
    GET    /api/models/{model_id}   -- Retrieve a stored model
    DELETE /api/models/{model_id}   -- Delete a stored model
"""

from __future__ import annotations


def test_create_model_returns_model_id(api_client, sample_model):
    """POST /api/models creates a model and returns model_id."""
    # The sample_model fixture uses camelCase keys from the JSON fixture,
    # but the backend schema expects snake_case.  Convert top-level keys.
    payload = _to_snake_case_model(sample_model)
    response = api_client.post("/api/models", json=payload)
    assert response.status_code == 201, response.text

    data = response.json()
    assert "model_id" in data
    assert len(data["model_id"]) > 0
    assert "model" in data


def test_get_model_retrieves_stored_model(api_client, sample_model):
    """GET /api/models/{id} retrieves the model."""
    payload = _to_snake_case_model(sample_model)
    create_resp = api_client.post("/api/models", json=payload)
    assert create_resp.status_code == 201
    model_id = create_resp.json()["model_id"]

    get_resp = api_client.get(f"/api/models/{model_id}")
    assert get_resp.status_code == 200

    data = get_resp.json()
    assert data["model_id"] == model_id
    assert "model" in data
    # The stored model should have the same number of nodes
    assert len(data["model"]["nodes"]) == len(sample_model["nodes"])


def test_delete_model_removes_it(api_client, sample_model):
    """DELETE /api/models/{id} removes the model."""
    payload = _to_snake_case_model(sample_model)
    create_resp = api_client.post("/api/models", json=payload)
    model_id = create_resp.json()["model_id"]

    del_resp = api_client.delete(f"/api/models/{model_id}")
    assert del_resp.status_code == 200

    # Subsequent GET should 404
    get_resp = api_client.get(f"/api/models/{model_id}")
    assert get_resp.status_code == 404


def test_get_invalid_model_returns_404(api_client):
    """GET /api/models/{invalid_id} returns 404."""
    response = api_client.get("/api/models/nonexistent-uuid-12345")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_create_model_invalid_data_returns_422(api_client):
    """POST /api/models with invalid data returns 422."""
    # Send an empty object -- missing required fields
    response = api_client.post("/api/models", json={})
    # FastAPI/Pydantic should accept this since StructuralModelSchema
    # has all optional fields with defaults. So send truly invalid data instead.
    response = api_client.post("/api/models", json={"nodes": "not-a-list"})
    assert response.status_code == 422


def test_create_model_with_invalid_node_reference_returns_422(api_client):
    """POST /api/models where elements reference non-existent nodes returns 422."""
    payload = {
        "model_info": {"name": "Bad Refs", "ndm": 2, "ndf": 3},
        "nodes": [{"id": 1, "coords": [0.0, 0.0]}],
        "materials": [],
        "sections": [],
        "elements": [
            {
                "id": 1,
                "type": "elasticBeamColumn",
                "nodes": [1, 999],  # node 999 does not exist
            }
        ],
    }
    response = api_client.post("/api/models", json=payload)
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _to_snake_case_model(model: dict) -> dict:
    """Convert the fixture's camelCase JSON keys to the snake_case format
    expected by the backend Pydantic schemas.

    The StructuralModelSchema uses ``model_info``, ``material_id``,
    ``section_id``, ``node_id``, and ``scale_factor`` as field names.
    """
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
