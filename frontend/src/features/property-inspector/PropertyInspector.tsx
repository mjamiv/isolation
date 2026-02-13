import { useDisplayStore } from '@/stores/displayStore';
import { useModelStore } from '@/stores/modelStore';
import { NodeProperties } from './NodeProperties';
import { ElementProperties } from './ElementProperties';

export function PropertyInspector() {
  const selectedNodeIds = useDisplayStore((s) => s.selectedNodeIds);
  const selectedElementIds = useDisplayStore((s) => s.selectedElementIds);
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);

  const selectedNodes = Array.from(selectedNodeIds).map((id) => nodes.get(id)).filter(Boolean);
  const selectedElements = Array.from(selectedElementIds).map((id) => elements.get(id)).filter(Boolean);

  if (selectedNodes.length === 0 && selectedElements.length === 0) {
    return (
      <div className="p-3 text-xs text-gray-500">
        <p>Select a node or element to view its properties.</p>
        <p className="mt-1">Click in the 3D viewer or the model tree.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3">
      {selectedNodes.map((node) => (
        node && <NodeProperties key={node.id} node={node} />
      ))}
      {selectedElements.map((element) => (
        element && <ElementProperties key={element.id} element={element} />
      ))}
    </div>
  );
}
