import { useCallback } from 'react';
import type { AnalysisParams } from '@/types/analysis';
import type { ComparisonRun, LambdaFactors } from '@/types/comparison';
import { useComparisonStore } from '@/stores/comparisonStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useToastStore } from '@/stores/toastStore';
import { runComparison } from '@/services/api';
import { useRunAsync } from './useRunAsync';
import { applyPostAnalysisDisplayDefaults } from './applyPostAnalysisDisplayDefaults';

interface ComparisonParams {
  analysisParams: AnalysisParams;
  lambdaFactors?: LambdaFactors;
}

export function useRunComparison() {
  const startComparison = useComparisonStore((s) => s.startComparison);
  const setComparisonId = useComparisonStore((s) => s.setComparisonId);
  const setResults = useComparisonStore((s) => s.setResults);
  const setError = useComparisonStore((s) => s.setError);

  const { run: runAsync, submitting } = useRunAsync({
    runFn: async (modelId: string, params: ComparisonParams): Promise<ComparisonRun> => {
      const result = await runComparison(modelId, params.analysisParams, params.lambdaFactors);
      setComparisonId(result.comparisonId);
      return result;
    },
    onStart: () => {
      startComparison();
      useAnalysisStore.getState().setSelectedModeNumber(null);
      useToastStore
        .getState()
        .addToast('info', 'Comparison started. Check the Compare tab for progress.');
    },
    onResult: (result: ComparisonRun) => {
      setResults(result);
      useAnalysisStore.getState().setSelectedModeNumber(null);
      applyPostAnalysisDisplayDefaults({
        resultType: result.comparisonType,
        hasBearings: true,
        showComparisonOverlay: true,
      });

      useAnalysisStore.getState().setTimeStep(0);
      useAnalysisStore.getState().setIsPlaying(false);

      useToastStore.getState().addToast('success', 'Comparison completed successfully.');
    },
    onError: (message: string) => {
      setError(message);
      useToastStore.getState().addToast('error', `Comparison failed: ${message}`);
    },
  });

  // Preserve the original function signature for backward compatibility
  const run = useCallback(
    async (params: AnalysisParams, lambdaFactors?: LambdaFactors) =>
      runAsync({ analysisParams: params, lambdaFactors }),
    [runAsync],
  );

  return { run, submitting };
}
