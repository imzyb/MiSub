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
import { isManualNode, isRemoteSubscription, toExternalProfile } from './external-api-mappers.js';
import { inspectRemoteSubscription } from './external-subscriptions-handler.js';

function nowIso() {
  return new Date().toISOString();
}

function generateId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {}
  return `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadProfiles(storageAdapter) {
  return sortBySortIndex(await storageAdapter.getAllProfiles());
}

async function getProfileById(storageAdapter, id) {
  return await storageAdapter.getProfileById(id);
}

async function validateProfileReferences(storageAdapter, subscriptionIds = undefined, manualNodeIds = undefined) {
  const allSubscriptions = await storageAdapter.getAllSubscriptions();
  const byId = new Map(allSubscriptions.map(item => [item.id, item]));

  if (subscriptionIds !== undefined) {
    for (const id of subscriptionIds) {
      const item = byId.get(id);
      if (!item) return createExternalError('subscription_id_not_found', `Subscription ${id} not found`, 400);
      if (!isRemoteSubscription(item)) return createExternalError('invalid_profile_reference', `Subscription ${id} is not a remote subscription`, 400);
    }
  }

  if (manualNodeIds !== undefined) {
    for (const id of manualNodeIds) {
      const item = byId.get(id);
      if (!item) return createExternalError('manual_node_id_not_found', `Manual node ${id} not found`, 400);
      if (!isManualNode(item)) return createExternalError('invalid_profile_reference', `Manual node ${id} is not a manual node`, 400);
    }
  }

  return null;
}

function dedupe(values) {
  return [...new Set(normalizeStringArray(values))];
}

async function refreshProfileSubscriptions(storageAdapter, env, profile) {
  const allSubscriptions = await storageAdapter.getAllSubscriptions();
  const byId = new Map(allSubscriptions.map(item => [item.id, item]));
  const remoteSubscriptions = (Array.isArray(profile.subscriptions) ? profile.subscriptions : [])
    .map(id => byId.get(id))
    .filter(item => item && isRemoteSubscription(item));
  const manualNodes = (Array.isArray(profile.manualNodes) ? profile.manualNodes : [])
    .map(id => byId.get(id))
    .filter(item => item && isManualNode(item));

  const results = [];
  for (const current of remoteSubscriptions) {
    const inspection = await inspectRemoteSubscription(env, current);
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

  return {
    profile: toExternalProfile(profile),
    results,
    summary: {
      totalSubscriptions: remoteSubscriptions.length,
      refreshedSubscriptions: results.filter(item => item.success).length,
      failedSubscriptions: results.filter(item => !item.success).length,
      manualNodes: manualNodes.length,
      totalNodes: results.filter(item => item.success).reduce((sum, item) => sum + (Number(item.nodeCount) || 0), 0) + manualNodes.length
    }
  };
}

export async function handleExternalProfilesRequest(request, env, { id = null, relation = null, action = null } = {}) {
  const storageAdapter = await getExternalStorageAdapter(env);
  const url = new URL(request.url);

  if (request.method === 'GET' && !id) {
    const profiles = await loadProfiles(storageAdapter);
    const enabledFilter = parseBooleanParam(url.searchParams.get('enabled'));
    const keyword = (url.searchParams.get('keyword') || '').trim().toLowerCase();
    const filtered = profiles.filter(profile => {
      if (enabledFilter !== undefined && (profile.enabled !== false) !== enabledFilter) return false;
      if (keyword) {
        const haystack = `${profile.name || ''}\n${profile.description || ''}\n${profile.customId || ''}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });
    const { page, pageSize } = parsePagination(url);
    return createExternalSuccess(
      paginate(filtered.map(toExternalProfile), page, pageSize),
      200,
      buildListMeta({ page, pageSize, total: filtered.length })
    );
  }

  if (request.method === 'GET' && id && !relation && !action) {
    const profile = await getProfileById(storageAdapter, id);
    if (!profile) return createExternalError('profile_not_found', 'Profile not found', 404);
    return createExternalSuccess(toExternalProfile(profile));
  }

  if (request.method === 'POST' && id && action === 'refresh') {
    const profile = await getProfileById(storageAdapter, id);
    if (!profile) return createExternalError('profile_not_found', 'Profile not found', 404);
    return createExternalSuccess(await refreshProfileSubscriptions(storageAdapter, env, profile));
  }

  if (request.method === 'POST' && !id) {
    const payload = await readExternalJson(request);
    if (!String(payload?.name || '').trim()) return createExternalError('profile_name_required', 'Profile name is required', 400);
    const subscriptionIds = payload.subscriptionIds !== undefined ? dedupe(payload.subscriptionIds) : [];
    const manualNodeIds = payload.manualNodeIds !== undefined ? dedupe(payload.manualNodeIds) : [];
    const validationError = await validateProfileReferences(storageAdapter, subscriptionIds, manualNodeIds);
    if (validationError) return validationError;
    const timestamp = nowIso();
    const allProfiles = await storageAdapter.getAllProfiles();
    const profile = {
      id: generateId(),
      name: String(payload.name).trim(),
      description: String(payload.description || '').trim(),
      enabled: payload.enabled !== false,
      isPublic: payload.isPublic === true,
      customId: String(payload.customId || '').trim(),
      subscriptions: subscriptionIds,
      manualNodes: manualNodeIds,
      target: String(payload.target || 'clash').trim() || 'clash',
      sortIndex: Number.isFinite(Number(payload.sortIndex)) ? Number(payload.sortIndex) : allProfiles.reduce((max, item) => Math.max(max, Number(item?.sortIndex) || 0), 0) + 1,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await storageAdapter.putProfile(profile);
    return createExternalSuccess(toExternalProfile(profile), 201);
  }

  if (request.method === 'PATCH' && id && !relation) {
    const current = await getProfileById(storageAdapter, id);
    if (!current) return createExternalError('profile_not_found', 'Profile not found', 404);
    const payload = await readExternalJson(request);
    const subscriptionIds = payload.subscriptionIds !== undefined ? dedupe(payload.subscriptionIds) : undefined;
    const manualNodeIds = payload.manualNodeIds !== undefined ? dedupe(payload.manualNodeIds) : undefined;
    const validationError = await validateProfileReferences(storageAdapter, subscriptionIds, manualNodeIds);
    if (validationError) return validationError;
    const updated = {
      ...current,
      ...(payload.name !== undefined ? { name: String(payload.name || '').trim() } : {}),
      ...(payload.description !== undefined ? { description: String(payload.description || '').trim() } : {}),
      ...(payload.enabled !== undefined ? { enabled: payload.enabled !== false } : {}),
      ...(payload.isPublic !== undefined ? { isPublic: payload.isPublic === true } : {}),
      ...(payload.customId !== undefined ? { customId: String(payload.customId || '').trim() } : {}),
      ...(payload.target !== undefined ? { target: String(payload.target || 'clash').trim() || 'clash' } : {}),
      ...(payload.sortIndex !== undefined ? { sortIndex: Number(payload.sortIndex) || 0 } : {}),
      ...(subscriptionIds !== undefined ? { subscriptions: subscriptionIds } : {}),
      ...(manualNodeIds !== undefined ? { manualNodes: manualNodeIds } : {}),
      updatedAt: nowIso()
    };
    if (!String(updated.name || '').trim()) return createExternalError('profile_name_required', 'Profile name is required', 400);
    await storageAdapter.putProfile(updated);
    return createExternalSuccess(toExternalProfile(updated));
  }

  if (request.method === 'DELETE' && id && !relation) {
    const current = await getProfileById(storageAdapter, id);
    if (!current) return createExternalError('profile_not_found', 'Profile not found', 404);
    await storageAdapter.deleteProfileById(id);
    return createExternalSuccess({ deleted: true, id });
  }

  if ((request.method === 'POST' || request.method === 'DELETE') && id && (relation === 'subscriptions' || relation === 'manual-nodes')) {
    const current = await getProfileById(storageAdapter, id);
    if (!current) return createExternalError('profile_not_found', 'Profile not found', 404);
    const payload = await readExternalJson(request);
    const field = relation === 'subscriptions' ? 'subscriptions' : 'manualNodes';
    const bodyField = relation === 'subscriptions' ? 'subscriptionIds' : 'manualNodeIds';
    const incomingIds = dedupe(payload?.[bodyField]);
    const validationError = relation === 'subscriptions'
      ? await validateProfileReferences(storageAdapter, incomingIds, undefined)
      : await validateProfileReferences(storageAdapter, undefined, incomingIds);
    if (validationError) return validationError;
    const currentIds = Array.isArray(current[field]) ? current[field] : [];
    const nextIds = request.method === 'POST'
      ? [...new Set([...currentIds, ...incomingIds])]
      : currentIds.filter(item => !incomingIds.includes(item));
    const updated = { ...current, [field]: nextIds, updatedAt: nowIso() };
    await storageAdapter.putProfile(updated);
    return createExternalSuccess(toExternalProfile(updated));
  }

  return createExternalError('method_not_allowed', 'Method Not Allowed', 405);
}
