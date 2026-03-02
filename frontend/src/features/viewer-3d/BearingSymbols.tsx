import { useMemo, useCallback } from 'react';
import { Line } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useComparisonStore } from '@/stores/comparisonStore';
import type { TimeHistoryResults } from '@/types/analysis';
import {
  computeTfpStageOffsets,
  extractOrbitPoints,
  extractPlanDisplacement,
} from './tfpKinematics';

const HOUSING_COLOR = '#9ca3af';
const HOUSING_SELECTED_COLOR = '#fbbf24';
const TRACK_COLOR = '#6b7280';
const SLIDER_COLOR = '#d1d5db';
const SLIDER_ACCENT = '#f5f5f4';
const ORBIT_FADED = '#f59e0b';
const ORBIT_ACTIVE = '#facc15';

function useActiveTimeHistory(): TimeHistoryResults | null {
  const results = useAnalysisStore((s) => s.results);
  const comparisonType = useComparisonStore((s) => s.comparisonType);
  const comparisonIsolated = useComparisonStore((s) => s.isolated);

  if (comparisonType === 'time_history' && comparisonIsolated?.timeHistoryResults) {
    return comparisonIsolated.timeHistoryResults;
  }
  if (results?.type === 'time_history' && results.results) {
    return results.results as TimeHistoryResults;
  }
  return null;
}

