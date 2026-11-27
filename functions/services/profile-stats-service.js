import { StorageFactory } from '../storage-adapter.js';
import { KV_KEY_PROFILES } from '../modules/config.js';

export const PROFILE_DOWNLOAD_COUNT_PREFIX = 'misub_profile_download_count_';

async function getStorageAdapter(env) {
    const storageType = await StorageFactory.getStorageType(env);
    return StorageFactory.createAdapter(env, storageType);
}

/**
 * 清空访问次数（下载计数）
 *
 * 计数有两处来源：KV/D1 里的计数 key，以及 profile 对象里的 downloadCount 快照。
 * 只删 key 不够——读取时会回退到快照，所以必须同时把快照归零。
 *
 * 传入 profileId 时只处理该订阅组，其余订阅组的计数保持不变。
 *
 * @param {Object} storageAdapter
 * @param {{profileId?: string}} [scope]
 * @returns {Promise<number>} 处理的订阅组数量
 */
export async function clearProfileDownloadCounts(storageAdapter, scope = {}) {
    if (!storageAdapter) return 0;

    const allProfiles =
        typeof storageAdapter.getAllProfiles === 'function'
            ? await storageAdapter.getAllProfiles()
            : (await storageAdapter.get(KV_KEY_PROFILES)) || [];

    const targetId = String(scope?.profileId || '').trim();
    const profiles = targetId
        ? (Array.isArray(allProfiles) ? allProfiles : []).filter(
              (profile) => profile?.id === targetId
          )
        : allProfiles;

    if (!Array.isArray(profiles) || profiles.length === 0) return 0;

    const deletions = [];
    for (const profile of profiles) {
        if (!profile?.id) continue;
        deletions.push(
            storageAdapter.delete(`${PROFILE_DOWNLOAD_COUNT_PREFIX}${profile.id}`)
        );
        // 兼容历史形态：计数曾以 customId 为 key
        if (profile.customId) {
            deletions.push(
                storageAdapter.delete(`${PROFILE_DOWNLOAD_COUNT_PREFIX}${profile.customId}`)
            );
        }
    }
    await Promise.allSettled(deletions);

    let snapshotChanged = false;
    for (const profile of profiles) {
        if (Number(profile.downloadCount) !== 0) {
            profile.downloadCount = 0;
            snapshotChanged = true;
        }
    }

    if (snapshotChanged) {
        if (typeof storageAdapter.putAllProfiles === 'function') {
            await storageAdapter.putAllProfiles(profiles);
        } else {
            await storageAdapter.put(KV_KEY_PROFILES, profiles);
        }
    }

    return profiles.length;
}

/** 用环境对象构建适配器后清空计数（可按 profileId 限定范围） */
export async function resetProfileDownloadCounts(env, scope = {}) {
    const storageAdapter = await getStorageAdapter(env);
    return clearProfileDownloadCounts(storageAdapter, scope);
}
