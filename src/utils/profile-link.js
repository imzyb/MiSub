/**
 * 订阅组对外链接标识
 *
 * 三层标识（见 docs/profile-url.md）：
 *   customId —— 用户自定义的「订阅 ID」
 *   linkId   —— 系统生成的「订阅 ID」
 *   id       —— 内部主键，仅存量兜底
 */
export function getProfileShareIdentifier(profile) {
    if (!profile) return '';
    return String(profile.customId || profile.linkId || profile.id || '');
}

export function buildProfileShareUrl(origin, token, profile) {
    const identifier = getProfileShareIdentifier(profile);
    if (!origin || !token || !identifier) return '';
    return `${origin}/${token}/${identifier}`;
}
