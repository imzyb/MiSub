import { describe, expect, it } from 'vitest';
import { handleApiRequest } from '../../functions/modules/api-router.js';

function createKv() {
    return {
        async get() {
            return null;
        },
        async put() {},
        async delete() {},
    };
}

describe('POST-only data migration route', () => {
    it('does not run migration through GET requests', async () => {
        const response = await handleApiRequest(
            new Request('https://example.com/api/migrate_to_d1', { method: 'GET' }),
            { MISUB_KV: createKv(), COOKIE_SECRET: 'test-secret' }
        );
        expect(response.status).toBe(405);
        expect(response.headers.get('Allow')).toBe('POST');
    });

    it('allows POST requests to continue through auth checks', async () => {
        const response = await handleApiRequest(
            new Request('https://example.com/api/migrate_to_d1', { method: 'POST' }),
            { MISUB_KV: createKv(), COOKIE_SECRET: 'test-secret' }
        );
        expect(response.status).toBe(401);
    });

    it('does not run migration through HEAD requests', async () => {
        const response = await handleApiRequest(
            new Request('https://example.com/api/migrate_to_d1', { method: 'HEAD' }),
            { MISUB_KV: createKv(), COOKIE_SECRET: 'test-secret' }
        );
        expect(response.status).toBe(405);
        expect(response.headers.get('Allow')).toBe('POST');
    });
});
