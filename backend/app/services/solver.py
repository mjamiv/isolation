"""Core OpenSeesPy solver module for the IsoVis platform.

This module translates validated JSON model definitions into OpenSeesPy
commands and executes static, modal, and time-history analyses. Every
public function calls ``ops.wipe()`` at entry and in a ``finally`` block
to guarantee a clean OpenSees domain.

Usage::

    from backend.app.services.solver import run_static_analysis
    results = run_static_analysis(model_data)
"""

from __future__ import annotations

import logging
import math
from typing import Any

import openseespy.opensees as ops

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Model builder
# ---------------------------------------------------------------------------


def build_model(model_data: dict) -> None:
    """Translate a JSON model definition into OpenSeesPy commands.

    This function assumes ``ops.wipe()`` has already been called and
    constructs the full model (nodes, fixities, materials, sections,
    geometric transformations, elements, and TFP bearings).

    Args:
        model_data: A dict conforming to :class:`StructuralModelSchema`.
            Must contain ``model_info``, ``nodes``, ``materials``,
            ``sections``, ``elements``, and optionally ``bearings``.

    Raises:
        RuntimeError: If an OpenSeesPy command fails.
    """
    info = model_data.get("model_info", {})
    ndm = info.get("ndm", 2)
    ndf = info.get("ndf", 3)

    ops.model("basic", "-ndm", ndm, "-ndf", ndf)
    logger.info("Model initialised: ndm=%d, ndf=%d", ndm, ndf)

    # --- Nodes and fixities ---
    for node in model_data.get("nodes", []):
        nid = node["id"]
        coords = node["coords"]
        ops.node(nid, *coords)
        fixity = node.get("fixity", [])
        if fixity and any(f == 1 for f in fixity):
            ops.fix(nid, *fixity)

    # --- Materials ---
    _define_materials(model_data.get("materials", []))

    # --- Sections ---
    _define_sections(model_data.get("sections", []))

    # --- Geometric transformations ---
    _transform_tags: dict[str, int] = {}
    _next_transform = 1
    for elem in model_data.get("elements", []):
        tname = elem.get("transform", "Linear")
        if tname not in _transform_tags:
            ops.geomTransf(tname, _next_transform)
            _transform_tags[tname] = _next_transform
            _next_transform += 1

    # --- Elements ---
    for elem in model_data.get("elements", []):
        eid = elem["id"]
        etype = elem["type"]
        enodes = elem["nodes"]
        tname = elem.get("transform", "Linear")
        transf_tag = _transform_tags.get(tname, 1)

        if etype == "elasticBeamColumn":
            sec = _find_section(model_data, elem.get("section_id", 0))
            A = sec.get("properties", {}).get("A", 1.0) if sec else 1.0
            E = _get_material_E(model_data, sec.get("material_id")) if sec else 1.0
            Iz = sec.get("properties", {}).get("Iz", 1.0) if sec else 1.0
            if ndm == 2:
                ops.element("elasticBeamColumn", eid, *enodes, A, E, Iz, transf_tag)
            else:
                Iy = sec.get("properties", {}).get("Iy", Iz) if sec else Iz
                J = sec.get("properties", {}).get("J", 1.0) if sec else 1.0
                G = E / 2.6  # approximate shear modulus
                ops.element(
                    "elasticBeamColumn", eid, *enodes, A, E, G, J, Iy, Iz, transf_tag
                )
        elif etype == "truss":
            sec = _find_section(model_data, elem.get("section_id", 0))
            A = sec.get("properties", {}).get("A", 1.0) if sec else 1.0
            mat_id = sec.get("material_id", 1) if sec else 1
            ops.element("Truss", eid, *enodes, A, mat_id)
        elif etype == "zeroLength":
            mat_id = elem.get("section_id", 1)
            ops.element("zeroLength", eid, *enodes, "-mat", mat_id, "-dir", 1)
        else:
            logger.warning(
                "Unknown element type '%s' for element %d, skipping", etype, eid
            )

    # --- TFP Bearings ---
    _define_bearings(model_data.get("bearings", []), ndm)

    logger.info("Model build complete")


# ---------------------------------------------------------------------------
# Static analysis
# ---------------------------------------------------------------------------


