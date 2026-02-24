/**
 * SceneEnvironment.tsx
 *
 * Provides 4 selectable environment presets for the 3D structural viewer.
 * Each preset defines background, lighting, ground treatment, and atmosphere
 * to present the gold/yellow structural model at industry-standard visual quality.
 *
 * Presets:
 *   - Studio:    Clean product-photography lighting, gradient backdrop, reflective floor
 *   - Outdoor:   Natural sky, soft shadows, sunlit ground plane
 *   - Dark:      Dramatic rim lighting, near-black backdrop, floating model
 *   - Blueprint: Navy-blue technical grid, even lighting, engineering aesthetic
 *
 * All environments are procedural — no external HDR files are loaded.
 * Compatible with frameloop="demand" via useThree().invalidate().
 */

import { useEffect, useRef, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Environment, Lightformer, ContactShadows, Grid, Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { EnvironmentPreset } from '../../stores/displayStore';

// ── Types ────────────────────────────────────────────────────────────────────

interface SceneEnvironmentProps {
  environment: EnvironmentPreset;
}

// ── Invalidation hook ────────────────────────────────────────────────────────
// Forces a re-render whenever the environment preset changes, since the Canvas
// uses frameloop="demand" and won't re-draw automatically.

function useInvalidateOnChange(dep: unknown) {
  const invalidate = useThree((state) => state.invalidate);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Small delay to let new elements mount before invalidating
    const id = requestAnimationFrame(() => invalidate());
    return () => cancelAnimationFrame(id);
  }, [dep, invalidate]);
}

// ── Background setter ────────────────────────────────────────────────────────
// Directly sets scene.background to a gradient texture so we avoid relying on
// CSS or Canvas alpha for the backdrop. Uses a vertical 2-stop gradient.

function SceneBackground({ topColor, bottomColor }: { topColor: string; bottomColor: string }) {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, topColor);
    gradient.addColorStop(1, bottomColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 512);
    const tex = new THREE.CanvasTexture(canvas);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  }, [topColor, bottomColor]);

  useEffect(() => {
    scene.background = texture;
    invalidate();
    return () => {
      scene.background = null;
    };
  }, [scene, texture, invalidate]);

  return null;
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

// ── Fog setter ───────────────────────────────────────────────────────────────

function SceneFog({ color, near, far }: { color: string; near: number; far: number }) {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    scene.fog = new THREE.Fog(color, near, far);
    invalidate();
    return () => {
      scene.fog = null;
    };
  }, [scene, color, near, far, invalidate]);

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUDIO ENVIRONMENT
// ═══════════════════════════════════════════════════════════════════════════════
// Clean, well-lit studio with soft directional lights. Neutral gradient from
// mid-gray at the top to charcoal at the bottom. ContactShadows provide a
// grounding plane. Environment with inline Lightformers gives soft reflections
// on the structural members without loading an external HDR.

