import { useMemo } from 'react';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useComparisonStore } from '@/stores/comparisonStore';
import { useModelStore } from '@/stores/modelStore';
import type { PushoverResults, StaticResults, TimeHistoryResults } from '@/types/analysis';

export type NodeDisplacementMap = Record<number | string, number[]>;

export interface ActiveDisplacements {
  nodeDisplacements: NodeDisplacementMap | null;
  zUpData: boolean;
}

export function toViewerTranslation(
  disp: number[] | undefined,
  scaleFactor: number,
  is2DFrame: boolean,
  zUpData: boolean,
): [number, number, number] {
  if (!disp || disp.length < 2) return [0, 0, 0];
  const dx = (disp[0] ?? 0) * scaleFactor;
  const dyRaw = zUpData ? (disp[2] ?? 0) : (disp[1] ?? 0);
  const dzRaw = zUpData ? (disp[1] ?? 0) : (disp[2] ?? 0);
  const dy = dyRaw * scaleFactor;
  const dz = !is2DFrame && disp.length >= 3 ? dzRaw * scaleFactor : 0;
  return [dx, dy, dz];
}

export function useActiveDisplacements(): ActiveDisplacements {
  const results = useAnalysisStore((s) => s.results);
  const currentTimeStep = useAnalysisStore((s) => s.currentTimeStep);
  const comparisonType = useComparisonStore((s) => s.comparisonType);
  const comparisonIsolated = useComparisonStore((s) => s.isolated);

  const nodeDisplacements = useMemo(() => {
    if (comparisonType === 'time_history' && comparisonIsolated?.timeHistoryResults) {
      const step = comparisonIsolated.timeHistoryResults.timeSteps[currentTimeStep];
      return step?.nodeDisplacements ?? null;
    }

    if (!results?.results) return null;

    if (results.type === 'static') {
      return (results.results as StaticResults).nodeDisplacements;
    }

    if (results.type === 'time_history') {
      const th = results.results as TimeHistoryResults;
      const step = th.timeSteps[currentTimeStep];
      return step?.nodeDisplacements ?? null;
    }

    if (results.type === 'pushover') {
      return (results.results as PushoverResults).nodeDisplacements ?? null;
    }

    return null;
  }, [results, currentTimeStep, comparisonType, comparisonIsolated]);

  const hasBearings = useModelStore((s) => s.bearings.size > 0);
  const zUpData = hasBearings;

  return { nodeDisplacements, zUpData };
}
