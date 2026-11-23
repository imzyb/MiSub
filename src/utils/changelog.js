/**
 * 更新日志文本解析。
 *
 * GitHub Release body 与内置更新日志都是 Markdown 片段。旧实现把整段文本直接塞进
 * 「定高 + overflow-y-auto」容器：弹窗自身在滚动、内容区又在滚动（两根滚动条），
 * 而且 `**加粗**`、`- 列表` 这些标记会原样露出来。
 *
 * 这里只解析更新日志的常见语法：段落 / 标题 / 有序、无序列表 / 行内加粗、行内代码、链接。
 * 输出是纯数据，渲染层用语义化 DOM（p、h4、ul/ol、li）配合 Vue 组件生成，
 * 不使用 v-html，避免 Release body 里的 HTML 注入。
 */

const HEADING = /^(#{1,6})\s+(.+)$/;
const BULLET = /^\s{0,3}[-*+]\s+(.+)$/;
const ORDERED = /^\s{0,3}(\d{1,3})[.)]\s+(.+)$/;
const INLINE_SOURCE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/.source;

/**
 * 把一行文本拆成行内片段（普通文本 / 加粗 / 行内代码 / 链接）。
 * @param {string} input
 * @returns {Array<{type: 'text'|'strong'|'code'|'link', text: string, href?: string}>}
 */
export function parseInline(input) {
    const text = String(input ?? '');
    const segments = [];
    const pattern = new RegExp(INLINE_SOURCE, 'g');
    let cursor = 0;
    let match = pattern.exec(text);

    while (match !== null) {
        if (match.index > cursor) {
            segments.push({ type: 'text', text: text.slice(cursor, match.index) });
        }

        const token = match[0];
        if (token.startsWith('**') && token.endsWith('**')) {
            segments.push({ type: 'strong', text: token.slice(2, -2) });
        } else if (token.startsWith('`') && token.endsWith('`')) {
            segments.push({ type: 'code', text: token.slice(1, -1) });
        } else {
            const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(token);
            if (link) {
                segments.push({ type: 'link', text: link[1], href: link[2] });
            } else {
                segments.push({ type: 'text', text: token });
            }
        }

        cursor = match.index + token.length;
        match = pattern.exec(text);
    }

    if (cursor < text.length) {
        segments.push({ type: 'text', text: text.slice(cursor) });
    }

    return segments.filter((segment) => !(segment.type === 'text' && segment.text === ''));
}

/**
 * 把整段更新日志解析成块列表，供 ChangelogContent 直接遍历渲染。
 * @param {string} input
 * @returns {Array<
 *   | {type: 'paragraph', segments: Array}
 *   | {type: 'heading', level: number, segments: Array}
 *   | {type: 'list', ordered: boolean, items: Array<{segments: Array}>}
 * >}
 */
export function parseChangelog(input) {
    const lines = String(input ?? '')
        .replace(/\r\n?/g, '\n')
        .split('\n');
    const blocks = [];
    let paragraphLines = [];
    let currentList = null;

    const flushParagraph = () => {
        if (paragraphLines.length === 0) return;
        blocks.push({ type: 'paragraph', segments: parseInline(paragraphLines.join(' ')) });
        paragraphLines = [];
    };

    const pushListItem = (text, ordered) => {
        flushParagraph();
        if (!currentList || currentList.ordered !== ordered) {
            currentList = { type: 'list', ordered, items: [] };
            blocks.push(currentList);
        }
        currentList.items.push({ segments: parseInline(text) });
    };

    for (const rawLine of lines) {
        const line = rawLine.replace(/\s+$/, '');
        if (line.trim() === '') {
            flushParagraph();
            currentList = null;
            continue;
        }

        const bullet = BULLET.exec(line);
        if (bullet) {
            pushListItem(bullet[1], false);
            continue;
        }

        const ordered = ORDERED.exec(line);
        if (ordered) {
            pushListItem(ordered[2], true);
            continue;
        }

        const heading = HEADING.exec(line);
        if (heading) {
            flushParagraph();
            currentList = null;
            blocks.push({
                type: 'heading',
                level: heading[1].length,
                segments: parseInline(heading[2]),
            });
            continue;
        }

        currentList = null;
        paragraphLines.push(line.trim());
    }

    flushParagraph();
    return blocks;
}
