/**
 * D1 节点持久化服务。
 *
 * 设计（与产品口径一致）：
 * - 一个机场订阅在数据库里只有一行快照，永远保留「最后一次更新」的数据；
 * - 启用持久化 = 立刻对所有机场做一次全量拉取（等价一次 Cron），用户无感；
 * - 全量通过内部接口自触发链推进，页面关掉也能继续；
 * - 输出链路只读快照，仅在「该订阅还没有快照」或「配置指纹变化」时懒初始化一次。
 */

import { StorageFactory, SettingsCache, ensureD1Schema } from '../storage-adapter.js';
import { fetchWithRetry } from './fetch-utils.js';
import { buildFetchProxyUrl } from '../utils/fetch-proxy-utils.js';
import { getProcessedUserAgent } from '../utils/format-utils.js';
import { assertPublicNetworkUrl } from '../modules/security-utils.js';
import { parseNodeList } from '../modules/utils/node-parser.js';
import { encodeArrayBufferToBase64 } from '../modules/utils/node-cleaner.js';
import { isSuspiciousNodeCountDrop } from './node-cache-service.js';
import { applySubscriptionTransforms } from './subscription-node-transform.js';
import { KV_KEY_SETTINGS } from '../modules/config.js';

const DEFAULT_FETCH_TIMEOUT_MS = 18000;
const DEFAULT_REFRESH_LIMIT = 2;
const LAZY_INIT_RETRY_BACKOFF_MS = 5 * 60 * 1000;

/** 内部回填接口路径（只认 token，不走登录态） */
export const NODE_BACKFILL_PATH = '/api/internal/node-backfill';
export const NODE_BACKFILL_HEADER = 'x-misub-backfill-token';
/** 每批处理的订阅数：并发 4、单批控制在 Workers 30s 预算内 */
export const BACKFILL_BATCH_SIZE = 6;
const BACKFILL_MAX_CHAIN = 60;
const BACKFILL_RETRY_DELAY_MS = 2 * 60 * 1000;

const REAL_PROXY_PROTOCOLS = [
    'ss://',
    'ssr://',
    'vmess://',
    'vless://',
    'trojan://',
    'hysteria://',
    'hysteria2://',
    'hy2://',
    'tuic://',
    'anytls://',
    'socks5://',
    'socks://',
    'naive+https://',
    'naive+quic://',
    'wireguard://',
    'mierus://',
];

