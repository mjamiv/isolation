import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import type { ModalResults } from '@/types/analysis';

const MODE_COLOR = '#8b5cf6';
const MODE_OPACITY = 0.7;
const NODE_RADIUS = 2;
const NODE_SEGMENTS = 8;

interface AnimatedState {
  positions: Map<number, THREE.Vector3>;
}

export function ModeShapeAnimation() {
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);
  const scaleFactor = useDisplayStore((s) => s.scaleFactor);
  const results = useAnalysisStore((s) => s.results);
  const selectedModeNumber = useAnalysisStore((s) => s.selectedModeNumber);
  const hasBearings = useModelStore((s) => s.bearings.size > 0);

  const stateRef = useRef<AnimatedState>({ positions: new Map() });
  const groupRef = useRef<THREE.Group>(null);

  const modalResults = useMemo(() => {
    if (!results?.results || results.type !== 'modal') return null;
    return results.results as ModalResults;
  }, [results]);

  const modeShape = useMemo(() => {
    if (!modalResults || selectedModeNumber === null) return null;
    return modalResults.modeShapes[selectedModeNumber] ?? null;
  }, [modalResults, selectedModeNumber]);

  const frequency = useMemo(() => {
    if (!modalResults || selectedModeNumber === null) return 1;
    return modalResults.frequencies[selectedModeNumber - 1] ?? 1;
  }, [modalResults, selectedModeNumber]);

  const nodeArray = useMemo(() => Array.from(nodes.entries()), [nodes]);
  const elementArray = useMemo(() => Array.from(elements.values()), [elements]);

  // Initialize positions map
  useMemo(() => {
    const positions = new Map<number, THREE.Vector3>();
    for (const [id] of nodeArray) {
      positions.set(id, new THREE.Vector3());
    }
    stateRef.current.positions = positions;
  }, [nodeArray]);

  useFrame(({ clock }) => {
    if (!modeShape) return;
    const elapsed = clock.getElapsedTime();
    const amplitude = scaleFactor * Math.sin(2 * Math.PI * frequency * elapsed);

    const positions = stateRef.current.positions;
    for (const [nodeId, node] of nodeArray) {
      const shape = modeShape[nodeId];
      const pos = positions.get(nodeId);
      if (!pos) continue;

      if (shape) {
        const dx = shape[0] ?? 0;
        const dy = hasBearings ? (shape[2] ?? 0) : (shape[1] ?? 0);
        const dz = hasBearings ? (shape[1] ?? 0) : (shape[2] ?? 0);
        pos.set(node.x + dx * amplitude, node.y + dy * amplitude, node.z + dz * amplitude);
      } else {
        pos.set(node.x, node.y, node.z);
      }
    }

    // Force re-render by invalidating the group
    if (groupRef.current) {
      groupRef.current.matrixWorldNeedsUpdate = true;
    }
  });

  if (!modeShape) return null;

  return (
    <group ref={groupRef}>
      {/* Animated members */}
      {elementArray.map((element) => (
        <AnimatedMember
          key={element.id}
          nodeIId={element.nodeI}
          nodeJId={element.nodeJ}
          stateRef={stateRef}
        />
      ))}

      {/* Animated nodes */}
      {nodeArray.map(([nodeId]) => (
        <AnimatedNode key={nodeId} nodeId={nodeId} stateRef={stateRef} />
      ))}
    </group>
  );
}

interface AnimatedMemberProps {
  nodeIId: number;
  nodeJId: number;
  stateRef: React.RefObject<AnimatedState>;
}

function AnimatedMember({ nodeIId, nodeJId, stateRef }: AnimatedMemberProps) {
  const lineObj = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const material = new THREE.LineBasicMaterial({
      color: MODE_COLOR,
      transparent: true,
      opacity: MODE_OPACITY,
    });
    return new THREE.Line(geometry, material);
  }, []);

  useFrame(() => {
    const posI = stateRef.current?.positions.get(nodeIId);
    const posJ = stateRef.current?.positions.get(nodeJId);
    if (!posI || !posJ) return;

    const posAttr = lineObj.geometry.getAttribute('position') as THREE.BufferAttribute;
    posAttr.setXYZ(0, posI.x, posI.y, posI.z);
    posAttr.setXYZ(1, posJ.x, posJ.y, posJ.z);
    posAttr.needsUpdate = true;
    lineObj.geometry.computeBoundingSphere();
  });

  return <primitive object={lineObj} />;
}

interface AnimatedNodeProps {
  nodeId: number;
  stateRef: React.RefObject<AnimatedState>;
}

function AnimatedNode({ nodeId, stateRef }: AnimatedNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const pos = stateRef.current?.positions.get(nodeId);
    if (!pos || !meshRef.current) return;
    meshRef.current.position.copy(pos);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[NODE_RADIUS, NODE_SEGMENTS, NODE_SEGMENTS]} />
      <meshStandardMaterial color={MODE_COLOR} transparent opacity={MODE_OPACITY} />
    </mesh>
  );
}
