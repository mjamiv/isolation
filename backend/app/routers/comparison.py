"""REST endpoint for running ductile vs isolated comparison analyses.

Generates a fixed-base variant from the isolated model, runs pushover
analysis on both variants (and optionally upper/lower bound lambda
variants), and returns paired results.

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
    params: AnalysisParamsSchema = Field(..., description="Pushover analysis parameters")
    lambda_factors: LambdaFactorsSchema | None = Field(
        default=None, description="Optional lambda factors for upper/lower bound"
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


@router.post(
    "/api/comparison/run",
    status_code=status.HTTP_200_OK,
    summary="Run ductile vs isolated comparison",
    response_description="Paired comparison results",
)
async def run_comparison(request: RunComparisonRequest) -> dict[str, Any]:
    """Run pushover analysis on both isolated and fixed-base variants.

    1. Runs pushover on the original (isolated) model.
    2. Generates a fixed-base variant and runs pushover on it.
    3. Optionally runs upper/lower bound lambda variants.

    Args:
        request: Contains model_id, pushover params, and optional lambda factors.

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

    try:
        # 1. Run isolated (nominal) pushover
        logger.info("Comparison %s: running isolated (nominal) pushover", comparison_id)
        isolated_results = _run_variant_pushover(model_data, request.params)

        # 2. Generate fixed-base variant and run pushover
        logger.info("Comparison %s: running fixed-base pushover", comparison_id)
        fixed_base_model = generate_fixed_base_variant(model_data)
        fixed_base_results = _run_variant_pushover(fixed_base_model, request.params)

        # 3. Optional upper/lower bound runs
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
            detail=f"Comparison analysis failed: {exc}",
        )
