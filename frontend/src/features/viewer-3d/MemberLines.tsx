import { useMemo, useCallback } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { useModelStore, type Element, type Node } from '../../stores/modelStore';
import { useDisplayStore } from '../../stores/displayStore';

// Colors by element type
const ELEMENT_COLORS: Record<Element['type'], string> = {
  column: '#60a5fa',  // blue-400
  beam: '#34d399',    // emerald-400
  brace: '#fb923c',   // orange-400
  bearing: '#c084fc',  // purple-400
};

const COLOR_SELECTED = '#f59e0b';  // amber-500
const COLOR_HOVERED = '#fbbf24';   // amber-400
const LINE_WIDTH_DEFAULT = 2;
const LINE_WIDTH_SELECTED = 4;
const LINE_WIDTH_HOVERED = 3;

interface MemberLineProps {
  element: Element;
  nodeI: Node;
  nodeJ: Node;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (id: number, multi: boolean) => void;
  onHover: (id: number | null) => void;
}

function MemberLine({
  element,
  nodeI,
  nodeJ,
  isSelected,
  isHovered,
  onSelect,
  onHover,
}: MemberLineProps) {
  const points = useMemo(
    () => [
      new THREE.Vector3(nodeI.x, nodeI.y, nodeI.z),
      new THREE.Vector3(nodeJ.x, nodeJ.y, nodeJ.z),
    ],
    [nodeI.x, nodeI.y, nodeI.z, nodeJ.x, nodeJ.y, nodeJ.z],
  );

  let color = ELEMENT_COLORS[element.type];
  let lineWidth = LINE_WIDTH_DEFAULT;

  if (isSelected) {
    color = COLOR_SELECTED;
    lineWidth = LINE_WIDTH_SELECTED;
  } else if (isHovered) {
    color = COLOR_HOVERED;
    lineWidth = LINE_WIDTH_HOVERED;
  }

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect(element.id, e.nativeEvent.shiftKey);
    },
    [element.id, onSelect],
  );

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(element.id);
    },
    [element.id, onHover],
  );

  const handlePointerOut = useCallback(() => {
    onHover(null);
  }, [onHover]);

  return (
    <Line
      points={points}
      color={color}
      lineWidth={lineWidth}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    />
  );
}

export function MemberLines() {
  const nodes = useModelStore((state) => state.nodes);
  const elements = useModelStore((state) => state.elements);
  const selectedElementIds = useDisplayStore((state) => state.selectedElementIds);
  const hoveredElementId = useDisplayStore((state) => state.hoveredElementId);
  const selectElement = useDisplayStore((state) => state.selectElement);
  const setHoveredElement = useDisplayStore((state) => state.setHoveredElement);

  const elementArray = useMemo(() => Array.from(elements.values()), [elements]);

  return (
    <group>
      {elementArray.map((element) => {
        const nodeI = nodes.get(element.nodeI);
        const nodeJ = nodes.get(element.nodeJ);
        if (!nodeI || !nodeJ) return null;

        return (
          <MemberLine
            key={element.id}
            element={element}
            nodeI={nodeI}
            nodeJ={nodeJ}
            isSelected={selectedElementIds.has(element.id)}
            isHovered={hoveredElementId === element.id}
            onSelect={selectElement}
            onHover={setHoveredElement}
          />
        );
      })}
    </group>
  );
}
