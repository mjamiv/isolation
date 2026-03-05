import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { computeTfpStageOffsets } from './tfpKinematics';
import { toViewerTranslation, useActiveDisplacements } from './useActiveDisplacements';

function BearingAssembly({
  relDx,
  relDy,
  relDz,
  radius,
  gap,
  plateThickness,
}: {
  relDx: number;
  relDy: number;
  relDz: number;
  radius: number;
  gap: number;
  plateThickness: number;
}) {
  const [s1x, s1z] = useMemo(
    () => computeTfpStageOffsets(relDx, relDz, [radius * 0.5, radius * 0.5, radius * 0.6]).slider1,
    [relDx, relDz, radius],
  );
  const [s2x, s2z] = useMemo(
    () => computeTfpStageOffsets(relDx, relDz, [radius * 0.5, radius * 0.5, radius * 0.6]).slider2,
    [relDx, relDz, radius],
  );

  return (
    <group>
      <ambientLight intensity={0.8} />
      <directionalLight position={[90, 160, 90]} intensity={0.9} />

      <mesh position={[0, -plateThickness * 1.8, 0]}>
        <cylinderGeometry args={[radius * 0.94, radius * 1.0, plateThickness * 2.2, 32]} />
        <meshStandardMaterial color="#57534e" metalness={0.4} roughness={0.7} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[radius, radius, plateThickness, 32]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.75} roughness={0.25} />
      </mesh>
      <mesh position={[0, plateThickness * 0.85, 0]}>
        <cylinderGeometry args={[radius * 0.8, radius * 0.35, plateThickness * 0.9, 24]} />
        <meshStandardMaterial color="#78716c" metalness={0.45} roughness={0.55} />
      </mesh>

      <mesh position={[s1x, gap * 0.35, s1z]}>
        <cylinderGeometry args={[radius * 0.22, radius * 0.22, plateThickness * 1.1, 24]} />
        <meshStandardMaterial color="#a8a29e" metalness={0.25} roughness={0.3} />
      </mesh>
      <mesh position={[s2x, gap * 0.56, s2z]}>
        <cylinderGeometry args={[radius * 0.32, radius * 0.32, plateThickness * 1.05, 24]} />
        <meshStandardMaterial color="#d6d3d1" metalness={0.2} roughness={0.35} />
      </mesh>

      <group position={[relDx, gap + relDy, relDz]}>
        <mesh>
          <cylinderGeometry args={[radius, radius, plateThickness, 32]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.75} roughness={0.25} />
        </mesh>
        <mesh position={[0, -plateThickness * 0.85, 0]}>
          <cylinderGeometry args={[radius * 0.35, radius * 0.8, plateThickness * 0.9, 24]} />
          <meshStandardMaterial color="#78716c" metalness={0.45} roughness={0.55} />
        </mesh>
      </group>

      <gridHelper args={[radius * 8, 10, '#334155', '#1f2937']} position={[0, -radius * 1.5, 0]} />
    </group>
  );
}

