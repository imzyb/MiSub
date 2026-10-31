/**
 * 「未分组」过滤器哨兵必须与语言无关。
 *
 * 曾经的缺陷：NodeSelector.vue 用 `t('manualNodes.defaultGroup')` 当哨兵，
 * 中文解析成「默认」、英文解析成 "Default"，而 ProfileModal / filters.js /
 * NodeActions.vue 都用固定字面量比较 —— 于是英文界面下点「未分组」筛出 0 条。
 *
 * 这类 bug 单测很容易漏，因为中文环境下「恰好」是对的。所以这里**显式切到
 * en-US 再验证**，并把哨兵的稳定性也锁进静态断言。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    DEFAULT_GROUP_KEY,
    buildGroupedManualNodes,
    normalizeManualNodeGroupName,
} from '../../src/composables/manual-nodes/groups.js';
import { filterManualNodes, isManualNodeEntry } from '../../src/composables/manual-nodes/filters.js';
import { messages } from '../../src/i18n/messages.js';
import { setLocale } from '../../src/i18n/index.js';

const NODES = [
    { id: 'a', name: 'ungrouped-1', url: 'ss://x' },
    { id: 'b', name: 'ungrouped-2', url: 'ss://y', group: '' },
    { id: 'c', name: 'grouped', url: 'ss://z', group: '香港' },
];

afterEach(() => {
    setLocale('zh-CN');
});

describe('DEFAULT_GROUP_KEY 哨兵', () => {
    it('是非空字符串', () => {
        expect(typeof DEFAULT_GROUP_KEY).toBe('string');
        expect(DEFAULT_GROUP_KEY.length).toBeGreaterThan(0);
    });

    it('不会被误用成显示文案的翻译值', () => {
        // 显示文案（中文「默认」/ 英文 "Default"）只是 label，
        // 哨兵必须与它解耦，否则换个语言就失效。
        for (const locale of ['zh-CN', 'en-US']) {
            const label = messages[locale].manualNodes.defaultGroup;
            expect(typeof label).toBe('string');
        }
        // 英文 label 与哨兵不同 —— 这正是当年出问题的原因
        expect(messages['en-US'].manualNodes.defaultGroup).not.toBe(DEFAULT_GROUP_KEY);
    });
});

describe('未分组过滤与语言无关', () => {
    it.each(['zh-CN', 'en-US'])('locale=%s 时都能筛出未分组节点', (locale) => {
        setLocale(locale);

        const result = filterManualNodes(NODES, '', DEFAULT_GROUP_KEY);
        expect(result.map((n) => n.id)).toEqual(['a', 'b']);
    });

    it('空 group 与缺失 group 都算未分组', () => {
        expect(normalizeManualNodeGroupName(NODES[0].group)).toBe('');
        expect(normalizeManualNodeGroupName(NODES[1].group)).toBe('');
    });

    it('HTTP(S) proxy URI with credentials is listed as a manual node, not a subscription URL', () => {
        const node = { id: 'http-proxy', name: 'HTTP proxy', url: 'http://alice:secret@proxy.example.com:8080#node' };
        expect(isManualNodeEntry(node)).toBe(true);
        expect(filterManualNodes([node], '', '')).toEqual([node]);
    });

    it('ordinary HTTP(S) URLs remain subscriptions rather than manual nodes', () => {
        expect(isManualNodeEntry({ url: 'https://example.com/subscription' })).toBe(false);
        expect(isManualNodeEntry({ url: 'http://proxy.example.com:8080' })).toBe(false);
    });

    it('non-HTTP protocol node classification remains unchanged', () => {
        expect(isManualNodeEntry({ url: 'ss://cipher@proxy.example.com:443' })).toBe(true);
    });
    it('按具体分组名过滤仍然正常', () => {
        expect(filterManualNodes(NODES, '', '香港').map((n) => n.id)).toEqual(['c']);
    });

    it('把翻译值当哨兵就会筛出空列表（记录当年那个缺陷）', () => {
        setLocale('en-US');
        const localizedLabel = messages['en-US'].manualNodes.defaultGroup;

        // 旧写法等价于这一行：英文下拿到 "Default"，既不等于空值也不等于任何
        // 真实分组名，于是筛出 0 条 —— 用户看到「未分组」按钮点了没反应。
        expect(filterManualNodes(NODES, '', localizedLabel)).toEqual([]);
    });

    it('buildGroupedManualNodes 把未分组节点放进哨兵桶', () => {
        const grouped = buildGroupedManualNodes(NODES, []);
        expect(Object.keys(grouped)).toContain(DEFAULT_GROUP_KEY);
        expect(grouped[DEFAULT_GROUP_KEY].map((n) => n.id)).toEqual(['a', 'b']);
    });
});

describe('接线守卫：不得再用本地化文案当哨兵', () => {
    const read = (rel) => readFileSync(path.resolve(process.cwd(), rel), 'utf-8');

    const COMPARISON_SITES = [
        'src/components/modals/ProfileModal/NodeSelector.vue',
        'src/components/modals/ProfileModal.vue',
        'src/components/nodes/ManualNodePanel/NodeActions.vue',
        'src/components/nodes/ManualNodePanel.vue',
    ];

    it.each(COMPARISON_SITES)('%s 使用 DEFAULT_GROUP_KEY 而不是翻译值', (file) => {
        const source = read(file);
        expect(source).toContain('DEFAULT_GROUP_KEY');
        // 这个 key 只能出现在给用户看的 label 上，绝不能出现在比较/emit 里
        expect(source).not.toMatch(/=== *t\('manualNodes\.defaultGroup'\)/);
        expect(source).not.toMatch(/emit\([^)]*t\('manualNodes\.defaultGroup'\)/);
    });

    it('源码里不存在硬编码的哨兵字面量（应统一走常量）', () => {
        const offenders = [];
        for (const file of COMPARISON_SITES) {
            // 只检查比较 / emit 这类「当哨兵用」的位置
            const source = read(file);
            if (/=== *'默认'|emit\([^)]*'默认'/.test(source)) offenders.push(file);
        }
        expect(offenders).toEqual([]);
    });
});
