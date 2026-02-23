import { useMemo } from 'react';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import type { ForceType } from '@/stores/displayStore';
import type { StaticResults, TimeHistoryResults, PushoverResults } from '@/types/analysis';

interface DiagramItem {
  elementId: number;
  stemI: [THREE.Vector3, THREE.Vector3];
  stemJ: [THREE.Vector3, THREE.Vector3];
  top: [THREE.Vector3, THREE.Vector3];
  quad: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
  mid: THREE.Vector3;
  valueI: number;
  valueJ: number;
  color: string;
}

function maxAbsSigned(values: number[]): number {
  let out = 0;
  for (const v of values) {
    if (Math.abs(v) > Math.abs(out)) {
      out = v;
    }
  }
  return out;
}

function getEndValues(forceVec: number[], forceType: ForceType): [number, number] {
  const n = forceVec.length;
  if (n === 0 || forceType === 'none') return [0, 0];

  const half = Math.max(1, Math.floor(n / 2));
  const pick = (idx: number) => (idx >= 0 && idx < n ? (forceVec[idx] ?? 0) : 0);

  if (forceType === 'axial') {
    const iVal = pick(0);
    const jVal = pick(half);
    return [iVal, jVal];
  }

  if (forceType === 'shear') {
    if (n >= 12) {
      return [maxAbsSigned([pick(1), pick(2)]), maxAbsSigned([pick(half + 1), pick(half + 2)])];
    }
    if (n >= 6) {
      return [pick(1), pick(4)];
    }
    return [pick(1), pick(n - 1)];
  }

  if (forceType === 'moment') {
    if (n >= 12) {
      return [maxAbsSigned([pick(4), pick(5)]), maxAbsSigned([pick(half + 4), pick(half + 5)])];
    }
    if (n >= 6) {
      return [pick(2), pick(5)];
    }
    return [pick(2), pick(n - 1)];
  }

  return [0, 0];
}

function colorFor(type: ForceType, value: number): string {
  if (type === 'moment') {
    return value >= 0 ? '#f59e0b' : '#fb7185';
  }
  if (type === 'shear') {
    return value >= 0 ? '#38bdf8' : '#f43f5e';
  }
  if (type === 'axial') {
    return value >= 0 ? '#22c55e' : '#ef4444';
  }
  return '#9ca3af';
}

function prettyForceType(type: ForceType): string {
  if (type === 'moment') return 'Moment';
  if (type === 'shear') return 'Shear';
  if (type === 'axial') return 'Axial';
  return 'None';
}

function inferUnits(forceType: ForceType, unitsRaw: string | undefined): string {
  const units = unitsRaw ?? '';
  const [forceUnitRaw, lengthUnitRaw] = units.includes('-')
    ? units.split('-', 2)
    : ['force', 'length'];
  const forceUnit = forceUnitRaw || 'force';
  const lengthUnit = lengthUnitRaw || 'length';

  if (forceType === 'moment') {
    return `${forceUnit}-${lengthUnit}`;
  }
  if (forceType === 'shear' || forceType === 'axial') {
    return forceUnit;
  }
  return '';
}

/** Compute the diagram normal for a member axis. Uses in-plane normal for 2D frames. */
function computeNormal(pI: THREE.Vector3, pJ: THREE.Vector3): THREE.Vector3 {
  const axis = new THREE.Vector3().subVectors(pJ, pI).normalize();

  // Detect 2D frame (both nodes have Z near 0) — use in-plane normal
  if (Math.abs(pI.z) < 1e-3 && Math.abs(pJ.z) < 1e-3) {
    return new THREE.Vector3(-axis.y, axis.x, 0).normalize();
  }

  let up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(axis.dot(up)) > 0.9) {
    up = new THREE.Vector3(1, 0, 0);
  }
  return new THREE.Vector3().crossVectors(axis, up).normalize();
}

