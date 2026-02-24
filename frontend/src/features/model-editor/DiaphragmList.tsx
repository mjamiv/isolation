import { useState, useMemo } from 'react';
import type { RigidDiaphragm } from '@/types/storeModel';
import { useModelStore } from '@/stores/modelStore';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AccordionSection } from './AccordionSection';
import { DiaphragmRow } from './DiaphragmRow';

function createDefaultDiaphragm(
  id: number,
  nodes: Map<number, { id: number; y: number }>,
): RigidDiaphragm {
  const nodeIds = Array.from(nodes.keys());
  const masterNodeId = nodeIds[0] ?? 1;
  const constrainedNodeIds = nodeIds.length > 1 ? [nodeIds[1]!] : [];
  return {
    id,
    masterNodeId,
    constrainedNodeIds,
    perpDirection: 2,
  };
}

export function DiaphragmList() {
  const diaphragms = useModelStore((s) => s.diaphragms);
  const nodes = useModelStore((s) => s.nodes);
  const addDiaphragm = useModelStore((s) => s.addDiaphragm);
  const removeDiaphragm = useModelStore((s) => s.removeDiaphragm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const diaphragmArray = useMemo(() => Array.from(diaphragms.values()), [diaphragms]);

  const handleAdd = () => {
    const maxId = diaphragmArray.reduce((max, d) => Math.max(max, d.id), 0);
    addDiaphragm(createDefaultDiaphragm(maxId + 1, nodes));
  };

  const handleConfirmDelete = () => {
    if (deleteId !== null) {
      removeDiaphragm(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <>
      <AccordionSection
        value="diaphragms"
        title="Diaphragms"
        count={diaphragmArray.length}
        onAdd={handleAdd}
      >
        {diaphragmArray.length === 0 ? (
          <p className="px-2 py-1 text-[10px] text-gray-600">No rigid diaphragms defined</p>
        ) : (
          <div className="space-y-0.5">
            {diaphragmArray.map((d) => (
              <DiaphragmRow key={d.id} diaphragm={d} onDelete={setDeleteId} />
            ))}
          </div>
        )}
      </AccordionSection>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Diaphragm"
        description={`Are you sure you want to delete Diaphragm ${deleteId}?`}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
