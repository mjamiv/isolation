/**
 * Industry-grade 3D Triple Friction Pendulum (TFP) bearing visualization.
 *
 * Renders each bearing as a detailed assembly:
 *   - Bottom housing plate with concave dish and PTFE liner ring
 *   - Articulated slider (moves during time-history playback)
 *   - Top housing plate with inverted concave dish
 *   - Foundation pedestal beneath
 *   - Rim flanges on both plates
 *   - Orbit trail showing displacement history
 */

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
  extractNodeViewerDisplacement,
} from './tfpKinematics';

// ── Color palette ────────────────────────────────────────────────────
const PLATE_COLOR = '#a8a9ad'; // brushed stainless
const PLATE_SELECTED = '#fbbf24'; // gold highlight
const DISH_COLOR = '#78716c'; // stone-500 concave surface
const PTFE_COLOR = '#e7e5e4'; // stone-200 PTFE liner
const SLIDER_COLOR = '#d6d3d1'; // stone-300 articulated slider
const SLIDER_CORE = '#a8a29e'; // stone-400 inner slider
const PEDESTAL_COLOR = '#57534e'; // stone-600 foundation block
const RIM_COLOR = '#6b7280'; // gray-500 rim flange
const ORBIT_FADED = '#f59e0b';
const ORBIT_ACTIVE = '#facc15';

