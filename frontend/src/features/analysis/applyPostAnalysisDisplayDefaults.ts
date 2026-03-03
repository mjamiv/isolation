import type { AnalysisResults } from '@/types/analysis';
import { useDisplayStore } from '@/stores/displayStore';

interface ApplyDisplayDefaultsOptions {
  resultType: AnalysisResults['type'] | 'comparison';
  hasBearings: boolean;
  showComparisonOverlay: boolean;
}

export function applyPostAnalysisDisplayDefaults(options: ApplyDisplayDefaultsOptions): void {
  const display = useDisplayStore.getState();
  const resultType = options.resultType;

  if (resultType === 'static' || resultType === 'pushover' || resultType === 'time_history') {
    display.setShowDeformed(true);
    display.setHideUndeformed(false);
    display.setScaleFactor(100);
    display.setShowForces(false);
    display.setForceType('none');
    display.setColorMap('none');
  }

  display.setShowComparisonOverlay(options.showComparisonOverlay);
  display.setShowBearingDisplacement(options.hasBearings);
  display.setShowBaseShearLabels(resultType === 'pushover');
}