def run_static_analysis(model_data: dict) -> dict:
    """Run a gravity / static analysis and return results.

    Applies nodal loads from the model definition under a single Linear
    load pattern, then performs a single static analysis step.

    Args:
        model_data: A dict conforming to :class:`StructuralModelSchema`.

    Returns:
        A dict with keys ``node_displacements``, ``element_forces``,
        and ``reactions``, each mapping string IDs to lists of floats.
    """
    ops.wipe()
    try:
        build_model(model_data)

        # Apply loads
        ops.timeSeries("Linear", 1)
        ops.pattern("Plain", 1, 1)
        for load in model_data.get("loads", []):
            if load.get("type") == "nodal" and load.get("node_id"):
                ops.load(load["node_id"], *load["values"])

        # Analysis setup
        ops.constraints("Transformation")
        ops.numberer("RCM")
        ops.system("BandGeneral")
        ops.test("NormDispIncr", 1.0e-8, 10)
        ops.algorithm("Newton")
        ops.integrator("LoadControl", 1.0)
        ops.analysis("Static")
        result = ops.analyze(1)

        if result != 0:
            raise RuntimeError("Static analysis failed to converge")

        # Gather results
        ndf = model_data.get("model_info", {}).get("ndf", 3)
        node_displacements: dict[str, list[float]] = {}
        reactions: dict[str, list[float]] = {}

        for node in model_data.get("nodes", []):
            nid = node["id"]
            disps = [ops.nodeDisp(nid, dof + 1) for dof in range(ndf)]
            node_displacements[str(nid)] = disps

            fixity = node.get("fixity", [])
            if fixity and any(f == 1 for f in fixity):
                ops.reactions()
                rxns = [ops.nodeReaction(nid, dof + 1) for dof in range(ndf)]
                reactions[str(nid)] = rxns

        element_forces: dict[str, list[float]] = {}
        for elem in model_data.get("elements", []):
            eid = elem["id"]
            try:
                forces = list(ops.eleResponse(eid, "force"))
                element_forces[str(eid)] = forces
            except Exception:
                element_forces[str(eid)] = []

        return {
            "node_displacements": node_displacements,
            "element_forces": element_forces,
            "reactions": reactions,
        }

    finally:
        ops.wipe()


# ---------------------------------------------------------------------------
# Modal analysis
# ---------------------------------------------------------------------------


def run_modal_analysis(model_data: dict, num_modes: int = 3) -> dict:
    """Run an eigenvalue analysis and return modal properties.

    Args:
        model_data: A dict conforming to :class:`StructuralModelSchema`.
        num_modes: Number of modes to extract.

    Returns:
        A dict with keys ``periods``, ``frequencies``, ``mode_shapes``,
        and ``mass_participation``.
    """
    ops.wipe()
    try:
        build_model(model_data)

        # Need mass -- assign from loads or explicit mass
        _assign_mass(model_data)

        eigenvalues = ops.eigen(num_modes)
        periods: list[float] = []
        frequencies: list[float] = []
        mode_shapes: dict[str, dict[str, list[float]]] = {}

        ndf = model_data.get("model_info", {}).get("ndf", 3)

        for i, ev in enumerate(eigenvalues):
            if ev > 0:
                omega = math.sqrt(ev)
                T = 2.0 * math.pi / omega
                f = 1.0 / T
            else:
                T = 0.0
                f = 0.0
            periods.append(T)
            frequencies.append(f)

            mode_key = str(i + 1)
            mode_shapes[mode_key] = {}
            for node in model_data.get("nodes", []):
                nid = node["id"]
                fixity = node.get("fixity", [])
                if fixity and all(f_val == 1 for f_val in fixity):
                    continue
                shape = [
                    ops.nodeEigenvector(nid, i + 1, dof + 1) for dof in range(ndf)
                ]
                mode_shapes[mode_key][str(nid)] = shape

        return {
            "periods": periods,
            "frequencies": frequencies,
            "mode_shapes": mode_shapes,
            "mass_participation": {},  # placeholder -- full implementation needs modal mass extraction
        }

    finally:
        ops.wipe()


# ---------------------------------------------------------------------------
# Time-history analysis
# ---------------------------------------------------------------------------


