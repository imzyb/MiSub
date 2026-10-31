import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureUnauthorizedHandler, request } from '../../src/lib/http.js';

describe('HTTP unauthorized handler', () => {
    beforeEach(() => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                })
            )
        );
    });

    afterEach(() => {
        configureUnauthorizedHandler(null);
        vi.unstubAllGlobals();
    });

    it('notifies the application once before throwing APIError', async () => {
        const handler = vi.fn();
        configureUnauthorizedHandler(handler);

        await expect(request('/api/data')).rejects.toMatchObject({
            name: 'APIError',
            status: 401,
        });
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({
            url: '/api/data',
            data: { error: 'Unauthorized' },
        });
    });

    it('does not notify for successful responses', async () => {
        const handler = vi.fn();
        configureUnauthorizedHandler(handler);
        fetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ success: true }), { status: 200 })
        );

        await expect(request('/api/data')).resolves.toEqual({ success: true });
        expect(handler).not.toHaveBeenCalled();
    });
});
