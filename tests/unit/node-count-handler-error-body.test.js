import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleNodeCountRequest } from '../../functions/modules/handlers/node-handler.js';
import { StorageFactory } from '../../functions/storage-adapter.js';

function createAdapter({ settings = {}, subscriptions = [] } = {}) {
    const store = new Map([
        ['worker_settings_v1', settings],
        ['misub_subscriptions_v1', subscriptions]
    ]);
    return {
        get: vi.fn(async key => store.get(key)),
        put: vi.fn(async (key, value) => {
            store.set(key, value);
            return true;
        }),
        updateSubscriptionById: vi.fn(async (id, updater) => {
            const all = store.get('misub_subscriptions_v1') || [];
            const index = all.findIndex(item => item.id === id);
            if (index === -1) return false;
            all[index] = updater(all[index]);
            store.set('misub_subscriptions_v1', all);
            return true;
        }),
        store
    };
}

describe('handleNodeCountRequest error body handling', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('treats HTTP 200 upstream error text as a failed manual node update', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const errorText = 'failed to fetch remote profile with status 400 Bad Request';
        const adapter = createAdapter({
            settings: { builtinSkipCertVerify: false },
            subscriptions: [{ id: 'sub-a', url: 'https://airport.example/sub' }]
        });
        vi.spyOn(StorageFactory, 'getStorageType').mockResolvedValue('kv');
        vi.spyOn(StorageFactory, 'createAdapter').mockReturnValue(adapter);

        vi.stubGlobal('fetch', vi.fn(async () => new Response(errorText, { status: 200 })));

        const request = new Request('http://local/api/node_count', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ url: 'https://airport.example/sub' })
        });

        try {
            const response = await handleNodeCountRequest(request, {});
            const data = await response.json();

            expect(data.success).toBe(false);
            expect(data.errorType).toBe('server');
            expect(data.error).toContain('HTTP 400');
            expect(data.count).toBe(0);
            expect(warnSpy).toHaveBeenCalledWith('[NodeHandler] Node count response contains upstream error: HTTP 400: failed to fetch remote profile with status 400 Bad Request');
            expect(warnSpy).toHaveBeenCalledWith('[NodeHandler] Skipping node count fallback because upstream returned an error body: HTTP 400: failed to fetch remote profile with status 400 Bad Request');
            expect(errorSpy).toHaveBeenCalledWith('[Node Count] Node count update failed for https://airport.example/sub: HTTP 400: failed to fetch remote profile with status 400 Bad Request');
            expect(adapter.updateSubscriptionById).not.toHaveBeenCalled();
        } finally {
            warnSpy.mockRestore();
            errorSpy.mockRestore();
        }
    });

    it('does not skip certificate verification for node count by default', async () => {
        const adapter = createAdapter({
            settings: { builtinSkipCertVerify: false },
            subscriptions: [{ id: 'sub-a', url: 'https://airport.example/sub' }]
        });
        vi.spyOn(StorageFactory, 'getStorageType').mockResolvedValue('kv');
        vi.spyOn(StorageFactory, 'createAdapter').mockReturnValue(adapter);

        const fetchSpy = vi.fn(async () => new Response('trojan://pass@example.com:443#HK', { status: 200 }));
        vi.stubGlobal('fetch', fetchSpy);

        const request = new Request('http://local/api/node_count', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ url: 'https://airport.example/sub' })
        });

        const response = await handleNodeCountRequest(request, {});
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
        for (const [, options] of fetchSpy.mock.calls) {
            expect(options?.cf?.insecureSkipVerify).not.toBe(true);
        }
    });

    it('only skips certificate verification for node count when enabled in settings', async () => {
        const adapter = createAdapter({
            settings: { builtinSkipCertVerify: true },
            subscriptions: [{ id: 'sub-a', url: 'https://airport.example/sub' }]
        });
        vi.spyOn(StorageFactory, 'getStorageType').mockResolvedValue('kv');
        vi.spyOn(StorageFactory, 'createAdapter').mockReturnValue(adapter);

        const fetchSpy = vi.fn(async () => new Response('trojan://pass@example.com:443#HK', { status: 200 }));
        vi.stubGlobal('fetch', fetchSpy);

        const request = new Request('http://local/api/node_count', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ url: 'https://airport.example/sub' })
        });

        const response = await handleNodeCountRequest(request, {});
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
        for (const [, options] of fetchSpy.mock.calls) {
            expect(options?.cf?.insecureSkipVerify).toBe(true);
        }
    });
});
