import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    buildSubscriptionFilterFingerprint,
    buildSubscriptionNodeCacheKey,
    generateCombinedNodeList,
    isRealProxyNode,
    parseSubscriptionUserInfoHeader,
} from '../../functions/services/subscription-service.js';

function createMemoryStorage(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
        store,
        async get(key) {
            return store.has(key) ? store.get(key) : null;
        },
        async put(key, value) {
            store.set(key, value);
            return true;
        },
        async delete(key) {
            store.delete(key);
            return true;
        },
    };
}

describe('subscription protective node cache', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('识别真实代理节点，排除系统伪节点', () => {
        expect(isRealProxyNode('trojan://pass@example.com:443#HK')).toBe(true);
        expect(isRealProxyNode('vmess://eyJhZGQiOiJleGFtcGxlLmNvbSJ9')).toBe(true);
        expect(
            isRealProxyNode('trojan://00000000-0000-0000-0000-000000000000@127.0.0.1:443#伪节点')
        ).toBe(false);
        expect(
            isRealProxyNode('vless://00000000-0000-0000-0000-000000000000@[::1]:443#伪节点')
        ).toBe(false);
        expect(isRealProxyNode('127.0.0.1:8080#剩余流量')).toBe(false);
        expect(isRealProxyNode('到期时间：2099-01-01')).toBe(false);
        expect(isRealProxyNode('')).toBe(false);
    });

    it('解析机场返回的 subscription-userinfo 响应头', () => {
        expect(
            parseSubscriptionUserInfoHeader('upload=1; download=2; total=100; expire=200')
        ).toEqual({
            upload: 1,
            download: 2,
            total: 100,
            expire: 200,
        });
        expect(parseSubscriptionUserInfoHeader('')).toBeNull();
    });

    it('enableNodeCache 开启时，成功拉取真实节点后写入单机场缓存', async () => {
        const storage = createMemoryStorage();
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('trojan://pass@example.com:443#HK', { status: 200 }))
        );

        const result = await generateCombinedNodeList(
            { storage },
            { enableAccessLog: false, enableFlagEmoji: false },
            'ClashMeta',
            [
                {
                    id: 'sub-a',
                    name: '机场A',
                    url: 'https://example.com/sub',
                    enabled: true,
                    enableNodeCache: true,
                },
            ],
            '',
            { enableSubscriptions: false },
            false
        );

        const cache = await storage.get(
            buildSubscriptionNodeCacheKey({ id: 'sub-a', url: 'https://example.com/sub' })
        );
        expect(result.trim()).toBe('trojan://pass@example.com:443#HK');
        expect(cache.nodes).toEqual(['trojan://pass@example.com:443#HK']);
        expect(cache.nodeCount).toBe(1);
    });

    it('enableNodeCache 开启且拉取失败时，使用该机场上次成功缓存', async () => {
        const storage = createMemoryStorage({
            [buildSubscriptionNodeCacheKey({ id: 'sub-a', url: 'https://example.com/sub' })]: {
                nodes: ['trojan://cached@example.com:443#Cached'],
                nodeCount: 1,
                updatedAt: '2026-01-01T00:00:00.000Z',
            },
        });
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('Forbidden', { status: 403 }))
        );

        const result = await generateCombinedNodeList(
            { storage },
            { enableAccessLog: false, enableFlagEmoji: false },
            'ClashMeta',
            [
                {
                    id: 'sub-a',
                    name: '机场A',
                    url: 'https://example.com/sub',
                    enabled: true,
                    enableNodeCache: true,
                },
            ],
            '',
            { enableSubscriptions: false },
            false
        );

        expect(result.trim()).toBe('trojan://cached@example.com:443#Cached');
    });

    it('enableNodeCache 开启时，新结果只有伪节点不得覆盖旧缓存，并 fallback 旧缓存', async () => {
        const cacheKey = buildSubscriptionNodeCacheKey({
            id: 'sub-a',
            url: 'https://example.com/sub',
        });
        const storage = createMemoryStorage({
            [cacheKey]: {
                nodes: ['trojan://cached@example.com:443#Cached'],
                nodeCount: 1,
                updatedAt: '2026-01-01T00:00:00.000Z',
            },
        });
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('127.0.0.1:8080#剩余流量', { status: 200 }))
        );

        const result = await generateCombinedNodeList(
            { storage },
            { enableAccessLog: false, enableFlagEmoji: false },
            'ClashMeta',
            [
                {
                    id: 'sub-a',
                    name: '机场A',
                    url: 'https://example.com/sub',
                    enabled: true,
                    enableNodeCache: true,
                },
            ],
            '',
            { enableSubscriptions: false },
            false
        );

        const cache = await storage.get(cacheKey);
        expect(result.trim()).toBe('trojan://cached@example.com:443#Cached');
        expect(cache.nodes).toEqual(['trojan://cached@example.com:443#Cached']);
    });

    it('外部拉取成功时，异步同步节点数和流量到前端订阅数据', async () => {
        const sub = {
            id: 'sub-a',
            name: '机场A',
            url: 'https://example.com/sub',
            enabled: true,
            enableNodeCache: true,
        };
        const storage = createMemoryStorage({
            misub_subscriptions_v1: [{ ...sub, nodeCount: 0, userInfo: null }],
        });
        const waitUntilPromises = [];
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response('trojan://pass@example.com:443#HK', {
                        status: 200,
                        headers: {
                            'subscription-userinfo': 'upload=1; download=2; total=100; expire=200',
                        },
                    })
            )
        );
        const context = {
            storage,
            waitUntil: (promise) => waitUntilPromises.push(promise),
        };

        const result = await generateCombinedNodeList(
            context,
            { enableAccessLog: false, enableFlagEmoji: false },
            'ClashMeta',
            [sub],
            '',
            { enableSubscriptions: false },
            false
        );

        expect(result.trim()).toBe('trojan://pass@example.com:443#HK');
        expect(waitUntilPromises).toHaveLength(1);
        expect(context.currentSubscriptionRuntimeInfo[sub.id].userInfo).toEqual({
            upload: 1,
            download: 2,
            total: 100,
            expire: 200,
        });

        await Promise.all(waitUntilPromises);

        const [updatedSub] = await storage.get('misub_subscriptions_v1');
        expect(updatedSub.nodeCount).toBe(1);
        expect(updatedSub.lastGoodNodeCount).toBeUndefined();
        expect(updatedSub.userInfo).toEqual({
            upload: 1,
            download: 2,
            total: 100,
            expire: 200,
        });
        expect(updatedSub.lastError).toBeNull();
        expect(typeof updatedSub.lastUpdate).toBe('string');
    });

    it('stores lastGoodNodeCount after a healthy user subscription refresh', async () => {
        const nodes = Array.from(
            { length: 12 },
            (_, index) => `trojan://pass${index}@node${index}.example.com:443#Node-${index}`
        ).join('\n');
        const sub = {
            id: 'sub-a',
            name: 'Airport A',
            url: 'https://example.com/sub',
            enabled: true,
        };
        const storage = createMemoryStorage({
            misub_subscriptions_v1: [{ ...sub, nodeCount: 0, userInfo: null }],
        });
        const waitUntilPromises = [];
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(nodes, { status: 200 }))
        );

        await generateCombinedNodeList(
            { storage, waitUntil: (promise) => waitUntilPromises.push(promise) },
            { enableAccessLog: false, enableFlagEmoji: false },
            'ClashMeta',
            [sub],
            '',
            { enableSubscriptions: false },
            false
        );
        await Promise.all(waitUntilPromises);

        const [updatedSub] = await storage.get('misub_subscriptions_v1');
        expect(updatedSub.nodeCount).toBe(12);
        expect(updatedSub.lastGoodNodeCount).toBe(12);
    });

    it('enableNodeCache 关闭时，拉取失败不使用旧缓存', async () => {
        const storage = createMemoryStorage({
            [buildSubscriptionNodeCacheKey({ id: 'sub-a', url: 'https://example.com/sub' })]: {
                nodes: ['trojan://cached@example.com:443#Cached'],
                nodeCount: 1,
                updatedAt: '2026-01-01T00:00:00.000Z',
            },
        });
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('Forbidden', { status: 403 }))
        );

        const result = await generateCombinedNodeList(
            { storage },
            { enableAccessLog: false, enableFlagEmoji: false },
            'ClashMeta',
            [
                {
                    id: 'sub-a',
                    name: '机场A',
                    url: 'https://example.com/sub',
                    enabled: true,
                    enableNodeCache: false,
                },
            ],
            '',
            { enableSubscriptions: false },
            false
        );

        expect(result.trim()).toBe('');
    });

    it('enableNodeCache 开启时，异常缩水回退到机场旧缓存', async () => {
        const cacheKey = buildSubscriptionNodeCacheKey({
            id: 'sub-a',
            url: 'https://example.com/sub',
        });
        const cachedNodes = Array.from(
            { length: 156 },
            (_, index) => `trojan://cached${index}@node${index}.example.com:443#Cached-${index}`
        );
        const storage = createMemoryStorage({
            [cacheKey]: {
                nodes: cachedNodes,
                nodeCount: cachedNodes.length,
                updatedAt: '2026-01-01T00:00:00.000Z',
            },
        });
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(
                        'vless://11111111-1111-1111-1111-111111111111@example.com:443#11111111-1111-1111-1111-111111111111',
                        { status: 200 }
                    )
            )
        );

        const result = await generateCombinedNodeList(
            { storage },
            { enableAccessLog: false, enableFlagEmoji: false },
            'ClashMeta',
            [
                {
                    id: 'sub-a',
                    name: 'Airport',
                    url: 'https://example.com/sub',
                    enabled: true,
                    enableNodeCache: true,
                },
            ],
            '',
            { enableSubscriptions: false },
            false
        );

        const cache = await storage.get(cacheKey);
        expect(result.trim().split('\n')).toHaveLength(cachedNodes.length);
        expect(cache.nodes).toEqual(cachedNodes);
        expect(cache.nodeCount).toBe(cachedNodes.length);
    });

    it('known historical node count rejects a partial refresh even without per-sub cache', async () => {
        const storage = createMemoryStorage();
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(
                        'vless://11111111-1111-1111-1111-111111111111@example.com:443#11111111-1111-1111-1111-111111111111',
                        { status: 200 }
                    )
            )
        );

        const result = await generateCombinedNodeList(
            { storage },
            { enableAccessLog: false, enableFlagEmoji: false },
            'ClashMeta',
            [
                {
                    id: 'sub-a',
                    name: 'Airport',
                    url: 'https://example.com/sub',
                    enabled: true,
                    nodeCount: 156,
                    enableNodeCache: false,
                },
            ],
            '',
            { enableSubscriptions: false },
            false
        );

        expect(result.trim()).toBe('');
    });

    it('keeps lastGoodNodeCount when a user subscription request only sees one node', async () => {
        const storage = createMemoryStorage({
            misub_subscriptions_v1: [
                {
                    id: 'sub-a',
                    url: 'https://example.com/sub',
                    nodeCount: 1,
                    lastGoodNodeCount: 156,
                    userInfo: null,
                },
            ],
        });
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(
                        'vless://11111111-1111-1111-1111-111111111111@example.com:443#11111111-1111-1111-1111-111111111111',
                        { status: 200 }
                    )
            )
        );
        const waitUntilPromises = [];
        const result = await generateCombinedNodeList(
            { storage, waitUntil: (promise) => waitUntilPromises.push(promise) },
            { enableAccessLog: false, enableFlagEmoji: false },
            'ClashMeta',
            [
                {
                    id: 'sub-a',
                    name: 'Airport',
                    url: 'https://example.com/sub',
                    enabled: true,
                    nodeCount: 1,
                    lastGoodNodeCount: 156,
                    enableNodeCache: false,
                },
            ],
            '',
            { enableSubscriptions: false },
            false
        );

        expect(result.trim()).toBe('');
        await Promise.all(waitUntilPromises);
        const [updated] = await storage.get('misub_subscriptions_v1');
        expect(updated.nodeCount).toBe(1);
        expect(updated.lastGoodNodeCount).toBe(156);
    });

    it('clears stored runtime info when protective node cache is disabled and external fetch fails', async () => {
        const sub = {
            id: 'sub-a',
            name: 'Airport A',
            url: 'https://example.com/sub',
            enabled: true,
            enableNodeCache: false,
            nodeCount: 86,
            userInfo: { upload: 1, download: 2, total: 100, expire: 200 },
        };
        const storage = createMemoryStorage({
            misub_subscriptions_v1: [{ ...sub }],
        });
        const waitUntilPromises = [];
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('Forbidden', { status: 403 }))
        );
        const context = {
            storage,
            waitUntil: (promise) => waitUntilPromises.push(promise),
        };

        const result = await generateCombinedNodeList(
            context,
            { enableAccessLog: false, enableFlagEmoji: false },
            'ClashMeta',
            [sub],
            '',
            { enableSubscriptions: false },
            false
        );

        expect(result.trim()).toBe('');
        expect(context.currentSubscriptionRuntimeInfo[sub.id]).toEqual({
            nodeCount: 0,
            userInfo: null,
        });
        expect(waitUntilPromises).toHaveLength(1);

        await Promise.all(waitUntilPromises);

        const [updatedSub] = await storage.get('misub_subscriptions_v1');
        expect(updatedSub.nodeCount).toBe(0);
        expect(updatedSub.userInfo).toBeNull();
        expect(updatedSub.lastError).toBeNull();
        expect(typeof updatedSub.lastUpdate).toBe('string');
    });
});

