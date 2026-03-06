/**
 * REST API client for IsoVis backend.
 *
 * All functions use native `fetch` with typed request/response payloads.
 * JSON keys are translated between camelCase (TypeScript) and snake_case
 * (Python) automatically via the helper utilities below.
 *
 * Backend base URL is configured through the VITE_API_URL env variable,
 * falling back to the local development server.
 */

import type {
  AnalysisType,
  AnalysisParams,
  AnalysisResults,
  TimeHistoryResults,
  ModalResults,
  StaticResults,
  PushoverResults,
  HingeState,
} from '../types/analysis.ts';
import type { StructuralModel } from '../types/model.ts';
import type { ComparisonRun, LambdaFactors } from '../types/comparison.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE: string = (() => {
  const envUrl: string | undefined = import.meta.env.VITE_API_URL;
  if (!envUrl) return '/api';
  const base = envUrl.replace(/\/+$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
})();

// ---------------------------------------------------------------------------
// Case-Conversion Helpers
// ---------------------------------------------------------------------------

/** Convert a camelCase string to snake_case. */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** Convert a snake_case string to camelCase. */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/** Deep-convert all object keys from camelCase to snake_case. */
function keysToSnake<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(keysToSnake) as T;
  }
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([key, value]) => [
        toSnakeCase(key),
        keysToSnake(value),
      ]),
    ) as T;
  }
  return obj;
}

/** Deep-convert all object keys from snake_case to camelCase. */
function keysToCamel<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(keysToCamel) as T;
  }
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([key, value]) => [
        toCamelCase(key),
        keysToCamel(value),
      ]),
    ) as T;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: unknown,
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    throw new ApiError(response.status, response.statusText, body);
  }
  const json: unknown = await response.json();
  return keysToCamel(json) as T;
}

function padTo6(values: number[] | undefined): [number, number, number, number, number, number] {
  const src = values ?? [];
  return [src[0] ?? 0, src[1] ?? 0, src[2] ?? 0, src[3] ?? 0, src[4] ?? 0, src[5] ?? 0];
}

function normalizeStatus(status: string): AnalysisResults['status'] {
  if (status === 'completed') return 'complete';
  if (status === 'failed') return 'error';
  if (status === 'complete' || status === 'error' || status === 'pending' || status === 'running') {
    return status;
  }
  return 'running';
}

type RawMap = Record<string, unknown>;

function asRecord(value: unknown): RawMap {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as RawMap;
  }
  return {};
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is number => typeof entry === 'number');
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function toTuple2(values: number[] | undefined): [number, number] {
  const src = values ?? [];
  return [src[0] ?? 0, src[1] ?? 0];
}

function toTuple3(values: number[] | undefined): [number, number, number] {
  const src = values ?? [];
  return [src[0] ?? 0, src[1] ?? 0, src[2] ?? 0];
}

function normalizeAnalysisType(value: unknown): AnalysisType | null {
  return value === 'static' || value === 'modal' || value === 'time_history' || value === 'pushover'
    ? value
    : null;
}

function normalizeComparisonType(value: unknown): ComparisonRun['comparisonType'] | undefined {
  if (value === 'pushover' || value === 'time_history') return value;
  if (value === 'timeHistory') return 'time_history';
  return undefined;
}

function normalizeElementForces(value: unknown): Record<number, number[]> {
  const out: Record<number, number[]> = {};
  for (const [id, forces] of Object.entries(asRecord(value))) {
    out[Number(id)] = asNumberArray(forces);
  }
  return out;
}

