import { useState, useMemo } from 'react';
import { useModelStore } from '@/stores/modelStore';
import { FormField } from '@/components/ui/FormField';
import { IconButton } from '@/components/ui/IconButton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AccordionSection } from './AccordionSection';
import { Pencil1Icon, TrashIcon, CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import type { Section } from '@/types/storeModel';

function SectionRow({ section, onDelete }: { section: Section; onDelete: (id: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: section.name,
    area: String(section.area),
    Ix: String(section.Ix),
    Iy: String(section.Iy),
    d: String(section.d),
  });
  const updateSection = useModelStore((s) => s.updateSection);

  const startEdit = () => {
    setDraft({
      name: section.name,
      area: String(section.area),
      Ix: String(section.Ix),
      Iy: String(section.Iy),
      d: String(section.d),
    });
    setEditing(true);
  };

  const save = () => {
    updateSection(section.id, {
      name: draft.name,
      area: Number(draft.area) || section.area,
      Ix: Number(draft.Ix) || section.Ix,
      Iy: Number(draft.Iy) || section.Iy,
      d: Number(draft.d) || section.d,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-1 rounded bg-gray-800/50 p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-yellow-400">Section {section.id}</span>
          <div className="flex gap-0.5">
            <IconButton onClick={save} title="Save">
              <CheckIcon className="h-3 w-3" />
            </IconButton>
            <IconButton onClick={() => setEditing(false)} title="Cancel">
              <Cross2Icon className="h-3 w-3" />
            </IconButton>
          </div>
        </div>
        <FormField
          label="Name"
          value={draft.name}
          onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
        />
        <div className="grid grid-cols-2 gap-1">
          <FormField
            label="A"
            type="number"
            value={draft.area}
            onChange={(v) => setDraft((d) => ({ ...d, area: v }))}
          />
          <FormField
            label="d"
            type="number"
            value={draft.d}
            onChange={(v) => setDraft((d) => ({ ...d, d: v }))}
          />
          <FormField
            label="Ix"
            type="number"
            value={draft.Ix}
            onChange={(v) => setDraft((d) => ({ ...d, Ix: v }))}
          />
          <FormField
            label="Iy"
            type="number"
            value={draft.Iy}
            onChange={(v) => setDraft((d) => ({ ...d, Iy: v }))}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2 rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800/50">
      <span className="w-8 shrink-0 font-mono text-gray-500">{section.id}</span>
      <span className="flex-1 truncate">{section.name}</span>
      <span className="text-[10px] text-gray-500">A={section.area}</span>
      <div className="flex gap-0.5 opacity-60 hover:opacity-100">
        <IconButton onClick={startEdit} title="Edit">
          <Pencil1Icon className="h-3 w-3" />
        </IconButton>
        <IconButton onClick={() => onDelete(section.id)} title="Delete" variant="danger">
          <TrashIcon className="h-3 w-3" />
        </IconButton>
      </div>
    </div>
  );
}

export function SectionList() {
  const sections = useModelStore((s) => s.sections);
  const addSection = useModelStore((s) => s.addSection);
  const removeSection = useModelStore((s) => s.removeSection);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const sectionArray = useMemo(() => Array.from(sections.values()), [sections]);

  const handleAdd = () => {
    const maxId = sectionArray.reduce((max, s) => Math.max(max, s.id), 0);
    addSection({
      id: maxId + 1,
      name: `Section ${maxId + 1}`,
      area: 0,
      Ix: 0,
      Iy: 0,
      Zx: 0,
      d: 0,
      bf: 0,
      tw: 0,
      tf: 0,
    });
  };

  return (
    <>
      <AccordionSection
        value="sections"
        title="Sections"
        count={sectionArray.length}
        onAdd={handleAdd}
      >
        {sectionArray.length === 0 ? (
          <p className="px-2 py-1 text-[10px] text-gray-600">No sections defined</p>
        ) : (
          <div className="space-y-0.5">
            {sectionArray.map((s) => (
              <SectionRow key={s.id} section={s} onDelete={setDeleteId} />
            ))}
          </div>
        )}
      </AccordionSection>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Section"
        description={`Are you sure you want to delete Section ${deleteId}? Elements using this section may become invalid.`}
        onConfirm={() => {
          if (deleteId !== null) {
            removeSection(deleteId);
            setDeleteId(null);
          }
        }}
      />
    </>
  );
}
