import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';

function formatValue(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  if (v >= 1) return v.toFixed(1);
  if (v >= 0.01) return v.toFixed(3);
  if (v > 0) return v.toExponential(2);
  return '0';
}

const MASS_UNITS: Record<string, string> = {
  'kip-in': 'kip\u00B7s\u00B2/in',
  'kip-ft': 'kip\u00B7s\u00B2/ft',
  'kN-m': 'kN\u00B7s\u00B2/m',
  'kN-mm': 'kN\u00B7s\u00B2/mm',
  'N-m': 'kg',
  'N-mm': 'kg',
  'lb-in': 'lb\u00B7s\u00B2/in',
  'lb-ft': 'slug',
};

const GRAVITY: Record<string, number> = {
  'kip-in': 386.4,
  'kip-ft': 32.174,
  'kN-m': 9.81,
  'kN-mm': 9810.0,
  'N-m': 9.81,
  'N-mm': 9810.0,
  'lb-in': 386.4,
  'lb-ft': 32.174,
};

export function ElementPropertyLabels() {
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);
  const sections = useModelStore((s) => s.sections);
  const materials = useModelStore((s) => s.materials);
  const loads = useModelStore((s) => s.loads);
  const model = useModelStore((s) => s.model);
  const showMassLabels = useDisplayStore((s) => s.showMassLabels);
  const showStiffnessLabels = useDisplayStore((s) => s.showStiffnessLabels);
  const units = model?.units ?? '';
  const massUnit = MASS_UNITS[units] ?? '';
  const g = GRAVITY[units] ?? 386.4;

  // Build node mass map from gravity loads: mass = |Fvertical| / g
  const nodeMassMap = useMemo(() => {
    const map = new Map<number, number>();
    if (!showMassLabels) return map;

    // First use explicit node.mass if available
    for (const node of nodes.values()) {
      if (node.mass != null && node.mass > 0) {
        map.set(node.id, node.mass);
      }
    }
    // If no explicit masses, derive from gravity loads
    if (map.size === 0) {
      for (const load of loads.values()) {
        // Gravity is the vertical force component (fy for Y-up models)
        const vertForce = Math.abs(load.fy);
        if (vertForce > 0) {
          const existing = map.get(load.nodeId) ?? 0;
          map.set(load.nodeId, existing + vertForce / g);
        }
      }
    }
    return map;
  }, [nodes, loads, showMassLabels, g]);

  const labelData = useMemo(() => {
    if (!showMassLabels && !showStiffnessLabels) return [];

    const items: {
      id: number;
      x: number;
      y: number;
      z: number;
      mass: number | null;
      stiffness: number | null;
    }[] = [];

    for (const el of elements.values()) {
      const nI = nodes.get(el.nodeI);
      const nJ = nodes.get(el.nodeJ);
      if (!nI || !nJ) continue;

      // Midpoint with slight offset in Y for readability
      const mx = (nI.x + nJ.x) / 2;
      const my = (nI.y + nJ.y) / 2 - 8;
      const mz = (nI.z + nJ.z) / 2;

      let mass: number | null = null;
      let stiffness: number | null = null;

      if (showMassLabels) {
        // Average tributary mass from end nodes
        const mI = nodeMassMap.get(el.nodeI) ?? 0;
        const mJ = nodeMassMap.get(el.nodeJ) ?? 0;
        mass = (mI + mJ) / 2;
      }

      if (showStiffnessLabels) {
        const section = sections.get(el.sectionId);
        const mat = materials.get(el.materialId);
        if (section && mat) {
          const E = mat.E;
          const I = section.Ix;
          const dx = nJ.x - nI.x;
          const dy = nJ.y - nI.y;
          const dz = nJ.z - nI.z;
          const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (L > 0 && I > 0) {
            stiffness = (E * I) / L; // EI/L flexural stiffness
          } else if (L > 0) {
            const A = section.area;
            stiffness = (E * A) / L; // EA/L axial stiffness
          }
        }
      }

      items.push({ id: el.id, x: mx, y: my, z: mz, mass, stiffness });
    }
    return items;
  }, [nodes, elements, sections, materials, nodeMassMap, showMassLabels, showStiffnessLabels]);

  if (labelData.length === 0) return null;

  return (
    <group>
      {labelData.map((item) => {
        const parts: string[] = [];
        if (item.mass !== null && item.mass > 0)
          parts.push(`m=${formatValue(item.mass)}${massUnit ? ` ${massUnit}` : ''}`);
        if (item.stiffness !== null && item.stiffness > 0)
          parts.push(`k=${formatValue(item.stiffness)}`);
        if (parts.length === 0) return null;

        return (
          <Html
            key={`prop-${String(item.id)}`}
            position={[item.x, item.y, item.z]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div className="whitespace-nowrap rounded bg-gray-900/80 px-1.5 py-0.5 text-[9px] font-mono text-yellow-400 ring-1 ring-yellow-800/50">
              {parts.join(' ')}
            </div>
          </Html>
        );
      })}
    </group>
  );
}
