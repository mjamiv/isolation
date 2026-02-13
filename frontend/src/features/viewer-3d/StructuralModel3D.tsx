import { useModelStore } from '../../stores/modelStore';
import { useDisplayStore } from '../../stores/displayStore';
import { useAnalysisStore } from '../../stores/analysisStore';
import { NodePoints } from './NodePoints';
import { MemberLines } from './MemberLines';
import { SupportSymbols } from './SupportSymbols';
import { BearingSymbols } from './BearingSymbols';
import { NodeLabels, ElementLabels } from './Labels';
import { DeformedShape } from './DeformedShape';
import { ModeShapeAnimation } from './ModeShapeAnimation';
import { PlasticHinges } from './PlasticHinges';
import { PlaybackDriver } from './PlaybackDriver';

export function StructuralModel3D() {
  const model = useModelStore((state) => state.model);
  const showDeformed = useDisplayStore((state) => state.showDeformed);
  const results = useAnalysisStore((state) => state.results);
  const selectedModeNumber = useAnalysisStore((state) => state.selectedModeNumber);

  if (!model) {
    return null;
  }

  const hasModalResults = results?.type === 'modal' && selectedModeNumber !== null;
  const hasHingeStates = (results?.hingeStates?.length ?? 0) > 0;
  const hasTimeHistory = results?.type === 'time_history';

  return (
    <group>
      <MemberLines />
      <NodePoints />
      <SupportSymbols />
      <BearingSymbols />
      <NodeLabels />
      <ElementLabels />
      {showDeformed && <DeformedShape />}
      {hasModalResults && <ModeShapeAnimation />}
      {hasHingeStates && <PlasticHinges />}
      {hasTimeHistory && <PlaybackDriver />}
    </group>
  );
}
