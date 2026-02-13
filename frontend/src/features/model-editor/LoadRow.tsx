import { useState, useMemo } from 'react';
import type { PointLoad } from '@/types/storeModel';
import { useModelStore } from '@/stores/modelStore';
import { FormField } from '@/components/ui/FormField';
import { IconButton } from '@/components/ui/IconButton';
import { Pencil1Icon, TrashIcon, CheckIcon, Cross2Icon } from '@radix-ui/react-icons';

interface LoadRowProps {
  load: PointLoad;
  onDelete: (id: number) => void;
}

export function LoadRow({ load, onDelete }: LoadRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    nodeId: String(load.nodeId),
    fx: String(load.fx), fy: String(load.fy), fz: String(load.fz),
    mx: String(load.mx), my: String(load.my), mz: String(load.mz),
  });

  const updateLoad = useModelStore((s) => s.updateLoad);
  const nodes = useModelStore((s) => s.nodes);
  const nodeIds = useMemo(() => Array.from(nodes.keys()), [nodes]);

  const startEdit = () => {
    setDraft({
      nodeId: String(load.nodeId),
      fx: String(load.fx), fy: String(load.fy), fz: String(load.fz),
      mx: String(load.mx), my: String(load.my), mz: String(load.mz),
    });
    setEditing(true);
  };

  const save = () => {
    updateLoad(load.id, {
      nodeId: Number(draft.nodeId) || load.nodeId,
      fx: Number(draft.fx) || 0,
      fy: Number(draft.fy) || 0,
      fz: Number(draft.fz) || 0,
      mx: Number(draft.mx) || 0,
      my: Number(draft.my) || 0,
      mz: Number(draft.mz) || 0,
    });
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <div className="space-y-1 rounded bg-gray-800/50 p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-blue-400">Load {load.id}</span>
          <div className="flex gap-0.5">
            <IconButton onClick={save} title="Save"><CheckIcon className="h-3 w-3" /></IconButton>
            <IconButton onClick={cancel} title="Cancel"><Cross2Icon className="h-3 w-3" /></IconButton>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <label className="shrink-0 text-xs text-gray-400 w-12">Node</label>
          <select
            value={draft.nodeId}
            onChange={(e) => setDraft((d) => ({ ...d, nodeId: e.target.value }))}
            className="w-full rounded bg-gray-800 px-2 py-1 text-xs text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-blue-500"
          >
            {nodeIds.map((id) => (
              <option key={id} value={id}>Node {id}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <FormField label="Fx" type="number" value={draft.fx} onChange={(v) => setDraft((d) => ({ ...d, fx: v }))} />
          <FormField label="Fy" type="number" value={draft.fy} onChange={(v) => setDraft((d) => ({ ...d, fy: v }))} />
          <FormField label="Fz" type="number" value={draft.fz} onChange={(v) => setDraft((d) => ({ ...d, fz: v }))} />
        </div>
        <div className="grid grid-cols-3 gap-1">
          <FormField label="Mx" type="number" value={draft.mx} onChange={(v) => setDraft((d) => ({ ...d, mx: v }))} />
          <FormField label="My" type="number" value={draft.my} onChange={(v) => setDraft((d) => ({ ...d, my: v }))} />
          <FormField label="Mz" type="number" value={draft.mz} onChange={(v) => setDraft((d) => ({ ...d, mz: v }))} />
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2 rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800/50">
      <span className="w-8 shrink-0 font-mono text-gray-500">{load.id}</span>
      <span className="flex-1 truncate">
        N{load.nodeId}: ({load.fx}, {load.fy}, {load.fz})
      </span>
      <div className="hidden gap-0.5 group-hover:flex" onClick={(e) => e.stopPropagation()}>
        <IconButton onClick={startEdit} title="Edit">
          <Pencil1Icon className="h-3 w-3" />
        </IconButton>
        <IconButton onClick={() => onDelete(load.id)} title="Delete" variant="danger">
          <TrashIcon className="h-3 w-3" />
        </IconButton>
      </div>
    </div>
  );
}
