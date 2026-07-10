import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTransformTemplate } from '../../functions/modules/subscription/transform-template-cache.js';
import { generateCombinedNodeList } from '../../functions/services/subscription-service.js';
import { handleSubconverterTestRequest } from '../../functions/modules/api-router.js';

function createStorage(cached = null) {
    return {
        put: vi.fn(),
        get: vi.fn().mockResolvedValue(cached)
    };
}

function createBaseConfig() {
    return {
        enableAccessLog: false,
        enableFlagEmoji: false,
        subConverter: 'backend',
        selectedRules: [],
        customRules: []
    };
}

describe('outbound SSRF boundaries', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('rejects private subscription source URLs before outbound fetch', async () => {
        vi.useFakeTimers();
        const fetchSpy = vi.fn(async () => new Response('trojan://pass@example.com:443#HK', { status: 200 }));
        vi.stubGlobal('fetch', fetchSpy);

        const resultPromise = generateCombinedNodeList(
            {},
            createBaseConfig(),
            'ClashforWindows/0.20',
            [{ id: 'local-source', name: 'Local', url: 'http://127.0.0.1:8787/sub' }]
        );
        await vi.runAllTimersAsync();
        const result = await resultPromise;

        expect(result.trim()).toBe('');
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rejects private fetch proxy endpoints before outbound fetch', async () => {
        vi.useFakeTimers();
        const fetchSpy = vi.fn(async () => new Response('trojan://pass@example.com:443#HK', { status: 200 }));
        vi.stubGlobal('fetch', fetchSpy);

        const resultPromise = generateCombinedNodeList(
            {},
            createBaseConfig(),
            'ClashforWindows/0.20',
            [{
                id: 'proxied-source',
                name: 'Proxied',
                url: 'https://raw.githubusercontent.com/example/repo/main/sub.txt',
                fetchProxy: 'http://169.254.169.254/proxy?url='
            }]
        );
        await vi.runAllTimersAsync();
        const result = await resultPromise;

        expect(result.trim()).toBe('');
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rejects private transform template URLs before outbound fetch', async () => {
        const fetchSpy = vi.fn(async () => new Response('template', { status: 200 }));
        vi.stubGlobal('fetch', fetchSpy);

        await expect(fetchTransformTemplate(createStorage(), 'http://localhost/template.yaml'))
            .rejects.toThrow('URL host is not allowed.');
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rejects private subconverter backend test endpoints before outbound fetch', async () => {
        const fetchSpy = vi.fn(async () => new Response('proxies:\n  - name: MiSub-Test-Node', { status: 200 }));
        vi.stubGlobal('fetch', fetchSpy);

        const response = await handleSubconverterTestRequest(new Request('https://example.com/api/subconverter/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ backend: 'http://10.0.0.1/sub' })
        }), {});
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.success).toBe(false);
        expect(body.details).toContain('URL host is not allowed.');
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
