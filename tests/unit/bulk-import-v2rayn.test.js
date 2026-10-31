import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('../../src/lib/http.js', () => ({ api: { post } }));

import { useDataStore } from '../../src/stores/useDataStore.js';
import { useBulkImportLogic } from '../../src/composables/useBulkImportLogic.js';

const V2RAYN_LINK =
    'v2rayn://hysteria2/eyJDb25maWdUeXBlIjo3LCJSZW1hcmtzIjoiaHkyIiwiQWRkcmVzcyI6IjEuMi4zLjQiLCJQb3J0Ijo4ODgzLCJQYXNzd29yZCI6InB3ZCJ9';
const CONVERTED_URI =
    'hysteria2://pwd@1.2.3.4:8883?sni=example.com&insecure=0&pinSHA256=AA%3ABB#hy2';

describe('批量导入：v2rayn:// 需要走后端解析', () => {
    let dataStore;
    let bulkImport;
    let addedNodes;

    beforeEach(() => {
        setActivePinia(createPinia());
        dataStore = useDataStore();
        dataStore.subscriptions = [];
        addedNodes = [];
        post.mockReset();

        bulkImport = useBulkImportLogic({
            addSubscriptionsFromBulk: (subs) => subs.forEach((s) => dataStore.addSubscription(s)),
            addNodesFromBulk: (nodes) => {
                addedNodes.push(...nodes);
                nodes.forEach((n) => dataStore.addSubscription(n));
            },
        });
    });

    it('v2rayn 链接先交给后端转成标准 URI 再入库', async () => {
        post.mockResolvedValue({
            success: true,
            data: { nodes: [{ name: 'hy2', url: CONVERTED_URI, protocol: 'hysteria2' }] },
        });

        await bulkImport.handleBulkImport(V2RAYN_LINK, 'g1');

        expect(post).toHaveBeenCalledTimes(1);
        expect(post.mock.calls[0][0]).toBe('/api/parse_subscription');
        expect(post.mock.calls[0][1]).toEqual({ content: V2RAYN_LINK });
        expect(addedNodes).toHaveLength(1);
        expect(addedNodes[0].url).toBe(CONVERTED_URI);
        expect(addedNodes[0].group).toBe('g1');
    });

    it('后端转换失败时回退前端解析，不抛错', async () => {
        post.mockRejectedValue(new Error('network down'));

        await expect(bulkImport.handleBulkImport(V2RAYN_LINK, '')).resolves.toBeUndefined();
        expect(addedNodes).toHaveLength(0);
    });

    it('纯标准链接不会请求后端（回归保护）', async () => {
        await bulkImport.handleBulkImport('ss://existing@server1.com:443', '');

        expect(post).not.toHaveBeenCalled();
        expect(addedNodes).toHaveLength(1);
    });

    it('Clash YAML 粘贴同样走后端', async () => {
        post.mockResolvedValue({
            success: true,
            data: { nodes: [{ name: 'hy2', url: CONVERTED_URI, protocol: 'hysteria2' }] },
        });

        await bulkImport.handleBulkImport('proxies:\n  - name: hy2\n    type: hysteria2', '');

        expect(post).toHaveBeenCalledTimes(1);
        expect(addedNodes[0].url).toBe(CONVERTED_URI);
    });

});