export function BearingSymbols() {
  const bearings = useModelStore((s) => s.bearings);
  const nodes = useModelStore((s) => s.nodes);
  const selectedBearingIds = useDisplayStore((s) => s.selectedBearingIds);
  const selectBearing = useDisplayStore((s) => s.selectBearing);
  const showBearingDisplacement = useDisplayStore((s) => s.showBearingDisplacement);
  const bearingVerticalScale = useDisplayStore((s) => s.bearingVerticalScale);
  const currentTimeStep = useAnalysisStore((s) => s.currentTimeStep);
  const thResults = useActiveTimeHistory();

  const bearingArray = useMemo(() => Array.from(bearings.values()), [bearings]);

  const currentOffsetsByBearingId = useMemo(() => {
    const map = new Map<number, ReturnType<typeof computeTfpStageOffsets>>();
    if (!thResults || thResults.timeSteps.length === 0) return map;

    const clampedStep = Math.min(Math.max(currentTimeStep, 0), thResults.timeSteps.length - 1);
    const step = thResults.timeSteps[clampedStep];
    for (const bearing of bearingArray) {
      const { dx, dz } = extractPlanDisplacement(step, bearing.nodeI, bearing.nodeJ);
      map.set(bearing.id, computeTfpStageOffsets(dx, dz, bearing.dispCapacities));
    }
    return map;
  }, [thResults, currentTimeStep, bearingArray]);

  const orbitByBearingId = useMemo(() => {
    const map = new Map<number, [number, number][]>();
    if (!showBearingDisplacement || !thResults || thResults.timeSteps.length === 0) return map;

    for (const bearing of bearingArray) {
      const orbit = extractOrbitPoints(thResults.timeSteps, bearing.nodeI, bearing.nodeJ, 120);
      // Keep displayed displacement synchronized with the assembly's top-stage
      // cumulative travel; only the vertical draw location is moved to the
      // lower concave for visibility.
      const displayOrbit = orbit.map(([dx, dz]) => {
        const offsets = computeTfpStageOffsets(dx, dz, bearing.dispCapacities);
        return offsets.slider3;
      });
      map.set(bearing.id, displayOrbit);
    }
    return map;
  }, [showBearingDisplacement, thResults, bearingArray]);

  const handleClick = useCallback(
    (bearingId: number, e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      selectBearing(bearingId, e.nativeEvent.shiftKey);
    },
    [selectBearing],
  );

  if (bearingArray.length === 0) return null;

  const totalSteps = thResults?.timeSteps.length ?? 0;

  return (
    <group>
      {bearingArray.map((bearing) => {
        const nI = nodes.get(bearing.nodeI);
        const nJ = nodes.get(bearing.nodeJ);
        if (!nI || !nJ) return null;

        const mx = (nI.x + nJ.x) / 2;
        const my = (nI.y + nJ.y) / 2;
        const mz = (nI.z + nJ.z) / 2;

        const span = Math.hypot(nJ.x - nI.x, nJ.y - nI.y, nJ.z - nI.z);
        const baseHousingHeight = Math.min(Math.max(span * 0.9, 6), 16);
        const maxDispCap = Math.max(...bearing.dispCapacities, 0);
        const outerRadius = Math.min(Math.max(maxDispCap * 0.9, 8), 26);
        const plateThickness = Math.max(0.8, baseHousingHeight * 0.12);
        const clearGap = Math.max(
          3.0,
          (baseHousingHeight - plateThickness * 2) * bearingVerticalScale,
        );
        const housingHeight = clearGap + plateThickness * 2;
        const bowlDepth = Math.max(1.2, clearGap * 0.25);

        const offsets =
          currentOffsetsByBearingId.get(bearing.id) ??
          computeTfpStageOffsets(0, 0, bearing.dispCapacities);
        const [slider1X, slider1Z] = offsets.slider1;
        const [slider2X, slider2Z] = offsets.slider2;
        const [slider3X, slider3Z] = offsets.slider3;

        const isSelected = selectedBearingIds.has(bearing.id);
        const housingColor = isSelected ? HOUSING_SELECTED_COLOR : HOUSING_COLOR;
        const emissiveColor = isSelected ? '#f59e0b' : '#000000';

        const orbit = orbitByBearingId.get(bearing.id) ?? [];
        const orbitHeight = -clearGap / 2 + bowlDepth * 0.55;
        const orbitPoints = orbit.map(([x, z]) => [x, orbitHeight, z] as [number, number, number]);
        const currentOrbitIndex =
          showBearingDisplacement && orbitPoints.length > 0 && totalSteps > 1
            ? Math.min(
                Math.round((currentTimeStep / (totalSteps - 1)) * (orbitPoints.length - 1)),
                orbitPoints.length - 1,
              )
            : -1;
        const trailStart = Math.max(0, currentOrbitIndex - 28);
        const trailPoints =
          currentOrbitIndex > 0 ? orbitPoints.slice(trailStart, currentOrbitIndex + 1) : [];
        const currentPoint = currentOrbitIndex >= 0 ? orbitPoints[currentOrbitIndex] : undefined;

        return (
          <group
            key={bearing.id}
            position={[mx, my, mz]}
            onClick={(e) => handleClick(bearing.id, e)}
          >
            {/* Enlarged transparent hit target keeps bearing selection easy. */}
            <mesh>
              <cylinderGeometry
                args={[outerRadius * 1.08, outerRadius * 1.08, housingHeight * 1.25, 16]}
              />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* Outer housing shell */}
            <mesh>
              <cylinderGeometry args={[outerRadius, outerRadius, housingHeight, 28, 1, true]} />
              <meshStandardMaterial
                color={housingColor}
                metalness={0.82}
                roughness={0.35}
                emissive={emissiveColor}
                emissiveIntensity={0.22}
                transparent
                opacity={0.28}
              />
            </mesh>

            {/* Bottom cap */}
            <mesh position={[0, -housingHeight / 2 + plateThickness / 2, 0]}>
              <cylinderGeometry args={[outerRadius, outerRadius, plateThickness, 30]} />
              <meshStandardMaterial color={housingColor} metalness={0.8} roughness={0.3} />
            </mesh>

            {/* Lower concave track */}
            <mesh position={[0, -clearGap / 2 + bowlDepth / 2, 0]}>
              <cylinderGeometry args={[outerRadius * 0.42, outerRadius * 0.88, bowlDepth, 28]} />
              <meshStandardMaterial color={TRACK_COLOR} metalness={0.58} roughness={0.52} />
            </mesh>

            {/* Stage 1 slider */}
            <mesh position={[slider1X, -clearGap * 0.22, slider1Z]}>
              <cylinderGeometry
                args={[outerRadius * 0.2, outerRadius * 0.2, plateThickness * 1.1, 24]}
              />
              <meshStandardMaterial color={SLIDER_COLOR} metalness={0.24} roughness={0.28} />
            </mesh>

            {/* Stage 2 articulating plate */}
            <mesh position={[slider2X, 0, slider2Z]}>
              <cylinderGeometry
                args={[outerRadius * 0.28, outerRadius * 0.28, plateThickness, 24]}
              />
              <meshStandardMaterial color={SLIDER_ACCENT} metalness={0.28} roughness={0.26} />
            </mesh>

            {/* Upper assembly follows top-stage displacement (slider3). */}
            <group position={[slider3X, 0, slider3Z]}>
              <mesh position={[0, housingHeight / 2 - plateThickness / 2, 0]}>
                <cylinderGeometry args={[outerRadius, outerRadius, plateThickness, 30]} />
                <meshStandardMaterial color={housingColor} metalness={0.8} roughness={0.3} />
              </mesh>
              <mesh position={[0, clearGap / 2 - bowlDepth / 2, 0]}>
                <cylinderGeometry args={[outerRadius * 0.88, outerRadius * 0.42, bowlDepth, 28]} />
                <meshStandardMaterial color={TRACK_COLOR} metalness={0.58} roughness={0.52} />
              </mesh>
              <mesh position={[0, clearGap * 0.22, 0]}>
                <sphereGeometry args={[outerRadius * 0.16, 20, 16]} />
                <meshStandardMaterial color={SLIDER_COLOR} metalness={0.2} roughness={0.24} />
              </mesh>
              <mesh position={[0, clearGap / 2 - bowlDepth * 0.4, 0]}>
                <cylinderGeometry
                  args={[outerRadius * 0.22, outerRadius * 0.22, plateThickness * 0.75, 24]}
                />
                <meshStandardMaterial color={SLIDER_ACCENT} metalness={0.28} roughness={0.24} />
              </mesh>
            </group>

            {/* Orbit trace of top-plate displacement during playback. */}
            {showBearingDisplacement && orbitPoints.length > 1 && (
              <>
                <Line
                  points={orbitPoints}
                  color={ORBIT_FADED}
                  lineWidth={1}
                  transparent
                  opacity={0.2}
                />
                {trailPoints.length > 1 && (
                  <Line
                    points={trailPoints}
                    color={ORBIT_ACTIVE}
                    lineWidth={2}
                    transparent
                    opacity={0.95}
                  />
                )}
              </>
            )}

            {showBearingDisplacement && currentPoint && (
              <mesh position={currentPoint}>
                <sphereGeometry args={[outerRadius * 0.07, 14, 12]} />
                <meshStandardMaterial
                  color={ORBIT_ACTIVE}
                  emissive={ORBIT_ACTIVE}
                  emissiveIntensity={0.9}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
