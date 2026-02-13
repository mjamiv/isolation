import { useModelStore } from '../../stores/modelStore';
import { useAnalysisStore } from '../../stores/analysisStore';

const STATUS_COLORS: Record<string, string> = {
  idle: 'text-gray-400',
  running: 'text-yellow-400',
  complete: 'text-emerald-400',
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
  const error = useAnalysisStore((state) => state.error);

  const nodeCount = nodes.size;
  const elementCount = elements.size;

  return (
    <div className="flex h-7 items-center justify-between border-t border-gray-700 bg-gray-900 px-4 text-xs">
      {/* Left: Status indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div
            className={`h-2 w-2 rounded-full ${
              status === 'running'
                ? 'animate-pulse bg-yellow-400'
                : status === 'complete'
                  ? 'bg-emerald-400'
                  : status === 'error'
                    ? 'bg-red-400'
                    : 'bg-gray-500'
            }`}
          />
          <span className={STATUS_COLORS[status] ?? 'text-gray-400'}>
            {STATUS_LABELS[status] ?? 'Unknown'}
          </span>
        </div>

        {status === 'running' && (
          <div className="flex items-center gap-2">
            <div className="h-1 w-24 overflow-hidden rounded-full bg-gray-700">
              <div
                className="h-full rounded-full bg-yellow-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-gray-500">{Math.round(progress)}%</span>
          </div>
        )}

        {status === 'error' && error && (
          <span className="text-red-400">{error}</span>
        )}
      </div>

      {/* Center: Time step (if analysis is complete) */}
      {status === 'complete' && (
        <div className="text-gray-400">
          Time Step: {currentTimeStep}
        </div>
      )}

      {/* Right: Model info */}
      <div className="flex items-center gap-3 text-gray-500">
        {model && (
          <span className="text-gray-400">{model.name}</span>
        )}
        <span>Nodes: {nodeCount}</span>
        <span>Elements: {elementCount}</span>
        <span>Units: kip-in</span>
      </div>
    </div>
  );
}
