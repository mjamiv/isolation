import { useState, useMemo } from 'react';
import type { TFPBearing, FrictionSurface } from '@/types/storeModel';
import { useModelStore } from '@/stores/modelStore';
import { FormField } from '@/components/ui/FormField';
import { IconButton } from '@/components/ui/IconButton';
import { Pencil1Icon, TrashIcon, CheckIcon, Cross2Icon } from '@radix-ui/react-icons';

interface BearingRowProps {
  bearing: TFPBearing;
  onDelete: (id: number) => void;
}

interface BearingDraft {
  nodeI: string;
  nodeJ: string;
  innerMuSlow: string;
  innerMuFast: string;
  innerTransRate: string;
  outerMuSlow: string;
  outerMuFast: string;
  outerTransRate: string;
  r1: string;
  r2: string;
  r3: string;
  d1: string;
  d2: string;
  d3: string;
  weight: string;
  yieldDisp: string;
  vertStiffness: string;
  minVertForce: string;
  tolerance: string;
}

function makeDraft(b: TFPBearing): BearingDraft {
  return {
    nodeI: String(b.nodeI),
    nodeJ: String(b.nodeJ),
    innerMuSlow: String(b.surfaces[0].muSlow),
    innerMuFast: String(b.surfaces[0].muFast),
    innerTransRate: String(b.surfaces[0].transRate),
    outerMuSlow: String(b.surfaces[2].muSlow),
    outerMuFast: String(b.surfaces[2].muFast),
    outerTransRate: String(b.surfaces[2].transRate),
    r1: String(b.radii[0]),
    r2: String(b.radii[1]),
    r3: String(b.radii[2]),
    d1: String(b.dispCapacities[0]),
    d2: String(b.dispCapacities[1]),
    d3: String(b.dispCapacities[2]),
    weight: String(b.weight),
    yieldDisp: String(b.yieldDisp),
    vertStiffness: String(b.vertStiffness),
    minVertForce: String(b.minVertForce),
    tolerance: String(b.tolerance),
  };
}

