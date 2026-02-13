import { useState, useCallback } from 'react';
import type { AnalysisParams } from '@/types/analysis';
import { useModelStore } from '@/stores/modelStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { serializeModel } from '@/services/modelSerializer';
import { submitModel, runAnalysis, getAnalysisStatus, getResults } from '@/services/api';

const POLL_INTERVAL_MS = 500;

export function useRunAnalysis() {
  const [submitting, setSubmitting] = useState(false);

  const startAnalysis = useAnalysisStore((s) => s.startAnalysis);
  const setAnalysisId = useAnalysisStore((s) => s.setAnalysisId);
  const setAnalysisType = useAnalysisStore((s) => s.setAnalysisType);
  const setProgress = useAnalysisStore((s) => s.setProgress);
  const setResults = useAnalysisStore((s) => s.setResults);
  const setError = useAnalysisStore((s) => s.setError);

  const run = useCallback(async (params: AnalysisParams) => {
    setSubmitting(true);
    try {
      // 1. Serialize the current model
      const storeState = useModelStore.getState();
      const serialized = serializeModel(storeState);

      // 2. Submit model to backend
      const { modelId } = await submitModel(serialized);

      // 3. Start analysis
      startAnalysis();
      setAnalysisType(params.type);
      const { analysisId } = await runAnalysis(modelId, params);
      setAnalysisId(analysisId);

      // 4. Poll for status until complete/failed
      const poll = async (): Promise<void> => {
        const { status, progress } = await getAnalysisStatus(analysisId);

        if (status === 'running' || status === 'pending') {
          setProgress(progress * 100, Math.round(progress * 100), 100);
          return new Promise((resolve) => {
            setTimeout(() => resolve(poll()), POLL_INTERVAL_MS);
          });
        }

        if (status === 'error' || status === 'failed') {
          setError(`Analysis failed (status: ${status})`);
          return;
        }

        // status === 'complete' or 'completed'
        const results = await getResults(analysisId);
        setResults(results);
      };

      await poll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }, [startAnalysis, setAnalysisId, setAnalysisType, setProgress, setResults, setError]);

  return { run, submitting };
}
