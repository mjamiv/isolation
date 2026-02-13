"""Pydantic v2 schemas for structural model definition.

These schemas validate and serialize the JSON model definitions
that describe a structural system for OpenSeesPy analysis.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class NodeSchema(BaseModel):
    """A structural node with coordinates and boundary conditions.

    Attributes:
        id: Unique node identifier (positive integer).
        coords: Nodal coordinates. Length must match the model's ndm.
        fixity: Boundary condition flags (0=free, 1=fixed) for each DOF.
            Length must match the model's ndf. An empty list means all DOFs free.
    """

    model_config = ConfigDict(strict=False)

    id: int = Field(..., gt=0, description="Unique node tag")
    coords: list[float] = Field(..., min_length=1, max_length=3, description="Nodal coordinates [x, y, z]")
    fixity: list[int] = Field(
        default_factory=list,
        max_length=6,
        description="Fixity flags per DOF (0=free, 1=fixed)",
    )

    @field_validator("fixity", mode="after")
    @classmethod
    def fixity_values_binary(cls, v: list[int]) -> list[int]:
        """Ensure fixity values are 0 or 1."""
        if v and not all(f in (0, 1) for f in v):
            raise ValueError("Fixity values must be 0 (free) or 1 (fixed)")
        return v


class MaterialSchema(BaseModel):
    """An OpenSees material definition.

    Attributes:
        id: Unique material tag.
        type: OpenSees material type string (e.g., 'Elastic', 'Steel02').
        name: Human-readable name for display.
        params: Material-specific parameters passed to OpenSees.
    """

    model_config = ConfigDict(strict=False)

    id: int = Field(..., gt=0, description="Unique material tag")
    type: str = Field(..., min_length=1, description="OpenSees material type")
    name: str = Field(default="", description="Human-readable material name")
    params: dict = Field(default_factory=dict, description="Material parameters")


class SectionSchema(BaseModel):
    """An OpenSees section definition.

    Attributes:
        id: Unique section tag.
        type: OpenSees section type string (e.g., 'Elastic', 'Fiber').
        name: Human-readable name.
        properties: Section-specific geometric/mechanical properties.
        material_id: Reference to associated material.
    """

    model_config = ConfigDict(strict=False)

    id: int = Field(..., gt=0, description="Unique section tag")
    type: str = Field(..., min_length=1, description="OpenSees section type")
    name: str = Field(default="", description="Human-readable section name")
    properties: dict = Field(default_factory=dict, description="Section properties")
    material_id: int = Field(..., gt=0, description="Associated material tag")


class ElementSchema(BaseModel):
    """An OpenSees element definition.

    Attributes:
        id: Unique element tag.
        type: OpenSees element type (e.g., 'elasticBeamColumn', 'truss').
        nodes: Node tags that define the element connectivity.
        section_id: Reference to the section used by the element.
        transform: Geometric transformation type ('Linear', 'PDelta', 'Corotational').
    """

    model_config = ConfigDict(strict=False)

    id: int = Field(..., gt=0, description="Unique element tag")
    type: str = Field(..., min_length=1, description="OpenSees element type")
    nodes: list[int] = Field(..., min_length=2, description="Connected node tags")
    section_id: int = Field(default=0, ge=0, description="Associated section tag")
    transform: str = Field(default="Linear", description="Geometric transformation type")


class TFPBearingSchema(BaseModel):
    """Triple Friction Pendulum bearing element definition.

    Models a TFP isolator with four sliding surfaces, each with
    velocity-dependent friction properties.

    Attributes:
        id: Unique element tag for the bearing.
        nodes: Two node tags [bottom, top].
        friction_models: List of 4 dicts, each with mu_slow, mu_fast, transRate.
        radii: Effective radii of curvature [L1, L2, L3] (3 values).
        disp_capacities: Displacement capacities [d1, d2, d3] (3 values).
        weight: Vertical load on the bearing (kN).
        uy: Yield displacement for initial stiffness calculation (m).
        kvt: Vertical stiffness factor.
        min_fv: Minimum vertical force ratio.
        tol: Newton-Raphson convergence tolerance.
    """

    model_config = ConfigDict(strict=False)

    id: int = Field(..., gt=0, description="Unique bearing element tag")
    nodes: list[int] = Field(..., min_length=2, max_length=2, description="[bottom_node, top_node]")
    friction_models: list[dict] = Field(
        ...,
        min_length=4,
        max_length=4,
        description="4 friction model dicts with mu_slow, mu_fast, trans_rate",
    )
    radii: list[float] = Field(
        ...,
        min_length=3,
        max_length=3,
        description="Effective radii [L1, L2, L3] in metres",
    )
    disp_capacities: list[float] = Field(
        ...,
        min_length=3,
        max_length=3,
        description="Displacement capacities [d1, d2, d3] in metres",
    )
    weight: float = Field(..., gt=0, description="Vertical load in kN")
    uy: float = Field(default=0.001, gt=0, description="Yield displacement (m)")
    kvt: float = Field(default=100.0, gt=0, description="Vertical stiffness factor")
    min_fv: float = Field(default=0.1, ge=0, description="Minimum vertical force ratio")
    tol: float = Field(default=1e-8, gt=0, description="Convergence tolerance")

    @field_validator("friction_models", mode="after")
    @classmethod
    def validate_friction_models(cls, v: list[dict]) -> list[dict]:
        """Ensure each friction model has the required keys."""
        required_keys = {"mu_slow", "mu_fast", "trans_rate"}
        for i, fm in enumerate(v):
            missing = required_keys - set(fm.keys())
            if missing:
                raise ValueError(f"Friction model {i} missing keys: {missing}")
            if fm["mu_slow"] < 0 or fm["mu_fast"] < 0:
                raise ValueError(f"Friction model {i}: friction coefficients must be >= 0")
            if fm["mu_fast"] < fm["mu_slow"]:
                raise ValueError(f"Friction model {i}: mu_fast must be >= mu_slow")
        return v


class LoadSchema(BaseModel):
    """A load applied to the structural model.

    Attributes:
        type: Load type ('nodal', 'elemental', 'gravity', 'ground_motion').
        node_id: Target node (for nodal loads).
        element_id: Target element (for elemental loads).
        values: Load values. Interpretation depends on type.
    """

    model_config = ConfigDict(strict=False)

    type: str = Field(..., description="Load type: nodal, elemental, gravity, ground_motion")
    node_id: int | None = Field(default=None, description="Target node tag")
    element_id: int | None = Field(default=None, description="Target element tag")
    values: list[float] = Field(default_factory=list, description="Load values")


class GroundMotionSchema(BaseModel):
    """Ground motion record for time-history analysis.

    Attributes:
        dt: Time step of the acceleration record (seconds).
        acceleration: Acceleration values (g or m/s^2 depending on units).
        direction: DOF direction (1=X, 2=Y, 3=Z).
        scale_factor: Multiplier applied to the acceleration record.
    """

    model_config = ConfigDict(strict=False)

    dt: float = Field(..., gt=0, description="Time step (s)")
    acceleration: list[float] = Field(..., min_length=1, description="Acceleration values")
    direction: int = Field(default=1, ge=1, le=3, description="DOF direction (1=X, 2=Y, 3=Z)")
    scale_factor: float = Field(default=1.0, description="Scale factor for the record")


class AnalysisParamsSchema(BaseModel):
    """Parameters controlling the type and settings of an analysis.

    Attributes:
        type: Analysis type.
        dt: Time step for time-history analysis.
        num_steps: Number of analysis steps for time-history or pushover.
        num_modes: Number of modes to extract in modal analysis.
        ground_motions: List of ground motion records for time-history.
        control_node: Node tag for displacement-controlled pushover.
        control_dof: DOF direction for pushover control (1=X, 2=Y).
        target_displacement: Target roof displacement for pushover.
        load_pattern: Lateral load distribution for pushover ('linear', 'first_mode').
    """

    model_config = ConfigDict(strict=False)

    type: Literal["static", "modal", "time_history", "pushover"] = Field(
        ..., description="Analysis type"
    )
    dt: float | None = Field(default=None, gt=0, description="Analysis time step (s)")
    num_steps: int | None = Field(default=None, gt=0, description="Number of analysis steps")
    num_modes: int | None = Field(default=None, gt=0, description="Number of modes to extract")
    ground_motions: list[GroundMotionSchema] | None = Field(
        default=None,
        description="Ground motion records for time-history",
    )
    control_node: int | None = Field(
        default=None, gt=0, description="Control node tag for pushover"
    )
    control_dof: int | None = Field(
        default=None, ge=1, le=3, description="Control DOF for pushover (1=X, 2=Y)"
    )
    target_displacement: float | None = Field(
        default=None, gt=0, description="Target roof displacement for pushover"
    )
    load_pattern: str | None = Field(
        default=None, description="Lateral load pattern: 'linear' or 'first_mode'"
    )

    @model_validator(mode="after")
    def validate_analysis_params(self) -> "AnalysisParamsSchema":
        """Validate that required parameters are present for each analysis type."""
        if self.type == "modal":
            if self.num_modes is None:
                self.num_modes = 3  # sensible default
        elif self.type == "time_history":
            if self.dt is None:
                raise ValueError("dt is required for time_history analysis")
            if self.num_steps is None:
                raise ValueError("num_steps is required for time_history analysis")
            if not self.ground_motions:
                raise ValueError("ground_motions required for time_history analysis")
        elif self.type == "pushover":
            if self.target_displacement is None:
                raise ValueError("target_displacement is required for pushover analysis")
            if self.num_steps is None:
                self.num_steps = 100  # sensible default
            if self.control_dof is None:
                self.control_dof = 1  # default to X direction
            if self.load_pattern is None:
                self.load_pattern = "linear"
        return self


class StructuralModelSchema(BaseModel):
    """Top-level structural model definition.

    Combines all sub-components (nodes, materials, sections, elements,
    bearings, loads) into a single validated model that can be translated
    into OpenSeesPy commands.

    Attributes:
        model_info: Metadata about the model (name, units, ndm, ndf).
        nodes: List of structural nodes.
        materials: List of material definitions.
        sections: List of section definitions.
        elements: List of structural elements.
        bearings: List of TFP bearing elements.
        loads: List of applied loads.
    """

    model_config = ConfigDict(strict=False)

    model_info: dict = Field(
        default_factory=lambda: {"name": "Untitled", "units": "kN-m", "ndm": 2, "ndf": 3},
        description="Model metadata: name, units, ndm, ndf",
    )
    nodes: list[NodeSchema] = Field(default_factory=list, description="Structural nodes")
    materials: list[MaterialSchema] = Field(default_factory=list, description="Material definitions")
    sections: list[SectionSchema] = Field(default_factory=list, description="Section definitions")
    elements: list[ElementSchema] = Field(default_factory=list, description="Structural elements")
    bearings: list[TFPBearingSchema] = Field(default_factory=list, description="TFP bearing elements")
    loads: list[LoadSchema] = Field(default_factory=list, description="Applied loads")

    @model_validator(mode="after")
    def validate_model_integrity(self) -> "StructuralModelSchema":
        """Cross-validate references between model components."""
        node_ids = {n.id for n in self.nodes}

        # Validate element node references
        for elem in self.elements:
            for nid in elem.nodes:
                if nid not in node_ids:
                    raise ValueError(
                        f"Element {elem.id} references non-existent node {nid}"
                    )

        # Validate bearing node references
        for bearing in self.bearings:
            for nid in bearing.nodes:
                if nid not in node_ids:
                    raise ValueError(
                        f"Bearing {bearing.id} references non-existent node {nid}"
                    )

        # Validate material references in sections
        mat_ids = {m.id for m in self.materials}
        for sec in self.sections:
            if sec.material_id not in mat_ids:
                raise ValueError(
                    f"Section {sec.id} references non-existent material {sec.material_id}"
                )

        # Validate model_info
        info = self.model_info
        if "ndm" not in info:
            self.model_info["ndm"] = 2
        if "ndf" not in info:
            self.model_info["ndf"] = 3

        return self
