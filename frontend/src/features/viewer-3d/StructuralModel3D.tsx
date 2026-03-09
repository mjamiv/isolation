import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useModelStore } from '../../stores/modelStore';
import { useDisplayStore } from '../../stores/displayStore';
import { useAnalysisStore } from '../../stores/analysisStore';
import { useComparisonStore } from '../../stores/comparisonStore';
import { NodePoints } from './NodePoints';
import { MemberLines } from './MemberLines';
import { SupportSymbols } from './SupportSymbols';
import { DiaphragmPlanes } from './DiaphragmPlanes';
import { ConstraintLinks } from './ConstraintLinks';
import { NodeLabels, ElementLabels } from './Labels';
import { ElementPropertyLabels } from './ElementPropertyLabels';
import { BaseShearLabels } from './BaseShearLabels';
import { DeformedShape } from './DeformedShape';
import { ModeShapeAnimation } from './ModeShapeAnimation';
import { PlasticHinges } from './PlasticHinges';
import { PlaybackDriver } from './PlaybackDriver';
import { ForceDiagrams } from './ForceDiagrams';

export const StructuralModel3D = memo(function StructuralModel3D() {
  const model = useModelStore((state) => state.model);
  const { showDeformed, hideUndeformed, showForces, forceType } = useDisplayStore(
    useShallow((s) => ({
      showDeformed: s.showDeformed,
      hideUndeformed: s.hideUndeformed,
      showForces: s.showForces,
      forceType: s.forceType,
    })),
  );
  const results = useAnalysisStore((state) => state.results);
  const selectedModeNumber = useAnalysisStore((state) => state.selectedModeNumber);
  const comparisonType = useComparisonStore((state) => state.comparisonType);

  if (!model) {
    return null;
  }

  const hasModalResults =
    results?.type === 'modal' && selectedModeNumber !== null && comparisonType === null;
  const hasHingeStates = (results?.hingeStates?.length ?? 0) > 0;
  const hasTimeHistory = results?.type === 'time_history';
  const hasComparisonTimeHistory = comparisonType === 'time_history';
  const hasForceResults =
    results?.type === 'static' || results?.type === 'time_history' || results?.type === 'pushover';

  const hideOriginal = showDeformed && hideUndeformed;

  return (
    <group>
      {!hideOriginal && <MemberLines />}
      {!hideOriginal && <NodePoints />}
      <SupportSymbols />
      <DiaphragmPlanes />
      <ConstraintLinks />
      <NodeLabels />
      <ElementLabels />
      <ElementPropertyLabels />
      <BaseShearLabels />
      {showDeformed && <DeformedShape />}
      {showForces && forceType !== 'none' && hasForceResults && <ForceDiagrams />}
      {hasModalResults && <ModeShapeAnimation />}
      {hasHingeStates && <PlasticHinges />}
      {(hasTimeHistory || hasComparisonTimeHistory) && <PlaybackDriver />}
    </group>
  );
});
