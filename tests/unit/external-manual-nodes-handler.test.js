import { describe, expect, it } from 'vitest';
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

describe('external manual nodes handler', () => {
  it('lists only manual nodes on /manual-nodes and exposes inferred protocol', async () => {
    const env = createEnv({
      subscriptions: [
        { id: 'sub-1', name: 'Airport A', url: 'https://example.com/sub-a', enabled: true },
        { id: 'node-1', name: 'HK 01', url: 'vless://uuid@example.com:443#HK01', enabled: true },
        { id: 'node-2', name: 'SG 01', url: 'trojan://password@example.com:443#SG01', enabled: false }
      ]
    });

    const response = await handleApiRequest(createRequest('/manual-nodes?protocol=vless'), env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ id: 'node-1', type: 'manual_node', protocol: 'vless' });
  });

  it('creates a manual node and rejects http subscription urls on manual-node endpoints', async () => {
    const env = createEnv();

    const created = await handleApiRequest(createRequest('/manual-nodes', {
      method: 'POST',
      body: { name: 'HK 01', url: 'vless://uuid@example.com:443#HK01', group: 'HK' }
    }), env);
    const createdBody = await created.json();

    expect(created.status).toBe(201);
    expect(createdBody.data).toMatchObject({ type: 'manual_node', protocol: 'vless', group: 'HK' });

    const invalid = await handleApiRequest(createRequest('/manual-nodes', {
      method: 'POST',
      body: { name: 'Bad Sub', url: 'https://example.com/sub-a' }
    }), env);
    const invalidBody = await invalid.json();

    expect(invalid.status).toBe(400);
    expect(invalidBody.error.code).toBe('invalid_manual_node_url');
  });

  it('deletes manual nodes and removes them from profile manual node references', async () => {
    const env = createEnv({
      subscriptions: [
        { id: 'node-1', name: 'HK 01', url: 'vless://uuid@example.com:443#HK01', enabled: true },
        { id: 'node-2', name: 'SG 01', url: 'trojan://password@example.com:443#SG01', enabled: true }
      ],
      profiles: [
        { id: 'profile-1', name: 'Main', subscriptions: [], manualNodes: ['node-1'] },
        { id: 'profile-2', name: 'Backup', subscriptions: [], manualNodes: ['node-1', 'node-2'] }
      ]
    });

    const response = await handleApiRequest(createRequest('/manual-nodes/node-1', { method: 'DELETE' }), env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.removedFromProfiles).toEqual(['profile-1', 'profile-2']);

    const profilesResponse = await handleApiRequest(createRequest('/profiles'), env);
    const profilesBody = await profilesResponse.json();
    expect(profilesBody.data).toEqual([
      expect.objectContaining({ id: 'profile-1', manualNodeIds: [], subscriptionIds: [] }),
      expect.objectContaining({ id: 'profile-2', manualNodeIds: ['node-2'], subscriptionIds: [] })
    ]);
  });
});
