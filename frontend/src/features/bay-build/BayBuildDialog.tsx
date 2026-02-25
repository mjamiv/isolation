import { useState, useMemo, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Cross2Icon } from '@radix-ui/react-icons';
import type { BayBuildParams } from './bayBuildTypes';
import { generateBayFrame } from './generateBayFrame';
import { useModelStore } from '@/stores/modelStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useComparisonStore } from '@/stores/comparisonStore';
import { useToastStore } from '@/stores/toastStore';

// ── Props ────────────────────────────────────────────────────────────

interface BayBuildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────

function buildModelName(p: BayBuildParams): string {
  const mat = p.material === 'steel' ? 'Steel' : 'Concrete';
  const base = p.baseType === 'fixed' ? 'Fixed' : 'Isolated';
  return `Bay Build: ${p.baysX}x${p.baysZ}x${p.stories} ${mat} (${base})`;
}

// ── Slider Row ───────────────────────────────────────────────────────

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
  suffix,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-gray-400">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer accent-yellow-500"
      />
      <span className="w-12 shrink-0 text-right text-xs text-gray-300">
        {value}
        {suffix ? ` ${suffix}` : ''}
      </span>
    </div>
  );
}

// ── Toggle ───────────────────────────────────────────────────────────

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-4 w-8 rounded-full transition-colors ${
          checked ? 'bg-yellow-600' : 'bg-gray-700'
        }`}
      >
        <div
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export function BayBuildDialog({ open, onOpenChange }: BayBuildDialogProps) {
  // Slider state
  const [baysX, setBaysX] = useState(2);
  const [baysZ, setBaysZ] = useState(2);
  const [bayWidthX, setBayWidthX] = useState(20);
  const [bayWidthZ, setBayWidthZ] = useState(20);
  const [stories, setStories] = useState(2);
  const [storyHeight, setStoryHeight] = useState(15);

  // Option state
  const [material, setMaterial] = useState<'steel' | 'concrete'>('steel');
  const [diaphragms, setDiaphragms] = useState(true);
  const [baseType, setBaseType] = useState<'fixed' | 'isolated'>('fixed');

  // Store actions
  const loadModelFromJSON = useModelStore((s) => s.loadModelFromJSON);
  const resetAnalysis = useAnalysisStore((s) => s.resetAnalysis);
  const resetComparison = useComparisonStore((s) => s.resetComparison);
  const addToast = useToastStore((s) => s.addToast);

  // Build params object from state
  const params = useMemo<BayBuildParams>(
    () => ({
      baysX,
      baysZ,
      bayWidthX,
      bayWidthZ,
      stories,
      storyHeight,
      material,
      diaphragms,
      baseType,
    }),
    [baysX, baysZ, bayWidthX, bayWidthZ, stories, storyHeight, material, diaphragms, baseType],
  );

  // Generate the model JSON from params (memoized)
  const modelJSON = useMemo(() => generateBayFrame(params), [params]);

  // Summary counts
  const summary = useMemo(() => {
    const nodeCount = modelJSON.nodes.length;
    const elementCount = modelJSON.elements.length;
    const bearingCount = modelJSON.bearings.length;
    return { nodeCount, elementCount, bearingCount };
  }, [modelJSON]);

  // Live preview: load model into the store whenever params change (only while open)
  useEffect(() => {
    if (!open) return;
    loadModelFromJSON(modelJSON);
  }, [open, modelJSON, loadModelFromJSON]);

  // Generate button handler
  const handleGenerate = useCallback(() => {
    resetAnalysis();
    resetComparison();
    loadModelFromJSON(modelJSON);
    addToast('success', `Generated "${buildModelName(params)}"`);
    onOpenChange(false);
  }, [
    resetAnalysis,
    resetComparison,
    loadModelFromJSON,
    modelJSON,
    addToast,
    params,
    onOpenChange,
  ]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[480px] max-h-[85vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-xl focus:outline-none">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-gray-200">Bay Build</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              >
                <Cross2Icon className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="mt-1 text-xs text-gray-400">
            Generate a parametric building frame with real-time preview.
          </Dialog.Description>

          {/* Grid Configuration */}
          <div className="mt-5 space-y-4">
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Grid Configuration
              </h3>
              <SliderRow
                label="X Bays"
                min={1}
                max={5}
                step={1}
                value={baysX}
                onChange={setBaysX}
              />
              <SliderRow
                label="Z Bays"
                min={1}
                max={5}
                step={1}
                value={baysZ}
                onChange={setBaysZ}
              />
              <SliderRow
                label="Bay Width X"
                min={10}
                max={40}
                step={5}
                value={bayWidthX}
                onChange={setBayWidthX}
                suffix="ft"
              />
              <SliderRow
                label="Bay Width Z"
                min={10}
                max={40}
                step={5}
                value={bayWidthZ}
                onChange={setBayWidthZ}
                suffix="ft"
              />
              <SliderRow
                label="Stories"
                min={1}
                max={10}
                step={1}
                value={stories}
                onChange={setStories}
              />
              <SliderRow
                label="Story Height"
                min={10}
                max={20}
                step={1}
                value={storyHeight}
                onChange={setStoryHeight}
                suffix="ft"
              />
            </div>

            {/* Options */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Options
              </h3>

              {/* Material */}
              <label className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Material</span>
                <select
                  value={material}
                  onChange={(e) => setMaterial(e.target.value as 'steel' | 'concrete')}
                  className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 outline-none ring-1 ring-gray-700 focus:ring-yellow-500"
                >
                  <option value="steel">Steel</option>
                  <option value="concrete">Concrete</option>
                </select>
              </label>

              {/* Rigid Diaphragms */}
              <Toggle label="Rigid Diaphragms" checked={diaphragms} onChange={setDiaphragms} />

              {/* Base Type */}
              <label className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Base Type</span>
                <select
                  value={baseType}
                  onChange={(e) => setBaseType(e.target.value as 'fixed' | 'isolated')}
                  className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 outline-none ring-1 ring-gray-700 focus:ring-yellow-500"
                >
                  <option value="fixed">Fixed</option>
                  <option value="isolated">Isolated</option>
                </select>
              </label>
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-gray-800/50 px-3 py-2">
              <p className="text-xs text-gray-400">
                <span className="font-medium text-gray-300">{summary.nodeCount}</span> nodes,{' '}
                <span className="font-medium text-gray-300">{summary.elementCount}</span> elements
                {summary.bearingCount > 0 && (
                  <>
                    , <span className="font-medium text-gray-300">{summary.bearingCount}</span>{' '}
                    bearings
                  </>
                )}
                , <span className="font-medium text-gray-300">{stories}</span>{' '}
                {stories === 1 ? 'story' : 'stories'}
              </p>
            </div>

            {/* Generate button */}
            <button
              type="button"
              onClick={handleGenerate}
              className="w-full rounded bg-yellow-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-yellow-500"
            >
              Generate
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
