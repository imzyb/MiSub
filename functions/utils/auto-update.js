/**
 * 单机场订阅的「自动更新」开关（服务端版本）。
 *
 * 历史数据没有这个字段，一律按开启处理：只有显式写入 autoUpdate === false
 * 才算暂停。定时同步、批量刷新与外部 API 批量刷新都应跳过暂停项，
 * 单机场手动刷新（/api/node_count、外部 API 的单条 refresh）不受影响。
 */
export function isAutoUpdateEnabled(subscription) {
    return subscription?.autoUpdate !== false;
}

export function isAutoUpdatePaused(subscription) {
    return !isAutoUpdateEnabled(subscription);
}

export function filterAutoUpdateSubscriptions(subscriptions) {
    return (Array.isArray(subscriptions) ? subscriptions : []).filter(isAutoUpdateEnabled);
}
