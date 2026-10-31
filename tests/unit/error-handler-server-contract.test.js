/**
 * errorHandler 与服务端错误消息的跨端契约。
 *
 * `getUserFriendlyMessage` 里有几个分支是靠**服务端返回的消息文本**来分类的
 * （`functions/` 里产生的中文，如「请先恢复 KV 绑定」「保存失败: …」）。
 * 这是一条隐式契约，没有任何类型或测试在保护它：
 *
 *   - 服务端把「KV 绑定」改成「KV 配置」→ 客户端 kvMissing 分支静默失效，
 *     用户看到的是「操作失败，请稍后重试」，而真正该说的是「请配置 KV 绑定」；
 *   - 反过来，客户端若为了「更好看」把这些匹配改成 t('...')，
 *     英文界面下就再也匹配不上服务端的中文消息。
 *
 * 这个文件把契约显式钉住，两头都锁：
 *   1. 拿**真实的服务端消息**喂给 errorHandler，断言分类正确；
 *   2. 扫描 functions/ 源码，确认这些短语确实还在被生产（防服务端单方面改文案）。
 *
 * 注意 2 必须先 stripComments —— 「KV 绑定」在 storage-adapter.js 的注释里也出现过，
 * 不剥注释的话断言会被注释喂饱，服务端改了真文案测试照样绿。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { ErrorHandler } from '../../src/utils/errorHandler.js';
import { messages } from '../../src/i18n/messages.js';
import { setLocale } from '../../src/i18n/index.js';

const FUNCTIONS_ROOT = path.resolve(__dirname, '../../functions');
const zh = messages['zh-CN'].errors;
const handler = new ErrorHandler();

// happy-dom 的 navigator.language 是 en-US，i18n 单例会据此选英文。
beforeEach(() => {
    setLocale('zh-CN');
});

function walk(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.(js|mjs)$/.test(entry)) out.push(full);
    }
    return out;
}

/** 剥掉块注释与行注释 —— 否则注释里的短语会冒充「服务端确实在生产它」 */
function stripComments(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const serverSource = walk(FUNCTIONS_ROOT)
    .map((file) => stripComments(readFileSync(file, 'utf8')))
    .join('\n');

const friendly = (message, extra = {}) => handler.getUserFriendlyMessage({ message, ...extra });

/**
 * 每条都是 functions/ 里真实会产生（或会传播到客户端）的消息。
 * 见每条的 `source` 注释。
 */
const SERVER_MESSAGES = [
    {
        source: 'functions/modules/api-handler.js —— KV 存储被暂停时保存设置',
        message: 'KV 存储已暂停，设置当前无法保存。请先恢复 KV 绑定，或配置 D1 后切换到 D1 存储。',
        expected: 'kvMissing',
    },
    {
        source: 'functions/modules/handlers/client-handler.js —— 客户端配置保存',
        message: 'KV 存储已暂停，客户端配置当前无法保存。请先恢复 KV 绑定，或改用 D1。',
        expected: 'kvMissing',
    },
    {
        // 这里多一个「未」字：旧实现 includes('KV 绑定') 匹配不到，
        // 用户看到的是通用提示而不是「请配置 KV 绑定」。
        source: 'functions/modules/api-router.js —— KV 未绑定（调试/回退接口）',
        message: 'KV 未绑定',
        expected: 'kvMissing',
    },
    {
        source: 'functions/modules/handlers/client-handler.js —— KV 未绑定，写操作不可用',
        message: 'KV 未绑定，写操作不可用',
        expected: 'kvMissing',
    },
    {
        source: 'functions/modules/api-handler.js —— 存储写入失败',
        message: '数据保存失败: Storage write failed',
        expected: 'saveFailed',
    },
    {
        source: 'functions/modules/api-handler.js —— 未捕获异常兜底',
        message: '保存失败: 服务器内部错误，请稍后重试',
        expected: 'saveFailed',
    },
    {
        source: 'functions/storage-adapter.js —— D1 适配器抛出的原始英文错误',
        message: 'D1 database not available',
        expected: 'd1Missing',
    },
];

describe('errorHandler ↔ 服务端错误消息契约', () => {
    it.each(SERVER_MESSAGES.map((item) => [item.source, item.message, item.expected]))(
        '%s',
        (_source, message, expected) => {
            expect(friendly(message)).toBe(zh[expected]);
        }
    );

    it('记录旧实现漏掉的案例（证明这些断言不是恒真）', () => {
        // 旧实现是 message.includes('KV 绑定')：
        // 服务端的「KV 未绑定」中间多一个「未」字，子串匹配直接失效，
        // 用户看到的是通用提示而不是「请配置 KV 绑定」。
        expect('KV 未绑定'.includes('KV 绑定')).toBe(false);
        expect(friendly('KV 未绑定')).toBe(zh.kvMissing);

        // 旧实现是 includes('MISUB_DB') || includes('D1 绑定')：
        // 服务端 D1 适配器抛的是英文 'D1 database not available'，两个条件都不命中。
        expect('D1 database not available'.includes('D1 绑定')).toBe(false);
        expect('D1 database not available'.includes('MISUB_DB')).toBe(false);
        expect(friendly('D1 database not available')).toBe(zh.d1Missing);
    });

    it('扫描范围没有静默空转', () => {
        expect(serverSource.length).toBeGreaterThan(10000);
    });

    it('契约短语仍然由 functions/ 在生产（服务端改文案会在这里失败）', () => {
        const phrases = [
            'KV 绑定', // api-handler / client-handler
            'KV 未绑定', // api-router / client-handler
            '数据保存失败', // api-handler
            '保存失败', // api-handler
            'D1 database not available', // storage-adapter
        ];

        for (const phrase of phrases) {
            expect(serverSource.includes(phrase), `functions/ 里已找不到「${phrase}」`).toBe(true);
        }
    });

    it('英文界面下同一批服务端消息仍能正确分类（判定不随语言漂移）', () => {
        setLocale('en-US');
        const en = messages['en-US'].errors;

        for (const { message, expected } of SERVER_MESSAGES) {
            expect(friendly(message)).toBe(en[expected]);
        }
    });

    it('客户端侧不该出现「服务端标识符」的本地化版本', () => {
        // MISUB_KV / MISUB_DB 是环境变量名，作为兜底判据保留；
        // 但客户端不该产生它们（否则就是客户端在伪造服务端消息）。
        const clientSource = ['src/utils/errorHandler.js']
            .map((rel) => readFileSync(path.resolve(__dirname, '../..', rel), 'utf8'))
            .join('\n');

        // 只允许出现在匹配用的正则里
        const occurrences = clientSource.match(/MISUB_(?:KV|DB)/g) || [];
        expect(occurrences.length).toBeLessThanOrEqual(2);
    });
});
