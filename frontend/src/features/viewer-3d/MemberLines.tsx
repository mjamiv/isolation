import { useMemo, useCallback, useRef } from 'react';
import { Line, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { useModelStore, type Element, type Node, type Section } from '../../stores/modelStore';
import { useDisplayStore, type DisplayMode } from '../../stores/displayStore';

// Colors by element type
const ELEMENT_COLORS: Record<Element['type'], string> = {
  column: '#facc15', // yellow-400
  beam: '#fde047', // yellow-300
  brace: '#fb923c', // orange-400
  bearing: '#c084fc', // purple-400
};

// Slightly darker/saturated colors for solid mode to distinguish from extruded
const SOLID_COLORS: Record<Element['type'], string> = {
  column: '#eab308', // yellow-500
  beam: '#ca8a04', // yellow-600
  brace: '#f97316', // orange-500
  bearing: '#a855f7', // purple-500
};

const COLOR_SELECTED = '#D4AF37'; // gold
const COLOR_HOVERED = '#FACC15'; // yellow-400
const LINE_WIDTH_DEFAULT = 2;
const LINE_WIDTH_SELECTED = 4;
const LINE_WIDTH_HOVERED = 3;

// Fallback cross-section size (inches) when section has no depth
const DEFAULT_DEPTH = 12;
const DEFAULT_WIDTH = 6;

// ── Wireframe member (Line) ─────────────────────────────────────────

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

// ── Helper: compute member geometry transform ───────────────────────

function useMemberTransform(nodeI: Node, nodeJ: Node) {
  return useMemo(() => {
    const start = new THREE.Vector3(nodeI.x, nodeI.y, nodeI.z);
    const end = new THREE.Vector3(nodeJ.x, nodeJ.y, nodeJ.z);
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();

    // Compute quaternion that rotates the Y-axis (BoxGeometry default) to the member axis
    const quaternion = new THREE.Quaternion();
    if (length > 0) {
      const normalizedDir = direction.clone().normalize();
      // BoxGeometry is centered at origin, extends along Y axis by default
      // We need to rotate from (0,1,0) to the member direction
      quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normalizedDir);
    }

    return { midpoint, length, quaternion };
  }, [nodeI.x, nodeI.y, nodeI.z, nodeJ.x, nodeJ.y, nodeJ.z]);
}

// ── Extruded member (semi-transparent box with wireframe edges) ─────

interface MemberExtrudedProps {
  element: Element;
  nodeI: Node;
  nodeJ: Node;
  section: Section | undefined;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (id: number, multi: boolean) => void;
  onHover: (id: number | null) => void;
}

function MemberExtruded({
  element,
  nodeI,
  nodeJ,
  section,
  isSelected,
  isHovered,
  onSelect,
  onHover,
}: MemberExtrudedProps) {
  const { midpoint, length, quaternion } = useMemberTransform(nodeI, nodeJ);
  const meshRef = useRef<THREE.Mesh>(null);

  // Cross-section dimensions from section properties
  const depth = section?.d ?? DEFAULT_DEPTH;
  const width = section?.bf ?? DEFAULT_WIDTH;

  let color = ELEMENT_COLORS[element.type];
  if (isSelected) {
    color = COLOR_SELECTED;
  } else if (isHovered) {
    color = COLOR_HOVERED;
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

  if (length === 0) return null;

  // BoxGeometry(width, height, depth) — here height = member length (along Y before rotation)
  // width = flange width (local X), depth = section depth (local Z)
  return (
    <mesh
      ref={meshRef}
      position={[midpoint.x, midpoint.y, midpoint.z]}
      quaternion={quaternion}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <boxGeometry args={[width, length, depth]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.35}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
      <Edges color={color} threshold={15} />
    </mesh>
  );
}

// ── Solid member (opaque box with standard material) ────────────────

interface MemberSolidProps {
  element: Element;
  nodeI: Node;
  nodeJ: Node;
  section: Section | undefined;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (id: number, multi: boolean) => void;
  onHover: (id: number | null) => void;
}

function MemberSolid({
  element,
  nodeI,
  nodeJ,
  section,
  isSelected,
  isHovered,
  onSelect,
  onHover,
}: MemberSolidProps) {
  const { midpoint, length, quaternion } = useMemberTransform(nodeI, nodeJ);
  const meshRef = useRef<THREE.Mesh>(null);

  // Cross-section dimensions from section properties
  const depth = section?.d ?? DEFAULT_DEPTH;
  const width = section?.bf ?? DEFAULT_WIDTH;

  let color = SOLID_COLORS[element.type];
  if (isSelected) {
    color = COLOR_SELECTED;
  } else if (isHovered) {
    color = COLOR_HOVERED;
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

  if (length === 0) return null;

  return (
    <mesh
      ref={meshRef}
      position={[midpoint.x, midpoint.y, midpoint.z]}
      quaternion={quaternion}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <boxGeometry args={[width, length, depth]} />
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.2} />
    </mesh>
  );
}

// ── Container component ─────────────────────────────────────────────

export function MemberLines() {
  const nodes = useModelStore((state) => state.nodes);
  const elements = useModelStore((state) => state.elements);
  const sections = useModelStore((state) => state.sections);
  const displayMode: DisplayMode = useDisplayStore((state) => state.displayMode);
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

        const isSelected = selectedElementIds.has(element.id);
        const isHovered = hoveredElementId === element.id;

        if (displayMode === 'extruded') {
          const section = sections.get(element.sectionId);
          return (
            <MemberExtruded
              key={element.id}
              element={element}
              nodeI={nodeI}
              nodeJ={nodeJ}
              section={section}
              isSelected={isSelected}
              isHovered={isHovered}
              onSelect={selectElement}
              onHover={setHoveredElement}
            />
          );
        }

        if (displayMode === 'solid') {
          const section = sections.get(element.sectionId);
          return (
            <MemberSolid
              key={element.id}
              element={element}
              nodeI={nodeI}
              nodeJ={nodeJ}
              section={section}
              isSelected={isSelected}
              isHovered={isHovered}
              onSelect={selectElement}
              onHover={setHoveredElement}
            />
          );
        }

        // Default: wireframe mode
        return (
          <MemberLine
            key={element.id}
            element={element}
            nodeI={nodeI}
            nodeJ={nodeJ}
            isSelected={isSelected}
            isHovered={isHovered}
            onSelect={selectElement}
            onHover={setHoveredElement}
          />
        );
      })}
    </group>
  );
}
