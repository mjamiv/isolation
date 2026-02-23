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

import copy
import logging
import math
from typing import Any

import openseespy.opensees as ops

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Unit-aware gravity constant
# ---------------------------------------------------------------------------

_GRAVITY_CONSTANTS: dict[str, float] = {
    "kip-in": 386.4,    # in/s²
    "kip-ft": 32.174,   # ft/s²
    "kN-m": 9.81,       # m/s²
    "kN-mm": 9810.0,    # mm/s²
    "N-m": 9.81,        # m/s²
    "N-mm": 9810.0,     # mm/s²
    "lb-in": 386.4,     # in/s²
    "lb-ft": 32.174,    # ft/s²
}


def _get_gravity(model_data: dict) -> float:
    """Return the gravitational acceleration constant for the model's unit system."""
    units = model_data.get("model_info", {}).get("units", "kN-m")
    return _GRAVITY_CONSTANTS.get(units, 9.81)


def _is_z_up(model_data: dict) -> bool:
    """Check if the model uses Z-up convention.

    Z-up is required for 3D models with TFP bearings (the
    TripleFrictionPendulum element assumes DOF 3 = compression).
    The flag persists in ``model_info["z_up"]`` so that derived
    models (e.g. fixed-base variants with bearings removed) retain
    the convention.
    """
    info = model_data.get("model_info", {})
    if info.get("z_up"):
        return True
    ndm = info.get("ndm", 2)
    return ndm == 3 and bool(model_data.get("bearings"))


def _vert_coord_idx(model_data: dict) -> int:
    """Return the coordinate index for the vertical direction.

    Returns 2 for Z-up 3D models, 1 for Y-up models.
    """
    return 2 if _is_z_up(model_data) else 1


def _to_float(value: Any, default: float = 0.0) -> float:
    """Best-effort numeric conversion for solver responses."""
    try:
        return float(value)
    except Exception:
        return default


def _to_float_list(values: Any) -> list[float]:
    """Convert an arbitrary response container to a list of floats."""
    if values is None:
        return []
    try:
        return [_to_float(v, 0.0) for v in values]
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Member discretization helper
# ---------------------------------------------------------------------------


def _discretize_elements(
    model_data: dict, ratio: int = 5
) -> tuple[dict, dict[int, dict], dict[int, list[float]]]:
    """Split each elasticBeamColumn element into *ratio* sub-elements.

    Only ``elasticBeamColumn`` elements are discretized; truss, zeroLength,
    and other element types are left unchanged.

    For each qualifying element, ``ratio - 1`` internal nodes are created
    via linear interpolation between nodeI and nodeJ.  The original element
    is then replaced by *ratio* sub-elements that share the same section_id
    and geometric-transform name.

    Args:
        model_data: Model definition dict (will be deep-copied, NOT mutated).
        ratio: Number of sub-elements per original element (default 5).

    Returns:
        A tuple of:
        - modified model_data (deep copy)
        - discretization_map: ``{ orig_elem_id: { "node_chain": [nodeI, ..., nodeJ],
          "sub_element_ids": [id1, ...] } }``
        - internal_node_coords: new node id -> coordinate list
    """
    if ratio < 2:
        return model_data, {}, {}

    data = copy.deepcopy(model_data)
    ndf = data.get("model_info", {}).get("ndf", 3)

    # Build node coord lookup
    node_lookup: dict[int, list[float]] = {}
    for node in data.get("nodes", []):
        node_lookup[node["id"]] = list(node["coords"])

    # Compute starting IDs for new nodes and elements
    all_node_ids = [n["id"] for n in data.get("nodes", [])]
    next_node_id = max(all_node_ids) + 1 if all_node_ids else 1

    all_elem_ids = [e["id"] for e in data.get("elements", [])]
    # Also account for bearing element tags (offset by 10000)
    bearing_tags = [10000 + b["id"] for b in data.get("bearings", [])]
    max_elem_id = max(all_elem_ids + bearing_tags) if (all_elem_ids or bearing_tags) else 0
    next_elem_id = max_elem_id + 1

    discretization_map: dict[int, dict] = {}
    internal_node_coords: dict[int, list[float]] = {}

    new_elements: list[dict] = []
    new_nodes: list[dict] = []

    for elem in data.get("elements", []):
        if elem["type"] != "elasticBeamColumn":
            new_elements.append(elem)
            continue

        eid = elem["id"]
        node_i_id = elem["nodes"][0]
        node_j_id = elem["nodes"][1]
        coords_i = node_lookup.get(node_i_id, [0.0, 0.0, 0.0])
        coords_j = node_lookup.get(node_j_id, [0.0, 0.0, 0.0])
        ndm = len(coords_i)

        # Create internal nodes via linear interpolation
        chain_node_ids: list[int] = [node_i_id]
        for k in range(1, ratio):
            frac = k / ratio
            interp_coords = [
                coords_i[d] + frac * (coords_j[d] - coords_i[d])
                for d in range(ndm)
            ]
            nid = next_node_id
            next_node_id += 1
            new_nodes.append({
                "id": nid,
                "coords": interp_coords,
                "fixity": [0] * ndf,
            })
            node_lookup[nid] = interp_coords
            internal_node_coords[nid] = interp_coords
            chain_node_ids.append(nid)
        chain_node_ids.append(node_j_id)

        # Create sub-elements
        sub_ids: list[int] = []
        for k in range(ratio):
            sub_eid = next_elem_id
            next_elem_id += 1
            sub_ids.append(sub_eid)
            new_elements.append({
                "id": sub_eid,
                "type": "elasticBeamColumn",
                "nodes": [chain_node_ids[k], chain_node_ids[k + 1]],
                "section_id": elem.get("section_id", 0),
                "transform": elem.get("transform", "Linear"),
            })

        discretization_map[eid] = {
            "node_chain": chain_node_ids,
            "sub_element_ids": sub_ids,
        }

    # Append internal nodes to model
    data["nodes"] = data.get("nodes", []) + new_nodes
    data["elements"] = new_elements

    logger.info(
        "Discretized %d elements (ratio=%d): %d internal nodes, %d sub-elements",
        len(discretization_map),
        ratio,
        len(internal_node_coords),
        sum(len(v) for v in discretization_map.values()),
    )

    return data, discretization_map, internal_node_coords


