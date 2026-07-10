import { StorageFactory, STORAGE_TYPES } from '../storage-adapter.js';

const DEFAULT_EXTERNAL_NODES_TTL_SECONDS = 120;
const DEFAULT_MAX_INLINE_URL_LENGTH = 6000;
const DEFAULT_MAX_INLINE_NODE_COUNT = 80;
const MEMORY_CACHE_SYMBOL = '__misubExternalNodesCallbackCache';

function getCrypto() {
    const cryptoImpl = globalThis.crypto;
    if (!cryptoImpl?.subtle) {
        throw new Error('WebCrypto subtle API is unavailable');
    }
    return cryptoImpl;
}

function bytesToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

function bytesToBase64Url(bytes) {
    let binary = '';
    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });
    const base64 = typeof btoa === 'function'
        ? btoa(binary)
        : Buffer.from(binary, 'binary').toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function encodeUtf8Base64(text) {
    const bytes = new TextEncoder().encode(String(text || ''));
    let binary = '';
    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });
    return typeof btoa === 'function'
        ? btoa(binary)
        : Buffer.from(binary, 'binary').toString('base64');
}

function base64UrlToBytes(value) {
    const base64 = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('binary');
    return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function encodePayload(payload) {
    return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

function decodePayload(encoded) {
    const json = new TextDecoder().decode(base64UrlToBytes(encoded));
    return JSON.parse(json);
}

async function hmacSha256Base64Url(data, secret) {
    const cryptoImpl = getCrypto();
    const key = await cryptoImpl.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await cryptoImpl.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return bytesToBase64Url(new Uint8Array(signature));
}

async function sha256Hex(text) {
    const digest = await getCrypto().subtle.digest('SHA-256', new TextEncoder().encode(text));
    return bytesToHex(digest);
}

function timingSafeEqualString(a, b) {
    const left = String(a || '');
    const right = String(b || '');
    if (left.length !== right.length) return false;
    let diff = 0;
    for (let i = 0; i < left.length; i += 1) {
        diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
    }
    return diff === 0;
}

function getMemoryCache() {
    if (!globalThis[MEMORY_CACHE_SYMBOL]) {
        globalThis[MEMORY_CACHE_SYMBOL] = new Map();
    }
    return globalThis[MEMORY_CACHE_SYMBOL];
}

function resolveExternalNodesKv(env = {}) {
    try {
        return StorageFactory.resolveKV(env);
    } catch {
        return null;
    }
}

function resolveExternalNodesD1Adapter(env = {}) {
    if (!env?.MISUB_DB) return null;
    try {
        return StorageFactory.createAdapter(env, STORAGE_TYPES.D1);
    } catch (error) {
        console.warn('[ExternalNodesCallback] D1 storage unavailable:', error?.message || error);
        return null;
    }
}

function normalizeDurableStoredNodes(stored) {
    if (stored === null || stored === undefined) return null;
    if (typeof stored === 'string') return stored;
    if (typeof stored === 'object') {
        if (Number(stored.expiresAt || 0) && Number(stored.expiresAt) <= Date.now()) {
            return null;
        }
        if (typeof stored.value === 'string') return stored.value;
    }
    return null;
}

function purgeExpiredMemoryEntries(now = Date.now()) {
    const cache = getMemoryCache();
    for (const [key, entry] of cache.entries()) {
        if (!entry || entry.expiresAt <= now) {
            cache.delete(key);
        }
    }
}

export function countNodeLines(nodesText = '') {
    return String(nodesText || '')
        .split(/\r?\n+/)
        .map(line => line.trim())
        .filter(Boolean)
        .length;
}

export function shouldUseExternalNodesCallback({
    inlineUrlLength = 0,
    nodeCount = 0,
    maxInlineUrlLength = DEFAULT_MAX_INLINE_URL_LENGTH,
    maxInlineNodeCount = DEFAULT_MAX_INLINE_NODE_COUNT
} = {}) {
    return Number(inlineUrlLength) > maxInlineUrlLength || Number(nodeCount) > maxInlineNodeCount;
}

export function buildExternalNodesCacheKey(profileId, nodeHash) {
    const safeProfileId = String(profileId || 'default').replace(/[^a-zA-Z0-9._:-]/g, '_');
    return `tmp_external_nodes:${safeProfileId}:${nodeHash}`;
}

export async function hashExternalNodes(nodesText) {
    return sha256Hex(String(nodesText || ''));
}

export async function putExternalNodes({ env = {}, profileId = 'default', nodesText = '', ttlSeconds = DEFAULT_EXTERNAL_NODES_TTL_SECONDS } = {}) {
    const normalizedNodes = String(nodesText || '');
    const nodeHash = await hashExternalNodes(normalizedNodes);
    const cacheKey = buildExternalNodesCacheKey(profileId, nodeHash);
    const kv = resolveExternalNodesKv(env);

    if (kv?.get && kv?.put) {
        const existing = await kv.get(cacheKey);
        if (existing !== null && existing !== undefined) {
            return { cacheKey, nodeHash, reused: true, storage: 'kv' };
        }
        await kv.put(cacheKey, normalizedNodes, { expirationTtl: ttlSeconds });
        return { cacheKey, nodeHash, reused: false, storage: 'kv' };
    }

    const d1Adapter = resolveExternalNodesD1Adapter(env);
    if (d1Adapter?.get && d1Adapter?.put) {
        const existing = normalizeDurableStoredNodes(await d1Adapter.get(cacheKey));
        if (existing !== null && existing !== undefined) {
            return { cacheKey, nodeHash, reused: true, storage: 'd1' };
        }
        await d1Adapter.put(cacheKey, {
            value: normalizedNodes,
            expiresAt: Date.now() + ttlSeconds * 1000
        });
        return { cacheKey, nodeHash, reused: false, storage: 'd1' };
    }

    purgeExpiredMemoryEntries();
    const cache = getMemoryCache();
    const existing = cache.get(cacheKey);
    if (existing && existing.expiresAt > Date.now()) {
        return { cacheKey, nodeHash, reused: true, storage: 'memory' };
    }
    cache.set(cacheKey, {
        value: normalizedNodes,
        expiresAt: Date.now() + ttlSeconds * 1000
    });
    return { cacheKey, nodeHash, reused: false, storage: 'memory' };
}

export async function getExternalNodes({ env = {}, profileId = 'default', nodeHash } = {}) {
    const cacheKey = buildExternalNodesCacheKey(profileId, nodeHash);
    const kv = resolveExternalNodesKv(env);
    if (kv?.get) {
        return normalizeDurableStoredNodes(await kv.get(cacheKey));
    }

    const d1Adapter = resolveExternalNodesD1Adapter(env);
    if (d1Adapter?.get) {
        const stored = await d1Adapter.get(cacheKey);
        const nodes = normalizeDurableStoredNodes(stored);
        if (nodes === null && stored && d1Adapter?.delete) {
            await d1Adapter.delete(cacheKey).catch(() => undefined);
        }
        return nodes;
    }

    purgeExpiredMemoryEntries();
    const entry = getMemoryCache().get(cacheKey);
    return entry?.expiresAt > Date.now() ? entry.value : null;
}

export async function createExternalNodesToken({ profileId, nodeHash, secret, expiresInSeconds = DEFAULT_EXTERNAL_NODES_TTL_SECONDS } = {}) {
    if (!secret) {
        throw new Error('external nodes callback secret is missing');
    }
    const payload = {
        profileId: String(profileId || 'default'),
        nodeHash: String(nodeHash || ''),
        exp: Math.floor(Date.now() / 1000) + Number(expiresInSeconds)
    };
    const encodedPayload = encodePayload(payload);
    const signature = await hmacSha256Base64Url(encodedPayload, secret);
    return `${encodedPayload}.${signature}`;
}

export async function verifyExternalNodesToken(token, secret) {
    if (!secret) {
        throw new Error('external nodes callback secret is missing');
    }
    const [encodedPayload, signature, extra] = String(token || '').split('.');
    if (!encodedPayload || !signature || extra !== undefined) {
        throw new Error('invalid external nodes callback token');
    }
    const expectedSignature = await hmacSha256Base64Url(encodedPayload, secret);
    if (!timingSafeEqualString(signature, expectedSignature)) {
        throw new Error('invalid external nodes callback token');
    }

    let payload;
    try {
        payload = decodePayload(encodedPayload);
    } catch {
        throw new Error('invalid external nodes callback token');
    }
    if (!payload?.profileId || !/^[a-f0-9]{64}$/i.test(String(payload.nodeHash || ''))) {
        throw new Error('invalid external nodes callback token');
    }
    if (Number(payload.exp) < Math.floor(Date.now() / 1000)) {
        throw new Error('expired external nodes callback token');
    }
    return payload;
}

export function resolveExternalNodesCallbackSecret(env = {}) {
    return env?.CALLBACK_TOKEN_SECRET || env?.COOKIE_SECRET || '';
}

export function buildExternalNodesCallbackUrl(requestUrl, token, { encoding } = {}) {
    const callbackUrl = new URL('/api/external-nodes-callback', requestUrl);
    callbackUrl.searchParams.set('token', token);
    if (encoding) {
        callbackUrl.searchParams.set('encoding', encoding);
    }
    return callbackUrl.toString();
}

export async function prepareExternalNodesCallback({ env = {}, requestUrl, profileId = 'default', nodesText = '', ttlSeconds = DEFAULT_EXTERNAL_NODES_TTL_SECONDS, encoding } = {}) {
    const secret = resolveExternalNodesCallbackSecret(env);
    const stored = await putExternalNodes({ env, profileId, nodesText, ttlSeconds });
    const token = await createExternalNodesToken({
        profileId,
        nodeHash: stored.nodeHash,
        secret,
        expiresInSeconds: ttlSeconds
    });
    return {
        ...stored,
        token,
        callbackUrl: buildExternalNodesCallbackUrl(requestUrl, token, { encoding })
    };
}

export async function handleExternalNodesCallbackRequest(request, env = {}) {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (!token) {
        return new Response('Missing callback token', { status: 400 });
    }

    let payload;
    try {
        payload = await verifyExternalNodesToken(token, resolveExternalNodesCallbackSecret(env));
    } catch (err) {
        const message = err?.message || 'Invalid callback token';
        const status = /expired/i.test(message) ? 410 : 403;
        return new Response(message, { status });
    }

    const nodesText = await getExternalNodes({ env, profileId: payload.profileId, nodeHash: payload.nodeHash });
    if (nodesText === null || nodesText === undefined) {
        return new Response('External nodes callback cache expired or missing', { status: 410 });
    }

    const encoding = (url.searchParams.get('encoding') || '').toLowerCase();
    const responseText = encoding === 'base64' ? encodeUtf8Base64(nodesText) : nodesText;
    const headers = {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, no-cache',
        'X-MiSub-Mode': 'external-nodes-callback'
    };
    if (encoding === 'base64') {
        headers['X-MiSub-Callback-Encoding'] = 'base64';
    }

    return new Response(responseText, {
        headers
    });
}
