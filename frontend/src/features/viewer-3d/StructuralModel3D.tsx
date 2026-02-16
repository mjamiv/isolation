import { useModelStore } from '../../stores/modelStore';
import { useDisplayStore } from '../../stores/displayStore';
import { useAnalysisStore } from '../../stores/analysisStore';
import { useComparisonStore } from '../../stores/comparisonStore';
import { NodePoints } from './NodePoints';
import { MemberLines } from './MemberLines';
import { SupportSymbols } from './SupportSymbols';
import { BearingSymbols } from './BearingSymbols';
import { NodeLabels, ElementLabels } from './Labels';
import { DeformedShape } from './DeformedShape';
import { ModeShapeAnimation } from './ModeShapeAnimation';
import { PlasticHinges } from './PlasticHinges';
import { PlaybackDriver } from './PlaybackDriver';
import { ForceDiagrams } from './ForceDiagrams';

export function StructuralModel3D() {
  const model = useModelStore((state) => state.model);
  const showDeformed = useDisplayStore((state) => state.showDeformed);
  const showForces = useDisplayStore((state) => state.showForces);
  const forceType = useDisplayStore((state) => state.forceType);
  const results = useAnalysisStore((state) => state.results);
  const selectedModeNumber = useAnalysisStore((state) => state.selectedModeNumber);
  const comparisonType = useComparisonStore((state) => state.comparisonType);

  if (!model) {
    return null;
  }

  const hasModalResults = results?.type === 'modal' && selectedModeNumber !== null;
  const hasHingeStates = (results?.hingeStates?.length ?? 0) > 0;
  const hasTimeHistory = results?.type === 'time_history';
  const hasComparisonTimeHistory = comparisonType === 'time_history';
  const hasForceResults =
    results?.type === 'static' || results?.type === 'time_history' || results?.type === 'pushover';

  return (
    <group>
      <MemberLines />
      <NodePoints />
      <SupportSymbols />
      <BearingSymbols />
      <NodeLabels />
      <ElementLabels />
      {showDeformed && <DeformedShape />}
      {showForces && forceType !== 'none' && hasForceResults && <ForceDiagrams />}
      {hasModalResults && <ModeShapeAnimation />}
      {hasHingeStates && <PlasticHinges />}
      {(hasTimeHistory || hasComparisonTimeHistory) && <PlaybackDriver />}
    </group>
  );
}
