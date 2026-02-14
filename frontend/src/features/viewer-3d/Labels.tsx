import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';

export function NodeLabels() {
  const nodes = useModelStore((s) => s.nodes);
  const showLabels = useDisplayStore((s) => s.showLabels);
  const hoveredNodeId = useDisplayStore((s) => s.hoveredNodeId);
  const selectedNodeIds = useDisplayStore((s) => s.selectedNodeIds);

  const nodeArray = useMemo(() => Array.from(nodes.values()), [nodes]);

  return (
    <group>
      {nodeArray.map((node) => {
        const visible = showLabels || hoveredNodeId === node.id || selectedNodeIds.has(node.id);
        if (!visible) return null;
        return (
          <Html
            key={node.id}
            position={[node.x, node.y + 8, node.z]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div className="whitespace-nowrap rounded bg-gray-900/90 px-1.5 py-0.5 text-[10px] font-mono text-gray-200 ring-1 ring-gray-700">
              {node.label ?? `N${node.id}`}
            </div>
          </Html>
        );
      })}
    </group>
  );
}

export function ElementLabels() {
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);
  const showLabels = useDisplayStore((s) => s.showLabels);
  const hoveredElementId = useDisplayStore((s) => s.hoveredElementId);
  const selectedElementIds = useDisplayStore((s) => s.selectedElementIds);

  const labelData = useMemo(() => {
    const items: { id: number; label: string; x: number; y: number; z: number }[] = [];
    for (const el of elements.values()) {
      const nI = nodes.get(el.nodeI);
      const nJ = nodes.get(el.nodeJ);
      if (!nI || !nJ) continue;
      items.push({
        id: el.id,
        label: el.label ?? `E${el.id}`,
        x: (nI.x + nJ.x) / 2,
        y: (nI.y + nJ.y) / 2 + 6,
        z: (nI.z + nJ.z) / 2,
      });
    }
    return items;
  }, [nodes, elements]);

  return (
    <group>
      {labelData.map((item) => {
        const visible =
          showLabels || hoveredElementId === item.id || selectedElementIds.has(item.id);
        if (!visible) return null;
        return (
          <Html
            key={item.id}
            position={[item.x, item.y, item.z]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div className="whitespace-nowrap rounded bg-gray-900/90 px-1.5 py-0.5 text-[10px] font-mono text-yellow-300 ring-1 ring-gray-700">
              {item.label}
            </div>
          </Html>
        );
      })}
    </group>
  );
}
