/**
 * VPS Monitor handler
 * Public report endpoint + auth-only management APIs
 */

import { StorageFactory, STORAGE_TYPES } from '../../storage-adapter.js';
import { createJsonResponse, createErrorResponse, getPublicBaseUrl } from '../utils.js';
import { sendTgNotification } from '../notifications.js';
import { KV_KEY_SETTINGS, DEFAULT_SETTINGS } from '../config.js';

const REPORTS_MAX_KEEP = 5000;
const ALERTS_MAX_KEEP = 1000;
const PUBLIC_SNAPSHOT_CACHE_KEY = 'misub_vps_public_snapshot';
const PUBLIC_NODE_DETAIL_CACHE_KEY_PREFIX = 'misub_vps_public_node_detail:';
const PUBLIC_CACHE_TTL_SECONDS = 60;
const REPORT_PRUNE_CACHE_KEY = 'misub_vps_prune_last_ms';
const REPORT_PRUNE_INTERVAL_MS = 60 * 60 * 1000;

async function getStorageAdapter(env) {
    return StorageFactory.createAdapter(env, STORAGE_TYPES.D1);
}

function ensureD1Available(env) {
    if (!env?.MISUB_DB) {
        return createErrorResponse('VPS monitor requires D1 binding (MISUB_DB)', 400);
    }
    return null;
}

function ensureD1StorageMode(settings, env) {
    const rawType = normalizeString(settings?.storageType).toLowerCase();
    if (rawType && rawType !== STORAGE_TYPES.D1) {
        if (env?.MISUB_DB) {
            console.warn('[VPS Monitor] storageType is not d1, but D1 is available. Allowing access.');
            return null;
        }
        return createErrorResponse('VPS monitor requires storageType=d1', 400);
    }
    return null;
}

function getD1(env) {
    return env.MISUB_DB;
}

function getKv(env) {
    return StorageFactory.resolveKV(env);
}

