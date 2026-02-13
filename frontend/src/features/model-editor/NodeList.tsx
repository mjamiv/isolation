import { useState, useMemo } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AccordionSection } from './AccordionSection';
import { NodeRow } from './NodeRow';

export function NodeList() {
  const nodes = useModelStore((s) => s.nodes);
  const addNode = useModelStore((s) => s.addNode);
  const removeNode = useModelStore((s) => s.removeNode);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const nodeArray = useMemo(() => Array.from(nodes.values()), [nodes]);

  const handleAdd = () => {
    const maxId = nodeArray.reduce((max, n) => Math.max(max, n.id), 0);
    addNode({
      id: maxId + 1,
      x: 0,
      y: 0,
      z: 0,
      restraint: [false, false, false, false, false, false],
    });
  };

  const handleConfirmDelete = () => {
    if (deleteId !== null) {
      removeNode(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <>
      <AccordionSection value="nodes" title="Nodes" count={nodeArray.length} onAdd={handleAdd}>
        {nodeArray.length === 0 ? (
          <p className="px-2 py-1 text-[10px] text-gray-600">No nodes defined</p>
        ) : (
          <div className="space-y-0.5">
            {nodeArray.map((node) => (
              <NodeRow key={node.id} node={node} onDelete={setDeleteId} />
            ))}
          </div>
        )}
      </AccordionSection>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Node"
        description={`Are you sure you want to delete Node ${deleteId}? Elements connected to this node may become invalid.`}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
