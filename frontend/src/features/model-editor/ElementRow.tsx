import { useState, useMemo } from 'react';
import type { Element } from '@/types/storeModel';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';
import { FormField } from '@/components/ui/FormField';
import { SelectField } from '@/components/ui/SelectField';
import { IconButton } from '@/components/ui/IconButton';
import { Pencil1Icon, TrashIcon, CheckIcon, Cross2Icon } from '@radix-ui/react-icons';

const ELEMENT_TYPES: { value: string; label: string }[] = [
  { value: 'column', label: 'Column' },
  { value: 'beam', label: 'Beam' },
  { value: 'pierCap', label: 'Pier Cap' },
  { value: 'brace', label: 'Brace' },
  { value: 'bearing', label: 'Bearing' },
];

const TYPE_COLORS: Record<Element['type'], string> = {
  column: 'text-stone-400',
  beam: 'text-yellow-400',
  pierCap: 'text-stone-400',
  brace: 'text-orange-400',
  bearing: 'text-purple-400',
};

interface ElementRowProps {
  element: Element;
  onDelete: (id: number) => void;
}

export function ElementRow({ element, onDelete }: ElementRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    type: element.type as string,
    nodeI: String(element.nodeI),
    nodeJ: String(element.nodeJ),
    sectionId: String(element.sectionId),
    materialId: String(element.materialId),
  });

  const updateElement = useModelStore((s) => s.updateElement);
  const sections = useModelStore((s) => s.sections);
  const materials = useModelStore((s) => s.materials);
  const selectElement = useDisplayStore((s) => s.selectElement);
  const selectedElementIds = useDisplayStore((s) => s.selectedElementIds);
  const isSelected = selectedElementIds.has(element.id);

  const sectionOptions = useMemo(
    () => Array.from(sections.values()).map((s) => ({ value: String(s.id), label: s.name })),
    [sections],
  );
  const materialOptions = useMemo(
    () => Array.from(materials.values()).map((m) => ({ value: String(m.id), label: m.name })),
    [materials],
  );

  const startEdit = () => {
    setDraft({
      type: element.type,
      nodeI: String(element.nodeI),
      nodeJ: String(element.nodeJ),
      sectionId: String(element.sectionId),
      materialId: String(element.materialId),
    });
    setEditing(true);
  };

  const save = () => {
    updateElement(element.id, {
      type: draft.type as Element['type'],
      nodeI: Number(draft.nodeI) || element.nodeI,
      nodeJ: Number(draft.nodeJ) || element.nodeJ,
      sectionId: Number(draft.sectionId) || element.sectionId,
      materialId: Number(draft.materialId) || element.materialId,
    });
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  const sectionName = sections.get(element.sectionId)?.name ?? '?';

  if (editing) {
    return (
      <div className="space-y-1 rounded bg-gray-800/50 p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-yellow-400">Element {element.id}</span>
          <div className="flex gap-0.5">
            <IconButton onClick={save} title="Save">
              <CheckIcon className="h-3 w-3" />
            </IconButton>
            <IconButton onClick={cancel} title="Cancel">
              <Cross2Icon className="h-3 w-3" />
            </IconButton>
          </div>
        </div>
        <SelectField
          label="Type"
          value={draft.type}
          options={ELEMENT_TYPES}
          onChange={(v) => setDraft((d) => ({ ...d, type: v }))}
        />
        <div className="grid grid-cols-2 gap-1">
          <FormField
            label="I"
            type="number"
            value={draft.nodeI}
            onChange={(v) => setDraft((d) => ({ ...d, nodeI: v }))}
          />
          <FormField
            label="J"
            type="number"
            value={draft.nodeJ}
            onChange={(v) => setDraft((d) => ({ ...d, nodeJ: v }))}
          />
        </div>
        <SelectField
          label="Sect"
          value={draft.sectionId}
          options={sectionOptions}
          onChange={(v) => setDraft((d) => ({ ...d, sectionId: v }))}
        />
        <SelectField
          label="Mat"
          value={draft.materialId}
          options={materialOptions}
          onChange={(v) => setDraft((d) => ({ ...d, materialId: v }))}
        />
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center gap-2 rounded px-2 py-1 text-xs cursor-pointer transition-colors ${
        isSelected ? 'bg-yellow-900/40 text-yellow-300' : 'text-gray-400 hover:bg-gray-800/50'
      }`}
      onClick={() => selectElement(element.id)}
    >
      <span className="w-8 shrink-0 font-mono text-gray-500">{element.id}</span>
      <span className={`shrink-0 capitalize ${TYPE_COLORS[element.type]}`}>{element.type}</span>
      <span className="flex-1 truncate text-gray-500">
        {element.nodeI}-{element.nodeJ} {sectionName}
      </span>
      <div
        className="flex gap-0.5 opacity-60 hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <IconButton onClick={startEdit} title="Edit">
          <Pencil1Icon className="h-3 w-3" />
        </IconButton>
        <IconButton onClick={() => onDelete(element.id)} title="Delete" variant="danger">
          <TrashIcon className="h-3 w-3" />
        </IconButton>
      </div>
    </div>
  );
}
