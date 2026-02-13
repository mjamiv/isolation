import { useState, useMemo } from 'react';
import type { TFPBearing, FrictionSurface } from '@/types/storeModel';
import { useModelStore } from '@/stores/modelStore';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AccordionSection } from './AccordionSection';
import { BearingRow } from './BearingRow';

function createDefaultBearing(id: number, nodeI: number, nodeJ: number): TFPBearing {
  const innerSurface: FrictionSurface = {
    type: 'VelDependent', muSlow: 0.012, muFast: 0.018, transRate: 0.4,
  };
  const outerSurface: FrictionSurface = {
    type: 'VelDependent', muSlow: 0.018, muFast: 0.030, transRate: 0.4,
  };
  return {
    id,
    nodeI,
    nodeJ,
    surfaces: [
      { ...innerSurface },
      { ...innerSurface },
      { ...outerSurface },
      { ...outerSurface },
    ],
    radii: [16, 84, 16],
    dispCapacities: [2, 16, 2],
    weight: 150,
    yieldDisp: 0.04,
    vertStiffness: 10000,
    minVertForce: 0.1,
    tolerance: 1e-8,
  };
}

export function BearingList() {
  const bearings = useModelStore((s) => s.bearings);
  const nodes = useModelStore((s) => s.nodes);
  const addBearing = useModelStore((s) => s.addBearing);
  const removeBearing = useModelStore((s) => s.removeBearing);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const bearingArray = useMemo(() => Array.from(bearings.values()), [bearings]);

  const handleAdd = () => {
    const maxId = bearingArray.reduce((max, b) => Math.max(max, b.id), 0);
    const nodeKeys = Array.from(nodes.keys());
    const nodeI = nodeKeys[0] ?? 1;
    const nodeJ = nodeKeys[1] ?? nodeI;
    addBearing(createDefaultBearing(maxId + 1, nodeI, nodeJ));
  };

  const handleConfirmDelete = () => {
    if (deleteId !== null) {
      removeBearing(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <>
      <AccordionSection value="bearings" title="Bearings" count={bearingArray.length} onAdd={handleAdd}>
        {bearingArray.length === 0 ? (
          <p className="px-2 py-1 text-[10px] text-gray-600">No TFP bearings defined</p>
        ) : (
          <div className="space-y-0.5">
            {bearingArray.map((b) => (
              <BearingRow key={b.id} bearing={b} onDelete={setDeleteId} />
            ))}
          </div>
        )}
      </AccordionSection>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Bearing"
        description={`Are you sure you want to delete Bearing ${deleteId}?`}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
