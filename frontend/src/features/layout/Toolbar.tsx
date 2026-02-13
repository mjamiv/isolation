import { useModelStore } from '../../stores/modelStore';
import { useDisplayStore, type DisplayMode } from '../../stores/displayStore';
import { useAnalysisStore } from '../../stores/analysisStore';

const DISPLAY_MODES: { value: DisplayMode; label: string }[] = [
  { value: 'wireframe', label: 'Wireframe' },
  { value: 'extruded', label: 'Extruded' },
  { value: 'solid', label: 'Solid' },
];

export function Toolbar() {
  const loadSampleModel = useModelStore((state) => state.loadSampleModel);
  const clearModel = useModelStore((state) => state.clearModel);
  const displayMode = useDisplayStore((state) => state.displayMode);
  const setDisplayMode = useDisplayStore((state) => state.setDisplayMode);
  const analysisStatus = useAnalysisStore((state) => state.status);
  const startAnalysis = useAnalysisStore((state) => state.startAnalysis);

  return (
    <div className="flex h-12 items-center justify-between border-b border-gray-700 bg-gray-900 px-4">
      {/* Left: App title */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold tracking-wide text-white">
          <span className="text-blue-400">Iso</span>
          <span className="text-emerald-400">Vis</span>
        </h1>
        <div className="mx-2 h-6 w-px bg-gray-700" />
        <span className="text-xs text-gray-400">
          Triple Friction Pendulum Bearing Simulator
        </span>
      </div>

      {/* Center: Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={loadSampleModel}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
        >
          Load Sample Model
        </button>

        <button
          onClick={startAnalysis}
          disabled={analysisStatus === 'running'}
          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {analysisStatus === 'running' ? 'Running...' : 'Run Analysis'}
        </button>

        <button
          onClick={clearModel}
          className="rounded bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-600"
        >
          Reset
        </button>
      </div>

      {/* Right: Display mode toggle */}
      <div className="flex items-center gap-1 rounded-lg bg-gray-800 p-0.5">
        {DISPLAY_MODES.map((mode) => (
          <button
            key={mode.value}
            onClick={() => setDisplayMode(mode.value)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              displayMode === mode.value
                ? 'bg-gray-600 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}
