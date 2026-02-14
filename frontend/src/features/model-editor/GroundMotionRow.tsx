import { useState } from 'react';
import type { GroundMotionRecord } from '@/types/storeModel';
import { useModelStore } from '@/stores/modelStore';
import { FormField } from '@/components/ui/FormField';
import { IconButton } from '@/components/ui/IconButton';
import { Pencil1Icon, TrashIcon, CheckIcon, Cross2Icon } from '@radix-ui/react-icons';

interface GroundMotionRowProps {
  gm: GroundMotionRecord;
  onDelete: (id: number) => void;
}

const DIR_LABELS: Record<number, string> = { 1: 'X', 2: 'Y', 3: 'Z' };

export function GroundMotionRow({ gm, onDelete }: GroundMotionRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: gm.name,
    dt: String(gm.dt),
    direction: String(gm.direction),
    scaleFactor: String(gm.scaleFactor),
  });

  const updateGroundMotion = useModelStore((s) => s.updateGroundMotion);

  const startEdit = () => {
    setDraft({
      name: gm.name,
      dt: String(gm.dt),
      direction: String(gm.direction),
      scaleFactor: String(gm.scaleFactor),
    });
    setEditing(true);
  };

  const save = () => {
    updateGroundMotion(gm.id, {
      name: draft.name,
      dt: Number(draft.dt) || gm.dt,
      direction: (Number(draft.direction) || gm.direction) as 1 | 2 | 3,
      scaleFactor: Number(draft.scaleFactor) || 1.0,
    });
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <div className="space-y-1 rounded bg-gray-800/50 p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-yellow-400">GM {gm.id}</span>
          <div className="flex gap-0.5">
            <IconButton onClick={save} title="Save">
              <CheckIcon className="h-3 w-3" />
            </IconButton>
            <IconButton onClick={cancel} title="Cancel">
              <Cross2Icon className="h-3 w-3" />
            </IconButton>
          </div>
        </div>
        <FormField
          label="Name"
          value={draft.name}
          onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
        />
        <div className="grid grid-cols-3 gap-1">
          <FormField
            label="dt"
            type="number"
            value={draft.dt}
            onChange={(v) => setDraft((d) => ({ ...d, dt: v }))}
          />
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-xs text-gray-400 w-12">Dir</label>
            <select
              value={draft.direction}
              onChange={(e) => setDraft((d) => ({ ...d, direction: e.target.value }))}
              className="w-full rounded bg-gray-800 px-2 py-1 text-xs text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-yellow-500"
            >
              <option value="1">X</option>
              <option value="2">Y</option>
              <option value="3">Z</option>
            </select>
          </div>
          <FormField
            label="Scale"
            type="number"
            value={draft.scaleFactor}
            onChange={(v) => setDraft((d) => ({ ...d, scaleFactor: v }))}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2 rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800/50">
      <span className="w-8 shrink-0 font-mono text-gray-500">{gm.id}</span>
      <span className="flex-1 truncate">{gm.name}</span>
      <span className="text-[10px] text-gray-500">
        {DIR_LABELS[gm.direction] ?? '?'} dt={gm.dt}
      </span>
      <div
        className="flex gap-0.5 opacity-60 hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <IconButton onClick={startEdit} title="Edit">
          <Pencil1Icon className="h-3 w-3" />
        </IconButton>
        <IconButton onClick={() => onDelete(gm.id)} title="Delete" variant="danger">
          <TrashIcon className="h-3 w-3" />
        </IconButton>
      </div>
    </div>
  );
}
