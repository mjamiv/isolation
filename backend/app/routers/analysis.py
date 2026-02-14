"""REST and WebSocket endpoints for running structural analyses.

Provides synchronous analysis execution and a WebSocket skeleton for
streaming results step-by-step.

Endpoints:
    POST /api/analysis/run                  -- Run an analysis synchronously
    GET  /api/analysis/{analysis_id}/status  -- Check analysis status
    WS   /ws/analysis/{analysis_id}          -- Stream results (skeleton)
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field

from app.routers.models import get_model_store
from app.schemas.model import AnalysisParamsSchema

# NOTE: Solver imports are deferred to avoid loading openseespy at module
# import time. This allows the API tests to run even when openseespy is
# not installed or is incompatible with the current architecture.

logger = logging.getLogger(__name__)

router = APIRouter(tags=["analysis"])

# In-memory analysis results store  --  analysis_id -> result dict
_analysis_store: dict[str, dict[str, Any]] = {}


def get_analysis_store() -> dict[str, dict[str, Any]]:
    """Return a reference to the in-memory analysis store.

    Used by the results router to look up completed analyses.
    """
    return _analysis_store


# --------------------------------------------------------------------------
# Request schema
# --------------------------------------------------------------------------


class RunAnalysisRequest(BaseModel):
    """Request body for POST /api/analysis/run."""

    model_id: str = Field(..., description="ID of the model to analyse")
    params: AnalysisParamsSchema = Field(..., description="Analysis parameters")


# --------------------------------------------------------------------------
# POST /api/analysis/run
# --------------------------------------------------------------------------


@router.post(
    "/api/analysis/run",
    status_code=status.HTTP_200_OK,
    summary="Run a structural analysis",
    response_description="Analysis results with status",
)
async def run_analysis(request: RunAnalysisRequest) -> dict[str, Any]:
    """Execute a structural analysis synchronously and return results.

    Supports four analysis types:
    - ``static``: Gravity / load-based analysis.
    - ``modal``: Eigenvalue analysis for natural periods and mode shapes.
    - ``time_history``: Nonlinear time-history with ground motion input.
    - ``pushover``: Nonlinear static pushover with displacement control.

    Args:
        request: Contains the ``model_id`` and ``params`` (analysis type
            and type-specific settings).

    Returns:
        A dict with ``analysis_id``, ``model_id``, ``status``, ``type``,
        and ``results`` (or ``error``).

    Raises:
        HTTPException 404: If the model_id is not found.
        HTTPException 500: If the solver encounters an error.
    """
    model_store = get_model_store()
    if request.model_id not in model_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{request.model_id}' not found",
        )

    model_data = model_store[request.model_id]
    params = request.params
    analysis_id = str(uuid.uuid4())
    analysis_type = params.type

    # Mark as running
    _analysis_store[analysis_id] = {
        "analysis_id": analysis_id,
        "model_id": request.model_id,
        "status": "running",
        "type": analysis_type,
        "results": None,
        "error": None,
    }

    try:
        # Lazy import to avoid loading openseespy at module import time
        from app.services.solver import (
            run_modal_analysis,
            run_pushover_analysis,
            run_static_analysis,
            run_time_history,
        )

        if analysis_type == "static":
            results = run_static_analysis(model_data)

        elif analysis_type == "modal":
            num_modes = params.num_modes or 3
            results = run_modal_analysis(model_data, num_modes=num_modes)

        elif analysis_type == "time_history":
            # Use first ground motion record
            if not params.ground_motions:
                raise ValueError("No ground motion records provided")
            gm = params.ground_motions[0]
            accel = [a * gm.scale_factor for a in gm.acceleration]
            results = run_time_history(
                model_data,
                ground_motion=accel,
                dt=params.dt or gm.dt,
                num_steps=params.num_steps or len(accel),
            )

        elif analysis_type == "pushover":
            if params.target_displacement is None:
                raise ValueError("target_displacement is required for pushover")
            results = run_pushover_analysis(
                model_data,
                target_displacement=params.target_displacement,
                num_steps=params.num_steps or 100,
                control_node=params.control_node,
                control_dof=params.control_dof or 1,
                load_pattern=params.load_pattern or "linear",
            )

        else:
            raise ValueError(f"Unsupported analysis type: {analysis_type}")

        # Store completed results
        _analysis_store[analysis_id].update(
            {"status": "completed", "results": results}
        )

    except Exception as exc:
        logger.exception("Analysis %s failed", analysis_id)
        _analysis_store[analysis_id].update(
            {"status": "failed", "error": str(exc)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Analysis failed due to an internal error",
        )

    return _analysis_store[analysis_id]


# --------------------------------------------------------------------------
# GET /api/analysis/{analysis_id}/status
# --------------------------------------------------------------------------


@router.get(
    "/api/analysis/{analysis_id}/status",
    summary="Get analysis status",
    response_description="Current status of the analysis",
)
async def get_analysis_status(analysis_id: str) -> dict[str, Any]:
    """Return the current status of an analysis.

    Args:
        analysis_id: UUID of the analysis run.

    Returns:
        A dict with ``analysis_id``, ``status``, and ``type``.

    Raises:
        HTTPException 404: If the analysis_id is not found.
    """
    if analysis_id not in _analysis_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis '{analysis_id}' not found",
        )
    entry = _analysis_store[analysis_id]
    return {
        "analysis_id": entry["analysis_id"],
        "status": entry["status"],
        "type": entry["type"],
        "error": entry.get("error"),
    }


# --------------------------------------------------------------------------
# WS /ws/analysis/{analysis_id}  --  Streaming skeleton
# --------------------------------------------------------------------------


@router.websocket("/ws/analysis/{analysis_id}")
async def ws_analysis_stream(websocket: WebSocket, analysis_id: str) -> None:
    """WebSocket endpoint for streaming analysis results step-by-step.

    This is a skeleton implementation that demonstrates the protocol.
    In a production system, the solver would push intermediate results
    through this channel during a long-running time-history analysis.

    Protocol:
        1. Client connects.
        2. Server sends ``{"type": "connected", "analysis_id": ...}``.
        3. Server sends ``{"type": "step", "step": n, "data": {...}}``
           for each analysis step (placeholder).
        4. Server sends ``{"type": "complete", "analysis_id": ...}``
           when finished.
        5. Connection is closed.

    Args:
        websocket: The WebSocket connection.
        analysis_id: UUID of the analysis to stream.
    """
    await websocket.accept()
    logger.info("WebSocket connected for analysis %s", analysis_id)

    try:
        # Send connection confirmation
        await websocket.send_json({
            "type": "connected",
            "analysis_id": analysis_id,
        })

        # Check if analysis exists and has results
        if analysis_id in _analysis_store:
            entry = _analysis_store[analysis_id]

            if entry["status"] == "completed" and entry.get("results"):
                results = entry["results"]

                # For time-history results, stream time steps
                if "time" in results and results["time"]:
                    time_vals = results["time"]
                    total_steps = len(time_vals)

                    # Stream a subset of steps to avoid overwhelming the client
                    stride = max(1, total_steps // 100)  # ~100 messages max
                    for i in range(0, total_steps, stride):
                        step_data: dict[str, Any] = {
                            "time": time_vals[i],
                            "step": i,
                        }

                        # Include node displacements for this step
                        node_disps = results.get("node_displacements", {})
                        for nid, dof_data in node_disps.items():
                            if isinstance(dof_data, dict):
                                step_data[f"node_{nid}"] = {
                                    dof: vals[i] if i < len(vals) else 0.0
                                    for dof, vals in dof_data.items()
                                }

                        # Include bearing responses for this step
                        bearing_resps = results.get("bearing_responses", {})
                        for bid, resp_data in bearing_resps.items():
                            if isinstance(resp_data, dict):
                                step_data[f"bearing_{bid}"] = {
                                    key: vals[i] if i < len(vals) else 0.0
                                    for key, vals in resp_data.items()
                                }

                        await websocket.send_json({
                            "type": "step",
                            "step": i,
                            "total_steps": total_steps,
                            "data": step_data,
                        })
                else:
                    # Non-time-history: send full results in one message
                    await websocket.send_json({
                        "type": "results",
                        "data": results,
                    })
            else:
                await websocket.send_json({
                    "type": "status",
                    "status": entry["status"],
                    "error": entry.get("error"),
                })
        else:
            await websocket.send_json({
                "type": "error",
                "detail": f"Analysis '{analysis_id}' not found",
            })

        # Send completion message
        await websocket.send_json({
            "type": "complete",
            "analysis_id": analysis_id,
        })

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for analysis %s", analysis_id)
    except Exception as exc:
        logger.exception("WebSocket error for analysis %s", analysis_id)
        try:
            await websocket.send_json({"type": "error", "detail": "An internal error occurred"})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
