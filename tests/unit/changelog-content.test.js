import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import ChangelogContent from '../../src/components/modals/ChangelogContent.vue';
import VersionChangelogModal from '../../src/components/modals/VersionChangelogModal.vue';
import { parseChangelog, parseInline } from '../../src/utils/changelog.js';
import { createI18n } from '../../src/i18n/index.js';

const SAMPLE = [
    '✨ **节点持久化、订阅标识重构与全站国际化**',
    '- **节点持久化**：新增持久化开关，启用即全量回填。',
    '- **订阅标识 linkId**：订阅链接改用独立 linkId。',
    '- **组合订阅与排序**：支持嵌套组合订阅。',
    '- **国际化与无障碍**：全站中英双语覆盖。',
    '- **同步工作流**：Fork Sync 改为合并式同步。',
].join('\n');

describe('changelog markdown parsing', () => {
    it('parses inline bold, code and links', () => {
        expect(parseInline('**加粗** 与 `code`')).toEqual([
            { type: 'strong', text: '加粗' },
            { type: 'text', text: ' 与 ' },
            { type: 'code', text: 'code' },
        ]);

        expect(parseInline('见 [发布页](https://example.com/release)')).toEqual([
            { type: 'text', text: '见 ' },
            { type: 'link', text: '发布页', href: 'https://example.com/release' },
        ]);

        // 非 http(s) 链接不做标记，按普通文本处理，避免协议注入。
        expect(parseInline('[bad](javascript:alert(1))')).toEqual([
            { type: 'text', text: '[bad](javascript:alert(1))' },
        ]);
    });

    it('builds lede paragraph, bullet list and heading blocks', () => {
        const blocks = parseChangelog(SAMPLE);
        expect(blocks).toHaveLength(2);
        expect(blocks[0].type).toBe('paragraph');
        expect(blocks[0].segments).toContainEqual({
            type: 'strong',
            text: '节点持久化、订阅标识重构与全站国际化',
        });
        expect(blocks[1]).toMatchObject({ type: 'list', ordered: false });
        expect(blocks[1].items).toHaveLength(5);

        const withHeading = parseChangelog(
            "## What's Changed\n* fix: a\n* feat: b\n\n1. one\n2. two"
        );
        expect(withHeading.map((block) => block.type)).toEqual(['heading', 'list', 'list']);
        expect(withHeading[2].ordered).toBe(true);
    });

    it('returns no blocks for empty input', () => {
        expect(parseChangelog('')).toEqual([]);
        expect(parseChangelog(null)).toEqual([]);
        expect(parseChangelog('   \n\n  ')).toEqual([]);
    });
});

describe('changelog content rendering', () => {
    it('renders semantic list items instead of raw markdown text', () => {
        const wrapper = mount(ChangelogContent, { props: { text: SAMPLE } });

        expect(wrapper.findAll('ul > li')).toHaveLength(5);
        expect(wrapper.findAll('strong')).not.toHaveLength(0);
        expect(wrapper.text()).not.toContain('**');
        expect(wrapper.text()).not.toContain('- 节点持久化');

        const html = wrapper.html();
        expect(html).not.toContain('overflow-y-auto');
        expect(html).not.toContain('max-h-');
    });
});

describe('version changelog modal scrolling structure', () => {
    it('keeps a single scroll container and no inner scroller for changelog text', () => {
        const wrapper = mount(VersionChangelogModal, {
            props: {
                show: true,
                release: { tag_name: 'v2.8.0', name: '', body: '', html_url: '' },
                currentVersion: '2.8.0',
            },
            global: {
                plugins: [createPinia(), createI18n({ initialLocale: 'zh-CN' })],
                stubs: { Teleport: true },
            },
        });

        const html = wrapper.html();
        expect(html.match(/overflow-y-auto/g) || []).toHaveLength(1);
        expect(html.match(/overflow-auto/g) || []).toHaveLength(0);
        expect(html).not.toContain('max-h-[420px]');
        // 内置日志被解析成列表，而不是一整段 pre-wrap 文本
        expect(wrapper.findAll('section ul > li').length).toBeGreaterThanOrEqual(5);
        expect(wrapper.find('section').text()).not.toContain('**');
    });
});