async function readJsonCache(env, key) {
    const kv = getKv(env);
    if (!kv) return null;
    try {
        const raw = await kv.get(key);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (error) {
        console.warn('[VPS Monitor] KV cache read failed:', error?.message || error);
        return null;
    }
}

async function writeJsonCache(env, key, value, ttl = PUBLIC_CACHE_TTL_SECONDS) {
    const kv = getKv(env);
    if (!kv) return false;
    try {
        await kv.put(key, JSON.stringify(value), { expirationTtl: ttl });
        return true;
    } catch (error) {
        console.warn('[VPS Monitor] KV cache write failed:', error?.message || error);
        return false;
    }
}

async function deleteJsonCache(env, key) {
    const kv = getKv(env);
    if (!kv) return false;
    try {
        await kv.delete(key);
        return true;
    } catch (error) {
        console.warn('[VPS Monitor] KV cache delete failed:', error?.message || error);
        return false;
    }
}

async function invalidatePublicCaches(env, nodeId = null) {
    await deleteJsonCache(env, PUBLIC_SNAPSHOT_CACHE_KEY);
    if (nodeId) {
        await deleteJsonCache(env, PUBLIC_NODE_DETAIL_CACHE_KEY_PREFIX + nodeId);
    }
}

async function maybePruneReports(db, settings, env) {
    const kv = getKv(env);
    if (!kv) return;

    try {
        const lastPruneStr = await kv.get(REPORT_PRUNE_CACHE_KEY);
        const lastPruneMs = lastPruneStr ? Number(lastPruneStr) : 0;
        if (Number.isFinite(lastPruneMs) && (Date.now() - lastPruneMs) < REPORT_PRUNE_INTERVAL_MS) {
            return;
        }
    } catch (error) {
        console.warn('[VPS Monitor] report prune cache unavailable, skipping interval check');
    }

    try {
        await pruneAllReportsAndSamples(db, settings);
        await kv.put(REPORT_PRUNE_CACHE_KEY, String(Date.now()), { expirationTtl: Math.ceil(REPORT_PRUNE_INTERVAL_MS / 1000) });
    } catch (error) {
        console.warn('[VPS Monitor] report prune failed:', error?.message || error);
    }
}

function nowIso() {
    return new Date().toISOString();
}

function isoFromMs(ms) {
    return new Date(ms).toISOString();
}

function normalizeString(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function normalizeJsonString(value) {
    const raw = normalizeString(value);
    if (!raw) return '';
    try {
        return JSON.stringify(JSON.parse(raw));
    } catch {
        return raw;
    }
}

function clampNumber(value, min, max, fallback = null) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
}

function clampPositiveInt(value, min, max, fallback) {
    const num = Math.floor(Number(value));
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
}

function getClientIp(request) {
    return request.headers.get('CF-Connecting-IP')
        || request.headers.get('X-Forwarded-For')
        || request.headers.get('X-Real-IP')
        || '';
}

function safeJsonStringify(value) {
    try {
        return JSON.stringify(value);
    } catch {
        return '';
    }
}

async function computeSignature(secret, nodeId, timestamp, payloadCanonical) {
    const data = `${nodeId}.${timestamp}.${payloadCanonical}`;
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalizeReportTimestamp(rawValue, fallbackIso) {
    if (rawValue === null || rawValue === undefined) return fallbackIso;
    if (typeof rawValue === 'number') {
        const ts = rawValue > 1e12 ? rawValue : rawValue * 1000;
        return isoFromMs(ts);
    }
    if (typeof rawValue === 'string') {
        const trimmed = rawValue.trim();
        if (!trimmed) return fallbackIso;
        if (/^\d+$/.test(trimmed)) {
            const num = Number(trimmed);
            const ts = num > 1e12 ? num : num * 1000;
            return isoFromMs(ts);
        }
        const parsed = new Date(trimmed).getTime();
        if (Number.isFinite(parsed)) return isoFromMs(parsed);
    }
    return fallbackIso;
}

function isNodeOnline(lastSeenAt, thresholdMinutes) {
    if (!lastSeenAt) return false;
    const last = new Date(lastSeenAt).getTime();
    if (!Number.isFinite(last)) return false;
    const diffMs = Date.now() - last;
    return diffMs <= thresholdMinutes * 60 * 1000;
}

function buildSnapshot(report, node) {
    const cpuPercent = clampNumber(report.cpu?.usage, 0, 100, null);
    const memPercent = clampNumber(report.mem?.usage, 0, 100, null);
    const diskPercent = clampNumber(report.disk?.usage, 0, 100, null);

    return {
        at: nowIso(),
        status: node?.status || 'unknown',
        cpuPercent,
        memPercent,
        diskPercent,
        load1: clampNumber(report.load?.load1, 0, 1000, null),
        uptimeSec: clampNumber(report.uptimeSec, 0, 10 ** 9, null),
        traffic: report.traffic || null,
        network: report.network || null,
        ip: normalizeString(report.publicIp || report.ip || report.meta?.publicIp),
        receivedAt: report.receivedAt || report.createdAt || null
    };
}

function summarizeNode(node, latestReport, settings) {
    let status = node.status;
    const threshold = clampNumber(settings?.vpsMonitor?.offlineThresholdMinutes, 1, 1440, 10);
    if (node.lastSeenAt) {
        const lastSeen = new Date(node.lastSeenAt).getTime();
        if (Date.now() - lastSeen > threshold * 60 * 1000) {
            status = 'offline';
        }
    } else {
        status = 'offline';
    }

    const overloadInfo = latestReport ? computeOverload(latestReport, settings) : null;

    return {
        id: node.id,
        name: node.name,
        tag: node.tag,
        groupTag: node.groupTag || node.group_tag,
        region: node.region,
        countryCode: node.countryCode || node.country_code,
        description: node.description,
        status,
        enabled: Boolean(node.enabled),
        useGlobalTargets: Boolean(node.useGlobalTargets || node.use_global_targets),
        totalRx: node.totalRx || node.total_rx || 0,
        totalTx: node.totalTx || node.total_tx || 0,
        trafficLimitGb: node.trafficLimitGb || node.traffic_limit_gb || 0,
        lastSeenAt: node.lastSeenAt,
        updatedAt: node.updatedAt,
        latest: latestReport || null,
        overload: overloadInfo ? overloadInfo.overload : null
    };
}

function resolveSettings(config) {
    return { ...DEFAULT_SETTINGS, ...(config || {}) };
}

function resolvePublicThemePreset(settings) {
    const preset = normalizeString(settings?.vpsMonitor?.publicThemePreset).toLowerCase();
    const supported = new Set(['default', 'fresh', 'minimal', 'tech', 'glass']);
    // 兼容旧的 tech-dark 主题
    if (!supported.has(preset)) return preset === 'tech-dark' ? 'tech' : 'default';
    return preset;
}

function buildPublicThemeConfig(settings) {
    const raw = settings?.vpsMonitor || {};
    const validSections = new Set(['anomalies', 'nodes', 'featured', 'details']);
    const normalizedOrder = Array.isArray(raw.publicThemeSectionOrder)
        ? raw.publicThemeSectionOrder.filter(item => validSections.has(normalizeString(item)))
        : [];
    const sectionOrder = normalizedOrder.length
        ? normalizedOrder
        : DEFAULT_SETTINGS.vpsMonitor.publicThemeSectionOrder;
    return {
        preset: resolvePublicThemePreset(settings),
        title: normalizeString(raw.publicThemeTitle) || DEFAULT_SETTINGS.vpsMonitor.publicThemeTitle,
        subtitle: normalizeString(raw.publicThemeSubtitle) || DEFAULT_SETTINGS.vpsMonitor.publicThemeSubtitle,
        logo: normalizeString(raw.publicThemeLogo),
        backgroundImage: normalizeString(raw.publicThemeBackgroundImage),
        showStats: raw.publicThemeShowStats !== false,
        showAnomalies: raw.publicThemeShowAnomalies !== false,
        showFeatured: raw.publicThemeShowFeatured !== false,
        showDetailTable: raw.publicThemeShowDetailTable !== false,
        footerText: normalizeString(raw.publicThemeFooterText) || DEFAULT_SETTINGS.vpsMonitor.publicThemeFooterText,
        sectionOrder,
        customCss: normalizeString(raw.publicThemeCustomCss)
    };
}

async function loadVpsSettings(env) {
    await StorageFactory.ensureD1Settings(env);
    const storageAdapter = await getStorageAdapter(env);
    let rawSettings = await storageAdapter.get(KV_KEY_SETTINGS);
    if (!rawSettings) {
        const kvAdapter = StorageFactory.createAdapter(env, STORAGE_TYPES.KV);
        rawSettings = await kvAdapter.get(KV_KEY_SETTINGS);
    }
    return resolveSettings(rawSettings);
}

function shouldTriggerAlerts(settings) {
    return settings?.vpsMonitor?.alertsEnabled !== false;
}

function getAlertCooldownMs(settings) {
    const minutes = clampNumber(settings?.vpsMonitor?.alertCooldownMinutes, 1, 1440, 15);
    return minutes * 60 * 1000;
}

function shouldSkipCooldown(settings, alertType) {
    return alertType === 'recovery' && settings?.vpsMonitor?.cooldownIgnoreRecovery === true;
}

async function pushAlert(db, settings, alert) {
    if (!alert) return;
    const cooldownMs = getAlertCooldownMs(settings);

    if (!shouldSkipCooldown(settings, alert.type)) {
        const lastSame = await db.prepare(
            'SELECT created_at FROM vps_alerts WHERE node_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1'
        ).bind(alert.nodeId, alert.type).first();

        if (lastSame?.created_at) {
            const lastTs = new Date(lastSame.created_at).getTime();
            if (Number.isFinite(lastTs) && (Date.now() - lastTs) < cooldownMs) {
                return;
            }
        }
    }

    await db.prepare(
        'INSERT INTO vps_alerts (id, node_id, type, message, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(alert.id, alert.nodeId, alert.type, alert.message, alert.createdAt).run();

    await db.prepare(
        `DELETE FROM vps_alerts
         WHERE id NOT IN (
           SELECT id FROM vps_alerts ORDER BY created_at DESC LIMIT ${ALERTS_MAX_KEEP}
         )`
    ).run();

    if (shouldTriggerAlerts(settings)) {
        const message = alert.message;
        if (message) {
            await sendTgNotification(settings, message);
        }
    }
}

function buildAlertMessage(title, bodyLines) {
    const lines = Array.isArray(bodyLines) ? bodyLines : [];
    return `${title}\n\n${lines.filter(Boolean).join('\n')}`.trim();
}

function computeOverload(report, settings) {
    const cpuThreshold = clampNumber(settings?.vpsMonitor?.cpuWarnPercent, 1, 100, 90);
    const memThreshold = clampNumber(settings?.vpsMonitor?.memWarnPercent, 1, 100, 90);
    const diskThreshold = clampNumber(settings?.vpsMonitor?.diskWarnPercent, 1, 100, 90);

    const cpu = clampNumber(report.cpu?.usage ?? report.cpuPercent, 0, 100, null);
    const mem = clampNumber(report.mem?.usage ?? report.memPercent, 0, 100, null);
    const disk = clampNumber(report.disk?.usage ?? report.diskPercent, 0, 100, null);

    const overload = {
        cpu: cpu !== null && cpu >= cpuThreshold,
        mem: mem !== null && mem >= memThreshold,
        disk: disk !== null && disk >= diskThreshold
    };
    overload.any = overload.cpu || overload.mem || overload.disk;
    return { overload, thresholds: { cpuThreshold, memThreshold, diskThreshold }, values: { cpu, mem, disk } };
}

function clampPayloadUsage(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.min(100, Math.max(0, num));
}

function clampPayloadLoad(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.max(0, Math.min(1000, num));
}

function clampPayloadUptime(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return null;
    return Math.min(10 ** 9, num);
}

function buildNetworkCheckKey(item) {
    const type = normalizeString(item?.type).toLowerCase();
    const target = normalizeString(item?.target).toLowerCase();
    const scheme = type === 'http' ? normalizeString(item?.scheme || 'https').toLowerCase() : '';
    const rawPort = item?.port;
    const portNumber = rawPort === null || rawPort === undefined || rawPort === '' ? null : Number(rawPort);
    const port = Number.isFinite(portNumber) ? String(portNumber) : '';
    const path = type === 'http' ? normalizeString(item?.path || '/') : '';
    return `${type}|${target}|${scheme}|${port}|${path}`;
}

function rehydrateCheckNames(checks, targets) {
    if (!Array.isArray(checks) || !Array.isArray(targets)) return checks;
    const exactNameMap = new Map();
    const fallbackNameMap = new Map();

    targets.forEach(target => {
        const name = normalizeString(target?.name);
        const normalizedTarget = normalizeString(target?.target).toLowerCase();
        if (!name || !normalizedTarget) return;
        exactNameMap.set(buildNetworkCheckKey(target), name);
        if (!fallbackNameMap.has(normalizedTarget)) {
            fallbackNameMap.set(normalizedTarget, name);
        }
    });

    return checks.map(check => {
        if (check?.name || !check?.target) return check;
        const exactName = exactNameMap.get(buildNetworkCheckKey(check));
        if (exactName) {
            return { ...check, name: exactName };
        }
        const fallbackName = fallbackNameMap.get(normalizeString(check.target).toLowerCase());
        return fallbackName ? { ...check, name: fallbackName } : check;
    });
}

function sanitizeNetworkChecks(checks) {
    if (!Array.isArray(checks)) return [];
    return checks.map((item) => {
        const type = normalizeString(item?.type).toLowerCase();
        if (!['icmp', 'tcp', 'http'].includes(type)) return null;
        const target = normalizeString(item?.target);
        if (!target) return null;
        const name = normalizeString(item?.name || '');
        const status = normalizeString(item?.status) || 'unknown';
        const latencyMs = clampNumber(item?.latencyMs, 0, 60 * 1000, null);
        const lossPercent = clampNumber(item?.lossPercent, 0, 100, null);
        const httpCode = clampNumber(item?.httpCode, 0, 999, null);
        const scheme = normalizeString(item?.scheme || 'https');
        const port = item?.port !== undefined && item?.port !== null ? Number(item.port) : null;
        const path = normalizeString(item?.path || '/');
        const dnsMs = clampNumber(item?.dnsMs, 0, 60 * 1000, null);
        const connectMs = clampNumber(item?.connectMs, 0, 60 * 1000, null);
        const tlsMs = clampNumber(item?.tlsMs, 0, 60 * 1000, null);
        const checkedAt = normalizeReportTimestamp(item?.checkedAt, null);
        return {
            type,
            target,
            name,
            status,
            latencyMs,
            lossPercent,
            httpCode,
            scheme,
            port: Number.isFinite(port) ? port : null,
            path,
            dnsMs,
            connectMs,
            tlsMs,
            checkedAt
        };
    }).filter(Boolean);
}

function computeOverloadState(previous, overloadInfo) {
    const state = {
        count: clampPositiveInt(previous?.count, 0, 10000, 0),
        lastAt: normalizeString(previous?.lastAt || ''),
        lastSignature: normalizeString(previous?.lastSignature || '')
    };
    if (overloadInfo?.overload?.any) {
        state.count += 1;
        state.lastAt = nowIso();
    } else {
        state.count = 0;
    }
    const signature = `${overloadInfo?.values?.cpu ?? ''}|${overloadInfo?.values?.mem ?? ''}|${overloadInfo?.values?.disk ?? ''}`;
    state.lastSignature = signature;
    return state;
}

function shouldTriggerOverload(settings, state, overloadInfo) {
    if (!overloadInfo?.overload?.any) return false;
    const threshold = clampPositiveInt(settings?.vpsMonitor?.overloadConfirmCount, 1, 10, 2);
    if (state.count < threshold) return false;
    const signature = `${overloadInfo?.values?.cpu ?? ''}|${overloadInfo?.values?.mem ?? ''}|${overloadInfo?.values?.disk ?? ''}`;
    if (signature && signature === state.lastSignature && state.count > threshold) {
        return false;
    }
    return true;
}

async function updateNodeStatus(db, settings, node, report) {
    const threshold = clampNumber(settings?.vpsMonitor?.offlineThresholdMinutes, 1, 1440, 10);
    const wasOnline = node.status === 'online';
    node.lastSeenAt = normalizeString(report.reportedAt || report.createdAt || nowIso()) || nowIso();
    const nowOnline = isNodeOnline(node.lastSeenAt, threshold);
    node.status = nowOnline ? 'online' : 'offline';

    if (wasOnline && !nowOnline && settings?.vpsMonitor?.notifyOffline !== false) {
        await pushAlert(db, settings, {
            id: crypto.randomUUID(),
            nodeId: node.id,
            type: 'offline',
            createdAt: nowIso(),
            message: buildAlertMessage('❌ VPS 离线', [
                `*节点:* ${node.name || node.id}`,
                node.tag ? `*标签:* ${node.tag}` : '',
                node.region ? `*地区:* ${node.region}` : '',
                `*时间:* ${new Date().toLocaleString('zh-CN')}`
            ])
        });
    }

    if (!wasOnline && nowOnline && settings?.vpsMonitor?.notifyRecovery !== false) {
        await pushAlert(db, settings, {
            id: crypto.randomUUID(),
            nodeId: node.id,
            type: 'recovery',
            createdAt: nowIso(),
            message: buildAlertMessage('✅ VPS 恢复在线', [
                `*节点:* ${node.name || node.id}`,
                node.tag ? `*标签:* ${node.tag}` : '',
                node.region ? `*地区:* ${node.region}` : '',
                `*时间:* ${new Date().toLocaleString('zh-CN')}`
            ])
        });
    }

    const overloadInfo = computeOverload(report, settings);
    const overloadState = computeOverloadState(node.overloadState, overloadInfo);
    node.overloadState = overloadState;
    if (shouldTriggerOverload(settings, overloadState, overloadInfo) && settings?.vpsMonitor?.notifyOverload !== false) {
        const flags = [];
        if (overloadInfo.overload.cpu) flags.push(`CPU ${overloadInfo.values.cpu}%`);
        if (overloadInfo.overload.mem) flags.push(`内存 ${overloadInfo.values.mem}%`);
        if (overloadInfo.overload.disk) flags.push(`磁盘 ${overloadInfo.values.disk}%`);

        await pushAlert(db, settings, {
            id: crypto.randomUUID(),
            nodeId: node.id,
            type: 'overload',
            createdAt: nowIso(),
            message: buildAlertMessage('⚠️ VPS 负载告警', [
                `*节点:* ${node.name || node.id}`,
                `*指标:* ${flags.join(' / ')}`,
                `*阈值:* CPU ${overloadInfo.thresholds.cpuThreshold}% / 内存 ${overloadInfo.thresholds.memThreshold}% / 磁盘 ${overloadInfo.thresholds.diskThreshold}%`,
                `*时间:* ${new Date().toLocaleString('zh-CN')}`
            ])
        });
    }
}

/**
 * Global heartbeat check for all nodes.
 * Used for "ride-along" detection when any node reports.
 * Uses KV cache to avoid scanning on every report.
 */
async function checkAllNodesHeartbeat(db, settings, env) {
    const lastCheckKey = 'vps_heartbeat_last_check_ms';
    const minIntervalMs = 60_000; // 至少 1 分钟检查一次

    try {
        const kv = env.MISUB_KV;
        if (kv) {
            const lastCheckStr = await kv.get(lastCheckKey);
            const lastCheck = lastCheckStr ? parseInt(lastCheckStr, 10) : 0;
            if (Number.isFinite(lastCheck) && (Date.now() - lastCheck) < minIntervalMs) {
                return;
            }
        }
    } catch (e) {
        console.warn('[VPS Monitor] KV heartbeat cache unavailable, falling through');
    }

    const threshold = clampNumber(settings?.vpsMonitor?.offlineThresholdMinutes, 1, 1440, 10);
    const cutoff = new Date(Date.now() - threshold * 60 * 1000).toISOString();

    // Find online nodes that haven't been seen since the cutoff
    const staleNodesResult = await db.prepare(
        "SELECT * FROM vps_nodes WHERE status = 'online' AND (last_seen_at < ? OR last_seen_at IS NULL) AND enabled = 1"
    ).bind(cutoff).all();

    const staleNodes = staleNodesResult?.results || [];
    if (!staleNodes.length) {
        // Cache the check even when no stale nodes
        try {
            const kv = env.MISUB_KV;
            if (kv) await kv.put(lastCheckKey, String(Date.now()), { expirationTtl: 300 });
        } catch (e) { /* ignore */ }
        return;
    }

    console.info(`[VPS Monitor] Detected ${staleNodes.length} stale nodes. Updating to offline.`);

    for (const row of staleNodes) {
        const node = mapNodeRow(row);
        node.status = 'offline';
        node.updatedAt = nowIso();

        if (settings?.vpsMonitor?.notifyOffline !== false) {
            await pushAlert(db, settings, {
                id: crypto.randomUUID(),
                nodeId: node.id,
                type: 'offline',
                createdAt: nowIso(),
                message: buildAlertMessage('❌ VPS 离线 (心跳超时)', [
                    `*节点:* ${node.name || node.id}`,
                    node.tag ? `*标签:* ${node.tag}` : '',
                    node.region ? `*地区:* ${node.region}` : '',
                    node.lastSeenAt ? `*最后见于:* ${new Date(node.lastSeenAt).toLocaleString('zh-CN')}` : '',
                    `*状态:* 探测任务未在预期时间内（${threshold} 分钟）收到心跳`
                ])
            });
        }
        await updateNode(db, node);
    }

    // Cache the check timestamp
    try {
        const kv = env.MISUB_KV;
        if (kv) await kv.put(lastCheckKey, String(Date.now()), { expirationTtl: 300 });
    } catch (e) { /* ignore */ }
}

function getReportRetentionCutoff(settings) {
    const days = clampNumber(settings?.vpsMonitor?.reportRetentionDays, 1, 180, 30);
    return Date.now() - days * 24 * 60 * 60 * 1000;
}

function mapNodeRow(row) {
    return {
        id: row.id,
        name: row.name,
        tag: row.tag,
        groupTag: row.group_tag,
        region: row.region,
        countryCode: row.country_code,
        description: row.description,
        secret: row.secret,
        status: row.status,
        enabled: row.enabled === 1,
        useGlobalTargets: row.use_global_targets === 1,
        totalRx: Number(row.total_rx || 0),
        totalTx: Number(row.total_tx || 0),
        trafficLimitGb: Number(row.traffic_limit_gb || 0),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastSeenAt: row.last_seen_at,
        lastReport: row.last_report_json ? JSON.parse(row.last_report_json) : null,
        overloadState: row.overload_state_json ? JSON.parse(row.overload_state_json) : null
    };
}

async function fetchNodes(db) {
    const result = await db.prepare('SELECT * FROM vps_nodes ORDER BY created_at DESC').all();
    return (result.results || []).map(mapNodeRow);
}

async function fetchNode(db, nodeId) {
    const row = await db.prepare('SELECT * FROM vps_nodes WHERE id = ?').bind(nodeId).first();
    return row ? mapNodeRow(row) : null;
}

async function insertNode(db, node) {
    try {
        await db.prepare(
            `INSERT INTO vps_nodes
             (id, name, tag, group_tag, region, country_code, description, secret, status, enabled, use_global_targets, total_rx, total_tx, traffic_limit_gb, created_at, updated_at, last_seen_at, last_report_json, overload_state_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            node.id,
            node.name,
            node.tag,
            node.groupTag,
            node.region,
            node.countryCode,
            node.description,
            node.secret,
            node.status,
            node.enabled ? 1 : 0,
            node.useGlobalTargets ? 1 : 0,
            node.totalRx || 0,
            node.totalTx || 0,
            node.trafficLimitGb || 0,
            node.createdAt,
            node.updatedAt,
            node.lastSeenAt,
            node.lastReport ? JSON.stringify(node.lastReport) : null,
            node.overloadState ? JSON.stringify(node.overloadState) : null
        ).run();
    } catch (error) {
        const message = error?.message || '';
        if (!message.includes('no column named overload_state_json') && !message.includes('no column named use_global_targets')) {
            throw error;
        }
        await db.prepare(
            `INSERT INTO vps_nodes
             (id, name, tag, region, description, secret, status, enabled, created_at, updated_at, last_seen_at, last_report_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            node.id,
            node.name,
            node.tag,
            node.region,
            node.description,
            node.secret,
            node.status,
            node.enabled ? 1 : 0,
            node.createdAt,
            node.updatedAt,
            node.lastSeenAt,
            node.lastReport ? JSON.stringify(node.lastReport) : null
        ).run();
    }
}

async function updateNode(db, node) {
    try {
        await db.prepare(
            `UPDATE vps_nodes
             SET name = ?, tag = ?, group_tag = ?, region = ?, country_code = ?, description = ?, secret = ?, status = ?, enabled = ?,
                 use_global_targets = ?, total_rx = ?, total_tx = ?, traffic_limit_gb = ?, updated_at = ?, last_seen_at = ?, last_report_json = ?, overload_state_json = ?
             WHERE id = ?`
        ).bind(
            node.name,
            node.tag,
            node.groupTag,
            node.region,
            node.countryCode,
            node.description,
            node.secret,
            node.status,
            node.enabled ? 1 : 0,
            node.useGlobalTargets ? 1 : 0,
            node.totalRx || 0,
            node.totalTx || 0,
            node.trafficLimitGb || 0,
            node.updatedAt,
            node.lastSeenAt,
            node.lastReport ? JSON.stringify(node.lastReport) : null,
            node.overloadState ? JSON.stringify(node.overloadState) : null,
            node.id
        ).run();
    } catch (error) {
        const message = error?.message || '';
        if (!message.includes('no column named overload_state_json') && !message.includes('no column named use_global_targets')) {
            throw error;
        }
        await db.prepare(
            `UPDATE vps_nodes
             SET name = ?, tag = ?, region = ?, description = ?, secret = ?, status = ?, enabled = ?,
                 updated_at = ?, last_seen_at = ?, last_report_json = ?
             WHERE id = ?`
        ).bind(
            node.name,
            node.tag,
            node.region,
            node.description,
            node.secret,
            node.status,
            node.enabled ? 1 : 0,
            node.updatedAt,
            node.lastSeenAt,
            node.lastReport ? JSON.stringify(node.lastReport) : null,
            node.id
        ).run();
    }
}

async function updateNodeIncremental(db, nodeId, fields) {
    const setClauses = [];
    const bindings = [];
    for (const [col, value] of Object.entries(fields)) {
        setClauses.push(`${col} = ?`);
        bindings.push(value);
    }
    if (!setClauses.length) return;
    bindings.push(nodeId);
    try {
        await db.prepare(`UPDATE vps_nodes SET ${setClauses.join(', ')} WHERE id = ?`).bind(...bindings).run();
    } catch (error) {
        const message = error?.message || '';
        if (!message.includes('no column named overload_state_json') && !message.includes('no column named use_global_targets') && !message.includes('no column named country_code')) {
            throw error;
        }
        // Fallback: try without newer columns
        const fallbackFields = {};
        for (const [col, value] of Object.entries(fields)) {
            if (!['overload_state_json', 'use_global_targets', 'country_code'].includes(col)) {
                fallbackFields[col] = value;
            }
        }
        if (Object.keys(fallbackFields).length) {
            await updateNodeIncremental(db, nodeId, fallbackFields);
        }
    }
}

async function deleteNode(db, nodeId) {
    await db.prepare('DELETE FROM vps_nodes WHERE id = ?').bind(nodeId).run();
    await db.prepare('DELETE FROM vps_reports WHERE node_id = ?').bind(nodeId).run();
    await db.prepare('DELETE FROM vps_alerts WHERE node_id = ?').bind(nodeId).run();
}

async function insertReport(db, report) {
    await db.prepare(
        'INSERT INTO vps_reports (id, node_id, reported_at, created_at, data) VALUES (?, ?, ?, ?, ?)'
    ).bind(report.id, report.nodeId, report.reportedAt, report.createdAt, JSON.stringify(report)).run();
}

async function pruneReports(db, settings) {
    const cutoff = new Date(getReportRetentionCutoff(settings)).toISOString();
    await db.prepare('DELETE FROM vps_reports WHERE reported_at < ?').bind(cutoff).run();
}

async function pruneAlerts(db) {
    await db.prepare(
        'DELETE FROM vps_alerts WHERE id NOT IN (SELECT id FROM vps_alerts ORDER BY created_at DESC LIMIT ?)'
    ).bind(ALERTS_MAX_KEEP).run();
}

async function fetchReportsForNode(db, nodeId, settings) {
    const cutoff = new Date(getReportRetentionCutoff(settings)).toISOString();
    const result = await db.prepare(
        'SELECT data FROM vps_reports WHERE node_id = ? AND reported_at >= ? ORDER BY reported_at DESC LIMIT ?'
    ).bind(nodeId, cutoff, REPORTS_MAX_KEEP).all();
    return (result.results || []).map(row => JSON.parse(row.data)).reverse();
}

async function fetchNetworkSamples(db, nodeId, settings) {
    const cutoff = new Date(getReportRetentionCutoff(settings)).toISOString();
    const result = await db.prepare(
        'SELECT data FROM vps_network_samples WHERE node_id = ? AND reported_at >= ? ORDER BY reported_at DESC LIMIT ?'
    ).bind(nodeId, cutoff, REPORTS_MAX_KEEP).all();
    return (result.results || []).map(row => JSON.parse(row.data)).reverse();
}

async function insertNetworkSample(db, sample) {
    await db.prepare(
        'INSERT INTO vps_network_samples (id, node_id, reported_at, created_at, data) VALUES (?, ?, ?, ?, ?)'
    ).bind(sample.id, sample.nodeId, sample.reportedAt, sample.createdAt, JSON.stringify(sample)).run();
}

async function pruneNetworkSamples(db, settings) {
    const cutoff = new Date(getReportRetentionCutoff(settings)).toISOString();
    await db.prepare('DELETE FROM vps_network_samples WHERE reported_at < ?').bind(cutoff).run();
}

async function pruneAllReportsAndSamples(db, settings) {
    const cutoff = new Date(getReportRetentionCutoff(settings)).toISOString();
    await db.batch([
        db.prepare('DELETE FROM vps_reports WHERE reported_at < ?').bind(cutoff),
        db.prepare('DELETE FROM vps_network_samples WHERE reported_at < ?').bind(cutoff),
    ]);
    await pruneAlerts(db);
}

async function fetchNetworkTargets(db, nodeId) {
    const result = await db.prepare('SELECT * FROM vps_network_targets WHERE node_id = ? ORDER BY created_at DESC').bind(nodeId).all();
    return (result.results || []).map(row => ({
        id: row.id,
        nodeId: row.node_id,
        type: row.type,
        target: row.target,
        name: row.name || '',
        scheme: row.scheme || 'https',
        port: row.port,
        path: row.path,
        forceCheckAt: row.force_check_at,
        enabled: row.enabled === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }));
}

async function fetchGlobalNetworkTargets(db) {
    const result = await db.prepare('SELECT * FROM vps_network_targets WHERE node_id = ? ORDER BY created_at DESC').bind('global').all();
    return (result.results || []).map(row => ({
        id: row.id,
        nodeId: row.node_id,
        type: row.type,
        target: row.target,
        name: row.name || '',
        scheme: row.scheme || 'https',
        port: row.port,
        path: row.path,
        forceCheckAt: row.force_check_at,
        enabled: row.enabled === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }));
}

async function insertNetworkTarget(db, nodeId, payload) {
    const target = {
        id: crypto.randomUUID(),
        nodeId,
        type: normalizeString(payload.type).toLowerCase(),
        target: normalizeString(payload.target),
        name: normalizeString(payload.name || ''),
        scheme: normalizeString(payload.scheme || 'https'),
        port: payload.port ? Number(payload.port) : null,
        path: normalizeString(payload.path),
        enabled: payload.enabled !== false,
        forceCheckAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso()
    };
    try {
        await db.prepare(
            `INSERT INTO vps_network_targets
             (id, node_id, type, target, name, scheme, port, path, enabled, force_check_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            target.id,
            target.nodeId,
            target.type,
            target.target,
            target.name,
            target.scheme,
            target.port,
            target.path,
            target.enabled ? 1 : 0,
            null,
            target.createdAt,
            target.updatedAt
        ).run();
    } catch (error) {
        const message = error?.message || '';
        if (!message.includes('no column named scheme') && !message.includes('no column named force_check_at') && !message.includes('no column named name')) {
            throw error;
        }
        await db.prepare(
            `INSERT INTO vps_network_targets
             (id, node_id, type, target, port, path, enabled, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            target.id,
            target.nodeId,
            target.type,
            target.target,
            target.port,
            target.path,
            target.enabled ? 1 : 0,
            target.createdAt,
            target.updatedAt
        ).run();
    }
    return target;
}

async function updateNetworkTarget(db, targetId, payload) {
    const existing = await db.prepare('SELECT * FROM vps_network_targets WHERE id = ?').bind(targetId).first();
    if (!existing) return null;
    const updated = {
        id: existing.id,
        nodeId: existing.node_id,
        type: payload.type !== undefined ? normalizeString(payload.type).toLowerCase() : existing.type,
        target: payload.target !== undefined ? normalizeString(payload.target) : existing.target,
        name: payload.name !== undefined ? normalizeString(payload.name) : (existing.name || ''),
        scheme: payload.scheme !== undefined ? normalizeString(payload.scheme || 'https') : existing.scheme || 'https',
        port: payload.port !== undefined ? Number(payload.port) : existing.port,
        path: payload.path !== undefined ? normalizeString(payload.path) : existing.path,
        enabled: typeof payload.enabled === 'boolean' ? payload.enabled : existing.enabled === 1,
        forceCheckAt: payload.forceCheckAt !== undefined ? payload.forceCheckAt : existing.force_check_at,
        updatedAt: nowIso()
    };
    try {
        await db.prepare(
            `UPDATE vps_network_targets
             SET type = ?, target = ?, name = ?, scheme = ?, port = ?, path = ?, enabled = ?, force_check_at = ?, updated_at = ?
             WHERE id = ?`
        ).bind(
            updated.type,
            updated.target,
            updated.name,
            updated.scheme,
            updated.port,
            updated.path,
            updated.enabled ? 1 : 0,
            updated.forceCheckAt,
            updated.updatedAt,
            updated.id
        ).run();
    } catch (error) {
        const message = error?.message || '';
        if (!message.includes('no column named scheme') && !message.includes('no column named force_check_at') && !message.includes('no column named name')) {
            throw error;
        }
        await db.prepare(
            `UPDATE vps_network_targets
             SET type = ?, target = ?, port = ?, path = ?, enabled = ?, updated_at = ?
             WHERE id = ?`
        ).bind(
            updated.type,
            updated.target,
            updated.port,
            updated.path,
            updated.enabled ? 1 : 0,
            updated.updatedAt,
            updated.id
        ).run();
    }
    return updated;
}

async function deleteNetworkTarget(db, targetId) {
    await db.prepare('DELETE FROM vps_network_targets WHERE id = ?').bind(targetId).run();
}

function validateNetworkTarget(payload) {
    const type = normalizeString(payload.type).toLowerCase();
    const target = normalizeString(payload.target);
    if (!['icmp', 'tcp', 'http'].includes(type)) {
        return '类型仅支持 icmp/tcp/http';
    }
    if (!target) {
        return '目标不能为空';
    }
    if (type === 'tcp') {
        const port = Number(payload.port);
        if (!Number.isFinite(port) || port <= 0 || port > 65535) {
            return 'TCP 端口无效';
        }
    }
    if (type === 'http') {
        const path = normalizeString(payload.path || '/');
        if (!path.startsWith('/')) {
            return 'HTTP 路径必须以 / 开头';
        }
        const scheme = normalizeString(payload.scheme || 'https');
        if (!['http', 'https'].includes(scheme)) {
            return 'HTTP 协议仅支持 http/https';
        }
    }
    return null;
}

function buildInstallScript(reportUrl, node) {
    return [
        '#!/usr/bin/env bash',
        '',
        'set -euo pipefail',
        '',
        `REPORT_URL="${reportUrl}"`,
        `NODE_ID="${node.id}"`,
        `NODE_SECRET="${node.secret}"`,
        `CONFIG_URL="${reportUrl.replace('/api/vps/report', '/api/vps/config')}?nodeId=${node.id}&secret=${node.secret}&format=env"`,
        '',
        "cat > /usr/local/bin/misub-vps-probe.sh <<'EOF'",
        '#!/usr/bin/env bash',
        'set -euo pipefail',
        '',
        'for cmd in curl awk free df top hostname uname ping timeout; do',
        '  if ! command -v "$cmd" >/dev/null 2>&1; then',
        '    echo "[misub-probe] missing command: $cmd" >&2',
        '    exit 1',
        '  fi',
        'done',
        '',
        'HAS_SOCKETS=1',
        'if [ ! -e /dev/tcp/127.0.0.1/80 ] 2>/dev/null; then',
        '  HAS_SOCKETS=0',
        'fi',
        '',
        `REPORT_URL="${reportUrl}"`,
        `NODE_ID="${node.id}"`,
        `NODE_SECRET="${node.secret}"`,
        `CONFIG_URL="${reportUrl.replace('/api/vps/report', '/api/vps/config')}?nodeId=${node.id}&secret=${node.secret}&format=env"`,
        '',
        'HOSTNAME="$(hostname)"',
        'OS="$(. /etc/os-release && echo "$PRETTY_NAME" || uname -s)"',
        'ARCH="$(uname -m)"',
        'KERNEL="$(uname -r)"',
        "UPTIME_SEC=\"$(awk '{print int($1)}' /proc/uptime)\"",
        '',
        'cpu_usage() {',
        '  if command -v mpstat >/dev/null 2>&1; then',
        '    mpstat 1 2 | awk "/Average/ {printf \"%.0f\", 100-$NF}"',
        '    return',
        '  fi',
        '  local idle1 total1 idle2 total2',
        '  read -r idle1 total1 <<<"$(awk \'/^cpu /{idle=$5; total=0; for(i=2;i<=11;i++) total+=$i; print idle, total}\' /proc/stat)"',
        '  sleep 2',
        '  read -r idle2 total2 <<<"$(awk \'/^cpu /{idle=$5; total=0; for(i=2;i<=11;i++) total+=$i; print idle, total}\' /proc/stat)"',
        '  local total_diff=$((total2-total1))',
        '  local idle_diff=$((idle2-idle1))',
        '  if [ "$total_diff" -le 0 ]; then',
        '    echo 0',
        '  else',
        '    awk -v t="$total_diff" -v i="$idle_diff" \'BEGIN{printf "%.0f", (100*(t-i))/t}\'',
        '  fi',
        '}',
        'CPU_USAGE="$(cpu_usage)"',
        "MEM_USAGE=\"$(free | awk '/Mem/ {printf \"%.0f\", $3/$2*100}')\"",
        "DISK_USAGE=\"$(df -P / | awk 'NR==2 {gsub(/%/,\"\"); print $5}')\"",
        "LOAD1=\"$(awk '{print $1}' /proc/loadavg)\"",
        "TRAFFIC_JSON=\"$(cat /proc/net/dev | awk 'NR>2 && $1 != \"lo:\" {rx += $2; tx += $10} END {printf \"{\\\"rx\\\": %d, \\\"tx\\\": %d}\", rx, tx}')\"",
        '',
        'REPORT_INTERVAL=60',
        'REPORT_STORE_INTERVAL=60',
        'NETWORK_INTERVAL=300',
        'TARGETS=()',
        'if CONFIG_ENV=$(curl -fsSL "$CONFIG_URL" 2>/dev/null); then',
        '  while IFS= read -r line; do',
        '    case "$line" in',
        '      REPORT_INTERVAL=*) REPORT_INTERVAL=$((${line#*=} * 60)) ;;',
        '      REPORT_STORE_INTERVAL=*) REPORT_STORE_INTERVAL=$((${line#*=} * 60)) ;;',
        '      NETWORK_INTERVAL=*) NETWORK_INTERVAL=$((${line#*=} * 60)) ;;',
        '      TARGET=*) TARGETS+=("${line#*=}") ;;',
        '    esac',
        '  done <<< "$CONFIG_ENV"',
        'fi',
        '',
        'NETWORK_STATE="/var/tmp/misub-vps-network.ts"',
        'REPORT_STATE="/var/tmp/misub-vps-report.ts"',
        'REPORT_STORE_STATE="/var/tmp/misub-vps-report-store.ts"',
        'NETWORK_JSON="null"',
        'now_ts=$(date +%s)',
        'last_ts=0',
        'if [ -f "$NETWORK_STATE" ]; then last_ts=$(cat "$NETWORK_STATE" || echo 0); fi',
        'if [ $((now_ts-last_ts)) -ge "$NETWORK_INTERVAL" ]; then',
        '  checks=()',
        '  for item in "${TARGETS[@]}"; do',
        '    IFS="|" read -r ttype ttarget tscheme tport tpath tenabled tforce tname <<< "$item"',
        '    if [ "${tenabled:-1}" = "0" ]; then continue; fi',
        '    checked_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)',
        '    if [ "$ttype" = "icmp" ]; then',
        '      ping_out=$(ping -c 3 -w 4 "$ttarget" 2>/dev/null || true)',
        '      loss=$(echo "$ping_out" | awk -F", " \'/packet loss/ {print $3}\' | awk \'{gsub(/%/," "); print $1}\')',
        '      avg=$(echo "$ping_out" | awk -F"/" \'/rtt/ {print $5}\')',
        '      if [ -z "$avg" ]; then status="down"; avg=null; else status="up"; fi',
        '      checks+=("{\\\"type\\\":\\\"icmp\\\",\\\"target\\\":\\\"$ttarget\\\",\\\"name\\\":\\\"$tname\\\",\\\"status\\\":\\\"$status\\\",\\\"latencyMs\\\":${avg:-null},\\\"lossPercent\\\":${loss:-null},\\\"checkedAt\\\":\\\"$checked_at\\\"}")',
        '    elif [ "$ttype" = "tcp" ]; then',
        '      start=$(date +%s%3N)',
        '      if [ "$HAS_SOCKETS" = "1" ] && timeout 3 bash -c "cat < /dev/null > /dev/tcp/$ttarget/$tport" 2>/dev/null; then',
        '        end=$(date +%s%3N); latency=$((end-start)); status="up"',
        '      else',
        '        latency=null; status="down"',
        '      fi',
        '      checks+=("{\\\"type\\\":\\\"tcp\\\",\\\"target\\\":\\\"$ttarget\\\",\\\"name\\\":\\\"$tname\\\",\\\"port\\\":$tport,\\\"status\\\":\\\"$status\\\",\\\"latencyMs\\\":${latency},\\\"checkedAt\\\":\\\"$checked_at\\\"}")',
        '    elif [ "$ttype" = "http" ]; then',
        '      scheme="${tscheme:-https}"',
        '      url="$scheme://$ttarget"',
        '      if [ -n "$tport" ]; then url="$url:$tport"; fi',
        '      if [ -n "$tpath" ]; then url="$url$tpath"; fi',
        '      result=$(curl -o /dev/null -s -w "%{time_total} %{http_code} %{time_namelookup} %{time_connect} %{time_appconnect}" --max-time 5 "$url" || true)',
        '      time_total=$(echo "$result" | awk \'{print $1}\')',
        '      http_code=$(echo "$result" | awk \'{print $2}\')',
        '      t_dns=$(echo "$result" | awk \'{print $3}\')',
        '      t_connect=$(echo "$result" | awk \'{print $4}\')',
        '      t_tls=$(echo "$result" | awk \'{print $5}\')',
        '      if [ -n "$time_total" ] && [ "$http_code" != "000" ]; then',
        '        latency=$(awk -v t="$time_total" \'BEGIN{printf "%.0f", t*1000}\')',
        '        dns=$(awk -v t="$t_dns" \'BEGIN{printf "%.0f", t*1000}\')',
        '        connect=$(awk -v t="$t_connect" \'BEGIN{printf "%.0f", t*1000}\')',
        '        tls=$(awk -v t="$t_tls" \'BEGIN{printf "%.0f", t*1000}\')',
        '        status="up"',
        '      else',
        '        latency=null; http_code="000"; dns=null; connect=null; tls=null; status="down"',
        '      fi',
        '      checks+=("{\\\"type\\\":\\\"http\\\",\\\"target\\\":\\\"$ttarget\\\",\\\"name\\\":\\\"$tname\\\",\\\"scheme\\\":\\\"${scheme}\\\",\\\"port\\\":${tport:-null},\\\"path\\\":\\\"${tpath:-/}\\\",\\\"status\\\":\\\"$status\\\",\\\"latencyMs\\\":${latency},\\\"httpCode\\\":$http_code,\\\"dnsMs\\\":${dns},\\\"connectMs\\\":${connect},\\\"tlsMs\\\":${tls},\\\"checkedAt\\\":\\\"$checked_at\\\"}")',
        '    fi',
        '  done',
        '  NETWORK_JSON="["$(IFS=,; echo "${checks[*]}")"]"',
        '  echo "$now_ts" > "$NETWORK_STATE"',
        'fi',
        '',
        'SHOULD_SEND=0',
        'if [ ! -f "$REPORT_STATE" ]; then SHOULD_SEND=1; else',
        '  last_report=$(cat "$REPORT_STATE" || echo 0)',
        '  if [ $((now_ts-last_report)) -ge "$REPORT_INTERVAL" ]; then SHOULD_SEND=1; fi',
        'fi',
        'SHOULD_STORE=0',
        'if [ ! -f "$REPORT_STORE_STATE" ]; then SHOULD_STORE=1; else',
        '  last_store=$(cat "$REPORT_STORE_STATE" || echo 0)',
        '  if [ $((now_ts-last_store)) -ge "$REPORT_STORE_INTERVAL" ]; then SHOULD_STORE=1; fi',
        'fi',
        'if [ "$SHOULD_SEND" = "1" ]; then',
        '  if [ "$SHOULD_STORE" = "1" ]; then echo "$now_ts" > "$REPORT_STORE_STATE"; fi',
        '  PAYLOAD=$(cat <<PAYLOAD_EOF',
        '{',
        '  "hostname": "\${HOSTNAME}",',
        '  "os": "\${OS}",',
        '  "arch": "\${ARCH}",',
        '  "kernel": "\${KERNEL}",',
        '  "uptimeSec": \${UPTIME_SEC},',
        '  "cpu": { "usage": \${CPU_USAGE} },',
        '  "mem": { "usage": \${MEM_USAGE} },',
        '  "disk": { "usage": \${DISK_USAGE} },',
        '  "load": { "load1": \${LOAD1} },',
        '  "traffic": \${TRAFFIC_JSON},',
        '  "network": ${NETWORK_JSON}',
        '}',
        'PAYLOAD_EOF',
        ')',
        '',
        '  TS_MS=$(date +%s%3N 2>/dev/null || true)',
        '  if [ -z "$TS_MS" ]; then TS_MS=$(($(date +%s) * 1000)); fi',
        '  SIG=""',
        '  if command -v openssl >/dev/null 2>&1; then',
        '    SIG=$(printf "%s" "${NODE_ID}.${TS_MS}.${PAYLOAD}" | openssl dgst -sha256 -hmac "${NODE_SECRET}" -hex | awk \'{print $2}\')',
        '  else',
        '    echo "[misub-probe] openssl missing, signature disabled" >&2',
        '  fi',
        '',
        `curl -sS -X POST "${reportUrl}" \\`,
        '  -H "Content-Type: application/json" \\',
        `  -H "x-node-id: ${node.id}" \\`,
        `  -H "x-node-secret: ${node.secret}" \\`,
        '  -H "x-node-timestamp: ${TS_MS}" \\',
        '  -H "x-node-signature: ${SIG}" \\',
        '  --data "${PAYLOAD}" >/dev/null',
        '  echo "$now_ts" > "$REPORT_STATE"',
        'fi',
        'EOF',
        '',
        'chmod +x /usr/local/bin/misub-vps-probe.sh',
        '',
        "cat > /etc/systemd/system/misub-vps-probe.service <<'EOF'",
        '[Unit]',
        'Description=MiSub VPS Probe',
        'After=network-online.target',
        'Wants=network-online.target',
        '',
        '[Service]',
        'Type=oneshot',
        'ExecStart=/usr/local/bin/misub-vps-probe.sh',
        'EOF',
        '',
        "cat > /etc/systemd/system/misub-vps-probe.timer <<'EOF'",
        '[Unit]',
        'Description=MiSub VPS Probe Timer',
        '',
        '[Timer]',
        'OnBootSec=2min',
        'OnUnitActiveSec=60s',
        'Unit=misub-vps-probe.service',
        'Persistent=true',
        '',
        '[Install]',
        'WantedBy=timers.target',
        'EOF',
        '',
        'systemctl daemon-reload',
        '',
        'systemctl enable --now misub-vps-probe.timer',
        '',
        'systemctl status misub-vps-probe.timer --no-pager'
    ].join('\n');
}

function buildUninstallScript(node) {
    return [
        '#!/usr/bin/env bash',
        '',
        'set -euo pipefail',
        '',
        'echo "[misub-probe] stopping and disabling misub-vps-probe.timer..."',
        'systemctl stop misub-vps-probe.timer || true',
        'systemctl disable misub-vps-probe.timer || true',
        '',
        'echo "[misub-probe] removing systemd configuration..."',
        'rm -f /etc/systemd/system/misub-vps-probe.timer',
        'rm -f /etc/systemd/system/misub-vps-probe.service',
        'systemctl daemon-reload',
        '',
        'echo "[misub-probe] removing probe script..."',
        'rm -f /usr/local/bin/misub-vps-probe.sh',
        '',
        'echo "[misub-probe] cleaning up temporary files..."',
        'rm -f /var/tmp/misub-vps-network.ts /var/tmp/misub-vps-report.ts /var/tmp/misub-vps-report-store.ts',
        '',
        'echo "[misub-probe] uninstallation complete."'
    ].join('\n');
}

function buildPublicGuide(env, request, node) {
    const baseUrl = getPublicBaseUrl(env, new URL(request.url));
    const reportUrl = `${baseUrl.origin}/api/vps/report`;
    const installScript = buildInstallScript(reportUrl, node);
    const installCommand = `curl -fsSL "${baseUrl.origin}/api/vps/install?nodeId=${node.id}&secret=${node.secret}" | bash`;
    const uninstallScript = buildUninstallScript(node);
    const uninstallCommand = `curl -fsSL "${baseUrl.origin}/api/vps/uninstall?nodeId=${node.id}&secret=${node.secret}" | bash`;
    return {
        reportUrl,
        nodeId: node.id,
        nodeSecret: node.secret,
        headers: {
            'Content-Type': 'application/json',
            'x-node-id': node.id,
            'x-node-secret': node.secret
        },
        installScript,
        installCommand,
        uninstallScript,
        uninstallCommand
    };
}

export async function handleVpsInstallScript(request, env) {
    if (request.method !== 'GET') {
        return createErrorResponse('Method Not Allowed', 405);
    }
    const d1Check = ensureD1Available(env);
    if (d1Check) return d1Check;

    const settings = await loadVpsSettings(env);
    const storageModeCheck = ensureD1StorageMode(settings, env);
    if (storageModeCheck) return storageModeCheck;

    const url = new URL(request.url);
    const nodeId = normalizeString(url.searchParams.get('nodeId'));
    const nodeSecret = normalizeString(url.searchParams.get('secret'));
    if (!nodeId || !nodeSecret) {
        return createErrorResponse('Missing node credentials', 401);
    }

    const db = getD1(env);
    const node = await fetchNode(db, nodeId);
    if (!node) {
        return createErrorResponse('Node not found', 404);
    }
    if (node.secret !== nodeSecret) {
        return createErrorResponse('Unauthorized', 401);
    }

    const baseUrl = getPublicBaseUrl(env, new URL(request.url));
    const reportUrl = `${baseUrl.origin}/api/vps/report`;
    const script = buildInstallScript(reportUrl, node);
    return new Response(script, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8'
        }
    });
}

export async function handleVpsUninstallScript(request, env) {
    if (request.method !== 'GET') {
        return createErrorResponse('Method Not Allowed', 405);
    }
    const d1Check = ensureD1Available(env);
    if (d1Check) return d1Check;

    const settings = await loadVpsSettings(env);
    const storageModeCheck = ensureD1StorageMode(settings, env);
    if (storageModeCheck) return storageModeCheck;

    const url = new URL(request.url);
    const nodeId = normalizeString(url.searchParams.get('nodeId'));
    const nodeSecret = normalizeString(url.searchParams.get('secret'));
    if (!nodeId || !nodeSecret) {
        return createErrorResponse('Missing node credentials', 401);
    }

    const db = getD1(env);
    const node = await fetchNode(db, nodeId);
    if (!node) {
        return createErrorResponse('Node not found', 404);
    }
    if (node.secret !== nodeSecret) {
        return createErrorResponse('Unauthorized', 401);
    }

    const script = buildUninstallScript(node);
    return new Response(script, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8'
        }
    });
}

export async function handleVpsConfig(request, env) {
    if (request.method !== 'GET') {
        return createErrorResponse('Method Not Allowed', 405);
    }
    const d1Check = ensureD1Available(env);
    if (d1Check) return d1Check;

    const settings = await loadVpsSettings(env);
    const storageModeCheck = ensureD1StorageMode(settings, env);
    if (storageModeCheck) return storageModeCheck;

    const url = new URL(request.url);
    const nodeId = normalizeString(url.searchParams.get('nodeId'));
    const nodeSecret = normalizeString(url.searchParams.get('secret'));
    const format = normalizeString(url.searchParams.get('format')) || 'json';
    if (!nodeId || !nodeSecret) {
        return createErrorResponse('Missing node credentials', 401);
    }

    const db = getD1(env);
    const node = await fetchNode(db, nodeId);
    if (!node || node.secret !== nodeSecret) {
        return createErrorResponse('Unauthorized', 401);
    }

    const nodeTargets = await fetchNetworkTargets(db, nodeId);
    const globalTargets = node?.useGlobalTargets ? await fetchGlobalNetworkTargets(db) : [];
    const targets = node?.useGlobalTargets ? globalTargets : nodeTargets;
    const interval = clampNumber(settings?.vpsMonitor?.networkSampleIntervalMinutes, 1, 60, 5);
    const reportInterval = clampNumber(settings?.vpsMonitor?.reportIntervalMinutes, 1, 60, 1);
    const reportStoreInterval = clampNumber(settings?.vpsMonitor?.reportStoreIntervalMinutes, 1, 60, 1);

    if (format === 'env') {
        const now = new Date();
        const lines = [
            `NETWORK_INTERVAL=${interval}`,
            `REPORT_INTERVAL=${reportInterval}`,
            `REPORT_STORE_INTERVAL=${reportStoreInterval}`
        ];
        const pending = [];
        targets.forEach(target => {
            const line = `TARGET=${target.type}|${target.target}|${target.scheme || 'https'}|${target.port || ''}|${target.path || ''}|${target.enabled ? 1 : 0}|${target.forceCheckAt || ''}|${target.name || ''}`;
            lines.push(line);
            if (target.forceCheckAt) {
                pending.push(target.id);
            }
        });
        if (pending.length) {
            db.prepare(`UPDATE vps_network_targets SET force_check_at = NULL, updated_at = ? WHERE id IN (${pending.map(() => '?').join(',')})`)
                .bind(nowIso(), ...pending)
                .run();
        }
        return new Response(lines.join('\n'), {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8'
            }
        });
    }

    return createJsonResponse({
        success: true,
        data: {
            intervalMinutes: interval,
            targets
        }
    });
}

