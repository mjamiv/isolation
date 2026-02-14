import { useAnalysisStore } from '@/stores/analysisStore';
import type {
  StaticResults as StaticResultsType,
  ModalResults as ModalResultsType,
  TimeHistoryResults as THResultsType,
  PushoverResults as PushoverResultsType,
} from '@/types/analysis';
import { StaticResults } from './StaticResults';
import { ModalResults } from './ModalResults';
import { TimeHistoryResults } from './TimeHistoryResults';
import { PushoverResults } from './PushoverResults';

export function ResultsPanel() {
  const results = useAnalysisStore((s) => s.results);
  const analysisType = useAnalysisStore((s) => s.analysisType);

  if (!results) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-medium text-slate-400">No analysis results yet</p>
        <p className="mt-1 text-xs text-slate-600">Run an analysis to see results here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      {/* Summary header */}
      <div className="rounded bg-gray-800/50 p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-300">
            {analysisType === 'static' && 'Static Analysis'}
            {analysisType === 'modal' && 'Modal Analysis'}
            {analysisType === 'time_history' && 'Time-History Analysis'}
            {analysisType === 'pushover' && 'Pushover Analysis'}
            {!analysisType && 'Analysis'}
          </span>
          <span className="text-[10px] text-gray-500">
            {results.status === 'complete' && results.wallTime != null
              ? `${results.wallTime.toFixed(2)}s`
              : results.status}
          </span>
        </div>
      </div>

      {/* Type-specific results */}
      {results.results && results.type === 'static' && (
        <StaticResults data={results.results as StaticResultsType} />
      )}
      {results.results && results.type === 'modal' && (
        <ModalResults data={results.results as ModalResultsType} />
      )}
      {results.results && results.type === 'time_history' && (
        <TimeHistoryResults data={results.results as THResultsType} />
      )}
      {results.results && results.type === 'pushover' && (
        <PushoverResults
          data={results.results as PushoverResultsType}
          hingeStates={results.hingeStates}
        />
      )}
    </div>
  );
}
