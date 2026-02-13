import { useState, useMemo } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AccordionSection } from './AccordionSection';
import { LoadRow } from './LoadRow';

export function LoadList() {
  const loads = useModelStore((s) => s.loads);
  const nodes = useModelStore((s) => s.nodes);
  const addLoad = useModelStore((s) => s.addLoad);
  const removeLoad = useModelStore((s) => s.removeLoad);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadArray = useMemo(() => Array.from(loads.values()), [loads]);

  const handleAdd = () => {
    const maxId = loadArray.reduce((max, l) => Math.max(max, l.id), 0);
    const firstNodeId = nodes.size > 0 ? Array.from(nodes.keys())[0]! : 1;
    addLoad({
      id: maxId + 1,
      nodeId: firstNodeId,
      fx: 0, fy: 0, fz: 0,
      mx: 0, my: 0, mz: 0,
    });
  };

  const handleConfirmDelete = () => {
    if (deleteId !== null) {
      removeLoad(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <>
      <AccordionSection value="loads" title="Loads" count={loadArray.length} onAdd={handleAdd}>
        {loadArray.length === 0 ? (
          <p className="px-2 py-1 text-[10px] text-gray-600">No loads defined</p>
        ) : (
          <div className="space-y-0.5">
            {loadArray.map((load) => (
              <LoadRow key={load.id} load={load} onDelete={setDeleteId} />
            ))}
          </div>
        )}
      </AccordionSection>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Load"
        description={`Are you sure you want to delete Load ${deleteId}?`}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
