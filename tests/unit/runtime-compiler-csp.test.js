/**
 * 回归测试：严格 CSP（无 'unsafe-eval'）下不得触发 Vue 运行时模板编译。
 *
 * 背景（真实缺陷）：
 *   vuedraggable 的 package.json main 指向 dist/vuedraggable.umd.min.js —— UMD 构建
 *   把 Vue 完整版（含 runtime compiler）一起打包，被 import 后会在运行时调用
 *   registerRuntimeCompiler()。此后任何「运行时模板字符串」都会走
 *   new Function("Vue", code) 编译；在配置了严格 CSP（script-src 不含 unsafe-eval）
 *   的部署上会抛 EvalError: call to Function() blocked by CSP，
 *   该错误在组件渲染期抛出 → 被 app.config.errorHandler 捕获 → 右上角弹出
 *   「操作失败，请稍后重试」。
 *
 *   复现路径：进入「手动节点」（懒加载 vuedraggable）后点击左上角 LOGO 回首页，
 *   HomeView 渲染 { template: '<div></div>' } 触发编译。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';

// 使用含 runtime compiler 的 Vue 构建，等价于 vuedraggable UMD 在生产包中
// 注册 runtime compiler 之后的运行环境。
vi.mock('vue', async () => await vi.importActual('vue/dist/vue.esm-bundler.js'));

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const REAL_FUNCTION = globalThis.Function;
let cspBlockedCalls = 0;

/** 精确模拟 CSP 对 Vue 运行时编译（new Function("Vue", code)）的拦截 */
function installCspGuard() {
    cspBlockedCalls = 0;
    globalThis.Function = new Proxy(REAL_FUNCTION, {
        construct(target, args) {
            if (args[0] === 'Vue') {
                cspBlockedCalls += 1;
                throw new EvalError('call to Function() blocked by CSP');
            }
            return Reflect.construct(target, args, target);
        },
        apply(target, thisArg, args) {
            if (args[0] === 'Vue') {
                cspBlockedCalls += 1;
                throw new EvalError('call to Function() blocked by CSP');
            }
            return Reflect.apply(target, thisArg, args);
        },
    });
}

function collectSourceFiles(dir, files = []) {
    for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
            collectSourceFiles(full, files);
        } else if (/\.(vue|js)$/.test(entry)) {
            files.push(full);
        }
    }
    return files;
}

describe('严格 CSP 下的首页渲染（runtime template regression）', () => {
    beforeEach(() => {
        installCspGuard();
    });

    afterEach(() => {
        globalThis.Function = REAL_FUNCTION;
        vi.resetModules();
    });

    it('已登录用户访问 / 时不得触发运行时模板编译', async () => {
        const pinia = createPinia();
        setActivePinia(pinia);

        const { useSessionStore } = await import('../../src/stores/session.js');
        const session = useSessionStore();
        session.sessionState = 'loggedIn';

        const router = createRouter({
            history: createMemoryHistory(),
            routes: [
                { path: '/', component: { render: () => null } },
                { path: '/dashboard', component: { render: () => null } },
            ],
        });
        await router.push('/');
        await router.isReady();

        const HomeView = (await import('../../src/views/HomeView.vue')).default;
        const wrapper = mount(HomeView, { global: { plugins: [pinia, router] } });

        await new Promise((resolve) => setTimeout(resolve, 0));

        // 关键断言：CSP 未拦截任何运行时编译
        expect(cspBlockedCalls).toBe(0);
        expect(wrapper.html()).toContain('<div');
        wrapper.unmount();
    });

    it('生产源码中不存在运行时模板字符串', () => {
        const offenders = [];
        for (const file of collectSourceFiles(path.join(ROOT, 'src'))) {
            const lines = readFileSync(file, 'utf8').split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                // 跳过注释行：说明性注释中允许保留缺陷原始写法
                if (
                    trimmed.startsWith('//') ||
                    trimmed.startsWith('*') ||
                    trimmed.startsWith('/*') ||
                    trimmed.startsWith('<!--')
                ) {
                    continue;
                }
                if (/template:\s*['"`]\s*</.test(line)) {
                    offenders.push(`${path.relative(ROOT, file)}: ${trimmed}`);
                    break;
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('vuedraggable 不得从 UMD 构建引入（会打包 Vue 运行时编译器）', () => {
        const config = readFileSync(path.join(ROOT, 'vite.config.js'), 'utf8');
        expect(config).toMatch(/vuedraggable/);
        expect(config).toMatch(
            /vuedraggable['"]?\s*:\s*['"][^'"]*src[^'"]*['"]|find:\s*\/\^vuedraggable\$/
        );
    });
});
