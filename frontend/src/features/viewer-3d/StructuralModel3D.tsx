import { useModelStore } from '../../stores/modelStore';
import { NodePoints } from './NodePoints';
import { MemberLines } from './MemberLines';
import { SupportSymbols } from './SupportSymbols';

export function StructuralModel3D() {
  const model = useModelStore((state) => state.model);

  if (!model) {
    return null;
  }

  return (
    <group>
      <MemberLines />
      <NodePoints />
      <SupportSymbols />
    </group>
  );
}
