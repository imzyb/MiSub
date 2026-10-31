/**
 * 全局兜底文案（getUserFriendlyMessage）的判定顺序。
 *
 * 这里最容易出的问题是「分支顺序」而不是「分支本身」：消息里同时命中多个
 * 关键词时，先命中的那个决定用户看到什么。动态 chunk 加载失败的消息是
 * 「Failed to fetch dynamically imported module」——它含 "fetch"，
 * 如果 network 分支排在前面，用户会被要求「检查网络」，
 * 而真实原因是发版后旧页面请求了已删除的资源，检查网络永远解决不了。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ErrorHandler } from '../../src/utils/errorHandler.js';
import { messages } from '../../src/i18n/messages.js';
import { setLocale } from '../../src/i18n/index.js';

const zh = messages['zh-CN'].errors;
const handler = new ErrorHandler();

// happy-dom 的 navigator.language 是 en-US，i18n 单例会据此选英文。
// 这里显式钉住语言，断言才能对着 zh-CN 字典写。
beforeEach(() => {
    setLocale('zh-CN');
});

const friendly = (message, extra = {}) => handler.getUserFriendlyMessage({ message, ...extra });

describe('getUserFriendlyMessage 判定顺序', () => {
    it('动态 chunk 加载失败不能被误判成网络问题', () => {
        // 两种措辞都要覆盖：Chrome/Firefox 用前者，部分浏览器用后者
        for (const message of [
            'Failed to fetch dynamically imported module: /assets/js/x.js',
            'error loading dynamically imported module',
        ]) {
            const result = friendly(message);
            expect(result).toBe(zh.chunkLoadFailed);
            expect(result).not.toBe(zh.network);
        }
    });

    it('普通网络错误仍然走 network 文案（新分支没有吃掉它）', () => {
        expect(friendly('NetworkError when attempting to fetch resource.')).toBe(zh.network);
        expect(friendly('Failed to fetch')).toBe(zh.network);
    });

    it('超时优先于网络', () => {
        expect(friendly('request timeout while fetching')).toBe(zh.timeout);
    });

    it('资源加载失败带文件名，且不会被 chunk 分支抢走', () => {
        const result = friendly('Resource load failed: https://x/assets/js/app.js', {
            additionalData: { src: 'https://x/assets/js/app.js' },
        });
        expect(result).toBe(zh.resourceLoad.replace('{fileName}', 'app.js'));
    });

    it('认证 / KV / D1 / 保存失败各自命中', () => {
        expect(friendly('Unauthorized')).toBe(zh.unauthorized);
        expect(friendly('MISUB_KV missing')).toBe(zh.kvMissing);
        expect(friendly('MISUB_DB missing')).toBe(zh.d1Missing);
        expect(friendly('storage full')).toBe(zh.saveFailed);
    });

    it('按 context 兜底，最后才是通用文案', () => {
        expect(friendly('boom', { context: 'subscription update' })).toBe(zh.subscriptionFailed);
        expect(friendly('boom', { context: 'batch import' })).toBe(zh.batchFailed);
        expect(friendly('boom')).toBe(zh.generic);
    });

    it('中英文案都已定义（不会出现 key 缺失回退到原文）', () => {
        for (const locale of ['zh-CN', 'en-US']) {
            const errors = messages[locale].errors;
            expect(typeof errors.chunkLoadFailed).toBe('string');
            expect(errors.chunkLoadFailed.length).toBeGreaterThan(0);
        }
    });
});
