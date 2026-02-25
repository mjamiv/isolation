/**
 * Converts the frontend Zustand store format into the backend
 * StructuralModelSchema format for API submission.
 */

import type { StructuralModel, FrictionModel as FrictionModelOut } from '@/types/model';
import type {
  Node,
  Element,
  Section,
  Material,
  TFPBearing,
  PointLoad,
  GroundMotionRecord,
  RigidDiaphragm,
  EqualDOFConstraint,
} from '@/types/storeModel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeNode(node: Node, zUp: boolean): StructuralModel['nodes'][number] {
  const coords: [number, number, number] = zUp
    ? [node.x, node.z, node.y] // Y-up -> Z-up swap
    : [node.x, node.y, node.z];

  const [tx, ty, tz, rx, ry, rz] = node.restraint;
  const fixity = zUp ? [tx, tz, ty, rx, rz, ry] : [tx, ty, tz, rx, ry, rz];

  return {
    id: node.id,
    coords,
    fixity: fixity.map((r) => (r ? 1 : 0)) as [number, number, number, number, number, number],
  };
}

function serializeElement(element: Element): StructuralModel['elements'][number] {
  const typeMap: Record<string, string> = {
    column: 'elasticBeamColumn',
    beam: 'elasticBeamColumn',
    pierCap: 'elasticBeamColumn',
    brace: 'elasticBeamColumn',
    bearing: 'TripleFrictionPendulum',
  };
  return {
    id: element.id,
    type: typeMap[element.type] ?? element.type,
    nodes: [element.nodeI, element.nodeJ],
    sectionId: element.sectionId,
    transform: 'Linear',
  };
}

function serializeSection(
  section: Section,
  materialId: number,
): StructuralModel['sections'][number] {
  return {
    id: section.id,
    type: 'Elastic',
    name: section.name,
    properties: {
      A: section.area,
      Iz: section.Ix,
      Iy: section.Iy,
      Zx: section.Zx,
      d: section.d,
      bf: section.bf,
      tw: section.tw,
      tf: section.tf,
    },
    materialId,
  };
}

function serializeMaterial(material: Material): StructuralModel['materials'][number] {
  return {
    id: material.id,
    type: 'Elastic',
    name: material.name,
    params: {
      E: material.E,
      Fy: material.Fy,
      density: material.density,
      nu: material.nu,
    },
  };
}

function serializeLoad(load: PointLoad, zUp: boolean): StructuralModel['loads'][number] {
  const values: [number, number, number, number, number, number] = zUp
    ? [load.fx, load.fz, load.fy, load.mx, load.mz, load.my]
    : [load.fx, load.fy, load.fz, load.mx, load.my, load.mz];

  return {
    type: 'nodal',
    nodeId: load.nodeId,
    values,
  };
}

function serializeGroundMotion(
  gm: GroundMotionRecord,
  zUp: boolean,
): StructuralModel['groundMotions'][number] {
  const direction = zUp
    ? ((gm.direction === 2 ? 3 : gm.direction === 3 ? 2 : gm.direction) as 1 | 2 | 3)
    : gm.direction;
  return {
    id: gm.id,
    name: gm.name,
    dt: gm.dt,
    acceleration: gm.acceleration,
    direction,
    scaleFactor: gm.scaleFactor,
  };
}

function serializeDiaphragm(
  d: RigidDiaphragm,
  zUp: boolean,
): { master_node_id: number; constrained_node_ids: number[]; perp_direction: number } {
  // In Y-up frontend, perpDirection=2 means Y-perp (horizontal diaphragm).
  // In Z-up backend, that becomes perpDirection=3. Swap 2↔3 when zUp.
  const perpDirection = zUp
    ? d.perpDirection === 2
      ? 3
      : d.perpDirection === 3
        ? 2
        : d.perpDirection
    : d.perpDirection;
  return {
    master_node_id: d.masterNodeId,
    constrained_node_ids: [...d.constrainedNodeIds],
    perp_direction: perpDirection,
  };
}

function serializeEqualDofConstraint(
  c: EqualDOFConstraint,
  zUp: boolean,
): { retained_node_id: number; constrained_node_id: number; dofs: number[] } {
  // DOF swap: frontend Y-up DOF 2 (Y) <-> backend Z-up DOF 3 (Z)
  const dofs = zUp ? c.dofs.map((d) => (d === 2 ? 3 : d === 3 ? 2 : d)) : [...c.dofs];
  return {
    retained_node_id: c.retainedNodeId,
    constrained_node_id: c.constrainedNodeId,
    dofs,
  };
}

function serializeBearing(bearing: TFPBearing): StructuralModel['bearings'][number] {
  return {
    id: bearing.id,
    nodes: [bearing.nodeI, bearing.nodeJ],
    frictionModels: bearing.surfaces.map((s) => ({
      type: s.type,
      muSlow: s.muSlow,
      muFast: s.muFast,
      transRate: s.transRate,
    })) as [FrictionModelOut, FrictionModelOut, FrictionModelOut, FrictionModelOut],
    radii: [...bearing.radii],
    dispCapacities: [...bearing.dispCapacities],
    weight: bearing.weight,
    uy: bearing.yieldDisp,
    kvt: 1.0,
    vertStiffness: bearing.vertStiffness,
    minFv: bearing.minVertForce,
    tol: bearing.tolerance,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

interface StoreSnapshot {
  model: { name: string; units: string; description: string } | null;
  nodes: Map<number, Node>;
  elements: Map<number, Element>;
  sections: Map<number, Section>;
  materials: Map<number, Material>;
  bearings: Map<number, TFPBearing>;
  loads: Map<number, PointLoad>;
  groundMotions: Map<number, GroundMotionRecord>;
  diaphragms: Map<number, RigidDiaphragm>;
  equalDofConstraints: Map<number, EqualDOFConstraint>;
}

export function serializeModel(store: StoreSnapshot): StructuralModel {
  const zUp = store.bearings.size > 0;
  const firstMaterialId =
    store.materials.size > 0 ? Array.from(store.materials.values())[0]!.id : 1;

  return {
    modelInfo: {
      name: store.model?.name ?? 'Untitled',
      units: store.model?.units ?? 'kip-in',
      ndm: 3,
      ndf: 6,
      ...(zUp ? { zUp: true } : {}),
    },
    nodes: Array.from(store.nodes.values()).map((node) => serializeNode(node, zUp)),
    materials: Array.from(store.materials.values()).map(serializeMaterial),
    sections: Array.from(store.sections.values()).map((s) => serializeSection(s, firstMaterialId)),
    elements: Array.from(store.elements.values()).map(serializeElement),
    bearings: Array.from(store.bearings.values()).map(serializeBearing),
    loads: Array.from(store.loads.values()).map((load) => serializeLoad(load, zUp)),
    groundMotions: Array.from(store.groundMotions.values()).map((gm) =>
      serializeGroundMotion(gm, zUp),
    ),
    diaphragms: Array.from(store.diaphragms.values()).map((d) => serializeDiaphragm(d, zUp)),
    equalDofConstraints: Array.from(store.equalDofConstraints.values()).map((c) =>
      serializeEqualDofConstraint(c, zUp),
    ),
  };
}
