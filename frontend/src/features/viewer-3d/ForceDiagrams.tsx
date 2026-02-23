import { useMemo } from 'react';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import type { ForceType } from '@/stores/displayStore';
import type { StaticResults, TimeHistoryResults, PushoverResults } from '@/types/analysis';

const LARGE_MODEL_FORCE_DIAGRAM_THRESHOLD = 120;

interface DiagramItem {
  elementId: number;
  base: THREE.Vector3[];
  top: THREE.Vector3[];
  stemI: [THREE.Vector3, THREE.Vector3];
  stemJ: [THREE.Vector3, THREE.Vector3];
  mid: THREE.Vector3;
  valueI: number;
  valueJ: number;
  color: string;
}

function getEndValues(
  forceVec: number[],
  forceType: ForceType,
): { i: number; j: number; component: 'y' | 'z' | null } {
  const n = forceVec.length;
  if (n === 0 || forceType === 'none') return { i: 0, j: 0, component: null };

  const half = Math.max(1, Math.floor(n / 2));
  const pick = (idx: number) => (idx >= 0 && idx < n ? (forceVec[idx] ?? 0) : 0);

  if (forceType === 'axial') {
    const iVal = pick(0);
    const jVal = pick(half);
    return { i: iVal, j: jVal, component: null };
  }

  if (forceType === 'shear') {
    if (n >= 12) {
      const vyI = pick(1);
      const vzI = pick(2);
      const vyJ = pick(half + 1);
      const vzJ = pick(half + 2);
      const yMag = Math.max(Math.abs(vyI), Math.abs(vyJ));
      const zMag = Math.max(Math.abs(vzI), Math.abs(vzJ));
      if (yMag >= zMag) return { i: vyI, j: vyJ, component: 'y' };
      return { i: vzI, j: vzJ, component: 'z' };
    }
    if (n >= 6) {
      return { i: pick(1), j: pick(4), component: null };
    }
    return { i: pick(1), j: pick(n - 1), component: null };
  }

  if (forceType === 'moment') {
    if (n >= 12) {
      const myI = pick(4);
      const mzI = pick(5);
      const myJ = pick(half + 4);
      const mzJ = pick(half + 5);
      const yMag = Math.max(Math.abs(myI), Math.abs(myJ));
      const zMag = Math.max(Math.abs(mzI), Math.abs(mzJ));
      if (yMag >= zMag) return { i: myI, j: myJ, component: 'y' };
      return { i: mzI, j: mzJ, component: 'z' };
    }
    if (n >= 6) {
      return { i: pick(2), j: pick(5), component: null };
    }
    return { i: pick(2), j: pick(n - 1), component: null };
  }

  return { i: 0, j: 0, component: null };
}

function getComponentMagnitudes(
  forceVec: number[],
  forceType: ForceType,
): { y: number; z: number } | null {
  const n = forceVec.length;
  if (n < 12) return null;
  const half = Math.max(1, Math.floor(n / 2));
  const pick = (idx: number) => (idx >= 0 && idx < n ? (forceVec[idx] ?? 0) : 0);

  if (forceType === 'shear') {
    return {
      y: Math.max(Math.abs(pick(1)), Math.abs(pick(half + 1))),
      z: Math.max(Math.abs(pick(2)), Math.abs(pick(half + 2))),
    };
  }
  if (forceType === 'moment') {
    return {
      y: Math.max(Math.abs(pick(4)), Math.abs(pick(half + 4))),
      z: Math.max(Math.abs(pick(5)), Math.abs(pick(half + 5))),
    };
  }
  return null;
}