function normalizeDiscretizationMap(value: unknown): StaticResults['discretizationMap'] {
  const out: NonNullable<StaticResults['discretizationMap']> = {};
  for (const [id, entry] of Object.entries(asRecord(value))) {
    const raw = asRecord(entry);
    out[Number(id)] = {
      nodeChain: asNumberArray(raw.nodeChain),
      subElementIds: asNumberArray(raw.subElementIds),
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeInternalNodeCoords(value: unknown): StaticResults['internalNodeCoords'] {
  const out: NonNullable<StaticResults['internalNodeCoords']> = {};
  for (const [id, coords] of Object.entries(asRecord(value))) {
    out[Number(id)] = asNumberArray(coords);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeModeShapes(value: unknown): ModalResults['modeShapes'] {
  const out: ModalResults['modeShapes'] = {};
  for (const [mode, rawNodes] of Object.entries(asRecord(value))) {
    const nodeShapes: Record<number, [number, number, number]> = {};
    for (const [nodeId, coords] of Object.entries(asRecord(rawNodes))) {
      nodeShapes[Number(nodeId)] = toTuple3(asNumberArray(coords));
    }
    out[Number(mode)] = nodeShapes;
  }
  return out;
}

function normalizeCapacityCurve(value: unknown): PushoverResults['capacityCurve'] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const raw = asRecord(entry);
    return {
      baseShear: asFiniteNumber(raw.baseShear),
      roofDisplacement: asFiniteNumber(raw.roofDisplacement),
    };
  });
}

function normalizeHingeStates(value: unknown): HingeState[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const raw = asRecord(entry);
    return {
      elementId: asFiniteNumber(raw.elementId),
      end: String(raw.end).toLowerCase() === 'j' ? 'j' : 'i',
      rotation: asFiniteNumber(raw.rotation),
      moment: asFiniteNumber(raw.moment),
      performanceLevel: (raw.performanceLevel ?? 'elastic') as HingeState['performanceLevel'],
      demandCapacityRatio: asFiniteNumber(raw.demandCapacityRatio),
    };
  });
}

function normalizeBearingResponse(
  value: unknown,
): TimeHistoryResults['timeSteps'][number]['bearingResponses'][number] {
  const raw = asRecord(value);
  return {
    displacement: toTuple2(asNumberArray(raw.displacement)),
    force: toTuple2(asNumberArray(raw.force)),
    axialForce: asFiniteNumber(raw.axialForce),
    globalForce: toTuple3(asNumberArray(raw.globalForce)),
    nodeI: asFiniteNumber(raw.nodeI),
    nodeJ: asFiniteNumber(raw.nodeJ),
  };
}

function normalizeTimeSteps(value: unknown): TimeHistoryResults['timeSteps'] {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => {
    const raw = asRecord(entry);
    const nodeDisplacements: TimeHistoryResults['timeSteps'][number]['nodeDisplacements'] = {};
    const elementForces = normalizeElementForces(raw.elementForces);
    const bearingResponses: TimeHistoryResults['timeSteps'][number]['bearingResponses'] = {};

    for (const [nodeId, disp] of Object.entries(asRecord(raw.nodeDisplacements))) {
      nodeDisplacements[Number(nodeId)] = padTo6(asNumberArray(disp));
    }
    for (const [bearingId, resp] of Object.entries(asRecord(raw.bearingResponses))) {
      bearingResponses[Number(bearingId)] = normalizeBearingResponse(resp);
    }

    return {
      step: asFiniteNumber(raw.step, index),
      time: asFiniteNumber(raw.time),
      nodeDisplacements,
      elementForces,
      bearingResponses,
    };
  });
}

function normalizeTimeHistoryPeakValues(raw: unknown): TimeHistoryResults['peakValues'] {
  const peak = asRecord(raw);
  const maxDrift = asRecord(peak.maxDrift);
  const maxAcceleration = asRecord(peak.maxAcceleration);
  const maxBaseShear = asRecord(peak.maxBaseShear);
  const maxBearingDisp = asRecord(peak.maxBearingDisp);

  return {
    maxDrift: {
      value: asFiniteNumber(maxDrift.value),
      story: asFiniteNumber(maxDrift.story),
      step: asFiniteNumber(maxDrift.step),
    },
    maxAcceleration: {
      value: asFiniteNumber(maxAcceleration.value),
      floor: asFiniteNumber(maxAcceleration.floor),
      step: asFiniteNumber(maxAcceleration.step),
    },
    maxBaseShear: {
      value: asFiniteNumber(maxBaseShear.value),
      step: asFiniteNumber(maxBaseShear.step),
    },
    maxBearingDisp: {
      value: asFiniteNumber(maxBearingDisp.value),
      bearingId: asFiniteNumber(maxBearingDisp.bearingId),
      step: asFiniteNumber(maxBearingDisp.step),
    },
  };
}

