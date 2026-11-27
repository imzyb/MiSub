/**
 * 测试环境兜底：Node 26 + happy-dom 组合下，全局 localStorage / sessionStorage
 * 可能不存在（Node 自带实验性 localStorage 需要 --localstorage-file）。
 * 这里提供一个内存实现，避免业务代码在测试里因为环境差异直接抛错。
 */
function createStorageMock() {
    const store = new Map();
    return {
        get length() {
            return store.size;
        },
        key(index) {
            return Array.from(store.keys())[index] ?? null;
        },
        getItem(key) {
            return store.has(String(key)) ? store.get(String(key)) : null;
        },
        setItem(key, value) {
            store.set(String(key), String(value));
        },
        removeItem(key) {
            store.delete(String(key));
        },
        clear() {
            store.clear();
        },
    };
}

for (const name of ['localStorage', 'sessionStorage']) {
    const existing = globalThis[name];
    if (!existing || typeof existing.getItem !== 'function') {
        Object.defineProperty(globalThis, name, {
            value: createStorageMock(),
            configurable: true,
            writable: true,
        });
    }
}

if (typeof globalThis.window !== 'undefined') {
    for (const name of ['localStorage', 'sessionStorage']) {
        const existing = globalThis.window[name];
        if (!existing || typeof existing.getItem !== 'function') {
            Object.defineProperty(globalThis.window, name, {
                value: globalThis[name],
                configurable: true,
                writable: true,
            });
        }
    }
}
