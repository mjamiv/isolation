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

import type { AnalysisParams, AnalysisResults } from '../types/analysis.ts';
import type { StructuralModel } from '../types/model.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

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

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Submit a structural model to the backend for storage/validation.
 * Returns the server-assigned model identifier.
 */
export async function submitModel(
  model: StructuralModel,
): Promise<{ modelId: string }> {
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
export async function getResults(
  analysisId: string,
): Promise<AnalysisResults> {
  const response = await fetch(`${API_BASE}/results/${analysisId}`);
  return handleResponse<AnalysisResults>(response);
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