describe('shrink protection vs user include filters', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const SUB_A = { id: 'sub-a', name: '机场A', url: 'https://example.com/sub' };

    function buildUpstreamNodes(total, primeCount) {
        const nodes = [];
        for (let i = 0; i < total - primeCount; i++) {
            nodes.push(
                `trojan://pass${i}@node${i}.example.com:443#${encodeURIComponent(`香港-Ordinary-${i}`)}`
            );
        }
        for (let i = 0; i < primeCount; i++) {
            nodes.push(
                `trojan://prime${i}@prime${i}.example.com:443#${encodeURIComponent(`!美国1 Gemini｜AI家宽【Prime】${i}`)}`
            );
        }
        return nodes.join('\n');
    }

    it('仅包含过滤导致节点数骤降时，不得误判为上游截断而清空输出', async () => {
        const storage = createMemoryStorage();
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(buildUpstreamNodes(40, 2), { status: 200 }))
        );

        const result = await generateCombinedNodeList(
            { storage },
            { enableAccessLog: false, enableFlagEmoji: false },
            'ClashMeta',
            [
                {
                    ...SUB_A,
                    enabled: true,
                    enableNodeCache: false,
                    nodeCount: 40,
                    lastGoodNodeCount: 40,
                    exclude: 'keep:Prime',
                },
            ],
            '',
            { enableSubscriptions: false },
            false
        );

        const lines = result.trim().split('\n').filter(Boolean);
        expect(lines).toHaveLength(2);
        lines.forEach((line) => expect(line).toContain('Prime'));
        lines.forEach((line) => expect(line).not.toContain('Ordinary'));
    });

    it('保护性缓存开启时，过滤条件变化后应接受新结果并覆盖旧缓存', async () => {
        const cacheKey = buildSubscriptionNodeCacheKey(SUB_A);
        const cachedNodes = Array.from(
            { length: 40 },
            (_, index) =>
                `trojan://pass${index}@node${index}.example.com:443#${encodeURIComponent(`香港-Ordinary-${index}`)}`
        );
        const storage = createMemoryStorage({
            // 旧缓存写于未配置过滤的时期：指纹与当前配置不同
            [cacheKey]: {
                nodes: cachedNodes,
                nodeCount: cachedNodes.length,
                updatedAt: '2026-01-01T00:00:00.000Z',
                filterFingerprint: buildSubscriptionFilterFingerprint({}),
            },
        });
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(buildUpstreamNodes(40, 2), { status: 200 }))
        );

        const result = await generateCombinedNodeList(
            { storage },
            { enableAccessLog: false, enableFlagEmoji: false },
            'ClashMeta',
            [
                {
                    ...SUB_A,
                    enabled: true,
                    enableNodeCache: true,
                    nodeCount: 40,
                    lastGoodNodeCount: 40,
                    exclude: 'keep:Prime',
                },
            ],
            '',
            { enableSubscriptions: false },
            false
        );

        const lines = result.trim().split('\n').filter(Boolean);
        expect(lines).toHaveLength(2);
        lines.forEach((line) => expect(line).toContain('Prime'));

        const cache = await storage.get(cacheKey);
        expect(cache.nodes).toHaveLength(2);
        cache.nodes.forEach((node) => expect(node).toContain('Prime'));
    });

    it('过滤条件变化后命中 0 节点时，不回退旧配置的缓存节点', async () => {
        const cacheKey = buildSubscriptionNodeCacheKey(SUB_A);
        const cachedNodes = Array.from(
            { length: 40 },
            (_, index) =>
                `trojan://pass${index}@node${index}.example.com:443#${encodeURIComponent(`香港-Ordinary-${index}`)}`
        );
        const storage = createMemoryStorage({
            [cacheKey]: {
                nodes: cachedNodes,
                nodeCount: cachedNodes.length,
                updatedAt: '2026-01-01T00:00:00.000Z',
                filterFingerprint: buildSubscriptionFilterFingerprint({}),
            },
        });
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(buildUpstreamNodes(40, 0), { status: 200 }))
        );

        const result = await generateCombinedNodeList(
            { storage },
            { enableAccessLog: false, enableFlagEmoji: false },
            'ClashMeta',
            [
                {
                    ...SUB_A,
                    enabled: true,
                    enableNodeCache: true,
                    nodeCount: 40,
                    lastGoodNodeCount: 40,
                    exclude: 'keep:Prime',
                },
            ],
            '',
            { enableSubscriptions: false },
            false
        );

        expect(result.trim()).toBe('');
    });

    it('过滤条件未变化时，真实截断仍然回退保护性缓存', async () => {
        const cacheKey = buildSubscriptionNodeCacheKey(SUB_A);
        const subWithFilter = {
            ...SUB_A,
            enabled: true,
            enableNodeCache: true,
            exclude: 'keep:Prime',
        };
        const cachedNodes = Array.from(
            { length: 20 },
            (_, index) =>
                `trojan://prime${index}@prime${index}.example.com:443#${encodeURIComponent(`!美国1 Gemini｜AI家宽【Prime】${index}`)}`
        );
        const storage = createMemoryStorage({
            [cacheKey]: {
                nodes: cachedNodes,
                nodeCount: cachedNodes.length,
                updatedAt: '2026-01-01T00:00:00.000Z',
                filterFingerprint: buildSubscriptionFilterFingerprint(subWithFilter),
            },
        });
        // 上游被截断：仅剩 1 个 Prime 节点（过滤后 1/20 < 0.3）
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(buildUpstreamNodes(1, 1), { status: 200 }))
        );

        const result = await generateCombinedNodeList(
            { storage },
            { enableAccessLog: false, enableFlagEmoji: false },
            'ClashMeta',
            [subWithFilter],
            '',
            { enableSubscriptions: false },
            false
        );

        const lines = result.trim().split('\n').filter(Boolean);
        expect(lines).toHaveLength(cachedNodes.length);
    });
});
