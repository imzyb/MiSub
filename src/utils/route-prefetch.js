/**
 * 路由懒加载 chunk 的预取。
 *
 * 路由表的 component 都是 () => import(...)：真正点击时才下载 chunk，
 * vue-router 要等 chunk 解析完才确认导航，所以首点到某个分区会“卡”几百毫秒。
 * 这里在 hover / focus / 触摸按下时提前触发同一批 import()（浏览器会命中模块缓存），
 * 空闲时再把剩下的路由全部预热一遍，让点击基本变成瞬间。
 */

const invoked = new WeakSet();

function collectLoaders(router, target) {
    let resolved;
    try {
        resolved = router.resolve(target);
    } catch {
        return [];
    }

    const loaders = [];
    for (const record of resolved?.matched || []) {
        for (const component of Object.values(record.components || {})) {
            if (typeof component === "function") loaders.push(component);
        }
    }
    return loaders;
}

/** 预取单个地址对应的路由 chunk。重复调用无副作用。 */
export function prefetchRoute(router, target) {
    if (!router || !target) return;
    for (const load of collectLoaders(router, target)) {
        if (invoked.has(load)) continue;
        invoked.add(load);
        try {
            const pending = load();
            if (pending && typeof pending.catch === "function") {
                pending.catch(() => invoked.delete(load));
            }
        } catch {
            invoked.delete(load);
        }
    }
}

/** 空闲时预取全部路由 chunk（登录后执行一次即可）。 */
export function prefetchAllRoutes(router) {
    if (!router) return;
    for (const route of router.getRoutes()) {
        if (!route?.components?.default) continue;
        prefetchRoute(router, route.path);
    }
}

/** 从 DOM 事件里取出站内链接地址。 */
export function routeHrefFromEvent(event) {
    const anchor = event?.target?.closest?.("a[href]");
    if (!anchor) return "";
    if (anchor.target && anchor.target !== "_self") return "";
    if (anchor.hasAttribute("download")) return "";

    const href = anchor.getAttribute("href") || "";
    if (!href.startsWith("/") || href.startsWith("//")) return "";

    return href;
}

/** 绑定 hover / focus / 触摸预取，返回解绑函数。 */
export function installRoutePrefetch(router, doc) {
    const target = doc || (typeof document !== "undefined" ? document : null);
    if (!router || !target) return () => {};

    const onIntent = (event) => {
        const href = routeHrefFromEvent(event);
        if (href) prefetchRoute(router, href);
    };

    target.addEventListener("mouseover", onIntent, { passive: true });
    target.addEventListener("focusin", onIntent, { passive: true });
    target.addEventListener("pointerdown", onIntent, { passive: true });

    return () => {
        target.removeEventListener("mouseover", onIntent);
        target.removeEventListener("focusin", onIntent);
        target.removeEventListener("pointerdown", onIntent);
    };
}
