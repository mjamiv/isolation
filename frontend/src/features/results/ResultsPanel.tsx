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
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.06] bg-surface-2">
          <svg
            className="h-5 w-5 text-white/15"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
            />
          </svg>
        </div>
        <p className="text-[11px] font-medium text-white/40">No analysis results</p>
        <p className="mt-1 text-[10px] text-white/20">Run an analysis to see results here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      {/* Summary header */}
      <div className="metric-card rounded-lg p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-white/70">
            {analysisType === 'static' && 'Static Analysis'}
            {analysisType === 'modal' && 'Modal Analysis'}
            {analysisType === 'time_history' && 'Time-History Analysis'}
            {analysisType === 'pushover' && 'Pushover Analysis'}
            {!analysisType && 'Analysis'}
          </span>
          <span className="font-mono text-[10px] text-yellow-400/60">
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
