/**
 * chunk 重载恢复逻辑的单测。
 *
 * 这里的核心风险不是「能不能恢复」，而是**不能把用户卡在无限刷新循环里**：
 * 站点数据被禁用时 sessionStorage 写不进去，就无法记录「已经重载过」。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isChunkLoadError, shouldReloadForChunkError } from '../../src/utils/chunk-reload.js';

/** 用 Map 做后端的 sessionStorage 假实现 */
function createSessionStorageStub(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
        store,
        api: {
            getItem: (key) => (store.has(key) ? store.get(key) : null),
            setItem: (key, value) => store.set(key, String(value)),
            removeItem: (key) => store.delete(key),
            clear: () => store.clear(),
        },
    };
}

describe('isChunkLoadError', () => {
    it('识别动态导入 chunk 失败的两种措辞', () => {
        expect(isChunkLoadError('Failed to fetch dynamically imported module: /assets/x.js')).toBe(
            true
        );
        expect(isChunkLoadError('error loading dynamically imported module')).toBe(true);
    });

    it('不把普通错误误判为 chunk 失败', () => {
        expect(isChunkLoadError('Failed to fetch')).toBe(false);
        expect(isChunkLoadError('NetworkError when attempting to fetch resource.')).toBe(false);
        expect(isChunkLoadError('reportAllChanges is not a function')).toBe(false);
    });

    it('对空值容错', () => {
        expect(isChunkLoadError(undefined)).toBe(false);
        expect(isChunkLoadError(null)).toBe(false);
        expect(isChunkLoadError('')).toBe(false);
    });
});

describe('shouldReloadForChunkError', () => {
    let stub;

    beforeEach(() => {
        stub = createSessionStorageStub();
        vi.stubGlobal('sessionStorage', stub.api);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('首次返回 true 并写下标记', () => {
        expect(shouldReloadForChunkError()).toBe(true);
        expect(stub.store.get('misub:chunk-reload')).toBe('1');
    });

    it('同一会话内再次调用返回 false，避免无限重载循环', () => {
        expect(shouldReloadForChunkError()).toBe(true);
        expect(shouldReloadForChunkError()).toBe(false);
        expect(shouldReloadForChunkError()).toBe(false);
    });

    it('已有标记时直接返回 false', () => {
        stub = createSessionStorageStub({ 'misub:chunk-reload': '1' });
        vi.stubGlobal('sessionStorage', stub.api);

        expect(shouldReloadForChunkError()).toBe(false);
    });

    it('标记值不是 "1" 时仍允许重载', () => {
        stub = createSessionStorageStub({ 'misub:chunk-reload': '0' });
        vi.stubGlobal('sessionStorage', stub.api);

        expect(shouldReloadForChunkError()).toBe(true);
    });

    it('读取抛错时返回 false，不抛出（否则会中断外层错误处理器）', () => {
        vi.stubGlobal('sessionStorage', {
            getItem: () => {
                throw new Error('SecurityError');
            },
            setItem: () => {},
            removeItem: () => {},
        });
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        expect(() => shouldReloadForChunkError()).not.toThrow();
        expect(shouldReloadForChunkError()).toBe(false);
    });

    it('写入抛错时返回 false —— 记不下「已重载」就不能重载，否则无限刷新', () => {
        vi.stubGlobal('sessionStorage', {
            getItem: () => null,
            setItem: () => {
                throw new Error('QuotaExceededError');
            },
            removeItem: () => {},
        });
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        expect(shouldReloadForChunkError()).toBe(false);
    });

    it('站点数据被完全禁用（连访问都抛错）时依然返回 false', () => {
        vi.stubGlobal('sessionStorage', {
            get getItem() {
                throw new Error('SecurityError: The operation is insecure.');
            },
            get setItem() {
                throw new Error('SecurityError: The operation is insecure.');
            },
        });
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        expect(shouldReloadForChunkError()).toBe(false);
    });
});
