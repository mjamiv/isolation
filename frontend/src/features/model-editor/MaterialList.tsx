import { useState, useMemo } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { FormField } from '@/components/ui/FormField';
import { IconButton } from '@/components/ui/IconButton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AccordionSection } from './AccordionSection';
import { Pencil1Icon, TrashIcon, CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import type { Material } from '@/types/storeModel';

function MaterialRow({ material, onDelete }: { material: Material; onDelete: (id: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: material.name,
    E: String(material.E),
    Fy: String(material.Fy),
    density: String(material.density),
    nu: String(material.nu),
  });
  const updateMaterial = useModelStore((s) => s.updateMaterial);

  const startEdit = () => {
    setDraft({
      name: material.name,
      E: String(material.E),
      Fy: String(material.Fy),
      density: String(material.density),
      nu: String(material.nu),
    });
    setEditing(true);
  };

  const save = () => {
    updateMaterial(material.id, {
      name: draft.name,
      E: Number(draft.E) || material.E,
      Fy: Number(draft.Fy) || material.Fy,
      density: Number(draft.density) || material.density,
      nu: Number(draft.nu) || material.nu,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-1 rounded bg-gray-800/50 p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-blue-400">Material {material.id}</span>
          <div className="flex gap-0.5">
            <IconButton onClick={save} title="Save"><CheckIcon className="h-3 w-3" /></IconButton>
            <IconButton onClick={() => setEditing(false)} title="Cancel"><Cross2Icon className="h-3 w-3" /></IconButton>
          </div>
        </div>
        <FormField label="Name" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
        <div className="grid grid-cols-2 gap-1">
          <FormField label="E" type="number" value={draft.E} onChange={(v) => setDraft((d) => ({ ...d, E: v }))} />
          <FormField label="Fy" type="number" value={draft.Fy} onChange={(v) => setDraft((d) => ({ ...d, Fy: v }))} />
          <FormField label="dens" type="number" value={draft.density} onChange={(v) => setDraft((d) => ({ ...d, density: v }))} />
          <FormField label="nu" type="number" value={draft.nu} onChange={(v) => setDraft((d) => ({ ...d, nu: v }))} />
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2 rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800/50">
      <span className="w-8 shrink-0 font-mono text-gray-500">{material.id}</span>
      <span className="flex-1 truncate">{material.name}</span>
      <span className="text-[10px] text-gray-500">E={material.E}</span>
      <div className="hidden gap-0.5 group-hover:flex">
        <IconButton onClick={startEdit} title="Edit"><Pencil1Icon className="h-3 w-3" /></IconButton>
        <IconButton onClick={() => onDelete(material.id)} title="Delete" variant="danger"><TrashIcon className="h-3 w-3" /></IconButton>
      </div>
    </div>
  );
}

export function MaterialList() {
  const materials = useModelStore((s) => s.materials);
  const addMaterial = useModelStore((s) => s.addMaterial);
  const removeMaterial = useModelStore((s) => s.removeMaterial);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const materialArray = useMemo(() => Array.from(materials.values()), [materials]);

  const handleAdd = () => {
    const maxId = materialArray.reduce((max, m) => Math.max(max, m.id), 0);
    addMaterial({
      id: maxId + 1,
      name: `Material ${maxId + 1}`,
      E: 29000,
      Fy: 50,
      density: 490,
      nu: 0.3,
    });
  };

  return (
    <>
      <AccordionSection value="materials" title="Materials" count={materialArray.length} onAdd={handleAdd}>
        {materialArray.length === 0 ? (
          <p className="px-2 py-1 text-[10px] text-gray-600">No materials defined</p>
        ) : (
          <div className="space-y-0.5">
            {materialArray.map((m) => (
              <MaterialRow key={m.id} material={m} onDelete={setDeleteId} />
            ))}
          </div>
        )}
      </AccordionSection>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Material"
        description={`Are you sure you want to delete Material ${deleteId}? Elements using this material may become invalid.`}
        onConfirm={() => { if (deleteId !== null) { removeMaterial(deleteId); setDeleteId(null); } }}
      />
    </>
  );
}
