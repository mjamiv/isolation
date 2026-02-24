"""REST endpoint for running ductile vs isolated comparison analyses.

Generates a fixed-base variant from the isolated model, runs pushover
or time-history analysis on both variants (and optionally upper/lower
bound lambda variants for pushover), and returns paired results.

Endpoints:
    POST /api/comparison/run  -- Run comparison analysis
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.routers.models import get_model_store
from app.schemas.model import AnalysisParamsSchema

logger = logging.getLogger(__name__)

router = APIRouter(tags=["comparison"])


# --------------------------------------------------------------------------
# Request / Response schemas
# --------------------------------------------------------------------------


class LambdaFactorsSchema(BaseModel):
    """ASCE 7-22 Chapter 17 property modification factors."""

    lambda_min: float = Field(default=0.85, description="Lower-bound factor")
    lambda_max: float = Field(default=1.8, description="Upper-bound factor")


class RunComparisonRequest(BaseModel):
    """Request body for POST /api/comparison/run."""

    model_id: str = Field(..., description="ID of the isolated model to compare")
    params: AnalysisParamsSchema = Field(..., description="Analysis parameters (pushover or time_history)")
    lambda_factors: LambdaFactorsSchema | None = Field(
        default=None, description="Optional lambda factors for upper/lower bound (pushover only)"
    )


# --------------------------------------------------------------------------
# POST /api/comparison/run
# --------------------------------------------------------------------------


def _run_variant_pushover(
    model_data: dict, params: AnalysisParamsSchema
) -> dict[str, Any]:
    """Run pushover analysis on a model variant and return structured results."""
    from app.services.solver import run_pushover_analysis

    results = run_pushover_analysis(
        model_data,
        target_displacement=params.target_displacement or 10.0,
        num_steps=params.num_steps or 100,
        control_node=params.control_node,
        control_dof=params.control_dof or 1,
        load_pattern=params.load_pattern or "linear",
    )

    return {
        "pushover_results": {
            "capacity_curve": results.get("capacity_curve", []),
            "max_base_shear": results.get("max_base_shear", 0.0),
            "max_roof_displacement": results.get("max_roof_displacement", 0.0),
            "ductility_ratio": (
                results.get("max_roof_displacement", 0.0)
                / max(params.target_displacement or 10.0, 0.001)
            ),
        },
        "hinge_states": results.get("hinge_states", []),
        "max_base_shear": results.get("max_base_shear", 0.0),
        "max_roof_displacement": results.get("max_roof_displacement", 0.0),
        "node_displacements": results.get("node_displacements", {}),
        "element_forces": results.get("element_forces", {}),
        "reactions": results.get("reactions", {}),
        "deformed_shape": results.get("deformed_shape", {}),
    }


def _run_variant_time_history(
    model_data: dict, params: AnalysisParamsSchema
) -> dict[str, Any]:
    """Run time-history analysis on a model variant and return structured results."""
    from app.services.solver import run_time_history

    if not params.ground_motions:
        raise ValueError("No ground motion records provided for time-history comparison")

    gm_list = [
        {
            "acceleration": [a * gm.scale_factor for a in gm.acceleration],
            "dt": gm.dt,
            "direction": gm.direction,
        }
        for gm in params.ground_motions
    ]

    results = run_time_history(
        model_data,
        ground_motions=gm_list,
        dt=params.dt or gm_list[0]["dt"],
        num_steps=params.num_steps or len(gm_list[0]["acceleration"]),
    )

    return {
        "time_history_results": results,
        "max_base_shear": results.get("max_base_shear", 0.0),
        "max_roof_displacement": results.get("max_roof_displacement", 0.0),
    }


@router.post(
    "/api/comparison/run",
    status_code=status.HTTP_200_OK,
    summary="Run ductile vs isolated comparison",
    response_description="Paired comparison results",
)
async def run_comparison(request: RunComparisonRequest) -> dict[str, Any]:
    """Run analysis on both isolated and fixed-base variants.

    Supports pushover and time-history comparison types.

    1. Runs analysis on the original (isolated) model.
    2. Generates a fixed-base variant and runs the same analysis on it.
    3. For pushover, optionally runs upper/lower bound lambda variants.

    Args:
        request: Contains model_id, analysis params, and optional lambda factors.

    Returns:
        A dict with comparison_id, status, and paired results for each variant.
    """
    from app.services.solver import apply_lambda_factor, generate_fixed_base_variant

    model_store = get_model_store()
    if request.model_id not in model_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{request.model_id}' not found",
        )

    model_data = model_store[request.model_id]
    comparison_id = str(uuid.uuid4())
    comparison_type = request.params.type or "pushover"

    try:
        fixed_base_model = generate_fixed_base_variant(model_data)

        if comparison_type == "time_history":
            # Time-history comparison: run on both variants, no lambda factors
            logger.info("Comparison %s: running isolated time-history", comparison_id)
            isolated_results = _run_variant_time_history(model_data, request.params)

            logger.info("Comparison %s: running fixed-base time-history", comparison_id)
            fixed_base_results = _run_variant_time_history(fixed_base_model, request.params)

            return {
                "comparison_id": comparison_id,
                "model_id": request.model_id,
                "comparison_type": "time_history",
                "status": "complete",
                "isolated": isolated_results,
                "isolated_upper": None,
                "isolated_lower": None,
                "fixed_base": fixed_base_results,
                "lambda_factors": None,
                "error": None,
            }

        # Default: pushover comparison
        logger.info("Comparison %s: running isolated (nominal) pushover", comparison_id)
        isolated_results = _run_variant_pushover(model_data, request.params)

        logger.info("Comparison %s: running fixed-base pushover", comparison_id)
        fixed_base_results = _run_variant_pushover(fixed_base_model, request.params)

        # Optional upper/lower bound runs
        isolated_upper = None
        isolated_lower = None
        lambda_factors_out = None

        if request.lambda_factors:
            lf = request.lambda_factors
            lambda_factors_out = {
                "min": lf.lambda_min,
                "max": lf.lambda_max,
            }

            logger.info(
                "Comparison %s: running upper bound (lambda=%.2f)",
                comparison_id,
                lf.lambda_max,
            )
            upper_model = apply_lambda_factor(model_data, lf.lambda_max)
            isolated_upper = _run_variant_pushover(upper_model, request.params)

            logger.info(
                "Comparison %s: running lower bound (lambda=%.2f)",
                comparison_id,
                lf.lambda_min,
            )
            lower_model = apply_lambda_factor(model_data, lf.lambda_min)
            isolated_lower = _run_variant_pushover(lower_model, request.params)

        return {
            "comparison_id": comparison_id,
            "model_id": request.model_id,
            "comparison_type": "pushover",
            "status": "complete",
            "isolated": isolated_results,
            "isolated_upper": isolated_upper,
            "isolated_lower": isolated_lower,
            "fixed_base": fixed_base_results,
            "lambda_factors": lambda_factors_out,
            "error": None,
        }

    except Exception as exc:
        logger.exception("Comparison %s failed", comparison_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Comparison analysis failed due to an internal error",
        )
