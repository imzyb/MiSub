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

function createEnv(settings = {}) {
  return {
    MISUB_KV: createKv({
      worker_settings_v1: settings
    }),
    COOKIE_SECRET: 'stable-cookie-secret',
    ADMIN_PASSWORD: 'secret-password'
  };
}

function createRequest(path, { method = 'GET', token, body } = {}) {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body) headers.set('Content-Type', 'application/json');
  return new Request(`https://example.com/api/ext/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
}

describe('external api route boundaries', () => {
  it('returns 401 when bearer token is missing', async () => {
    const env = createEnv({
      externalApi: { enabled: true, tokens: [{ name: 'default', token: 'misub_ok' }] }
    });

    const response = await handleApiRequest(createRequest('/subscriptions'), env);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('unauthorized');
  });

  it('returns 401 when bearer token is invalid', async () => {
    const env = createEnv({
      externalApi: { enabled: true, tokens: [{ name: 'default', token: 'misub_ok' }] }
    });

    const response = await handleApiRequest(createRequest('/subscriptions', { token: 'wrong_token' }), env);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('unauthorized');
  });

  it('returns 403 when external api is disabled', async () => {
    const env = createEnv({
      externalApi: { enabled: false, tokens: [{ name: 'default', token: 'misub_ok' }] }
    });

    const response = await handleApiRequest(createRequest('/subscriptions', { token: 'misub_ok' }), env);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('forbidden');
  });

  it('accepts a valid bearer token and reaches external routes', async () => {
    const env = createEnv({
      externalApi: { enabled: true, tokens: [{ name: 'default', token: 'misub_ok' }] }
    });

    const response = await handleApiRequest(createRequest('/subscriptions', { token: 'misub_ok' }), env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  it('returns 404 for unknown external routes', async () => {
    const env = createEnv({
      externalApi: { enabled: true, tokens: [{ name: 'default', token: 'misub_ok' }] }
    });

    const response = await handleApiRequest(createRequest('/unknown', { token: 'misub_ok' }), env);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('not_found');
  });

  it('returns 405 for unsupported methods', async () => {
    const env = createEnv({
      externalApi: { enabled: true, tokens: [{ name: 'default', token: 'misub_ok' }] }
    });

    const response = await handleApiRequest(createRequest('/subscriptions', { method: 'PUT', token: 'misub_ok' } ), env);
    const body = await response.json();

    expect(response.status).toBe(405);
    expect(body.error.code).toBe('method_not_allowed');
  });
});
