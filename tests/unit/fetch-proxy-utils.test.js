import { describe, it, expect } from 'vitest';
import { buildFetchProxyUrl } from '../../functions/utils/fetch-proxy-utils.js';

describe('buildFetchProxyUrl', () => {
    it('adds ua before url placeholder for fetch proxies that support upstream UA override', () => {
        const result = buildFetchProxyUrl(
            'https://proxy.example.com/api?url=',
            'http://47.242.55.240/link/token?clash=2',
            'clash-verge/v2.4.3'
        );

        expect(result).toBe(
            'https://proxy.example.com/api?ua=clash-verge%2Fv2.4.3&url=http%3A%2F%2F47.242.55.240%2Flink%2Ftoken%3Fclash%3D2'
        );
    });

    it('does not duplicate ua when proxy prefix already contains one', () => {
        const result = buildFetchProxyUrl(
            'https://proxy.example.com/api?ua=custom%2F1.0&url=',
            'http://example.com/sub?clash=2',
            'clash-verge/v2.4.3'
        );

        expect(result).toBe(
            'https://proxy.example.com/api?ua=custom%2F1.0&url=http%3A%2F%2Fexample.com%2Fsub%3Fclash%3D2'
        );
    });

    it('keeps legacy prefix concatenation when no UA is provided', () => {
        const result = buildFetchProxyUrl(
            'https://proxy.example.com/api?url=',
            'http://example.com/sub?clash=2',
            ''
        );

        expect(result).toBe('https://proxy.example.com/api?url=http%3A%2F%2Fexample.com%2Fsub%3Fclash%3D2');
    });
});
