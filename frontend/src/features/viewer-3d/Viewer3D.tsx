import { Suspense, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useDisplayStore } from '../../stores/displayStore';
import { StructuralModel3D } from './StructuralModel3D';
import { BearingDisplacementView } from './BearingDisplacementView';
import { SceneEnvironment } from './SceneEnvironment';
import { useModelBounds } from './useModelBounds';

// ── Camera framing ──────────────────────────────────────────────────────
// Adjusts camera position, far plane, and orbit target whenever the loaded
// model changes. Runs once per model load — not on every frame.

function CameraFraming() {
  const bounds = useModelBounds();
  const { camera, invalidate } = useThree();
  const controlsRef = useThree((state) => state.controls);

  useEffect(() => {
    const [cx, cy, cz] = bounds.center;

    // Position camera at ~1.8x the max dimension away, looking at center
    const dist = bounds.maxDimension * 1.8;
    camera.position.set(cx + dist * 0.7, cy + dist * 0.5, cz + dist * 0.7);
    camera.far = bounds.cameraFar;
    camera.updateProjectionMatrix();

    // Update orbit target to model center
    if (controlsRef && 'target' in controlsRef) {
      const ctrl = controlsRef as unknown as { target: THREE.Vector3; update: () => void };
      ctrl.target.set(cx, cy, cz);
      ctrl.update();
    }

    invalidate();
  }, [bounds, camera, controlsRef, invalidate]);

  return null;
}

// ── Scene content ───────────────────────────────────────────────────────

function SceneContent() {
  const showGrid = useDisplayStore((state) => state.showGrid);
  const showAxes = useDisplayStore((state) => state.showAxes);
  const environment = useDisplayStore((state) => state.environment);
  const bounds = useModelBounds();

  const [cx, , cz] = bounds.center;

  // Memoize grid position to avoid re-creating the array each render
  const gridPosition = useMemo((): [number, number, number] => [cx, 0, cz], [cx, cz]);

  return (
    <>
      {/* Environment preset — provides background, lighting, ground treatment */}
      <SceneEnvironment environment={environment} bounds={bounds} />

      {/* Auto-frame camera to model extents on load */}
      <CameraFraming />

      {/* Camera controls — dynamic limits based on model size */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.1}
        minDistance={Math.max(bounds.maxDimension * 0.1, 20)}
        maxDistance={bounds.orbitMaxDistance}
        target={new THREE.Vector3(...bounds.center)}
      />

      {/* Orientation gizmo */}
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="white" />
      </GizmoHelper>

      {/* User-toggled grid overlay (supplements environment ground treatment) */}
      {/* Blueprint environment provides its own grid, so skip this one there */}
      {showGrid && environment !== 'blueprint' && (
        <Grid
          args={[bounds.gridSize, bounds.gridSize]}
          cellSize={bounds.cellSize}
          cellThickness={0.5}
          cellColor="#374151"
          sectionSize={bounds.sectionSize}
          sectionThickness={1}
          sectionColor="#4b5563"
          fadeDistance={bounds.gridSize * 1.5}
          fadeStrength={1}
          followCamera={false}
          position={gridPosition}
        />
      )}

      {/* Axes helper — scales with model */}
      {showAxes && <axesHelper args={[Math.max(bounds.maxDimension * 0.15, 100)]} />}

      {/* Structural model */}
      <StructuralModel3D />
    </>
  );
}

// ── Root component ──────────────────────────────────────────────────────

export function Viewer3D() {
  return (
    <div className="relative h-full w-full">
      <Canvas
        frameloop="demand"
        shadows
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        camera={{
          position: [800, 600, 800],
          fov: 45,
          near: 1,
          far: 20000,
          up: [0, 1, 0],
        }}
        onPointerMissed={() => {
          useDisplayStore.getState().clearSelection();
        }}
      >
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
      </Canvas>

      {/* Bearing displacement orbit overlay (plan view) */}
      <BearingDisplacementView />
    </div>
  );
}