function normalizeNodeReactionMaps(raw: RawMap): {
  nodeDisplacements: Record<number, [number, number, number, number, number, number]>;
  reactions: Record<number, [number, number, number, number, number, number]>;
} {
  const nodeDisplacements: Record<number, [number, number, number, number, number, number]> = {};
  const reactions: Record<number, [number, number, number, number, number, number]> = {};

  for (const [nid, vals] of Object.entries(asRecord(raw.nodeDisplacements))) {
    nodeDisplacements[Number(nid)] = padTo6(asNumberArray(vals));
  }
  for (const [nid, vals] of Object.entries(asRecord(raw.reactions))) {
    reactions[Number(nid)] = padTo6(asNumberArray(vals));
  }

  return { nodeDisplacements, reactions };
}

function normalizeStaticResults(raw: RawMap): StaticResults {
  const { nodeDisplacements, reactions } = normalizeNodeReactionMaps(raw);

  return {
    nodeDisplacements,
    elementForces: normalizeElementForces(raw.elementForces),
    reactions,
    discretizationMap: normalizeDiscretizationMap(raw.discretizationMap),
    internalNodeCoords: normalizeInternalNodeCoords(raw.internalNodeCoords),
  };
}

function normalizeModalResults(raw: RawMap): ModalResults {
  const periods = asNumberArray(raw.periods);
  const frequencies = asNumberArray(raw.frequencies);
  const modeShapes = normalizeModeShapes(raw.modeShapes);
  const mp = asRecord(raw.massParticipation);
  const mpx = asNumberArray(mp.X ?? mp.x);
  const mpy = asNumberArray(mp.Y ?? mp.y);
  const mpz = asNumberArray(mp.Z ?? mp.z);

  const massParticipation: Record<number, { x: number; y: number; z: number }> = {};
  for (let i = 0; i < periods.length; i++) {
    const mode = i + 1;
    massParticipation[mode] = {
      x: mpx[i] ?? 0,
      y: mpy[i] ?? 0,
      z: mpz[i] ?? 0,
    };
  }

  return { periods, frequencies, modeShapes, massParticipation };
}

