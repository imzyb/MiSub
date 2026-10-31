/**
 * sessionStorage 受控读写的单测。
 *
 * 关注两类失败：访问就抛错（站点数据被禁用）、写入不抛错也不落盘（静默丢失）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    canUseSessionStorage,
    readSessionPreference,
    removeSessionPreference,
    writeSessionPreference,
} from '../../src/utils/session-preference.js';

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

// 上面的「访问即抛错」用例会直接改写 globalThis 的描述符，unstubAllGlobals 管不到，
// 所以这里自己记账并还原。
const originalSessionStorageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'sessionStorage'
);

afterEach(() => {
    if (originalSessionStorageDescriptor) {
        Object.defineProperty(globalThis, 'sessionStorage', originalSessionStorageDescriptor);
    } else {
        delete globalThis.sessionStorage;
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('canUseSessionStorage', () => {
    it('可用时返回 true', () => {
        vi.stubGlobal('sessionStorage', createSessionStorageStub().api);
        expect(canUseSessionStorage()).toBe(true);
    });

    it('访问即抛错（站点数据被禁用）时返回 false 且不抛出', () => {
        // 真实场景是 window 上的 sessionStorage 取值器直接抛 SecurityError，
        // 所以必须让「访问这个全局变量本身」抛错，而不是它的某个属性。
        Object.defineProperty(globalThis, 'sessionStorage', {
            configurable: true,
            get() {
                throw new Error('SecurityError: The operation is insecure.');
            },
        });

        expect(() => canUseSessionStorage()).not.toThrow();
        expect(canUseSessionStorage()).toBe(false);
    });
});

describe('readSessionPreference', () => {
    it('读到已写入的值', () => {
        vi.stubGlobal('sessionStorage', createSessionStorageStub({ k: 'v' }).api);
        expect(readSessionPreference('k')).toBe('v');
    });

    it('key 不存在时返回 null', () => {
        vi.stubGlobal('sessionStorage', createSessionStorageStub().api);
        expect(readSessionPreference('missing')).toBeNull();
    });

    it('读取抛错时返回 null（调用方拿不到值，但流程不中断）', () => {
        vi.stubGlobal('sessionStorage', {
            getItem: () => {
                throw new Error('SecurityError');
            },
        });
        expect(readSessionPreference('k')).toBeNull();
    });
});

describe('writeSessionPreference', () => {
    it('写入成功返回 true 并真正落盘', () => {
        const stub = createSessionStorageStub();
        vi.stubGlobal('sessionStorage', stub.api);

        expect(writeSessionPreference('k', 'v')).toBe(true);
        expect(stub.store.get('k')).toBe('v');
    });

    it('把非字符串值转成字符串', () => {
        const stub = createSessionStorageStub();
        vi.stubGlobal('sessionStorage', stub.api);

        expect(writeSessionPreference('n', 42)).toBe(true);
        expect(stub.store.get('n')).toBe('42');
    });

    it('setItem 抛错时返回 false', () => {
        vi.stubGlobal('sessionStorage', {
            getItem: () => null,
            setItem: () => {
                throw new Error('QuotaExceededError');
            },
        });
        expect(writeSessionPreference('k', 'v')).toBe(false);
    });

    it('setItem 不抛错但也不落盘时返回 false（回读校验）', () => {
        vi.stubGlobal('sessionStorage', {
            getItem: () => null,
            setItem: () => {},
        });
        expect(writeSessionPreference('k', 'v')).toBe(false);
    });

    it('sessionStorage 不可用时返回 false', () => {
        vi.stubGlobal('sessionStorage', {
            get getItem() {
                throw new Error('SecurityError');
            },
            get setItem() {
                throw new Error('SecurityError');
            },
        });
        expect(writeSessionPreference('k', 'v')).toBe(false);
    });
});

describe('removeSessionPreference', () => {
    it('删除成功返回 true', () => {
        const stub = createSessionStorageStub({ k: 'v' });
        vi.stubGlobal('sessionStorage', stub.api);

        expect(removeSessionPreference('k')).toBe(true);
        expect(stub.store.has('k')).toBe(false);
    });

    it('删除未真正生效时返回 false', () => {
        vi.stubGlobal('sessionStorage', {
            getItem: () => 'still-here',
            removeItem: () => {},
        });
        expect(removeSessionPreference('k')).toBe(false);
    });

    it('removeItem 抛错时返回 false', () => {
        vi.stubGlobal('sessionStorage', {
            getItem: () => null,
            removeItem: () => {
                throw new Error('SecurityError');
            },
        });
        expect(removeSessionPreference('k')).toBe(false);
    });
});
