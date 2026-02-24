import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Grid } from '@react-three/drei';
import { useDisplayStore } from '../../stores/displayStore';
import { StructuralModel3D } from './StructuralModel3D';
import { BearingDisplacementView } from './BearingDisplacementView';
import { SceneEnvironment } from './SceneEnvironment';

function SceneContent() {
  const showGrid = useDisplayStore((state) => state.showGrid);
  const showAxes = useDisplayStore((state) => state.showAxes);
  const environment = useDisplayStore((state) => state.environment);

  return (
    <>
      {/* Environment preset — provides background, lighting, ground treatment */}
      <SceneEnvironment environment={environment} />

      {/* Camera controls */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.1}
        minDistance={50}
        maxDistance={5000}
        target={[288, 216, 0]}
      />

      {/* Orientation gizmo */}
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="white" />
      </GizmoHelper>

      {/* User-toggled grid overlay (supplements environment ground treatment) */}
      {/* Blueprint environment provides its own grid, so skip this one there */}
      {showGrid && environment !== 'blueprint' && (
        <Grid
          args={[2000, 2000]}
          cellSize={48}
          cellThickness={0.5}
          cellColor="#374151"
          sectionSize={288}
          sectionThickness={1}
          sectionColor="#4b5563"
          fadeDistance={3000}
          fadeStrength={1}
          followCamera={false}
          position={[288, 0, 0]}
        />
      )}

      {/* Axes helper */}
      {showAxes && <axesHelper args={[100]} />}

      {/* Structural model */}
      <StructuralModel3D />
    </>
  );
}

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
          far: 10000,
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