function isRealNodeUrl(value) {
    if (typeof value !== 'string') return false;
    const lower = value.trim().toLowerCase();
    if (!lower || /@127\.0\.0\.1(?::443)?(?:[/?#]|$)/i.test(lower)) return false;
    return REAL_PROXY_PROTOCOLS.some((prefix) => lower.startsWith(prefix));
}

function hashString(value) {
    let hash = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

export function buildNodeConfigFingerprint(sub = {}) {
    return hashString(
        JSON.stringify({
            url: String(sub.url || '').trim(),
            customUserAgent: String(sub.customUserAgent || '').trim(),
            fetchProxy: String(sub.fetchProxy || '').trim(),
            plusAsSpace: sub.plusAsSpace === true,
            exclude: String(sub.exclude || '').trim(),
            operators: Array.isArray(sub.operators) ? sub.operators : [],
            nodeTransform: sub.nodeTransform || null,
        })
    );
}

export function isNodePersistenceAvailable(env, settings = {}) {
    return Boolean(env?.MISUB_DB) && settings?.storageType === 'd1';
}

export function isNodePersistenceEnabled(env, settings = {}) {
    return isNodePersistenceAvailable(env, settings) && settings?.enableNodePersistence === true;
}

export function getNodePersistenceCapabilities(env, settings = {}) {
    return {
        hasD1: Boolean(env?.MISUB_DB),
        storageType: settings?.storageType || 'kv',
        available: isNodePersistenceAvailable(env, settings),
        enabled: isNodePersistenceEnabled(env, settings),
        autoUpdateInterval: Number(settings?.autoUpdateInterval) || 0,
    };
}

function parseUserInfoHeader(header) {
    if (!header || typeof header !== 'string') return null;
    const info = {};
    header.split(';').forEach((part) => {
        const [key, value] = part.trim().split('=');
        if (!key || value === undefined || value === '') return;
        info[key] = /^\d+$/.test(value) ? Number(value) : value;
    });
    return Object.keys(info).length > 0 ? info : null;
}

async function fetchRawNodesForSubscription(sub = {}) {
    const userAgent =
        (typeof sub.customUserAgent === 'string' && sub.customUserAgent.trim()) ||
        getProcessedUserAgent('MiSub-Node-Persistence/1.0', sub.url);
    let requestUrl = String(sub.url || '').trim();
    if (!/^https?:\/\//i.test(requestUrl)) {
        throw new Error('不是 HTTP(S) 订阅地址');
    }
    if (sub.fetchProxy && String(sub.fetchProxy).trim()) {
        requestUrl = buildFetchProxyUrl(sub.fetchProxy, requestUrl, userAgent);
    }
    requestUrl = assertPublicNetworkUrl(requestUrl).toString();

    const response = await fetchWithRetry(
        requestUrl,
        {
            headers: { 'User-Agent': userAgent },
            redirect: 'follow',
            signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
        },
        { maxRetries: 1 }
    );
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(buffer);
    let parsed = parseNodeList(text, { plusAsSpace: Boolean(sub.plusAsSpace) });
    if (parsed.length === 0) {
        const base64Fallback = encodeArrayBufferToBase64(buffer);
        parsed = parseNodeList(base64Fallback, { plusAsSpace: Boolean(sub.plusAsSpace) });
    }
    const nodes = parsed.map((node) => node?.url).filter(isRealNodeUrl);
    return {
        nodes,
        userInfo: parseUserInfoHeader(response.headers.get('subscription-userinfo')),
    };
}

const refreshLocks = new Map();

async function withRefreshLock(subscriptionId, task) {
    if (refreshLocks.has(subscriptionId)) return { skipped: true, reason: 'already-refreshing' };
    refreshLocks.set(subscriptionId, true);
    try {
        return await task();
    } finally {
        refreshLocks.delete(subscriptionId);
    }
}

function parseSnapshotRow(row, sub) {
    if (!row || row.state !== 'ready' || !row.nodes_json) return null;
    try {
        const nodes = JSON.parse(row.nodes_json);
        if (!Array.isArray(nodes) || nodes.length === 0) return null;
        return {
            nodes,
            nodeCount: Number(row.node_count) || nodes.length,
            userInfo: row.user_info_json ? JSON.parse(row.user_info_json) : null,
            lastSuccessAt: row.last_success_at || null,
            fingerprint: row.config_fingerprint,
            fingerprintMatches: row.config_fingerprint === buildNodeConfigFingerprint(sub),
        };
    } catch {
        return null;
    }
}

export async function getNodeSnapshotForOutput(env, sub = {}) {
    if (!env?.MISUB_DB || !sub?.id) return null;
    const store = StorageFactory.createNodeStore(env);
    if (!store) return null;
    return parseSnapshotRow(await store.getSnapshot(sub.id), sub);
}

/**
 * 输出链路入口：优先读快照；没有快照、或配置指纹变了，就拉一次并覆盖这一行。
 * 单次请求通过 context.lazyInitBudget 限制最多初始化几个机场。
 */
export async function ensureSnapshotForOutput(env, sub = {}, { reason = 'lazy-init' } = {}) {
    if (!env?.MISUB_DB || !sub?.id) return null;
    const store = StorageFactory.createNodeStore(env);
    if (!store) return null;

    const row = await store.getSnapshot(sub.id);
    const snapshot = parseSnapshotRow(row, sub);
    if (snapshot && snapshot.fingerprintMatches) return snapshot;
    // 配置变了：旧节点仍可先用，但必须重新拉一次覆盖
    if (!snapshot && row?.state === 'failed' && row?.last_attempt_at) {
        const lastAttempt = Date.parse(row.last_attempt_at);
        if (Number.isFinite(lastAttempt) && Date.now() - lastAttempt < LAZY_INIT_RETRY_BACKOFF_MS) {
            return null;
        }
    }

    const refreshed = await refreshSubscriptionSnapshot(env, sub, { reason });
    if (!refreshed.success) return snapshot;
    return {
        nodes: refreshed.nodes,
        nodeCount: refreshed.nodeCount,
        userInfo: refreshed.userInfo,
        lastSuccessAt: new Date().toISOString(),
        fingerprint: buildNodeConfigFingerprint(sub),
        fingerprintMatches: true,
    };
}

/**
 * 拉取一次机场并覆盖该订阅唯一的一行。
 * - 失败保留旧节点（不覆盖成空）；
 * - last_attempt_at 作为版本号，晚到的旧结果不会覆盖新结果。
 */
export async function refreshSubscriptionSnapshot(env, sub = {}, { reason = 'access' } = {}) {
    if (!env?.MISUB_DB || !sub?.id) return { success: false, error: 'D1 或订阅不存在' };
    const store = StorageFactory.createNodeStore(env);
    if (!store) return { success: false, error: 'D1 不可用' };

    const fingerprint = buildNodeConfigFingerprint(sub);
    const attemptAt = new Date().toISOString();

    return withRefreshLock(sub.id, async () => {
        const existing = await store.getSnapshot(sub.id);
        const previousCount = Number(existing?.node_count) || 0;

        try {
            const { nodes: rawNodes, userInfo } = await fetchRawNodesForSubscription(sub);

            // 机场订阅是唯一数据来源入口：入库前先按该订阅的设置做算子链 + include/exclude，
            // 库里存的就是用户设置后的结果，而不是原始垃圾节点。
            const settings = (await SettingsCache.get(env)) || {};
            let nodes = await applySubscriptionTransforms(rawNodes, sub, {
                userAgent: getProcessedUserAgent('MiSub-Node-Persistence/1.0', sub.url),
                config: settings,
            });
            nodes = nodes.filter(isRealNodeUrl);

            if (nodes.length === 0 && previousCount > 0) {
                throw new Error('上游返回空节点，保留旧快照');
            }
            if (isSuspiciousNodeCountDrop(previousCount, nodes.length)) {
                throw new Error(`节点数骤降保护：${previousCount} -> ${nodes.length}`);
            }
            const now = new Date().toISOString();
            await store.putSnapshot({
                subscriptionId: sub.id,
                configFingerprint: fingerprint,
                state: 'ready',
                // 传数组：超过单行容量时由存储层自动分片
                nodes,
                nodeCount: nodes.length,
                userInfoJson: userInfo ? JSON.stringify(userInfo) : null,
                lastSuccessAt: now,
                lastAttemptAt: attemptAt,
                lastError: null,
            });
            return {
                success: true,
                subscriptionId: sub.id,
                nodes,
                nodeCount: nodes.length,
                userInfo,
                reason,
            };
        } catch (error) {
            // 失败只更新元数据：已有节点（内联或分片）原样保留，
            // 同时记录尝试时间，5 分钟内不会重复打同一个机场。
            const lastError = error?.message || String(error);
            if (existing) {
                await store.markSnapshotFailure({
                    subscriptionId: sub.id,
                    configFingerprint: fingerprint,
                    state: previousCount > 0 ? 'ready' : 'failed',
                    lastAttemptAt: attemptAt,
                    lastError,
                });
            } else {
                await store.putSnapshot({
                    subscriptionId: sub.id,
                    configFingerprint: fingerprint,
                    state: 'failed',
                    nodes: [],
                    nodeCount: 0,
                    userInfoJson: null,
                    lastSuccessAt: null,
                    lastAttemptAt: attemptAt,
                    lastError,
                });
            }
            return { success: false, subscriptionId: sub.id, error: lastError, reason };
        }
    });
}

export async function decorateSubscriptionsWithSnapshots(env, subscriptions = []) {
    if (!env?.MISUB_DB || !Array.isArray(subscriptions) || subscriptions.length === 0) {
        return subscriptions;
    }
    const store = StorageFactory.createNodeStore(env);
    if (!store) return subscriptions;
    try {
        const rows = await store.listSnapshotsFor(subscriptions.map((item) => item?.id).filter(Boolean));
        const byId = new Map(rows.map((row) => [row.subscription_id, row]));
        return subscriptions.map((sub) => {
            if (!sub?.id) return sub;
            const row = byId.get(sub.id);
            if (!row || row.state !== 'ready') return sub;
            let userInfo = sub.userInfo || null;
            if (row.user_info_json) {
                try {
                    userInfo = JSON.parse(row.user_info_json);
                } catch {
                    userInfo = null;
                }
            }
            return {
                ...sub,
                nodeCount: Number(row.node_count) || sub.nodeCount || 0,
                userInfo,
                lastUpdate: row.last_success_at || sub.lastUpdate || null,
                nodePersistenceState: row.state,
            };
        });
    } catch (error) {
        console.warn('[NodePersistence] decorate subscriptions failed:', error?.message || error);
        return subscriptions;
    }
}

function isDueForRefresh(snapshotRow, intervalMinutes, now = Date.now()) {
    if (!snapshotRow || snapshotRow.state !== 'ready') return true;
    const intervalMs = Number(intervalMinutes) * 60 * 1000;
    if (!intervalMs) return false;
    const last = Date.parse(snapshotRow.last_success_at || '');
    return !Number.isFinite(last) || now - last >= intervalMs;
}

export async function maybeRefreshDueNodes(context, subscriptions = null, options = {}) {
    const env = context?.env || context;
    if (!env?.MISUB_DB) return { scheduled: 0, skipped: true, reason: 'no-d1' };
    const settings = context?.config || (await SettingsCache.get(env)) || {};
    if (!isNodePersistenceEnabled(env, settings)) {
        return { scheduled: 0, skipped: true, reason: 'node-persistence-disabled' };
    }

    let candidates = subscriptions;
    if (!Array.isArray(candidates)) {
        const storageAdapter = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));
        candidates =
            typeof storageAdapter.getAllSubscriptions === 'function'
                ? await storageAdapter.getAllSubscriptions()
                : [];
    }

    const intervalMinutes = Number(settings.autoUpdateInterval) || 0;
    const force = options.force === true;
    if (!force && intervalMinutes <= 0) {
        return { scheduled: 0, skipped: true, reason: 'interval-zero' };
    }

    const store = StorageFactory.createNodeStore(env);
    if (!store) return { scheduled: 0, skipped: true, reason: 'no-store' };
    const remoteSubs = candidates.filter(
        (sub) =>
            sub?.id &&
            sub.enabled !== false &&
            typeof sub.url === 'string' &&
            /^https?:\/\//i.test(sub.url) &&
            sub.autoUpdate !== false
    );
    if (remoteSubs.length === 0) return { scheduled: 0, skipped: true, reason: 'no-subscriptions' };

    let rows = [];
    try {
        rows = await store.listSnapshotsFor(remoteSubs.map((sub) => sub.id));
    } catch (error) {
        console.warn('[NodePersistence] list snapshots failed:', error?.message || error);
        return { scheduled: 0, skipped: true, reason: 'snapshot-list-failed' };
    }
    const rowMap = new Map(rows.map((row) => [row.subscription_id, row]));
    const dueSubs = remoteSubs.filter((sub) => {
        const row = rowMap.get(sub.id);
        if (row && row.state === 'ready' && !force && intervalMinutes <= 0) return false;
        if (row && row.config_fingerprint !== buildNodeConfigFingerprint(sub)) return true;
        return force || isDueForRefresh(row, intervalMinutes);
    });

    const limit = Math.max(1, Number(options.maxCount) || DEFAULT_REFRESH_LIMIT);
    const scheduledSubs = dueSubs.slice(0, limit);
    if (scheduledSubs.length === 0) return { scheduled: 0, skipped: true, reason: 'not-due' };

    const tasks = scheduledSubs.map((sub) =>
        refreshSubscriptionSnapshot(env, sub, { reason: options.reason || 'access' }).catch((error) => ({
            success: false,
            subscriptionId: sub.id,
            error: error?.message || String(error),
        }))
    );
    const batch = Promise.all(tasks);
    if (typeof context?.waitUntil === 'function' && !options.awaitRun) {
        context.waitUntil(batch);
        return { scheduled: scheduledSubs.length, async: true, reason: options.reason || 'access' };
    }
    const results = await batch;
    return { scheduled: scheduledSubs.length, results };
}

export async function maybeRefreshAllDueNodes(context, options = {}) {
    return maybeRefreshDueNodes(context, null, options);
}

export async function deleteNodeSnapshotsForSubscription(env, subscriptionId) {
    if (!env?.MISUB_DB || !subscriptionId) return false;
    const store = StorageFactory.createNodeStore(env);
    if (!store) return false;
    await store.deleteForSubscription(subscriptionId);
    return true;
}

/* ------------------------------------------------------------------ */
/* 全量回填（启用持久化时触发，等价一次 Cron；靠内部接口链推进）        */
/* ------------------------------------------------------------------ */

function createBackfillToken() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

function normalizeBackfillState(settings = {}) {
    const state = settings?.nodePersistenceBackfill;
    if (!state || typeof state !== 'object') return null;
    return {
        status: state.status === 'running' ? 'running' : 'done',
        token: String(state.token || ''),
        pendingIds: Array.isArray(state.pendingIds) ? state.pendingIds.filter(Boolean) : [],
        total: Number(state.total) || 0,
        chain: Number(state.chain) || 0,
        startedAt: state.startedAt || null,
        nextRunAt: state.nextRunAt || null,
    };
}

async function readSettingsForBackfill(env) {
    try {
        const storageAdapter = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));
        return (await storageAdapter.get(KV_KEY_SETTINGS)) || {};
    } catch {
        return {};
    }
}

