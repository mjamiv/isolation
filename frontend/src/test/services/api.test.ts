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
  ApiError,
} from '@/services/api';

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
    const modelData = {
      modelInfo: { name: 'Test', units: { force: 'kip', length: 'in', time: 'sec' }, ndm: 3, ndf: 6 },
      nodes: [],
      materials: [],
      sections: [],
      elements: [],
      bearings: [],
      loads: [],
      groundMotions: [],
    };
    mockFetch.mockResolvedValue(jsonResponse({ model_id: 'abc-123' }));

    const result = await submitModel(modelData as any);

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
    mockFetch.mockResolvedValue(
      jsonResponse({ analysis_id: 'run-001' }),
    );

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
    mockFetch.mockResolvedValue(
      jsonResponse({ status: 'completed', progress: 1.0 }),
    );

    const result = await getAnalysisStatus('run-001');

    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/analysis/run-001/status');
    expect(result.status).toBe('completed');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('api -- error handling', () => {
  it('handles 404 responses gracefully', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ detail: 'Model not found' }, 404, 'Not Found'),
    );

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
      await submitModel({} as any);
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
