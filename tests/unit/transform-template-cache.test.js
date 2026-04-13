import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchTransformTemplate } from '../../functions/modules/subscription/transform-template-cache.js';

describe('Transform template cache', () => {
    const storage = {
        put: vi.fn(),
        get: vi.fn().mockResolvedValue(null)
    };

    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('proxies: <%proxies%>\nrules: <%rules%>\n', { status: 200 })));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it('should fetch and cache template text', async () => {
        const result = await fetchTransformTemplate(storage, 'https://example.com/template.yaml', true);

        expect(result).toContain('proxies: <%proxies%>');
        expect(storage.put).toHaveBeenCalled();
    });
});
