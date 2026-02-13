import { useState, useMemo } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AccordionSection } from './AccordionSection';
import { GroundMotionRow } from './GroundMotionRow';

/** Generate a 1 Hz sinusoidal ground motion (matches backend test fixture). */
function createSampleGroundMotion(id: number) {
  const dt = 0.01;
  const duration = 10; // seconds
  const nSteps = Math.round(duration / dt);
  const freq = 1; // Hz
  const peakAccel = 0.3; // g

  const acceleration: number[] = [];
  for (let i = 0; i < nSteps; i++) {
    const t = i * dt;
    acceleration.push(peakAccel * Math.sin(2 * Math.PI * freq * t));
  }

  return {
    id,
    name: `Sample 1Hz Sine (${duration}s)`,
    dt,
    acceleration,
    direction: 1 as const,
    scaleFactor: 1.0,
  };
}

export function GroundMotionList() {
  const groundMotions = useModelStore((s) => s.groundMotions);
  const addGroundMotion = useModelStore((s) => s.addGroundMotion);
  const removeGroundMotion = useModelStore((s) => s.removeGroundMotion);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const gmArray = useMemo(() => Array.from(groundMotions.values()), [groundMotions]);

  const handleAdd = () => {
    const maxId = gmArray.reduce((max, gm) => Math.max(max, gm.id), 0);
    addGroundMotion(createSampleGroundMotion(maxId + 1));
  };

  const handleConfirmDelete = () => {
    if (deleteId !== null) {
      removeGroundMotion(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <>
      <AccordionSection value="groundMotions" title="Ground Motions" count={gmArray.length} onAdd={handleAdd}>
        {gmArray.length === 0 ? (
          <p className="px-2 py-1 text-[10px] text-gray-600">No ground motions defined</p>
        ) : (
          <div className="space-y-0.5">
            {gmArray.map((gm) => (
              <GroundMotionRow key={gm.id} gm={gm} onDelete={setDeleteId} />
            ))}
          </div>
        )}
      </AccordionSection>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Ground Motion"
        description={`Are you sure you want to delete Ground Motion ${deleteId}?`}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
