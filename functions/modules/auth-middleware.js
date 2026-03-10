/**
 * 认证中间件模块
 * 处理用户认证和会话管理
 */

import { COOKIE_NAME, SESSION_DURATION } from './config.js';
import { getCookieSecret, getAdminPassword } from './utils.js';

function buildRequestMeta(request, env) {
    return {
        url: request?.url,
        method: request?.method,
        contentType: request?.headers?.get('Content-Type'),
        contentLength: request?.headers?.get('Content-Length'),
        userAgent: request?.headers?.get('User-Agent'),
        origin: request?.headers?.get('Origin'),
        referer: request?.headers?.get('Referer'),
        cfRay: request?.headers?.get('CF-Ray'),
        hasKv: !!env?.MISUB_KV,
        hasD1: !!env?.MISUB_DB
    };
}

/**
 * 创建 HMAC 签名的令牌
 * @param {string} key - 签名密钥
 * @param {string} data - 要签名的数据
 * @returns {Promise<string>} 签名后的令牌
 */
export async function createSignedToken(key, data) {
    if (!key || !data) throw new Error("Key and data are required for signing.");
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const dataToSign = encoder.encode(data);
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataToSign);
    return `${data}.${Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * 验证 HMAC 签名令牌
 * @param {string} key - 验证密钥
 * @param {string} token - 要验证的令牌
 * @returns {Promise<string|null>} 验证成功返回数据，失败返回 null
 */
export async function verifySignedToken(key, token) {
    if (!key || !token) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    
    const [data, signatureHex] = parts;
    
    try {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(key);
        const dataToVerify = encoder.encode(data);
        
        // Convert hex to Uint8Array
        const sigBytes = new Uint8Array(signatureHex.length / 2);
        for (let i = 0; i < signatureHex.length; i += 2) {
            sigBytes[i / 2] = parseInt(signatureHex.substring(i, i + 2), 16);
        }
        
        // Import key for verification
        const cryptoKey = await crypto.subtle.importKey(
            'raw', 
            keyData, 
            { name: 'HMAC', hash: 'SHA-256' }, 
            false, 
            ['verify']
        );
        
        // Use native timing-safe verification
        const isValid = await crypto.subtle.verify(
            'HMAC',
            cryptoKey,
            sigBytes,
            dataToVerify
        );
        
        return isValid ? data : null;
    } catch (e) {
        console.error('[Auth] Token verify error:', e);
        return null;
    }
}

/**
 * 认证中间件 - 检查用户是否已登录
 * @param {Request} request - HTTP 请求对象
 * @param {Object} env - Cloudflare 环境对象
 * @returns {Promise<boolean>} 是否认证通过
 */
export async function authMiddleware(request, env) {
    const logMeta = buildRequestMeta(request, env);
    try {
        if (!env?.MISUB_KV) {
            console.error('[Auth] KV 绑定 MISUB_KV 缺失', logMeta);
            return false;
        }
        const secret = await getCookieSecret(env);
        if (!secret) return false;
        const cookie = request.headers.get('Cookie');
        const sessionCookie = cookie?.split(';').find(c => c.trim().startsWith(`${COOKIE_NAME}=`));
        if (!sessionCookie) return false;
        const token = sessionCookie.split('=')[1];
        const verifiedData = await verifySignedToken(secret, token);
        return verifiedData && (Date.now() - parseInt(verifiedData, 10) < SESSION_DURATION);
    } catch (e) {
        console.error('[Auth] 鉴权失败', { ...logMeta, error: e?.message });
        return false;
    }
}

/**
 * 处理用户登录
 * @param {Request} request - HTTP 请求对象
 * @param {Object} env - Cloudflare 环境对象
 * @returns {Promise<Response>} 登录响应
 */
export async function handleLogin(request, env) {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const logMeta = buildRequestMeta(request, env);
    let payload;
    try {
        payload = await request.json();
    } catch (e) {
        console.error('[API Error /login] Request body parse failed', { ...logMeta, error: e?.message });
        return new Response(JSON.stringify({ error: '请求体解析失败' }), { status: 400 });
    }

    if (!env?.MISUB_KV) {
        console.error('[API Error /login] KV 绑定 MISUB_KV 缺失', logMeta);
        return new Response(JSON.stringify({ error: 'KV 绑定 MISUB_KV 缺失' }), { status: 500 });
    }

    try {
        const { password } = payload || {};
        const currentPassword = await getAdminPassword(env);
        if (password === currentPassword) {
            const secret = await getCookieSecret(env);
            const token = await createSignedToken(secret, String(Date.now()));
            const headers = new Headers({ 'Content-Type': 'application/json' });
            const isSecure = request.url.startsWith('https');
            const cookieString = `${COOKIE_NAME}=${token}; Path=/; HttpOnly; ${isSecure ? 'Secure;' : ''} SameSite=Lax; Max-Age=${SESSION_DURATION / 1000}`;
            headers.append('Set-Cookie', cookieString);
            return new Response(JSON.stringify({ success: true }), { headers });
        }
        return new Response(JSON.stringify({ error: '密码错误' }), { status: 401 });
    } catch (e) {
        console.error('[API Error /login] Login handler failed', { ...logMeta, error: e?.message });
        return new Response(JSON.stringify({ error: '登录处理失败' }), { status: 500 });
    }
}

/**
 * 处理用户登出
 * @returns {Promise<Response>} 登出响应
 */
export async function handleLogout(request) {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    const isSecure = typeof request?.url === 'string' && request.url.startsWith('https');
    const secureFlag = isSecure ? 'Secure;' : '';
    headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; ${secureFlag} SameSite=Strict; Max-Age=0`);
    return new Response(JSON.stringify({ success: true }), { headers });
}

/**
 * 获取认证失败的响应
 * @param {string} message - 错误消息
 * @returns {Response} 401 响应
 */
export function createUnauthorizedResponse(message = 'Unauthorized') {
    return new Response(JSON.stringify({ error: message }), { status: 401 });
}
