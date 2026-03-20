/**
 * 认证中间件模块
 * 处理用户认证和会话管理
 */

import { COOKIE_NAME, SESSION_DURATION } from './config.js';
import { getCookieSecret, getAdminPassword, getAuthDebugInfo } from './utils.js';
import { StorageFactory } from '../storage-adapter.js';

function normalizeSecret(value) {
    return String(value ?? '')
        .replace(/\uFEFF/g, '')
        .replace(/[\u200B-\u200D]/g, '')
        .trim()
        .replace(/^['"]|['"]$/g, '');
}

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
        hasKv: !!StorageFactory.resolveKV(env),
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
 * 获取认证会话调试信息（不包含敏感值）
 * @param {Request} request
 * @param {Object} env
 * @returns {Promise<Object>}
 */
export async function getAuthSessionDiagnostic(request, env) {
    const result = {
        isAuthenticated: false,
        reason: 'unknown',
        cookieHeaderPresent: false,
        authSessionCookieCount: 0,
        token: {
            exists: false,
            decodeMode: 'none',
            length: 0,
            partCount: 0
        },
        verify: {
            success: false,
            hasTimestamp: false,
            isExpired: null
        }
    };

    const secret = await getCookieSecret(env);
    if (!secret) {
        result.reason = 'no_secret';
        return result;
    }

    const cookieHeader = request.headers.get('Cookie') || '';
    result.cookieHeaderPresent = cookieHeader.length > 0;

    const matchedCookies = cookieHeader
        .split(';')
        .map(c => c.trim())
        .filter(c => c.startsWith(`${COOKIE_NAME}=`));

    result.authSessionCookieCount = matchedCookies.length;
    if (matchedCookies.length === 0) {
        result.reason = 'no_cookie';
        return result;
    }

    const rawToken = matchedCookies[matchedCookies.length - 1].slice(COOKIE_NAME.length + 1);
    if (!rawToken) {
        result.reason = 'empty_token';
        return result;
    }

    let token = rawToken;
    try {
        token = decodeURIComponent(rawToken);
        result.token.decodeMode = 'decodeURIComponent';
    } catch (_) {
        result.token.decodeMode = 'raw';
    }

    token = String(token || '').replace(/^"|"$/g, '');
    result.token.exists = token.length > 0;
    result.token.length = token.length;
    result.token.partCount = token ? token.split('.').length : 0;

    if (!token) {
        result.reason = 'empty_token';
        return result;
    }

    const verifiedData = await verifySignedToken(secret, token);
    if (!verifiedData) {
        result.reason = 'invalid_signature_or_secret';
        return result;
    }

    result.verify.success = true;
    const ts = parseInt(verifiedData, 10);
    const hasTimestamp = Number.isFinite(ts);
    result.verify.hasTimestamp = hasTimestamp;

    if (!hasTimestamp) {
        result.reason = 'invalid_timestamp';
        return result;
    }

    const isExpired = (Date.now() - ts) >= SESSION_DURATION;
    result.verify.isExpired = isExpired;
    if (isExpired) {
        result.reason = 'expired';
        return result;
    }

    result.isAuthenticated = true;
    result.reason = 'ok';
    return result;
}

/**
 * 获取登录密码诊断信息（不返回明文密码）
 * @param {Request} request
 * @param {Object} env
 * @returns {Promise<Object>}
 */
export async function getLoginPasswordDiagnostic(request, env) {
    const debugInfo = await getAuthDebugInfo(env);
    const result = {
        success: false,
        matched: false,
        reason: 'unknown',
        runtime: {
            adminPasswordSource: debugInfo?.adminPassword?.source || 'unknown'
        },
        input: {
            provided: false,
            normalizedLength: 0
        },
        expected: {
            normalizedLength: 0
        }
    };

    let payload;
    try {
        payload = await request.json();
    } catch (_) {
        result.reason = 'invalid_json';
        return result;
    }

    const inputPassword = normalizeSecret(payload?.password);
    const currentPassword = normalizeSecret(await getAdminPassword(env));

    result.input.provided = typeof payload?.password === 'string';
    result.input.normalizedLength = inputPassword.length;
    result.expected.normalizedLength = currentPassword.length;

    if (!result.input.provided) {
        result.reason = 'missing_password';
        return result;
    }

    result.matched = inputPassword === currentPassword;
    result.success = true;
    result.reason = result.matched ? 'matched' : 'mismatch';
    return result;
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
        const diagnostic = await getAuthSessionDiagnostic(request, env);
        return diagnostic.isAuthenticated;
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

    try {
        const { password } = payload || {};
        const inputPassword = normalizeSecret(password);
        const currentPassword = normalizeSecret(await getAdminPassword(env));
        const isPasswordMatched = inputPassword === currentPassword;

        if (isPasswordMatched) {
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