def run_time_history(
    model_data: dict,
    ground_motion: list[float],
    dt: float,
    num_steps: int,
) -> dict:
    """Run a nonlinear time-history analysis (NLTHA).

    Applies a uniform excitation ground motion and integrates the
    equations of motion using Newmark's method.

    Args:
        model_data: A dict conforming to :class:`StructuralModelSchema`.
        ground_motion: List of ground acceleration values.
        dt: Time step of the ground motion record (s).
        num_steps: Number of integration steps.

    Returns:
        A dict with keys ``time``, ``node_displacements``,
        ``element_forces``, and ``bearing_responses``.
    """
    ops.wipe()
    try:
        build_model(model_data)
        _assign_mass(model_data)

        # --- Ground motion time series ---
        gm_tag = 100
        ops.timeSeries("Path", gm_tag, "-dt", dt, "-values", *ground_motion)

        # Uniform excitation in direction 1 (horizontal)
        pattern_tag = 100
        ops.pattern("UniformExcitation", pattern_tag, 1, "-accel", gm_tag)

        # --- Rayleigh damping (5 % at first mode) ---
        try:
            eigenvalues = ops.eigen(1)
            omega1 = math.sqrt(eigenvalues[0]) if eigenvalues[0] > 0 else 1.0
        except Exception:
            omega1 = 1.0
        zeta = 0.05
        a0 = 2.0 * zeta * omega1
        ops.rayleigh(a0, 0.0, 0.0, 0.0)

        # --- Analysis configuration ---
        ops.constraints("Transformation")
        ops.numberer("RCM")
        ops.system("BandGeneral")
        ops.test("NormDispIncr", 1.0e-6, 20)
        ops.algorithm("Newton")
        ops.integrator("Newmark", 0.5, 0.25)
        ops.analysis("Transient")

        ndf = model_data.get("model_info", {}).get("ndf", 3)

        # Pre-allocate result containers
        time_vals: list[float] = []
        node_disp_history: dict[str, dict[str, list[float]]] = {}
        bearing_resp_history: dict[str, dict[str, list[float]]] = {}

        # Initialise per-node containers
        free_nodes: list[int] = []
        for node in model_data.get("nodes", []):
            nid = node["id"]
            fixity = node.get("fixity", [])
            is_fixed = fixity and all(f_val == 1 for f_val in fixity)
            if not is_fixed:
                free_nodes.append(nid)
                nkey = str(nid)
                node_disp_history[nkey] = {str(d + 1): [] for d in range(ndf)}

        # Initialise per-bearing containers
        for bearing in model_data.get("bearings", []):
            bkey = str(bearing["id"])
            bearing_resp_history[bkey] = {"displacement": [], "force": []}

        # --- Integration loop ---
        current_time = 0.0
        for step in range(num_steps):
            result = ops.analyze(1, dt)
            if result != 0:
                # Try modified Newton if standard fails
                ops.algorithm("ModifiedNewton")
                result = ops.analyze(1, dt)
                ops.algorithm("Newton")
                if result != 0:
                    logger.warning(
                        "Analysis failed at step %d / %d", step, num_steps
                    )
                    break

            current_time += dt
            time_vals.append(current_time)

            for nid in free_nodes:
                nkey = str(nid)
                for dof in range(ndf):
                    node_disp_history[nkey][str(dof + 1)].append(
                        ops.nodeDisp(nid, dof + 1)
                    )

            for bearing in model_data.get("bearings", []):
                bkey = str(bearing["id"])
                bid = bearing["id"]
                try:
                    disp_resp = ops.eleResponse(bid, "basicDisplacement")
                    force_resp = ops.eleResponse(bid, "basicForce")
                    bearing_resp_history[bkey]["displacement"].append(
                        disp_resp[0] if disp_resp else 0.0
                    )
                    bearing_resp_history[bkey]["force"].append(
                        force_resp[0] if force_resp else 0.0
                    )
                except Exception:
                    bearing_resp_history[bkey]["displacement"].append(0.0)
                    bearing_resp_history[bkey]["force"].append(0.0)

        return {
            "time": time_vals,
            "node_displacements": node_disp_history,
            "element_forces": {},
            "bearing_responses": bearing_resp_history,
        }

    finally:
        ops.wipe()


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _define_materials(materials: list[dict]) -> None:
    """Create OpenSees uniaxialMaterial commands from material definitions."""
    for mat in materials:
        mid = mat["id"]
        mtype = mat["type"]
        params = mat.get("params", {})

        if mtype == "Elastic":
            E = params.get("E", 1.0)
            ops.uniaxialMaterial("Elastic", mid, E)
        elif mtype == "Steel02":
            Fy = params.get("Fy", 250.0)
            E0 = params.get("E", 200000.0)
            b = params.get("b", 0.01)
            ops.uniaxialMaterial("Steel02", mid, Fy, E0, b)
        elif mtype == "VelDependent":
            # Friction model, not a uniaxial material
            mu_slow = params.get("mu_slow", 0.01)
            mu_fast = params.get("mu_fast", 0.02)
            trans_rate = params.get("trans_rate", 0.4)
            ops.frictionModel("VelDependent", mid, mu_slow, mu_fast, trans_rate)
        else:
            logger.warning(
                "Unsupported material type '%s' for material %d", mtype, mid
            )