function normalizeTimeHistoryResults(raw: RawMap): TimeHistoryResults {
  if (Array.isArray(raw.timeSteps)) {
    return {
      timeSteps: normalizeTimeSteps(raw.timeSteps),
      dt: asFiniteNumber(raw.dt),
      totalTime: asFiniteNumber(raw.totalTime),
      peakValues: normalizeTimeHistoryPeakValues(raw.peakValues),
      discretizationMap: normalizeDiscretizationMap(raw.discretizationMap),
      internalNodeCoords: normalizeInternalNodeCoords(raw.internalNodeCoords),
    };
  }

  const times = asNumberArray(raw.time);
  const nodeHist = asRecord(raw.nodeDisplacements);
  const elemHist = asRecord(raw.elementForces);
  const bearingHist = asRecord(raw.bearingResponses);
  const timeSteps: TimeHistoryResults['timeSteps'] = [];

  let maxDisp = 0;
  let maxDispNode = 0;
  let maxDispStep = 0;
  let maxBaseShear = 0;
  let maxBaseShearStep = 0;
  let maxBearingDisp = 0;
  let maxBearingId = 0;
  let maxBearingStep = 0;

  for (let i = 0; i < times.length; i++) {
    const nodeStep: TimeHistoryResults['timeSteps'][number]['nodeDisplacements'] = {};
    const elemStep: TimeHistoryResults['timeSteps'][number]['elementForces'] = {};
    const bearingStep: TimeHistoryResults['timeSteps'][number]['bearingResponses'] = {};

    for (const [nid, dofMap] of Object.entries(nodeHist)) {
      const arr: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
      for (const [dof, vals] of Object.entries(asRecord(dofMap))) {
        const idx = Number(dof) - 1;
        if (idx >= 0 && idx < 6) {
          arr[idx] = asNumberArray(vals)[i] ?? 0;
        }
      }
      nodeStep[Number(nid)] = arr;
      const absDx = Math.abs(arr[0]);
      if (absDx > maxDisp) {
        maxDisp = absDx;
        maxDispNode = Number(nid);
        maxDispStep = i;
      }
    }

    for (const [eid, compMap] of Object.entries(elemHist)) {
      const components = Object.entries(asRecord(compMap))
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([, vals]) => asNumberArray(vals)[i] ?? 0);
      elemStep[Number(eid)] = components;
    }

    let baseShearAtStep = 0;
    for (const [bid, resp] of Object.entries(bearingHist)) {
      const r = asRecord(resp);
      const dx = (asNumberArray(r.displacementX)[i] ??
        asNumberArray(r.displacement)[i] ??
        0) as number;
      const dy = (asNumberArray(r.displacementY)[i] ?? 0) as number;
      const fx = (asNumberArray(r.forceX)[i] ?? asNumberArray(r.force)[i] ?? 0) as number;
      const fy = (asNumberArray(r.forceY)[i] ?? 0) as number;
      const axial = (asNumberArray(r.axialForce)[i] ?? 0) as number;
      const gfx = (asNumberArray(r.globalForceX)[i] ?? 0) as number;
      const gfy = (asNumberArray(r.globalForceY)[i] ?? 0) as number;
      const gfz = (asNumberArray(r.globalForceZ)[i] ?? 0) as number;
      const nodeI = Number(r.nodeI ?? 0);
      const nodeJ = Number(r.nodeJ ?? 0);

      const dispMag = Math.hypot(dx, dy);
      if (dispMag > maxBearingDisp) {
        maxBearingDisp = dispMag;
        maxBearingId = Number(bid);
        maxBearingStep = i;
      }

      baseShearAtStep += fx;
      bearingStep[Number(bid)] = {
        displacement: [dx, dy],
        force: [fx, fy],
        axialForce: axial,
        globalForce: [gfx, gfy, gfz],
        nodeI,
        nodeJ,
      };
    }

    if (Math.abs(baseShearAtStep) > maxBaseShear) {
      maxBaseShear = Math.abs(baseShearAtStep);
      maxBaseShearStep = i;
    }

    timeSteps.push({
      step: i,
      time: times[i] ?? 0,
      nodeDisplacements: nodeStep,
      elementForces: elemStep,
      bearingResponses: bearingStep,
    });
  }

  const dt =
    times.length > 1 ? Math.max(0, (times[1] ?? 0) - (times[0] ?? 0)) : Number(raw.dt ?? 0);
  const totalTime = times.length > 0 ? (times[times.length - 1] ?? 0) : 0;

  return {
    timeSteps,
    dt,
    totalTime,
    peakValues: {
      maxDrift: { value: maxDisp, story: maxDispNode, step: maxDispStep },
      maxAcceleration: { value: 0, floor: 0, step: 0 },
      maxBaseShear: { value: maxBaseShear, step: maxBaseShearStep },
      maxBearingDisp: { value: maxBearingDisp, bearingId: maxBearingId, step: maxBearingStep },
    },
    discretizationMap: normalizeDiscretizationMap(raw.discretizationMap),
    internalNodeCoords: normalizeInternalNodeCoords(raw.internalNodeCoords),
  };
}

