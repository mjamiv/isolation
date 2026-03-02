import { useEffect, useMemo } from 'react';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useComparisonStore } from '@/stores/comparisonStore';
import type { TimeHistoryResults } from '@/types/analysis';

export function PlaybackDriver() {
  const isPlaying = useAnalysisStore((s) => s.isPlaying);
  const playbackSpeed = useAnalysisStore((s) => s.playbackSpeed);
  const loopPlayback = useAnalysisStore((s) => s.loopPlayback);
  const results = useAnalysisStore((s) => s.results);
  const setTimeStep = useAnalysisStore((s) => s.setTimeStep);
  const setIsPlaying = useAnalysisStore((s) => s.setIsPlaying);
  const comparisonType = useComparisonStore((s) => s.comparisonType);
  const comparisonIsolated = useComparisonStore((s) => s.isolated);

  const thResults = useMemo(() => {
    if (comparisonType === 'time_history' && comparisonIsolated?.timeHistoryResults) {
      return comparisonIsolated.timeHistoryResults;
    }
    if (results?.results && results.type === 'time_history') {
      return results.results as TimeHistoryResults;
    }
    return null;
  }, [comparisonType, comparisonIsolated, results]);

  const totalSteps = thResults?.timeSteps.length ?? 0;
  const dt = thResults?.dt ?? 0;

  useEffect(() => {
    if (!isPlaying || !thResults || totalSteps === 0 || dt <= 0) return;

    let rafId = 0;
    let lastTs = performance.now();
    let accumulator = 0;

    const tick = (now: number) => {
      const elapsed = (now - lastTs) / 1000;
      lastTs = now;
      accumulator += elapsed * playbackSpeed;

      if (accumulator >= dt) {
        const stepsToAdvance = Math.floor(accumulator / dt);
        accumulator -= stepsToAdvance * dt;

        const currentStep = useAnalysisStore.getState().currentTimeStep;
        const unclampedNext = currentStep + stepsToAdvance;

        if (unclampedNext >= totalSteps) {
          if (loopPlayback) {
            setTimeStep(unclampedNext % totalSteps);
          } else {
            setTimeStep(totalSteps - 1);
            setIsPlaying(false);
            return;
          }
        } else {
          setTimeStep(unclampedNext);
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    isPlaying,
    playbackSpeed,
    loopPlayback,
    setTimeStep,
    setIsPlaying,
    thResults,
    totalSteps,
    dt,
  ]);

  useEffect(() => {
    if (isPlaying && (!thResults || totalSteps === 0 || dt <= 0)) {
      setIsPlaying(false);
    }
  }, [isPlaying, thResults, totalSteps, dt, setIsPlaying]);

  return null;
}
