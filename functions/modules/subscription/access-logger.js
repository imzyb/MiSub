import { LogService } from '../../services/log-service.js';

export function shouldSkipLogging(userAgentHeader) {
    return userAgentHeader.includes('MiSub-Backend') || userAgentHeader.includes('TelegramBot');
}

export function logAccessSuccess({
    context,
    env,
    request,
    userAgentHeader,
    targetFormat,
    token,
    profileIdentifier,
    subName,
    domain
}) {
    const stats = context?.generationStats || {};
    const clientIp = request.headers.get('CF-Connecting-IP')
        || request.headers.get('X-Real-IP')
        || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
        || 'N/A';
    const country = request.headers.get('CF-IPCountry') || 'N/A';

    const payload = {
        profileName: subName || 'Unknown Profile',
        clientIp,
        geoInfo: { country, city: request.cf?.city, isp: request.cf?.asOrganization, asn: request.cf?.asn },
        userAgent: userAgentHeader || 'Unknown',
        status: 'success',
        format: targetFormat,
        token: profileIdentifier ? (profileIdentifier) : token,
        type: profileIdentifier ? 'profile' : 'token',
        domain,
        details: {
            totalNodes: stats.totalNodes || 0,
            sourceCount: stats.sourceCount || 0,
            successCount: stats.successCount || 0,
            failCount: stats.failCount || 0,
            duration: stats.duration || 0
        },
        summary: `生成 ${stats.totalNodes || 0} 个节点 (成功: ${stats.successCount || 0}, 失败: ${stats.failCount || 0})`
    };

    if (context?.waitUntil) {
        context.waitUntil(LogService.addLog(env, payload));
    }
}

export function logAccessError({
    context,
    env,
    request,
    userAgentHeader,
    targetFormat,
    token,
    profileIdentifier,
    subName,
    domain,
    errorMessage
}) {
    const stats = context?.generationStats || {};
    const clientIp = request.headers.get('CF-Connecting-IP')
        || request.headers.get('X-Real-IP')
        || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
        || 'N/A';
    const country = request.headers.get('CF-IPCountry') || 'N/A';

    const payload = {
        profileName: subName || 'Unknown Profile',
        clientIp,
        geoInfo: { country, city: request.cf?.city, isp: request.cf?.asOrganization, asn: request.cf?.asn },
        userAgent: userAgentHeader || 'Unknown',
        status: 'error',
        format: targetFormat,
        token: profileIdentifier ? (profileIdentifier) : token,
        type: profileIdentifier ? 'profile' : 'token',
        domain,
        details: {
            totalNodes: stats.totalNodes || 0,
            sourceCount: stats.sourceCount || 0,
            successCount: stats.successCount || 0,
            failCount: stats.failCount || 0,
            duration: stats.duration || 0,
            error: errorMessage
        },
        summary: `转换失败: ${errorMessage}`
    };

    if (context?.waitUntil) {
        context.waitUntil(LogService.addLog(env, payload));
    }
}
