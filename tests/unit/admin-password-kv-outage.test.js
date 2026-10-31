import { describe, it, expect, vi } from 'vitest';
import { getAdminPassword, setAdminPassword } from '../../functions/modules/utils.js';
import { handleLogin } from '../../functions/modules/auth-middleware.js';

function createKv({ get } = {}) {
    const values = new Map();
    return {
        async get(key) {
            if (get) return get(key);
            return values.get(key) ?? null;
        },
        async put(key, value) {
            values.set(key, value);
        },
        async delete(key) {
            values.delete(key);
        },
    };
}

describe('admin password fails closed when KV is unavailable', () => {
    it('does not fall back to the default password when KV read is paused', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const password = await getAdminPassword({
                MISUB_KV: createKv({
                    get: async () => {
                        throw new Error('KV storage is paused');
                    },
                }),
            }).catch((error) => error.message);
            expect(password).toBe('KV storage is paused');
        } finally {
            warn.mockRestore();
        }
    });

    it('rejects login while KV password storage is unavailable', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const env = {
            MISUB_KV: createKv({
                get: async () => {
                    throw new Error('KV storage is paused');
                },
            }),
            COOKIE_SECRET: 'test-cookie-secret',
        };
        const request = new Request('https://example.com/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'admin' }),
        });
        try {
            const response = await handleLogin(request, env);
            expect(response.status).toBe(500);
            expect(await response.json()).toMatchObject({ error: expect.any(String) });
        } finally {
            warn.mockRestore();
        }
    });

    it('rejects password changes controlled by ADMIN_PASSWORD env var', async () => {
        const kv = createKv();
        const result = await setAdminPassword(
            { ADMIN_PASSWORD: 'env-password', MISUB_KV: kv },
            'new-password'
        ).catch((error) => error.message);
        expect(result).toMatch(/环境变量 ADMIN_PASSWORD/);
        await expect(kv.get('SYSTEM_ADMIN_PASSWORD')).resolves.toBeNull();
    });

    it('still uses the default password when the KV key is genuinely absent', async () => {
        await expect(getAdminPassword({ MISUB_KV: createKv() })).resolves.toBe('admin');
    });
});
