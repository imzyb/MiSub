import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getAllSubscriptions = vi.fn();
const get = vi.fn();
const putAllSubscriptions = vi.fn();
const createAdapter = vi.fn();
const getStorageType = vi.fn();

vi.mock('../../functions/storage-adapter.js', () => ({
    StorageFactory: {
        createAdapter: (...args) => createAdapter(...args),
        getStorageType: (...args) => getStorageType(...args),
    },
}));

vi.mock('../../functions/services/notification-service.js', () => ({
    sendTgNotification: vi.fn().mockResolvedValue(false),
    sendEnhancedTgNotification: vi.fn().mockResolvedValue(false),
    tgEscape: (value) => value,
}));

describe('notifications cron storage helper usage', () => {
    let infoSpy;

    beforeEach(() => {
        infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

        getAllSubscriptions.mockReset();
        get.mockReset();
        putAllSubscriptions.mockReset();
        createAdapter.mockReset();
        getStorageType.mockReset();

        getStorageType.mockResolvedValue('d1');
        createAdapter.mockReturnValue({
            type: 'd1',
            getAllSubscriptions,
            get,
            putAllSubscriptions,
        });
        get.mockImplementation(async (key) => {
            if (key === 'worker_settings_v1') {
                return {};
            }
            return null;
        });
        putAllSubscriptions.mockResolvedValue(true);

        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation(async () => ({
                ok: true,
                headers: {
                    get(name) {
                        return String(name).toLowerCase() === 'subscription-userinfo'
                            ? 'upload=1; download=2; total=10'
                            : null;
                    },
                },
                async text() {
                    return 'ss://node-one\nvmess://node-two';
                },
            }))
        );
    });

    afterEach(() => {
        infoSpy.mockRestore();
        vi.unstubAllGlobals();
    });

    it('未启用节点持久化时 Cron 直接跳过（不请求机场、不写库）', async () => {
        const { handleCronTrigger } = await import('../../functions/modules/notifications.js');

        getAllSubscriptions.mockResolvedValue([
            {
                id: 'sub-1',
                name: 'Sub One',
                url: 'https://sub.example.com',
                enabled: true,
            },
        ]);

        const response = await handleCronTrigger({ MISUB_DB: {} });
        const payload = await response.json();

        expect(payload).toMatchObject({
            success: true,
            skipped: true,
            reason: 'node_persistence_disabled',
        });
        // 跳过时既不读订阅列表，也不写回任何数据。
        expect(getAllSubscriptions).not.toHaveBeenCalled();
        expect(putAllSubscriptions).not.toHaveBeenCalled();
    });
});
