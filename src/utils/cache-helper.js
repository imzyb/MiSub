/**
 * Simple SessionStorage Cache Helper
 * 
 * Provides basic get/set/clear operations with Time-To-Live (TTL) support.
 */

const isDev = import.meta.env.DEV;

export function createStorageCache(keyBase, ttlMs) {
    const DATA_KEY = keyBase;
    const TS_KEY = `${keyBase}_ts`;

    function get() {
        try {
            const timestamp = sessionStorage.getItem(TS_KEY);
            if (!timestamp) return null;

            const age = Date.now() - parseInt(timestamp, 10);
            if (age > ttlMs) {
                clear(); // Auto expire
                return null;
            }

            const raw = sessionStorage.getItem(DATA_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.warn(`[Cache] Failed to read ${DATA_KEY}`, e);
            return null;
        }
    }

    function set(data) {
        try {
            sessionStorage.setItem(DATA_KEY, JSON.stringify(data));
            sessionStorage.setItem(TS_KEY, String(Date.now()));
        } catch (e) {
            if (isDev) console.warn(`[Cache] Failed to write ${DATA_KEY}`, e);
        }
    }

    function clear() {
        try {
            sessionStorage.removeItem(DATA_KEY);
            sessionStorage.removeItem(TS_KEY);
        } catch (e) {
            // Ignore
        }
    }

    return { get, set, clear };
}
