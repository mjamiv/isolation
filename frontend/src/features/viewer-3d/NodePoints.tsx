import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useModelStore } from '../../stores/modelStore';
import { useDisplayStore } from '../../stores/displayStore';

const NODE_RADIUS = 3; // model units (inches)
const NODE_SEGMENTS = 12;

// ── Colors ───────────────────────────────────────────────────────────
// Default nodes use a warm off-white that pops on dark backgrounds
const COLOR_DEFAULT = new THREE.Color(0xe8e0d0); // warm cream
const COLOR_SELECTED = new THREE.Color(0xd4af37); // gold
const COLOR_HOVERED = new THREE.Color(0xfacc15); // yellow-400

// Emissive colors give each state its own glow intensity
const EMISSIVE_DEFAULT = new THREE.Color(0xccbbaa); // subtle warm glow
const EMISSIVE_SELECTED = new THREE.Color(0xd4af37); // strong gold glow
const EMISSIVE_HOVERED = new THREE.Color(0xfacc15); // bright yellow glow

const _tempObject = new THREE.Object3D();
const _tempColor = new THREE.Color();

/**
 * Custom shader material for instanced node points.
 *
 * Uses per-instance color (via vertexColors / instanceColor) combined
 * with a uniform emissive base and per-instance emissive tinting.
 * The result is small, bright dots visible against any background —
 * similar to SAP2000/ETABS node rendering.
 *
 * We store the emissive color in a second InstancedBufferAttribute
 * and apply it additively in a custom onBeforeCompile patch.
 */

export function NodePoints() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const emissiveAttrRef = useRef<THREE.InstancedBufferAttribute | null>(null);

  const nodes = useModelStore((state) => state.nodes);
  const selectedNodeIds = useDisplayStore((state) => state.selectedNodeIds);
  const hoveredNodeId = useDisplayStore((state) => state.hoveredNodeId);
  const selectNode = useDisplayStore((state) => state.selectNode);
  const setHoveredNode = useDisplayStore((state) => state.setHoveredNode);

  const nodeArray = useMemo(() => Array.from(nodes.values()), [nodes]);
  const nodeCount = nodeArray.length;

  // Build a lookup from instance index to node id
  const indexToNodeId = useMemo(() => nodeArray.map((n) => n.id), [nodeArray]);

  // Geometry shared across instances
  const geometry = useMemo(
    () => new THREE.SphereGeometry(NODE_RADIUS, NODE_SEGMENTS, NODE_SEGMENTS),
    [],
  );

  // Create the emissive InstancedBufferAttribute when count changes
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || nodeCount === 0) return;

    // Create a Float32 buffer for per-instance emissive colors (RGB)
    const emissiveArray = new Float32Array(nodeCount * 3);
    const attr = new THREE.InstancedBufferAttribute(emissiveArray, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    mesh.geometry.setAttribute('instanceEmissive', attr);
    emissiveAttrRef.current = attr;

    return () => {
      mesh.geometry.deleteAttribute('instanceEmissive');
      emissiveAttrRef.current = null;
    };
  }, [nodeCount]);

  // Update instance matrices, colors, and emissive whenever data changes
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || nodeCount === 0) return;

    const emissiveAttr = emissiveAttrRef.current;

    for (let i = 0; i < nodeCount; i++) {
      const node = nodeArray[i];
      if (!node) continue;

      _tempObject.position.set(node.x, node.y, node.z);
      _tempObject.updateMatrix();
      mesh.setMatrixAt(i, _tempObject.matrix);

      // Determine color state
      const nodeId = node.id;
      const isHovered = nodeId === hoveredNodeId;
      const isSelected = selectedNodeIds.has(nodeId);

      if (isHovered) {
        _tempColor.copy(COLOR_HOVERED);
      } else if (isSelected) {
        _tempColor.copy(COLOR_SELECTED);
      } else {
        _tempColor.copy(COLOR_DEFAULT);
      }
      mesh.setColorAt(i, _tempColor);

      // Set per-instance emissive color
      if (emissiveAttr) {
        let emissive: THREE.Color;
        if (isHovered) {
          emissive = EMISSIVE_HOVERED;
        } else if (isSelected) {
          emissive = EMISSIVE_SELECTED;
        } else {
          emissive = EMISSIVE_DEFAULT;
        }
        emissiveAttr.setXYZ(i, emissive.r, emissive.g, emissive.b);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    if (emissiveAttr) {
      emissiveAttr.needsUpdate = true;
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
      <meshStandardMaterial
        vertexColors
        emissive={EMISSIVE_DEFAULT}
        emissiveIntensity={0.6}
        roughness={0.3}
        metalness={0.1}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
