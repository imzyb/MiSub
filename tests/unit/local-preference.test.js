import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    canUseLocalStorage,
    readPreference,
    readRawPreference,
    removePreference,
    writePreference,
    writeRawPreference,
} from '../../src/utils/local-preference.js';

const KEY = 'misub:testPreference';
const normalizeStrings = (value) =>
    Array.isArray(value) ? value.filter((item) => typeof item === 'string') : undefined;

describe('local-preference', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('reads back what it wrote', () => {
        expect(writePreference(KEY, ['a', 'b'])).toBe(true);
        expect(readPreference(KEY, normalizeStrings, [])).toEqual(['a', 'b']);
    });

    it('falls back when the key is absent or corrupt', () => {
        expect(readPreference(KEY, normalizeStrings, [])).toEqual([]);

        localStorage.setItem(KEY, 'not-json{{');
        expect(readPreference(KEY, normalizeStrings, [])).toEqual([]);
    });

    it('falls back when the payload fails validation', () => {
        localStorage.setItem(KEY, JSON.stringify({ a: 1 }));
        expect(readPreference(KEY, normalizeStrings, [])).toEqual([]);
    });

    it('reports failure when storage rejects the write', () => {
        vi.stubGlobal('localStorage', {
            getItem: () => null,
            setItem: () => {
                throw new Error('QuotaExceededError');
            },
            removeItem: () => {},
        });

        expect(writePreference(KEY, ['a'])).toBe(false);
        expect(writeRawPreference(KEY, 'true')).toBe(false);
    });

    it('reports failure when storage silently drops the write', () => {
        // Safari 无痕模式 / 部分隐私扩展：setItem 不抛错，但值不会落盘。
        vi.stubGlobal('localStorage', {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        });

        expect(writePreference(KEY, ['a'])).toBe(false);
        expect(writeRawPreference(KEY, 'true')).toBe(false);
    });

    it('reports failure when the value survives removal', () => {
        writeRawPreference(KEY, 'true');

        // removeItem 变成空实现 → 回读仍能读到 → 必须判定为失败
        vi.stubGlobal('localStorage', {
            getItem: () => 'true',
            setItem: () => {},
            removeItem: () => {},
        });

        expect(removePreference(KEY)).toBe(false);
    });

    it('keeps raw string preferences unquoted for backward compatibility', () => {
        expect(writeRawPreference(KEY, 'true')).toBe(true);
        expect(localStorage.getItem(KEY)).toBe('true');
        expect(readRawPreference(KEY)).toBe('true');

        expect(removePreference(KEY)).toBe(true);
        expect(readRawPreference(KEY)).toBe(null);
    });

    it('treats unavailable storage as a failure instead of throwing', () => {
        vi.stubGlobal('localStorage', undefined);

        expect(canUseLocalStorage()).toBe(false);
        expect(readPreference(KEY, normalizeStrings, [])).toEqual([]);
        expect(readRawPreference(KEY)).toBe(null);
        expect(writePreference(KEY, ['a'])).toBe(false);
        expect(removePreference(KEY)).toBe(false);
    });
});
