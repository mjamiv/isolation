/**
 * Physically accurate 3D Triple Friction Pendulum (TFP) bearing visualization.
 *
 * Renders all five real TFP components:
 *   1. Bottom concave plate (fixed to foundation) — LatheGeometry parabolic dish
 *   2. Lower slider (rides on bottom concave surface — surface 1)
 *   3. Inner articulated core (connecting sliders — surface 2)
 *   4. Upper slider (rides on top concave surface — surface 3)
 *   5. Top concave plate (fixed to superstructure) — inverted LatheGeometry dish
 *
 * Orbit trail traces displacement path on the bottom dish's concave surface.
 */

import { useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useComparisonStore } from '@/stores/comparisonStore';
import type { TimeHistoryResults } from '@/types/analysis';
import type { TFPBearing } from '@/types/storeModel';
import {
  computeTfpStageOffsets,
  extractOrbitPoints,
  extractPlanDisplacement,
  extractNodeViewerDisplacement,
} from './tfpKinematics';
import type { TfpStageOffsets } from './tfpKinematics';

// ── PBR color palette ────────────────────────────────────────────────
const PLATE_COLOR = '#b0b1b5'; // brushed stainless steel
const PLATE_SELECTED = '#fbbf24'; // gold highlight
const DISH_COLOR = '#7a756f'; // warm steel concave interior
const PTFE_COLOR = '#e8e6e3'; // PTFE sliding surface
const SLIDER_LOWER = '#c8c4c0'; // lower slider shell
const SLIDER_INNER = '#8a8580'; // inner core body
const SLIDER_UPPER = '#bab6b0'; // upper slider shell
const PEDESTAL_COLOR = '#57534e'; // foundation block
const RIM_COLOR = '#6b7280'; // rim flange
const ORBIT_FADED = '#f59e0b'; // full orbit (amber)
const ORBIT_ACTIVE = '#facc15'; // active trail (yellow)

// ── Geometry resolution ──────────────────────────────────────────────
const SEG = 48; // radial segments for smooth curves
const LATHE_PTS = 28; // profile points for dish curvature

// ── Dish surface helpers ─────────────────────────────────────────────

/** Y-offset on a parabolic concave dish at given radial distance. */
function dishSurfaceY(r: number, dishR: number, depth: number): number {
  const t = Math.min(r / Math.max(dishR, 0.001), 1);
  return depth * t * t;
}

/** Create a concave dish LatheGeometry (parabolic profile, open at center). */
function makeDishGeometry(radius: number, depth: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= LATHE_PTS; i++) {
    const t = i / LATHE_PTS;
    const r = t * radius;
    const y = depth * t * t;
    pts.push(new THREE.Vector2(r, y));
  }
  // Small lip at rim for visual thickness
  pts.push(new THREE.Vector2(radius, depth + depth * 0.06));
  return new THREE.LatheGeometry(pts, SEG);
}

// ── Active time-history helper ───────────────────────────────────────

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

// ── Single bearing sub-component (allows hooks for memoized geometry) ──

interface SingleBearingProps {
  bearing: TFPBearing;
  basePos: [number, number, number];
  rel: [number, number, number];
  offsets: TfpStageOffsets;
  isSelected: boolean;
  orbit: [number, number][];
  totalSteps: number;
  currentTimeStep: number;
  showOrbit: boolean;
  bearingVerticalScale: number;
  onClick: (id: number, e: ThreeEvent<MouseEvent>) => void;
}

