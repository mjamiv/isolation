import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useModelStore } from '../../stores/modelStore';
import { useDisplayStore } from '../../stores/displayStore';

const NODE_RADIUS = 3; // model units (inches)
const NODE_SEGMENTS = 12;

const COLOR_DEFAULT = new THREE.Color(0xcccccc);    // light gray
const COLOR_SELECTED = new THREE.Color(0x3b82f6);   // blue-500
const COLOR_HOVERED = new THREE.Color(0xfbbf24);    // amber-400

const _tempObject = new THREE.Object3D();
const _tempColor = new THREE.Color();

export function NodePoints() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const nodes = useModelStore((state) => state.nodes);
  const selectedNodeIds = useDisplayStore((state) => state.selectedNodeIds);
  const hoveredNodeId = useDisplayStore((state) => state.hoveredNodeId);
  const selectNode = useDisplayStore((state) => state.selectNode);
  const setHoveredNode = useDisplayStore((state) => state.setHoveredNode);

  const nodeArray = useMemo(() => Array.from(nodes.values()), [nodes]);
  const nodeCount = nodeArray.length;

  // Build a lookup from instance index to node id
  const indexToNodeId = useMemo(
    () => nodeArray.map((n) => n.id),
    [nodeArray],
  );

  // Geometry shared across instances
  const geometry = useMemo(
    () => new THREE.SphereGeometry(NODE_RADIUS, NODE_SEGMENTS, NODE_SEGMENTS),
    [],
  );

  // Update instance matrices and colors whenever data changes
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || nodeCount === 0) return;

    for (let i = 0; i < nodeCount; i++) {
      const node = nodeArray[i];
      if (!node) continue;

      _tempObject.position.set(node.x, node.y, node.z);
      _tempObject.updateMatrix();
      mesh.setMatrixAt(i, _tempObject.matrix);

      // Color based on selection/hover state
      const nodeId = node.id;
      if (nodeId === hoveredNodeId) {
        _tempColor.copy(COLOR_HOVERED);
      } else if (selectedNodeIds.has(nodeId)) {
        _tempColor.copy(COLOR_SELECTED);
      } else {
        _tempColor.copy(COLOR_DEFAULT);
      }
      mesh.setColorAt(i, _tempColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [nodeArray, nodeCount, selectedNodeIds, hoveredNodeId]);

  if (nodeCount === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, nodeCount]}
      onClick={(e) => {
        e.stopPropagation();
        const instanceId = e.instanceId;
        if (instanceId !== undefined && instanceId < indexToNodeId.length) {
          const nodeId = indexToNodeId[instanceId];
          if (nodeId !== undefined) {
            selectNode(nodeId, e.nativeEvent.shiftKey);
          }
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        const instanceId = e.instanceId;
        if (instanceId !== undefined && instanceId < indexToNodeId.length) {
          const nodeId = indexToNodeId[instanceId];
          if (nodeId !== undefined) {
            setHoveredNode(nodeId);
          }
        }
      }}
      onPointerOut={() => {
        setHoveredNode(null);
      }}
    >
      <meshStandardMaterial vertexColors />
    </instancedMesh>
  );
}