function StudioEnvironment() {
  return (
    <>
      <SceneBackground topColor="#2d2d30" bottomColor="#18181b" />
      <SceneFog color="#18181b" near={3000} far={8000} />

      {/* Primary key light — warm, upper-right */}
      <directionalLight
        position={[600, 900, 400]}
        intensity={1.8}
        color="#fff5e6"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={5000}
        shadow-camera-near={10}
        shadow-camera-left={-1500}
        shadow-camera-right={1500}
        shadow-camera-top={1500}
        shadow-camera-bottom={-1500}
        shadow-bias={-0.001}
      />

      {/* Fill light — cooler, left side */}
      <directionalLight position={[-500, 500, -200]} intensity={0.5} color="#e0e8f0" />

      {/* Rim / back light — pushes edge highlights */}
      <directionalLight position={[-200, 300, -600]} intensity={0.6} color="#d4d4d8" />

      {/* Ambient base — low to preserve directionality */}
      <ambientLight intensity={0.35} color="#e8e8e8" />

      {/* Environment map from inline Lightformers for subtle reflections */}
      <Environment resolution={64} frames={1}>
        <Lightformer
          form="rect"
          intensity={2}
          position={[0, 5, -5]}
          scale={[10, 5, 1]}
          color="#f5f5f5"
        />
        <Lightformer
          form="rect"
          intensity={0.8}
          position={[-5, 3, 0]}
          rotation-y={Math.PI / 2}
          scale={[10, 5, 1]}
          color="#e8e0d0"
        />
        <Lightformer
          form="circle"
          intensity={1.2}
          position={[5, 5, 2]}
          scale={[3, 3, 1]}
          color="#fff8ee"
        />
      </Environment>

      {/* Ground plane — soft shadow catcher */}
      <ContactShadows
        position={[288, -1, 0]}
        opacity={0.4}
        scale={3000}
        blur={2.5}
        far={2000}
        resolution={512}
        color="#000000"
        frames={1}
      />

      {/* Reflective ground plane */}
      <mesh rotation-x={-Math.PI / 2} position={[288, -2, 0]} receiveShadow>
        <planeGeometry args={[4000, 4000]} />
        <meshStandardMaterial
          color="#1a1a1e"
          roughness={0.85}
          metalness={0.15}
          transparent
          opacity={0.6}
        />
      </mesh>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OUTDOOR ENVIRONMENT
// ═══════════════════════════════════════════════════════════════════════════════
// Natural daylight with a stylized Sky dome. Sunlight comes from a specific
// direction. Ground plane catches soft shadows. The overall feel is "structure
// sitting outdoors for context" — clean and readable, not photorealistic.

function OutdoorEnvironment() {
  return (
    <>
      {/* Sky dome — low turbidity for clean, stylized look */}
      <Sky
        distance={450000}
        sunPosition={[400, 600, 200]}
        inclination={0.52}
        azimuth={0.25}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
        rayleigh={0.5}
        turbidity={2}
      />

      <SceneFog color="#87a4c4" near={4000} far={10000} />

      {/* Sun — warm directional */}
      <directionalLight
        position={[400, 600, 200]}
        intensity={2.0}
        color="#fff0d4"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={5000}
        shadow-camera-near={10}
        shadow-camera-left={-1500}
        shadow-camera-right={1500}
        shadow-camera-top={1500}
        shadow-camera-bottom={-1500}
        shadow-bias={-0.001}
      />

      {/* Sky fill — cool blue bounce light */}
      <directionalLight position={[-300, 400, -400]} intensity={0.4} color="#a0c4e8" />

      {/* Hemisphere light for sky/ground ambient */}
      <hemisphereLight args={['#87ceeb', '#4a6741', 0.4]} />

      {/* Ambient base */}
      <ambientLight intensity={0.25} />

      {/* Environment for reflections */}
      <Environment resolution={64} frames={1}>
        <Lightformer
          form="rect"
          intensity={1.5}
          position={[0, 8, -3]}
          scale={[15, 8, 1]}
          color="#e8f0ff"
        />
        <Lightformer
          form="circle"
          intensity={2}
          position={[4, 6, 2]}
          scale={[4, 4, 1]}
          color="#fff5dd"
        />
      </Environment>

      {/* Ground shadow plane */}
      <ContactShadows
        position={[288, -1, 0]}
        opacity={0.5}
        scale={3000}
        blur={2}
        far={2000}
        resolution={512}
        color="#2a3a24"
        frames={1}
      />

      {/* Ground surface — subtle green-gray */}
      <mesh rotation-x={-Math.PI / 2} position={[288, -3, 0]} receiveShadow>
        <planeGeometry args={[6000, 6000]} />
        <meshStandardMaterial color="#5a6b52" roughness={0.95} metalness={0} />
      </mesh>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DARK ENVIRONMENT
// ═══════════════════════════════════════════════════════════════════════════════
// Deep, near-black backdrop with dramatic rim lighting. Minimal ambient keeps
// the model feeling like it's floating in a void. Gold/yellow members pop hard
// against the darkness. Ideal for presentations and hero screenshots.

function DarkEnvironment() {
  return (
    <>
      <SolidBackground color="#0a0a0a" />
      <SceneFog color="#0a0a0a" near={2500} far={6000} />

      {/* Subtle star field — adds depth without distraction */}
      <Stars radius={3000} depth={200} count={800} factor={6} saturation={0} fade speed={0} />

      {/* Strong rim light — upper back, creates edge highlights on gold members */}
      <directionalLight position={[-400, 500, -500]} intensity={1.2} color="#e0e0ff" />

      {/* Counter rim — opposite side, slightly warmer */}
      <directionalLight position={[500, 300, -400]} intensity={0.8} color="#fff0dd" />

      {/* Subtle front fill — very low to keep drama */}
      <directionalLight position={[200, 600, 400]} intensity={0.5} color="#ffffff" />

      {/* Minimal ambient — just enough to read geometry */}
      <ambientLight intensity={0.12} color="#c0c0d0" />

      {/* Environment — dark with bright accent formers for specular highlights */}
      <Environment resolution={64} frames={1}>
        {/* Thin bright strip for sharp specular on members */}
        <Lightformer
          form="rect"
          intensity={3}
          position={[0, 4, -6]}
          scale={[12, 0.5, 1]}
          color="#ffffff"
        />
        <Lightformer
          form="rect"
          intensity={1.5}
          position={[-6, 3, 0]}
          rotation-y={Math.PI / 2}
          scale={[8, 0.3, 1]}
          color="#d0d8ff"
        />
        {/* Warm accent */}
        <Lightformer
          form="circle"
          intensity={0.8}
          position={[4, 2, 3]}
          scale={[2, 2, 1]}
          color="#ffd080"
        />
      </Environment>

      {/* No ground plane — model floats. Only a very faint shadow hint */}
      <ContactShadows
        position={[288, -1, 0]}
        opacity={0.15}
        scale={2000}
        blur={3}
        far={1500}
        resolution={256}
        color="#000000"
        frames={1}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLUEPRINT ENVIRONMENT
// ═══════════════════════════════════════════════════════════════════════════════
// Engineering blueprint aesthetic: dark navy background, visible grid lines,
// even flat lighting that minimizes shadows. Clean and technical — feels like
// a CAD viewport or technical drawing come to life.

function BlueprintEnvironment() {
  return (
    <>
      <SolidBackground color="#0c1525" />

      {/* Even, shadowless lighting — no strong directionality */}
      <ambientLight intensity={0.6} color="#c8d8f0" />

      {/* Soft directional — provides just enough shape definition */}
      <directionalLight position={[400, 700, 400]} intensity={0.6} color="#dce8ff" />
      <directionalLight position={[-300, 500, -300]} intensity={0.4} color="#c0d0e8" />

      {/* Front fill to reduce shadow contrast */}
      <directionalLight position={[0, 200, 600]} intensity={0.3} color="#d0d8e8" />

      {/* Environment — cold blue tones for technical feel */}
      <Environment resolution={64} frames={1}>
        <Lightformer
          form="rect"
          intensity={1}
          position={[0, 5, -4]}
          scale={[15, 8, 1]}
          color="#c8d8f0"
        />
        <Lightformer
          form="rect"
          intensity={0.6}
          position={[5, 3, 2]}
          scale={[6, 4, 1]}
          color="#b0c0d8"
        />
      </Environment>

      {/* Blueprint grid — fine engineering grid with labeled-feel spacing */}
      <Grid
        args={[4000, 4000]}
        cellSize={24}
        cellThickness={0.3}
        cellColor="#1a2a42"
        sectionSize={288}
        sectionThickness={0.8}
        sectionColor="#243858"
        fadeDistance={4000}
        fadeStrength={1.5}
        followCamera={false}
        position={[288, -1, 0]}
        side={THREE.DoubleSide}
      />

      {/* Axis lines rendered as thin colored lines at the origin */}
      <BlueprintAxes />
    </>
  );
}

// ── Blueprint axis lines ─────────────────────────────────────────────────────
// Draws X (red) and Z (blue) axis lines on the ground plane to reinforce
// the engineering coordinate system — subtle but visible.

function BlueprintAxes() {
  const xPoints = useMemo(() => [new THREE.Vector3(-500, 0, 0), new THREE.Vector3(2500, 0, 0)], []);
  const zPoints = useMemo(() => [new THREE.Vector3(0, 0, -500), new THREE.Vector3(0, 0, 2500)], []);
  const yPoints = useMemo(() => [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 500, 0)], []);

  return (
    <group>
      {/* X axis — red, faint */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(xPoints.flatMap((p) => [p.x, p.y, p.z])), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#3b1520" linewidth={1} transparent opacity={0.6} />
      </line>

      {/* Z axis — blue, faint */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(zPoints.flatMap((p) => [p.x, p.y, p.z])), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#152040" linewidth={1} transparent opacity={0.6} />
      </line>

      {/* Y axis — green, faint */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(yPoints.flatMap((p) => [p.x, p.y, p.z])), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#153020" linewidth={1} transparent opacity={0.6} />
      </line>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function SceneEnvironment({ environment }: SceneEnvironmentProps) {
  useInvalidateOnChange(environment);

  switch (environment) {
    case 'studio':
      return <StudioEnvironment />;
    case 'outdoor':
      return <OutdoorEnvironment />;
    case 'dark':
      return <DarkEnvironment />;
    case 'blueprint':
      return <BlueprintEnvironment />;
    default:
      return <StudioEnvironment />;
  }
}
