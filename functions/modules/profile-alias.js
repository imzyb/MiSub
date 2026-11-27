/**
 * 订阅组「订阅 ID」校验（customId 与 linkId 共用一套规则）
 *
 * 规则见 docs/profile-url.md：
 *   - 只允许 [a-z0-9_-]，customId 长度 2..32、linkId 2..64（保存前统一转小写）
 *   - customId 与 linkId 在全局范围内互斥
 *   - 不得与路径保留字、mytoken、profileToken 相同
 *   - 允许 linkId 等于本组的主键（升级迁移的既有形态）
 *
 * 存量豁免（legacy exemption）：
 *   customId 在 2025-06 上线时没有任何长度/字符集限制，库里可能存在超长或含
 *   非法字符的历史值。校验是对**整个列表**执行的，所以只要有一条这样的历史值，
 *   用户保存任何无关改动都会被 400 挡住。
 *   因此这里把「未改动的既有值」视为豁免：只有新增或本次被改动的值才受规则约束。
 *   旧链接继续可用，用户一旦编辑该字段就必须改成合法值。
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

/** 建立「id -> 已落库别名」的基线，用于识别未改动的存量值 */
function buildLegacyBaseline(previousProfiles) {
    const baseline = new Map();
    for (const profile of Array.isArray(previousProfiles) ? previousProfiles : []) {
        const id = String(profile?.id || '');
        if (!id) continue;
        baseline.set(id, {
            customId: sanitizeProfileAlias(profile?.customId),
            linkId: sanitizeProfileAlias(profile?.linkId),
        });
    }
    return baseline;
}

/**
 * 该字段值是否属于「未改动的存量值」。
 * 只有值与小写归一化后完全一致才算未改动；用户改过就必须重新合法。
 */
function isUnchangedLegacyValue(baseline, profile, field, alias) {
    const id = String(profile?.id || '');
    if (!id) return false;
    const previous = baseline.get(id);
    if (!previous) return false;
    return previous[field] === alias;
}

/**
 * @param {Array} profiles 待校验的完整列表
 * @param {Object} [options]
 * @param {string} [options.mytoken]
 * @param {string} [options.profileToken]
 * @param {Array} [options.previousProfiles] 已落库的列表；省略时不做存量豁免
 * @returns {{ok: true} | {ok: false, code: string, field: string, alias: string, id?: string}}
 */
export function validateProfileAliases(profiles, { mytoken, profileToken, previousProfiles } = {}) {
    const list = Array.isArray(profiles) ? profiles : [];
    const baseline = buildLegacyBaseline(previousProfiles);
    const reservedTokens = new Set(
        [mytoken, profileToken].map((item) => sanitizeProfileAlias(item)).filter(Boolean)
    );
    const ids = new Set(list.map((p) => String(p?.id || '')).filter(Boolean));
    const owners = new Map();

    for (const profile of list) {
        for (const field of ['customId', 'linkId']) {
            const alias = sanitizeProfileAlias(profile?.[field]);
            if (!alias) continue;

            const legacy = isUnchangedLegacyValue(baseline, profile, field, alias);

            if (!legacy && !isValidProfileAlias(field, alias)) {
                return {
                    ok: false,
                    code: 'profile_alias_invalid',
                    field,
                    alias,
                    id: String(profile?.id || ''),
                };
            }
            if (!legacy && (RESERVED_ALIASES.has(alias) || reservedTokens.has(alias))) {
                return {
                    ok: false,
                    code: 'profile_alias_reserved',
                    field,
                    alias,
                    id: String(profile?.id || ''),
                };
            }
            // 冲突检测对存量值同样生效：两个组共用一个链接本身就是不可解析的
            if (owners.has(alias)) {
                return {
                    ok: false,
                    code: 'profile_alias_conflict',
                    field,
                    alias,
                    id: String(profile?.id || ''),
                };
            }
            owners.set(alias, String(profile?.id || ''));
        }
    }

    for (const [alias, ownerId] of owners.entries()) {
        // 迁移后的 linkId 恰等于本组主键，属合法形态；撞别组主键才算冲突
        if (ids.has(alias) && alias !== ownerId) {
            return {
                ok: false,
                code: 'profile_alias_conflict',
                field: 'customId',
                alias,
                id: ownerId,
            };
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
    return validateProfileAliases(list, { previousProfiles: allProfiles });
}

/**
 * 找出「存量但已不合法」的订阅 ID，供界面提示用户手动修复。
 * @returns {Array<{id: string, name: string, field: string, value: string}>}
 */
export function findLegacyInvalidAliases(profiles) {
    const list = Array.isArray(profiles) ? profiles : [];
    const out = [];
    for (const profile of list) {
        for (const field of ['customId', 'linkId']) {
            const alias = sanitizeProfileAlias(profile?.[field]);
            if (!alias) continue;
            if (isValidProfileAlias(field, alias)) continue;
            out.push({
                id: String(profile?.id || ''),
                name: String(profile?.name || ''),
                field,
                value: alias,
            });
        }
    }
    return out;
}
