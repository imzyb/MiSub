import {
    getCache,
    triggerBackgroundRefresh,
    createCacheHeaders,
    isLikelyPartialAggregateNodeList,
} from '../../services/node-cache-service.js';

const refreshDebounce = new Map();
const DEBOUNCE_TIME = 10000;

function countCachedNodes(cachedData) {
    const declaredCount = Number(cachedData?.nodeCount);
    if (Number.isFinite(declaredCount)) return declaredCount;
    return String(cachedData?.nodes || '')
        .split('\n')
        .filter((line) => line.trim()).length;
}

function hasUsableCachedNodes(cachedData) {
    return Boolean(String(cachedData?.nodes || '').trim()) && countCachedNodes(cachedData) > 0;
}

function isCacheFarBelowExpected(cachedData, expectedNodeCount) {
    const expected = Number(expectedNodeCount);
    if (!Number.isFinite(expected) || expected < 10) return false;
    const cached = countCachedNodes(cachedData);
    return cached / expected < 0.3;
}

function populateCachedStats(context, cachedNodeCount, targetMisubsCount) {
    if (!context) return;
    context.generationStats = {
        totalNodes: cachedNodeCount,
        sourceCount: targetMisubsCount,
        successCount: cachedNodeCount,
        failCount: 0,
        duration: 0,
    };
}

export async function resolveNodeListWithCache({
    storageAdapter,
    cacheKey,
    forceRefresh,
    refreshNodes,
    context,
    targetMisubsCount,
    expectedNodeCount = 0,
}) {
    const { data: cachedData, status: cacheStatus } = forceRefresh
        ? { data: null, status: 'miss' }
        : await getCache(storageAdapter, cacheKey);

    let combinedNodeList;
    let cacheHeaders = {};
    const cacheLooksIncomplete =
        cachedData &&
        (isCacheFarBelowExpected(cachedData, expectedNodeCount) ||
            isLikelyPartialAggregateNodeList(cachedData.nodes));
    const canUseCachedData =
        cachedData && hasUsableCachedNodes(cachedData) && !cacheLooksIncomplete;

    if (cacheLooksIncomplete) {
        console.warn(
            `[Cache] Ignoring incomplete cache ${cacheKey} (${countCachedNodes(cachedData)} cached vs ${expectedNodeCount} expected nodes)`
        );
    }

    if (cacheStatus === 'fresh' && canUseCachedData) {
        const cachedNodeCount = countCachedNodes(cachedData);
        combinedNodeList = cachedData.nodes;
        cacheHeaders = createCacheHeaders('HIT', cachedNodeCount);
        populateCachedStats(context, cachedNodeCount, targetMisubsCount);
    } else if ((cacheStatus === 'stale' || cacheStatus === 'expired') && canUseCachedData) {
        const cachedNodeCount = countCachedNodes(cachedData);
        combinedNodeList = cachedData.nodes;
        cacheHeaders = createCacheHeaders('REFRESHING', cachedNodeCount);

        const lastRun = refreshDebounce.get(cacheKey);
        if (!lastRun || Date.now() - lastRun > DEBOUNCE_TIME) {
            refreshDebounce.set(cacheKey, Date.now());
            triggerBackgroundRefresh(context, () => refreshNodes(true));
        }

        populateCachedStats(context, cachedNodeCount, targetMisubsCount);
    } else {
        combinedNodeList = await refreshNodes(false);
        cacheHeaders = createCacheHeaders(
            'MISS',
            combinedNodeList.split('\n').filter((line) => line.trim()).length
        );
    }

    return { combinedNodeList, cacheHeaders, cacheStatus };
}
