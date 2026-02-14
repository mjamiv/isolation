import { useMemo } from 'react';
import type { AnalysisParams } from '@/types/analysis';
import type { ComparisonRun, LambdaFactors } from '@/types/comparison';
import { useComparisonStore } from '@/stores/comparisonStore';
import { useToastStore } from '@/stores/toastStore';
import { runComparison } from '@/services/api';
import { useRunAsync } from './useRunAsync';

interface ComparisonParams {
  analysisParams: AnalysisParams;
  lambdaFactors?: LambdaFactors;
}

export function useRunComparison() {
  const startComparison = useComparisonStore((s) => s.startComparison);
  const setComparisonId = useComparisonStore((s) => s.setComparisonId);
  const setResults = useComparisonStore((s) => s.setResults);
  const setError = useComparisonStore((s) => s.setError);

  const config = useMemo(
    () => ({
      runFn: async (modelId: string, params: ComparisonParams): Promise<ComparisonRun> => {
        const result = await runComparison(modelId, params.analysisParams, params.lambdaFactors);
        setComparisonId(result.comparisonId);
        return result;
      },
      onStart: () => startComparison(),
      onResult: (result: ComparisonRun) => {
        setResults(result);
        useToastStore.getState().addToast('success', 'Comparison completed successfully.');
      },
      onError: (message: string) => {
        setError(message);
        useToastStore.getState().addToast('error', `Comparison failed: ${message}`);
      },
    }),
    [startComparison, setComparisonId, setResults, setError],
  );

  const { run: runAsync, submitting } = useRunAsync(config);

  // Preserve the original function signature for backward compatibility
  const run = useMemo(
    () => async (params: AnalysisParams, lambdaFactors?: LambdaFactors) =>
      runAsync({ analysisParams: params, lambdaFactors }),
    [runAsync],
  );

  return { run, submitting };
}
