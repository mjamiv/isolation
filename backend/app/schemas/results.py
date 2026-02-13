"""Pydantic v2 schemas for analysis results.

These schemas serialize the output of OpenSeesPy analyses into
structured, validated JSON responses.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class StaticResultsSchema(BaseModel):
    """Results from a static (gravity) analysis.

    Attributes:
        node_displacements: Mapping of node_id -> list of displacements per DOF.
        element_forces: Mapping of element_id -> list of local forces.
        reactions: Mapping of fixed node_id -> list of reaction forces per DOF.
    """

    model_config = ConfigDict(strict=False)

    node_displacements: dict[str, list[float]] = Field(
        default_factory=dict,
        description="node_id -> [disp_x, disp_y, ...]",
    )
    element_forces: dict[str, list[float]] = Field(
        default_factory=dict,
        description="element_id -> [force_1, force_2, ...]",
    )
    reactions: dict[str, list[float]] = Field(
        default_factory=dict,
        description="node_id -> [reaction_x, reaction_y, ...]",
    )


class ModalResultsSchema(BaseModel):
    """Results from a modal (eigenvalue) analysis.

    Attributes:
        periods: Natural periods for each mode (seconds).
        frequencies: Natural frequencies for each mode (Hz).
        mode_shapes: Mapping of mode_number -> {node_id -> [displacements]}.
        mass_participation: Mapping of direction -> list of participation ratios per mode.
    """

    model_config = ConfigDict(strict=False)

    periods: list[float] = Field(default_factory=list, description="Natural periods (s)")
    frequencies: list[float] = Field(default_factory=list, description="Natural frequencies (Hz)")
    mode_shapes: dict[str, dict[str, list[float]]] = Field(
        default_factory=dict,
        description="mode -> {node_id -> [displacements]}",
    )
    mass_participation: dict[str, list[float]] = Field(
        default_factory=dict,
        description="direction -> [participation_ratio_per_mode]",
    )


class TimeHistoryResultsSchema(BaseModel):
    """Results from a nonlinear time-history analysis.

    Attributes:
        time: Time stamps for each analysis step.
        node_displacements: Mapping of node_id -> {dof -> [values_over_time]}.
        element_forces: Mapping of element_id -> {force_component -> [values_over_time]}.
        bearing_responses: Mapping of bearing_id -> {response_type -> [values_over_time]}.
            Typical response types include 'displacement', 'force', 'friction'.
    """

    model_config = ConfigDict(strict=False)

    time: list[float] = Field(default_factory=list, description="Time stamps (s)")
    node_displacements: dict[str, dict[str, list[float]]] = Field(
        default_factory=dict,
        description="node_id -> {dof -> [values]}",
    )
    element_forces: dict[str, dict[str, list[float]]] = Field(
        default_factory=dict,
        description="element_id -> {component -> [values]}",
    )
    bearing_responses: dict[str, dict[str, list[float]]] = Field(
        default_factory=dict,
        description="bearing_id -> {response_type -> [values]}",
    )


class AnalysisResultsSchema(BaseModel):
    """Top-level wrapper for analysis results of any type.

    Attributes:
        analysis_id: Unique identifier for this analysis run.
        model_id: The model that was analysed.
        status: Current status ('pending', 'running', 'completed', 'failed').
        type: The analysis type that was executed.
        results: The typed results object, or None if not yet complete.
        error: Error message if the analysis failed.
    """

    model_config = ConfigDict(strict=False)

    analysis_id: str = Field(..., description="Unique analysis identifier")
    model_id: str = Field(..., description="Source model identifier")
    status: str = Field(default="pending", description="Analysis status")
    type: str = Field(..., description="Analysis type: static | modal | time_history")
    results: StaticResultsSchema | ModalResultsSchema | TimeHistoryResultsSchema | None = Field(
        default=None,
        description="Typed analysis results",
    )
    error: str | None = Field(default=None, description="Error message if analysis failed")
