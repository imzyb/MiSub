import { StorageFactory } from '../storage-adapter.js';
import { KV_KEY_SETTINGS } from './config.js';
import { createJsonResponse, JSON_BODY_LIMITS, readJsonWithLimit } from './utils.js';

export async function getExternalStorageAdapter(env) {
  if (env?.__TEST_STORAGE_ADAPTER) return env.__TEST_STORAGE_ADAPTER;
  const storageType = await StorageFactory.getStorageType(env);
  return StorageFactory.createAdapter(env, storageType);
}

export function createRequestId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `req_${crypto.randomUUID()}`;
    }
  } catch {}
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createExternalSuccess(data, status = 200, meta = undefined) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return createJsonResponse(body, status);
}

export function createExternalError(code, message, status = 400, details = undefined) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  return createJsonResponse({ success: false, error }, status);
}

export function parseBooleanParam(value) {
  if (value == null || value === '') return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return undefined;
}

export function parsePagination(url) {
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get('pageSize')) || 50));
  return { page, pageSize };
}

export function buildListMeta({ page, pageSize, total }) {
  return { page, pageSize, total, requestId: createRequestId() };
}

export function paginate(items, page, pageSize) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export async function readExternalJson(request) {
  try {
    return await readJsonWithLimit(request, JSON_BODY_LIMITS.normal);
  } catch (error) {
    throw Object.assign(new Error(error?.message || 'Invalid JSON'), {
      status: error?.status || 400,
      code: 'invalid_json'
    });
  }
}

export async function getExternalApiSettings(env, storageAdapter = null) {
  const adapter = storageAdapter || await getExternalStorageAdapter(env);
  const settings = await adapter.get(KV_KEY_SETTINGS) || {};
  return settings.externalApi || {};
}

export function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(item => String(item || '').trim()).filter(Boolean);
}

export function sortBySortIndex(items) {
  return [...items].sort((a, b) => {
    const aIndex = Number(a?.sortIndex) || 0;
    const bIndex = Number(b?.sortIndex) || 0;
    return aIndex - bIndex;
  });
}
