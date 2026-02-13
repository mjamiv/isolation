import { useState, useMemo } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AccordionSection } from './AccordionSection';
import { ElementRow } from './ElementRow';

export function ElementList() {
  const elements = useModelStore((s) => s.elements);
  const addElement = useModelStore((s) => s.addElement);
  const removeElement = useModelStore((s) => s.removeElement);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const elementArray = useMemo(() => Array.from(elements.values()), [elements]);

  const handleAdd = () => {
    const maxId = elementArray.reduce((max, e) => Math.max(max, e.id), 0);
    addElement({
      id: maxId + 1,
      type: 'beam',
      nodeI: 1,
      nodeJ: 2,
      sectionId: 1,
      materialId: 1,
    });
  };

  const handleConfirmDelete = () => {
    if (deleteId !== null) {
      removeElement(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <>
      <AccordionSection value="elements" title="Elements" count={elementArray.length} onAdd={handleAdd}>
        {elementArray.length === 0 ? (
          <p className="px-2 py-1 text-[10px] text-gray-600">No elements defined</p>
        ) : (
          <div className="space-y-0.5">
            {elementArray.map((el) => (
              <ElementRow key={el.id} element={el} onDelete={setDeleteId} />
            ))}
          </div>
        )}
      </AccordionSection>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Element"
        description={`Are you sure you want to delete Element ${deleteId}?`}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
