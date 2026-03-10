import { describe, it, expect } from 'vitest';
import {
    sanitizeConvertedSubscriptionContent,
    buildClientResponseHeaders
} from '../../functions/modules/subscription/subconverter-client.js';

describe('subconverter-client sanitize', () => {
    it('keeps unicode and emoji in node names', () => {
        const input = 'proxies:\n  - {name: "🇭🇰 香港-HK-01", type: vless}\n';
        const result = sanitizeConvertedSubscriptionContent(input);

        expect(result.content).toBe(input);
        expect(result.replacedCount).toBe(0);
    });

    it('removes unsafe control chars only', () => {
        const input = 'name: "HK\u0000\u0007Node"\nproxies:\n  - type: ss\n';
        const result = sanitizeConvertedSubscriptionContent(input);

        expect(result.content).toBe('name: "HKNode"\nproxies:\n  - type: ss\n');
        expect(result.replacedCount).toBe(2);
    });
});

describe('subconverter-client response headers', () => {
    it('removes encoding and length headers that can break clients', () => {
        const backendHeaders = new Headers({
            'content-encoding': 'gzip',
            'content-length': '1024',
            'transfer-encoding': 'chunked',
            'x-backend': 'subconverter'
        });

        const headers = buildClientResponseHeaders(backendHeaders, 'MiSub', 'base64', { 'X-Cache-Status': 'HIT' });

        expect(headers.get('content-encoding')).toBeNull();
        expect(headers.get('content-length')).toBeNull();
        expect(headers.get('transfer-encoding')).toBeNull();
        expect(headers.get('x-backend')).toBeNull(); // MiSub 现在不复制这些头了，而是重新组装
        expect(headers.get('content-type')).toBe('text/plain; charset=utf-8');
        expect(headers.get('x-cache-status')).toBe('HIT');
    });
});
