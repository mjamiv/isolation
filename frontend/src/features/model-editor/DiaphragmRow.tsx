import { useState, useMemo } from 'react';
import type { RigidDiaphragm } from '@/types/storeModel';
import { useModelStore } from '@/stores/modelStore';
import { FormField } from '@/components/ui/FormField';
import { IconButton } from '@/components/ui/IconButton';
import { Pencil1Icon, TrashIcon, CheckIcon, Cross2Icon } from '@radix-ui/react-icons';

interface DiaphragmRowProps {
  diaphragm: RigidDiaphragm;
  onDelete: (id: number) => void;
}

interface DiaphragmDraft {
  masterNodeId: string;
  constrainedNodeIds: string;
  perpDirection: string;
  label: string;
}

function makeDraft(d: RigidDiaphragm): DiaphragmDraft {
  return {
    masterNodeId: String(d.masterNodeId),
    constrainedNodeIds: d.constrainedNodeIds.join(', '),
    perpDirection: String(d.perpDirection),
    label: d.label ?? '',
  };
}

export function DiaphragmRow({ diaphragm, onDelete }: DiaphragmRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => makeDraft(diaphragm));

  const updateDiaphragm = useModelStore((s) => s.updateDiaphragm);
  const nodes = useModelStore((s) => s.nodes);
  const nodeIds = useMemo(() => Array.from(nodes.keys()), [nodes]);

  const startEdit = () => {
    setDraft(makeDraft(diaphragm));
    setEditing(true);
  };

  const save = () => {
    const constrainedIds = draft.constrainedNodeIds
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);

    updateDiaphragm(diaphragm.id, {
      masterNodeId: Number(draft.masterNodeId) || diaphragm.masterNodeId,
      constrainedNodeIds: constrainedIds.length > 0 ? constrainedIds : diaphragm.constrainedNodeIds,
      perpDirection: (Number(draft.perpDirection) === 3 ? 3 : 2) as 2 | 3,
      label: draft.label || undefined,
    });
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  const set_ = (key: keyof DiaphragmDraft) => (v: string) => setDraft((d) => ({ ...d, [key]: v }));

  if (editing) {
    return (
      <div className="space-y-1.5 rounded bg-gray-800/50 p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-yellow-400">Diaphragm {diaphragm.id}</span>
          <div className="flex gap-0.5">
            <IconButton onClick={save} title="Save">
              <CheckIcon className="h-3 w-3" />
            </IconButton>
            <IconButton onClick={cancel} title="Cancel">
              <Cross2Icon className="h-3 w-3" />
            </IconButton>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1">
          <div className="flex items-center gap-1">
            <label className="shrink-0 text-xs text-gray-400 w-14">Master</label>
            <select
              value={draft.masterNodeId}
              onChange={(e) => set_('masterNodeId')(e.target.value)}
              className="w-full rounded bg-gray-800 px-2 py-1 text-xs text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-yellow-500"
            >
              {nodeIds.map((id) => (
                <option key={id} value={id}>
                  Node {id}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <label className="shrink-0 text-xs text-gray-400 w-14">Perp Dir</label>
            <select
              value={draft.perpDirection}
              onChange={(e) => set_('perpDirection')(e.target.value)}
              className="w-full rounded bg-gray-800 px-2 py-1 text-xs text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-yellow-500"
            >
              <option value="2">2 (Y-perp)</option>
              <option value="3">3 (Z-perp)</option>
            </select>
          </div>
        </div>

        <FormField
          label="Constrained Nodes"
          type="text"
          value={draft.constrainedNodeIds}
          onChange={set_('constrainedNodeIds')}
        />
        <FormField label="Label" type="text" value={draft.label} onChange={set_('label')} />
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2 rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800/50">
      <span className="w-8 shrink-0 font-mono text-gray-500">{diaphragm.id}</span>
      <span className="rounded bg-yellow-900/50 px-1 py-0.5 text-[10px] font-semibold text-yellow-300">
        RD
      </span>
      <span className="flex-1 truncate">
        M:{diaphragm.masterNodeId} → [{diaphragm.constrainedNodeIds.join(',')}]
      </span>
      <div
        className="flex gap-0.5 opacity-60 hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <IconButton onClick={startEdit} title="Edit">
          <Pencil1Icon className="h-3 w-3" />
        </IconButton>
        <IconButton onClick={() => onDelete(diaphragm.id)} title="Delete" variant="danger">
          <TrashIcon className="h-3 w-3" />
        </IconButton>
      </div>
    </div>
  );
}
