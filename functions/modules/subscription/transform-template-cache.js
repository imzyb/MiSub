import { getCache } from '../../services/node-cache-service.js';

const TEMPLATE_CACHE_PREFIX = 'transform_template_';

function makeTemplateCacheKey(url) {
    return `${TEMPLATE_CACHE_PREFIX}${btoa(url).replace(/=+$/g, '')}`;
}

export async function fetchTransformTemplate(storageAdapter, templateUrl, forceRefresh = false) {
    if (!templateUrl) return null;

    const cacheKey = makeTemplateCacheKey(templateUrl);
    if (!forceRefresh) {
        const { data } = await getCache(storageAdapter, cacheKey);
        if (data?.nodes) {
            return data.nodes;
        }
    }

    const response = await fetch(templateUrl, {
        headers: {
            'User-Agent': 'MiSub-Template-Fetch/1.0'
        }
    });

    if (!response.ok) {
        throw new Error(`Template fetch failed: HTTP ${response.status}`);
    }

    const text = await response.text();

    const cacheEntry = {
        nodes: text,
        timestamp: Date.now(),
        nodeCount: 0,
        sources: [templateUrl]
    };
    if (storageAdapter?.kv && typeof storageAdapter.kv.put === 'function') {
        await storageAdapter.kv.put(cacheKey, JSON.stringify(cacheEntry), {
            expirationTtl: 24 * 60 * 60
        });
    } else if (storageAdapter && typeof storageAdapter.put === 'function') {
        await storageAdapter.put(cacheKey, cacheEntry);
    }

    return text;
}
