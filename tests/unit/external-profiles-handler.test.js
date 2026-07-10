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

describe('external profiles and preview handlers', () => {
  it('maps internal profile fields to external dto fields', async () => {
    const env = createEnv({
      profiles: [
        { id: 'profile-1', name: 'Main', subscriptions: ['sub-1'], manualNodes: ['node-1'], enabled: true }
      ]
    });

    const response = await handleApiRequest(createRequest('/profiles'), env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      expect.objectContaining({
        id: 'profile-1',
        subscriptionIds: ['sub-1'],
        manualNodeIds: ['node-1']
      })
    ]);
    expect(body.data[0]).not.toHaveProperty('subscriptions');
    expect(body.data[0]).not.toHaveProperty('manualNodes');
  });

  it('creates profiles and rejects wrong resource-type references', async () => {
    const env = createEnv({
      subscriptions: [
        { id: 'sub-1', name: 'Airport A', url: 'https://example.com/sub-a', enabled: true },
        { id: 'node-1', name: 'HK 01', url: 'vless://uuid@example.com:443#HK01', enabled: true }
      ]
    });

    const created = await handleApiRequest(createRequest('/profiles', {
      method: 'POST',
      body: { name: 'Main', subscriptionIds: ['sub-1'], manualNodeIds: ['node-1'] }
    }), env);
    const createdBody = await created.json();

    expect(created.status).toBe(201);
    expect(createdBody.data).toMatchObject({ name: 'Main', subscriptionIds: ['sub-1'], manualNodeIds: ['node-1'] });

    const invalid = await handleApiRequest(createRequest('/profiles', {
      method: 'POST',
      body: { name: 'Bad', subscriptionIds: ['node-1'] }
    }), env);
    const invalidBody = await invalid.json();

    expect(invalid.status).toBe(400);
    expect(invalidBody.error.code).toBe('invalid_profile_reference');
  });

  it('adds and removes profile resource references through dedicated endpoints', async () => {
    const env = createEnv({
      subscriptions: [
        { id: 'sub-1', name: 'Airport A', url: 'https://example.com/sub-a', enabled: true },
        { id: 'sub-2', name: 'Airport B', url: 'https://example.com/sub-b', enabled: true },
        { id: 'node-1', name: 'HK 01', url: 'vless://uuid@example.com:443#HK01', enabled: true },
        { id: 'node-2', name: 'SG 01', url: 'trojan://password@example.com:443#SG01', enabled: true }
      ],
      profiles: [
        { id: 'profile-1', name: 'Main', subscriptions: ['sub-1'], manualNodes: ['node-1'], enabled: true }
      ]
    });

    const addSubs = await handleApiRequest(createRequest('/profiles/profile-1/subscriptions', {
      method: 'POST',
      body: { subscriptionIds: ['sub-1', 'sub-2'] }
    }), env);
    const addSubsBody = await addSubs.json();
    expect(addSubs.status).toBe(200);
    expect(addSubsBody.data.subscriptionIds).toEqual(['sub-1', 'sub-2']);

    const addNodes = await handleApiRequest(createRequest('/profiles/profile-1/manual-nodes', {
      method: 'POST',
      body: { manualNodeIds: ['node-1', 'node-2'] }
    }), env);
    const addNodesBody = await addNodes.json();
    expect(addNodesBody.data.manualNodeIds).toEqual(['node-1', 'node-2']);

    const removeSubs = await handleApiRequest(createRequest('/profiles/profile-1/subscriptions', {
      method: 'DELETE',
      body: { subscriptionIds: ['sub-1'] }
    }), env);
    const removeSubsBody = await removeSubs.json();
    expect(removeSubsBody.data.subscriptionIds).toEqual(['sub-2']);

    const removeNodes = await handleApiRequest(createRequest('/profiles/profile-1/manual-nodes', {
      method: 'DELETE',
      body: { manualNodeIds: ['node-1'] }
    }), env);
    const removeNodesBody = await removeNodes.json();
    expect(removeNodesBody.data.manualNodeIds).toEqual(['node-2']);
  });

  it('returns lightweight profile previews with counts, protocol stats, and typed sources', async () => {
    const env = createEnv({
      subscriptions: [
        { id: 'sub-1', name: 'Airport A', url: 'https://example.com/sub-a', enabled: true },
        { id: 'node-1', name: 'HK 01', url: 'vless://uuid@example.com:443#HK01', enabled: true },
        { id: 'node-2', name: 'SG 01', url: 'trojan://password@example.com:443#SG01', enabled: true }
      ],
      profiles: [
        { id: 'profile-1', name: 'Main', subscriptions: ['sub-1'], manualNodes: ['node-1', 'node-2'], enabled: true }
      ]
    });

    const response = await handleApiRequest(createRequest('/profiles/profile-1/preview', {
      method: 'POST',
      body: {}
    }), env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.counts).toEqual({ subscriptions: 1, manualNodes: 2, totalNodes: 2 });
    expect(body.data.byProtocol).toEqual({ vless: 1, trojan: 1 });
    expect(body.data.sources).toEqual([
      expect.objectContaining({ type: 'subscription', id: 'sub-1', name: 'Airport A' }),
      expect.objectContaining({ type: 'manual_node', id: 'node-1', name: 'HK 01', nodeCount: 1 }),
      expect.objectContaining({ type: 'manual_node', id: 'node-2', name: 'SG 01', nodeCount: 1 })
    ]);
  });
});