function getEndValuesWithComponent(
  forceVec: number[],
  forceType: ForceType,
  component: 'y' | 'z' | null,
): { i: number; j: number } {
  const n = forceVec.length;
  if (n >= 12 && component && (forceType === 'shear' || forceType === 'moment')) {
    const half = Math.max(1, Math.floor(n / 2));
    if (forceType === 'shear') {
      const idx = component === 'y' ? 1 : 2;
      return { i: forceVec[idx] ?? 0, j: forceVec[half + idx] ?? 0 };
    }
    const idx = component === 'y' ? 4 : 5;
    return { i: forceVec[idx] ?? 0, j: forceVec[half + idx] ?? 0 };
  }
  const auto = getEndValues(forceVec, forceType);
  return { i: auto.i, j: auto.j };
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

function computeDiagramNormal(
  pI: THREE.Vector3,
  pJ: THREE.Vector3,
  forceType: ForceType,
  component: 'y' | 'z' | null,
  zUpData: boolean,
): THREE.Vector3 {
  // Keep 2D behavior unchanged.
  if (Math.abs(pI.z) < 1e-3 && Math.abs(pJ.z) < 1e-3) {
    return computeNormal(pI, pJ);
  }
  if (component === null || forceType === 'axial') {
    return computeNormal(pI, pJ);
  }

  const toBackendCoords = (v: THREE.Vector3) =>
    zUpData ? new THREE.Vector3(v.x, v.z, v.y) : v.clone();
  const fromBackendVector = (v: THREE.Vector3) =>
    zUpData ? new THREE.Vector3(v.x, v.z, v.y) : v.clone();

  const bI = toBackendCoords(pI);
  const bJ = toBackendCoords(pJ);
  const localX = new THREE.Vector3().subVectors(bJ, bI);
  if (localX.lengthSq() < 1e-12) return computeNormal(pI, pJ);
  localX.normalize();

  // Mirror backend vecxz convention to keep force components on correct local planes.
  const verticalComponent = zUpData ? localX.z : localX.y;
  const vecxz =
    Math.abs(verticalComponent) > 0.9
      ? new THREE.Vector3(1, 0, 0)
      : zUpData
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(0, 1, 0);

  let localYb = new THREE.Vector3().crossVectors(vecxz, localX);
  if (localYb.lengthSq() < 1e-12) localYb = new THREE.Vector3(0, 1, 0);
  localYb.normalize();
  let localZb = new THREE.Vector3().crossVectors(localX, localYb);
  if (localZb.lengthSq() < 1e-12) localZb = new THREE.Vector3(0, 0, 1);
  localZb.normalize();

  const localY = fromBackendVector(localYb);
  const localZ = fromBackendVector(localZb);

  if (forceType === 'shear') {
    return component === 'y' ? localY : localZ;
  }
  if (forceType === 'moment') {
    // Moment about local y bends in local z, and vice versa.
    return component === 'y' ? localZ : localY;
  }

  return computeNormal(pI, pJ);
}

function computeStationNormals(
  basePoints: THREE.Vector3[],
  forceType: ForceType,
  component: 'y' | 'z' | null,
  zUpData: boolean,
): THREE.Vector3[] {
  if (basePoints.length < 2) return [];

  const segmentNormals: THREE.Vector3[] = [];
  for (let i = 0; i < basePoints.length - 1; i++) {
    const n = computeDiagramNormal(
      basePoints[i]!,
      basePoints[i + 1]!,
      forceType,
      component,
      zUpData,
    );
    segmentNormals.push(n);
  }
  for (let i = 1; i < segmentNormals.length; i++) {
    if (segmentNormals[i - 1]!.dot(segmentNormals[i]!) < 0) {
      segmentNormals[i]!.multiplyScalar(-1);
    }
  }

  const stationNormals: THREE.Vector3[] = [];
  for (let i = 0; i < basePoints.length; i++) {
    if (i === 0) {
      stationNormals.push(segmentNormals[0]!.clone());
      continue;
    }
    if (i === basePoints.length - 1) {
      stationNormals.push(segmentNormals[segmentNormals.length - 1]!.clone());
      continue;
    }
    const n = segmentNormals[i - 1]!.clone().add(segmentNormals[i]!);
    if (n.lengthSq() < 1e-12) {
      stationNormals.push(segmentNormals[i]!.clone());
    } else {
      stationNormals.push(n.normalize());
    }
  }
  return stationNormals;
}

export function ForceDiagrams() {
  const model = useModelStore((s) => s.model);
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);
  const results = useAnalysisStore((s) => s.results);
  const currentTimeStep = useAnalysisStore((s) => s.currentTimeStep);
  const forceType = useDisplayStore((s) => s.forceType);
  const forceScale = useDisplayStore((s) => s.forceScale);
  const showDeformed = useDisplayStore((s) => s.showDeformed);
  const deformationScale = useDisplayStore((s) => s.scaleFactor);
  const showLabels = useDisplayStore((s) => s.showLabels);
  const selectedElementIds = useDisplayStore((s) => s.selectedElementIds);
  const hasBearings = useModelStore((s) => s.bearings.size > 0);
  const zUpData = hasBearings;
  const requireSelectionForLargeModel =
    selectedElementIds.size === 0 && elements.size > LARGE_MODEL_FORCE_DIAGRAM_THRESHOLD;

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

  const displacementByNode = useMemo(() => {
    if (!results?.results) return null as Record<number | string, number[]> | null;
    if (results.type === 'static') {
      return (results.results as StaticResults).nodeDisplacements;
    }
    if (results.type === 'pushover') {
      const p = results.results as PushoverResults;
      return (p.nodeDisplacements ?? null) as Record<number | string, number[]> | null;
    }
    if (results.type === 'time_history') {
      const t = results.results as TimeHistoryResults;
      return (t.timeSteps[currentTimeStep]?.nodeDisplacements ?? null) as Record<
        number | string,
        number[]
      > | null;
    }
    return null;
  }, [results, currentTimeStep]);

  const displacedNodeLookup = useMemo(() => {
    if (!showDeformed || !displacementByNode) return null;

    const map = new Map<number, THREE.Vector3>();
    const dispMap = displacementByNode as Record<string, number[]>;
    const applyDisp = (x: number, y: number, z: number, nodeId: number): THREE.Vector3 => {
      const disp = dispMap[String(nodeId)];
      if (!disp || disp.length < 2) return new THREE.Vector3(x, y, z);
      const dx = (disp[0] ?? 0) * deformationScale;
      const dyRaw = hasBearings ? (disp[2] ?? 0) : (disp[1] ?? 0);
      const dzRaw = hasBearings ? (disp[1] ?? 0) : (disp[2] ?? 0);
      const dy = dyRaw * deformationScale;
      const dz = dzRaw * deformationScale;
      return new THREE.Vector3(x + dx, y + dy, z + dz);
    };

    for (const [nodeId, node] of nodes) {
      map.set(nodeId, applyDisp(node.x, node.y, node.z, nodeId));
    }

    if (discretizationData?.internalCoords) {
      for (const [rawId, coords] of Object.entries(discretizationData.internalCoords)) {
        const nodeId = Number(rawId);
        if (!Number.isFinite(nodeId) || coords.length < 2 || map.has(nodeId)) continue;
        const x = coords[0] ?? 0;
        const y = hasBearings ? (coords[2] ?? 0) : (coords[1] ?? 0);
        const z = hasBearings ? (coords[1] ?? 0) : (coords[2] ?? 0);
        map.set(nodeId, applyDisp(x, y, z, nodeId));
      }
    }

    return map;
  }, [showDeformed, displacementByNode, deformationScale, hasBearings, nodes, discretizationData]);

  const diagramItems = useMemo(() => {
    if (forceType === 'none') return [] as DiagramItem[];

    const tracesByElement: Array<{
      id: number;
      component: 'y' | 'z' | null;
      basePoints: THREE.Vector3[];
      values: number[];
    }> = [];

    if (discretizationData) {
      const handledSubIds = new Set<number>();
      const { map: discMap, internalCoords } = discretizationData;

      // Helper to get a node position from store or internalCoords
      const getNodePos = (nodeId: number): THREE.Vector3 | null => {
        const displaced = displacedNodeLookup?.get(nodeId);
        if (displaced) return displaced;
        const storeNode = nodes.get(nodeId);
        if (storeNode) return new THREE.Vector3(storeNode.x, storeNode.y, storeNode.z);
        const ic = internalCoords[nodeId] ?? internalCoords[String(nodeId) as unknown as number];
        if (ic && ic.length >= 3) {
          if (hasBearings) return new THREE.Vector3(ic[0]!, ic[2]!, ic[1]!);
          return new THREE.Vector3(ic[0]!, ic[1]!, ic[2]!);
        }
        if (ic && ic.length >= 2) return new THREE.Vector3(ic[0]!, ic[1]!, 0);
        return null;
      };

      // Process discretized elements.
      // Use full station values from sub-elements to get continuous diagrams.
      for (const [origIdStr, entry] of Object.entries(discMap)) {
        const origId = Number(origIdStr);
        const { nodeChain, subElementIds } = entry;

        if (subElementIds.length === 0 || nodeChain.length < 2) continue;
        for (const subId of subElementIds) handledSubIds.add(subId);

        const basePoints = nodeChain
          .map((nodeId) => getNodePos(nodeId))
          .filter((p): p is THREE.Vector3 => Boolean(p));
        if (basePoints.length < 2) continue;

        let component: 'y' | 'z' | null = null;
        if (forceType === 'shear' || forceType === 'moment') {
          let maxY = 0;
          let maxZ = 0;
          for (const subId of subElementIds) {
            const vec = forceByElement[subId];
            if (!vec) continue;
            const mags = getComponentMagnitudes(vec, forceType);
            if (!mags) continue;
            maxY = Math.max(maxY, mags.y);
            maxZ = Math.max(maxZ, mags.z);
          }
          if (maxY > 0 || maxZ > 0) component = maxY >= maxZ ? 'y' : 'z';
        }

        const values: number[] = [];
        const lastStation = nodeChain.length - 1;
        for (let s = 0; s <= lastStation; s++) {
          if (s === 0) {
            const vec = forceByElement[subElementIds[0]!];
            values.push(vec ? getEndValuesWithComponent(vec, forceType, component).i : 0);
            continue;
          }
          if (s === lastStation) {
            const vec = forceByElement[subElementIds[subElementIds.length - 1]!];
            values.push(vec ? getEndValuesWithComponent(vec, forceType, component).j : 0);
            continue;
          }

          const prevVec = forceByElement[subElementIds[s - 1]!];
          const nextVec = forceByElement[subElementIds[s]!];
          const prev = prevVec ? getEndValuesWithComponent(prevVec, forceType, component).j : null;
          const next = nextVec ? getEndValuesWithComponent(nextVec, forceType, component).i : null;
          if (prev !== null && next !== null) values.push(0.5 * (prev + next));
          else if (prev !== null) values.push(prev);
          else if (next !== null) values.push(next);
          else values.push(0);
        }

        tracesByElement.push({ id: origId, component, basePoints, values });
      }

      // Process non-discretized elements (bearings, etc.)
      for (const [rawId, vec] of Object.entries(forceByElement)) {
        const id = Number(rawId);
        if (handledSubIds.has(id)) continue;

        const el = elements.get(id);
        if (!el) continue;
        const pI =
          displacedNodeLookup?.get(el.nodeI) ??
          (() => {
            const nI = nodes.get(el.nodeI);
            return nI ? new THREE.Vector3(nI.x, nI.y, nI.z) : null;
          })();
        const pJ =
          displacedNodeLookup?.get(el.nodeJ) ??
          (() => {
            const nJ = nodes.get(el.nodeJ);
            return nJ ? new THREE.Vector3(nJ.x, nJ.y, nJ.z) : null;
          })();
        if (!pI || !pJ) continue;
        const values = Array.isArray(vec) ? vec : [];
        const auto = getEndValues(values, forceType);
        tracesByElement.push({
          id,
          component: auto.component,
          basePoints: [pI, pJ],
          values: [auto.i, auto.j],
        });
      }
    } else {
      // No discretization — original logic
      for (const [rawId, vec] of Object.entries(forceByElement)) {
        const id = Number(rawId);
        const el = elements.get(id);
        if (!el) continue;
        const pI =
          displacedNodeLookup?.get(el.nodeI) ??
          (() => {
            const nI = nodes.get(el.nodeI);
            return nI ? new THREE.Vector3(nI.x, nI.y, nI.z) : null;
          })();
        const pJ =
          displacedNodeLookup?.get(el.nodeJ) ??
          (() => {
            const nJ = nodes.get(el.nodeJ);
            return nJ ? new THREE.Vector3(nJ.x, nJ.y, nJ.z) : null;
          })();
        if (!pI || !pJ) continue;
        const values = Array.isArray(vec) ? vec : [];
        const auto = getEndValues(values, forceType);
        tracesByElement.push({
          id,
          component: auto.component,
          basePoints: [pI, pJ],
          values: [auto.i, auto.j],
        });
      }
    }

    let maxAbs = 0;
    for (const tr of tracesByElement) {
      for (const v of tr.values) maxAbs = Math.max(maxAbs, Math.abs(v));
    }
    if (maxAbs < 1e-9) maxAbs = 1;

    const amp = sceneMetrics.modelSize * 0.18 * Math.max(0.1, forceScale);
    const scale = amp / maxAbs;

    const out: DiagramItem[] = [];

    for (const tr of tracesByElement) {
      if (tr.basePoints.length < 2 || tr.values.length !== tr.basePoints.length) continue;
      const pI = tr.basePoints[0]!;
      const pJ = tr.basePoints[tr.basePoints.length - 1]!;
      const len = pI.distanceTo(pJ);
      if (len < 1e-9) continue;

      const stationNormals = computeStationNormals(tr.basePoints, forceType, tr.component, zUpData);
      if (stationNormals.length !== tr.basePoints.length) continue;
      const topPoints = tr.basePoints.map((bp, i) => {
        const normal = stationNormals[i]!;
        return bp.clone().add(normal.clone().multiplyScalar((tr.values[i] ?? 0) * scale));
      });
      const midIdx = Math.floor(topPoints.length / 2);
      const mid = topPoints[midIdx] ?? new THREE.Vector3().addVectors(pI, pJ).multiplyScalar(0.5);
      const color = colorFor(
        forceType,
        0.5 * ((tr.values[0] ?? 0) + (tr.values[tr.values.length - 1] ?? 0)),
      );

      out.push({
        elementId: tr.id,
        base: tr.basePoints,
        top: topPoints,
        stemI: [tr.basePoints[0]!, topPoints[0]!],
        stemJ: [tr.basePoints[tr.basePoints.length - 1]!, topPoints[topPoints.length - 1]!],
        mid,
        valueI: tr.values[0] ?? 0,
        valueJ: tr.values[tr.values.length - 1] ?? 0,
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
    hasBearings,
    displacedNodeLookup,
    zUpData,
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

      {requireSelectionForLargeModel ? (
        <Html
          position={[
            sceneMetrics.legendPosition.x + sceneMetrics.modelSize * 0.18,
            sceneMetrics.legendPosition.y,
            sceneMetrics.legendPosition.z,
          ]}
          transform
          style={{ pointerEvents: 'none' }}
        >
          <div className="max-w-[240px] rounded bg-gray-900/90 px-2 py-1 text-[10px] text-gray-100 ring-1 ring-gray-700">
            Select one or more elements to view force diagrams for this large model.
          </div>
        </Html>
      ) : (
        diagramItems.map((item, idx) => {
          if (showOnlySelected && !selectedElementIds.has(item.elementId)) return null;

          return (
            <group key={`force-${item.elementId}-${idx}`}>
              {item.base.slice(0, -1).map((_, segIdx) => {
                const b0 = item.base[segIdx]!;
                const b1 = item.base[segIdx + 1]!;
                const t0 = item.top[segIdx]!;
                const t1 = item.top[segIdx + 1]!;
                const positions = new Float32Array([
                  b0.x,
                  b0.y,
                  b0.z,
                  b1.x,
                  b1.y,
                  b1.z,
                  t1.x,
                  t1.y,
                  t1.z,
                  t0.x,
                  t0.y,
                  t0.z,
                ]);
                return (
                  <mesh key={`force-face-${item.elementId}-${segIdx}`} renderOrder={2}>
                    <bufferGeometry>
                      <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                      <bufferAttribute
                        attach="index"
                        args={[new Uint16Array([0, 1, 2, 0, 2, 3]), 1]}
                      />
                    </bufferGeometry>
                    <meshBasicMaterial
                      color={item.color}
                      transparent
                      opacity={forceType === 'moment' ? 0.28 : 0.22}
                      side={THREE.DoubleSide}
                      depthWrite={false}
                    />
                  </mesh>
                );
              })}

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
        })
      )}
    </group>
  );
}
