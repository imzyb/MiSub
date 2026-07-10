import { describe, expect, it } from 'vitest';
import { handleApiRequest } from '../../functions/modules/api-router.js';

function createKv(initial = {}) {
  const values = new Map(Object.entries(initial));
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

describe('API route access boundaries', () => {
  it('keeps documented public read endpoints reachable without an admin session', async () => {
    const env = { MISUB_KV: createKv() };

    const publicConfig = await handleApiRequest(new Request('https://example.com/api/public_config'), env);
    const publicProfiles = await handleApiRequest(new Request('https://example.com/api/public/profiles'), env);
    const publicClients = await handleApiRequest(new Request('https://example.com/api/clients'), env);

    expect(publicConfig.status).toBe(200);
    expect(publicProfiles.status).toBe(200);
    expect(publicClients.status).toBe(200);
  });

  it('returns unauthenticated metadata for /api/data without exposing management data', async () => {
    const env = {
      MISUB_KV: createKv({
        misub_subscriptions_v1: JSON.stringify([{ id: 'secret-sub', name: 'Private Sub', url: 'https://airport.example/sub' }]),
        misub_profiles_v1: JSON.stringify([{ id: 'secret-profile', name: 'Private Profile' }])
      }),
      COOKIE_SECRET: 'stable-cookie-secret',
      ADMIN_PASSWORD: 'secret-password'
    };

    const response = await handleApiRequest(new Request('https://example.com/api/data'), env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ authenticated: false, message: 'Not logged in' });
    expect(JSON.stringify(body)).not.toContain('secret-sub');
    expect(JSON.stringify(body)).not.toContain('Private Profile');
    expect(JSON.stringify(body)).not.toContain('airport.example');
  });

  it('requires an admin session for management routes before dispatching handlers', async () => {
    const env = {
      MISUB_KV: createKv(),
      COOKIE_SECRET: 'stable-cookie-secret',
      ADMIN_PASSWORD: 'secret-password'
    };

    const protectedRequests = [
      new Request('https://example.com/api/settings'),
      new Request('https://example.com/api/misubs', { method: 'POST', body: JSON.stringify({ misubs: [], profiles: [] }) }),
      new Request('https://example.com/api/system/export', { method: 'POST', body: JSON.stringify({}) })
    ];

    for (const request of protectedRequests) {
      const response = await handleApiRequest(request, env);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toEqual({ error: 'Unauthorized' });
    }
  });
});
