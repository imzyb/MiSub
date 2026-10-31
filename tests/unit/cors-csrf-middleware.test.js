import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { handleApiRequest } from '../../functions/modules/api-router.js';
import { corsMiddleware, csrfOriginMiddleware } from '../../functions/middleware/cors.js';

const SRC_ROOT = path.resolve(process.cwd(), 'src');

function collectSourceFiles(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectSourceFiles(fullPath));
        } else if (/\.(js|vue)$/.test(entry.name)) {
            files.push(fullPath);
        }
    }
    return files;
}

/** 去掉注释，避免文档里举例的头名把守卫喂饱 */
function stripComments(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function createKv(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        async get(key) {
            return values.get(key) ?? null;
        },
        async put(key, value) {
            values.set(key, value);
        },
        async delete(key) {
            values.delete(key);
        },
    };
}

const makeMiddlewareRequest = (url, { method = 'GET', origin, referer } = {}) => ({
    url,
    method,
    headers: {
        get(name) {
            const key = String(name || '').toLowerCase();
            if (key === 'origin') return origin || null;
            if (key === 'referer') return referer || null;
            return null;
        },
    },
});

describe('CORS and CSRF middleware hardening', () => {
    it('centralizes CORS headers without wildcard defaults in JSON helpers', async () => {
        const sameOriginResponse = await corsMiddleware(
            makeMiddlewareRequest('https://example.com/api/data', {
                origin: 'https://example.com',
            }),
            async () => new Response('ok'),
            { origins: ['https://example.com'], allowCredentials: true }
        );
        const helperResponse = await handleApiRequest(
            new Request('https://example.com/api/public_config'),
            { MISUB_KV: createKv() }
        );

        expect(sameOriginResponse.headers.get('Access-Control-Allow-Origin')).toBe(
            'https://example.com'
        );
        expect(sameOriginResponse.headers.get('Access-Control-Allow-Credentials')).toBe('true');
        expect(helperResponse.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('rejects unsafe cross-site write requests while allowing same-origin and non-browser writes', async () => {
        const crossSite = await csrfOriginMiddleware(
            makeMiddlewareRequest('https://example.com/api/settings', {
                method: 'POST',
                origin: 'https://evil.example',
            }),
            async () => new Response('should-not-run'),
            { origins: ['https://example.com'] }
        );
        const sameOrigin = await csrfOriginMiddleware(
            makeMiddlewareRequest('https://example.com/api/settings', {
                method: 'POST',
                origin: 'https://example.com',
            }),
            async () => new Response('ok'),
            { origins: ['https://example.com'] }
        );
        const bearerRequest = await csrfOriginMiddleware(
            {
                ...makeMiddlewareRequest('https://example.com/api/settings', { method: 'POST' }),
                headers: {
                    get(name) {
                        return String(name || '').toLowerCase() === 'authorization'
                            ? 'Bearer [REDACTED]'
                            : null;
                    },
                },
            },
            async () => new Response('ok'),
            { origins: ['https://example.com'] }
        );
        const cookieWithoutOrigin = await csrfOriginMiddleware(
            {
                ...makeMiddlewareRequest('https://example.com/api/settings', { method: 'POST' }),
                headers: {
                    get(name) {
                        return String(name || '').toLowerCase() === 'cookie'
                            ? 'misub_session=[REDACTED]'
                            : null;
                    },
                },
            },
            async () => new Response('should-not-run'),
            { origins: ['https://example.com'] }
        );

        expect(crossSite.status).toBe(403);
        expect(await crossSite.text()).toContain('Origin Not Allowed');
        expect(sameOrigin.status).toBe(200);
        expect(bearerRequest.status).toBe(200);
        expect(cookieWithoutOrigin.status).toBe(403);
        expect(await cookieWithoutOrigin.text()).toContain('Origin Required');
    });

    it('预检放行前端实际发送的自定义请求头（跨域部署必需）', async () => {
        const preflight = await corsMiddleware(
            makeMiddlewareRequest('https://example.com/api/settings', {
                method: 'OPTIONS',
                origin: 'https://example.com',
            }),
            async () => new Response('should-not-run'),
            { origins: ['https://example.com'], allowCredentials: true }
        );
        const allowed = (preflight.headers.get('Access-Control-Allow-Headers') || '')
            .split(',')
            .map((header) => header.trim().toLowerCase())
            .filter(Boolean);

        // 前端请求里以 `'X-xxx':` 形式出现的头才是请求头；
        // 读响应头写的是 headers.get('X-xxx')，没有紧跟冒号，不会误收。
        const sourceFiles = collectSourceFiles(SRC_ROOT);
        const usedHeaders = new Set();
        for (const file of sourceFiles) {
            const code = stripComments(readFileSync(file, 'utf-8'));
            for (const match of code.matchAll(/'((?:X|x)-[A-Za-z0-9-]+)'\s*:/g)) {
                usedHeaders.add(match[1].toLowerCase());
            }
        }

        // 护栏：目录改名 / 正则失效时不要静默通过
        expect(sourceFiles.length).toBeGreaterThan(100);
        expect(usedHeaders.size).toBeGreaterThan(0);
        // 自检：谓词确实认得已知的头（防止「恒为空集所以通过」）
        expect(usedHeaders.has('x-misub-save-scope')).toBe(true);

        for (const header of usedHeaders) {
            expect(allowed).toContain(header);
        }
    });
});
