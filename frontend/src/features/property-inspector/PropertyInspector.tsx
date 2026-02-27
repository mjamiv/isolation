import { useDisplayStore } from '@/stores/displayStore';
import { useModelStore } from '@/stores/modelStore';
import { NodeProperties } from './NodeProperties';
import { ElementProperties } from './ElementProperties';
import { BearingProperties } from './BearingProperties';

export function PropertyInspector() {
  const selectedNodeIds = useDisplayStore((s) => s.selectedNodeIds);
  const selectedElementIds = useDisplayStore((s) => s.selectedElementIds);
  const selectedBearingIds = useDisplayStore((s) => s.selectedBearingIds);
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);
  const bearings = useModelStore((s) => s.bearings);

  const selectedNodes = Array.from(selectedNodeIds)
    .map((id) => nodes.get(id))
    .filter(Boolean);
  const selectedElements = Array.from(selectedElementIds)
    .map((id) => elements.get(id))
    .filter(Boolean);
  const selectedBearings = Array.from(selectedBearingIds)
    .map((id) => bearings.get(id))
    .filter(Boolean);

  if (
    selectedNodes.length === 0 &&
    selectedElements.length === 0 &&
    selectedBearings.length === 0
  ) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.06] bg-surface-2">
          <svg
            className="h-5 w-5 text-white/15"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"
            />
          </svg>
        </div>
        <p className="text-[11px] font-medium text-white/40">No selection</p>
        <p className="mt-1 text-[10px] text-white/20">
          Click a node, element, or bearing in the 3D viewer
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3">
      {selectedNodes.map((node) => node && <NodeProperties key={node.id} node={node} />)}
      {selectedElements.map(
        (element) => element && <ElementProperties key={element.id} element={element} />,
      )}
      {selectedBearings.map(
        (bearing) => bearing && <BearingProperties key={bearing.id} bearing={bearing} />,
      )}
    </div>
  );
}