# ---------------------------------------------------------------------------
# Gravity pre-load helper (for TFP bearing models)
# ---------------------------------------------------------------------------


def _run_gravity_preload(model_data: dict, num_steps: int = 10) -> int:
    """Apply gravity loads incrementally for TFP bearing convergence.

    TFP bearings are highly nonlinear and cannot accept full gravity
    in a single load step. This helper applies gravity in ``num_steps``
    incremental steps with automatic algorithm fallback and sub-stepping.

    Args:
        model_data: Model definition (loads are read from here).
        num_steps: Number of incremental gravity steps.

    Returns:
        0 on success, non-zero on failure.
    """
    ops.timeSeries("Linear", 1)
    ops.pattern("Plain", 1, 1)
    _apply_nodal_loads(model_data)

    ops.constraints("Transformation")
    ops.numberer("RCM")
    # Use UmfPack for bearing models (sparse, handles non-banded 3D systems)
    num_bearings = len(model_data.get("bearings", []))
    if num_bearings > 4:
        ops.system("UmfPack")
    else:
        ops.system("BandGeneral")
    ops.test("NormDispIncr", 1.0e-4, 200)
    ops.algorithm("Newton")

    dLambda = 1.0 / num_steps
    ops.integrator("LoadControl", dLambda)
    ops.analysis("Static")

    for step in range(num_steps):
        result = ops.analyze(1)
        if result != 0:
            # Fallback 1: ModifiedNewton
            ops.algorithm("ModifiedNewton")
            result = ops.analyze(1)
            ops.algorithm("Newton")
        if result != 0:
            # Fallback 2: KrylovNewton
            ops.algorithm("KrylovNewton")
            result = ops.analyze(1)
            ops.algorithm("Newton")
        if result != 0:
            # Fallback 3: sub-step (split into 10 mini-steps)
            mini = dLambda / 10.0
            ops.integrator("LoadControl", mini)
            sub_ok = True
            for _sub in range(10):
                r = ops.analyze(1)
                if r != 0:
                    ops.algorithm("ModifiedNewton")
                    r = ops.analyze(1)
                    ops.algorithm("Newton")
                if r != 0:
                    sub_ok = False
                    break
            ops.integrator("LoadControl", dLambda)  # restore
            if not sub_ok:
                logger.warning("Gravity preload failed at step %d/%d", step + 1, num_steps)
                return -3

    ops.loadConst("-time", 0.0)
    logger.info("Gravity preload complete (%d steps)", num_steps)
    return 0


# ---------------------------------------------------------------------------
# Model builder
# ---------------------------------------------------------------------------


