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

const API_BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

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

function normalizeStaticResults(raw: RawMap): StaticResults {
  const nodeDisplacements: Record<number, [number, number, number, number, number, number]> = {};
  const reactions: Record<number, [number, number, number, number, number, number]> = {};

  for (const [nid, vals] of Object.entries(raw?.nodeDisplacements ?? {})) {
    nodeDisplacements[Number(nid)] = padTo6(vals as number[]);
  }
  for (const [nid, vals] of Object.entries(raw?.reactions ?? {})) {
    reactions[Number(nid)] = padTo6(vals as number[]);
  }

  return {
    nodeDisplacements,
    elementForces: raw?.elementForces ?? {},
    reactions,
  };
}

function normalizeModalResults(raw: RawMap): ModalResults {
  const periods: number[] = raw?.periods ?? [];
  const frequencies: number[] = raw?.frequencies ?? [];
  const modeShapes = raw?.modeShapes ?? {};
  const mp = raw?.massParticipation ?? {};
  const mpx: number[] = mp.X ?? mp.x ?? [];
  const mpy: number[] = mp.Y ?? mp.y ?? [];
  const mpz: number[] = mp.Z ?? mp.z ?? [];

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
  if (Array.isArray(raw?.timeSteps)) {
    return raw as TimeHistoryResults;
  }

  const times: number[] = raw?.time ?? [];
  const nodeHist = raw?.nodeDisplacements ?? {};
  const elemHist = raw?.elementForces ?? {};
  const bearingHist = raw?.bearingResponses ?? {};
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
      for (const [dof, vals] of Object.entries((dofMap ?? {}) as Record<string, number[]>)) {
        const idx = Number(dof) - 1;
        if (idx >= 0 && idx < 6) {
          arr[idx] = (vals?.[i] ?? 0) as number;
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
      const components = Object.entries((compMap ?? {}) as Record<string, number[]>)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([, vals]) => vals?.[i] ?? 0);
      elemStep[Number(eid)] = components;
    }

    let baseShearAtStep = 0;
    for (const [bid, resp] of Object.entries(bearingHist)) {
      const r = (resp ?? {}) as Record<string, number[]>;
      const dx = r.displacementX?.[i] ?? r.displacement?.[i] ?? 0;
      const dy = r.displacementY?.[i] ?? 0;
      const fx = r.forceX?.[i] ?? r.force?.[i] ?? 0;
      const fy = r.forceY?.[i] ?? 0;
      const axial = r.axialForce?.[i] ?? 0;

      const dispMag = Math.hypot(dx, dy);
      if (dispMag > maxBearingDisp) {
        maxBearingDisp = dispMag;
        maxBearingId = Number(bid);
        maxBearingStep = i;
      }

      baseShearAtStep += Math.abs(fx);
      bearingStep[Number(bid)] = {
        displacement: [dx, dy],
        force: [fx, fy],
        axialForce: axial,
      };
    }

    if (baseShearAtStep > maxBaseShear) {
      maxBaseShear = baseShearAtStep;
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

  const dt = times.length > 1 ? Math.max(0, (times[1] ?? 0) - (times[0] ?? 0)) : (raw?.dt ?? 0);
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
  };
}

function normalizePushoverResults(raw: RawMap): PushoverResults {
  const nodeDisplacements: Record<number, [number, number, number, number, number, number]> = {};
  const reactions: Record<number, [number, number, number, number, number, number]> = {};

  for (const [nid, vals] of Object.entries(raw?.nodeDisplacements ?? {})) {
    nodeDisplacements[Number(nid)] = padTo6(vals as number[]);
  }
  for (const [nid, vals] of Object.entries(raw?.reactions ?? {})) {
    reactions[Number(nid)] = padTo6(vals as number[]);
  }

  return {
    capacityCurve: raw?.capacityCurve ?? [],
    maxBaseShear: raw?.maxBaseShear ?? 0,
    maxRoofDisplacement: raw?.maxRoofDisplacement ?? 0,
    ductilityRatio: raw?.ductilityRatio ?? 0,
    nodeDisplacements,
    elementForces: raw?.elementForces ?? {},
    reactions,
  };
}

function normalizeAnalysisResults(raw: RawMap): AnalysisResults {
  const type = (raw?.type ?? 'static') as AnalysisResults['type'];
  const status = normalizeStatus(raw?.status ?? 'running');
  const out: AnalysisResults = {
    analysisId: raw?.analysisId ?? '',
    modelId: raw?.modelId ?? '',
    type,
    status,
    progress: raw?.progress ?? (status === 'complete' ? 1 : 0),
    results: null,
    wallTime: raw?.wallTime,
    error: raw?.error ?? undefined,
  };

  const results = raw?.results;
  if (!results) {
    return out;
  }

  if (type === 'static') {
    out.results = normalizeStaticResults(results);
  } else if (type === 'modal') {
    out.results = normalizeModalResults(results);
  } else if (type === 'time_history') {
    out.results = normalizeTimeHistoryResults(results);
  } else if (type === 'pushover') {
    out.results = normalizePushoverResults(results);
    const hingeStates = (results?.hingeStates ?? raw?.hingeStates ?? []) as HingeState[];
    if (hingeStates.length > 0) {
      out.hingeStates = hingeStates.map((h) => ({
        ...h,
        end: (String(h.end).toLowerCase() === 'j' ? 'j' : 'i') as 'i' | 'j',
        performanceLevel: (h.performanceLevel ?? 'elastic') as HingeState['performanceLevel'],
      }));
    }
  } else {
    out.results = results as AnalysisResults['results'];
  }

  return out;
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
  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    throw new ApiError(response.status, response.statusText, body);
  }
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
  const raw = await handleResponse<RawMap>(response);
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
): Promise<{ status: string; progress: number }> {
  const response = await fetch(`${API_BASE}/analysis/${analysisId}/status`);
  return handleResponse<{ status: string; progress: number }>(response);
}

/**
 * Run a ductile vs isolated comparison analysis.
 * Posts the model and runs pushover on both isolated and fixed-base variants.
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
  return handleResponse<ComparisonRun>(response);
}
