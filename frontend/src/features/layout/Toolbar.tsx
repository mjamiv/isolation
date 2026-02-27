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

const DISPLAY_MODES: { value: DisplayMode; label: string }[] = [
  { value: 'wireframe', label: 'Wireframe' },
  { value: 'extruded', label: 'Extruded' },
  { value: 'solid', label: 'Solid' },
];

const IMPORT_FILE_VALUE = '__import__';

export function Toolbar() {
  const model = useModelStore((state) => state.model);
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

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string) as ModelJSON;
        if (!json.modelInfo || !Array.isArray(json.nodes)) {
          throw new Error('Invalid model JSON structure');
        }
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
    <div className="toolbar-glow relative z-10 flex h-12 items-center justify-between bg-surface-1 px-4">
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
        <span className="text-[11px] font-medium tracking-wide text-white/30">
          TFP Bearing Simulator
        </span>
      </div>

      {/* Center: Action buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setBayBuildOpen(true)}
          className="rounded-md border border-white/[0.06] bg-surface-3 px-3 py-1.5 text-[11px] font-medium text-gray-300 transition-all duration-150 hover:border-yellow-500/30 hover:bg-surface-4 hover:text-white hover:shadow-glow-gold"
        >
          Bay Build
        </button>

        <button
          onClick={() => setBentBuildOpen(true)}
          className="rounded-md border border-white/[0.06] bg-surface-3 px-3 py-1.5 text-[11px] font-medium text-gray-300 transition-all duration-150 hover:border-yellow-500/30 hover:bg-surface-4 hover:text-white hover:shadow-glow-gold"
        >
          Bent Build
        </button>

        <select
          defaultValue=""
          onChange={(e) => {
            void handleModelSelect(e.target.value);
            e.target.value = '';
          }}
          className="cursor-pointer rounded-md border border-white/[0.06] bg-surface-3 px-3 py-1.5 text-[11px] font-medium text-gray-300 transition-all duration-150 hover:border-yellow-500/30 hover:bg-surface-4 hover:text-white"
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

        <div className="mx-1 h-5 w-px bg-white/[0.06]" />

        <button
          onClick={() => setDialogOpen(true)}
          disabled={analysisStatus === 'running'}
          className="rounded-md bg-gradient-to-r from-yellow-600 to-yellow-500 px-4 py-1.5 text-[11px] font-semibold text-white shadow-glow-gold transition-all duration-150 hover:from-yellow-500 hover:to-yellow-400 hover:shadow-glow-gold-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
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
          onClick={() => {
            if (window.confirm('Reset the model? All unsaved changes will be lost.')) {
              clearModel();
            }
          }}
          className="rounded-md border border-white/[0.06] bg-surface-3 px-3 py-1.5 text-[11px] font-medium text-gray-400 transition-all duration-150 hover:border-red-500/30 hover:text-red-400"
        >
          Reset
        </button>
      </div>

      {/* Right: Display mode toggle */}
      <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-surface-0 p-0.5">
        {DISPLAY_MODES.map((mode) => (
          <button
            key={mode.value}
            onClick={() => setDisplayMode(mode.value)}
            className={`rounded-md px-3 py-1 text-[11px] font-medium transition-all duration-150 ${
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
    </div>
  );
}
