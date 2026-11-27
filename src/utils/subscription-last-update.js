/**
 * 计算「上次更新」展示用的时间戳。
 *
 * 语义是：所有机场订阅里最后一次成功更新的时间（取最大值），
 * 而不是页面这次拉取数据的时间 —— 否则每次刷新都会显示当前时间。
 * 时间来源：D1 节点快照的 last_success_at（后端 decorate 成 sub.lastUpdate），
 * 或前端刷新成功后写入的 ISO 时间戳。
 */

function parseTimestamp(value) {
    if (!value) return null;
    const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
}

/**
 * @param {Array<{lastUpdate?: string}>} subscriptions
 * @returns {number|null} 最大时间戳（毫秒），没有任何有效时间时返回 null
 */
export function latestSubscriptionUpdate(subscriptions = []) {
    if (!Array.isArray(subscriptions)) return null;

    let latest = null;
    for (const sub of subscriptions) {
        const ms = parseTimestamp(sub?.lastUpdate);
        if (ms !== null && (latest === null || ms > latest)) latest = ms;
    }
    return latest;
}
