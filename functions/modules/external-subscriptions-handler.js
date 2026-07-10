import {
  buildListMeta,
  createExternalError,
  createExternalSuccess,
  getExternalStorageAdapter,
  normalizeStringArray,
  paginate,
  parseBooleanParam,
  parsePagination,
  readExternalJson,
  sortBySortIndex
} from './external-api-utils.js';
import { isRemoteSubscription, toExternalSubscription } from './external-api-mappers.js';
import { handleNodeCountRequest } from './handlers/node-handler.js';
import { getProcessedUserAgent } from '../utils/format-utils.js';

function nowIso() {
  return new Date().toISOString();
}

function generateId(prefix = 'sub') {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `${prefix}_${crypto.randomUUID()}`;
  } catch {}
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nextSortIndex(items) {
  return items.reduce((max, item) => Math.max(max, Number(item?.sortIndex) || 0), 0) + 1;
}

async function loadRemoteSubscriptions(storageAdapter) {
  const all = await storageAdapter.getAllSubscriptions();
  return sortBySortIndex(all.filter(isRemoteSubscription));
}

async function getSubscriptionById(storageAdapter, id) {
  const item = await storageAdapter.getSubscriptionById(id);
  if (!item || !isRemoteSubscription(item)) return null;
  return item;
}

async function removeSubscriptionIdFromProfiles(storageAdapter, id) {
  const profiles = await storageAdapter.getAllProfiles();
  const affected = [];
  for (const profile of profiles) {
    const subscriptions = Array.isArray(profile.subscriptions) ? profile.subscriptions : [];
    if (!subscriptions.includes(id)) continue;
    const updated = { ...profile, subscriptions: subscriptions.filter(item => item !== id), updatedAt: nowIso() };
    await storageAdapter.putProfile(updated);
    affected.push(profile.id);
  }
  return affected;
}

