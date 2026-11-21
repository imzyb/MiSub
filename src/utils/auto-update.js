/**
 * 单机场订阅的「自动更新」开关。
 *
 * 历史数据没有这个字段，一律按开启处理：只有显式写入 autoUpdate === false
 * 才算暂停，避免存量订阅在升级后突然停止刷新。
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
