/**
 * SceneEnvironment.tsx
 *
 * Blueprint environment for the 3D structural viewer.
 * Navy-blue background, even technical lighting, fine engineering grid,
 * and subtle axis lines — clean, minimal, and purpose-built for
 * structural analysis visualization.
 *
 * All sizing (grid, lights) adapts dynamically to the loaded model's
 * bounding box via the `bounds` prop from useModelBounds.
 *
 * Procedural — no external HDR files are loaded.
 * Compatible with frameloop="demand" via useThree().invalidate().
 */

import { useEffect, useRef, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Environment, Lightformer, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useDisplayStore } from '../../stores/displayStore';
import type { ModelBounds } from './useModelBounds';

// ── Types ────────────────────────────────────────────────────────────────────

interface SceneEnvironmentProps {
  bounds: ModelBounds;
}

// ── Solid background setter ──────────────────────────────────────────────────

function SolidBackground({ color }: { color: string }) {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    scene.background = new THREE.Color(color);
    invalidate();
    return () => {
      scene.background = null;
    };
  }, [scene, color, invalidate]);

  return null;
}

// ── Blueprint axis lines ─────────────────────────────────────────────────────

function BlueprintAxes({ bounds }: { bounds: ModelBounds }) {
  const axisLen = bounds.gridSize * 0.6;
  const axisNeg = bounds.gridSize * 0.15;
  const yLen = bounds.maxDimension * 0.5;

  const xPoints = useMemo(
    () => [new THREE.Vector3(-axisNeg, 0, 0), new THREE.Vector3(axisLen, 0, 0)],
    [axisNeg, axisLen],
  );
  const zPoints = useMemo(
    () => [new THREE.Vector3(0, 0, -axisNeg), new THREE.Vector3(0, 0, axisLen)],
    [axisNeg, axisLen],
  );
  const yPoints = useMemo(
    () => [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, yLen, 0)],
    [yLen],
  );

  const xPositions = useMemo(
    () => new Float32Array(xPoints.flatMap((p) => [p.x, p.y, p.z])),
    [xPoints],
  );
  const zPositions = useMemo(
    () => new Float32Array(zPoints.flatMap((p) => [p.x, p.y, p.z])),
    [zPoints],
  );
  const yPositions = useMemo(
    () => new Float32Array(yPoints.flatMap((p) => [p.x, p.y, p.z])),
    [yPoints],
  );

  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[xPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#4a1a28" linewidth={1} transparent opacity={0.5} />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[zPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#1a2850" linewidth={1} transparent opacity={0.5} />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[yPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#1a3828" linewidth={1} transparent opacity={0.5} />
      </line>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function SceneEnvironment({ bounds }: SceneEnvironmentProps) {
  const showGrid = useDisplayStore((state) => state.showGrid);
  const invalidate = useThree((state) => state.invalidate);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const id = requestAnimationFrame(() => invalidate());
    return () => cancelAnimationFrame(id);
  }, [showGrid, invalidate]);

  const [cx, , cz] = bounds.center;
  const s = bounds.shadowExtent;
  const gs = bounds.gridSize;

  return (
    <>
      <SolidBackground color="#0b1220" />

      {/* Cool ambient wash */}
      <ambientLight intensity={0.55} color="#b8c8e0" />

      {/* Primary key — slight warm offset for material definition */}
      <directionalLight
        position={[cx + s * 0.3, s * 0.5, cz + s * 0.3]}
        intensity={0.7}
        color="#d8e4f8"
      />

      {/* Cool fill — opposite side */}
      <directionalLight
        position={[cx - s * 0.2, s * 0.35, cz - s * 0.2]}
        intensity={0.35}
        color="#a0b8d8"
      />

      {/* Front fill — subtle, reduces harsh shadows */}
      <directionalLight position={[cx, s * 0.15, cz + s * 0.4]} intensity={0.25} color="#c0d0e0" />

      {/* Environment map for subtle specular on structural members */}
      <Environment resolution={64} frames={1}>
        <Lightformer
          form="rect"
          intensity={0.9}
          position={[0, 6, -5]}
          scale={[18, 10, 1]}
          color="#b8c8e0"
        />
        <Lightformer
          form="rect"
          intensity={0.5}
          position={[6, 3, 3]}
          scale={[8, 5, 1]}
          color="#a0b0c8"
        />
      </Environment>

      {showGrid && (
        <>
          <Grid
            args={[gs * 1.8, gs * 1.8]}
            cellSize={bounds.cellSize / 2}
            cellThickness={0.25}
            cellColor="#142238"
            sectionSize={bounds.sectionSize}
            sectionThickness={0.6}
            sectionColor="#1e3450"
            fadeDistance={gs * 1.6}
            fadeStrength={1.8}
            followCamera={false}
            position={[cx, -1, cz]}
            side={THREE.DoubleSide}
          />
          <BlueprintAxes bounds={bounds} />
        </>
      )}
    </>
  );
}