export function ForceDiagrams() {
  const model = useModelStore((s) => s.model);
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);
  const results = useAnalysisStore((s) => s.results);
  const currentTimeStep = useAnalysisStore((s) => s.currentTimeStep);
  const forceType = useDisplayStore((s) => s.forceType);
  const forceScale = useDisplayStore((s) => s.forceScale);
  const showLabels = useDisplayStore((s) => s.showLabels);
  const selectedElementIds = useDisplayStore((s) => s.selectedElementIds);

  const sceneMetrics = useMemo(() => {
    const nodeArray = Array.from(nodes.values());
    if (nodeArray.length === 0) {
      return {
        modelSize: 1,
        legendPosition: new THREE.Vector3(0, 0, 0),
      };
    }

    const xs = nodeArray.map((n) => n.x);
    const ys = nodeArray.map((n) => n.y);
    const zs = nodeArray.map((n) => n.z);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);

    const modelSize = Math.max(1, maxX - minX, maxY - minY, maxZ - minZ);
    const legendPosition = new THREE.Vector3(
      minX,
      maxY + modelSize * 0.12,
      maxZ + modelSize * 0.04,
    );

    return { modelSize, legendPosition };
  }, [nodes]);

  const forceByElement = useMemo(() => {
    if (!results?.results || forceType === 'none') return {} as Record<number, number[]>;

    if (results.type === 'static') {
      return (results.results as StaticResults).elementForces;
    }

    if (results.type === 'pushover') {
      return ((results.results as PushoverResults).elementForces ?? {}) as Record<number, number[]>;
    }

    if (results.type === 'time_history') {
      const th = results.results as TimeHistoryResults;
      const step = th.timeSteps[currentTimeStep];
      return (step?.elementForces ?? {}) as Record<number, number[]>;
    }

    return {} as Record<number, number[]>;
  }, [results, forceType, currentTimeStep]);

  const discretizationData = useMemo(() => {
    if (!results?.results) return null;
    const r = results.results as StaticResults | PushoverResults | TimeHistoryResults;
    if ('discretizationMap' in r && r.discretizationMap && r.internalNodeCoords) {
      return {
        map: r.discretizationMap,
        internalCoords: r.internalNodeCoords,
      };
    }
    return null;
  }, [results]);

  const diagramItems = useMemo(() => {
    if (forceType === 'none') return [] as DiagramItem[];

    const endValuesByElement: Array<{
      id: number;
      i: number;
      j: number;
      pI: THREE.Vector3;
      pJ: THREE.Vector3;
    }> = [];

    if (discretizationData) {
      const handledSubIds = new Set<number>();
      const { map: discMap, internalCoords } = discretizationData;

      // Helper to get a node position from store or internalCoords
      const getNodePos = (nodeId: number): THREE.Vector3 | null => {
        const storeNode = nodes.get(nodeId);
        if (storeNode) return new THREE.Vector3(storeNode.x, storeNode.y, storeNode.z);
        const ic = internalCoords[nodeId] ?? internalCoords[String(nodeId) as unknown as number];
        if (ic && ic.length >= 3) return new THREE.Vector3(ic[0]!, ic[1]!, ic[2]!);
        if (ic && ic.length >= 2) return new THREE.Vector3(ic[0]!, ic[1]!, 0);
        return null;
      };

      // Process discretized elements
      for (const [origIdStr, entry] of Object.entries(discMap)) {
        const origId = Number(origIdStr);
        const { nodeChain, subElementIds } = entry;

        for (let s = 0; s < subElementIds.length; s++) {
          const subId = subElementIds[s]!;
          handledSubIds.add(subId);

          const vec = forceByElement[subId];
          if (!vec) continue;

          const nodeIId = nodeChain[s]!;
          const nodeJId = nodeChain[s + 1]!;
          const pI = getNodePos(nodeIId);
          const pJ = getNodePos(nodeJId);
          if (!pI || !pJ) continue;

          const values = Array.isArray(vec) ? vec : [];
          const [vI, vJ] = getEndValues(values, forceType);
          // Use origId so selection highlighting works on original element
          endValuesByElement.push({ id: origId, i: vI, j: vJ, pI, pJ });
        }
      }

      // Process non-discretized elements (bearings, etc.)
      for (const [rawId, vec] of Object.entries(forceByElement)) {
        const id = Number(rawId);
        if (handledSubIds.has(id)) continue;

        const el = elements.get(id);
        if (!el) continue;
        const nI = nodes.get(el.nodeI);
        const nJ = nodes.get(el.nodeJ);
        if (!nI || !nJ) continue;

        const pI = new THREE.Vector3(nI.x, nI.y, nI.z);
        const pJ = new THREE.Vector3(nJ.x, nJ.y, nJ.z);
        const values = Array.isArray(vec) ? vec : [];
        const [vI, vJ] = getEndValues(values, forceType);
        endValuesByElement.push({ id, i: vI, j: vJ, pI, pJ });
      }
    } else {
      // No discretization — original logic
      for (const [rawId, vec] of Object.entries(forceByElement)) {
        const id = Number(rawId);
        const el = elements.get(id);
        if (!el) continue;
        const nI = nodes.get(el.nodeI);
        const nJ = nodes.get(el.nodeJ);
        if (!nI || !nJ) continue;

        const pI = new THREE.Vector3(nI.x, nI.y, nI.z);
        const pJ = new THREE.Vector3(nJ.x, nJ.y, nJ.z);
        const values = Array.isArray(vec) ? vec : [];
        const [vI, vJ] = getEndValues(values, forceType);
        endValuesByElement.push({ id, i: vI, j: vJ, pI, pJ });
      }
    }

    let maxAbs = 0;
    for (const ev of endValuesByElement) {
      maxAbs = Math.max(maxAbs, Math.abs(ev.i), Math.abs(ev.j));
    }
    if (maxAbs < 1e-9) maxAbs = 1;

    const amp = sceneMetrics.modelSize * 0.18 * Math.max(0.1, forceScale);
    const scale = amp / maxAbs;

    const out: DiagramItem[] = [];

    for (const ev of endValuesByElement) {
      const { pI, pJ } = ev;
      const len = pI.distanceTo(pJ);
      if (len < 1e-9) continue;

      const normal = computeNormal(pI, pJ);

      const offI = normal.clone().multiplyScalar(ev.i * scale);
      const offJ = normal.clone().multiplyScalar(ev.j * scale);
      const pId = pI.clone().add(offI);
      const pJd = pJ.clone().add(offJ);
      const mid = new THREE.Vector3().addVectors(pId, pJd).multiplyScalar(0.5);

      const color = colorFor(forceType, 0.5 * (ev.i + ev.j));

      out.push({
        elementId: ev.id,
        stemI: [pI, pId],
        stemJ: [pJ, pJd],
        top: [pId, pJd],
        quad: [pI, pJ, pJd, pId],
        mid,
        valueI: ev.i,
        valueJ: ev.j,
        color,
      });
    }

    return out;
  }, [
    nodes,
    elements,
    forceByElement,
    forceType,
    forceScale,
    sceneMetrics.modelSize,
    discretizationData,
  ]);

  if (diagramItems.length === 0) return null;

  const showOnlySelected = selectedElementIds.size > 0;
  const unitsLabel = inferUnits(forceType, model?.units);

  return (
    <group>
      <Html
        position={[
          sceneMetrics.legendPosition.x,
          sceneMetrics.legendPosition.y,
          sceneMetrics.legendPosition.z,
        ]}
        transform
        style={{ pointerEvents: 'none' }}
      >
        <div className="rounded bg-gray-900/90 px-2 py-1 text-[10px] font-mono text-gray-100 ring-1 ring-gray-700">
          <div className="text-yellow-300">Force Diagram</div>
          <div>
            {prettyForceType(forceType)}
            {unitsLabel ? ` (${unitsLabel})` : ''}
          </div>
          <div>Scale {forceScale.toFixed(1)}x</div>
          <div>Filled Area: On</div>
        </div>
      </Html>

      {diagramItems.map((item, idx) => {
        if (showOnlySelected && !selectedElementIds.has(item.elementId)) return null;

        const [q0, q1, q2, q3] = item.quad;
        const positions = new Float32Array([
          q0.x,
          q0.y,
          q0.z,
          q1.x,
          q1.y,
          q1.z,
          q2.x,
          q2.y,
          q2.z,
          q3.x,
          q3.y,
          q3.z,
        ]);

        return (
          <group key={`force-${item.elementId}-${idx}`}>
            <mesh renderOrder={2}>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                <bufferAttribute attach="index" args={[new Uint16Array([0, 1, 2, 0, 2, 3]), 1]} />
              </bufferGeometry>
              <meshBasicMaterial
                color={item.color}
                transparent
                opacity={forceType === 'moment' ? 0.28 : 0.22}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>

            <Line points={item.stemI} color={item.color} lineWidth={1.2} />
            <Line points={item.stemJ} color={item.color} lineWidth={1.2} />
            <Line points={item.top} color={item.color} lineWidth={2.2} />

            {(showLabels || selectedElementIds.has(item.elementId)) && (
              <Html
                position={[item.mid.x, item.mid.y, item.mid.z]}
                center
                style={{ pointerEvents: 'none' }}
              >
                <div className="whitespace-nowrap rounded bg-gray-900/90 px-1.5 py-0.5 text-[10px] font-mono text-gray-100 ring-1 ring-gray-700">
                  E{item.elementId} {item.valueI.toFixed(1)} | {item.valueJ.toFixed(1)}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
