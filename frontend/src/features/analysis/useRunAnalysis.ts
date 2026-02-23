import { useMemo } from 'react';
import type { AnalysisParams, AnalysisResults } from '@/types/analysis';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useDisplayStore } from '@/stores/displayStore';
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
          const statusResp = await getAnalysisStatus(analysisId);
          const status = statusResp.status;
          const progress =
            typeof statusResp.progress === 'number'
              ? statusResp.progress
              : status === 'completed' || status === 'complete'
                ? 1
                : 0;

          if (status === 'running' || status === 'pending') {
            setProgress(progress * 100, Math.round(progress * 100), 100);
            return new Promise((resolve, reject) => {
              setTimeout(() => poll().then(resolve, reject), POLL_INTERVAL_MS);
            });
          }

          if (status === 'error' || status === 'failed') {
            const serverError =
              typeof statusResp.error === 'string' && statusResp.error
                ? statusResp.error
                : `Analysis failed (status: ${status})`;
            throw new Error(serverError);
          }

          // status === 'complete' or 'completed'
          return getResults(analysisId);
        };

        return poll();
      },
      onStart: () => startAnalysis(),
      onResult: (result: AnalysisResults) => {
        setResults(result);

        // Auto-enable visualizations based on analysis type
        const display = useDisplayStore.getState();
        if (
          result.type === 'static' ||
          result.type === 'pushover' ||
          result.type === 'time_history'
        ) {
          display.setShowDeformed(true);
          display.setShowForces(true);
          if (display.forceType === 'none') {
            display.setForceType('moment');
          }
        }
        if (result.type === 'modal') {
          useAnalysisStore.getState().setSelectedModeNumber(1);
        }

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
