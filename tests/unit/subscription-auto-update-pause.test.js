import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { handleBatchUpdateNodesRequest } from '../../functions/modules/handlers/node-handler.js';
import { handleApiRequest } from '../../functions/modules/api-router.js';
import { generateCombinedNodeList } from '../../functions/services/subscription-service.js';
import {
    filterAutoUpdateSubscriptions,
    isAutoUpdateEnabled,
    isAutoUpdatePaused,
} from '../../functions/utils/auto-update.js';
import Card from '../../src/components/ui/Card.vue';
import AdvancedOptions from '../../src/components/modals/SubscriptionEditModal/AdvancedOptions.vue';
import { useSubscriptionForms } from '../../src/composables/useSubscriptionForms.js';
import { createI18n } from '../../src/i18n/index.js';

vi.mock('../../src/stores/toast.js', () => ({
    useToastStore: () => ({ showToast: vi.fn() }),
}));

const CLASH_YAML = `proxies:
  - name: HK 1
    type: trojan
    server: example.com
    port: 443
    password: pass
`;

function makeEnv(subscriptions) {
    return {
        KV: {
            async get(key) {
                if (key === 'misub_subscriptions_v1') return JSON.stringify(subscriptions);
                return null;
            },
            async put() {},
            async delete() {},
            async list() {
                return { keys: [] };
            },
        },
    };
}

function createKv(initial = {}) {
    const values = new Map(
        Object.entries(initial).map(([key, value]) => [
            key,
            typeof value === 'string' ? value : JSON.stringify(value),
        ])
    );
    return {
        async get(key) {
            return values.get(key) ?? null;
        },
        async put(key, value) {
            values.set(key, value);
        },
        async delete(key) {
            values.delete(key);
        },
    };
}

function createExternalEnv({ subscriptions = [] } = {}) {
    return {
        MISUB_KV: createKv({
            worker_settings_v1: {
                externalApi: { enabled: true, tokens: [{ name: 'default', token: 'misub_ok' }] },
            },
            misub_subscriptions_v1: subscriptions,
            misub_profiles_v1: [],
        }),
        COOKIE_SECRET: 'cookie-secret-for-test',
        ADMIN_PASSWORD: 'admin-password-for-test',
    };
}

