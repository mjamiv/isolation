import { useRef, useState } from 'react';
import { useModelStore } from '../../stores/modelStore';
import { useDisplayStore, type DisplayMode } from '../../stores/displayStore';
import { useAnalysisStore } from '../../stores/analysisStore';
import { useComparisonStore } from '../../stores/comparisonStore';
import { useToastStore } from '../../stores/toastStore';
import { PRESET_MODELS } from '../../types/modelJSON';
import type { ModelJSON } from '../../types/modelJSON';
import { AnalysisDialog } from '../analysis/AnalysisDialog';
import { BayBuildDialog } from '../bay-build/BayBuildDialog';
import { BentBuildDialog } from '../bent-build/BentBuildDialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

const DISPLAY_MODES: { value: DisplayMode; label: string }[] = [
  { value: 'wireframe', label: 'Wireframe' },
  { value: 'extruded', label: 'Extruded' },
  { value: 'solid', label: 'Solid' },
];

const IMPORT_FILE_VALUE = '__import__';
const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

function validateImportedModel(json: unknown): asserts json is ModelJSON {
  if (typeof json !== 'object' || json === null) {
    throw new Error('Model JSON must be an object');
  }
  const candidate = json as Partial<ModelJSON>;
  if (!candidate.modelInfo || typeof candidate.modelInfo !== 'object') {
    throw new Error('Missing modelInfo block');
  }
  if (!Array.isArray(candidate.nodes) || candidate.nodes.length === 0) {
    throw new Error('Model must include at least one node');
  }
  if (!Array.isArray(candidate.elements)) {
    throw new Error('Model elements must be an array');
  }
}