export { buildPublicGuide };

export async function handleVpsReport(request, env) {
    const d1Check = ensureD1Available(env);
    if (d1Check) return d1Check;
    if (request.method !== 'POST') {
        return createErrorResponse('Method Not Allowed', 405);
    }

    let payload;
    let rawBody = '';
    try {
        rawBody = await request.text();
        payload = rawBody ? JSON.parse(rawBody) : null;
    } catch (error) {
        return createErrorResponse('Invalid JSON', 400);
    }

    const nodeId = normalizeString(request.headers.get('x-node-id') || payload?.nodeId);
    const nodeSecret = normalizeString(request.headers.get('x-node-secret') || payload?.secret);
    const signature = normalizeString(request.headers.get('x-node-signature') || payload?.signature);
    const signatureTs = normalizeString(request.headers.get('x-node-timestamp') || payload?.timestamp);

    if (!nodeId) {
        return createErrorResponse('Missing node id', 401);
    }

    const settings = await loadVpsSettings(env);
    const storageModeCheck = ensureD1StorageMode(settings, env);
    if (storageModeCheck) return storageModeCheck;

    const db = getD1(env);

    if (settings?.vpsMonitor?.enabled === false) {
        return createErrorResponse('VPS monitor disabled', 403);
    }

    const node = await fetchNode(db, nodeId);
    if (!node) {
        return createErrorResponse('Node not found', 404);
    }
    if (node.enabled === false) {
        return createErrorResponse('Node disabled', 403);
    }
    if (settings?.vpsMonitor?.requireSecret !== false) {
        if (!nodeSecret) {
            return createErrorResponse('Missing node secret', 401);
        }
        if (node.secret !== nodeSecret) {
            return createErrorResponse('Unauthorized', 401);
        }
    }

    if (settings?.vpsMonitor?.requireSignature === true) {
        if (!signature || !signatureTs) {
            return createErrorResponse('Missing signature', 401);
        }
        const tsNumber = Number(signatureTs);
        if (!Number.isFinite(tsNumber)) {
            return createErrorResponse('Invalid timestamp', 400);
        }
        const skewMinutes = clampNumber(settings?.vpsMonitor?.signatureClockSkewMinutes, 1, 60, 5);
        const nowMs = Date.now();
        const skewMs = skewMinutes * 60 * 1000;
        if (Math.abs(nowMs - tsNumber) > skewMs) {
            return createErrorResponse('Signature expired', 401);
        }
        const bodyToSign = normalizeString(rawBody || safeJsonStringify(payload?.report || payload));
        const expected = await computeSignature(node.secret, node.id, String(tsNumber), bodyToSign);
        if (expected !== signature) {
            return createErrorResponse('Invalid signature', 401);
        }
    }

    const report = payload?.report || payload;
    const receivedAt = nowIso();
    const reportedAt = normalizeReportTimestamp(report.reportedAt || report.at || report.timestamp || report.ts, receivedAt);

    const networkPayload = report.network || report.checks || null;
    const sanitizedChecks = sanitizeNetworkChecks(networkPayload);

    // Update Geolocation if available
    if (request.cf?.country) {
        node.countryCode = normalizeString(request.cf.country);
    }

    // Traffic Accumulation
    if (report.traffic) {
        const lastTraffic = node.lastReport?.traffic || {};
        const curRx = Number(report.traffic.rx || 0);
        const curTx = Number(report.traffic.tx || 0);
        const lastRx = Number(lastTraffic.rx || 0);
        const lastTx = Number(lastTraffic.tx || 0);

        // If current total is less than last, assume reboot/reset and use current as delta
        const rxDelta = (curRx < lastRx || lastRx === 0) ? curRx : (curRx - lastRx);
        const txDelta = (curTx < lastTx || lastTx === 0) ? curTx : (curTx - lastTx);

        node.totalRx = (Number(node.totalRx) || 0) + rxDelta;
        node.totalTx = (Number(node.totalTx) || 0) + txDelta;
    }

    const normalizedReport = {
        id: crypto.randomUUID(),
        nodeId: node.id,
        reportedAt,
        createdAt: nowIso(),
        receivedAt,
        meta: {
            hostname: normalizeString(report.hostname || report.host),
            os: normalizeString(report.os || report.platform),
            arch: normalizeString(report.arch),
            kernel: normalizeString(report.kernel),
            version: normalizeString(report.version),
            publicIp: normalizeString(report.publicIp || report.ip || getClientIp(request)),
            countryCode: node.countryCode
        },
        cpu: { usage: clampPayloadUsage(report.cpu?.usage) },
        mem: { usage: clampPayloadUsage(report.mem?.usage) },
        disk: { usage: clampPayloadUsage(report.disk?.usage) },
        load: { load1: clampPayloadLoad(report.load?.load1) },
        uptimeSec: clampPayloadUptime(report.uptimeSec ?? report.uptime) ?? 0,
        traffic: report.traffic || null,
        network: sanitizedChecks.length ? sanitizedChecks : null
    };

    // Batch insert network sample + report if applicable
    const batchStatements = [];
    if (sanitizedChecks.length) {
        const networkSample = {
            id: crypto.randomUUID(),
            nodeId: node.id,
            reportedAt,
            createdAt: nowIso(),
            checks: sanitizedChecks
        };
        batchStatements.push(
            db.prepare(
                'INSERT INTO vps_network_samples (id, node_id, reported_at, created_at, data) VALUES (?, ?, ?, ?, ?)'
            ).bind(networkSample.id, networkSample.nodeId, networkSample.reportedAt, networkSample.createdAt, JSON.stringify(networkSample))
        );
    }

    const reportInterval = clampNumber(settings?.vpsMonitor?.reportStoreIntervalMinutes, 1, 60, 1);
    const lastSeenTs = node.lastSeenAt ? new Date(node.lastSeenAt).getTime() : NaN;
    if (reportInterval <= 1 || !Number.isFinite(lastSeenTs) || (Date.now() - lastSeenTs) >= reportInterval * 60 * 1000) {
        batchStatements.push(
            db.prepare(
                'INSERT INTO vps_reports (id, node_id, reported_at, created_at, data) VALUES (?, ?, ?, ?, ?)'
            ).bind(normalizedReport.id, normalizedReport.nodeId, normalizedReport.reportedAt, normalizedReport.createdAt, JSON.stringify(normalizedReport))
        );
    }

    if (batchStatements.length > 0) {
        await db.batch(batchStatements);
    }

    node.lastSeenAt = normalizedReport.reportedAt;
    await updateNodeStatus(db, settings, node, normalizedReport);
    
    // Carry-along check for other nodes
    await checkAllNodesHeartbeat(db, settings, env);

    // Incremental update: only write changed fields instead of full row
    const updatedAt = nowIso();
    await updateNodeIncremental(db, node.id, {
        status: node.status,
        last_seen_at: node.lastSeenAt,
        total_rx: node.totalRx || 0,
        total_tx: node.totalTx || 0,
        last_report_json: JSON.stringify(buildSnapshot(normalizedReport, node)),
        overload_state_json: node.overloadState ? JSON.stringify(node.overloadState) : null,
        updated_at: updatedAt
    });

    // In regular reports, we rely on the 60s TTL of the KV cache instead of manual invalidation.
    // This drastically reduces KV write/delete operations to stay within free limits.
    // Manual invalidation still occurs on node configuration changes.
    await maybePruneReports(db, settings, env);
    return createJsonResponse({ success: true });
}

