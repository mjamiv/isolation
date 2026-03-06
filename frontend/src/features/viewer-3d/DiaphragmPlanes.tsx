import { useMemo } from 'react';
import * as THREE from 'three';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useModelBounds } from './useModelBounds';
import { toViewerTranslation, useActiveDisplacements } from './useActiveDisplacements';
import {
  buildHullSurfaceData,
  buildRibbonStripData,
  convexHull2D,
  normalFromPerpDirection,
  type DiaphragmMeshData,
} from './diaphragmGeometry';

interface DiaphragmMesh {
  id: number;
  geometry: THREE.BufferGeometry;
  edgeGeometry: THREE.BufferGeometry;
  isCollinear: boolean;
}

function toBufferGeometry(mesh: DiaphragmMeshData): DiaphragmMesh {
  const geometry = new THREE.BufferGeometry();
  const verts = new Float32Array(mesh.vertices.flatMap((point) => [point.x, point.y, point.z]));
  geometry.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geometry.setIndex(mesh.indices);
  geometry.computeVertexNormals();

  const edgeGeometry = new THREE.BufferGeometry().setFromPoints(
    mesh.outline.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
  );

  return {
    id: 0,
    geometry,
    edgeGeometry,
    isCollinear: mesh.isCollinear,
  };
}

export function DiaphragmPlanes() {
  const diaphragms = useModelStore((s) => s.diaphragms);
  const nodes = useModelStore((s) => s.nodes);
  const showDiaphragms = useDisplayStore((s) => s.showDiaphragms);
  const scaleFactor = useDisplayStore((s) => s.scaleFactor);
  const currentTimeStep = useAnalysisStore((s) => s.currentTimeStep);
  const { nodeDisplacements, zUpData } = useActiveDisplacements();
  const bounds = useModelBounds();
  const is2DFrame = useMemo(() => {
    for (const node of nodes.values()) {
      if (Math.abs(node.z) > 1e-3) return false;
    }
    return true;
  }, [nodes]);

  const meshes = useMemo(() => {
    if (!showDiaphragms || diaphragms.size === 0 || currentTimeStep < 0) return [];

    // Panel half-width: ~3% of model extent perpendicular to girder line
    const stripHalfWidth = Math.max(bounds.maxDimension * 0.03, 24);

    const result: DiaphragmMesh[] = [];

    for (const d of diaphragms.values()) {
      // Collect all node positions (master + constrained)
      const allNodeIds = [d.masterNodeId, ...d.constrainedNodeIds];
      const positions: { x: number; y: number; z: number }[] = [];
      for (const nid of allNodeIds) {
        const node = nodes.get(nid);
        if (!node) continue;
        const disp = nodeDisplacements?.[nid] ?? nodeDisplacements?.[String(nid)];
        const [dx, dy, dz] = toViewerTranslation(disp, scaleFactor, is2DFrame, zUpData);
        positions.push({ x: node.x + dx, y: node.y + dy, z: node.z + dz });
      }

      if (positions.length < 2) continue;

      // Project to XZ plane for convex hull
      const xzPoints = positions.map((p) => ({ x: p.x, z: p.z }));
      const hullIndices = convexHull2D(xzPoints);
      const planeNormal = normalFromPerpDirection(d.perpDirection);

      // Collinear case (bridge girders at same station): render inter-girder panels
      if (hullIndices.length < 3 || positions.length < 3) {
        const panels = buildRibbonStripData(positions, stripHalfWidth, planeNormal);
        if (!panels) continue;
        const mesh = toBufferGeometry(panels);
        result.push({ ...mesh, id: d.id });
        continue;
      }

      const surface = buildHullSurfaceData(positions);
      if (!surface) continue;
      const mesh = toBufferGeometry(surface);
      result.push({ ...mesh, id: d.id });
    }

    return result;
  }, [
    diaphragms,
    nodes,
    showDiaphragms,
    bounds.maxDimension,
    nodeDisplacements,
    scaleFactor,
    is2DFrame,
    zUpData,
    currentTimeStep,
  ]);

  if (!showDiaphragms || meshes.length === 0) return null;

  return (
    <group>
      {meshes.map((m) => (
        <group key={m.id}>
          <mesh geometry={m.geometry}>
            <meshStandardMaterial
              color="#d4af37"
              transparent
              opacity={0.45}
              roughness={0.4}
              metalness={0.1}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <lineLoop geometry={m.edgeGeometry}>
            <lineBasicMaterial color="#d4af37" />
          </lineLoop>
        </group>
      ))}
    </group>
  );
}