function SingleBearing({
  bearing,
  basePos,
  rel,
  offsets,
  isSelected,
  orbit,
  totalSteps,
  currentTimeStep,
  showOrbit,
  bearingVerticalScale,
  onClick,
}: SingleBearingProps) {
  const [baseX, baseY, baseZ] = basePos;
  const [relX, relY, relZ] = rel;

  // ── Sizing: scale to displacement capacity ─────────────────────────
  const maxDispCap = Math.max(...bearing.dispCapacities, 0);
  const R = Math.min(Math.max(maxDispCap * 1.1, 12), 36);
  const plateThick = Math.min(Math.max(R * 0.14, 1.2), 4.0);
  const gap = Math.max(4, Math.min(16, R * 0.5 * bearingVerticalScale));
  const dishDepth = Math.max(1.5, Math.min(5, gap * 0.35));
  const dishR = R * 0.88;
  const rimH = plateThick * 0.45;
  const rimR = R * 1.06;
  const pedestalH = plateThick * 1.8;
  const sliderR = R * 0.26;
  const coreR = R * 0.17;
  const sliderH = plateThick * 0.85;

  // ── Concave dish geometry (shared between top and bottom) ──────────
  const dishGeo = useMemo(() => makeDishGeometry(dishR, dishDepth), [dishR, dishDepth]);

  // ── Stage offsets for slider animation ─────────────────────────────
  const [s1X, s1Z] = offsets.slider1;
  const [s2X, s2Z] = offsets.slider2;
  const s3Mag = offsets.stageTravel[2];
  const [dirX, dirZ] = offsets.direction;

  // Lower slider rides on bottom dish surface
  const s1Mag = Math.hypot(s1X, s1Z);
  const dishBase = plateThick / 2 + rimH;
  const lowerY = dishBase + dishSurfaceY(s1Mag, dishR, dishDepth) + sliderH / 2;

  // Inner core at vertical midpoint, horizontal midpoint of slider1 <-> slider2
  const coreX = (s1X + s2X) / 2;
  const coreZ = (s1Z + s2Z) / 2;
  const coreY = relY / 2;

  // Upper slider hangs from top dish, offset by stage-3 travel
  const upperOffX = -dirX * s3Mag;
  const upperOffZ = -dirZ * s3Mag;
  const upperMag = Math.hypot(upperOffX, upperOffZ);
  const upperRelY = -(
    plateThick / 2 +
    rimH +
    dishSurfaceY(upperMag, dishR, dishDepth) +
    sliderH / 2
  );

  // ── Selection visuals ──────────────────────────────────────────────
  const plateColor = isSelected ? PLATE_SELECTED : PLATE_COLOR;
  const emissive = isSelected ? '#f59e0b' : '#000000';
  const emissiveI = isSelected ? 0.25 : 0;

  // ── Orbit trail mapped onto bottom dish surface ────────────────────
  const orbitPts = useMemo(
    () =>
      orbit.map(([x, z]) => {
        const r = Math.hypot(x, z);
        const y = dishBase + dishSurfaceY(r, dishR, dishDepth) + 0.12;
        return [x, y, z] as [number, number, number];
      }),
    [orbit, dishBase, dishR, dishDepth],
  );

  const curOrbitIdx =
    showOrbit && orbitPts.length > 0 && totalSteps > 1
      ? Math.min(
          Math.round((currentTimeStep / (totalSteps - 1)) * (orbitPts.length - 1)),
          orbitPts.length - 1,
        )
      : -1;
  const trailStart = Math.max(0, curOrbitIdx - 36);
  const trailPts = curOrbitIdx > 0 ? orbitPts.slice(trailStart, curOrbitIdx + 1) : [];
  const curPt = curOrbitIdx >= 0 ? orbitPts[curOrbitIdx] : undefined;

  return (
    <group position={[baseX, baseY, baseZ]} onClick={(e) => onClick(bearing.id, e)}>
      {/* Invisible pick target */}
      <mesh position={[relX / 2, relY / 2, relZ / 2]}>
        <cylinderGeometry args={[R * 1.15, R * 1.15, Math.max(Math.abs(relY), gap) + 8, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* ═══ 1. BOTTOM CONCAVE PLATE (fixed to foundation) ═══ */}
      <group>
        {/* Foundation pedestal */}
        <mesh position={[0, -(plateThick / 2 + pedestalH / 2), 0]}>
          <cylinderGeometry args={[R * 0.92, R * 0.96, pedestalH, SEG]} />
          <meshStandardMaterial color={PEDESTAL_COLOR} metalness={0.4} roughness={0.7} />
        </mesh>

        {/* Bottom plate */}
        <mesh>
          <cylinderGeometry args={[R, R, plateThick, SEG]} />
          <meshStandardMaterial
            color={plateColor}
            metalness={0.82}
            roughness={0.18}
            emissive={emissive}
            emissiveIntensity={emissiveI}
            envMapIntensity={1.2}
          />
        </mesh>

        {/* Bottom rim flange */}
        <mesh position={[0, plateThick / 2 + rimH / 2, 0]}>
          <cylinderGeometry args={[rimR, rimR, rimH, SEG]} />
          <meshStandardMaterial
            color={RIM_COLOR}
            metalness={0.65}
            roughness={0.35}
            envMapIntensity={1.0}
          />
        </mesh>

        {/* Bottom concave dish (LatheGeometry, parabolic profile) */}
        <mesh position={[0, dishBase, 0]} geometry={dishGeo}>
          <meshStandardMaterial
            color={DISH_COLOR}
            metalness={0.55}
            roughness={0.4}
            side={THREE.DoubleSide}
            envMapIntensity={0.9}
          />
        </mesh>

        {/* PTFE liner ring on bottom dish */}
        <mesh position={[0, dishBase + dishDepth * 0.3, 0]}>
          <torusGeometry args={[dishR * 0.55, R * 0.03, 8, SEG]} />
          <meshStandardMaterial color={PTFE_COLOR} metalness={0.12} roughness={0.25} />
        </mesh>
      </group>

      {/* ═══ 2. LOWER SLIDER (surface 1, rides on bottom dish) ═══ */}
      <mesh position={[s1X, lowerY, s1Z]}>
        <cylinderGeometry args={[sliderR, sliderR * 1.08, sliderH, SEG]} />
        <meshStandardMaterial
          color={SLIDER_LOWER}
          metalness={0.5}
          roughness={0.28}
          envMapIntensity={0.85}
        />
      </mesh>

      {/* ═══ 3. INNER ARTICULATED CORE (surface 2, connects sliders) ═══ */}
      <group position={[coreX, coreY, coreZ]}>
        <mesh>
          <cylinderGeometry args={[coreR, coreR, sliderH * 1.5, SEG]} />
          <meshStandardMaterial
            color={SLIDER_INNER}
            metalness={0.5}
            roughness={0.35}
            envMapIntensity={0.7}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[coreR * 1.2, 24, 18]} />
          <meshStandardMaterial
            color={PTFE_COLOR}
            metalness={0.2}
            roughness={0.22}
            envMapIntensity={1.1}
          />
        </mesh>
      </group>

      {/* ═══ 4. UPPER SLIDER (surface 3, rides on top dish) ═══ */}
      <group position={[relX, relY, relZ]}>
        <mesh position={[upperOffX, upperRelY, upperOffZ]}>
          <cylinderGeometry args={[sliderR * 1.08, sliderR, sliderH, SEG]} />
          <meshStandardMaterial
            color={SLIDER_UPPER}
            metalness={0.5}
            roughness={0.28}
            envMapIntensity={0.85}
          />
        </mesh>
      </group>

      {/* ═══ 5. TOP CONCAVE PLATE (fixed to superstructure) ═══ */}
      <group position={[relX, relY, relZ]}>
        {/* Top plate */}
        <mesh>
          <cylinderGeometry args={[R, R, plateThick, SEG]} />
          <meshStandardMaterial
            color={plateColor}
            metalness={0.82}
            roughness={0.18}
            emissive={emissive}
            emissiveIntensity={emissiveI}
            envMapIntensity={1.2}
          />
        </mesh>

        {/* Top rim flange */}
        <mesh position={[0, -(plateThick / 2 + rimH / 2), 0]}>
          <cylinderGeometry args={[rimR, rimR, rimH, SEG]} />
          <meshStandardMaterial
            color={RIM_COLOR}
            metalness={0.65}
            roughness={0.35}
            envMapIntensity={1.0}
          />
        </mesh>

        {/* Top concave dish (inverted via rotation) */}
        <mesh
          position={[0, -(plateThick / 2 + rimH), 0]}
          rotation={[Math.PI, 0, 0]}
          geometry={dishGeo}
        >
          <meshStandardMaterial
            color={DISH_COLOR}
            metalness={0.55}
            roughness={0.4}
            side={THREE.DoubleSide}
            envMapIntensity={0.9}
          />
        </mesh>

        {/* PTFE liner ring on top dish */}
        <mesh position={[0, -(plateThick / 2 + rimH + dishDepth * 0.7), 0]}>
          <torusGeometry args={[dishR * 0.55, R * 0.03, 8, SEG]} />
          <meshStandardMaterial color={PTFE_COLOR} metalness={0.12} roughness={0.25} />
        </mesh>
      </group>

      {/* ═══ ORBIT TRAIL (on bottom dish surface) ═══ */}
      {showOrbit && orbitPts.length > 1 && (
        <>
          <Line points={orbitPts} color={ORBIT_FADED} lineWidth={1.5} transparent opacity={0.18} />
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
      {showOrbit && curPt && (
        <mesh position={curPt}>
          <sphereGeometry args={[R * 0.07, 16, 12]} />
          <meshStandardMaterial
            color={ORBIT_ACTIVE}
            emissive={ORBIT_ACTIVE}
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
}

// ── Main export ──────────────────────────────────────────────────────

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
    const map = new Map<number, TfpStageOffsets>();
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

        const dispI = extractNodeViewerDisplacement(currentStep, bearing.nodeI);
        const dispJ = extractNodeViewerDisplacement(currentStep, bearing.nodeJ);

        const baseX = nI.x + dispI.dx;
        const baseY = nI.y + dispI.dy;
        const baseZ = nI.z + dispI.dz;
        const relX = nJ.x + dispJ.dx - baseX;
        const relY = nJ.y + dispJ.dy - baseY;
        const relZ = nJ.z + dispJ.dz - baseZ;

        const offsets =
          currentOffsetsByBearingId.get(bearing.id) ??
          computeTfpStageOffsets(0, 0, bearing.dispCapacities);

        return (
          <SingleBearing
            key={bearing.id}
            bearing={bearing}
            basePos={[baseX, baseY, baseZ]}
            rel={[relX, relY, relZ]}
            offsets={offsets}
            isSelected={selectedBearingIds.has(bearing.id)}
            orbit={orbitByBearingId.get(bearing.id) ?? []}
            totalSteps={totalSteps}
            currentTimeStep={currentTimeStep}
            showOrbit={showBearingDisplacement}
            bearingVerticalScale={bearingVerticalScale}
            onClick={handleClick}
          />
        );
      })}
    </group>
  );
}
