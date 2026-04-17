/**
 * CORS中间件
 * @author MiSub Team
 */

/**
 * CORS中间件 - 处理跨域请求
 * @param {Request} request - HTTP请求对象
 * @param {Function} next - 下一个处理函数
 * @param {Object} options - CORS配置选项
 * @returns {Promise<Response>} - 处理后的响应
 */
export async function corsMiddleware(request, next, options = {}) {
    const {
        origins = [],
        methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        headers = ['Content-Type', 'Authorization', 'X-Requested-With'],
        maxAge = 86400, // 24小时
        allowCredentials = true
    } = options;

    const origin = request.headers.get('Origin');
    const allowAll = origins.includes('*');
    const isAllowedOrigin = allowAll || (origin && origins.includes(origin));
    const allowOriginValue = allowAll && !allowCredentials ? '*' : (isAllowedOrigin ? origin : '');
    const shouldSetVary = Boolean(origin && allowOriginValue && allowOriginValue !== '*');

    // 处理预检请求
    if (request.method === 'OPTIONS') {
        if (origin && !isAllowedOrigin) {
            return new Response('Origin Not Allowed', { status: 403 });
        }
        const response = new Response(null, { status: 204 });

        // 设置允许的源
        if (allowOriginValue) {
            response.headers.set('Access-Control-Allow-Origin', allowOriginValue);
            if (shouldSetVary) {
                response.headers.append('Vary', 'Origin');
            }
            if (allowCredentials && allowOriginValue !== '*') {
                response.headers.set('Access-Control-Allow-Credentials', 'true');
            }
        }

        response.headers.set('Access-Control-Allow-Methods', methods.join(', '));
        response.headers.set('Access-Control-Allow-Headers', headers.join(', '));
        response.headers.set('Access-Control-Max-Age', maxAge.toString());

        return response;
    }

    // 处理实际请求
    let response = await next();

    // 添加CORS头部
    if (allowOriginValue) {
        try {
            response.headers.set('Access-Control-Allow-Origin', allowOriginValue);
            if (shouldSetVary) {
                response.headers.append('Vary', 'Origin');
            }
            if (allowCredentials && allowOriginValue !== '*') {
                response.headers.set('Access-Control-Allow-Credentials', 'true');
            }
        } catch (e) {
            // 如果头部不可变（如 Response.redirect 产生的），构造新响应
            const newHeaders = new Headers(response.headers);
            newHeaders.set('Access-Control-Allow-Origin', allowOriginValue);
            if (shouldSetVary) {
                newHeaders.append('Vary', 'Origin');
            }
            if (allowCredentials && allowOriginValue !== '*') {
                newHeaders.set('Access-Control-Allow-Credentials', 'true');
            }
            response = new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders
            });
        }
    }

    try {
        response.headers.set('Access-Control-Expose-Headers', headers.join(', '));
    } catch (e) {
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Expose-Headers', headers.join(', '));
        response = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
        });
    }

    return response;
}

/**
 * 安全头部中间件
 * @param {Request} request - HTTP请求对象
 * @param {Function} next - 下一个处理函数
 * @returns {Promise<Response>} - 处理后的响应
 */
export async function securityHeadersMiddleware(request, next) {
    let response = await next();

    // 设置安全相关的HTTP头部
    const headersToSet = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'Content-Security-Policy': "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'self' https: http:; img-src 'self' data: blob: https: http:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https: http:; worker-src 'self' blob:;"
    };

    try {
        Object.entries(headersToSet).forEach(([k, v]) => response.headers.set(k, v));
    } catch (e) {
        // 如果响应头不可变，构造新的 Response
        const newHeaders = new Headers(response.headers);
        Object.entries(headersToSet).forEach(([k, v]) => newHeaders.set(k, v));
        response = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
        });
    }

    return response;
}