export async function handleVpsNodesRequest(request, env) {
    const d1Check = ensureD1Available(env);
    if (d1Check) return d1Check;
    const settings = await loadVpsSettings(env);
    const storageModeCheck = ensureD1StorageMode(settings, env);
    if (storageModeCheck) return storageModeCheck;
    const db = getD1(env);
    const nodes = await fetchNodes(db);

    if (request.method === 'GET') {
        const data = nodes.map(node => summarizeNode(node, node.lastReport || null, settings));
        return createJsonResponse({ success: true, data });
    }

    if (request.method === 'POST') {
        const body = await request.json();
        const name = normalizeString(body.name);
        if (!name) {
            return createErrorResponse('Name is required', 400);
        }

        const node = {
            id: crypto.randomUUID(),
            name,
            tag: normalizeString(body.tag),
            groupTag: normalizeString(body.groupTag),
            region: normalizeString(body.region),
            countryCode: normalizeString(body.countryCode),
            description: normalizeString(body.description),
            secret: normalizeString(body.secret) || crypto.randomUUID(),
            status: 'offline',
            enabled: body.enabled !== false,
            useGlobalTargets: body.useGlobalTargets === true,
            totalRx: 0,
            totalTx: 0,
            trafficLimitGb: Number(body.trafficLimitGb || 0),
            createdAt: nowIso(),
            updatedAt: nowIso(),
            lastSeenAt: null,
            lastReport: null,
            overloadState: null
        };
        await insertNode(db, node);
        await invalidatePublicCaches(env, node.id);

        return createJsonResponse({ success: true, data: node, guide: buildPublicGuide(env, request, node) });
    }

    return createErrorResponse('Method Not Allowed', 405);
}

