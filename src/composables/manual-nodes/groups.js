/**
 * 「未分组」过滤器的哨兵值。
 *
 * 它是**纯 UI 哨兵**，不会写进节点数据：无分组的节点 `node.group` 是空值，
 * 过滤时靠 `!node.group` 判断（见 filters.js）。
 *
 * ⚠️ 必须是固定常量，不能换成 `t('manualNodes.defaultGroup')`。
 * 那个 key 是给用户看的**显示文案**（中文「默认」/ 英文 "Default"），
 * 一旦拿它当哨兵，英文界面下过滤器发出的值与比较用的值就对不上 ——
 * NodeSelector.vue 曾经就是这么写的，导致英文下点「未分组」筛出 0 条。
 */
export const DEFAULT_GROUP_KEY = '默认';

export function normalizeManualNodeGroupName(groupName) {
    return typeof groupName === 'string' ? groupName.trim() : '';
}

export function collectManualNodeGroups(nodes, customOrder = []) {
    const groups = new Set();
    nodes.forEach((node) => {
        const group = normalizeManualNodeGroupName(node.group);
        if (group) {
            groups.add(group);
        }
    });

    const allGroups = Array.from(groups);

    // 如果有自定义顺序，按自定义顺序排列，然后追加新出现的分组
    if (customOrder && customOrder.length > 0) {
        const orderedGroups = [];
        const remaining = new Set(allGroups);

        // 先按自定义顺序添加
        customOrder.forEach((group) => {
            if (remaining.has(group)) {
                orderedGroups.push(group);
                remaining.delete(group);
            }
        });

        // 追加新分组（保持首次出现顺序）
        allGroups.forEach((group) => {
            if (remaining.has(group)) {
                orderedGroups.push(group);
            }
        });

        return orderedGroups;
    }

    // 默认保留首次出现顺序
    return allGroups;
}

export function buildGroupedManualNodes(nodesToDisplay, manualNodeGroups) {
    const groups = {};
    // Initialize groups
    manualNodeGroups.forEach((group) => {
        groups[group] = [];
    });
    groups[DEFAULT_GROUP_KEY] = []; // Default group for ungrouped nodes

    nodesToDisplay.forEach((node) => {
        const groupName = normalizeManualNodeGroupName(node.group) || DEFAULT_GROUP_KEY;
        if (!groups[groupName]) {
            groups[groupName] = [];
        }
        groups[groupName].push(node);
    });

    const result = {};
    Object.keys(groups).forEach((key) => {
        if (groups[key].length > 0) {
            result[key] = groups[key];
        }
    });

    return result;
}
