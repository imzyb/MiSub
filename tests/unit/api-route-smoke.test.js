import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 接口级冒烟：把 api-router 里注册的每条路由都真实分发一次，
// 确保没有任何接口因为「未定义标识符 / 漏 import」直接抛异常或返回 500。

const mocks = vi.hoisted(() => ({
    store: new Map(),
    adapter: null,
    settings: {},
}));

vi.mock('../../functions/modules/auth-middleware.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        // 冒烟只验证路由分发与 handler 可达性，鉴权边界由专门测试覆盖。
        authMiddleware: vi.fn(async () => true),
    };
});

vi.mock('../../functions/storage-adapter.js', async (importOriginal) => {
    const actual = await importOriginal();
    const get = async (key) => (mocks.store.has(key) ? mocks.store.get(key) : null);
    const put = async (key, value) => {
        mocks.store.set(key, value);
        return true;
    };
    const del = async (key) => {
        mocks.store.delete(key);
        return true;
    };
    mocks.adapter = {
        type: 'kv',
        get,
        put,
        delete: del,
        getAllSubscriptions: async () => mocks.store.get('misub_subscriptions_v1') || [],
        getAllProfiles: async () => mocks.store.get('misub_profiles_v1') || [],
        updateSubscriptionById: async (id, apply) => ({ id, ...apply({ id }) }),
        getSubscriptionsByIds: async (ids) =>
            (mocks.store.get('misub_subscriptions_v1') || []).filter((s) => ids.includes(s.id)),
    };
    return {
        ...actual,
        StorageFactory: {
            ...actual.StorageFactory,
            createAdapter: () => mocks.adapter,
            getStorageType: async () => 'kv',
            resolveKV: (env) => env?.MISUB_KV || null,
            createNodeStore: () => ({
                getSnapshot: async () => null,
                putSnapshot: async () => true,
                listSnapshotsFor: async () => [],
                markSnapshotFailure: async () => true,
            }),
        },
        SettingsCache: {
            get: async () => mocks.settings,
            clear: () => {},
        },
        DataMigrator: {
            migrateKVToD1: async () => ({ success: true }),
            detectLegacyD1MainRows: async () => ({ hasLegacyData: false }),
            migrateLegacyD1MainRows: async () => ({ errors: [] }),
        },
        STORAGE_TYPES: { KV: 'kv', D1: 'd1' },
    };
});

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function collectRoutes() {
    const source = readFileSync(resolve(rootDir, 'functions/modules/api-router.js'), 'utf8');
    const routes = new Set();
    for (const match of source.matchAll(/path === '([^']+)'/g)) routes.add(match[1]);
    for (const match of source.matchAll(/path\.startsWith\('([^']+)'\)/g)) {
        routes.add(match[1] === '/ext/v1' ? '/ext/v1/subscriptions' : match[1]);
    }
    for (const match of source.matchAll(/case '([^']+)':/g)) routes.add(match[1]);
    return [...routes].sort();
}

function createKv() {
    return {
        get: async (key) => {
            const value = mocks.store.get(key);
            return typeof value === 'string' ? value : value == null ? null : JSON.stringify(value);
        },
        put: async (key, value) => {
            mocks.store.set(key, value);
            return true;
        },
        delete: async (key) => {
            mocks.store.delete(key);
            return true;
        },
        list: async () => ({ keys: [] }),
    };
}

function requestFor(path, method) {
    const init = { method, headers: {} };
    if (method !== 'GET' && method !== 'HEAD') {
        init.headers['content-type'] = 'application/json';
        init.body = '{}';
    }
    return new Request('https://misub.internal/api' + path, init);
}

describe('API 路由全量冒烟', () => {
    beforeEach(() => {
        mocks.store.clear();
        mocks.settings = {
            storageType: 'kv',
            mytoken: 'auto',
            profileToken: 'profiles',
            enableAccessLog: false,
            enableFlagEmoji: false,
            enableTrafficNode: false,
            externalApi: { enabled: false, tokens: [] },
        };
        mocks.store.set('worker_settings_v1', mocks.settings);
        mocks.store.set('misub_subscriptions_v1', [
            { id: 'sub-1', name: 'Airport', url: 'https://airport.example/sub', enabled: true },
        ]);
        mocks.store.set('misub_profiles_v1', [
            {
                id: 'profile-1',
                name: 'Profile',
                enabled: true,
                subscriptions: ['sub-1'],
                manualNodes: [],
            },
        ]);
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('proxies: []', { status: 200 }))
        );
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('所有路由在 GET/POST/DELETE 下发都不抛未定义标识符异常', async () => {
        const { handleApiRequest } = await import('../../functions/modules/api-router.js');
        const env = {
            MISUB_KV: createKv(),
            COOKIE_SECRET: 'test-cookie-secret',
            ADMIN_PASSWORD: 'admin-test-password',
        };
        const context = { env, waitUntil: vi.fn() };
        const routes = collectRoutes();
        expect(routes.length).toBeGreaterThan(20);

        const failures = [];
        for (const path of routes) {
            for (const method of ['GET', 'POST', 'DELETE']) {
                try {
                    const response = await handleApiRequest(requestFor(path, method), env, context);
                    const body = await response.text();
                    if (/is not defined/.test(body)) {
                        failures.push(method + ' ' + path + ' -> ' + body.slice(0, 160));
                    }
                    if (response.status >= 500 && /Internal Server Error/.test(body)) {
                        // handler 自己兜底的 500 也视为可疑：记录状态用于人工排查
                        failures.push(method + ' ' + path + ' -> HTTP 500 ' + body.slice(0, 160));
                    }
                } catch (error) {
                    failures.push(
                        method +
                            ' ' +
                            path +
                            ' threw ' +
                            (error?.name || 'Error') +
                            ': ' +
                            error?.message
                    );
                }
            }
        }

        expect(failures).toEqual([]);
    }, 60000);
});
