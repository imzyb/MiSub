import { afterEach, describe, it, expect, vi } from 'vitest';
import { handleBatchUpdateNodesRequest } from '../../functions/modules/handlers/node-handler.js';
import { StorageFactory } from '../../functions/storage-adapter.js';

const makeEnv = (subscriptions) => ({
    KV: {
        async get(key) {
            if (key === 'misub_subscriptions_v1') {
                return JSON.stringify(subscriptions);
            }
            return null;
        },
        async put() {},
        async delete() {},
        async list() { return { keys: [] }; }
    }
});

describe('handleBatchUpdateNodesRequest', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('批量刷新应使用订阅源 customUserAgent 拉取节点', async () => {
        const subscriptions = [{
            id: 'sub-1',
            name: '机场',
            url: 'http://example.com/link/token',
            customUserAgent: 'clash-verge/v2.4.3',
            enabled: true
        }];
        const clashYaml = `proxies:\n  - name: HK 1\n    type: trojan\n    server: example.com\n    port: 443\n    password: pass\n`;

        vi.spyOn(StorageFactory, 'getStorageType').mockResolvedValue('kv');
        vi.stubGlobal('fetch', vi.fn(async (request) => {
            const ua = request.headers.get('user-agent');
            if (ua === 'clash-verge/v2.4.3') {
                return new Response(clashYaml, { status: 200 });
            }
            return new Response('<html>504 Gateway Time-out</html>', { status: 504 });
        }));

        const req = new Request('http://local/api/batch_update_nodes', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ subscriptionIds: ['sub-1'] })
        });
        const res = await handleBatchUpdateNodesRequest(req, makeEnv(subscriptions));
        const data = await res.json();

        expect(data.success).toBe(true);
        expect(data.results[0].success).toBe(true);
        expect(data.results[0].nodeCount).toBe(1);
        expect(globalThis.fetch).toHaveBeenCalled();
    });

    it('批量刷新使用 Fetch Proxy 时应通过 ua 参数传递有效 UA', async () => {
        const subscriptions = [{
            id: 'sub-1',
            name: '机场',
            url: 'http://example.com/link/token?clash=2',
            fetchProxy: 'https://fetchproxy.example/api?url=',
            enabled: true
        }];
        const clashYaml = `proxies:\n  - name: HK 1\n    type: trojan\n    server: example.com\n    port: 443\n    password: pass\n`;

        vi.spyOn(StorageFactory, 'getStorageType').mockResolvedValue('kv');
        vi.stubGlobal('fetch', vi.fn(async (request) => {
            const requestUrl = new URL(request.url);
            if (requestUrl.searchParams.get('ua') === 'clash-verge/v2.4.3') {
                return new Response(clashYaml, { status: 200 });
            }
            return new Response('<html>504 Gateway Time-out</html>', { status: 504 });
        }));

        const req = new Request('http://local/api/batch_update_nodes', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ subscriptionIds: ['sub-1'] })
        });
        const res = await handleBatchUpdateNodesRequest(req, makeEnv(subscriptions));
        const data = await res.json();
        const calledUrl = new URL(globalThis.fetch.mock.calls[0][0].url);

        expect(data.success).toBe(true);
        expect(data.results[0].success).toBe(true);
        expect(data.results[0].nodeCount).toBe(1);
        expect(calledUrl.searchParams.get('ua')).toBe('clash-verge/v2.4.3');
        expect(calledUrl.searchParams.get('url')).toBe('http://example.com/link/token?clash=2');
    });

    it('批量刷新使用 Fetch Proxy 时 customUserAgent 应优先于 URL 推断 UA', async () => {
        const subscriptions = [{
            id: 'sub-1',
            name: '机场',
            url: 'http://example.com/link/token?clash=2',
            fetchProxy: 'https://fetchproxy.example/api?url=',
            customUserAgent: 'Custom-UA/1.0',
            enabled: true
        }];
        const clashYaml = `proxies:\n  - name: HK 1\n    type: trojan\n    server: example.com\n    port: 443\n    password: pass\n`;

        vi.spyOn(StorageFactory, 'getStorageType').mockResolvedValue('kv');
        vi.stubGlobal('fetch', vi.fn(async (request) => {
            const requestUrl = new URL(request.url);
            if (requestUrl.searchParams.get('ua') === 'Custom-UA/1.0') {
                return new Response(clashYaml, { status: 200 });
            }
            return new Response('<html>504 Gateway Time-out</html>', { status: 504 });
        }));

        const req = new Request('http://local/api/batch_update_nodes', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ subscriptionIds: ['sub-1'] })
        });
        const res = await handleBatchUpdateNodesRequest(req, makeEnv(subscriptions));
        const data = await res.json();
        const calledUrl = new URL(globalThis.fetch.mock.calls[0][0].url);

        expect(data.results[0].success).toBe(true);
        expect(data.results[0].nodeCount).toBe(1);
        expect(calledUrl.searchParams.get('ua')).toBe('Custom-UA/1.0');
    });

    it('批量刷新遇到空白 customUserAgent 时应回退到 URL 推断 UA', async () => {
        const subscriptions = [{
            id: 'sub-1',
            name: '机场',
            url: 'http://example.com/link/token?clash=2',
            customUserAgent: '   ',
            enabled: true
        }];
        const clashYaml = `proxies:\n  - name: HK 1\n    type: trojan\n    server: example.com\n    port: 443\n    password: pass\n`;

        vi.spyOn(StorageFactory, 'getStorageType').mockResolvedValue('kv');
        vi.stubGlobal('fetch', vi.fn(async (request) => {
            const ua = request.headers.get('user-agent');
            if (ua === 'clash-verge/v2.4.3') {
                return new Response(clashYaml, { status: 200 });
            }
            return new Response('<html>504 Gateway Time-out</html>', { status: 504 });
        }));

        const req = new Request('http://local/api/batch_update_nodes', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ subscriptionIds: ['sub-1'] })
        });
        const res = await handleBatchUpdateNodesRequest(req, makeEnv(subscriptions));
        const data = await res.json();

        expect(data.results[0].success).toBe(true);
        expect(data.results[0].nodeCount).toBe(1);
    });
});
