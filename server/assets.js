import fs from 'node:fs/promises';
import path from 'node:path';

const CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'application/vnd.ms-fontobject',
    '.wasm': 'application/wasm',
    '.mp4': 'video/mp4'
};

function getContentType(filePath) {
    return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function resolveAssetPath(distRoot, requestPath) {
    let decoded;
    try {
        decoded = decodeURIComponent(requestPath);
    } catch {
        return null;
    }
    let relative = decoded.replace(/^\/+/, '');

    if (!relative || decoded.endsWith('/')) {
        relative = path.join(relative, 'index.html');
    }

    const fullPath = path.normalize(path.join(distRoot, relative));
    const rootWithSep = distRoot.endsWith(path.sep) ? distRoot : distRoot + path.sep;
    if (fullPath !== distRoot && !fullPath.startsWith(rootWithSep)) {
        return null;
    }

    return fullPath;
}

export function createAssetFetcher({ distDir }) {
    const distRoot = path.resolve(distDir);

    return {
        async fetch(request) {
            const url = typeof request === 'string' ? new URL(request) : new URL(request.url);
            const assetPath = resolveAssetPath(distRoot, url.pathname);

            if (!assetPath) {
                return new Response('Not Found', { status: 404 });
            }

            try {
                const stat = await fs.stat(assetPath);
                if (!stat.isFile()) {
                    return new Response('Not Found', { status: 404 });
                }

                const data = await fs.readFile(assetPath);
                return new Response(data, {
                    status: 200,
                    headers: {
                        'Content-Type': getContentType(assetPath),
                        'Content-Length': String(data.length)
                    }
                });
            } catch {
                return new Response('Not Found', { status: 404 });
            }
        }
    };
}