function normalizePushoverResults(raw: RawMap): PushoverResults {
  const { nodeDisplacements, reactions } = normalizeNodeReactionMaps(raw);

  return {
    capacityCurve: normalizeCapacityCurve(raw.capacityCurve),
    maxBaseShear: asFiniteNumber(raw.maxBaseShear),
    maxRoofDisplacement: asFiniteNumber(raw.maxRoofDisplacement),
    ductilityRatio: asFiniteNumber(raw.ductilityRatio),
    hingeDiagnostic:
      typeof raw?.hingeDiagnostic === 'string' ? (raw.hingeDiagnostic as string) : null,
    nodeDisplacements,
    elementForces: normalizeElementForces(raw.elementForces),
    reactions,
    discretizationMap: normalizeDiscretizationMap(raw.discretizationMap),
    internalNodeCoords: normalizeInternalNodeCoords(raw.internalNodeCoords),
  };
}

function normalizeAnalysisResults(raw: RawMap): AnalysisResults {
  const normalizedType = normalizeAnalysisType(raw.type);
  const type = normalizedType ?? 'static';
  const status = normalizeStatus(String(raw.status ?? 'running'));
  const out: AnalysisResults = {
    analysisId: asString(raw.analysisId),
    modelId: asString(raw.modelId),
    type,
    status,
    progress: typeof raw.progress === 'number' ? raw.progress : status === 'complete' ? 1 : 0,
    results: null,
    wallTime: typeof raw.wallTime === 'number' ? raw.wallTime : undefined,
    error: typeof raw.error === 'string' ? raw.error : undefined,
  };

  const results = asRecord(raw.results);
  if (Object.keys(results).length === 0) {
    return out;
  }

  if (normalizedType === 'static') {
    out.results = normalizeStaticResults(results);
  } else if (normalizedType === 'modal') {
    out.results = normalizeModalResults(results);
  } else if (normalizedType === 'time_history') {
    out.results = normalizeTimeHistoryResults(results);
  } else if (normalizedType === 'pushover') {
    out.results = normalizePushoverResults(results);
    if (
      out.results &&
      typeof (results.hingeDiagnostic ?? raw.hingeDiagnostic) === 'string' &&
      'hingeDiagnostic' in out.results
    ) {
      out.results.hingeDiagnostic = String(results.hingeDiagnostic ?? raw.hingeDiagnostic);
    }
    const hingeStates = normalizeHingeStates(results.hingeStates ?? raw.hingeStates);
    if (hingeStates.length > 0) {
      out.hingeStates = hingeStates;
    }
  }

  return out;
}

function normalizeVariantResult(value: unknown): ComparisonRun['isolated'] {
  const raw = asRecord(value);
  if (Object.keys(raw).length === 0) return null;

  const timeHistoryResultsRaw = asRecord(raw.timeHistoryResults);
  const pushoverResultsRaw = asRecord(raw.pushoverResults);

  return {
    pushoverResults:
      Object.keys(pushoverResultsRaw).length > 0
        ? normalizePushoverResults(pushoverResultsRaw)
        : null,
    timeHistoryResults:
      Object.keys(timeHistoryResultsRaw).length > 0
        ? normalizeTimeHistoryResults(timeHistoryResultsRaw)
        : null,
    hingeStates: normalizeHingeStates(raw.hingeStates),
    hingeDiagnostic: typeof raw.hingeDiagnostic === 'string' ? raw.hingeDiagnostic : null,
    maxBaseShear: asFiniteNumber(raw.maxBaseShear),
    maxRoofDisplacement: asFiniteNumber(raw.maxRoofDisplacement),
  };
}

function applyVariantBaseShearOverride(
  variant: ComparisonRun['isolated'],
): ComparisonRun['isolated'] {
  if (!variant?.timeHistoryResults) return variant;
  if (variant.maxBaseShear > 0) {
    variant.timeHistoryResults.peakValues.maxBaseShear.value = variant.maxBaseShear;
  }
  return variant;
}

