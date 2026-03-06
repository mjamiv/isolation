import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useDisplayStore } from '../../stores/displayStore';
import { StructuralModel3D } from './StructuralModel3D';
import { BearingAssemblyWindow } from './BearingAssemblyWindow';
import { BearingDisplacementView } from './BearingDisplacementView';
import { BaseShearSummary } from './BaseShearLabels';
import { SceneEnvironment } from './SceneEnvironment';
import { useModelBounds } from './useModelBounds';
import { ViewerHud } from './ViewerHud';
import type { CameraViewPreset } from '../../stores/displayStore';

type CameraControls = { target: THREE.Vector3; update: () => void };

function getCameraPresetPosition(
  view: CameraViewPreset,
  bounds: ReturnType<typeof useModelBounds>,
) {
  const [cx, cy, cz] = bounds.center;
  const dist = Math.max(bounds.maxDimension * 1.6, 180);

  switch (view) {
    case 'plan':
      return {
        position: new THREE.Vector3(cx, cy + dist * 1.15, cz + 0.01),
        up: new THREE.Vector3(0, 0, 1),
      };
    case 'front':
      return {
        position: new THREE.Vector3(cx, cy + dist * 0.18, cz + dist * 1.1),
        up: new THREE.Vector3(0, 1, 0),
      };
    case 'side':
      return {
        position: new THREE.Vector3(cx + dist * 1.1, cy + dist * 0.18, cz),
        up: new THREE.Vector3(0, 1, 0),
      };
    case 'iso':
    default:
      return {
        position: new THREE.Vector3(cx + dist * 0.82, cy + dist * 0.52, cz + dist * 0.82),
        up: new THREE.Vector3(0, 1, 0),
      };
  }
}

function CameraRig() {
  const bounds = useModelBounds();
  const cameraView = useDisplayStore((state) => state.cameraView);
  const cameraCommandVersion = useDisplayStore((state) => state.cameraCommandVersion);
  const { camera, invalidate } = useThree();
  const controlsRef = useThree((state) => state.controls) as unknown as CameraControls | undefined;
  const targetPositionRef = useRef(new THREE.Vector3());
  const targetUpRef = useRef(new THREE.Vector3(0, 1, 0));
  const targetLookAtRef = useRef(new THREE.Vector3(...bounds.center));
  const animatingRef = useRef(false);

  useEffect(() => {
    const target = new THREE.Vector3(...bounds.center);
    const preset = getCameraPresetPosition(cameraView, bounds);

    targetPositionRef.current.copy(preset.position);
    targetUpRef.current.copy(preset.up);
    targetLookAtRef.current.copy(target);
    camera.far = bounds.cameraFar;
    camera.updateProjectionMatrix();
    animatingRef.current = true;
    invalidate();
  }, [bounds, camera, cameraView, cameraCommandVersion, invalidate]);

  useFrame(() => {
    const controls = controlsRef;
    if (!controls || !animatingRef.current) return;

    camera.position.lerp(targetPositionRef.current, 0.16);
    camera.up.lerp(targetUpRef.current, 0.2).normalize();
    controls.target.lerp(targetLookAtRef.current, 0.18);
    camera.lookAt(controls.target);
    controls.update();

    const positionSettled = camera.position.distanceTo(targetPositionRef.current) < 0.5;
    const targetSettled = controls.target.distanceTo(targetLookAtRef.current) < 0.5;
    const upSettled = camera.up.distanceTo(targetUpRef.current) < 0.01;

    if (positionSettled && targetSettled && upSettled) {
      camera.position.copy(targetPositionRef.current);
      camera.up.copy(targetUpRef.current);
      controls.target.copy(targetLookAtRef.current);
      camera.lookAt(controls.target);
      controls.update();
      animatingRef.current = false;
      return;
    }

    invalidate();
  });

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
      <CameraRig />

      {/* Camera controls — dynamic limits based on model size */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.1}
        minDistance={Math.max(bounds.maxDimension * 0.1, 20)}
        maxDistance={bounds.orbitMaxDistance}
        screenSpacePanning
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

      <ViewerHud />

      {/* Bearing displacement orbit overlay (plan view) */}
      <BearingDisplacementView />
      <BearingAssemblyWindow />

      {/* Base shear total summary overlay */}
      <BaseShearSummary />
    </div>
  );
}
