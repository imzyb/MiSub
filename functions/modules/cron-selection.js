/**
 * Cron 触发时的订阅筛选。
 *
 * 语义：Cron 是「自动刷新」通道，因此必须尊重订阅上的 autoUpdate 开关 ——
 * 用户明确禁用自动更新的机场不能被 Cron 拉取，否则会白白触发 403/限流，
 * 也会把一次「全部成功」的刷新变成带失败告警的刷新。
 * 被跳过的订阅要单独回报（summary.skipped / skipped_subscriptions），
 * 让调用方能区分「失败」和「按配置跳过」。
 */

/**
 * @param {Array<Object>} subscriptions 全量订阅（含手动节点）
 * @returns {{ todo: Array<Object>, skipped: Array<{id:string,name:string,reason:string}> }}
 */
export function selectCronSubscriptions(subscriptions = []) {
    const list = Array.isArray(subscriptions) ? subscriptions : [];
    const todo = [];
    const skipped = [];

    for (const sub of list) {
        if (!sub || typeof sub.url !== "string") continue;
        if (!/^https?:/i.test(sub.url)) continue;
        if (sub.enabled === false) continue;

        if (sub.autoUpdate === false) {
            skipped.push({
                id: sub.id || "",
                name: sub.name || "",
                reason: "auto-update-disabled",
            });
            continue;
        }

        todo.push(sub);
    }

    return { todo, skipped };
}
