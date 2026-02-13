"""REST endpoints for retrieving analysis results.

Endpoints:
    GET /api/results/{analysis_id}          -- Full analysis results
    GET /api/results/{analysis_id}/summary  -- Summary statistics
"""

from __future__ import annotations

import math
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.routers.analysis import get_analysis_store

router = APIRouter(prefix="/api/results", tags=["results"])


# --------------------------------------------------------------------------
# GET /api/results/{analysis_id}
# --------------------------------------------------------------------------


@router.get(
    "/{analysis_id}",
    summary="Retrieve full analysis results",
    response_description="Complete analysis results",
)
async def get_results(analysis_id: str) -> dict[str, Any]:
    """Return the complete results for a finished analysis.

    Args:
        analysis_id: UUID of the analysis run.

    Returns:
        The full analysis record including status and results.

    Raises:
        HTTPException 404: If the analysis_id is not found.
        HTTPException 409: If the analysis has not completed.
    """
    store = get_analysis_store()
    if analysis_id not in store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis '{analysis_id}' not found",
        )

    entry = store[analysis_id]
    if entry["status"] == "failed":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {entry.get('error', 'unknown error')}",
        )

    if entry["status"] != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Analysis is still '{entry['status']}'",
        )

    return entry


# --------------------------------------------------------------------------
# GET /api/results/{analysis_id}/summary
# --------------------------------------------------------------------------


@router.get(
    "/{analysis_id}/summary",
    summary="Retrieve analysis result summary",
    response_description="Summary statistics of the analysis",
)
async def get_results_summary(analysis_id: str) -> dict[str, Any]:
    """Return summary statistics for a completed analysis.

    The summary depends on the analysis type:
    - **static**: Max displacement, max reaction.
    - **modal**: List of periods and frequencies.
    - **time_history**: Peak displacements, peak forces, bearing peaks.

    Args:
        analysis_id: UUID of the analysis run.

    Returns:
        A dict with ``analysis_id``, ``type``, and type-specific summary.

    Raises:
        HTTPException 404: If the analysis_id is not found.
        HTTPException 409: If the analysis has not completed.
    """
    store = get_analysis_store()
    if analysis_id not in store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis '{analysis_id}' not found",
        )

    entry = store[analysis_id]
    if entry["status"] != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Analysis is still '{entry['status']}'",
        )

    results = entry.get("results", {})
    analysis_type = entry["type"]
    summary: dict[str, Any] = {
        "analysis_id": analysis_id,
        "model_id": entry["model_id"],
        "type": analysis_type,
        "status": entry["status"],
    }

    if analysis_type == "static":
        summary.update(_summarise_static(results))
    elif analysis_type == "modal":
        summary.update(_summarise_modal(results))
    elif analysis_type == "time_history":
        summary.update(_summarise_time_history(results))

    return summary


# --------------------------------------------------------------------------
# Private summary helpers
# --------------------------------------------------------------------------


def _summarise_static(results: dict) -> dict[str, Any]:
    """Compute summary statistics for static analysis results."""
    node_disps = results.get("node_displacements", {})
    reactions = results.get("reactions", {})

    max_disp = 0.0
    max_disp_node = ""
    for nid, disps in node_disps.items():
        mag = math.sqrt(sum(d * d for d in disps))
        if mag > max_disp:
            max_disp = mag
            max_disp_node = nid

    max_reaction = 0.0
    max_reaction_node = ""
    for nid, rxns in reactions.items():
        mag = math.sqrt(sum(r * r for r in rxns))
        if mag > max_reaction:
            max_reaction = mag
            max_reaction_node = nid

    return {
        "max_displacement": max_disp,
        "max_displacement_node": max_disp_node,
        "max_reaction": max_reaction,
        "max_reaction_node": max_reaction_node,
        "num_nodes": len(node_disps),
    }


def _summarise_modal(results: dict) -> dict[str, Any]:
    """Compute summary statistics for modal analysis results."""
    periods = results.get("periods", [])
    frequencies = results.get("frequencies", [])

    return {
        "num_modes": len(periods),
        "periods": periods,
        "frequencies": frequencies,
        "fundamental_period": periods[0] if periods else None,
        "fundamental_frequency": frequencies[0] if frequencies else None,
    }


def _summarise_time_history(results: dict) -> dict[str, Any]:
    """Compute summary statistics for time-history analysis results."""
    time_vals = results.get("time", [])
    node_disps = results.get("node_displacements", {})
    bearing_resps = results.get("bearing_responses", {})

    # Peak node displacements
    peak_node_disps: dict[str, float] = {}
    for nid, dof_data in node_disps.items():
        if isinstance(dof_data, dict):
            peak = 0.0
            for dof, vals in dof_data.items():
                if vals:
                    peak = max(peak, max(abs(v) for v in vals))
            peak_node_disps[nid] = peak

    # Peak bearing responses
    peak_bearing: dict[str, dict[str, float]] = {}
    for bid, resp_data in bearing_resps.items():
        if isinstance(resp_data, dict):
            peak_bearing[bid] = {}
            for key, vals in resp_data.items():
                if vals:
                    peak_bearing[bid][f"peak_{key}"] = max(abs(v) for v in vals)

    total_duration = time_vals[-1] if time_vals else 0.0

    return {
        "duration": total_duration,
        "num_steps": len(time_vals),
        "peak_node_displacements": peak_node_disps,
        "peak_bearing_responses": peak_bearing,
    }