export function Toolbar() {
  const model = useModelStore((state) => state.model);
  const loadGeneratedPresetModel = useModelStore((state) => state.loadGeneratedPresetModel);
  const loadModelFromJSON = useModelStore((state) => state.loadModelFromJSON);
  const clearModel = useModelStore((state) => state.clearModel);
  const displayMode = useDisplayStore((state) => state.displayMode);
  const setDisplayMode = useDisplayStore((state) => state.setDisplayMode);
  const analysisStatus = useAnalysisStore((state) => state.status);
  const resetAnalysis = useAnalysisStore((state) => state.resetAnalysis);
  const saveToCache = useAnalysisStore((state) => state.saveToCache);
  const restoreFromCache = useAnalysisStore((state) => state.restoreFromCache);
  const resetComparison = useComparisonStore((state) => state.resetComparison);
  const addToast = useToastStore((state) => state.addToast);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [bayBuildOpen, setBayBuildOpen] = useState(false);
  const [bentBuildOpen, setBentBuildOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleModelSelect = async (value: string) => {
    if (value === IMPORT_FILE_VALUE) {
      fileInputRef.current?.click();
      return;
    }

    const index = Number(value);
    const preset = PRESET_MODELS[index];
    if (!preset) return;

    // Save current results to cache before switching
    if (model) {
      saveToCache(model.name);
    }

    resetAnalysis();
    resetComparison();

    try {
      if (preset.kind === 'startup') {
        loadGeneratedPresetModel(preset.presetId);
        const startupName = useModelStore.getState().model?.name ?? preset.label;
        const restored = restoreFromCache(startupName);
        if (restored) {
          addToast('success', `Loaded "${preset.label}" (results restored)`);
        } else {
          addToast('success', `Loaded "${preset.label}"`);
        }
        return;
      }

      const response = await fetch(preset.url);
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
      const json = (await response.json()) as ModelJSON;
      loadModelFromJSON(json);

      // Restore cached results if available for this model
      const restored = restoreFromCache(json.modelInfo.name);
      if (restored) {
        addToast('success', `Loaded "${preset.label}" (results restored)`);
      } else {
        addToast('success', `Loaded "${preset.label}"`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addToast('error', `Failed to load model: ${msg}`);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      addToast('error', 'File is too large. Max supported import size is 10 MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string) as ModelJSON;
        validateImportedModel(json);
        resetAnalysis();
        resetComparison();
        loadModelFromJSON(json);
        addToast('success', `Imported "${file.name}"`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        addToast('error', `Failed to import: ${msg}`);
      }
    };
    reader.readAsText(file);

    // Reset so the same file can be re-imported
    e.target.value = '';
  };

  return (
    <div className="toolbar-glow relative z-10 flex min-h-12 flex-wrap items-center justify-between gap-2 bg-surface-1 px-3 py-2 md:h-12 md:flex-nowrap md:px-4 md:py-0">
      {/* Left: App title */}
      <div className="flex items-center gap-3">
        <h1 className="flex items-baseline gap-0.5 text-lg font-bold tracking-tight">
          <span className="bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent">
            Iso
          </span>
          <span className="bg-gradient-to-r from-yellow-500 to-yellow-600 bg-clip-text text-transparent">
            Vis
          </span>
        </h1>
        <div className="mx-1 h-5 w-px bg-white/10" />
        <span className="text-[11px] font-medium tracking-wide text-white/50">
          TFP Bearing Simulator
        </span>
      </div>

      {/* Center: Action buttons */}
      <div className="flex items-center gap-1.5">
        {/* Group 1: Bay Build, Bent Build, Load Model */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setBayBuildOpen(true)}
            aria-label="Open Bay Build dialog"
            className="shrink-0 rounded-md border border-white/[0.06] bg-surface-3 px-3 py-1.5 text-[11px] font-medium text-gray-300 transition-all duration-150 hover:border-yellow-500/30 hover:bg-surface-4 hover:text-white hover:shadow-glow-gold"
          >
            Bay Build
          </button>

          <button
            type="button"
            onClick={() => setBentBuildOpen(true)}
            aria-label="Open Bent Build dialog"
            className="shrink-0 rounded-md border border-white/[0.06] bg-surface-3 px-3 py-1.5 text-[11px] font-medium text-gray-300 transition-all duration-150 hover:border-yellow-500/30 hover:bg-surface-4 hover:text-white hover:shadow-glow-gold"
          >
            Bent Build
          </button>

          <select
            defaultValue=""
            onChange={(e) => {
              void handleModelSelect(e.target.value);
              e.target.value = '';
            }}
            className="shrink-0 cursor-pointer rounded-md border border-white/[0.06] bg-surface-3 px-3 py-1.5 text-[11px] font-medium text-gray-300 transition-all duration-150 hover:border-yellow-500/30 hover:bg-surface-4 hover:text-white"
            aria-label="Load model"
          >
            <option value="" disabled>
              Load Model
            </option>
            {PRESET_MODELS.map((preset, i) => (
              <option key={preset.label} value={String(i)}>
                {preset.label}
              </option>
            ))}
            <option value={IMPORT_FILE_VALUE}>Import JSON File...</option>
          </select>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileImport}
          />
        </div>

        <div className="mx-1 h-5 w-px bg-white/20" aria-hidden />

        {/* Group 2: Run Analysis, Reset */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            disabled={analysisStatus === 'running'}
            aria-label="Open analysis dialog"
            className="shrink-0 rounded-md bg-gradient-to-r from-yellow-600 to-yellow-500 px-4 py-1.5 text-[11px] font-semibold text-white shadow-glow-gold transition-all duration-150 hover:from-yellow-500 hover:to-yellow-400 hover:shadow-glow-gold-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {analysisStatus === 'running' ? (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-white/80 border-t-transparent" />
                Running...
              </span>
            ) : (
              'Run Analysis'
            )}
          </button>

          <button
            type="button"
            onClick={() => setResetConfirmOpen(true)}
            aria-label="Reset current model"
            className="shrink-0 rounded-md border border-white/[0.06] bg-surface-3 px-3 py-1.5 text-[11px] font-medium text-gray-400 transition-all duration-150 hover:border-red-500/30 hover:text-red-400"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Right: Display mode toggle */}
      <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-surface-0 p-0.5">
        {DISPLAY_MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            onClick={() => setDisplayMode(mode.value)}
            aria-label={`Display mode: ${mode.label}`}
            className={`shrink-0 rounded-md px-3 py-1 text-[11px] font-medium transition-all duration-150 ${
              displayMode === mode.value
                ? 'bg-gradient-to-r from-yellow-600/80 to-yellow-500/80 text-white shadow-glow-gold'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <AnalysisDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <BayBuildDialog open={bayBuildOpen} onOpenChange={setBayBuildOpen} />
      <BentBuildDialog open={bentBuildOpen} onOpenChange={setBentBuildOpen} />
      <ConfirmDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        title="Reset model?"
        description="All unsaved edits to the current model will be lost."
        confirmLabel="Reset"
        onConfirm={clearModel}
      />
    </div>
  );
}
