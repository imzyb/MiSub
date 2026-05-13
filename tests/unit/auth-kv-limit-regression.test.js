import { describe, it, expect, vi } from 'vitest';
import { getCookieSecret, getAuthDebugInfo } from '../../functions/modules/utils.js';
import { handleLogin } from '../../functions/modules/auth-middleware.js';

function createLimitExceededKv() {
  const values = new Map();
  return {
    async get(key) {
      return values.get(key) ?? null;
    },
    async put() {
      throw new Error('KV put() limit exceeded for the day.');
    },
    async delete() {
      return undefined;
    }
  };
}

describe('auth gracefully handles exhausted KV write quota', () => {
  it('uses COOKIE_SECRET without failing when KV cannot persist it', async () => {
    const env = {
      MISUB_KV: createLimitExceededKv(),
      COOKIE_SECRET: 'stable-cookie-secret',
      ADMIN_PASSWORD: 'secret-password'
    };

    await expect(getCookieSecret(env)).resolves.toBe('stable-cookie-secret');
  });

  it('still logs in when KV put quota is exceeded but COOKIE_SECRET is configured', async () => {
    const env = {
      MISUB_KV: createLimitExceededKv(),
      COOKIE_SECRET: 'stable-cookie-secret',
      ADMIN_PASSWORD: 'secret-password'
    };
    const request = new Request('https://example.com/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'secret-password' })
    });

    const response = await handleLogin(request, env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
  });

  it('auth_debug reports env COOKIE_SECRET without failing when KV put quota is exceeded', async () => {
    const env = {
      MISUB_KV: createLimitExceededKv(),
      COOKIE_SECRET: 'stable-cookie-secret',
      ADMIN_PASSWORD: 'secret-password'
    };

    await expect(getAuthDebugInfo(env)).resolves.toMatchObject({
      hasKv: true,
      cookieSecret: {
        source: 'env',
        hasRuntime: true,
        hasKvValue: false
      }
    });
  });
});