export async function handleVpsPublicSnapshotRequest(request, env) {
    const d1Check = ensureD1Available(env);
    if (d1Check) return d1Check;
    const settings = await loadVpsSettings(env);
    const storageModeCheck = ensureD1StorageMode(settings, env);
    if (storageModeCheck) return storageModeCheck;

    if (settings?.vpsMonitor?.publicPageEnabled !== true) {
        return createErrorResponse('Public access disabled', 403);
    }

    const token = normalizeString(settings?.vpsMonitor?.publicPageToken);
    if (token) {
        const url = new URL(request.url);
        const provided = normalizeString(url.searchParams.get('token'));
        if (!provided || provided !== token) {
            return createErrorResponse('Unauthorized', 401);
        }
    }

    const layout = {
        headerEnabled: settings?.vpsMonitor?.publicPageShowHeader !== false,
        footerEnabled: settings?.vpsMonitor?.publicPageShowFooter !== false
    };

    const cached = await readJsonCache(env, PUBLIC_SNAPSHOT_CACHE_KEY);
    if (cached) {
        return createJsonResponse(cached);
    }

    const db = getD1(env);
    const nodes = await fetchNodes(db);
    if (!nodes.length) {
        return createJsonResponse({ success: true, data: [], theme: buildPublicThemeConfig(settings), layout });
    }
    
    // Fetch latest network samples for all nodes to ensure they are visible
    const nodeIds = nodes.map(n => n.id);
    const latestSamples = await fetchLatestNetworkSamplesBatch(db, nodeIds);
    const samplesMap = new Map(latestSamples.map(s => [s.nodeId, s.checks]));
    const placeholders = nodeIds.map(() => '?').join(',');

    // Fetch ALL relevant targets in one go
    const allTargetsResult = await db.prepare('SELECT * FROM vps_network_targets WHERE node_id IN (' + placeholders + ') OR node_id = ?').bind(...nodeIds, 'global').all();
    const allTargetsMap = new Map(); // node_id -> targets[]
    (allTargetsResult.results || []).forEach(row => {
        const tid = row.node_id;
        if (!allTargetsMap.has(tid)) allTargetsMap.set(tid, []);
        allTargetsMap.get(tid).push({
            type: row.type,
            target: row.target,
            name: row.name,
            scheme: row.scheme || 'https',
            port: row.port,
            path: row.path
        });
    });

    const data = nodes.map(node => {
        const summary = summarizeNode(node, node.lastReport || null, settings);
        // Sync/Override with fresh samples from the samples table
        let latestNetwork = samplesMap.get(node.id);
        
        // Re-hydrate names
        const nodeSpecificTargets = allTargetsMap.get(node.id) || [];
        const globalTargets = allTargetsMap.get('global') || [];
        const targets = node.useGlobalTargets ? globalTargets : nodeSpecificTargets;
        
        if (latestNetwork && latestNetwork.length > 0) {
            latestNetwork = rehydrateCheckNames(latestNetwork, targets);
            if (!summary.latest) summary.latest = { at: nowIso() };
            summary.latest.network = latestNetwork;
        }

        // Security: Remove sensitive IP information from public snapshot
        if (summary.latest) {
            if (summary.latest.publicIp) delete summary.latest.publicIp;
            if (summary.latest.ip) delete summary.latest.ip;
        }

        return summary;
    });

    const responseBody = {
        success: true,
        data,
        theme: buildPublicThemeConfig(settings),
        layout
    };
    await writeJsonCache(env, PUBLIC_SNAPSHOT_CACHE_KEY, responseBody);
    return createJsonResponse(responseBody);
}

