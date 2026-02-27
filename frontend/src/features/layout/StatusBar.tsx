import { useModelStore } from '../../stores/modelStore';
import { useAnalysisStore } from '../../stores/analysisStore';

const STATUS_COLORS: Record<string, string> = {
  idle: 'text-white/30',
  running: 'text-yellow-400',
  complete: 'text-yellow-400',
  error: 'text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  idle: 'Ready',
  running: 'Running Analysis...',
  complete: 'Analysis Complete',
  error: 'Error',
};

export function StatusBar() {
  const nodes = useModelStore((state) => state.nodes);
  const elements = useModelStore((state) => state.elements);
  const model = useModelStore((state) => state.model);

  const status = useAnalysisStore((state) => state.status);
  const progress = useAnalysisStore((state) => state.progress);
  const currentTimeStep = useAnalysisStore((state) => state.currentTimeStep);
  const analysisType = useAnalysisStore((state) => state.analysisType);
  const error = useAnalysisStore((state) => state.error);

  const nodeCount = nodes.size;
  const elementCount = elements.size;

  return (
    <div className="flex h-7 items-center justify-between border-t border-white/[0.06] bg-surface-1 px-4 text-[10px]">
      {/* Left: Status indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div
            className={`h-1.5 w-1.5 rounded-full ${
              status === 'running'
                ? 'status-pulse bg-yellow-400'
                : status === 'complete'
                  ? 'bg-yellow-400'
                  : status === 'error'
                    ? 'bg-red-400'
                    : 'bg-white/20'
            }`}
          />
          <span className={`font-medium ${STATUS_COLORS[status] ?? 'text-white/30'}`}>
            {STATUS_LABELS[status] ?? 'Unknown'}
          </span>
        </div>

        {status === 'running' && (
          <div className="flex items-center gap-2">
            <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-4">
              <div
                className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-mono text-white/30">{Math.round(progress)}%</span>
          </div>
        )}

        {status === 'error' && error && <span className="text-red-400">{error}</span>}
      </div>

      {/* Center: Time step (only for time-history analysis) */}
      {status === 'complete' && analysisType === 'time_history' && (
        <div className="font-mono text-white/30">Step {currentTimeStep}</div>
      )}

      {/* Right: Model info */}
      <div className="flex items-center gap-3 text-white/25">
        {model && <span className="font-medium text-white/35">{model.name}</span>}
        <span className="font-mono">{nodeCount}N</span>
        <span className="font-mono">{elementCount}E</span>
        <span className="rounded border border-white/[0.06] px-1.5 py-0.5 font-mono text-[9px]">
          kip-in
        </span>
      </div>
    </div>
  );
}
