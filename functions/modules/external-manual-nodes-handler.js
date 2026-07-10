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
import { detectNodeProtocol, isManualNode, toExternalManualNode } from './external-api-mappers.js';
import { parseNodeList } from './utils/node-parser.js';

function nowIso() {
  return new Date().toISOString();
}

function generateId(prefix = 'node') {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `${prefix}_${crypto.randomUUID()}`;
  } catch {}
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nextSortIndex(items) {
  return items.reduce((max, item) => Math.max(max, Number(item?.sortIndex) || 0), 0) + 1;
}

async function loadManualNodes(storageAdapter) {
  const all = await storageAdapter.getAllSubscriptions();
  return sortBySortIndex(all.filter(isManualNode));
}

async function getManualNodeById(storageAdapter, id) {
  const item = await storageAdapter.getSubscriptionById(id);
  if (!item || !isManualNode(item)) return null;
  return item;
}

async function removeManualNodeIdFromProfiles(storageAdapter, id) {
  const profiles = await storageAdapter.getAllProfiles();
  const affected = [];
  for (const profile of profiles) {
    const manualNodes = Array.isArray(profile.manualNodes) ? profile.manualNodes : [];
    if (!manualNodes.includes(id)) continue;
    const updated = { ...profile, manualNodes: manualNodes.filter(item => item !== id), updatedAt: nowIso() };
    await storageAdapter.putProfile(updated);
    affected.push(profile.id);
  }
  return affected;
}

export async function handleExternalManualNodesRequest(request, env, selector = null) {
  const storageAdapter = await getExternalStorageAdapter(env);
  const url = new URL(request.url);
  const action = typeof selector === 'object' && selector ? selector.action || null : null;
  const id = typeof selector === 'object' && selector ? selector.id || null : selector;

  if (action === 'validate') {
    if (request.method !== 'POST') return createExternalError('method_not_allowed', 'Method Not Allowed', 405);
    const payload = await readExternalJson(request);
    const candidateUrl = String(payload?.url || '').trim();
    if (!candidateUrl) return createExternalError('manual_node_url_required', 'Manual node URL is required', 400);
    if (!isManualNode({ url: candidateUrl })) return createExternalError('invalid_manual_node_url', 'Manual node URL must use a supported node protocol', 400);
    const parsedNodes = parseNodeList(candidateUrl);
    if (!parsedNodes.length) return createExternalError('invalid_manual_node_url', 'Manual node URL must use a supported node protocol', 400);
    return createExternalSuccess({
      valid: true,
      requestedName: String(payload?.name || '').trim(),
      requestedUrl: candidateUrl,
      protocol: detectNodeProtocol(candidateUrl),
      nodeCount: parsedNodes.length,
      parsedNode: parsedNodes[0],
      checkedAt: nowIso()
    });
  }

  if (request.method === 'GET' && !id) {
    const all = await loadManualNodes(storageAdapter);
    const enabledFilter = parseBooleanParam(url.searchParams.get('enabled'));
    const groupFilter = (url.searchParams.get('group') || '').trim();
    const protocolFilter = (url.searchParams.get('protocol') || '').trim().toLowerCase();
    const keyword = (url.searchParams.get('keyword') || '').trim().toLowerCase();
    const filtered = all.filter(item => {
      if (enabledFilter !== undefined && (item.enabled !== false) !== enabledFilter) return false;
      if (groupFilter && String(item.group || '') !== groupFilter) return false;
      if (protocolFilter && detectNodeProtocol(item.url) !== protocolFilter) return false;
      if (keyword) {
        const haystack = `${item.name || ''}\n${item.url || ''}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });
    const { page, pageSize } = parsePagination(url);
    return createExternalSuccess(
      paginate(filtered.map(toExternalManualNode), page, pageSize),
      200,
      buildListMeta({ page, pageSize, total: filtered.length })
    );
  }

  if (request.method === 'GET' && id) {
    const item = await getManualNodeById(storageAdapter, id);
    if (!item) return createExternalError('manual_node_not_found', 'Manual node not found', 404);
    return createExternalSuccess(toExternalManualNode(item));
  }

  if (request.method === 'POST' && !id) {
    const payload = await readExternalJson(request);
    if (!String(payload?.name || '').trim()) return createExternalError('manual_node_name_required', 'Manual node name is required', 400);
    if (!String(payload?.url || '').trim()) return createExternalError('manual_node_url_required', 'Manual node URL is required', 400);
    if (!isManualNode(payload)) return createExternalError('invalid_manual_node_url', 'Manual node URL must use a supported node protocol', 400);

    const all = await storageAdapter.getAllSubscriptions();
    const timestamp = nowIso();
    const item = {
      id: generateId('node'),
      name: String(payload.name).trim(),
      url: String(payload.url).trim(),
      enabled: payload.enabled !== false,
      group: String(payload.group || '').trim(),
      tags: normalizeStringArray(payload.tags),
      remarks: String(payload.remarks || '').trim(),
      sortIndex: Number.isFinite(Number(payload.sortIndex)) ? Number(payload.sortIndex) : nextSortIndex(all),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await storageAdapter.putSubscription(item);
    return createExternalSuccess(toExternalManualNode(item), 201);
  }

  if (request.method === 'PATCH' && id) {
    const current = await getManualNodeById(storageAdapter, id);
    if (!current) return createExternalError('manual_node_not_found', 'Manual node not found', 404);
    const payload = await readExternalJson(request);
    const updated = {
      ...current,
      ...(payload.name !== undefined ? { name: String(payload.name || '').trim() } : {}),
      ...(payload.url !== undefined ? { url: String(payload.url || '').trim() } : {}),
      ...(payload.enabled !== undefined ? { enabled: payload.enabled !== false } : {}),
      ...(payload.group !== undefined ? { group: String(payload.group || '').trim() } : {}),
      ...(payload.tags !== undefined ? { tags: normalizeStringArray(payload.tags) } : {}),
      ...(payload.remarks !== undefined ? { remarks: String(payload.remarks || '').trim() } : {}),
      ...(payload.sortIndex !== undefined ? { sortIndex: Number(payload.sortIndex) || 0 } : {}),
      updatedAt: nowIso()
    };
    if (!String(updated.name || '').trim()) return createExternalError('manual_node_name_required', 'Manual node name is required', 400);
    if (!String(updated.url || '').trim()) return createExternalError('manual_node_url_required', 'Manual node URL is required', 400);
    if (!isManualNode(updated)) return createExternalError('invalid_manual_node_url', 'Manual node URL must use a supported node protocol', 400);
    await storageAdapter.putSubscription(updated);
    return createExternalSuccess(toExternalManualNode(updated));
  }

  if (request.method === 'DELETE' && id) {
    const current = await getManualNodeById(storageAdapter, id);
    if (!current) return createExternalError('manual_node_not_found', 'Manual node not found', 404);
    await storageAdapter.deleteSubscriptionById(id);
    const removedFromProfiles = await removeManualNodeIdFromProfiles(storageAdapter, id);
    return createExternalSuccess({ deleted: true, id, removedFromProfiles });
  }

  return createExternalError('method_not_allowed', 'Method Not Allowed', 405);
}