async function fetchLatestNetworkSamplesBatch(db, nodeIds) {
    if (!nodeIds.length) return [];
    const placeholders = nodeIds.map(() => '?').join(',');
    const sql = `
        SELECT samples.node_id, samples.data, samples.reported_at
        FROM vps_network_samples AS samples
        INNER JOIN (
            SELECT node_id, MAX(reported_at) AS latest_reported_at
            FROM vps_network_samples
            WHERE node_id IN (${placeholders})
            GROUP BY node_id
        ) AS latest
        ON samples.node_id = latest.node_id AND samples.reported_at = latest.latest_reported_at
        ORDER BY samples.node_id
    `;
    const { results } = await db.prepare(sql).bind(...nodeIds).all();
    return (results || []).map(row => ({
        nodeId: row.node_id,
        checks: row.data ? JSON.parse(row.data).checks : [],
        reportedAt: row.reported_at
    }));
}

export async function handleVpsPublicNodeDetailRequest(request, env) {
    const d1Check = ensureD1Available(env);
    if (d1Check) return d1Check;
    const settings = await loadVpsSettings(env);
    const storageModeCheck = ensureD1StorageMode(settings, env);
    if (storageModeCheck) return storageModeCheck;

    if (settings?.vpsMonitor?.publicPageEnabled !== true) {
        return createErrorResponse('Public access disabled', 403);
    }

    const token = normalizeString(settings?.vpsMonitor?.publicPageToken);
    if (token) {
        const provided = normalizeString(new URL(request.url).searchParams.get('token'));
        if (!provided || provided !== token) {
            return createErrorResponse('Unauthorized', 401);
        }
    }

    const url = new URL(request.url);
    let nodeId = normalizeString(url.pathname.split('/').pop());
    if (!nodeId || nodeId === 'nodes') {
        nodeId = normalizeString(url.searchParams.get('id'));
    }
    if (!nodeId) {
        return createErrorResponse('Node id required', 400);
    }

    const cached = await readJsonCache(env, PUBLIC_NODE_DETAIL_CACHE_KEY_PREFIX + nodeId);
    if (cached) {
        return createJsonResponse(cached);
    }

    const db = getD1(env);
    const node = await fetchNode(db, nodeId);
    if (!node) {
        return createErrorResponse('Node not found', 404);
    }

    const nodeTargets = await fetchNetworkTargets(db, nodeId);
    const globalTargets = node?.useGlobalTargets ? await fetchGlobalNetworkTargets(db) : [];
    const targets = node?.useGlobalTargets ? globalTargets : nodeTargets;

    // Fetch network samples - last 500 points for better precision
    const cutoff = new Date(getReportRetentionCutoff(settings)).toISOString();
    const result = await db.prepare(
        'SELECT data FROM vps_network_samples WHERE node_id = ? AND reported_at >= ? ORDER BY reported_at DESC LIMIT 500'
    ).bind(nodeId, cutoff).all();
    
    const samples = (result.results || []).map(row => {
        const s = JSON.parse(row.data);
        if (s.checks) s.checks = rehydrateCheckNames(s.checks, targets);
        return s;
    }).reverse();

    const summary = summarizeNode(node, node.lastReport || null, settings);
    // Security: Remove sensitive IP information
    if (summary.latest) {
        if (summary.latest.publicIp) delete summary.latest.publicIp;
        if (summary.latest.ip) delete summary.latest.ip;
    }

    const responseBody = {
        success: true,
        data: summary,
        networkSamples: samples,
        layout: {
            headerEnabled: settings?.vpsMonitor?.publicPageShowHeader !== false,
            footerEnabled: settings?.vpsMonitor?.publicPageShowFooter !== false
        }
    };
    await writeJsonCache(env, PUBLIC_NODE_DETAIL_CACHE_KEY_PREFIX + nodeId, responseBody);
    return createJsonResponse(responseBody);
}

