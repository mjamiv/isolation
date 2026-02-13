import { useRef, useMemo, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';

const BEARING_RADIUS = 6;   // model units (inches)
const BEARING_HEIGHT = 10;  // model units (inches)

const _tempObject = new THREE.Object3D();

export function BearingSymbols() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const bearings = useModelStore((s) => s.bearings);
  const nodes = useModelStore((s) => s.nodes);
  const selectBearing = useDisplayStore((s) => s.selectBearing);

  const bearingArray = useMemo(() => Array.from(bearings.values()), [bearings]);
  const count = bearingArray.length;

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;

    for (let i = 0; i < count; i++) {
      const b = bearingArray[i]!;
      const nI = nodes.get(b.nodeI);
      const nJ = nodes.get(b.nodeJ);
      if (!nI || !nJ) continue;

      // Position at midpoint between the two nodes
      const mx = (nI.x + nJ.x) / 2;
      const my = (nI.y + nJ.y) / 2;
      const mz = (nI.z + nJ.z) / 2;

      _tempObject.position.set(mx, my, mz);
      _tempObject.rotation.set(0, 0, 0);
      _tempObject.updateMatrix();
      mesh.setMatrixAt(i, _tempObject.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [bearingArray, nodes, count]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined && e.instanceId < count) {
        const b = bearingArray[e.instanceId];
        if (b) {
          selectBearing(b.id, e.nativeEvent.shiftKey);
        }
      }
    },
    [bearingArray, count, selectBearing],
  );

  const geometry = useMemo(
    () => new THREE.CylinderGeometry(BEARING_RADIUS, BEARING_RADIUS, BEARING_HEIGHT, 16),
    [],
  );

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, count]}
      onClick={handleClick}
    >
      <meshStandardMaterial color="#a855f7" opacity={0.7} transparent />
    </instancedMesh>
  );
}