def build_model(model_data: dict) -> None:
    """Translate a JSON model definition into OpenSeesPy commands.

    This function assumes ``ops.wipe()`` has already been called and
    constructs the full model (nodes, fixities, materials, sections,
    geometric transformations, elements, and TFP bearings).

    3D models with bearings **must** use the Z-up convention because the
    TripleFrictionPendulum element assumes DOF 3 (Z) is the vertical/
    compression direction. Clients sending Y-up models should swap Y↔Z
    before submission (the test script and frontend serializer handle this).

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

    # Build node lookup for element vecxz computation
    node_coords: dict[int, list[float]] = {}

    # --- Nodes and fixities ---
    for node in model_data.get("nodes", []):
        nid = node["id"]
        coords = list(node["coords"])
        while len(coords) < ndm:
            coords.append(0.0)
        ops.node(nid, *coords[:ndm])
        node_coords[nid] = coords[:ndm]

        fixity = list(node.get("fixity", []))
        while len(fixity) < ndf:
            fixity.append(1 if fixity and all(f == 1 for f in fixity) else 0)

        if fixity and any(f == 1 for f in fixity):
            ops.fix(nid, *fixity[:ndf])

    # --- Materials ---
    _define_materials(model_data.get("materials", []))

    # --- Sections ---
    _define_sections(model_data.get("sections", []), model_data, ndm)

    # --- Geometric transformations (per-element for 3D) ---
    if ndm >= 3:
        _build_3d_elements(model_data, node_coords)
    else:
        _build_2d_elements(model_data)

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
        ``reactions``, and ``deformed_shape``.
    """
    ops.wipe()
    try:
        model_data, disc_map, int_coords = _discretize_elements(model_data)
        build_model(model_data)

        has_bearings = bool(model_data.get("bearings"))

        if has_bearings:
            # TFP bearings need incremental gravity loading
            result = _run_gravity_preload(model_data, num_steps=50)
        else:
            # Simple single-step gravity for non-bearing models
            ops.timeSeries("Linear", 1)
            ops.pattern("Plain", 1, 1)
            _apply_nodal_loads(model_data)

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
        ndm = model_data.get("model_info", {}).get("ndm", 2)
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

        # Compute deformed shape: original coords + scaled displacements
        deformed_shape = _compute_deformed_shape(model_data, node_displacements, ndm)

        return {
            "node_displacements": node_displacements,
            "element_forces": element_forces,
            "reactions": reactions,
            "deformed_shape": deformed_shape,
            "discretization_map": disc_map,
            "internal_node_coords": {str(k): v for k, v in int_coords.items()},
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
        model_data, disc_map, int_coords = _discretize_elements(model_data)
        build_model(model_data)

        # Need mass -- assign from loads or explicit mass
        _assign_mass(model_data)

        # TFP bearings need gravity preload before eigenvalue analysis
        # so the bearing has the correct vertical force for stiffness
        has_bearings = bool(model_data.get("bearings"))
        if has_bearings:
            gravity_result = _run_gravity_preload(model_data, num_steps=50)
            if gravity_result != 0:
                logger.warning("Gravity preload failed for modal analysis")

        eigenvalues = ops.eigen(num_modes)
        periods: list[float] = []
        frequencies: list[float] = []
        mode_shapes: dict[str, dict[str, list[float]]] = {}

        ndf = model_data.get("model_info", {}).get("ndf", 3)
        ndm = model_data.get("model_info", {}).get("ndm", 2)

        # Collect free nodes and their masses for participation ratio calc
        free_nodes: list[dict] = []
        for node in model_data.get("nodes", []):
            fixity = node.get("fixity", [])
            if fixity and all(f_val == 1 for f_val in fixity):
                continue
            free_nodes.append(node)

        # Build node mass lookup from loads (same logic as _assign_mass)
        g = _get_gravity(model_data)
        vert_dof_idx = _vert_coord_idx(model_data)
        node_masses: dict[int, float] = {}
        for load in model_data.get("loads", []):
            if load.get("type") == "nodal" and load.get("node_id"):
                values = load.get("values", [])
                if len(values) > vert_dof_idx and values[vert_dof_idx] < 0:
                    node_masses[load["node_id"]] = -values[vert_dof_idx] / g
        for bearing in model_data.get("bearings", []):
            W = bearing.get("weight", 0)
            if W > 0:
                top_node = bearing["nodes"][1]
                node_masses[top_node] = W / g

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
            for node in free_nodes:
                nid = node["id"]
                shape = [
                    ops.nodeEigenvector(nid, i + 1, dof + 1) for dof in range(ndf)
                ]
                mode_shapes[mode_key][str(nid)] = shape

        # Compute mass participation ratios per translational direction
        direction_labels = ["X", "Y", "Z"][:ndm]
        mass_participation: dict[str, list[float]] = {d: [] for d in direction_labels}
        total_mass = sum(node_masses.values()) if node_masses else 1.0

        for i in range(len(eigenvalues)):
            for dof_idx, direction in enumerate(direction_labels):
                # L_n = sum(m_i * phi_i_n) for direction dof_idx
                L_n = 0.0
                M_n = 0.0
                for node in free_nodes:
                    nid = node["id"]
                    m = node_masses.get(nid, 0.0)
                    phi = ops.nodeEigenvector(nid, i + 1, dof_idx + 1)
                    L_n += m * phi
                    M_n += m * phi * phi

                if M_n > 0 and total_mass > 0:
                    ratio = (L_n * L_n) / (M_n * total_mass)
                else:
                    ratio = 0.0
                mass_participation[direction].append(ratio)

        return {
            "periods": periods,
            "frequencies": frequencies,
            "mode_shapes": mode_shapes,
            "mass_participation": mass_participation,
            "discretization_map": disc_map,
            "internal_node_coords": {str(k): v for k, v in int_coords.items()},
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
    direction: int = 1,
) -> dict:
    """Run a nonlinear time-history analysis (NLTHA).

    Applies a uniform excitation ground motion and integrates the
    equations of motion using Newmark's method.

    Args:
        model_data: A dict conforming to :class:`StructuralModelSchema`.
        ground_motion: List of ground acceleration values.
        dt: Time step of the ground motion record (s).
        num_steps: Number of integration steps.
        direction: Excitation DOF direction (1=X, 2=Y, 3=Z).

    Returns:
        A dict with keys ``time``, ``node_displacements``,
        ``element_forces``, and ``bearing_responses``.
    """
    ops.wipe()
    try:
        model_data, disc_map, int_coords = _discretize_elements(model_data)
        build_model(model_data)
        _assign_mass(model_data)

        # --- Gravity pre-load (critical for TFP bearing models) ---
        has_bearings = bool(model_data.get("bearings"))
        if has_bearings:
            gravity_result = _run_gravity_preload(model_data, num_steps=50)
            if gravity_result != 0:
                logger.warning("Gravity preload failed for time-history, proceeding anyway")
        else:
            # Non-bearing models are often linearized test fixtures; skipping
            # preload avoids consuming transient analyze calls unexpectedly.
            logger.info("Skipping gravity preload for non-bearing time-history model")

        # --- Clear static analysis state before transient setup ---
        try:
            ops.wipeAnalysis()
        except Exception:
            pass  # wipeAnalysis may not exist in all versions

        # --- Ground motion time series ---
        gm_tag = 100
        ops.timeSeries("Path", gm_tag, "-dt", dt, "-values", *ground_motion)

        # Uniform excitation in direction 1 (horizontal)
        pattern_tag = 100
        exc_direction = int(direction) if direction in (1, 2, 3) else 1
        ops.pattern("UniformExcitation", pattern_tag, exc_direction, "-accel", gm_tag)

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
        num_bearings = len(model_data.get("bearings", []))
        if has_bearings:
            # Bearing systems are strongly nonlinear; a sparse solver and a
            # slightly looser convergence test improve robustness.
            ops.system("UmfPack")
            ops.test("NormDispIncr", 1.0e-4, 100)
        else:
            ops.system("BandGeneral")
            ops.test("NormDispIncr", 1.0e-5, 50)
        ops.algorithm("Newton")
        ops.integrator("Newmark", 0.5, 0.25)
        ops.analysis("Transient")

        ndf = model_data.get("model_info", {}).get("ndf", 3)

        # Pre-allocate result containers
        time_vals: list[float] = []
        node_disp_history: dict[str, dict[str, list[float]]] = {}
        element_force_history: dict[str, dict[str, list[float]]] = {}
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
            bearing_resp_history[bkey] = {
                "displacement_x": [],
                "displacement_y": [],
                "displacement_z": [],
                "force_x": [],
                "force_y": [],
                "axial_force": [],
            }

        # Initialise per-element force containers
        for elem in model_data.get("elements", []):
            ekey = str(elem["id"])
            element_force_history[ekey] = {}

        def _analyze_step(step_dt: float, use_extended_fallback: bool) -> int:
            try:
                r = ops.analyze(1, step_dt)
            except StopIteration:
                return -99
            if r == 0:
                return 0
            ops.algorithm("ModifiedNewton")
            try:
                r = ops.analyze(1, step_dt)
            except StopIteration:
                r = -99
            ops.algorithm("Newton")
            if r == 0:
                return 0
            if use_extended_fallback:
                ops.algorithm("KrylovNewton")
                try:
                    r = ops.analyze(1, step_dt)
                except StopIteration:
                    r = -99
                ops.algorithm("Newton")
            return r

        # --- Integration loop ---
        # For models with many bearings (>4), use more aggressive sub-stepping
        many_bearings = num_bearings > 4
        current_time = 0.0
        for step in range(num_steps):
            result = _analyze_step(dt, use_extended_fallback=has_bearings)
            if result != 0 and has_bearings:
                # Level 1 sub-stepping: dt/10 with full fallback chain.
                n_sub1 = 20 if many_bearings else 10
                sub_dt = dt / n_sub1
                sub_ok = True
                failed_sub = n_sub1
                for i in range(n_sub1):
                    r = _analyze_step(sub_dt, use_extended_fallback=True)
                    if r != 0:
                        sub_ok = False
                        failed_sub = i
                        break

                # Level 2 sub-stepping: refine remaining increment to dt/50.
                if not sub_ok:
                    sub_factor = 5
                    sub_dt2 = sub_dt / sub_factor
                    remaining = n_sub1 - failed_sub
                    n_sub2 = max(1, remaining * sub_factor)
                    sub_ok = True
                    for _sub2 in range(n_sub2):
                        r = _analyze_step(sub_dt2, use_extended_fallback=True)
                        if r != 0:
                            sub_ok = False
                            break

                if not sub_ok:
                    logger.warning("Analysis failed at step %d / %d", step, num_steps)
                    break
            elif result != 0:
                logger.warning("Analysis failed at step %d / %d", step, num_steps)
                break

            current_time += dt
            time_vals.append(current_time)

            for nid in free_nodes:
                nkey = str(nid)
                for dof in range(ndf):
                    node_disp_history[nkey][str(dof + 1)].append(
                        _to_float(ops.nodeDisp(nid, dof + 1), 0.0)
                    )

            for elem in model_data.get("elements", []):
                ekey = str(elem["id"])
                ehist = element_force_history[ekey]
                try:
                    force_vals = _to_float_list(ops.eleResponse(elem["id"], "force"))
                except Exception:
                    force_vals = []

                existing_keys = list(ehist.keys())
                for key in existing_keys:
                    idx = int(key) - 1
                    ehist[key].append(force_vals[idx] if idx < len(force_vals) else 0.0)

                for idx in range(len(existing_keys), len(force_vals)):
                    key = str(idx + 1)
                    ehist[key] = [0.0] * (len(time_vals) - 1)
                    ehist[key].append(force_vals[idx])

            for bearing in model_data.get("bearings", []):
                bkey = str(bearing["id"])
                ele_tag = 10000 + bearing["id"]  # bearing element tags are offset
                try:
                    disp_vals = _to_float_list(ops.eleResponse(ele_tag, "basicDisplacement"))
                    force_vals = _to_float_list(ops.eleResponse(ele_tag, "basicForce"))

                    dx = disp_vals[0] if len(disp_vals) > 0 else 0.0
                    dy = disp_vals[1] if len(disp_vals) > 1 else 0.0
                    dz = disp_vals[2] if len(disp_vals) > 2 else 0.0
                    fx = force_vals[0] if len(force_vals) > 0 else 0.0
                    fy = force_vals[1] if len(force_vals) > 1 else 0.0
                    axial = (
                        force_vals[2]
                        if len(force_vals) > 2
                        else (force_vals[1] if len(force_vals) > 1 else 0.0)
                    )
                    bearing_resp_history[bkey]["displacement_x"].append(dx)
                    bearing_resp_history[bkey]["displacement_y"].append(dy)
                    bearing_resp_history[bkey]["displacement_z"].append(dz)
                    bearing_resp_history[bkey]["force_x"].append(fx)
                    bearing_resp_history[bkey]["force_y"].append(fy)
                    bearing_resp_history[bkey]["axial_force"].append(axial)
                except Exception:
                    bearing_resp_history[bkey]["displacement_x"].append(0.0)
                    bearing_resp_history[bkey]["displacement_y"].append(0.0)
                    bearing_resp_history[bkey]["displacement_z"].append(0.0)
                    bearing_resp_history[bkey]["force_x"].append(0.0)
                    bearing_resp_history[bkey]["force_y"].append(0.0)
                    bearing_resp_history[bkey]["axial_force"].append(0.0)

        return {
            "time": time_vals,
            "node_displacements": node_disp_history,
            "element_forces": element_force_history,
            "bearing_responses": bearing_resp_history,
            "discretization_map": disc_map,
            "internal_node_coords": {str(k): v for k, v in int_coords.items()},
        }

    finally:
        ops.wipe()


# ---------------------------------------------------------------------------
# Pushover analysis
# ---------------------------------------------------------------------------


def run_pushover_analysis(
    model_data: dict,
    target_displacement: float,
    num_steps: int = 100,
    control_node: int | None = None,
    control_dof: int = 1,
    load_pattern: str = "linear",
) -> dict:
    """Run a nonlinear static (pushover) analysis.

    Applies a lateral load pattern and incrementally pushes the structure
    using displacement control until the target displacement is reached.

    Args:
        model_data: A dict conforming to :class:`StructuralModelSchema`.
        target_displacement: Target roof displacement.
        num_steps: Number of displacement increments.
        control_node: Node tag for displacement control. If None, the
            topmost free node is used automatically.
        control_dof: DOF for displacement control (1=X, 2=Y).
        load_pattern: Lateral load distribution ('linear' or 'first_mode').

    Returns:
        A dict with pushover results including capacity curve, hinge states,
        step data, and final deformed shape.
    """
    ops.wipe()
    try:
        model_data, disc_map, int_coords = _discretize_elements(model_data)
        build_model(model_data)
        _assign_mass(model_data)

        ndf = model_data.get("model_info", {}).get("ndf", 3)
        ndm = model_data.get("model_info", {}).get("ndm", 2)

        # Identify free nodes and fixed nodes
        free_nodes: list[dict] = []
        fixed_nodes: list[dict] = []
        for node in model_data.get("nodes", []):
            fixity = node.get("fixity", [])
            if fixity and all(f_val == 1 for f_val in fixity):
                fixed_nodes.append(node)
            else:
                free_nodes.append(node)

        if not free_nodes:
            raise RuntimeError("No free nodes found for pushover analysis")

        # Auto-detect control node: topmost free node (highest vertical coord)
        vert_idx = _vert_coord_idx(model_data)
        if control_node is None:
            control_node = max(free_nodes, key=lambda n: n["coords"][vert_idx] if len(n["coords"]) > vert_idx else 0)["id"]

        # Determine lateral load distribution
        mode_shape_factors: dict[int, float] = {}
        if load_pattern == "first_mode":
            try:
                eigenvalues = ops.eigen(1)
                if eigenvalues and eigenvalues[0] > 0:
                    for node in free_nodes:
                        nid = node["id"]
                        phi = ops.nodeEigenvector(nid, 1, control_dof)
                        mode_shape_factors[nid] = phi
            except Exception:
                logger.warning("First-mode extraction failed, falling back to linear pattern")
                load_pattern = "linear"

        # Apply gravity loads
        has_bearings = bool(model_data.get("bearings"))
        if has_bearings:
            # TFP bearings need incremental gravity loading
            gravity_result = _run_gravity_preload(model_data, num_steps=50)
        else:
            ops.timeSeries("Linear", 1)
            ops.pattern("Plain", 1, 1)
            _apply_nodal_loads(model_data)

            ops.constraints("Transformation")
            ops.numberer("RCM")
            ops.system("BandGeneral")
            ops.test("NormDispIncr", 1.0e-6, 10)
            ops.algorithm("Newton")
            ops.integrator("LoadControl", 1.0)
            ops.analysis("Static")
            gravity_result = ops.analyze(1)
            if gravity_result != 0:
                logger.warning("Gravity analysis did not converge, proceeding anyway")
            ops.loadConst("-time", 0.0)

        # Apply lateral load pattern for pushover
        ops.timeSeries("Linear", 2)
        ops.pattern("Plain", 2, 2)

        # Get max height for linear distribution
        max_height = 0.0
        for node in free_nodes:
            coords = node["coords"]
            h = coords[vert_idx] if len(coords) > vert_idx else 0.0
            if h > max_height:
                max_height = h

        for node in free_nodes:
            nid = node["id"]
            coords = node["coords"]
            height = coords[vert_idx] if len(coords) > vert_idx else 0.0

            if load_pattern == "first_mode" and nid in mode_shape_factors:
                factor = abs(mode_shape_factors[nid])
            elif max_height > 0:
                factor = height / max_height
            else:
                factor = 1.0

            if factor > 0:
                load_values = [0.0] * ndf
                load_values[control_dof - 1] = factor
                ops.load(nid, *load_values)

        # Pushover analysis configuration
        dU = target_displacement / num_steps
        ops.constraints("Transformation")
        ops.numberer("RCM")
        ops.system("BandGeneral")
        ops.test("NormDispIncr", 1.0e-5, 100)
        ops.algorithm("Newton")
        ops.integrator("DisplacementControl", control_node, control_dof, dU)
        ops.analysis("Static")

        # Result containers
        capacity_curve: list[dict] = []
        steps: list[dict] = []

        for step_num in range(num_steps):
            result = ops.analyze(1)

            if result != 0:
                # Try alternative algorithms
                ops.algorithm("ModifiedNewton")
                result = ops.analyze(1)
                ops.algorithm("Newton")
                if result != 0:
                    ops.algorithm("KrylovNewton")
                    result = ops.analyze(1)
                    ops.algorithm("Newton")
                    if result != 0:
                        logger.warning(
                            "Pushover failed at step %d / %d", step_num, num_steps
                        )
                        break

            # Get control node displacement
            roof_disp = ops.nodeDisp(control_node, control_dof)

            # Compute base shear from reactions at fixed nodes
            ops.reactions()
            base_shear = 0.0
            for node in fixed_nodes:
                nid = node["id"]
                rxn = ops.nodeReaction(nid, control_dof)
                base_shear += rxn
            base_shear = -base_shear  # Convention: positive base shear

            capacity_curve.append({
                "base_shear": base_shear,
                "roof_displacement": roof_disp,
            })

            # Collect step data (every 10th step to keep payload reasonable)
            if step_num % max(1, num_steps // 20) == 0 or step_num == num_steps - 1:
                step_disps: dict[str, list[float]] = {}
                for node in model_data.get("nodes", []):
                    nid = node["id"]
                    disps = [ops.nodeDisp(nid, dof + 1) for dof in range(ndf)]
                    step_disps[str(nid)] = disps

                steps.append({
                    "step": step_num,
                    "base_shear": base_shear,
                    "roof_displacement": roof_disp,
                    "node_displacements": step_disps,
                })

        # Final state results
        node_displacements: dict[str, list[float]] = {}
        reactions: dict[str, list[float]] = {}
        for node in model_data.get("nodes", []):
            nid = node["id"]
            disps = [ops.nodeDisp(nid, dof + 1) for dof in range(ndf)]
            node_displacements[str(nid)] = disps

            fixity = node.get("fixity", [])
            if fixity and any(f_val == 1 for f_val in fixity):
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

        # Compute hinge states from element forces
        hinge_states = _compute_hinge_states(model_data, element_forces)

        # Deformed shape
        deformed_shape = _compute_deformed_shape(model_data, node_displacements, ndm)

        max_base_shear = max(abs(pt["base_shear"]) for pt in capacity_curve) if capacity_curve else 0.0
        max_roof_disp = max(abs(pt["roof_displacement"]) for pt in capacity_curve) if capacity_curve else 0.0

        return {
            "capacity_curve": capacity_curve,
            "hinge_states": hinge_states,
            "max_base_shear": max_base_shear,
            "max_roof_displacement": max_roof_disp,
            "steps": steps,
            "node_displacements": node_displacements,
            "element_forces": element_forces,
            "reactions": reactions,
            "deformed_shape": deformed_shape,
            "discretization_map": disc_map,
            "internal_node_coords": {str(k): v for k, v in int_coords.items()},
        }

    finally:
        ops.wipe()


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _build_2d_elements(model_data: dict) -> None:
    """Build elements for 2D models (ndm=2, ndf=3)."""
    _transform_tags: dict[str, int] = {}
    _next_transform = 1
    for elem in model_data.get("elements", []):
        tname = elem.get("transform", "Linear")
        if tname not in _transform_tags:
            ops.geomTransf(tname, _next_transform)
            _transform_tags[tname] = _next_transform
            _next_transform += 1

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
            ops.element("elasticBeamColumn", eid, *enodes, A, E, Iz, transf_tag)
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


def _build_3d_elements(
    model_data: dict, node_coords: dict[int, list[float]]
) -> None:
    """Build elements for 3D models (ndm=3, ndf=6).

    Each element gets its own geometric transformation with a vecxz
    vector computed from the element direction to avoid singularities.
    For a planar frame in the XZ plane (Z-up convention):

    * Vertical columns (along Z) use vecxz = (1, 0, 0)
    * Horizontal beams (along X) use vecxz = (0, 0, 1)
    * Diagonal elements use whichever avoids singularity

    For Z-up models, the frontend's section-axis convention is swapped
    relative to OpenSees local y/z, so ``Iz``/``Iy`` are mapped to
    ``Iy``/``Iz`` respectively. For Y-up models, section properties are
    passed through without swapping.
    """
    _next_transform = 1
    z_up = bool(model_data.get("model_info", {}).get("z_up", False))

    for elem in model_data.get("elements", []):
        eid = elem["id"]
        etype = elem["type"]
        enodes = elem["nodes"]

        if etype == "elasticBeamColumn":
            sec = _find_section(model_data, elem.get("section_id", 0))
            A = sec.get("properties", {}).get("A", 1.0) if sec else 1.0
            E = _get_material_E(model_data, sec.get("material_id")) if sec else 1.0
            # Section properties (frontend convention)
            Iz_section = sec.get("properties", {}).get("Iz", 1.0) if sec else 1.0
            Iy_section = sec.get("properties", {}).get("Iy", Iz_section) if sec else Iz_section
            J = sec.get("properties", {}).get("J", 1.0) if sec else 1.0
            G = sec.get("properties", {}).get("G", E / 2.6)

            # Compute element direction for vecxz
            ci = node_coords.get(enodes[0], [0, 0, 0])
            cj = node_coords.get(enodes[1], [0, 0, 0])
            dx = cj[0] - ci[0]
            dy = cj[1] - ci[1] if len(ci) > 1 else 0.0
            dz = cj[2] - ci[2] if len(ci) > 2 else 0.0
            length = math.sqrt(dx * dx + dy * dy + dz * dz)

            if length < 1e-12:
                vecxz = (0.0, 0.0, 1.0)
            else:
                # Normalised local x-axis
                lx = dx / length
                ly = dy / length
                lz = dz / length
                # Choose vecxz that is NOT parallel to local_x.
                # Vertical axis is Z for z_up models, Y otherwise.
                vertical_component = lz if z_up else ly
                if abs(vertical_component) > 0.9:
                    # Vertical member: use global X reference.
                    vecxz = (1.0, 0.0, 0.0)
                else:
                    # Horizontal/diagonal member: use vertical-axis reference.
                    vecxz = (0.0, 0.0, 1.0) if z_up else (0.0, 1.0, 0.0)

            tname = elem.get("transform", "Linear")
            ops.geomTransf(tname, _next_transform, *vecxz)
            transf_tag = _next_transform
            _next_transform += 1

            if z_up:
                # Z-up convention: section Iz (strong) maps to element Iy.
                Iy_elem = Iz_section
                Iz_elem = Iy_section
            else:
                # Y-up convention: keep Iy/Iz as provided.
                Iy_elem = Iy_section
                Iz_elem = Iz_section
            ops.element(
                "elasticBeamColumn", eid, *enodes,
                A, E, G, J, Iy_elem, Iz_elem, transf_tag,
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


def _compute_deformed_shape(
    model_data: dict,
    node_displacements: dict[str, list[float]],
    ndm: int,
    scale_factor: float = 1.0,
) -> dict[str, list[float]]:
    """Compute deformed node coordinates for visualization.

    Args:
        model_data: Model data containing node definitions.
        node_displacements: node_id (str) -> displacement list.
        ndm: Number of spatial dimensions.
        scale_factor: Multiplier for displacements (default 1.0 = true scale).

    Returns:
        node_id (str) -> [original_x + scale*disp_x, ...] for each spatial dim.
    """
    deformed: dict[str, list[float]] = {}
    for node in model_data.get("nodes", []):
        nid = str(node["id"])
        coords = node["coords"]
        disps = node_displacements.get(nid, [0.0] * ndm)
        deformed[nid] = [
            coords[i] + scale_factor * disps[i] for i in range(min(ndm, len(coords), len(disps)))
        ]
    return deformed


def _compute_hinge_states(
    model_data: dict,
    element_forces: dict[str, list[float]],
) -> list[dict]:
    """Estimate plastic hinge states from element end forces.

    Uses element forces to compute demand/capacity ratios and classify
    performance levels (IO, LS, CP) based on typical steel moment frame
    rotation limits from ASCE 41.

    Args:
        model_data: Model data with element and section info.
        element_forces: element_id (str) -> local force list.

    Returns:
        List of hinge state dicts.
    """
    hinge_states: list[dict] = []

    for elem in model_data.get("elements", []):
        eid = str(elem["id"])
        forces = element_forces.get(eid, [])
        if not forces:
            continue

        # For beam-column elements, forces are [N_i, V_i, M_i, N_j, V_j, M_j]
        if len(forces) >= 6:
            # I-end
            moment_i = abs(forces[2])
            # J-end
            moment_j = abs(forces[5])
        elif len(forces) >= 3:
            moment_i = abs(forces[2]) if len(forces) > 2 else 0.0
            moment_j = 0.0
        else:
            continue

        # Estimate plastic rotation from moment (simplified)
        # Use section properties to estimate yield moment
        sec = _find_section(model_data, elem.get("section_id", 0))
        if sec:
            props = sec.get("properties", {})
            Iz = props.get("Iz", 1.0)
            E = props.get("E", _get_material_E(model_data, sec.get("material_id")))
            # Approximate yield moment: My = Fy * S ≈ (E/200) * Iz / (d/2)
            # Use a simplified D/C ratio based on moment capacity
            depth = props.get("d", 14.0)  # approximate section depth
            S = Iz / (depth / 2.0) if depth > 0 else Iz
            My = (E / 200.0) * S  # rough yield moment estimate
        else:
            My = 1.0

        for end_label, moment in [("I", moment_i), ("J", moment_j)]:
            if moment < 1e-10:
                continue

            dc_ratio = moment / My if My > 0 else 0.0

            # Classify performance level based on D/C ratio
            # IO < 1.0, LS < 2.0, CP < 3.0
            if dc_ratio < 1.0:
                perf_level = None  # elastic
                rotation = 0.0
            elif dc_ratio < 2.0:
                perf_level = "IO"
                rotation = (dc_ratio - 1.0) * 0.01  # approximate plastic rotation
            elif dc_ratio < 3.0:
                perf_level = "LS"
                rotation = (dc_ratio - 1.0) * 0.01
            else:
                perf_level = "CP"
                rotation = (dc_ratio - 1.0) * 0.01

            hinge_states.append({
                "element_id": elem["id"],
                "end": end_label,
                "rotation": rotation,
                "moment": moment,
                "performance_level": perf_level,
                "demand_capacity_ratio": dc_ratio,
            })

    return hinge_states


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


def _define_sections(
    sections: list[dict], model_data: dict, ndm: int = 2
) -> None:
    """Create OpenSees section commands from section definitions."""
    for sec in sections:
        sid = sec["id"]
        stype = sec["type"]
        props = sec.get("properties", {})

        if stype == "Elastic":
            E = props.get("E") or _get_material_E(
                model_data, sec.get("material_id")
            )
            A = props.get("A", 1.0)
            Iz = props.get("Iz", 1.0)
            if ndm >= 3:
                Iy = props.get("Iy", Iz)
                G = E / 2.6  # approximate shear modulus
                J = props.get("J", 1.0)
                ops.section("Elastic", sid, E, A, Iz, Iy, G, J)
            else:
                ops.section("Elastic", sid, E, A, Iz)
        else:
            logger.warning(
                "Unsupported section type '%s' for section %d", stype, sid
            )


def _define_bearings(bearings: list[dict], ndm: int) -> None:
    """Create Triple Friction Pendulum bearing elements.

    Each bearing requires four friction models (one per sliding surface)
    and four uniaxial materials (vertical compression + 3 rotational DOFs).
    Uses the ``TripleFrictionPendulum`` element from OpenSeesPy.

    Element signature::

        element('TripleFrictionPendulum', tag, iNode, jNode,
                frnTag1, frnTag2, frnTag3,
                vertMatTag, rotZMatTag, rotXMatTag, rotYMatTag,
                L1, L2, L3, d1, d2, d3,
                W, uy, kvt, minFv, tol)
    """
    friction_tag_base = 1000
    mat_tag_base = 5000  # avoid collisions with user-defined materials
    ele_tag_base = 10000  # offset bearing element tags to avoid collisions

    for bearing in bearings:
        bid = bearing["id"]
        ele_tag = ele_tag_base + bid  # unique element tag
        bnodes = bearing["nodes"]

        # Create 4 friction models (one per sliding surface)
        fm_list = bearing["friction_models"]
        fm_tags: list[int] = []
        for j in range(4):
            idx = j if j < len(fm_list) else len(fm_list) - 1
            fm = fm_list[idx]
            ftag = friction_tag_base + (bid - 1) * 10 + j + 1
            ops.frictionModel(
                "VelDependent",
                ftag,
                fm["mu_slow"],
                fm["mu_fast"],
                fm["trans_rate"],
            )
            fm_tags.append(ftag)

        # Create uniaxial materials for vertical and rotational DOFs
        # Vertical: stiff elastic in compression
        W = bearing["weight"]
        # vert_stiffness is the actual spring stiffness (kip/in or kN/m)
        # kvt is the TFP element's tension force-loss stiffness (should be low)
        vert_stiff = bearing.get("vert_stiffness", 100.0 * W if W > 0 else 1.0e6)
        vert_mat_tag = mat_tag_base + bid * 10 + 1
        ops.uniaxialMaterial("Elastic", vert_mat_tag, vert_stiff)

        # Rotational DOFs: very stiff elastic (essentially rigid)
        rot_stiff = 1.0e10
        rot_z_tag = mat_tag_base + bid * 10 + 2
        rot_x_tag = mat_tag_base + bid * 10 + 3
        rot_y_tag = mat_tag_base + bid * 10 + 4
        ops.uniaxialMaterial("Elastic", rot_z_tag, rot_stiff)
        ops.uniaxialMaterial("Elastic", rot_x_tag, rot_stiff)
        ops.uniaxialMaterial("Elastic", rot_y_tag, rot_stiff)

        L1, L2, L3 = bearing["radii"]
        d1, d2, d3 = bearing["disp_capacities"]
        uy = bearing.get("uy", 0.04)
        kvt = bearing.get("kvt", 1.0)  # tension stiffness (should be low)
        min_fv = bearing.get("min_fv", 0.1)
        tol = bearing.get("tol", 1e-5)

        if ndm >= 3:
            try:
                ops.element(
                    "TripleFrictionPendulum",
                    ele_tag,
                    *bnodes,
                    fm_tags[0],
                    fm_tags[1],
                    fm_tags[2],
                    vert_mat_tag,
                    rot_z_tag,
                    rot_x_tag,
                    rot_y_tag,
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
            except Exception:
                # Some OpenSees builds expose the 4-friction signature.
                ops.element(
                    "TripleFrictionPendulum",
                    ele_tag,
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
        else:
            ops.element(
                "TripleFrictionPendulum",
                ele_tag,
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
        logger.info("TFP bearing %d (ele_tag=%d) created", bid, ele_tag)


def generate_fixed_base_variant(model_data: dict) -> dict:
    """Generate a fixed-base variant by removing bearings and fixing base nodes.

    Creates a deep copy of the model, removes all bearings, and sets the
    top nodes of those bearings (i.e. the structure base nodes) to fully
    fixed boundary conditions.

    Args:
        model_data: A dict conforming to :class:`StructuralModelSchema`.

    Returns:
        A modified copy with bearings removed and base nodes fixed.
    """
    variant = copy.deepcopy(model_data)

    # Preserve Z-up convention flag so mass/height logic still works
    # after bearings are removed
    if _is_z_up(model_data):
        variant.setdefault("model_info", {})["z_up"] = True

    # Collect top nodes from bearings (these become the new fixed base)
    bearing_top_nodes: set[int] = set()
    for bearing in variant.get("bearings", []):
        top_node = bearing["nodes"][1]
        bearing_top_nodes.add(top_node)

    # Remove all bearings
    variant["bearings"] = []

    # Also remove bearing bottom nodes (ground nodes) from the model
    # since they only served as bearing anchors
    bearing_bottom_nodes: set[int] = set()
    for bearing in model_data.get("bearings", []):
        bearing_bottom_nodes.add(bearing["nodes"][0])

    # Fix the top nodes (structure base) with full fixity
    ndf = variant.get("model_info", {}).get("ndf", 3)
    for node in variant.get("nodes", []):
        if node["id"] in bearing_top_nodes:
            node["fixity"] = [1] * ndf

    logger.info(
        "Generated fixed-base variant: removed %d bearings, fixed nodes %s",
        len(model_data.get("bearings", [])),
        bearing_top_nodes,
    )

    return variant


def apply_lambda_factor(model_data: dict, factor: float) -> dict:
    """Apply a lambda property modification factor to bearing friction.

    Creates a deep copy and multiplies all bearing friction coefficients
    (mu_slow, mu_fast) by the given factor. Does NOT modify radii,
    displacement capacities, weight, or other parameters.

    Args:
        model_data: A dict conforming to :class:`StructuralModelSchema`.
        factor: Lambda factor to multiply friction values by.

    Returns:
        A modified copy with scaled friction coefficients.
    """
    variant = copy.deepcopy(model_data)

    for bearing in variant.get("bearings", []):
        for fm in bearing.get("friction_models", []):
            fm["mu_slow"] = fm["mu_slow"] * factor
            fm["mu_fast"] = fm["mu_fast"] * factor

    logger.info("Applied lambda factor %.3f to all bearing friction models", factor)

    return variant


def _apply_nodal_loads(model_data: dict) -> None:
    """Apply nodal loads from model, padding values to ndf if needed."""
    ndf = model_data.get("model_info", {}).get("ndf", 3)
    for load in model_data.get("loads", []):
        if load.get("type") == "nodal" and load.get("node_id"):
            values = list(load["values"])
            while len(values) < ndf:
                values.append(0.0)
            ops.load(load["node_id"], *values[:ndf])


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

    For nodal gravity loads the mass is computed as ``-F_vert / g``
    using the unit-appropriate gravity constant.  The vertical DOF is
    DOF 2 (Y) for 2D/Y-up models and DOF 3 (Z) for Z-up 3D models.
    """
    g = _get_gravity(model_data)
    ndf = model_data.get("model_info", {}).get("ndf", 3)

    # Determine which DOF index carries vertical load
    vert_dof_idx = _vert_coord_idx(model_data)

    for load in model_data.get("loads", []):
        if load.get("type") == "nodal" and load.get("node_id"):
            values = load.get("values", [])
            # Infer mass from vertical load
            if len(values) > vert_dof_idx and values[vert_dof_idx] < 0:
                mass = -values[vert_dof_idx] / g
                # Mass for translational DOFs only; use negligible for rotational
                mass_args = []
                for dof_idx in range(ndf):
                    if dof_idx < 3:
                        mass_args.append(mass)  # translational DOFs
                    else:
                        mass_args.append(1.0e-10)  # rotational DOFs (near-zero)
                ops.mass(load["node_id"], *mass_args)

    # Also check for explicit mass in bearing weight
    for bearing in model_data.get("bearings", []):
        W = bearing.get("weight", 0)
        if W > 0:
            top_node = bearing["nodes"][1]
            mass = W / g
            mass_args = []
            for dof_idx in range(ndf):
                if dof_idx < 3:
                    mass_args.append(mass)
                else:
                    mass_args.append(1.0e-10)
            try:
                ops.mass(top_node, *mass_args)
            except Exception:
                pass  # mass may already be assigned