function createNodeCountRequest(body) {
  return new Request('https://misub.internal/api/node_count', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function normalizeSubscriptionRuntimeFields(item = {}) {
  return {
    userAgent: String(item.customUserAgent || item.userAgent || '').trim(),
    fetchProxy: String(item.fetchProxy || item.proxy || '').trim(),
    plusAsSpace: item.plusAsSpace === true
  };
}

export async function inspectRemoteSubscription(env, payload = {}) {
  const requestedUrl = String(payload.url || '').trim();
  if (!requestedUrl) return { ok: false, errorCode: 'subscription_url_required', message: 'Subscription URL is required', status: 400 };
  if (!/^https?:\/\//i.test(requestedUrl)) return { ok: false, errorCode: 'invalid_subscription_url', message: 'Subscription URL must use http or https', status: 400 };

  const runtime = normalizeSubscriptionRuntimeFields(payload);
  const effectiveUserAgent = runtime.userAgent || getProcessedUserAgent('MiSub-External-Validate/1.0', requestedUrl);
  const response = await handleNodeCountRequest(createNodeCountRequest({
    url: requestedUrl,
    userAgent: effectiveUserAgent,
    fetchProxy: runtime.fetchProxy,
    plusAsSpace: runtime.plusAsSpace
  }), env);
  const body = await response.json();

  if (body?.success && body?.data) {
    return {
      ok: true,
      requestedUrl,
      effectiveUserAgent,
      fetchProxyUsed: runtime.fetchProxy || '',
      plusAsSpace: runtime.plusAsSpace,
      nodeCount: Number(body.data.count) || 0,
      userInfo: body.data.userInfo || null
    };
  }

  return {
    ok: false,
    requestedUrl,
    effectiveUserAgent,
    fetchProxyUsed: runtime.fetchProxy || '',
    plusAsSpace: runtime.plusAsSpace,
    nodeCount: Number(body?.count) || 0,
    userInfo: body?.userInfo || null,
    errorCode: 'subscription_refresh_failed',
    message: body?.error || 'Subscription refresh failed',
    status: Number(body?.status) || 502
  };
}

async function persistSubscriptionRefresh(storageAdapter, current, inspection) {
  const timestamp = nowIso();
  const updated = {
    ...current,
    nodeCount: inspection.ok ? inspection.nodeCount : 0,
    userInfo: inspection.ok ? inspection.userInfo : (inspection.userInfo || null),
    lastError: inspection.ok ? '' : inspection.message,
    lastUpdate: timestamp,
    updatedAt: timestamp
  };
  await storageAdapter.putSubscription(updated);
  return updated;
}

export async function handleExternalSubscriptionsRequest(request, env, selector = null) {
  const storageAdapter = await getExternalStorageAdapter(env);
  const url = new URL(request.url);
  const action = typeof selector === 'object' && selector ? selector.action || null : null;
  const id = typeof selector === 'object' && selector ? selector.id || null : selector;

  if (action === 'validate') {
    if (request.method !== 'POST') return createExternalError('method_not_allowed', 'Method Not Allowed', 405);
    const payload = await readExternalJson(request);
    const inspection = await inspectRemoteSubscription(env, payload);
    if (!inspection.ok) {
      return createExternalError(inspection.errorCode || 'subscription_validation_failed', inspection.message || 'Subscription validation failed', inspection.status || 400, {
        requestedUrl: inspection.requestedUrl || String(payload?.url || '').trim(),
        effectiveUserAgent: inspection.effectiveUserAgent || '',
        nodeCount: inspection.nodeCount || 0,
        userInfo: inspection.userInfo || null
      });
    }
    return createExternalSuccess({
      valid: true,
      requestedUrl: inspection.requestedUrl,
      effectiveUserAgent: inspection.effectiveUserAgent,
      fetchProxyUsed: inspection.fetchProxyUsed,
      plusAsSpace: inspection.plusAsSpace,
      nodeCount: inspection.nodeCount,
      userInfo: inspection.userInfo,
      checkedAt: nowIso()
    });
  }

  if (action === 'batch_refresh') {
    if (request.method !== 'POST') return createExternalError('method_not_allowed', 'Method Not Allowed', 405);
    const payload = await readExternalJson(request);
    const subscriptionIds = normalizeStringArray(payload?.subscriptionIds);
    if (!subscriptionIds.length) return createExternalError('subscription_ids_required', 'subscriptionIds is required', 400);

    const all = await loadRemoteSubscriptions(storageAdapter);
    const targets = all.filter(item => subscriptionIds.includes(item.id));
    if (!targets.length) return createExternalError('subscription_not_found', 'Subscription not found', 404);

    const results = [];
    for (const current of targets) {
      const inspection = await inspectRemoteSubscription(env, current);
      const updated = await persistSubscriptionRefresh(storageAdapter, current, inspection);
      results.push({
        id: updated.id,
        name: updated.name || '',
        success: inspection.ok,
        nodeCount: Number(updated.nodeCount) || 0,
        userInfo: updated.userInfo || null,
        lastError: updated.lastError || '',
        lastUpdated: updated.lastUpdate || null
      });
    }

    return createExternalSuccess({
      results,
      summary: {
        total: results.length,
        succeeded: results.filter(item => item.success).length,
        failed: results.filter(item => !item.success).length,
        totalNodes: results.filter(item => item.success).reduce((sum, item) => sum + (Number(item.nodeCount) || 0), 0)
      }
    });
  }

  if (action === 'refresh') {
    if (request.method !== 'POST') return createExternalError('method_not_allowed', 'Method Not Allowed', 405);
    const current = await getSubscriptionById(storageAdapter, id);
    if (!current) return createExternalError('subscription_not_found', 'Subscription not found', 404);
    const inspection = await inspectRemoteSubscription(env, current);
    const updated = await persistSubscriptionRefresh(storageAdapter, current, inspection);
    return createExternalSuccess({
      id: updated.id,
      name: updated.name || '',
      success: inspection.ok,
      nodeCount: Number(updated.nodeCount) || 0,
      userInfo: updated.userInfo || null,
      lastError: updated.lastError || '',
      lastUpdated: updated.lastUpdate || null
    });
  }

  if (request.method === 'GET' && !id) {
    const all = await loadRemoteSubscriptions(storageAdapter);
    const enabledFilter = parseBooleanParam(url.searchParams.get('enabled'));
    const groupFilter = (url.searchParams.get('group') || '').trim();
    const keyword = (url.searchParams.get('keyword') || '').trim().toLowerCase();
    const filtered = all.filter(item => {
      if (enabledFilter !== undefined && (item.enabled !== false) !== enabledFilter) return false;
      if (groupFilter && String(item.group || '') !== groupFilter) return false;
      if (keyword) {
        const haystack = `${item.name || ''}\n${item.url || ''}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });
    const { page, pageSize } = parsePagination(url);
    return createExternalSuccess(
      paginate(filtered.map(toExternalSubscription), page, pageSize),
      200,
      buildListMeta({ page, pageSize, total: filtered.length })
    );
  }

  if (request.method === 'GET' && id) {
    const item = await getSubscriptionById(storageAdapter, id);
    if (!item) return createExternalError('subscription_not_found', 'Subscription not found', 404);
    return createExternalSuccess(toExternalSubscription(item));
  }

  if (request.method === 'POST' && !id) {
    const payload = await readExternalJson(request);
    if (!String(payload?.name || '').trim()) return createExternalError('subscription_name_required', 'Subscription name is required', 400);
    if (!String(payload?.url || '').trim()) return createExternalError('subscription_url_required', 'Subscription URL is required', 400);
    if (!isRemoteSubscription(payload)) return createExternalError('invalid_subscription_url', 'Subscription URL must use http or https', 400);

    const all = await storageAdapter.getAllSubscriptions();
    const timestamp = nowIso();
    const item = {
      id: generateId('sub'),
      name: String(payload.name).trim(),
      url: String(payload.url).trim(),
      enabled: payload.enabled !== false,
      group: String(payload.group || '').trim(),
      tags: normalizeStringArray(payload.tags),
      userAgent: String(payload.userAgent || '').trim(),
      customUserAgent: String(payload.userAgent || '').trim(),
      proxy: String(payload.proxy || '').trim(),
      fetchProxy: String(payload.proxy || '').trim(),
      sortIndex: Number.isFinite(Number(payload.sortIndex)) ? Number(payload.sortIndex) : nextSortIndex(all),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await storageAdapter.putSubscription(item);
    return createExternalSuccess(toExternalSubscription(item), 201);
  }

  if (request.method === 'PATCH' && id) {
    const current = await getSubscriptionById(storageAdapter, id);
    if (!current) return createExternalError('subscription_not_found', 'Subscription not found', 404);
    const payload = await readExternalJson(request);
    const updated = {
      ...current,
      ...(payload.name !== undefined ? { name: String(payload.name || '').trim() } : {}),
      ...(payload.url !== undefined ? { url: String(payload.url || '').trim() } : {}),
      ...(payload.enabled !== undefined ? { enabled: payload.enabled !== false } : {}),
      ...(payload.group !== undefined ? { group: String(payload.group || '').trim() } : {}),
      ...(payload.tags !== undefined ? { tags: normalizeStringArray(payload.tags) } : {}),
      ...(payload.userAgent !== undefined ? { userAgent: String(payload.userAgent || '').trim(), customUserAgent: String(payload.userAgent || '').trim() } : {}),
      ...(payload.proxy !== undefined ? { proxy: String(payload.proxy || '').trim(), fetchProxy: String(payload.proxy || '').trim() } : {}),
      ...(payload.sortIndex !== undefined ? { sortIndex: Number(payload.sortIndex) || 0 } : {}),
      updatedAt: nowIso()
    };
    if (!String(updated.name || '').trim()) return createExternalError('subscription_name_required', 'Subscription name is required', 400);
    if (!String(updated.url || '').trim()) return createExternalError('subscription_url_required', 'Subscription URL is required', 400);
    if (!isRemoteSubscription(updated)) return createExternalError('invalid_subscription_url', 'Subscription URL must use http or https', 400);
    await storageAdapter.putSubscription(updated);
    return createExternalSuccess(toExternalSubscription(updated));
  }

  if (request.method === 'DELETE' && id) {
    const current = await getSubscriptionById(storageAdapter, id);
    if (!current) return createExternalError('subscription_not_found', 'Subscription not found', 404);
    await storageAdapter.deleteSubscriptionById(id);
    const removedFromProfiles = await removeSubscriptionIdFromProfiles(storageAdapter, id);
    return createExternalSuccess({ deleted: true, id, removedFromProfiles });
  }

  return createExternalError('method_not_allowed', 'Method Not Allowed', 405);
}
