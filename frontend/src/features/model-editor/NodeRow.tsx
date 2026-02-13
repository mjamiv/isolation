import { useState } from 'react';
import type { Node } from '@/types/storeModel';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';
import { FormField } from '@/components/ui/FormField';
import { FixityToggle } from '@/components/ui/FixityToggle';
import { IconButton } from '@/components/ui/IconButton';
import { Pencil1Icon, TrashIcon, CheckIcon, Cross2Icon } from '@radix-ui/react-icons';

interface NodeRowProps {
  node: Node;
  onDelete: (id: number) => void;
}

export function NodeRow({ node, onDelete }: NodeRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ x: String(node.x), y: String(node.y), z: String(node.z) });
  const [draftFixity, setDraftFixity] = useState(node.restraint);

  const updateNode = useModelStore((s) => s.updateNode);
  const selectNode = useDisplayStore((s) => s.selectNode);
  const selectedNodeIds = useDisplayStore((s) => s.selectedNodeIds);
  const isSelected = selectedNodeIds.has(node.id);

  const startEdit = () => {
    setDraft({ x: String(node.x), y: String(node.y), z: String(node.z) });
    setDraftFixity(node.restraint);
    setEditing(true);
  };

  const save = () => {
    updateNode(node.id, {
      x: Number(draft.x) || 0,
      y: Number(draft.y) || 0,
      z: Number(draft.z) || 0,
      restraint: draftFixity,
    });
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <div className="space-y-1 rounded bg-gray-800/50 p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-blue-400">Node {node.id}</span>
          <div className="flex gap-0.5">
            <IconButton onClick={save} title="Save"><CheckIcon className="h-3 w-3" /></IconButton>
            <IconButton onClick={cancel} title="Cancel"><Cross2Icon className="h-3 w-3" /></IconButton>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <FormField label="X" type="number" value={draft.x} onChange={(v) => setDraft((d) => ({ ...d, x: v }))} />
          <FormField label="Y" type="number" value={draft.y} onChange={(v) => setDraft((d) => ({ ...d, y: v }))} />
          <FormField label="Z" type="number" value={draft.z} onChange={(v) => setDraft((d) => ({ ...d, z: v }))} />
        </div>
        <FixityToggle value={draftFixity} onChange={setDraftFixity} />
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center gap-2 rounded px-2 py-1 text-xs cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-900/40 text-blue-300' : 'text-gray-400 hover:bg-gray-800/50'
      }`}
      onClick={() => selectNode(node.id)}
    >
      <span className="w-8 shrink-0 font-mono text-gray-500">{node.id}</span>
      <span className="flex-1 truncate">
        ({node.x}, {node.y}, {node.z})
      </span>
      {node.restraint.some(Boolean) && (
        <span className="text-[10px] text-red-400/70" title="Has restraints">R</span>
      )}
      <div className="hidden gap-0.5 group-hover:flex" onClick={(e) => e.stopPropagation()}>
        <IconButton onClick={startEdit} title="Edit">
          <Pencil1Icon className="h-3 w-3" />
        </IconButton>
        <IconButton onClick={() => onDelete(node.id)} title="Delete" variant="danger">
          <TrashIcon className="h-3 w-3" />
        </IconButton>
      </div>
    </div>
  );
}
