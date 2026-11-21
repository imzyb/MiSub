/**
 * 订阅组标识解析（唯一入口）
 *
 * 三层标识，命名映射见 docs/profile-url.md：
 *   customId —— 用户自定义的「订阅 ID」，公开入口优先级最高
 *   linkId   —— 系统生成的「订阅 ID」，出现在 /{profileToken}/{linkId}
 *   id       —— 内部主键，永不出现在公开链接里（仅兼容迁移完成前的存量数据）
 */

const normalizeAlias = (value) => String(value ?? '').trim().toLowerCase();

/** 订阅组对外链接里使用的标识：customId > linkId > id（最后一项仅存量兜底） */
export function getProfileLinkIdentifier(profile) {
    if (!profile) return '';
    return String(profile.customId || profile.linkId || profile.id || '');
}

/**
 * 公开入口解析（订阅链接、公开预览）
 * 设了 customId 的组，主键与 linkId 都不再可达（issue #538）
 */
export function resolvePublicProfile(profiles, identifier) {
    const list = Array.isArray(profiles) ? profiles : [];
    const raw = String(identifier ?? '').trim();
    if (!raw) return null;
    const alias = normalizeAlias(raw);

    const byCustomId = list.find((p) => p && p.customId && normalizeAlias(p.customId) === alias);
    if (byCustomId) return byCustomId;

    // 设了 customId 的组，linkId 同样退役：一个组同一时刻只有一个「订阅 ID」
    const byLinkId = list.find(
        (p) => p && !p.customId && p.linkId && normalizeAlias(p.linkId) === alias
    );
    if (byLinkId) return byLinkId;

    // 兼容窗口：linkId 尚未落库（迁移未执行）时仍允许用主键访问
    return list.find((p) => p && !p.linkId && !p.customId && p.id === raw) || null;
}

/**
 * 内部入口解析（嵌套子组、外部管理 API、后台引用）
 * 保持宽松匹配，避免改动内部数据引用语义
 */
export function resolveInternalProfile(profiles, identifier) {
    const list = Array.isArray(profiles) ? profiles : [];
    const raw = String(identifier ?? '').trim();
    if (!raw) return null;
    const alias = normalizeAlias(raw);
    return (
        list.find((p) => p && p.id === raw) ||
        list.find((p) => p && p.customId && normalizeAlias(p.customId) === alias) ||
        list.find((p) => p && p.linkId && normalizeAlias(p.linkId) === alias) ||
        null
    );
}
