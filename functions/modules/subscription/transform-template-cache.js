import { getCache } from '../../services/node-cache-service.js';

const TEMPLATE_CACHE_PREFIX = 'transform_template_';
const DEFAULT_REVALIDATE_INTERVAL_SECONDS = 5 * 60;
const DEFAULT_CACHE_MAX_AGE_SECONDS = 24 * 60 * 60;
const MIN_REVALIDATE_INTERVAL_SECONDS = 0;
const MAX_REVALIDATE_INTERVAL_SECONDS = 24 * 60 * 60;
const MIN_CACHE_MAX_AGE_SECONDS = 5 * 60;
const MAX_CACHE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function makeTemplateCacheKey(url) {
    return `${TEMPLATE_CACHE_PREFIX}${btoa(url).replace(/=+$/g, '')}`;
}

function readNumericSetting(name, storageAdapter) {
    const value = storageAdapter?.env?.[name] ?? globalThis[name];
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getTemplateCacheConfig(storageAdapter) {
    const revalidateSetting = readNumericSetting('TEMPLATE_REVALIDATE_INTERVAL_SECONDS', storageAdapter);
    const maxAgeSetting = readNumericSetting('TEMPLATE_CACHE_MAX_AGE_SECONDS', storageAdapter);

    return {
        revalidateIntervalMs: clampNumber(
            revalidateSetting ?? DEFAULT_REVALIDATE_INTERVAL_SECONDS,
            MIN_REVALIDATE_INTERVAL_SECONDS,
            MAX_REVALIDATE_INTERVAL_SECONDS
        ) * 1000,
        maxAgeSeconds: clampNumber(
            maxAgeSetting ?? DEFAULT_CACHE_MAX_AGE_SECONDS,
            MIN_CACHE_MAX_AGE_SECONDS,
            MAX_CACHE_MAX_AGE_SECONDS
        )
    };
}

function isCacheYoungerThan(cacheEntry, maxAgeMs) {
    if (!cacheEntry?.timestamp) return false;
    return Date.now() - cacheEntry.timestamp < maxAgeMs;
}

function buildFetchHeaders(cacheEntry) {
    const headers = {
        'User-Agent': 'MiSub-Template-Fetch/1.0'
    };

    if (cacheEntry?.etag) {
        headers['If-None-Match'] = cacheEntry.etag;
    }
    if (cacheEntry?.lastModified) {
        headers['If-Modified-Since'] = cacheEntry.lastModified;
    }

    return headers;
}

function getHeader(response, name) {
    return response.headers?.get?.(name) || response.headers?.get?.(name.toLowerCase()) || null;
}

async function putTemplateCache(storageAdapter, cacheKey, cacheEntry, maxAgeSeconds) {
    if (storageAdapter?.kv && typeof storageAdapter.kv.put === 'function') {
        await storageAdapter.kv.put(cacheKey, JSON.stringify(cacheEntry), {
            expirationTtl: maxAgeSeconds
        });
    } else if (storageAdapter && typeof storageAdapter.put === 'function') {
        await storageAdapter.put(cacheKey, cacheEntry);
    }
}

function createCacheEntry(templateUrl, nodes, response, previousEntry = null) {
    return {
        nodes,
        timestamp: Date.now(),
        nodeCount: previousEntry?.nodeCount || 0,
        sources: previousEntry?.sources?.length ? previousEntry.sources : [templateUrl],
        etag: getHeader(response, 'etag') || previousEntry?.etag,
        lastModified: getHeader(response, 'last-modified') || previousEntry?.lastModified
    };
}

export async function fetchTransformTemplate(storageAdapter, templateUrl, forceRefresh = false) {
    if (!templateUrl) return null;

    const cacheKey = makeTemplateCacheKey(templateUrl);
    const cacheConfig = getTemplateCacheConfig(storageAdapter);
    const { data: cachedTemplate } = await getCache(storageAdapter, cacheKey);

    if (!forceRefresh && cachedTemplate?.nodes && isCacheYoungerThan(cachedTemplate, cacheConfig.revalidateIntervalMs)) {
        return cachedTemplate.nodes;
    }

    let response;
    try {
        response = await fetch(templateUrl, {
            headers: forceRefresh ? { 'User-Agent': 'MiSub-Template-Fetch/1.0' } : buildFetchHeaders(cachedTemplate)
        });
    } catch (error) {
        if (cachedTemplate?.nodes && isCacheYoungerThan(cachedTemplate, cacheConfig.maxAgeSeconds * 1000)) {
            console.warn(`[TemplateCache] Revalidation failed, falling back to cached template: ${error.message}`);
            return cachedTemplate.nodes;
        }
        throw error;
    }

    if (response.status === 304 && cachedTemplate?.nodes) {
        const refreshedCacheEntry = createCacheEntry(templateUrl, cachedTemplate.nodes, response, cachedTemplate);
        await putTemplateCache(storageAdapter, cacheKey, refreshedCacheEntry, cacheConfig.maxAgeSeconds);
        return cachedTemplate.nodes;
    }

    if (!response.ok) {
        if (cachedTemplate?.nodes && isCacheYoungerThan(cachedTemplate, cacheConfig.maxAgeSeconds * 1000)) {
            console.warn(`[TemplateCache] Template fetch failed with HTTP ${response.status}, falling back to cached template`);
            return cachedTemplate.nodes;
        }
        throw new Error(`Template fetch failed: HTTP ${response.status}`);
    }

    const text = await response.text();
    const cacheEntry = createCacheEntry(templateUrl, text, response, cachedTemplate);
    await putTemplateCache(storageAdapter, cacheKey, cacheEntry, cacheConfig.maxAgeSeconds);

    return text;
}
