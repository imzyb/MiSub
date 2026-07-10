import { describe, expect, it } from 'vitest';
import { handleApiRequest } from '../../functions/modules/api-router.js';
import { corsMiddleware, csrfOriginMiddleware } from '../../functions/middleware/cors.js';

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

const makeMiddlewareRequest = (url, { method = 'GET', origin, referer } = {}) => ({
  url,
  method,
  headers: {
    get(name) {
      const key = String(name || '').toLowerCase();
      if (key === 'origin') return origin || null;
      if (key === 'referer') return referer || null;
      return null;
    }
  }
});

describe('CORS and CSRF middleware hardening', () => {
  it('centralizes CORS headers without wildcard defaults in JSON helpers', async () => {
    const sameOriginResponse = await corsMiddleware(
      makeMiddlewareRequest('https://example.com/api/data', { origin: 'https://example.com' }),
      async () => new Response('ok'),
      { origins: ['https://example.com'], allowCredentials: true }
    );
    const helperResponse = await handleApiRequest(new Request('https://example.com/api/public_config'), { MISUB_KV: createKv() });

    expect(sameOriginResponse.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    expect(sameOriginResponse.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(helperResponse.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('rejects unsafe cross-site write requests while allowing same-origin and non-browser writes', async () => {
    const crossSite = await csrfOriginMiddleware(
      makeMiddlewareRequest('https://example.com/api/settings', { method: 'POST', origin: 'https://evil.example' }),
      async () => new Response('should-not-run'),
      { origins: ['https://example.com'] }
    );
    const sameOrigin = await csrfOriginMiddleware(
      makeMiddlewareRequest('https://example.com/api/settings', { method: 'POST', origin: 'https://example.com' }),
      async () => new Response('ok'),
      { origins: ['https://example.com'] }
    );
    const bearerRequest = await csrfOriginMiddleware(
      {
        ...makeMiddlewareRequest('https://example.com/api/settings', { method: 'POST' }),
        headers: {
          get(name) {
            return String(name || '').toLowerCase() === 'authorization' ? 'Bearer [REDACTED]' : null;
          }
        }
      },
      async () => new Response('ok'),
      { origins: ['https://example.com'] }
    );
    const cookieWithoutOrigin = await csrfOriginMiddleware(
      {
        ...makeMiddlewareRequest('https://example.com/api/settings', { method: 'POST' }),
        headers: {
          get(name) {
            return String(name || '').toLowerCase() === 'cookie' ? 'misub_session=[REDACTED]' : null;
          }
        }
      },
      async () => new Response('should-not-run'),
      { origins: ['https://example.com'] }
    );

    expect(crossSite.status).toBe(403);
    expect(await crossSite.text()).toContain('Origin Not Allowed');
    expect(sameOrigin.status).toBe(200);
    expect(bearerRequest.status).toBe(200);
    expect(cookieWithoutOrigin.status).toBe(403);
    expect(await cookieWithoutOrigin.text()).toContain('Origin Required');
  });
});