export function BearingAssemblyWindow() {
  const bearings = useModelStore((s) => s.bearings);
  const nodes = useModelStore((s) => s.nodes);
  const selectedBearingIds = useDisplayStore((s) => s.selectedBearingIds);
  const scaleFactor = useDisplayStore((s) => s.scaleFactor);
  const bearingVerticalScale = useDisplayStore((s) => s.bearingVerticalScale);
  const showBearingDisplacement = useDisplayStore((s) => s.showBearingDisplacement);
  const currentTimeStep = useAnalysisStore((s) => s.currentTimeStep);
  const { nodeDisplacements, zUpData } = useActiveDisplacements();

  const bearingList = useMemo(() => Array.from(bearings.values()), [bearings]);
  const [collapsed, setCollapsed] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    const firstSelected = selectedBearingIds.values().next().value as number | undefined;
    if (firstSelected == null) return;
    const idx = bearingList.findIndex((b) => b.id === firstSelected);
    if (idx >= 0) setSelectedIdx(idx);
  }, [selectedBearingIds, bearingList]);

  useEffect(() => {
    if (selectedIdx >= bearingList.length && bearingList.length > 0) {
      setSelectedIdx(bearingList.length - 1);
    }
  }, [selectedIdx, bearingList.length]);

  const bearing = bearingList[selectedIdx];
  if (!showBearingDisplacement || !bearing) return null;

  const nodeI = nodes.get(bearing.nodeI);
  const nodeJ = nodes.get(bearing.nodeJ);
  if (!nodeI || !nodeJ) return null;

  const is2DFrame = Math.abs(nodeI.z) < 1e-3 && Math.abs(nodeJ.z) < 1e-3;
  const dispI = toViewerTranslation(
    nodeDisplacements?.[bearing.nodeI] ?? nodeDisplacements?.[String(bearing.nodeI)],
    scaleFactor,
    is2DFrame,
    zUpData,
  );
  const dispJ = toViewerTranslation(
    nodeDisplacements?.[bearing.nodeJ] ?? nodeDisplacements?.[String(bearing.nodeJ)],
    scaleFactor,
    is2DFrame,
    zUpData,
  );

  const relDx = nodeJ.x + dispJ[0] - (nodeI.x + dispI[0]);
  const relDy = nodeJ.y + dispJ[1] - (nodeI.y + dispI[1]);
  const relDz = nodeJ.z + dispJ[2] - (nodeI.z + dispI[2]);
  const maxDispCap = Math.max(...bearing.dispCapacities, 0.01);
  const radius = Math.min(Math.max(maxDispCap * 1.1, 12), 36);
  const plateThickness = Math.min(Math.max(radius * 0.14, 1.2), 4.0);
  const gap = Math.max(4, Math.min(16, radius * 0.5 * bearingVerticalScale));

  return (
    <div
      className="absolute bottom-3 left-3 z-10 overflow-hidden rounded-lg"
      style={{
        width: 250,
        backgroundColor: 'rgba(17, 17, 17, 0.92)',
        border: '1px solid rgba(212, 175, 55, 0.35)',
      }}
    >
      <div
        className="flex cursor-pointer items-center justify-between px-2 py-1 select-none"
        style={{ borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.08)' }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-300">
          Bearing Assembly
        </span>
        <span className="text-[10px] text-gray-500">{collapsed ? '\u25B2' : '\u25BC'}</span>
      </div>
      {!collapsed && (
        <>
          {bearingList.length > 1 && (
            <div
              className="flex items-center justify-center gap-2 py-1"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <button
                type="button"
                onClick={() =>
                  setSelectedIdx((i) => (i - 1 + bearingList.length) % bearingList.length)
                }
                className="px-1 text-[10px] text-gray-400 hover:text-gray-200"
              >
                &lt;
              </button>
              <span className="min-w-[90px] text-center font-mono text-[9px] text-gray-300">
                Bearing {bearing.id} ({selectedIdx + 1}/{bearingList.length})
              </span>
              <button
                type="button"
                onClick={() => setSelectedIdx((i) => (i + 1) % bearingList.length)}
                className="px-1 text-[10px] text-gray-400 hover:text-gray-200"
              >
                &gt;
              </button>
            </div>
          )}
          <div className="px-1 pt-1">
            <div className="h-[180px] w-full rounded bg-black/30">
              <Canvas camera={{ position: [95, 75, 95], fov: 35 }}>
                <BearingAssembly
                  relDx={relDx}
                  relDy={relDy}
                  relDz={relDz}
                  radius={radius}
                  gap={gap}
                  plateThickness={plateThickness}
                />
                <OrbitControls
                  enablePan={false}
                  minDistance={radius * 2}
                  maxDistance={radius * 10}
                  target={[0, gap * 0.45, 0]}
                />
              </Canvas>
            </div>
          </div>
          <div className="px-2 py-1 text-[8px] text-gray-400">
            Step {currentTimeStep} | dX {relDx.toFixed(3)} dY {relDy.toFixed(3)} dZ{' '}
            {relDz.toFixed(3)}
          </div>
        </>
      )}
    </div>
  );
}
