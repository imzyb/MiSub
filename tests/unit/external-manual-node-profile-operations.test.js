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

describe('external manual-node/profile validate and refresh operations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('validates a candidate manual node url and returns parsed node details', async () => {
    const response = await handleApiRequest(createRequest('/manual-nodes/validate', {
      method: 'POST',
      body: {
        name: 'SG 01',
        url: 'trojan://password@example.com:443#SG01'
      }
    }), createEnv());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      valid: true,
      protocol: 'trojan',
      nodeCount: 1
    });
    expect(body.data.parsedNode.url).toBe('trojan://password@example.com:443#SG01');
  });

  it('refreshes a profile by updating referenced remote subscriptions and returning aggregate counts', async () => {
    vi.stubGlobal('fetch', vi.fn(async (request) => {
      if (request.url.includes('sub-a')) {
        return new Response(`proxies:\n  - name: HK 01\n    type: trojan\n    server: hk.example.com\n    port: 443\n    password: pass\n`, {
          status: 200,
          headers: {
            'subscription-userinfo': 'upload=100; download=200; total=300; expire=400'
          }
        });
      }
      return new Response('Forbidden', { status: 403, statusText: 'Forbidden' });
    }));

    const env = createEnv({
      subscriptions: [
        { id: 'sub-1', name: 'Airport A', url: 'https://example.com/sub-a', enabled: true },
        { id: 'sub-2', name: 'Airport B', url: 'https://example.com/sub-b', enabled: true },
        { id: 'node-1', name: 'SG 01', url: 'trojan://password@example.com:443#SG01', enabled: true }
      ],
      profiles: [
        { id: 'profile-1', name: 'Main', subscriptions: ['sub-1', 'sub-2'], manualNodes: ['node-1'], enabled: true }
      ]
    });

    const response = await handleApiRequest(createRequest('/profiles/profile-1/refresh', {
      method: 'POST',
      body: {}
    }), env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.summary).toMatchObject({
      totalSubscriptions: 2,
      refreshedSubscriptions: 1,
      failedSubscriptions: 1,
      manualNodes: 1,
      totalNodes: 2
    });
    expect(body.data.results).toEqual([
      expect.objectContaining({ id: 'sub-1', success: true, nodeCount: 1, lastError: '' }),
      expect.objectContaining({ id: 'sub-2', success: false, nodeCount: 0, lastError: 'HTTP 403: Forbidden' })
    ]);

    const subscriptionsResponse = await handleApiRequest(createRequest('/subscriptions'), env);
    const subscriptionsBody = await subscriptionsResponse.json();
    expect(subscriptionsBody.data).toEqual([
      expect.objectContaining({ id: 'sub-1', nodeCount: 1, userInfo: { upload: 100, download: 200, total: 300, expire: 400 } }),
      expect.objectContaining({ id: 'sub-2', nodeCount: 0, lastError: 'HTTP 403: Forbidden' })
    ]);
  });
});
