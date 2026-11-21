/**
 * 订阅组「订阅 ID」校验（customId 与 linkId 共用一套规则）
 *
 * 规则见 docs/profile-url.md：
 *   - 只允许 [a-z0-9_-]，长度 2..32（保存前统一转小写）
 *   - customId 与 linkId 在全局范围内互斥
 *   - 不得与路径保留字、mytoken、profileToken 相同
 *   - 允许 linkId 等于本组的主键（升级迁移的既有形态）
 */

// customId 由用户输入，限制 2-32；linkId 系统生成（UUID 36 位），放宽到 2-64
export const PROFILE_CUSTOM_ID_PATTERN = /^[a-z0-9_-]{2,32}$/;
export const PROFILE_LINK_ID_PATTERN = /^[a-z0-9_-]{2,64}$/;

export function isValidProfileAlias(field, alias) {
    return (field === 'linkId' ? PROFILE_LINK_ID_PATTERN : PROFILE_CUSTOM_ID_PATTERN).test(alias);
}

const RESERVED_ALIASES = new Set([
    'sub',
    'api',
    'assets',
    'cron',
    'login',
    'logout',
    'favicon.ico',
    'robots.txt',
    '_',
    'main',
]);

export function sanitizeProfileAlias(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase();
}

/** 就地归一化（小写 + 去空白），返回是否发生变化 */
export function normalizeProfileAliases(profiles) {
    if (!Array.isArray(profiles)) return false;
    let changed = false;
    for (const profile of profiles) {
        if (!profile) continue;
        for (const field of ['customId', 'linkId']) {
            if (typeof profile[field] !== 'string') continue;
            const next = sanitizeProfileAlias(profile[field]);
            if (next !== profile[field]) {
                profile[field] = next;
                changed = true;
            }
        }
    }
    return changed;
}

/**
 * @returns {{ok: true} | {ok: false, code: string, field: string, alias: string}}
 */
export function validateProfileAliases(profiles, { mytoken, profileToken } = {}) {
    const list = Array.isArray(profiles) ? profiles : [];
    const reservedTokens = new Set(
        [mytoken, profileToken].map((item) => sanitizeProfileAlias(item)).filter(Boolean)
    );
    const ids = new Set(list.map((p) => String(p?.id || '')).filter(Boolean));
    const owners = new Map();

    for (const profile of list) {
        for (const field of ['customId', 'linkId']) {
            const alias = sanitizeProfileAlias(profile?.[field]);
            if (!alias) continue;

            if (!isValidProfileAlias(field, alias)) {
                return { ok: false, code: 'profile_alias_invalid', field, alias };
            }
            if (RESERVED_ALIASES.has(alias) || reservedTokens.has(alias)) {
                return { ok: false, code: 'profile_alias_reserved', field, alias };
            }
            if (owners.has(alias)) {
                return { ok: false, code: 'profile_alias_conflict', field, alias };
            }
            owners.set(alias, String(profile?.id || ''));
        }
    }

    for (const [alias, ownerId] of owners.entries()) {
        // 迁移后的 linkId 恰等于本组主键，属合法形态；撞别组主键才算冲突
        if (ids.has(alias) && alias !== ownerId) {
            return { ok: false, code: 'profile_alias_conflict', field: 'customId', alias };
        }
    }

    return { ok: true };
}

/** 用候选对象替换同 id 项后整体校验（外部管理 API 单条写入时使用） */
export function validateProfileCandidate(allProfiles, candidate) {
    const list = (Array.isArray(allProfiles) ? allProfiles : []).filter(
        (item) => item && item.id !== candidate?.id
    );
    list.push(candidate);
    normalizeProfileAliases(list);
    return validateProfileAliases(list);
}