export async function handleVpsNodeDetailRequest(request, env) {
    const d1Check = ensureD1Available(env);
    if (d1Check) return d1Check;
    const settings = await loadVpsSettings(env);
    const storageModeCheck = ensureD1StorageMode(settings, env);
    if (storageModeCheck) return storageModeCheck;
    const db = getD1(env);

    const url = new URL(request.url);
    let nodeId = normalizeString(url.pathname.split('/').pop());
    if (nodeId === 'nodes') {
        nodeId = normalizeString(url.searchParams.get('id'));
    }
    if (!nodeId) {
        return createErrorResponse('Node id required', 400);
    }

    const node = await fetchNode(db, nodeId);
    if (!node) {
        return createErrorResponse('Node not found', 404);
    }

    if (request.method === 'GET') {
        const latestReport = node.lastReport || null;
        let reports = await fetchReportsForNode(db, nodeId, settings);
        const nodeTargets = await fetchNetworkTargets(db, nodeId);
        const globalTargets = node?.useGlobalTargets ? await fetchGlobalNetworkTargets(db) : [];
        const targets = node?.useGlobalTargets ? globalTargets : nodeTargets;
        let networkSamples = await fetchNetworkSamples(db, nodeId, settings);

        // Re-hydrate names in reports and samples
        reports = reports.map(r => {
            if (r.network) r.network = rehydrateCheckNames(r.network, targets);
            return r;
        });
        networkSamples = networkSamples.map(s => {
            if (s.checks) s.checks = rehydrateCheckNames(s.checks, targets);
            return s;
        });

        return createJsonResponse({
            success: true,
            data: summarizeNode(node, latestReport, settings),
            reports,
            targets,
            networkSamples,
            guide: buildPublicGuide(env, request, node)
        });
    }

    if (request.method === 'PATCH') {
        const body = await request.json();
        const fields = ['name', 'tag', 'groupTag', 'region', 'countryCode', 'description'];
        fields.forEach(field => {
            if (body[field] !== undefined) {
                node[field] = normalizeString(body[field]);
            }
        });
        if (typeof body.useGlobalTargets === 'boolean') {
            node.useGlobalTargets = body.useGlobalTargets;
        }
        if (typeof body.trafficLimitGb === 'number') {
            node.trafficLimitGb = body.trafficLimitGb;
        }
        if (typeof body.enabled === 'boolean') {
            node.enabled = body.enabled;
        }
        if (body.resetSecret) {
            node.secret = crypto.randomUUID();
        }
        node.updatedAt = nowIso();
        await updateNode(db, node);
        await invalidatePublicCaches(env, node.id);
        return createJsonResponse({ success: true, data: node, guide: buildPublicGuide(env, request, node) });
    }

    if (request.method === 'DELETE') {
        await deleteNode(db, nodeId);
        await invalidatePublicCaches(env, nodeId);
        return createJsonResponse({ success: true, data: node });
    }

    return createErrorResponse('Method Not Allowed', 405);
}

