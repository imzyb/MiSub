/**
 * 判断全局错误是否来自本站应用代码。
 *
 * 背景：window 上的 error / unhandledrejection 会把浏览器扩展注入的脚本
 * （chrome-extension://…、content_main.js）、跨域第三方脚本、以及被浏览器
 * 抹平为 "Script error." 的跨域错误一并抛出。此前这些噪音都会被
 * handleError 当作应用故障处理，触发「操作失败，请稍后重试」提示——
 * 用户看到的是与 MiSub 无关的错误弹窗。
 */
import { describe, expect, it } from 'vitest';
import { isAppScriptError, isForeignRejection } from '../../src/utils/error-source.js';

const ORIGIN = 'https://misub.example.com';

describe('isAppScriptError', () => {
    it('同源脚本错误视为应用错误', () => {
        expect(
            isAppScriptError(
                { filename: `${ORIGIN}/assets/js/index-abc123.js`, message: 'boom' },
                ORIGIN
            )
        ).toBe(true);
    });

    it('浏览器扩展脚本错误被忽略', () => {
        const extensionScripts = [
            'chrome-extension://abcdefghijklmnop/content_main.js',
            'moz-extension://11111111-2222-3333-4444-555555555555/inject.js',
            'safari-web-extension://ABCDEF/resources/script.js',
            'safari-extension://com.example.ext/script.js',
        ];
        for (const filename of extensionScripts) {
            expect(isAppScriptError({ filename, message: 'boom' }, ORIGIN)).toBe(false);
        }
    });

    it('注入脚本（VM/匿名）错误被忽略', () => {
        for (const filename of ['VM144', 'VM144:2', 'about:blank', 'blob:https://x/abc']) {
            expect(isAppScriptError({ filename, message: 'boom' }, ORIGIN)).toBe(false);
        }
    });

    it('跨域第三方脚本错误被忽略', () => {
        expect(
            isAppScriptError({ filename: 'https://third-party.test/x.js', message: 'boom' }, ORIGIN)
        ).toBe(false);
    });

    it('被浏览器抹平的 Script error. 被忽略', () => {
        expect(isAppScriptError({ filename: '', message: 'Script error.' }, ORIGIN)).toBe(false);
    });

    it('无 filename 但含具体消息时保留（可能是本站行内脚本）', () => {
        expect(
            isAppScriptError(
                { filename: '', message: "Cannot read properties of undefined (reading 'x')" },
                ORIGIN
            )
        ).toBe(true);
    });
});

describe('isForeignRejection', () => {
    it('扩展导致的 Promise 拒绝被忽略', () => {
        const reason = new Error('Cannot read properties of undefined');
        reason.stack =
            'TypeError: Cannot read properties of undefined\n    at et.reportAllChanges (chrome-extension://abc/content_main.js:2:19429)';
        expect(isForeignRejection(reason, ORIGIN)).toBe(true);
    });

    it('注入脚本（VM）导致的 Promise 拒绝被忽略', () => {
        const reason = new Error('Cannot read properties of undefined (reading startTime)');
        reason.stack = 'TypeError: ...\n    at et.reportAllChanges (VM144:2:19429)';
        expect(isForeignRejection(reason, ORIGIN)).toBe(true);
    });

    it('跨域脚本导致的 Promise 拒绝被忽略', () => {
        const reason = new Error('boom');
        reason.stack = 'Error: boom\n    at https://third-party.test/x.js:1:1';
        expect(isForeignRejection(reason, ORIGIN)).toBe(true);
    });

    it('本站代码的 Promise 拒绝仍然上报', () => {
        const reason = new Error('request failed');
        reason.stack = `Error: request failed\n    at fetchData (${ORIGIN}/assets/js/index-abc.js:1:100)`;
        expect(isForeignRejection(reason, ORIGIN)).toBe(false);
    });

    it('无法判断来源时保守上报', () => {
        const reason = new Error('no stack here');
        reason.stack = undefined;
        expect(isForeignRejection(reason, ORIGIN)).toBe(false);
    });
});