function normalizeComparisonRun(raw: RawMap): ComparisonRun {
  return {
    comparisonId: asString(raw.comparisonId),
    modelId: asString(raw.modelId),
    status: normalizeStatus(asString(raw.status)),
    comparisonType: normalizeComparisonType(raw.comparisonType),
    isolated: applyVariantBaseShearOverride(normalizeVariantResult(raw.isolated)),
    isolatedUpper: applyVariantBaseShearOverride(normalizeVariantResult(raw.isolatedUpper)),
    isolatedLower: applyVariantBaseShearOverride(normalizeVariantResult(raw.isolatedLower)),
    fixedBase: applyVariantBaseShearOverride(normalizeVariantResult(raw.fixedBase)),
    lambdaFactors:
      Object.keys(asRecord(raw.lambdaFactors)).length > 0
        ? {
            min: asFiniteNumber(asRecord(raw.lambdaFactors).min),
            max: asFiniteNumber(asRecord(raw.lambdaFactors).max),
          }
        : null,
    error: typeof raw.error === 'string' ? raw.error : undefined,
  };
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Submit a structural model to the backend for storage/validation.
 * Returns the server-assigned model identifier.
 */
export async function submitModel(model: StructuralModel): Promise<{ modelId: string }> {
  const response = await fetch(`${API_BASE}/models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(keysToSnake(model)),
  });
  return handleResponse<{ modelId: string }>(response);
}

/**
 * Retrieve a previously submitted structural model by its ID.
 */
export async function getModel(modelId: string): Promise<StructuralModel> {
  const response = await fetch(`${API_BASE}/models/${modelId}`);
  return handleResponse<StructuralModel>(response);
}

/**
 * Delete a model by its ID.
 */
export async function deleteModel(modelId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/models/${modelId}`, {
    method: 'DELETE',
  });
  await handleResponse<{ detail: string }>(response);
}

/**
 * Start an analysis run on a stored model.
 * Returns the server-assigned analysis identifier.
 */
export async function runAnalysis(
  modelId: string,
  params: AnalysisParams,
): Promise<{ analysisId: string }> {
  const response = await fetch(`${API_BASE}/analysis/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(keysToSnake({ modelId, params })),
  });
  return handleResponse<{ analysisId: string }>(response);
}

/**
 * Retrieve completed analysis results.
 */
export async function getResults(analysisId: string): Promise<AnalysisResults> {
  const response = await fetch(`${API_BASE}/results/${analysisId}`);
  const raw = asRecord(await handleResponse<unknown>(response));
  return normalizeAnalysisResults(raw);
}

/**
 * Retrieve a summary of analysis results (lighter payload).
 */
export async function getResultsSummary(
  analysisId: string,
): Promise<{ type: string; status: string; wallTime?: number }> {
  const response = await fetch(`${API_BASE}/results/${analysisId}/summary`);
  return handleResponse<{ type: string; status: string; wallTime?: number }>(response);
}

/**
 * Poll the current status and progress of a running analysis.
 */
export async function getAnalysisStatus(
  analysisId: string,
): Promise<{ status: string; progress: number; error?: string; errorCode?: string }> {
  const response = await fetch(`${API_BASE}/analysis/${analysisId}/status`);
  return handleResponse<{ status: string; progress: number; error?: string; errorCode?: string }>(
    response,
  );
}

/**
 * Run a ductile vs isolated comparison analysis.
 * Posts the model and runs pushover or time-history on both isolated and fixed-base variants.
 */
export async function runComparison(
  modelId: string,
  params: AnalysisParams,
  lambdaFactors?: LambdaFactors,
): Promise<ComparisonRun> {
  const body: Record<string, unknown> = { modelId, params };
  if (lambdaFactors) {
    body.lambdaFactors = lambdaFactors;
  }
  const response = await fetch(`${API_BASE}/comparison/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(keysToSnake(body)),
  });
  const raw = asRecord(await handleResponse<unknown>(response));
  return normalizeComparisonRun(raw);
}
