/**
 * 生成唯一节点名称（统一 _1, _2 后缀策略）
 * @param {string} baseName
 * @param {Map<string, number>} usedNames
 * @returns {string}
 */
export function getUniqueName(baseName, usedNames) {
    const count = (usedNames.get(baseName) || 0) + 1;
    usedNames.set(baseName, count);
    return count === 1 ? baseName : `${baseName}_${count - 1}`;
}
