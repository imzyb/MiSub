import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchTransformTemplate } from '../../functions/modules/subscription/transform-template-cache.js';

function createStorage(cached = null) {
    return {
        put: vi.fn(),
        get: vi.fn().mockResolvedValue(cached)
    };
}

describe('Transform template cache', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-13T00:00:00Z'));
        vi.stubGlobal('fetch', vi.fn(async () => new Response(`proxies: <%proxies%>\nrules: <%rules%>\n`, {
            status: 200,
            headers: {
                ETag: '"v1"',
                'Last-Modified': 'Wed, 13 May 2026 00:00:00 GMT'
            }
        })));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.clearAllMocks();
        delete globalThis.TEMPLATE_REVALIDATE_INTERVAL_SECONDS;
        delete globalThis.TEMPLATE_CACHE_MAX_AGE_SECONDS;
    });

    it('should fetch and cache template text with validators', async () => {
        const storage = createStorage();

        const result = await fetchTransformTemplate(storage, 'https://example.com/template.yaml', true);

        expect(result).toContain('proxies: <%proxies%>');
        expect(storage.put).toHaveBeenCalledWith(expect.stringContaining('transform_template_'), expect.objectContaining({
            nodes: expect.stringContaining('proxies: <%proxies%>'),
            etag: '"v1"',
            lastModified: 'Wed, 13 May 2026 00:00:00 GMT',
            sources: ['https://example.com/template.yaml']
        }));
    });

    it('returns fresh cached template without revalidating within the short interval', async () => {
        const storage = createStorage({
            nodes: 'cached template',
            timestamp: Date.now() - 60 * 1000,
            etag: '"cached"',
            lastModified: 'Wed, 13 May 2026 00:00:00 GMT'
        });

        const result = await fetchTransformTemplate(storage, 'https://example.com/template.yaml');

        expect(result).toBe('cached template');
        expect(fetch).not.toHaveBeenCalled();
        expect(storage.put).not.toHaveBeenCalled();
    });

    it('revalidates stale cached template with ETag and Last-Modified headers', async () => {
        const storage = createStorage({
            nodes: 'cached template',
            timestamp: Date.now() - 10 * 60 * 1000,
            etag: '"cached"',
            lastModified: 'Wed, 13 May 2026 00:00:00 GMT'
        });

        await fetchTransformTemplate(storage, 'https://example.com/template.yaml');

        expect(fetch).toHaveBeenCalledWith('https://example.com/template.yaml', {
            headers: {
                'User-Agent': 'MiSub-Template-Fetch/1.0',
                'If-None-Match': '"cached"',
                'If-Modified-Since': 'Wed, 13 May 2026 00:00:00 GMT'
            }
        });
    });



    it('reads revalidation settings from storage adapter env when available', async () => {
        const storage = {
            ...createStorage({
                nodes: 'cached template',
                timestamp: Date.now() - 60 * 1000,
                etag: '"cached"'
            }),
            env: {
                TEMPLATE_REVALIDATE_INTERVAL_SECONDS: '0'
            }
        };

        await fetchTransformTemplate(storage, 'https://example.com/template.yaml');

        expect(fetch).toHaveBeenCalled();
    });

    it('uses cached template and extends cache when remote returns 304', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(null, {
            status: 304,
            headers: {
                ETag: '"cached"',
                'Last-Modified': 'Wed, 13 May 2026 00:00:00 GMT'
            }
        })));
        const cached = {
            nodes: 'cached template',
            timestamp: Date.now() - 10 * 60 * 1000,
            etag: '"cached"',
            lastModified: 'Wed, 13 May 2026 00:00:00 GMT',
            nodeCount: 0,
            sources: ['https://example.com/template.yaml']
        };
        const storage = createStorage(cached);

        const result = await fetchTransformTemplate(storage, 'https://example.com/template.yaml');

        expect(result).toBe('cached template');
        expect(storage.put).toHaveBeenCalledWith(expect.stringContaining('transform_template_'), expect.objectContaining({
            nodes: 'cached template',
            etag: '"cached"',
            lastModified: 'Wed, 13 May 2026 00:00:00 GMT',
            timestamp: Date.now()
        }));
    });

    it('updates cached template when remote content changed', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('new template', {
            status: 200,
            headers: {
                ETag: '"new"',
                'Last-Modified': 'Wed, 13 May 2026 00:05:00 GMT'
            }
        })));
        const storage = createStorage({
            nodes: 'cached template',
            timestamp: Date.now() - 10 * 60 * 1000,
            etag: '"old"',
            lastModified: 'Wed, 13 May 2026 00:00:00 GMT'
        });

        const result = await fetchTransformTemplate(storage, 'https://example.com/template.yaml');

        expect(result).toBe('new template');
        expect(storage.put).toHaveBeenCalledWith(expect.stringContaining('transform_template_'), expect.objectContaining({
            nodes: 'new template',
            etag: '"new"',
            lastModified: 'Wed, 13 May 2026 00:05:00 GMT'
        }));
    });

    it('falls back to cached template when revalidation fails before max age', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('server error', { status: 503 })));
        const storage = createStorage({
            nodes: 'cached template',
            timestamp: Date.now() - 10 * 60 * 1000,
            etag: '"cached"',
            lastModified: 'Wed, 13 May 2026 00:00:00 GMT'
        });

        const result = await fetchTransformTemplate(storage, 'https://example.com/template.yaml');

        expect(result).toBe('cached template');
    });

    it('throws when remote fetch fails and no cached template is available', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('server error', { status: 503 })));
        const storage = createStorage();

        await expect(fetchTransformTemplate(storage, 'https://example.com/template.yaml')).rejects.toThrow('Template fetch failed: HTTP 503');
    });
});