async function writeBackfillState(env, settings, state) {
    const storageAdapter = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));
    const nextSettings = { ...settings, nodePersistenceBackfill: state };
    await storageAdapter.put(KV_KEY_SETTINGS, nextSettings);
    SettingsCache.clear();
    return nextSettings;
}

function collectRemoteSubscriptions(subscriptions = []) {
    return subscriptions.filter(
        (sub) =>
            sub?.id &&
            sub.enabled !== false &&
            typeof sub.url === 'string' &&
            /^https?:\/\//i.test(sub.url)
    );
}

/**
 * 启用（或关闭后重新启用）持久化时调用：创建全量回填任务并立即跑第一批。
 * 不关心 autoUpdateInterval，也不跳过 autoUpdate=false（这是初始化，不是自动刷新）。
 */
export async function startNodeBackfill(env, { requestUrl = '' } = {}) {
    if (!env?.MISUB_DB) return { started: false, reason: 'no-d1' };
    const settings = await readSettingsForBackfill(env);
    if (!isNodePersistenceEnabled(env, settings)) {
        return { started: false, reason: 'node-persistence-disabled' };
    }

    // 顺带确保快照表（含分片表 / chunk_count 列）已就绪，老库在这里完成迁移。
    try {
        await ensureD1Schema(env.MISUB_DB);
    } catch (error) {
        console.warn('[NodePersistence] ensure schema failed:', error?.message || error);
    }

    const storageAdapter = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));
    const subscriptions =
        typeof storageAdapter.getAllSubscriptions === 'function'
            ? await storageAdapter.getAllSubscriptions()
            : [];
    const targets = collectRemoteSubscriptions(subscriptions);
    const state = {
        status: targets.length > 0 ? 'running' : 'done',
        token: createBackfillToken(),
        pendingIds: targets.map((sub) => sub.id),
        total: targets.length,
        chain: 0,
        startedAt: new Date().toISOString(),
        nextRunAt: null,
    };
    await writeBackfillState(env, settings, state);
    return { started: true, total: targets.length, state, requestUrl };
}

