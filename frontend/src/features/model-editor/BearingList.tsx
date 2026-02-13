import { useMemo } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { AccordionSection } from './AccordionSection';

export function BearingList() {
  const bearings = useModelStore((s) => s.bearings);
  const bearingArray = useMemo(() => Array.from(bearings.values()), [bearings]);

  return (
    <AccordionSection value="bearings" title="Bearings" count={bearingArray.length}>
      {bearingArray.length === 0 ? (
        <p className="px-2 py-1 text-[10px] text-gray-600">No TFP bearings defined</p>
      ) : (
        <div className="space-y-0.5">
          {bearingArray.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-2 rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800/50"
            >
              <span className="w-8 shrink-0 font-mono text-gray-500">{b.id}</span>
              <span className="flex-1 truncate">
                Node {b.nodeId} | R1={b.R1} R2={b.R2} R3={b.R3}
              </span>
            </div>
          ))}
        </div>
      )}
    </AccordionSection>
  );
}
