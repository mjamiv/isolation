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
} from '@/types/storeModel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeNode(node: Node): StructuralModel['nodes'][number] {
  return {
    id: node.id,
    coords: [node.x, node.y, node.z],
    fixity: node.restraint.map((r) => (r ? 1 : 0)) as [
      number,
      number,
      number,
      number,
      number,
      number,
    ],
  };
}

function serializeElement(element: Element): StructuralModel['elements'][number] {
  const typeMap: Record<string, string> = {
    column: 'elasticBeamColumn',
    beam: 'elasticBeamColumn',
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

function serializeLoad(load: PointLoad): StructuralModel['loads'][number] {
  return {
    type: 'nodeLoad',
    nodeId: load.nodeId,
    values: [load.fx, load.fy, load.fz, load.mx, load.my, load.mz],
  };
}

function serializeGroundMotion(gm: GroundMotionRecord): StructuralModel['groundMotions'][number] {
  return {
    id: gm.id,
    name: gm.name,
    dt: gm.dt,
    acceleration: gm.acceleration,
    direction: gm.direction,
    scaleFactor: gm.scaleFactor,
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
    kvt: bearing.vertStiffness,
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
}

export function serializeModel(store: StoreSnapshot): StructuralModel {
  const firstMaterialId =
    store.materials.size > 0 ? Array.from(store.materials.values())[0]!.id : 1;

  return {
    modelInfo: {
      name: store.model?.name ?? 'Untitled',
      units: { force: 'kip', length: 'in', time: 'sec' },
      ndm: 3,
      ndf: 6,
    },
    nodes: Array.from(store.nodes.values()).map(serializeNode),
    materials: Array.from(store.materials.values()).map(serializeMaterial),
    sections: Array.from(store.sections.values()).map((s) => serializeSection(s, firstMaterialId)),
    elements: Array.from(store.elements.values()).map(serializeElement),
    bearings: Array.from(store.bearings.values()).map(serializeBearing),
    loads: Array.from(store.loads.values()).map(serializeLoad),
    groundMotions: Array.from(store.groundMotions.values()).map(serializeGroundMotion),
  };
}
