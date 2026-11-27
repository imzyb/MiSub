/**
 * 按需（hover / focus）预加载单个懒加载模块。
 *
 * 与路由 chunk 同理：defineAsyncComponent 只有在第一次打开时才下载 chunk，
 * 首次点开重弹窗会有一段“点了没反应”的空档。这里在用户把指针移到按钮上时
 * 提前把模块拉下来，真正点击时基本是同步渲染。
 */

const preloaded = new WeakSet();

export function preloadModule(loader) {
    if (typeof loader !== "function" || preloaded.has(loader)) return;
    preloaded.add(loader);
    try {
        const pending = loader();
        if (pending && typeof pending.catch === "function") {
            pending.catch(() => preloaded.delete(loader));
        }
    } catch {
        preloaded.delete(loader);
    }
}