/**
 * 跑一批；还有剩余就用内部接口自触发下一批（页面关掉也能继续）。
 */
export async function runNextBackfillBatch(env, { requestUrl = '', state: providedState = null } = {}) {
    if (!env?.MISUB_DB) return { ran: 0, done: true, reason: 'no-d1' };
    const settings = await readSettingsForBackfill(env);
    if (!isNodePersistenceEnabled(env, settings)) {
        return { ran: 0, done: true, reason: 'node-persistence-disabled' };
    }
    const state = providedState || normalizeBackfillState(settings);
    if (!state || state.status !== 'running') return { ran: 0, done: true, reason: 'idle' };
    if (state.chain >= BACKFILL_MAX_CHAIN) {
        await writeBackfillState(env, settings, { ...state, status: 'done' });
        return { ran: 0, done: true, reason: 'chain-limit' };
    }

    const storageAdapter = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));
    const subscriptions =
        typeof storageAdapter.getAllSubscriptions === 'function'
            ? await storageAdapter.getAllSubscriptions()
            : [];
    const byId = new Map(subscriptions.map((sub) => [sub.id, sub]));

    const batchIds = state.pendingIds.slice(0, BACKFILL_BATCH_SIZE);
    const batchSubs = batchIds.map((id) => byId.get(id)).filter(Boolean);
    const results = await Promise.all(
        batchSubs.map((sub) =>
            refreshSubscriptionSnapshot(env, sub, { reason: 'backfill' }).catch((error) => ({
                success: false,
                subscriptionId: sub.id,
                error: error?.message || String(error),
            }))
        )
    );

    const remaining = state.pendingIds.filter((id) => !batchIds.includes(id));
    const nextState = {
        ...state,
        pendingIds: remaining,
        status: remaining.length > 0 ? 'running' : 'done',
        chain: state.chain + 1,
        nextRunAt: null,
    };
    await writeBackfillState(env, settings, nextState);

    if (remaining.length > 0 && requestUrl) {
        // 必须 await：不 await 的 fetch 会随本次调用结束被取消，链路就断了。
        // 内部接口应用 waitUntil 异步处理并立即返回，所以这里 await 不会把整条链串行化。
        try {
            await triggerNextBackfillHop(requestUrl, state.token);
        } catch (error) {
            console.warn('[NodePersistence] backfill hop failed:', error?.message || error);
            await writeBackfillState(env, settings, {
                ...nextState,
                nextRunAt: new Date(Date.now() + BACKFILL_RETRY_DELAY_MS).toISOString(),
            });
        }
    }

    return { ran: batchSubs.length, done: remaining.length === 0, remaining: remaining.length, results };
}

