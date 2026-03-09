import { useModelStore } from '../../stores/modelStore';
import { useAnalysisStore } from '../../stores/analysisStore';
import { useComparisonStore } from '../../stores/comparisonStore';

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

const COMPARISON_STATUS_LABELS: Record<string, string> = {
  running: 'Running Comparison...',
  complete: 'Comparison Complete',
  error: 'Comparison Error',
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
  const comparisonStatus = useComparisonStore((state) => state.status);
  const comparisonError = useComparisonStore((state) => state.error);

  const effectiveStatus =
    comparisonStatus === 'running' ||
    comparisonStatus === 'complete' ||
    comparisonStatus === 'error'
      ? comparisonStatus
      : status;
  const effectiveLabel =
    comparisonStatus === 'running' ||
    comparisonStatus === 'complete' ||
    comparisonStatus === 'error'
      ? (COMPARISON_STATUS_LABELS[comparisonStatus] ?? 'Comparison')
      : (STATUS_LABELS[status] ?? 'Unknown');
  const effectiveError = comparisonStatus === 'error' ? comparisonError : error;

  const nodeCount = nodes.size;
  const elementCount = elements.size;

  return (
    <div className="flex h-7 items-center justify-between border-t border-white/[0.06] bg-surface-1 px-4 text-ui-xs">
      {/* Left: Status indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div
            className={`h-1.5 w-1.5 rounded-full ${
              effectiveStatus === 'running'
                ? 'status-pulse bg-yellow-400'
                : effectiveStatus === 'complete'
                  ? 'bg-yellow-400'
                  : effectiveStatus === 'error'
                    ? 'bg-red-400'
                    : 'bg-white/20'
            }`}
          />
          <span className={`font-medium ${STATUS_COLORS[effectiveStatus] ?? 'text-white/30'}`}>
            {effectiveLabel}
          </span>
        </div>

        {effectiveStatus === 'running' && comparisonStatus !== 'running' && (
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

        {effectiveStatus === 'error' && effectiveError && (
          <span className="text-red-400">{effectiveError}</span>
        )}
      </div>

      {/* Center: Time step (only for time-history analysis) */}
      {effectiveStatus === 'complete' && analysisType === 'time_history' && (
        <div className="font-mono text-white/30">Step {currentTimeStep}</div>
      )}

      {/* Right: Model info */}
      <div className="flex items-center gap-3 text-white/50">
        {model && <span className="font-medium text-white/70">{model.name}</span>}
        <span className="font-mono">{nodeCount}N</span>
        <span className="font-mono">{elementCount}E</span>
        <span className="rounded border border-white/[0.06] px-1.5 py-0.5 font-mono text-ui-xs text-white/60">
          Units: kip-in
        </span>
      </div>
    </div>
  );
}
