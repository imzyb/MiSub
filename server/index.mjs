import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAssetFetcher } from './assets.js';
import { createSqliteStore } from './storage/sqlite.js';
import { onRequest } from '../functions/[[path]].js';

// [Critical Debug]: Force stdout output immediately
process.stdout.write('[MiSub Debug] Server script loaded.\n');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = process.env.MISUB_DIST_DIR || path.join(rootDir, 'dist');
const schemaPath = process.env.MISUB_SCHEMA_PATH || path.join(rootDir, 'schema.sql');
const dbPath = process.env.MISUB_DB_PATH || path.join(rootDir, 'data', 'misub.db');
const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 8080);

console.log('[MiSub] Deployment ID:', process.env.ZEABUR_DEPLOYMENT_ID || 'Local');
console.log('[MiSub] Server process initialized.');

process.on('uncaughtException', (err) => {
    console.error('[MiSub] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[MiSub] Unhandled Rejection at:', promise, 'reason:', reason);
});

const { kv, d1 } = createSqliteStore({ dbPath, schemaPath });
const assets = createAssetFetcher({ distDir });

const env = {
    ...process.env,
    MISUB_KV: kv,
    MISUB_DB: d1,
    ASSETS: assets
};

function getRequestUrl(req) {
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    return `${proto}://${hostHeader}${req.url || '/'}`;
}

function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : null));
        req.on('error', reject);
    });
}

async function toWebRequest(req) {
    const url = getRequestUrl(req);
    const init = {
        method: req.method,
        headers: req.headers
    };

    if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
        const body = await readRequestBody(req);
        if (body) {
            init.body = body;
            init.duplex = 'half';
        }
    }

    return new Request(url, init);
}

async function sendWebResponse(res, response, method) {
    res.statusCode = response.status;

    const setCookie = response.headers.getSetCookie?.();
    if (setCookie?.length) {
        res.setHeader('set-cookie', setCookie);
    }

    response.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie') return;
        res.setHeader(key, value);
    });

    if (method === 'HEAD' || response.status === 204 || response.status === 304) {
        res.end();
        return;
    }

    const body = response.body ? Buffer.from(await response.arrayBuffer()) : null;
    res.end(body);
}

const server = http.createServer(async (req, res) => {
    try {
        const request = await toWebRequest(req);
        const waitUntilTasks = [];
        const context = {
            request,
            env,
            next: () => env.ASSETS.fetch(request),
            waitUntil(promise) {
                if (promise && typeof promise.catch === 'function') {
                    promise.catch(error => {
                        console.warn('[waitUntil] task failed:', error?.message || error);
                    });
                }
                waitUntilTasks.push(promise);
            }
        };

        const response = await onRequest(context);
        await sendWebResponse(res, response, req.method);

        if (waitUntilTasks.length) {
            setImmediate(() => {
                Promise.allSettled(waitUntilTasks).catch(() => { });
            });
        }
    } catch (error) {
        console.error('[Server] Request failed:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Internal Server Error');
    }
});

server.listen(port, host, () => {
    console.log(`[MiSub] VPS server listening on http://${host}:${port}`);
});
