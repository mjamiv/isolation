import { useState, useCallback } from 'react';
import type { AnalysisParams } from '@/types/analysis';
import type { LambdaFactors } from '@/types/comparison';
import { useModelStore } from '@/stores/modelStore';
import { useComparisonStore } from '@/stores/comparisonStore';
import { serializeModel } from '@/services/modelSerializer';
import { submitModel, runComparison } from '@/services/api';

export function useRunComparison() {
  const [submitting, setSubmitting] = useState(false);

  const startComparison = useComparisonStore((s) => s.startComparison);
  const setComparisonId = useComparisonStore((s) => s.setComparisonId);
  const setResults = useComparisonStore((s) => s.setResults);
  const setError = useComparisonStore((s) => s.setError);

  const run = useCallback(async (params: AnalysisParams, lambdaFactors?: LambdaFactors) => {
    setSubmitting(true);
    try {
      // 1. Serialize the current model
      const storeState = useModelStore.getState();
      const serialized = serializeModel(storeState);

      // 2. Submit model to backend
      const { modelId } = await submitModel(serialized);

      // 3. Start comparison
      startComparison();

      // 4. Run comparison (synchronous — backend does all four runs)
      const result = await runComparison(modelId, params, lambdaFactors);
      setComparisonId(result.comparisonId);
      setResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }, [startComparison, setComparisonId, setResults, setError]);

  return { run, submitting };
}