function triggerNextBackfillHop(requestUrl, token) {
    if (!requestUrl || !token) return Promise.resolve();
    try {
        const url = new URL(NODE_BACKFILL_PATH, requestUrl);
        return fetch(url.toString(), {
            method: 'POST',
            headers: { [NODE_BACKFILL_HEADER]: token },
        }).then((response) => {
            if (!response.ok) {
                console.warn('[NodePersistence] backfill hop responded', response.status);
            }
            return response;
        });
    } catch (error) {
        return Promise.reject(error);
    }
}

/**
 * 任意后端请求命中时调用：把没跑完的全量回填继续往前推。
 * 页面关掉不影响：推进由内部接口链或 Cron 完成。
 */
export async function maybeContinueBackfill(context, { requestUrl = '' } = {}) {
    const env = context?.env || context;
    if (!env?.MISUB_DB) return { skipped: true, reason: 'no-d1' };
    const settings = context?.config || (await SettingsCache.get(env)) || {};
    if (!isNodePersistenceEnabled(env, settings)) {
        return { skipped: true, reason: 'node-persistence-disabled' };
    }
    const state = normalizeBackfillState(settings);
    if (!state || state.status !== 'running') return { skipped: true, reason: 'idle' };
    if (state.nextRunAt && Date.parse(state.nextRunAt) > Date.now()) {
        return { skipped: true, reason: 'backoff' };
    }

    const run = runNextBackfillBatch(env, { requestUrl, state });
    if (typeof context?.waitUntil === 'function') {
        context.waitUntil(run.catch(() => {}));
        return { skipped: false, async: true };
    }
    return run;
}

