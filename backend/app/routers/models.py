"""REST endpoints for structural model management.

Provides CRUD operations for structural models stored in an in-memory
dictionary. Models are validated with Pydantic on submission and stored
keyed by a UUID-based ``model_id``.

Endpoints:
    POST   /api/models              -- Create a new model
    GET    /api/models/{model_id}   -- Retrieve a stored model
    DELETE /api/models/{model_id}   -- Delete a stored model
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.schemas.model import StructuralModelSchema

router = APIRouter(prefix="/api/models", tags=["models"])

# In-memory model store  --  model_id (str) -> model dict
_model_store: dict[str, dict[str, Any]] = {}


def get_model_store() -> dict[str, dict[str, Any]]:
    """Return a reference to the in-memory model store.

    Useful for other modules (e.g. analysis router) that need to look up
    models by ID.
    """
    return _model_store


# --------------------------------------------------------------------------
# POST /api/models
# --------------------------------------------------------------------------


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a structural model",
    response_description="The assigned model_id and validated model data",
)
async def create_model(model: StructuralModelSchema) -> dict[str, Any]:
    """Accept a structural model JSON, validate it, and store in memory.

    The model is validated through the ``StructuralModelSchema`` Pydantic
    model (node references, material references, etc.) before storage.

    Args:
        model: Validated structural model data.

    Returns:
        A dict with ``model_id`` and the stored ``model`` data.
    """
    model_id = str(uuid.uuid4())
    model_dict = model.model_dump()
    _model_store[model_id] = model_dict
    return {"model_id": model_id, "model": model_dict}


# --------------------------------------------------------------------------
# GET /api/models/{model_id}
# --------------------------------------------------------------------------


@router.get(
    "/{model_id}",
    summary="Retrieve a structural model",
    response_description="The stored model data",
)
async def get_model(model_id: str) -> dict[str, Any]:
    """Return a previously stored structural model by its ID.

    Args:
        model_id: UUID of the model to retrieve.

    Returns:
        A dict with ``model_id`` and the stored ``model`` data.

    Raises:
        HTTPException 404: If the model_id is not found.
    """
    if model_id not in _model_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{model_id}' not found",
        )
    return {"model_id": model_id, "model": _model_store[model_id]}


# --------------------------------------------------------------------------
# DELETE /api/models/{model_id}
# --------------------------------------------------------------------------


@router.delete(
    "/{model_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a structural model",
    response_description="Confirmation of deletion",
)
async def delete_model(model_id: str) -> dict[str, str]:
    """Delete a stored structural model from memory.

    Args:
        model_id: UUID of the model to delete.

    Returns:
        Confirmation message.

    Raises:
        HTTPException 404: If the model_id is not found.
    """
    if model_id not in _model_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{model_id}' not found",
        )
    del _model_store[model_id]
    return {"detail": f"Model '{model_id}' deleted"}
