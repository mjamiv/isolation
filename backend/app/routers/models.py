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

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import settings
from app.core.security import require_api_key
from app.schemas.model import StructuralModelSchema

router = APIRouter(
    prefix="/api/models",
    tags=["models"],
    dependencies=[Depends(require_api_key)],
)

# In-memory model store  --  model_id (str) -> model dict
# Uses insertion order (Python 3.7+) for FIFO eviction
_model_store: dict[str, dict[str, Any]] = {}
_model_order: list[str] = []


def _evict_oldest_models_if_needed() -> None:
    """Evict oldest models when store exceeds MAX_MODELS."""
    while len(_model_store) >= settings.MAX_MODELS and _model_order:
        oldest = _model_order.pop(0)
        if oldest in _model_store:
            del _model_store[oldest]


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

    Raises:
        HTTPException 429: If the model store is full (after eviction attempt).
    """
    _evict_oldest_models_if_needed()
    if len(_model_store) >= settings.MAX_MODELS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Model store full (max {settings.MAX_MODELS}). Delete models to create new ones.",
        )
    model_id = str(uuid.uuid4())
    model_dict = model.model_dump()
    _model_store[model_id] = model_dict
    _model_order.append(model_id)
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
    if model_id in _model_order:
        _model_order.remove(model_id)
    return {"detail": f"Model '{model_id}' deleted"}
