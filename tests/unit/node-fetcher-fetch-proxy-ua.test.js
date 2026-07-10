import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchSubscriptionNodes } from '../../functions/modules/subscription/node-fetcher.js';

const encoder = new TextEncoder();

describe('fetchSubscriptionNodes fetch proxy UA forwarding', () => {
    beforeEach(() => {
        global.fetch = vi.fn(async (request) => {
            const requestUrl = typeof request === 'string' ? request : request.url;
            const parsed = new URL(requestUrl);
            const upstreamUa = parsed.searchParams.get('ua');

            if (upstreamUa !== 'clash-verge/v2.4.3') {
                return new Response('Gateway Time-out', { status: 504, statusText: 'Gateway Time-out' });
            }

            return new Response(
                encoder.encode('ss://YWVzLTEyOC1nY206cGFzc0BleGFtcGxlLmNvbTo4Mzg4#ok'),
                { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } }
            );
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('passes custom UA to fetch proxy as ua query parameter', async () => {
        const result = await fetchSubscriptionNodes(
            'http://47.242.55.240/link/token?clash=2',
            '机场',
            'v2rayN/7.23',
            'clash-verge/v2.4.3',
            false,
            '',
            'https://proxy.example.com/api?url='
        );

        expect(result.success).toBe(true);
        expect(result.nodes).toHaveLength(1);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const request = global.fetch.mock.calls[0][0];
        const calledUrl = typeof request === 'string' ? request : request.url;
        expect(calledUrl).toContain('ua=clash-verge%2Fv2.4.3');
        expect(calledUrl).toContain('url=http%3A%2F%2F47.242.55.240%2Flink%2Ftoken%3Fclash%3D2');
    });
});