export async function handleVpsAlertsRequest(request, env) {
    const d1Check = ensureD1Available(env);
    if (d1Check) return d1Check;
    const settings = await loadVpsSettings(env);
    const storageModeCheck = ensureD1StorageMode(settings, env);
    if (storageModeCheck) return storageModeCheck;
    const db = getD1(env);

    if (request.method === 'GET') {
        const result = await db.prepare('SELECT * FROM vps_alerts ORDER BY created_at DESC').all();
        const alerts = (result.results || []).map(row => ({
            id: row.id,
            nodeId: row.node_id,
            type: row.type,
            message: row.message,
            createdAt: row.created_at
        }));
        return createJsonResponse({ success: true, data: alerts });
    }

    if (request.method === 'DELETE') {
        await db.prepare('DELETE FROM vps_alerts').run();
        return createJsonResponse({ success: true });
    }

    return createErrorResponse('Method Not Allowed', 405);
}

export async function handleVpsNetworkTargetsRequest(request, env) {
    const d1Check = ensureD1Available(env);
    if (d1Check) return d1Check;
    const settings = await loadVpsSettings(env);
    const storageModeCheck = ensureD1StorageMode(settings, env);
    if (storageModeCheck) return storageModeCheck;
    const db = getD1(env);

    const url = new URL(request.url);
    const nodeId = normalizeString(url.searchParams.get('nodeId'));
    const isGlobal = nodeId === 'global';
    if (!nodeId) {
        return createErrorResponse('Node id required', 400);
    }
    if (!isGlobal) {
        const node = await fetchNode(db, nodeId);
        if (!node) {
            return createErrorResponse('Node not found', 404);
        }
    }

    if (request.method === 'GET') {
        const targets = isGlobal ? await fetchGlobalNetworkTargets(db) : await fetchNetworkTargets(db, nodeId);
        return createJsonResponse({ success: true, data: targets });
    }

    if (request.method === 'POST') {
        const payload = await request.json();
        const error = validateNetworkTarget(payload);
        if (error) {
            return createErrorResponse(error, 400);
        }
        const current = isGlobal ? await fetchGlobalNetworkTargets(db) : await fetchNetworkTargets(db, nodeId);
        const limit = clampNumber(settings?.vpsMonitor?.networkTargetsLimit, 1, 10, 3);
        if (current.length >= limit) {
            return createErrorResponse(`目标数量超过上限（${limit}）`, 400);
        }
        const target = await insertNetworkTarget(db, nodeId, payload);
        await invalidatePublicCaches(env, nodeId);
        return createJsonResponse({ success: true, data: target });
    }

    if (request.method === 'PATCH') {
        const payload = await request.json();
        const targetId = normalizeString(payload.id);
        if (!targetId) {
            return createErrorResponse('Target id required', 400);
        }
    const error = payload.type || payload.target || payload.port || payload.path || payload.scheme
        ? validateNetworkTarget({
            type: payload.type || 'icmp',
            target: payload.target || '1.1.1.1',
            port: payload.port,
            path: payload.path,
            scheme: payload.scheme
        })
        : null;
        if (error) {
            return createErrorResponse(error, 400);
        }
        const updated = await updateNetworkTarget(db, targetId, payload);
        if (!updated) {
            return createErrorResponse('Target not found', 404);
        }
        await invalidatePublicCaches(env);
        return createJsonResponse({ success: true, data: updated });
    }

    if (request.method === 'DELETE') {
        const payload = await request.json();
        const targetId = normalizeString(payload.id);
        if (!targetId) {
            return createErrorResponse('Target id required', 400);
        }
        await deleteNetworkTarget(db, targetId);
        await invalidatePublicCaches(env);
        return createJsonResponse({ success: true });
    }

    return createErrorResponse('Method Not Allowed', 405);
}

export async function handleVpsNetworkCheck(request, env) {
    if (request.method !== 'POST') {
        return createErrorResponse('Method Not Allowed', 405);
    }
    const d1Check = ensureD1Available(env);
    if (d1Check) return d1Check;
    const settings = await loadVpsSettings(env);
    const storageModeCheck = ensureD1StorageMode(settings, env);
    if (storageModeCheck) return storageModeCheck;
    const db = getD1(env);

    let payload;
    try {
        payload = await request.json();
    } catch (error) {
        return createErrorResponse('Invalid JSON', 400);
    }

    const nodeId = normalizeString(payload.nodeId);
    if (!nodeId) {
        return createErrorResponse('Node id required', 400);
    }

    const targetId = normalizeString(payload.targetId);
    if (!targetId) {
        return createErrorResponse('Target id required', 400);
    }

    const node = await fetchNode(db, nodeId);
    if (!node) {
        return createErrorResponse('Node not found', 404);
    }
    if (node.enabled === false) {
        return createErrorResponse('Node disabled', 403);
    }

    const targetRow = await db.prepare('SELECT * FROM vps_network_targets WHERE id = ? AND (node_id = ? OR node_id = ?)').bind(targetId, nodeId, 'global').first();
    if (!targetRow) {
        return createErrorResponse('Target not found', 404);
    }
    if (targetRow.enabled === 0) {
        return createErrorResponse('Target disabled', 400);
    }

    const now = nowIso();
    try {
        await db.prepare('UPDATE vps_network_targets SET force_check_at = ?, updated_at = ? WHERE id = ?').bind(now, now, targetRow.id).run();
    } catch (error) {
        const message = error?.message || '';
        if (!message.includes('no column named force_check_at')) {
            throw error;
        }
    }

    const target = {
        id: targetRow.id,
        type: targetRow.type,
        target: targetRow.target,
        scheme: targetRow.scheme || 'https',
        port: targetRow.port,
        path: targetRow.path,
        forceCheckAt: now
    };

    return createJsonResponse({ success: true, data: target, message: 'Probe will run check on next report' });
}

export async function handleVpsCleanup(request, env) {
    if (request.method !== 'POST') {
        return createErrorResponse('Method Not Allowed', 405);
    }
    const d1Check = ensureD1Available(env);
    if (d1Check) return d1Check;

    const settings = await loadVpsSettings(env);
    const storageModeCheck = ensureD1StorageMode(settings, env);
    if (storageModeCheck) return storageModeCheck;

    const db = getD1(env);
    await pruneAllReportsAndSamples(db, settings);
    await invalidatePublicCaches(env);

    return createJsonResponse({ success: true, message: 'Cleanup completed' });
}
