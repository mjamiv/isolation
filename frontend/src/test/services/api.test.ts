/**
 * Tests for the API client service.
 *
 * Uses globally mocked fetch to verify request URLs, methods, bodies,
 * and error handling for 4xx/5xx responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  submitModel,
  getModel,
  deleteModel,
  runAnalysis,
  getAnalysisStatus,
  getResults,
  runComparison,
  ApiError,
} from '@/services/api';
import type { StructuralModel } from '@/types/model';
import type { StaticResults } from '@/types/analysis';

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();

beforeEach(() => {
  globalThis.fetch = mockFetch;
});

afterEach(() => {
  mockFetch.mockReset();
});

// Helper to create a mock Response object.
function jsonResponse(body: unknown, status = 200, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: () => jsonResponse(body, status, statusText),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(body)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

// ---------------------------------------------------------------------------
// submitModel
// ---------------------------------------------------------------------------

describe('api -- submitModel', () => {
  it('sends POST with correct body and snake_case conversion', async () => {
    const modelData: StructuralModel = {
      modelInfo: {
        name: 'Test',
        units: { force: 'kip', length: 'in', time: 'sec' },
        ndm: 3,
        ndf: 6,
      },
      nodes: [],
      materials: [],
      sections: [],
      elements: [],
      bearings: [],
      diaphragms: [],
      equalDofConstraints: [],
      loads: [],
      groundMotions: [],
    };
    mockFetch.mockResolvedValue(jsonResponse({ model_id: 'abc-123' }));

    const result = await submitModel(modelData);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/models');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');

    // The body should be snake_case encoded
    const parsed = JSON.parse(options.body as string);
    expect(parsed).toHaveProperty('model_info');

    // Response keys are converted to camelCase
    expect(result).toHaveProperty('modelId', 'abc-123');
  });
});

// ---------------------------------------------------------------------------
// getModel
// ---------------------------------------------------------------------------

describe('api -- getModel', () => {
  it('fetches correct URL', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ model_id: 'abc-123', model_info: { name: 'Test' } }),
    );

    const result = await getModel('abc-123');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/models/abc-123');
    // camelCase conversion should apply
    expect(result).toHaveProperty('modelInfo');
  });
});

// ---------------------------------------------------------------------------
// deleteModel
// ---------------------------------------------------------------------------

describe('api -- deleteModel', () => {
  it('sends DELETE to the correct URL', async () => {
    mockFetch.mockResolvedValue(jsonResponse(null, 204, 'No Content'));

    await deleteModel('xyz-789');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/models/xyz-789');
    expect(options.method).toBe('DELETE');
  });
});

// ---------------------------------------------------------------------------
// runAnalysis
// ---------------------------------------------------------------------------

describe('api -- runAnalysis', () => {
  it('sends correct params to /analysis/run', async () => {
    const params = { type: 'static' as const };
    mockFetch.mockResolvedValue(jsonResponse({ analysis_id: 'run-001' }));

    const result = await runAnalysis('abc-123', params);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/analysis/run');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');

    // Body should contain model_id and params
    const parsed = JSON.parse(options.body as string);
    expect(parsed).toHaveProperty('model_id', 'abc-123');
    expect(parsed).toHaveProperty('params');

    expect(result).toHaveProperty('analysisId', 'run-001');
  });
});

// ---------------------------------------------------------------------------
// getAnalysisStatus
// ---------------------------------------------------------------------------

describe('api -- getAnalysisStatus', () => {
  it('fetches the correct status URL', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ status: 'completed', progress: 1.0 }));

    const result = await getAnalysisStatus('run-001');

    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/analysis/run-001/status');
    expect(result.status).toBe('completed');
  });
});

describe('api -- getResults normalization', () => {
  it('normalizes static results with typed metadata', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        analysis_id: 'a1',
        model_id: 'm1',
        type: 'static',
        status: 'completed',
        progress: 1,
        results: {
          node_displacements: { '1': [1, 2, 3] },
          reactions: { '1': [4, 5, 6] },
          element_forces: { '10': [7, 8] },
          discretization_map: { '10': { node_chain: [1, 2], sub_element_ids: [101] } },
          internal_node_coords: { '2001': [0, 1, 2] },
        },
      }),
    );

    const result = await getResults('a1');
    if (
      !result.results ||
      !('nodeDisplacements' in result.results) ||
      !('elementForces' in result.results)
    ) {
      expect.unreachable('expected static results');
    }
    const staticResults = result.results as StaticResults;

    expect(result.type).toBe('static');
    expect(staticResults.nodeDisplacements[1]).toEqual([1, 2, 3, 0, 0, 0]);
    expect(staticResults.elementForces[10]).toEqual([7, 8]);
    expect(staticResults.discretizationMap?.[10]).toEqual({
      nodeChain: [1, 2],
      subElementIds: [101],
    });
  });

  it('normalizes modal results with typed mode shapes and participation', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        analysis_id: 'a2',
        model_id: 'm2',
        type: 'modal',
        status: 'completed',
        results: {
          periods: [1.2],
          frequencies: [0.83],
          mode_shapes: { '1': { '10': [0.1, 0.2, 0.3] } },
          mass_participation: { X: [0.7], Y: [0.2], Z: [0.1] },
        },
      }),
    );

    const result = await getResults('a2');

    expect(
      result.results && 'modeShapes' in result.results && result.results.modeShapes[1]?.[10],
    ).toEqual([0.1, 0.2, 0.3]);
    expect(
      result.results &&
        'massParticipation' in result.results &&
        result.results.massParticipation[1],
    ).toEqual({
      x: 0.7,
      y: 0.2,
      z: 0.1,
    });
  });

  it('normalizes legacy time-history map payloads', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        analysis_id: 'a3',
        model_id: 'm3',
        type: 'time_history',
        status: 'completed',
        results: {
          time: [0, 0.1],
          node_displacements: { '1': { '1': [0, 1], '2': [0, 2], '3': [0, 3] } },
          element_forces: { '2': { '1': [5, 6], '2': [7, 8] } },
          bearing_responses: {
            '9': {
              displacement_x: [0, 1],
              displacement_y: [0, 2],
              force_x: [0, 3],
              force_y: [0, 4],
              axial_force: [10, 11],
              global_force_x: [0, 12],
              global_force_y: [0, 13],
              global_force_z: [0, 14],
              node_i: 1,
              node_j: 2,
            },
          },
        },
      }),
    );

    const result = await getResults('a3');

    expect(
      result.results && 'timeSteps' in result.results && result.results.timeSteps,
    ).toHaveLength(2);
    expect(
      result.results &&
        'timeSteps' in result.results &&
        result.results.timeSteps[1]?.nodeDisplacements[1],
    ).toEqual([1, 2, 3, 0, 0, 0]);
    expect(
      result.results &&
        'peakValues' in result.results &&
        result.results.peakValues.maxBaseShear.value,
    ).toBe(3);
  });

  it('normalizes materialized time-history payloads and safe defaults', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        analysis_id: 'a4',
        model_id: 'm4',
        type: 'time_history',
        status: 'completed',
        results: {
          time_steps: [
            {
              step: 0,
              time: 0,
              node_displacements: { '1': [1, 2, 3] },
              element_forces: { '4': [9, 10] },
              bearing_responses: {
                '5': {
                  displacement: [1, 2],
                  force: [3, 4],
                  axial_force: 5,
                  global_force: [6, 7, 8],
                  node_i: 1,
                  node_j: 2,
                },
              },
            },
          ],
          dt: 0.1,
          total_time: 0.1,
          peak_values: {},
          discretization_map: 'bad',
          internal_node_coords: null,
        },
      }),
    );

    const result = await getResults('a4');

    expect(
      result.results &&
        'timeSteps' in result.results &&
        result.results.timeSteps[0]?.bearingResponses[5],
    ).toEqual({
      displacement: [1, 2],
      force: [3, 4],
      axialForce: 5,
      globalForce: [6, 7, 8],
      nodeI: 1,
      nodeJ: 2,
    });
    expect(
      result.results && 'discretizationMap' in result.results && result.results.discretizationMap,
    ).toBeUndefined();
    expect(
      result.results && 'peakValues' in result.results && result.results.peakValues.maxDrift,
    ).toEqual({ value: 0, story: 0, step: 0 });
  });

  it('normalizes pushover results with capacity curve and hinge diagnostic', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        analysis_id: 'a5',
        model_id: 'm5',
        type: 'pushover',
        status: 'completed',
        hinge_states: [
          { element_id: 7, end: 'J', rotation: 0.1, moment: 5, demand_capacity_ratio: 0.6 },
        ],
        results: {
          capacity_curve: [{ base_shear: 100, roof_displacement: 2 }],
          max_base_shear: 100,
          max_roof_displacement: 2,
          ductility_ratio: 1.5,
          hinge_diagnostic: 'elastic-only',
          node_displacements: { '1': [1, 2, 3] },
          element_forces: { '9': [1, 2] },
        },
      }),
    );

    const result = await getResults('a5');

    expect(
      result.results && 'capacityCurve' in result.results && result.results.capacityCurve,
    ).toEqual([{ baseShear: 100, roofDisplacement: 2 }]);
    expect(result.hingeStates?.[0]?.end).toBe('j');
    expect(
      result.results && 'hingeDiagnostic' in result.results && result.results.hingeDiagnostic,
    ).toBe('elastic-only');
  });

  it('keeps unknown result types from force-casting payloads', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        analysis_id: 'a6',
        model_id: 'm6',
        type: 'weird_mode',
        status: 'completed',
        results: { anything: 'goes' },
      }),
    );

    const result = await getResults('a6');

    expect(result.type).toBe('static');
    expect(result.results).toBeNull();
  });
});

describe('api -- runComparison normalization', () => {
  it('normalizes comparison type and nested time-history results', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        comparison_id: 'c1',
        model_id: 'm7',
        status: 'completed',
        comparison_type: 'time_history',
        isolated: {
          time_history_results: {
            time_steps: [
              {
                step: 0,
                time: 0,
                node_displacements: { '1': [0, 0, 0] },
                element_forces: {},
                bearing_responses: {},
              },
            ],
            dt: 0.1,
            total_time: 0.1,
            peak_values: { max_base_shear: { value: 1, step: 0 } },
          },
          max_base_shear: 55,
          max_roof_displacement: 1.2,
        },
        fixed_base: {
          time_history_results: {
            time_steps: [],
            dt: 0.1,
            total_time: 0,
            peak_values: {},
          },
          max_base_shear: 80,
          max_roof_displacement: 0.8,
        },
        isolated_upper: null,
        isolated_lower: null,
        lambda_factors: { min: 0.85, max: 1.8 },
      }),
    );

    const result = await runComparison('m7', { type: 'time_history' });

    expect(result.comparisonType).toBe('time_history');
    expect(result.isolated?.timeHistoryResults?.peakValues.maxBaseShear.value).toBe(55);
    expect(result.fixedBase?.timeHistoryResults?.peakValues.maxDrift).toEqual({
      value: 0,
      story: 0,
      step: 0,
    });
    expect(result.lambdaFactors).toEqual({ min: 0.85, max: 1.8 });
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('api -- error handling', () => {
  it('handles 404 responses gracefully', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ detail: 'Model not found' }, 404, 'Not Found'));

    await expect(getModel('nonexistent')).rejects.toThrow(ApiError);
    await expect(getModel('nonexistent')).rejects.toThrow(/404/);
  });

  it('handles 422 validation errors', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(
        { detail: [{ msg: 'field required', loc: ['body', 'nodes'] }] },
        422,
        'Unprocessable Entity',
      ),
    );

    try {
      await submitModel({} as unknown as StructuralModel);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(422);
    }
  });

  it('handles 500 server errors', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ detail: 'Internal server error' }, 500, 'Internal Server Error'),
    );

    try {
      await runAnalysis('x', { type: 'static' });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(500);
    }
  });

  it('handles network errors from fetch', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(getModel('any')).rejects.toThrow('Failed to fetch');
  });
});
