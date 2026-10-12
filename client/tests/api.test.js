import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { api, apiRequest } from '../src/api/api.js';

describe('Client API Wrapper Tests', () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    global.localStorage = {
      getItem: (key) => mockStorage[key] || null,
      setItem: (key, val) => {
        mockStorage[key] = val;
      },
      removeItem: (key) => {
        delete mockStorage[key];
      },
    };
  });

  it('should attach Authorization Bearer header when token is present in localStorage', async () => {
    mockStorage.token = 'sample-jwt-token-123';

    let capturedConfig = null;
    global.fetch = async (url, config) => {
      capturedConfig = { url, config };
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { ok: true } }),
      };
    };

    const res = await api.get('/requests');

    assert.equal(res.success, true);
    assert.equal(capturedConfig.config.method, 'GET');
    assert.equal(
      capturedConfig.config.headers.Authorization,
      'Bearer sample-jwt-token-123'
    );
  });

  it('should omit Authorization header when no token is in localStorage', async () => {
    let capturedConfig = null;
    global.fetch = async (url, config) => {
      capturedConfig = { url, config };
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      };
    };

    await api.get('/health');
    assert.equal(capturedConfig.config.headers.Authorization, undefined);
  });

  it('should serialize JSON body on POST requests', async () => {
    let capturedConfig = null;
    global.fetch = async (url, config) => {
      capturedConfig = { url, config };
      return {
        ok: true,
        status: 201,
        json: async () => ({ success: true }),
      };
    };

    await api.post('/requests', { type: 'expense', amount: 199 });

    assert.equal(capturedConfig.config.method, 'POST');
    assert.equal(
      capturedConfig.config.body,
      JSON.stringify({ type: 'expense', amount: 199 })
    );
  });

  it('should throw structured Error with status and details when response is not ok', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        error: {
          message: 'Conflict: Request was already processed',
          statusCode: 409,
          details: [{ step: 1 }],
        },
      }),
    });

    await assert.rejects(
      async () => {
        await apiRequest('/requests/123/approve', { method: 'POST' });
      },
      (err) => {
        assert.equal(err.message, 'Conflict: Request was already processed');
        assert.equal(err.status, 409);
        assert.deepEqual(err.details, [{ step: 1 }]);
        return true;
      }
    );
  });
});
