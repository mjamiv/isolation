import { useMemo } from 'react';
import type { AnalysisParams } from '@/types/analysis';
import type { ComparisonRun, LambdaFactors } from '@/types/comparison';
import { useComparisonStore } from '@/stores/comparisonStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useDisplayStore } from '@/stores/displayStore';
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

        // Post-comparison defaults: show deformed at scale 100, results overlays off.
        const display = useDisplayStore.getState();
        display.setShowDeformed(true);
        display.setHideUndeformed(false);
        display.setScaleFactor(100);
        display.setShowForces(false);
        display.setForceType('none');
        display.setColorMap('none');
        display.setShowComparisonOverlay(true);
        display.setShowBaseShearLabels(result.comparisonType === 'pushover');
        display.setShowBearingDisplacement(true);

        useAnalysisStore.getState().setTimeStep(0);
        useAnalysisStore.getState().setIsPlaying(false);

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