export function BearingRow({ bearing, onDelete }: BearingRowProps) {
  const [editing, setEditing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [draft, setDraft] = useState(() => makeDraft(bearing));

  const updateBearing = useModelStore((s) => s.updateBearing);
  const nodes = useModelStore((s) => s.nodes);
  const nodeIds = useMemo(() => Array.from(nodes.keys()), [nodes]);

  const startEdit = () => {
    setDraft(makeDraft(bearing));
    setEditing(true);
  };

  const save = () => {
    const innerSurface: FrictionSurface = {
      type: bearing.surfaces[0].type,
      muSlow: Number(draft.innerMuSlow) || 0,
      muFast: Number(draft.innerMuFast) || 0,
      transRate: Number(draft.innerTransRate) || 0,
    };
    const outerSurface: FrictionSurface = {
      type: bearing.surfaces[2].type,
      muSlow: Number(draft.outerMuSlow) || 0,
      muFast: Number(draft.outerMuFast) || 0,
      transRate: Number(draft.outerTransRate) || 0,
    };

    updateBearing(bearing.id, {
      nodeI: Number(draft.nodeI) || bearing.nodeI,
      nodeJ: Number(draft.nodeJ) || bearing.nodeJ,
      surfaces: [
        { ...innerSurface },
        { ...innerSurface },
        { ...outerSurface },
        { ...outerSurface },
      ],
      radii: [Number(draft.r1) || 0, Number(draft.r2) || 0, Number(draft.r3) || 0],
      dispCapacities: [Number(draft.d1) || 0, Number(draft.d2) || 0, Number(draft.d3) || 0],
      weight: Number(draft.weight) || 0,
      yieldDisp: Number(draft.yieldDisp) || 0,
      vertStiffness: Number(draft.vertStiffness) || 0,
      minVertForce: Number(draft.minVertForce) || 0,
      tolerance: Number(draft.tolerance) || 1e-8,
    });
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  const set_ = (key: keyof BearingDraft) => (v: string) => setDraft((d) => ({ ...d, [key]: v }));

  if (editing) {
    return (
      <div className="space-y-1.5 rounded bg-gray-800/50 p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-purple-400">TFP {bearing.id}</span>
          <div className="flex gap-0.5">
            <IconButton onClick={save} title="Save">
              <CheckIcon className="h-3 w-3" />
            </IconButton>
            <IconButton onClick={cancel} title="Cancel">
              <Cross2Icon className="h-3 w-3" />
            </IconButton>
          </div>
        </div>

        {/* Node connectivity */}
        <div className="grid grid-cols-2 gap-1">
          <div className="flex items-center gap-1">
            <label className="shrink-0 text-xs text-gray-400 w-12">Node I</label>
            <select
              value={draft.nodeI}
              onChange={(e) => set_('nodeI')(e.target.value)}
              className="w-full rounded bg-gray-800 px-2 py-1 text-xs text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-purple-500"
            >
              {nodeIds.map((id) => (
                <option key={id} value={id}>
                  Node {id}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <label className="shrink-0 text-xs text-gray-400 w-12">Node J</label>
            <select
              value={draft.nodeJ}
              onChange={(e) => set_('nodeJ')(e.target.value)}
              className="w-full rounded bg-gray-800 px-2 py-1 text-xs text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-purple-500"
            >
              {nodeIds.map((id) => (
                <option key={id} value={id}>
                  Node {id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Inner friction (surfaces 1,2) */}
        <div>
          <span className="text-[10px] uppercase tracking-wider text-gray-500">
            Inner Friction (Surfaces 1-2)
          </span>
          <div className="mt-0.5 grid grid-cols-3 gap-1">
            <FormField
              label="μ slow"
              type="number"
              value={draft.innerMuSlow}
              onChange={set_('innerMuSlow')}
            />
            <FormField
              label="μ fast"
              type="number"
              value={draft.innerMuFast}
              onChange={set_('innerMuFast')}
            />
            <FormField
              label="Rate"
              type="number"
              value={draft.innerTransRate}
              onChange={set_('innerTransRate')}
            />
          </div>
        </div>

        {/* Outer friction (surfaces 3,4) */}
        <div>
          <span className="text-[10px] uppercase tracking-wider text-gray-500">
            Outer Friction (Surfaces 3-4)
          </span>
          <div className="mt-0.5 grid grid-cols-3 gap-1">
            <FormField
              label="μ slow"
              type="number"
              value={draft.outerMuSlow}
              onChange={set_('outerMuSlow')}
            />
            <FormField
              label="μ fast"
              type="number"
              value={draft.outerMuFast}
              onChange={set_('outerMuFast')}
            />
            <FormField
              label="Rate"
              type="number"
              value={draft.outerTransRate}
              onChange={set_('outerTransRate')}
            />
          </div>
        </div>

        {/* Radii */}
        <div>
          <span className="text-[10px] uppercase tracking-wider text-gray-500">Radii</span>
          <div className="mt-0.5 grid grid-cols-3 gap-1">
            <FormField label="L1" type="number" value={draft.r1} onChange={set_('r1')} />
            <FormField label="L2" type="number" value={draft.r2} onChange={set_('r2')} />
            <FormField label="L3" type="number" value={draft.r3} onChange={set_('r3')} />
          </div>
        </div>

        {/* Displacement capacities */}
        <div>
          <span className="text-[10px] uppercase tracking-wider text-gray-500">
            Disp. Capacities
          </span>
          <div className="mt-0.5 grid grid-cols-3 gap-1">
            <FormField label="d1" type="number" value={draft.d1} onChange={set_('d1')} />
            <FormField label="d2" type="number" value={draft.d2} onChange={set_('d2')} />
            <FormField label="d3" type="number" value={draft.d3} onChange={set_('d3')} />
          </div>
        </div>

        {/* Advanced toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[10px] text-purple-400 hover:text-purple-300"
        >
          {showAdvanced ? '▾ Hide Advanced' : '▸ Show Advanced'}
        </button>

        {showAdvanced && (
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-1">
              <FormField
                label="Weight"
                type="number"
                value={draft.weight}
                onChange={set_('weight')}
              />
              <FormField
                label="uy"
                type="number"
                value={draft.yieldDisp}
                onChange={set_('yieldDisp')}
              />
            </div>
            <div className="grid grid-cols-3 gap-1">
              <FormField
                label="kvt"
                type="number"
                value={draft.vertStiffness}
                onChange={set_('vertStiffness')}
              />
              <FormField
                label="minFv"
                type="number"
                value={draft.minVertForce}
                onChange={set_('minVertForce')}
              />
              <FormField
                label="tol"
                type="number"
                value={draft.tolerance}
                onChange={set_('tolerance')}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2 rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800/50">
      <span className="w-8 shrink-0 font-mono text-gray-500">{bearing.id}</span>
      <span className="rounded bg-purple-900/50 px-1 py-0.5 text-[10px] font-semibold text-purple-300">
        TFP
      </span>
      <span className="flex-1 truncate">
        {bearing.nodeI}→{bearing.nodeJ} R: {bearing.radii[0]}/{bearing.radii[1]}/{bearing.radii[2]}
      </span>
      <div
        className="flex gap-0.5 opacity-60 hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <IconButton onClick={startEdit} title="Edit">
          <Pencil1Icon className="h-3 w-3" />
        </IconButton>
        <IconButton onClick={() => onDelete(bearing.id)} title="Delete" variant="danger">
          <TrashIcon className="h-3 w-3" />
        </IconButton>
      </div>
    </div>
  );
}
