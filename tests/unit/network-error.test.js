/**
 * 网络类错误消息的判定。
 *
 * 这个模块存在的理由是一条真实缺陷：NodePreviewModal.vue 与 useNodePreview.js
 * 曾用 `err.message.includes('网络')` 判断网络失败，而代码库里没有任何地方
 * 抛出含「网络」二字的错误，于是那个分支永远不命中 ——
 * 网络失败时用户看到的是原始的 "Failed to fetch" 而不是友好提示。
 *
 * 判定必须只认上游实际抛出的措辞（英文、随浏览器而异），
 * 一旦改成匹配界面文案，判定就会随语言漂移。
 */
import { describe, expect, it } from 'vitest';
import { isNetworkErrorMessage } from '../../src/utils/network-error.js';

describe('isNetworkErrorMessage', () => {
    it('认得各浏览器实际抛出的网络失败措辞', () => {
        for (const message of [
            'TypeError: Failed to fetch',
            'Failed to fetch',
            'fetch failed',
            'NetworkError when attempting to fetch resource.',
            'Network request failed',
            'Load failed', // Safari
            'net::ERR_INTERNET_DISCONNECTED',
            'net::ERR_NAME_NOT_RESOLVED',
            'connect ECONNREFUSED 127.0.0.1:443',
            'ETIMEDOUT',
            'network down',
        ]) {
            expect(isNetworkErrorMessage(message), `${message} 应判为网络错误`).toBe(true);
        }
    });

    it('大小写不敏感', () => {
        expect(isNetworkErrorMessage('FAILED TO FETCH')).toBe(true);
        expect(isNetworkErrorMessage('networkerror')).toBe(true);
    });

    it('动态 chunk 加载失败不算网络问题（消息里含 fetch 也不行）', () => {
        for (const message of [
            'Failed to fetch dynamically imported module: /assets/js/x.js',
            'error loading dynamically imported module',
        ]) {
            expect(isNetworkErrorMessage(message)).toBe(false);
        }
    });

    it('业务错误不会被误判成网络错误', () => {
        for (const message of [
            'Unauthorized',
            'MISUB_KV missing',
            'storage full',
            '加载节点失败',
            'boom',
        ]) {
            expect(isNetworkErrorMessage(message), `${message} 不应判为网络错误`).toBe(false);
        }
    });

    it('空值安全', () => {
        for (const value of ['', null, undefined, 0, {}]) {
            expect(isNetworkErrorMessage(value)).toBe(false);
        }
    });

    it('不再把中文「网络」当作判据（记录当年那个永远不命中的分支）', () => {
        // 旧实现是 err.message.includes('网络')：中文消息能命中，
        // 而真实的上游错误是英文，所以线上永远走不到这个分支。
        // 现在反过来：中文文案不再是判据，英文措辞才是。
        expect(isNetworkErrorMessage('网络连接失败')).toBe(false);
        expect(isNetworkErrorMessage('Failed to fetch')).toBe(true);
    });
});
