import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    rememberDomainName,
    lookupDomainName,
    clearDomainNameMemory,
    DOMAIN_NAME_MEMORY_KEY,
} from '../../src/utils/domain-name-memory.js';

/**
 * 机场命名记忆测试。
 *
 * 背景：订阅响应头/官网标题并不总能给出机场名，人工判断最准。
 * 因此把用户确认过的「域名 -> 名称」记下来，同域名订阅可直接套用。
 */

describe('机场命名记忆（按域名）', () => {
    beforeEach(() => {
        clearDomainNameMemory();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('记住后可以按域名查回', () => {
        rememberDomainName('gsafevpn.com', 'GsafeVPN');
        expect(lookupDomainName('gsafevpn.com')).toBe('GsafeVPN');
    });

    it('域名不区分大小写与首尾空白', () => {
        rememberDomainName('  GsafeVPN.com  ', 'GsafeVPN');
        expect(lookupDomainName('gsafevpn.COM')).toBe('GsafeVPN');
    });

    it('未记录的域名返回空字符串', () => {
        expect(lookupDomainName('unknown.com')).toBe('');
        expect(lookupDomainName('')).toBe('');
        expect(lookupDomainName(null)).toBe('');
    });

    it('同名域名重复记忆时以后写的为准', () => {
        rememberDomainName('a.com', 'First');
        rememberDomainName('a.com', 'Second');
        expect(lookupDomainName('a.com')).toBe('Second');
    });

    it('名称为空时不记录，避免污染', () => {
        rememberDomainName('b.com', '   ');
        expect(lookupDomainName('b.com')).toBe('');
        rememberDomainName('', 'X');
        expect(lookupDomainName('')).toBe('');
    });

    it('清空后不再返回任何记录', () => {
        rememberDomainName('c.com', 'C');
        clearDomainNameMemory();
        expect(lookupDomainName('c.com')).toBe('');
    });

    it('存储损坏时安全降级为空', () => {
        localStorage.setItem(DOMAIN_NAME_MEMORY_KEY, '{not valid json');
        expect(lookupDomainName('d.com')).toBe('');
        // 损坏后仍可正常写入
        rememberDomainName('d.com', 'D');
        expect(lookupDomainName('d.com')).toBe('D');
    });

    it('返回是否真正落盘，供调用方决定是否提示', () => {
        expect(rememberDomainName('e.com', 'E')).toBe(true);
        // 无需记忆的情况不算失败，避免调用方误报
        expect(rememberDomainName('', 'E')).toBe(true);
        expect(rememberDomainName('e.com', '   ')).toBe(true);
        expect(clearDomainNameMemory()).toBe(true);
    });

    it('存储被禁用时返回 false 而不是静默吞掉', () => {
        vi.stubGlobal('localStorage', {
            getItem: () => null,
            setItem: () => {
                throw new Error('QuotaExceededError');
            },
            removeItem: () => {},
        });

        expect(rememberDomainName('f.com', 'F')).toBe(false);
    });

    it('删除未被真正执行时同样返回 false', () => {
        // removeItem 是空实现 → 回读仍能读到 → 不能当成清除成功
        vi.stubGlobal('localStorage', {
            getItem: () => 'true',
            setItem: () => {},
            removeItem: () => {},
        });

        expect(clearDomainNameMemory()).toBe(false);
    });
});