// ── Geometry constants ───────────────────────────────────────────────
const SEG_HI = 36; // cylinder segments for smooth look
const SEG_LO = 24;

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

  const currentStep = useMemo(() => {
    if (!thResults || thResults.timeSteps.length === 0) return undefined;
    const clamped = Math.min(Math.max(currentTimeStep, 0), thResults.timeSteps.length - 1);
    return thResults.timeSteps[clamped];
  }, [thResults, currentTimeStep]);

  const currentOffsetsByBearingId = useMemo(() => {
    const map = new Map<number, ReturnType<typeof computeTfpStageOffsets>>();
    if (!currentStep) return map;

    for (const bearing of bearingArray) {
      const { dx, dz } = extractPlanDisplacement(currentStep, bearing.nodeI, bearing.nodeJ);
      map.set(bearing.id, computeTfpStageOffsets(dx, dz, bearing.dispCapacities));
    }
    return map;
  }, [currentStep, bearingArray]);

  const orbitByBearingId = useMemo(() => {
    const map = new Map<number, [number, number][]>();
    if (!showBearingDisplacement || !thResults || thResults.timeSteps.length === 0) return map;

    for (const bearing of bearingArray) {
      map.set(
        bearing.id,
        extractOrbitPoints(thResults.timeSteps, bearing.nodeI, bearing.nodeJ, 160),
      );
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

        // ── Displaced positions ──────────────────────────────────
        const dispI = extractNodeViewerDisplacement(currentStep, bearing.nodeI);
        const dispJ = extractNodeViewerDisplacement(currentStep, bearing.nodeJ);

        const baseX = nI.x + dispI.dx;
        const baseY = nI.y + dispI.dy;
        const baseZ = nI.z + dispI.dz;
        const topX = nJ.x + dispJ.dx;
        const topY = nJ.y + dispJ.dy;
        const topZ = nJ.z + dispJ.dz;

        const relX = topX - baseX;
        const relY = topY - baseY;
        const relZ = topZ - baseZ;

        // ── Sizing: scale to displacement capacity ───────────────
        const maxDispCap = Math.max(...bearing.dispCapacities, 0);
        const R = Math.min(Math.max(maxDispCap * 1.1, 12), 36); // outer radius
        const plate = Math.min(Math.max(R * 0.14, 1.2), 4.0); // plate thickness
        const gap = Math.max(4, Math.min(16, R * 0.5 * bearingVerticalScale)); // clear gap between plates
        const dishDepth = Math.max(1.5, Math.min(5, gap * 0.35)); // concave dish depth
        const rimH = plate * 0.45; // rim flange height
        const rimR = R * 1.06; // rim overhang radius
        const pedestalH = plate * 1.8; // foundation pedestal
        const sliderR1 = R * 0.22; // inner slider
        const sliderR2 = R * 0.32; // outer slider

        // ── Stage offsets for animated sliders ───────────────────
        const offsets =
          currentOffsetsByBearingId.get(bearing.id) ??
          computeTfpStageOffsets(0, 0, bearing.dispCapacities);
        const [s1X, s1Z] = offsets.slider1;
        const [s2X, s2Z] = offsets.slider2;

        // ── Selection state ──────────────────────────────────────
        const isSelected = selectedBearingIds.has(bearing.id);
        const plateColor = isSelected ? PLATE_SELECTED : PLATE_COLOR;
        const emissive = isSelected ? '#f59e0b' : '#000000';
        const emissiveI = isSelected ? 0.25 : 0;

        // ── Orbit trail ──────────────────────────────────────────
        const orbit = orbitByBearingId.get(bearing.id) ?? [];
        const orbitY = plate + dishDepth * 0.3;
        const orbitPts = orbit.map(([x, z]) => [x, orbitY, z] as [number, number, number]);
        const curOrbitIdx =
          showBearingDisplacement && orbitPts.length > 0 && totalSteps > 1
            ? Math.min(
                Math.round((currentTimeStep / (totalSteps - 1)) * (orbitPts.length - 1)),
                orbitPts.length - 1,
              )
            : -1;
        const trailStart = Math.max(0, curOrbitIdx - 36);
        const trailPts = curOrbitIdx > 0 ? orbitPts.slice(trailStart, curOrbitIdx + 1) : [];
        const curPt = curOrbitIdx >= 0 ? orbitPts[curOrbitIdx] : undefined;

        // Vertical layout (Y-up):
        // pedestal bottom sits below base node
        // bottom plate center at Y=0
        // dish on top of bottom plate
        // sliders in the gap
        // top plate at Y = gap
        // inverted dish below top plate

        return (
          <group
            key={bearing.id}
            position={[baseX, baseY, baseZ]}
            onClick={(e) => handleClick(bearing.id, e)}
          >
            {/* Invisible pick target */}
            <mesh position={[relX / 2, relY / 2, relZ / 2]}>
              <cylinderGeometry
                args={[R * 1.15, R * 1.15, Math.max(Math.abs(relY), gap) + 8, 12]}
              />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* ═══ BOTTOM ASSEMBLY (follows node I / foundation) ═══ */}
            <group>
              {/* Foundation pedestal */}
              <mesh position={[0, -(plate / 2 + pedestalH / 2), 0]}>
                <cylinderGeometry args={[R * 0.92, R * 0.96, pedestalH, SEG_HI]} />
                <meshStandardMaterial color={PEDESTAL_COLOR} metalness={0.4} roughness={0.7} />
              </mesh>

              {/* Bottom plate */}
              <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[R, R, plate, SEG_HI]} />
                <meshStandardMaterial
                  color={plateColor}
                  metalness={0.75}
                  roughness={0.25}
                  emissive={emissive}
                  emissiveIntensity={emissiveI}
                />
              </mesh>

              {/* Bottom rim flange */}
              <mesh position={[0, plate / 2 + rimH / 2, 0]}>
                <cylinderGeometry args={[rimR, rimR, rimH, SEG_HI]} />
                <meshStandardMaterial color={RIM_COLOR} metalness={0.6} roughness={0.4} />
              </mesh>

              {/* Concave dish (frustum: narrow top, wider bottom) */}
              <mesh position={[0, plate / 2 + rimH + dishDepth / 2, 0]}>
                <cylinderGeometry args={[R * 0.35, R * 0.85, dishDepth, SEG_LO]} />
                <meshStandardMaterial
                  color={DISH_COLOR}
                  metalness={0.5}
                  roughness={0.55}
                  side={2}
                />
              </mesh>

              {/* PTFE liner ring on dish surface */}
              <mesh position={[0, plate / 2 + rimH + dishDepth * 0.15, 0]}>
                <torusGeometry args={[R * 0.6, R * 0.04, 8, SEG_HI]} />
                <meshStandardMaterial color={PTFE_COLOR} metalness={0.15} roughness={0.3} />
              </mesh>
            </group>

            {/* ═══ ARTICULATED SLIDER (moves with displacement) ═══ */}
            <group>
              {/* Inner slider (stage 1) */}
              <mesh position={[s1X, plate / 2 + rimH + gap * 0.28, s1Z]}>
                <cylinderGeometry args={[sliderR1, sliderR1, plate * 1.2, SEG_LO]} />
                <meshStandardMaterial color={SLIDER_CORE} metalness={0.35} roughness={0.35} />
              </mesh>

              {/* Outer slider (stage 2) */}
              <mesh position={[s2X, plate / 2 + rimH + gap * 0.5, s2Z]}>
                <cylinderGeometry args={[sliderR2, sliderR2, plate * 1.1, SEG_LO]} />
                <meshStandardMaterial color={SLIDER_COLOR} metalness={0.3} roughness={0.3} />
              </mesh>

              {/* Central articulation sphere */}
              <mesh position={[(s1X + s2X) / 2, plate / 2 + rimH + gap * 0.39, (s1Z + s2Z) / 2]}>
                <sphereGeometry args={[sliderR1 * 0.7, 16, 12]} />
                <meshStandardMaterial color={PTFE_COLOR} metalness={0.2} roughness={0.25} />
              </mesh>
            </group>

            {/* ═══ TOP ASSEMBLY (follows node J / superstructure) ═══ */}
            <group position={[relX, relY, relZ]}>
              {/* Top plate */}
              <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[R, R, plate, SEG_HI]} />
                <meshStandardMaterial
                  color={plateColor}
                  metalness={0.75}
                  roughness={0.25}
                  emissive={emissive}
                  emissiveIntensity={emissiveI}
                />
              </mesh>

              {/* Top rim flange */}
              <mesh position={[0, -(plate / 2 + rimH / 2), 0]}>
                <cylinderGeometry args={[rimR, rimR, rimH, SEG_HI]} />
                <meshStandardMaterial color={RIM_COLOR} metalness={0.6} roughness={0.4} />
              </mesh>

              {/* Inverted concave dish (wider top, narrow bottom) */}
              <mesh position={[0, -(plate / 2 + rimH + dishDepth / 2), 0]}>
                <cylinderGeometry args={[R * 0.85, R * 0.35, dishDepth, SEG_LO]} />
                <meshStandardMaterial
                  color={DISH_COLOR}
                  metalness={0.5}
                  roughness={0.55}
                  side={2}
                />
              </mesh>

              {/* PTFE liner ring on top dish */}
              <mesh position={[0, -(plate / 2 + rimH + dishDepth * 0.85), 0]}>
                <torusGeometry args={[R * 0.6, R * 0.04, 8, SEG_HI]} />
                <meshStandardMaterial color={PTFE_COLOR} metalness={0.15} roughness={0.3} />
              </mesh>

              {/* Upper contact sphere */}
              <mesh position={[0, -(plate / 2 + rimH + gap * 0.3), 0]}>
                <sphereGeometry args={[sliderR1 * 0.55, 14, 10]} />
                <meshStandardMaterial color={SLIDER_COLOR} metalness={0.25} roughness={0.28} />
              </mesh>
            </group>

            {/* ═══ ORBIT TRAIL ═══ */}
            {showBearingDisplacement && orbitPts.length > 1 && (
              <>
                <Line
                  points={orbitPts}
                  color={ORBIT_FADED}
                  lineWidth={1.5}
                  transparent
                  opacity={0.18}
                />
                {trailPts.length > 1 && (
                  <Line
                    points={trailPts}
                    color={ORBIT_ACTIVE}
                    lineWidth={2.5}
                    transparent
                    opacity={0.92}
                  />
                )}
              </>
            )}

            {showBearingDisplacement && curPt && (
              <mesh position={curPt}>
                <sphereGeometry args={[R * 0.08, 14, 12]} />
                <meshStandardMaterial
                  color={ORBIT_ACTIVE}
                  emissive={ORBIT_ACTIVE}
                  emissiveIntensity={1.0}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
