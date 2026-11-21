import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleMisubsSave } from '../../functions/modules/api-handler.js';

// 线上报错里的真实历史值：早期 customId 没有长度限制，128 位
const LEGACY_LONG_ID =
    '0raswaes5ts8izlquol8nwj6pffyvf3sidx82u2utrgcgsr8a8opkoamptwe3s3hrka5bvzo1yhkgeymhlaw1hnjmum9tdzlmsts9ytznqwku6ubeflt7bjul63ze0z5';

function createKv(initial = {}) {
    const values = new Map(
        Object.entries(initial).map(([key, value]) => [
            key,
            typeof value === 'string' ? value : JSON.stringify(value),
        ])
    );
    return {
        values,
        async get(key) {
            return values.get(key) ?? null;
        },
        async put(key, value) {
            values.set(key, value);
        },
        async delete(key) {
            values.delete(key);
        },
        async list() {
            return { keys: [] };
        },
    };
}

function createEnv(profiles) {
    const kv = createKv({
        worker_settings_v1: { profileToken: 'ptoken' },
        misub_subscriptions_v1: [],
        misub_profiles_v1: profiles,
    });
    return { MISUB_KV: kv, __kv: kv };
}

function saveRequest(body) {
    return new Request('https://example.com/api/misubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function silence() {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
}

describe('保存订阅组时对历史超长 customId 的兼容', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('库里存有 128 位历史 customId 时，全量保存无关改动仍然成功', async () => {
        const stored = [{ id: 'p1', name: '旧组', customId: LEGACY_LONG_ID, enabled: true }];
        const env = createEnv(stored);
        silence();

        const response = await handleMisubsSave(
            saveRequest({
                misubs: [],
                profiles: [{ id: 'p1', name: '改了名字', customId: LEGACY_LONG_ID, enabled: true }],
            }),
            env
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
    });

    it('diff 增量保存同样不被历史值阻断', async () => {
        const stored = [{ id: 'p1', name: '旧组', customId: LEGACY_LONG_ID, enabled: true }];
        const env = createEnv(stored);
        silence();

        const response = await handleMisubsSave(
            saveRequest({
                diff: {
                    profiles: {
                        updated: [
                            { id: 'p1', name: '再改一次', customId: LEGACY_LONG_ID, enabled: true },
                        ],
                    },
                },
            }),
            env
        );

        expect(response.status).toBe(200);
    });

    it('新增组仍受长度约束，返回 400 与明确错误码', async () => {
        const env = createEnv([]);
        silence();

        const response = await handleMisubsSave(
            saveRequest({
                misubs: [],
                profiles: [{ id: 'p-new', name: '新组', customId: LEGACY_LONG_ID, enabled: true }],
            }),
            env
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.code).toBe('profile_alias_invalid');
        expect(body.message).toContain('长度 2-32');
    });

    it('把历史值原样改到另一个组会被拒绝', async () => {
        const stored = [{ id: 'p1', name: '旧组', customId: LEGACY_LONG_ID, enabled: true }];
        const env = createEnv(stored);
        silence();

        const response = await handleMisubsSave(
            saveRequest({
                misubs: [],
                profiles: [
                    { id: 'p1', name: '旧组', customId: LEGACY_LONG_ID, enabled: true },
                    { id: 'p2', name: '新组', customId: LEGACY_LONG_ID, enabled: true },
                ],
            }),
            env
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.code).toBe('profile_alias_invalid');
    });
});
