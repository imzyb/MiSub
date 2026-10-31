import { describe, expect, it } from 'vitest';

const readSource = async (path) =>
    await import('node:fs/promises').then(({ readFile }) => readFile(path, 'utf8'));

const SIDEBAR = 'src/components/settings/SettingsSidebar.vue';
const CONTENT = 'src/components/settings/SettingsContent.vue';
const CONTAINERS = [
    { name: 'SettingsPanel.vue（设置弹窗）', path: 'src/components/modals/SettingsPanel.vue' },
    { name: 'SettingsView.vue（设置页）', path: 'src/views/SettingsView.vue' },
];

/** 侧边栏声明的 tab id（分组结构：{ id: 'xxx', labelKey: 'settings.tabs.*' }） */
const extractSidebarTabs = (source) =>
    [...source.matchAll(/\{\s*id:\s*'([a-z-]+)',\s*labelKey:\s*'settings\.tabs\./g)].map(
        (match) => match[1]
    );

/** 源码中所有 `activeTab === 'xxx'` 的取值（即实际渲染出来的 tab） */
const extractRenderedTabs = (source) =>
    [...source.matchAll(/activeTab\s*===\s*'([a-z-]+)'/g)].map((match) => match[1]);

/** currentTabLabel 的 switch 中所有 case 值 */
const extractLabelCases = (source) => {
    const block = source.match(/const currentTabLabel = computed\(\(\) => \{[\s\S]*?\n    \}\);/);
    if (!block) return [];
    return [...block[0].matchAll(/case\s+'([a-z-]+)'/g)].map((match) => match[1]);
};

/**
 * 设置界面此前有两个各自实现的容器（SettingsPanel.vue 弹窗 / SettingsView.vue 独立页面），
 * 约 90% 逐行重复，直接导致过两个线上缺陷：弹窗漏渲染 custom-page（点开是空白）、
 * 弹窗漏传 handleReset（重置按钮点了没反应）。现在 section 列表、头部信息卡、
 * 加载态与保存按钮都收敛到 SettingsContent.vue，这组断言用来锁住这次收敛。
 */
describe('设置页信息架构一致性', () => {
    it('共享内容组件渲染了侧边栏声明的每一个 tab', async () => {
        const sidebarTabs = extractSidebarTabs(await readSource(SIDEBAR));
        expect(sidebarTabs.length).toBeGreaterThan(0);

        const rendered = new Set(extractRenderedTabs(await readSource(CONTENT)));
        const missing = sidebarTabs.filter((id) => !rendered.has(id));
        expect(missing, `SettingsContent.vue 未渲染这些 tab：${missing.join(', ')}`).toEqual([]);
    });

    it('共享内容组件的 currentTabLabel 覆盖全部 tab，避免标题回退成「设置」', async () => {
        const sidebarTabs = extractSidebarTabs(await readSource(SIDEBAR));
        const cases = new Set(extractLabelCases(await readSource(CONTENT)));
        const missing = sidebarTabs.filter((id) => !cases.has(id));
        expect(missing, `currentTabLabel 缺少这些分支：${missing.join(', ')}`).toEqual([]);
    });

    it('保存倒计时与立即刷新入口由共享内容组件提供并连接到两个容器', async () => {
        const content = await readSource(CONTENT);
        expect(content).toContain('restartCountdown !== null');
        expect(content).toContain("t('settings.reloadCountdown'");
        expect(content).toContain("t('settings.reloadNow'");
        expect(content).toContain('@click="$emit(\'reload-now\')"');

        for (const { name, path } of CONTAINERS) {
            const source = await readSource(path);
            expect(source, `${name} 未传入刷新倒计时`).toContain(
                ':restart-countdown="restartCountdown"'
            );
            expect(source, `${name} 未监听立即刷新事件`).toContain('@reload-now=');
        }
    });

    it('两个容器都复用共享内容组件，而不是各自再实现一份', async () => {
        for (const { name, path } of CONTAINERS) {
            const source = await readSource(path);

            expect(source, `${name} 未使用 SettingsContent`).toContain('<SettingsContent');
            expect(source, `${name} 未传递 handleReset`).toMatch(/:handle-reset="handleReset"/);

            // 容器一旦重新直接引用 section，就意味着重复实现又回来了
            expect(source, `${name} 又直接引用了 section 组件`).not.toMatch(
                /sections\/[A-Za-z]+Settings\.vue/
            );
        }
    });
});