def _define_sections(sections: list[dict]) -> None:
    """Create OpenSees section commands from section definitions."""
    for sec in sections:
        sid = sec["id"]
        stype = sec["type"]
        props = sec.get("properties", {})

        if stype == "Elastic":
            E = props.get("E", 1.0)
            A = props.get("A", 1.0)
            Iz = props.get("Iz", 1.0)
            ops.section("Elastic", sid, E, A, Iz)
        else:
            logger.warning(
                "Unsupported section type '%s' for section %d", stype, sid
            )


def _define_bearings(bearings: list[dict], ndm: int) -> None:
    """Create Triple Friction Pendulum bearing elements.

    Each bearing requires four friction models and uses the
    ``TripleFrictionPendulum`` element from OpenSeesPy.
    """
    friction_tag_base = 1000

    for bearing in bearings:
        bid = bearing["id"]
        bnodes = bearing["nodes"]

        # Create friction models for this bearing
        fm_tags: list[int] = []
        for j, fm in enumerate(bearing["friction_models"]):
            ftag = friction_tag_base + (bid - 1) * 10 + j + 1
            ops.frictionModel(
                "VelDependent",
                ftag,
                fm["mu_slow"],
                fm["mu_fast"],
                fm["trans_rate"],
            )
            fm_tags.append(ftag)

        L1, L2, L3 = bearing["radii"]
        d1, d2, d3 = bearing["disp_capacities"]
        W = bearing["weight"]
        uy = bearing.get("uy", 0.001)
        kvt = bearing.get("kvt", 100.0)
        min_fv = bearing.get("min_fv", 0.1)
        tol = bearing.get("tol", 1e-8)

        ops.element(
            "TripleFrictionPendulum",
            bid,
            *bnodes,
            fm_tags[0],
            fm_tags[1],
            fm_tags[2],
            fm_tags[3],
            L1,
            L2,
            L3,
            d1,
            d2,
            d3,
            W,
            uy,
            kvt,
            min_fv,
            tol,
        )
        logger.info("TFP bearing %d created with friction tags %s", bid, fm_tags)


def _find_section(model_data: dict, section_id: int) -> dict | None:
    """Look up a section dict by ID from the model data."""
    for sec in model_data.get("sections", []):
        if sec["id"] == section_id:
            return sec
    return None


def _get_material_E(model_data: dict, mat_id: int | None) -> float:
    """Retrieve Young's modulus from a material definition."""
    if mat_id is None:
        return 1.0
    for mat in model_data.get("materials", []):
        if mat["id"] == mat_id:
            return mat.get("params", {}).get("E", 1.0)
    return 1.0


def _assign_mass(model_data: dict) -> None:
    """Assign lumped masses to nodes from load definitions or explicit mass.

    For nodal gravity loads the mass is computed as ``-Fy / g``.
    """
    g = 9.81
    ndf = model_data.get("model_info", {}).get("ndf", 3)

    for load in model_data.get("loads", []):
        if load.get("type") == "nodal" and load.get("node_id"):
            values = load.get("values", [])
            # Infer mass from vertical load (DOF 2 in 2D)
            if len(values) >= 2 and values[1] < 0:
                mass = -values[1] / g
                mass_args = [mass] * ndf
                ops.mass(load["node_id"], *mass_args)

    # Also check for explicit mass in bearing weight
    for bearing in model_data.get("bearings", []):
        W = bearing.get("weight", 0)
        if W > 0:
            top_node = bearing["nodes"][1]
            mass = W / g
            mass_args = [mass] * ndf
            try:
                ops.mass(top_node, *mass_args)
            except Exception:
                pass  # mass may already be assigned
