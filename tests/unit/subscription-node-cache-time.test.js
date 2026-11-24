import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Card from '../../src/components/ui/Card.vue';
import { createI18n } from '../../src/i18n/index.js';
import { useDataStore } from '../../src/stores/useDataStore.js';

const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
    mockApiGet: vi.fn(),
    mockApiPost: vi.fn(),
}));

vi.mock('../../src/lib/http.js', () => ({
    api: {
        get: (...args) => mockApiGet(...args),
        post: (...args) => mockApiPost(...args),
    },
}));

vi.mock('../../src/stores/toast.js', () => ({
    useToastStore: () => ({
        showToast: vi.fn(),
    }),
}));

function mountCard(misub, locale = 'zh-CN') {
    return mount(Card, {
        props: { misub },
        global: {
            plugins: [createI18n({ initialLocale: locale })],
            stubs: {
                Switch: { template: '<button class="switch-stub"></button>' },
            },
        },
    });
}

function makeSub(nodeCacheUpdatedAt, extra = {}) {
    return {
        id: 'sub_cache_test',
        name: '缓存测试',
        url: 'https://example.com/sub',
        enabled: true,
        nodeCount: 84,
        enableNodeCache: true,
        nodeCacheUpdatedAt,
        nodeCacheCount: 84,
        ...extra,
    };
}

