import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleApiRequest } from '../../functions/modules/api-router.js';

function createKv(initial = {}) {
  const values = new Map(
    Object.entries(initial).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])
  );
  return {
    async get(key) {
      return values.get(key) ?? null;
    },
    async put(key, value) {
      values.set(key, value);
    },
    async delete(key) {
      values.delete(key);
    }
  };
}

function createEnv({ settings = {}, subscriptions = [], profiles = [] } = {}) {
  return {
    MISUB_KV: createKv({
      worker_settings_v1: { externalApi: { enabled: true, tokens: [{ name: 'default', token: 'misub_ok' }] }, ...settings },
      misub_subscriptions_v1: subscriptions,
      misub_profiles_v1: profiles
    }),
    COOKIE_SECRET: 'stable-cookie-secret',
    ADMIN_PASSWORD: 'secret-password'
  };
}

function createRequest(path, { method = 'GET', body } = {}) {
  return new Request(`https://example.com/api/ext/v1${path}`, {
    method,
    headers: {
      Authorization: 'Bearer misub_ok',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

describe('external subscription batch/validate/refresh operations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('validates a candidate remote subscription url and returns node diagnostics', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(`proxies:\n  - name: HK 01\n    type: trojan\n    server: hk.example.com\n    port: 443\n    password: pass\n`, {
      status: 200,
      headers: {
        'subscription-userinfo': 'upload=1; download=2; total=3; expire=4'
      }
    })));

    const response = await handleApiRequest(createRequest('/subscriptions/validate', {
      method: 'POST',
      body: {
        url: 'https://example.com/subscription',
        userAgent: 'clash-verge/v2.4.3'
      }
    }), createEnv());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      valid: true,
      nodeCount: 1,
      requestedUrl: 'https://example.com/subscription',
      effectiveUserAgent: 'clash-verge/v2.4.3'
    });
    expect(body.data.userInfo).toEqual({ upload: 1, download: 2, total: 3, expire: 4 });
  });

  it('refreshes a single stored subscription and persists nodeCount userInfo and lastUpdate', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(`proxies:\n  - name: SG 01\n    type: trojan\n    server: sg.example.com\n    port: 443\n    password: pass\n`, {
      status: 200,
      headers: {
        'subscription-userinfo': 'upload=11; download=22; total=33; expire=44'
      }
    })));

    const env = createEnv({
      subscriptions: [
        { id: 'sub-1', name: 'Airport A', url: 'https://example.com/sub-a', enabled: true }
      ]
    });

    const response = await handleApiRequest(createRequest('/subscriptions/sub-1/refresh', {
      method: 'POST',
      body: {}
    }), env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      id: 'sub-1',
      success: true,
      nodeCount: 1,
      userInfo: { upload: 11, download: 22, total: 33, expire: 44 }
    });
    expect(body.data.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const listResponse = await handleApiRequest(createRequest('/subscriptions'), env);
    const listBody = await listResponse.json();
    expect(listBody.data[0]).toMatchObject({
      id: 'sub-1',
      nodeCount: 1,
      userInfo: { upload: 11, download: 22, total: 33, expire: 44 }
    });
    expect(listBody.data[0].lastUpdate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('batch refreshes multiple stored subscriptions and persists per-item failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async (request) => {
      if (request.url.includes('sub-a')) {
        return new Response(`proxies:\n  - name: HK 01\n    type: trojan\n    server: hk.example.com\n    port: 443\n    password: pass\n`, { status: 200 });
      }
      return new Response('Forbidden', { status: 403, statusText: 'Forbidden' });
    }));

    const env = createEnv({
      subscriptions: [
        { id: 'sub-1', name: 'Airport A', url: 'https://example.com/sub-a', enabled: true },
        { id: 'sub-2', name: 'Airport B', url: 'https://example.com/sub-b', enabled: true }
      ]
    });

    const response = await handleApiRequest(createRequest('/subscriptions/batch-refresh', {
      method: 'POST',
      body: { subscriptionIds: ['sub-1', 'sub-2'] }
    }), env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.summary).toMatchObject({
      total: 2,
      succeeded: 1,
      failed: 1,
      totalNodes: 1
    });
    expect(body.data.results).toEqual([
      expect.objectContaining({ id: 'sub-1', success: true, nodeCount: 1, lastError: '' }),
      expect.objectContaining({ id: 'sub-2', success: false, nodeCount: 0, lastError: 'HTTP 403: Forbidden' })
    ]);

    const listResponse = await handleApiRequest(createRequest('/subscriptions'), env);
    const listBody = await listResponse.json();
    expect(listBody.data).toEqual([
      expect.objectContaining({ id: 'sub-1', nodeCount: 1, lastError: '' }),
      expect.objectContaining({ id: 'sub-2', nodeCount: 0, lastError: 'HTTP 403: Forbidden' })
    ]);
  });
});
