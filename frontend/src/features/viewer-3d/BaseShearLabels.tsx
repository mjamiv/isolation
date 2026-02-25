import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import type { StaticResults, PushoverResults } from '@/types/analysis';

function formatShear(v: number): string {
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  if (v >= 1) return v.toFixed(1);
  return v.toFixed(2);
}

export function BaseShearLabels() {
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);
  const model = useModelStore((s) => s.model);
  const showBaseShearLabels = useDisplayStore((s) => s.showBaseShearLabels);
  const analysisResults = useAnalysisStore((s) => s.results);

  const labelData = useMemo(() => {
    if (!showBaseShearLabels || !analysisResults || !model) return [];

    const inner = analysisResults.results;
    if (!inner) return [];

    // Get reactions from inner results (static always has reactions; pushover optionally)
    let reactions: Record<number, [number, number, number, number, number, number]> | undefined;
    if (analysisResults.type === 'static') {
      reactions = (inner as StaticResults).reactions;
    } else if (analysisResults.type === 'pushover') {
      reactions = (inner as PushoverResults).reactions;
    }
    if (!reactions) return [];

    // Find column base nodes: nodes with fixed restraints that are connected to column elements
    const columnBaseNodeIds = new Set<number>();
    for (const el of elements.values()) {
      if (el.type === 'column') {
        const nodeI = nodes.get(el.nodeI);
        if (nodeI && nodeI.restraint.some((r) => r)) {
          columnBaseNodeIds.add(el.nodeI);
        }
      }
    }

    const items: {
      nodeId: number;
      x: number;
      y: number;
      z: number;
      shear: number;
    }[] = [];

    for (const [nodeIdStr, reaction] of Object.entries(reactions)) {
      const nodeId = Number(nodeIdStr);
      if (!columnBaseNodeIds.has(nodeId)) continue;

      const node = nodes.get(nodeId);
      if (!node) continue;

      // Horizontal shear = sqrt(Rx^2 + Rz^2) — reaction values are [Fx, Fy, Fz, Mx, My, Mz]
      const rx = Array.isArray(reaction) ? (reaction[0] ?? 0) : 0;
      const rz = Array.isArray(reaction) ? (reaction[2] ?? 0) : 0;
      const shear = Math.sqrt(rx * rx + rz * rz);

      if (shear > 0.01) {
        items.push({
          nodeId,
          x: node.x,
          y: node.y - 15,
          z: node.z,
          shear,
        });
      }
    }
    return items;
  }, [showBaseShearLabels, analysisResults, model, nodes, elements]);

  if (labelData.length === 0) return null;

  const units = model?.units ?? 'kip-in';
  const forceUnit = units.startsWith('kN') ? 'kN' : units.startsWith('lb') ? 'lb' : 'kip';

  return (
    <group>
      {labelData.map((item) => (
        <Html
          key={`shear-${String(item.nodeId)}`}
          position={[item.x, item.y, item.z]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div className="whitespace-nowrap rounded bg-red-900/80 px-1.5 py-0.5 text-[9px] font-mono text-red-300 ring-1 ring-red-700/50">
            V={formatShear(item.shear)} {forceUnit}
          </div>
        </Html>
      ))}
    </group>
  );
}