function createExternalRequest(path, { method = 'POST', body } = {}) {
    return new Request(`https://example.com/api/ext/v1${path}`, {
        method,
        headers: {
            Authorization: 'Bearer misub_ok',
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });
}

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

describe('单机场暂停自动更新', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('缺省视为开启，只有显式 false 才算暂停', () => {
        expect(isAutoUpdateEnabled({})).toBe(true);
        expect(isAutoUpdateEnabled({ autoUpdate: undefined })).toBe(true);
        expect(isAutoUpdateEnabled({ autoUpdate: true })).toBe(true);
        expect(isAutoUpdateEnabled({ autoUpdate: false })).toBe(false);
        expect(isAutoUpdatePaused({})).toBe(false);
        expect(isAutoUpdatePaused({ autoUpdate: false })).toBe(true);
        expect(
            filterAutoUpdateSubscriptions([
                { id: 'a' },
                { id: 'b', autoUpdate: false },
                { id: 'c', autoUpdate: true },
            ]).map((item) => item.id)
        ).toEqual(['a', 'c']);
    });

    it('新增订阅默认参与自动更新', () => {
        const { openAdd, editingSubscription } = useSubscriptionForms({
            addSubscription: vi.fn(),
            updateSubscription: vi.fn(),
        });

        openAdd();

        expect(editingSubscription.value.autoUpdate).toBe(true);
    });

    it('批量刷新接口跳过暂停自动更新的机场，并回传 skipped', async () => {
        const subscriptions = [
            {
                id: 'sub-paused',
                name: '激活窗口机场',
                url: 'https://example.com/paused',
                enabled: true,
                autoUpdate: false,
            },
            {
                id: 'sub-active',
                name: '常规机场',
                url: 'https://example.com/active',
                enabled: true,
            },
        ];

        const fetchMock = vi.fn(async () => new Response(CLASH_YAML, { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(console, 'log').mockImplementation(() => {});

        const request = new Request('http://local/api/batch_update_nodes', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ subscriptionIds: ['sub-paused', 'sub-active'] }),
        });

        const response = await handleBatchUpdateNodesRequest(request, makeEnv(subscriptions));
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.results).toHaveLength(1);
        expect(data.results[0].subscriptionId).toBe('sub-active');
        expect(data.skipped).toEqual([
            expect.objectContaining({
                subscriptionId: 'sub-paused',
                reason: 'auto_update_paused',
            }),
        ]);
        expect(data.summary).toMatchObject({
            totalSubscriptions: 1,
            successfulUpdates: 1,
            skippedSubscriptions: 1,
        });
        // 只请求了未暂停的那个机场
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('全部命中暂停项时返回成功而不是 400', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(console, 'log').mockImplementation(() => {});

        const request = new Request('http://local/api/batch_update_nodes', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ subscriptionIds: ['sub-paused'] }),
        });

        const response = await handleBatchUpdateNodesRequest(
            request,
            makeEnv([
                {
                    id: 'sub-paused',
                    name: '激活窗口机场',
                    url: 'https://example.com/paused',
                    enabled: true,
                    autoUpdate: false,
                },
            ])
        );
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.results).toEqual([]);
        expect(data.summary.skippedSubscriptions).toBe(1);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('外部 API 批量刷新跳过暂停项，并在 DTO 暴露 autoUpdate', async () => {
        const fetchMock = vi.fn(async () => new Response(CLASH_YAML, { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);

        const env = createExternalEnv({
            subscriptions: [
                {
                    id: 'sub-1',
                    name: 'Airport A',
                    url: 'https://example.com/sub-a',
                    enabled: true,
                },
                {
                    id: 'sub-2',
                    name: 'Airport B',
                    url: 'https://example.com/sub-b',
                    enabled: true,
                    autoUpdate: false,
                },
            ],
        });

        const listResponse = await handleApiRequest(
            createExternalRequest('/subscriptions', { method: 'GET' }),
            env
        );
        const listBody = await listResponse.json();
        expect(listBody.data).toEqual([
            expect.objectContaining({ id: 'sub-1', autoUpdate: true }),
            expect.objectContaining({ id: 'sub-2', autoUpdate: false }),
        ]);

        const response = await handleApiRequest(
            createExternalRequest('/subscriptions/batch-refresh', {
                body: { subscriptionIds: ['sub-1', 'sub-2'] },
            }),
            env
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.results).toEqual([
            expect.objectContaining({ id: 'sub-1', success: true }),
        ]);
        expect(body.data.skipped).toEqual([
            expect.objectContaining({ id: 'sub-2', reason: 'auto_update_paused' }),
        ]);
        expect(body.data.summary).toMatchObject({ total: 1, succeeded: 1, failed: 0, skipped: 1 });
        // 暂停项一次请求都不应发出（inspected 项本身会发 2 个请求）
        expect(fetchMock.mock.calls.every(([request]) => !request.url.includes('sub-b'))).toBe(
            true
        );
    });

    it('外部 API PATCH 支持写入 autoUpdate', async () => {
        const env = createExternalEnv({
            subscriptions: [
                { id: 'sub-1', name: 'Airport A', url: 'https://example.com/sub-a', enabled: true },
            ],
        });

        const response = await handleApiRequest(
            createExternalRequest('/subscriptions/sub-1', {
                method: 'PATCH',
                body: { autoUpdate: false },
            }),
            env
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.autoUpdate).toBe(false);
    });

    it('订阅组访问（暂停项）不会把节点数写回存储', async () => {
        const storage = createMemoryStorage();
        const updateSubscriptionById = vi.fn(async (id, apply) => ({ id, ...apply({ id }) }));
        storage.updateSubscriptionById = updateSubscriptionById;
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
                    id: 'sub-paused',
                    name: '机场A',
                    url: 'https://example.com/sub',
                    enabled: true,
                    autoUpdate: false,
                },
            ],
            '',
            { enableSubscriptions: false },
            false
        );

        // 节点照常输出给客户端
        expect(result.trim()).toBe('trojan://pass@example.com:443#HK');
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(updateSubscriptionById).not.toHaveBeenCalled();
    });

    it('订阅组访问（未暂停项）同样不写回，只把运行时信息留在当前请求', async () => {
        const storage = createMemoryStorage();
        const updateSubscriptionById = vi.fn(async (id, apply) => ({ id, ...apply({ id }) }));
        storage.updateSubscriptionById = updateSubscriptionById;
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('trojan://pass@example.com:443#HK', { status: 200 }))
        );

        await generateCombinedNodeList(
            { storage },
            { enableAccessLog: false, enableFlagEmoji: false },
            'ClashMeta',
            [
                {
                    id: 'sub-active',
                    name: '机场B',
                    url: 'https://example.com/sub',
                    enabled: true,
                },
            ],
            '',
            { enableSubscriptions: false },
            false
        );

        await new Promise((resolve) => setTimeout(resolve, 0));
        // 订阅组访问是只读的：节点数/流量改由显式刷新、Cron 或 D1 持久化快照维护。
        expect(updateSubscriptionById).not.toHaveBeenCalled();
    });

    it('启用持久化时，订阅卡片展示禁用自动更新徽标', () => {
        const wrapper = mount(Card, {
            props: {
                persistenceEnabled: true,
                misub: {
                    id: 'sub_1',
                    name: '激活窗口机场',
                    url: 'https://api.example.com/sub?target=clash',
                    enabled: true,
                    nodeCount: 3,
                    autoUpdate: false,
                },
            },
            global: {
                plugins: [createI18n({ initialLocale: 'zh-CN' })],
                stubs: { Switch: { template: '<button class="switch-stub"></button>' } },
            },
        });

        const badge = wrapper.get('[data-testid="subscription-auto-update-paused"]');
        expect(badge.text()).toBe('已禁用自动更新');
        expect(badge.attributes('title')).toContain('不参与由访问触发的自动更新与 Cron');
    });

    it('未暂停时订阅卡片不展示徽标', () => {
        const wrapper = mount(Card, {
            props: {
                misub: {
                    id: 'sub_2',
                    name: '常规机场',
                    url: 'https://api.example.com/sub?target=clash',
                    enabled: true,
                    nodeCount: 3,
                },
            },
            global: {
                plugins: [createI18n({ initialLocale: 'zh-CN' })],
                stubs: { Switch: { template: '<button class="switch-stub"></button>' } },
            },
        });

        expect(wrapper.find('[data-testid="subscription-auto-update-paused"]').exists()).toBe(
            false
        );
    });

    it('编辑弹窗提供「禁用自动更新」开关，勾选即关闭自动更新', async () => {
        const subscription = {
            customUserAgent: '',
            notes: '',
            enableNodeCache: false,
            plusAsSpace: false,
            excludeTraffic: false,
            autoUpdate: true,
        };
        const wrapper = mount(AdvancedOptions, {
            props: { editingSubscription: subscription, persistenceEnabled: true },
            global: { plugins: [createI18n({ initialLocale: 'zh-CN' })] },
        });

        expect(wrapper.text()).toContain('禁用自动更新');
        const switches = wrapper.findAllComponents({ name: 'Switch' });
        expect(switches).toHaveLength(4);
        // autoUpdate=true 时「禁用自动更新」开关应为关闭状态
        expect(switches[3].find('input').element.checked).toBe(false);

        await switches[3].find('input').trigger('change');
        expect(subscription.autoUpdate).toBe(false);
        expect(switches[3].find('input').element.checked).toBe(true);
    });
});
