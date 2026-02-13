import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { useAnalysisStore } from '@/stores/analysisStore';
import type { TimeHistoryResults } from '@/types/analysis';

export function PlaybackDriver() {
  const isPlaying = useAnalysisStore((s) => s.isPlaying);
  const playbackSpeed = useAnalysisStore((s) => s.playbackSpeed);
  const results = useAnalysisStore((s) => s.results);
  const setTimeStep = useAnalysisStore((s) => s.setTimeStep);

  const accumulatorRef = useRef(0);

  useFrame((_, delta) => {
    if (!isPlaying || !results?.results || results.type !== 'time_history') return;

    const thResults = results.results as TimeHistoryResults;
    const totalSteps = thResults.timeSteps.length;
    if (totalSteps === 0) return;

    const dt = thResults.dt;
    accumulatorRef.current += delta * playbackSpeed;

    if (accumulatorRef.current >= dt) {
      accumulatorRef.current -= dt;
      const currentStep = useAnalysisStore.getState().currentTimeStep;
      const nextStep = (currentStep + 1) % totalSteps;
      setTimeStep(nextStep);
    }
  });

  return null;
}
