import { useMemo } from 'react';
import type { AnalysisParams, AnalysisResults } from '@/types/analysis';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useToastStore } from '@/stores/toastStore';
import { runAnalysis, getAnalysisStatus, getResults } from '@/services/api';
import { useRunAsync } from './useRunAsync';

const POLL_INTERVAL_MS = 500;

export function useRunAnalysis() {
  const startAnalysis = useAnalysisStore((s) => s.startAnalysis);
  const setAnalysisId = useAnalysisStore((s) => s.setAnalysisId);
  const setAnalysisType = useAnalysisStore((s) => s.setAnalysisType);
  const setProgress = useAnalysisStore((s) => s.setProgress);
  const setResults = useAnalysisStore((s) => s.setResults);
  const setError = useAnalysisStore((s) => s.setError);

  const config = useMemo(
    () => ({
      runFn: async (modelId: string, params: AnalysisParams): Promise<AnalysisResults> => {
        setAnalysisType(params.type);
        const { analysisId } = await runAnalysis(modelId, params);
        setAnalysisId(analysisId);

        // Poll for status until complete/failed
        const poll = async (): Promise<AnalysisResults> => {
          const { status, progress } = await getAnalysisStatus(analysisId);

          if (status === 'running' || status === 'pending') {
            setProgress(progress * 100, Math.round(progress * 100), 100);
            return new Promise((resolve, reject) => {
              setTimeout(() => poll().then(resolve, reject), POLL_INTERVAL_MS);
            });
          }

          if (status === 'error' || status === 'failed') {
            throw new Error(`Analysis failed (status: ${status})`);
          }

          // status === 'complete' or 'completed'
          return getResults(analysisId);
        };

        return poll();
      },
      onStart: () => startAnalysis(),
      onResult: (result: AnalysisResults) => {
        setResults(result);
        useToastStore.getState().addToast('success', 'Analysis completed successfully.');
      },
      onError: (message: string) => {
        setError(message);
        useToastStore.getState().addToast('error', `Analysis failed: ${message}`);
      },
    }),
    [startAnalysis, setAnalysisId, setAnalysisType, setProgress, setResults, setError],
  );

  return useRunAsync(config);
}
