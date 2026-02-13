import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useModelStore, type Node } from '../../stores/modelStore';

const SUPPORT_SIZE = 8; // model units (inches)

const _tempObject = new THREE.Object3D();

type SupportType = 'fixed' | 'pinned' | 'roller' | 'none';

function classifySupport(node: Node): SupportType {
  const [tx, ty, tz, rx, ry, rz] = node.restraint;
  const translationsFixed = tx && ty && tz;
  const rotationsFixed = rx && ry && rz;

  if (translationsFixed && rotationsFixed) return 'fixed';
  if (translationsFixed && !rotationsFixed) return 'pinned';
  if (tx && ty && !tz) return 'roller';
  if (ty) return 'roller';
  // Any partial restraint falls into pinned
  if (tx || ty || tz) return 'pinned';
  return 'none';
}

// ── Fixed supports (cubes) ──────────────────────────────────────────

function FixedSupports({ nodes }: { nodes: Node[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(
    () => new THREE.BoxGeometry(SUPPORT_SIZE * 2, SUPPORT_SIZE, SUPPORT_SIZE * 2),
    [],
  );

  const count = nodes.length;

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;

    for (let i = 0; i < count; i++) {
      const node = nodes[i];
      if (!node) continue;
      _tempObject.position.set(node.x, node.y - SUPPORT_SIZE / 2, node.z);
      _tempObject.updateMatrix();
      mesh.setMatrixAt(i, _tempObject.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [nodes, count]);

  if (count === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, count]}>
      <meshStandardMaterial color="#ef4444" opacity={0.7} transparent />
    </instancedMesh>
  );
}

// ── Pinned supports (cones / pyramids) ──────────────────────────────

function PinnedSupports({ nodes }: { nodes: Node[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(
    () => new THREE.ConeGeometry(SUPPORT_SIZE, SUPPORT_SIZE * 1.5, 4),
    [],
  );

  const count = nodes.length;

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;

    for (let i = 0; i < count; i++) {
      const node = nodes[i];
      if (!node) continue;
      // Cone points upward by default; rotate 180 to point down
      _tempObject.position.set(node.x, node.y - SUPPORT_SIZE * 0.75, node.z);
      _tempObject.rotation.set(Math.PI, 0, 0);
      _tempObject.updateMatrix();
      mesh.setMatrixAt(i, _tempObject.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [nodes, count]);

  if (count === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, count]}>
      <meshStandardMaterial color="#f59e0b" opacity={0.7} transparent />
    </instancedMesh>
  );
}

// ── Roller supports (spheres) ───────────────────────────────────────

function RollerSupports({ nodes }: { nodes: Node[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(
    () => new THREE.SphereGeometry(SUPPORT_SIZE * 0.6, 12, 12),
    [],
  );

  const count = nodes.length;

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;

    for (let i = 0; i < count; i++) {
      const node = nodes[i];
      if (!node) continue;
      _tempObject.position.set(node.x, node.y - SUPPORT_SIZE * 0.6, node.z);
      _tempObject.rotation.set(0, 0, 0);
      _tempObject.updateMatrix();
      mesh.setMatrixAt(i, _tempObject.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [nodes, count]);

  if (count === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, count]}>
      <meshStandardMaterial color="#22c55e" opacity={0.7} transparent />
    </instancedMesh>
  );
}

// ── Main component ──────────────────────────────────────────────────

export function SupportSymbols() {
  const nodes = useModelStore((state) => state.nodes);

  const { fixedNodes, pinnedNodes, rollerNodes } = useMemo(() => {
    const fixed: Node[] = [];
    const pinned: Node[] = [];
    const roller: Node[] = [];

    for (const node of nodes.values()) {
      const supportType = classifySupport(node);
      switch (supportType) {
        case 'fixed':
          fixed.push(node);
          break;
        case 'pinned':
          pinned.push(node);
          break;
        case 'roller':
          roller.push(node);
          break;
      }
    }

    return { fixedNodes: fixed, pinnedNodes: pinned, rollerNodes: roller };
  }, [nodes]);

  return (
    <group>
      <FixedSupports nodes={fixedNodes} />
      <PinnedSupports nodes={pinnedNodes} />
      <RollerSupports nodes={rollerNodes} />
    </group>
  );
}
