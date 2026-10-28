/**
 * 拓扑图与循环依赖检测工具
 * 用于 Profile (我的订阅) 互相嵌套时的依赖安全校验
 */

/**
 * 检测将 candidateId 添加为 targetProfileId 的子订阅时，是否会导致循环依赖
 * @param {string} targetProfileId - 当前正在编辑的 Profile ID（新建时为 null 或空字符串）
 * @param {string} candidateId - 候选子 Profile ID
 * @param {Array} allProfiles - 所有 Profile 对象列表
 * @returns {boolean} true 表示会导致循环引用，必须禁止
 */
export function wouldCreateCycle(targetProfileId, candidateId, allProfiles = []) {
    if (!targetProfileId || !candidateId) return false;
    if (targetProfileId === candidateId) return true;

    const profileMap = new Map();
    allProfiles.forEach((p) => {
        if (p && p.id) profileMap.set(p.id, p);
        if (p && p.customId) profileMap.set(p.customId, p);
    });

    const targetProfile = profileMap.get(targetProfileId);
    const targetIds = new Set([targetProfileId]);
    if (targetProfile) {
        if (targetProfile.id) targetIds.add(targetProfile.id);
        if (targetProfile.customId) targetIds.add(targetProfile.customId);
    }

    const candidateProfile = profileMap.get(candidateId);
    if (candidateProfile) {
        if (candidateProfile.id && targetIds.has(candidateProfile.id)) return true;
        if (candidateProfile.customId && targetIds.has(candidateProfile.customId)) return true;
    }

    // 从 candidate 出发进行 BFS/DFS 遍历，查看其依赖链路上是否包含 target Profile
    const visited = new Set();
    const queue = [candidateId];

    while (queue.length > 0) {
        const currId = queue.shift();
        if (targetIds.has(currId)) return true;
        if (visited.has(currId)) continue;
        visited.add(currId);

        const curr = profileMap.get(currId);
        if (curr && Array.isArray(curr.subProfiles)) {
            for (const nextId of curr.subProfiles) {
                if (targetIds.has(nextId)) return true;
                if (!visited.has(nextId)) {
                    queue.push(nextId);
                }
            }
        }
    }

    return false;
}