/** Cron 已经全量刷新过一轮：直接把回填任务标记完成 */
export async function completeNodeBackfill(env) {
    if (!env?.MISUB_DB) return false;
    const settings = await readSettingsForBackfill(env);
    const state = normalizeBackfillState(settings);
    if (!state || state.status !== 'running') return false;
    await writeBackfillState(env, settings, {
        ...state,
        status: 'done',
        pendingIds: [],
        nextRunAt: null,
    });
    return true;
}

/** 内部接口：校验 token 后推进一批 */
export async function handleInternalBackfillRequest(request, env, context = null) {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
    }
    const settings = await readSettingsForBackfill(env);
    const state = normalizeBackfillState(settings);
    const token = request.headers.get(NODE_BACKFILL_HEADER) || '';
    if (!state || !state.token || token !== state.token) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
    }
    const run = runNextBackfillBatch(env, { requestUrl: request.url, state });

    // 立即返回 202，让上一跳的 await 尽快结束；真正的批次在本实例的 waitUntil 里继续。
    if (typeof context?.waitUntil === 'function') {
        context.waitUntil(run.catch(() => {}));
        return new Response(JSON.stringify({ success: true, accepted: true }), {
            status: 202,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
    }

    const result = await run;
    return new Response(JSON.stringify({ success: true, ...result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
