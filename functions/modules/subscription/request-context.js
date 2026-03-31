/**
 * 解析订阅请求路径中的 token 与订阅组信息
 *
 * 支持的 URL 格式：
 *   1. /{token}                        → 管理员全量订阅（mytoken）
 *   2. /{profileToken}/{profileId}     → 订阅组访问
 *   3. /sub/{token}                    → 管理员全量订阅（带 /sub/ 路由前缀）
 *   4. /sub/{profileToken}/{profileId} → 订阅组访问（带 /sub/ 路由前缀）
 *
 * 注意：当 profileToken 恰好为 'sub' 时，格式 2 和 3 的路径相同（/sub/xxx），
 * 此时优先按格式 2 处理（profileToken 优先级高于路由前缀）。
 *
 * @param {URL} url - 请求 URL
 * @param {Object} config - 全局配置
 * @param {Array} allProfiles - 订阅组列表
 * @returns {{token: string, profileIdentifier: (string|null)}}
 */
export function resolveRequestContext(url, config, allProfiles) {
    let token = '';
    let profileIdentifier = null;
    const pathSegments = url.pathname.split('/').filter(Boolean);

    if (pathSegments.length >= 3) {
        // 3+ 段：/sub/{token}/{profileId}
        // 第一段为路由前缀 'sub'，跳过
        token = pathSegments[1];
        profileIdentifier = pathSegments[2];
    } else if (pathSegments.length === 2) {
        const [firstSeg, secondSeg] = pathSegments;

        if (firstSeg === config.profileToken || firstSeg === config.mytoken) {
            // /{token}/{profileId} — 订阅组访问
            token = firstSeg;
            profileIdentifier = secondSeg;
        } else if (firstSeg === 'sub' || firstSeg === 's') {
            // 第一段为常见订阅路由前缀，第二段为实际 token
            // 例如：/sub/{mytoken}
            token = secondSeg;
        } else {
            // 兜底：假设为 /{token}/{profileId} 格式，由后续逻辑校验 token 合法性
            token = firstSeg;
            profileIdentifier = secondSeg;
        }
    } else if (pathSegments.length === 1) {
        // 单段：/{token}（管理员 mytoken 或 profileToken）
        token = pathSegments[0];
    } else {
        token = url.searchParams.get('token');
    }

    return { token, profileIdentifier };
}