describe('subscription protective node cache timestamp display', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        mockApiGet.mockReset();
        mockApiPost.mockReset();
        if (typeof localStorage !== 'undefined') {
            localStorage.clear();
        }
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('hides cache time row when protective node cache is disabled', () => {
        const wrapper = mountCard({
            id: 'sub_off',
            name: '未开启缓存',
            url: 'https://example.com/sub',
            enabled: true,
            nodeCount: 12,
            enableNodeCache: false,
            nodeCacheUpdatedAt: '2026-11-25T06:20:05.000Z',
        });

        expect(wrapper.find('[data-testid="subscription-node-cache-time"]').exists()).toBe(false);
    });

    it('renders today time as HH:mm:ss with emerald dot and custom hover tooltip', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 10, 25, 20, 0, 0));

        const iso = new Date(2026, 10, 25, 0, 0, 16).toISOString();
        const wrapper = mountCard(makeSub(iso));

        const row = wrapper.get('[data-testid="subscription-node-cache-time"]');
        const triggerEl = wrapper.get('[data-testid="subscription-node-cache-trigger"]');
        const valueEl = wrapper.get('[data-testid="subscription-node-cache-value"]');
        const dotEl = wrapper.get('[data-testid="subscription-node-cache-dot"]');
        const tooltipEl = wrapper.get('[data-testid="subscription-node-cache-tooltip"]');

        expect(row.text()).toContain('缓存时间');
        expect(row.classes()).not.toContain('group/cache');
        expect(triggerEl.classes()).toContain('group/cache');
        expect(row.attributes('title')).toBeUndefined();
        expect(valueEl.text()).toBe('00:00:16');
        expect(dotEl.classes()).toContain('bg-emerald-500');
        expect(valueEl.element.parentElement.className).toContain('text-emerald-600');
        expect(tooltipEl.text()).toContain('新鲜缓存');
        expect(tooltipEl.text()).toContain('2026-11-25 00:00:16');
        expect(tooltipEl.text()).toContain('已缓存 84 个节点');
    });

    it('colors cache emerald within 24h and amber beyond 24h while showing relative day prefixes for 1-6 days', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 10, 25, 20, 0, 0));

        // 昨天但在 24 小时内（22 小时前）-> 翠绿色 + 昨天
        const freshYesterday = mountCard(makeSub(new Date(2026, 10, 24, 22, 0, 5).toISOString()));
        expect(freshYesterday.get('[data-testid="subscription-node-cache-value"]').text()).toBe(
            '昨天 22:00:05'
        );
        expect(
            freshYesterday.get('[data-testid="subscription-node-cache-dot"]').classes()
        ).toContain('bg-emerald-500');
        expect(
            freshYesterday.get('[data-testid="subscription-node-cache-tooltip"]').text()
        ).toContain('新鲜缓存');

        // 昨天且超过 24 小时（30 小时前）-> 橙黄色 + 昨天
        const staleYesterday = mountCard(makeSub(new Date(2026, 10, 24, 14, 0, 5).toISOString()));
        expect(staleYesterday.get('[data-testid="subscription-node-cache-value"]').text()).toBe(
            '昨天 14:00:05'
        );
        expect(
            staleYesterday.get('[data-testid="subscription-node-cache-dot"]').classes()
        ).toContain('bg-amber-500');
        expect(
            staleYesterday.get('[data-testid="subscription-node-cache-tooltip"]').text()
        ).toContain('超过24小时');

        // 前天
        const dayBefore = mountCard(makeSub(new Date(2026, 10, 23, 9, 5, 8).toISOString()));
        expect(dayBefore.get('[data-testid="subscription-node-cache-value"]').text()).toBe(
            '前天 09:05:08'
        );
        expect(dayBefore.get('[data-testid="subscription-node-cache-dot"]').classes()).toContain(
            'bg-amber-500'
        );

        // 3 天前 ~ 6 天前
        const threeDays = mountCard(makeSub(new Date(2026, 10, 22, 8, 10, 12).toISOString()));
        expect(threeDays.get('[data-testid="subscription-node-cache-value"]').text()).toBe(
            '3天前 08:10:12'
        );

        const sixDays = mountCard(makeSub(new Date(2026, 10, 19, 23, 59, 59).toISOString()));
        expect(sixDays.get('[data-testid="subscription-node-cache-value"]').text()).toBe(
            '6天前 23:59:59'
        );

        // 英文文案
        const enFourDays = mountCard(
            makeSub(new Date(2026, 10, 21, 11, 22, 33).toISOString()),
            'en-US'
        );
        expect(enFourDays.get('[data-testid="subscription-node-cache-value"]').text()).toBe(
            '4 days ago 11:22:33'
        );
        expect(enFourDays.get('[data-testid="subscription-node-cache-tooltip"]').text()).toContain(
            'Over 24h'
        );
    });

    it('shows MM-DD HH:mm:ss for 7+ days in same year and YYYY-MM-DD HH:mm:ss across years', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 10, 25, 20, 0, 0));

        // 7 天前（当年）-> 月日 时分秒 + 橙黄色
        const sevenDays = mountCard(makeSub(new Date(2026, 10, 18, 14, 20, 5).toISOString()));
        expect(sevenDays.get('[data-testid="subscription-node-cache-value"]').text()).toBe(
            '11-18 14:20:05'
        );
        expect(sevenDays.get('[data-testid="subscription-node-cache-dot"]').classes()).toContain(
            'bg-amber-500'
        );

        // 跨年 -> 年月日 时分秒 + 橙黄色
        const prevYear = mountCard(makeSub(new Date(2025, 10, 20, 14, 20, 5).toISOString()));
        expect(prevYear.get('[data-testid="subscription-node-cache-value"]').text()).toBe(
            '2025-11-20 14:20:05'
        );
        expect(prevYear.get('[data-testid="subscription-node-cache-dot"]').classes()).toContain(
            'bg-amber-500'
        );
    });

    it('renders empty cache fallback with muted dot and tooltip hint', () => {
        const zhWrapper = mountCard(makeSub(null), 'zh-CN');
        expect(zhWrapper.get('[data-testid="subscription-node-cache-time"]').text()).toContain(
            '缓存时间'
        );
        expect(zhWrapper.get('[data-testid="subscription-node-cache-value"]').text()).toBe(
            '暂无缓存'
        );
        expect(zhWrapper.get('[data-testid="subscription-node-cache-dot"]').classes()).toContain(
            'bg-gray-400/70'
        );
        expect(zhWrapper.get('[data-testid="subscription-node-cache-tooltip"]').text()).toContain(
            '待订阅成功拉取后生成缓存'
        );

        const enWrapper = mountCard(makeSub('not-a-valid-date'), 'en-US');
        expect(enWrapper.get('[data-testid="subscription-node-cache-time"]').text()).toContain(
            'Cache time'
        );
        expect(enWrapper.get('[data-testid="subscription-node-cache-value"]').text()).toBe(
            'No cache yet'
        );
    });

    it('strips transient node cache metadata before saving to /api/misubs and keeps backend response metadata', async () => {
        const cachedAt = '2026-11-24T06:20:05.000Z';
        const dataStore = useDataStore();
        dataStore.hydrateFromData({
            misubs: [
                {
                    id: 'sub_1',
                    name: '机场A',
                    url: 'https://example.com/sub',
                    enabled: true,
                    enableNodeCache: true,
                    nodeCacheUpdatedAt: cachedAt,
                    nodeCacheCount: 18,
                },
            ],
            profiles: [],
            ruleTemplates: [],
            config: {},
        });

        mockApiPost.mockResolvedValue({
            success: true,
            data: {
                misubs: [
                    {
                        id: 'sub_1',
                        name: '机场A',
                        url: 'https://example.com/sub',
                        enabled: true,
                        enableNodeCache: true,
                        nodeCacheUpdatedAt: cachedAt,
                        nodeCacheCount: 18,
                    },
                ],
                profiles: [],
            },
        });

        const saved = await dataStore.saveData();
        expect(saved).toBe(true);
        expect(mockApiPost).toHaveBeenCalledWith(
            '/api/misubs',
            expect.objectContaining({
                misubs: [
                    {
                        id: 'sub_1',
                        name: '机场A',
                        url: 'https://example.com/sub',
                        enabled: true,
                        enableNodeCache: true,
                    },
                ],
            })
        );
        expect(dataStore.subscriptions[0].nodeCacheUpdatedAt).toBe(cachedAt);
        expect(dataStore.subscriptions[0].nodeCacheCount).toBe(18);
    });
});
