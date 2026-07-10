/**
 * Request-triggered scheduled tasks for Cloudflare Pages deployments.
 * Pages has no native Cron, so this runner performs cheap due checks when
 * subscription/admin/cron requests happen, then executes heavy work in waitUntil.
 */

import { StorageFactory, SettingsCache } from '../storage-adapter.js';
import { KV_KEY_SETTINGS } from './config.js';
import { performWebdavBackup } from './webdav-backup-handler.js';

const LOCK_KEY = 'misub_webdav_backup_lock';
const CHECK_THROTTLE_MS = 5 * 60 * 1000;
const LOCK_TTL_MS = 10 * 60 * 1000;

function parseTime(value) {
    const ts = Date.parse(value || '');
    return Number.isFinite(ts) ? ts : 0;
}

function intervalMs(interval) {
    switch (interval) {
        case 'hourly': return 60 * 60 * 1000;
        case 'weekly': return 7 * 24 * 60 * 60 * 1000;
        case 'monthly': return 30 * 24 * 60 * 60 * 1000;
        case 'daily':
        default: return 24 * 60 * 60 * 1000;
    }
}

async function getStorage(env) {
    const storageType = await StorageFactory.getStorageType(env);
    return StorageFactory.createAdapter(env, storageType);
}

export async function maybeRunScheduledTasks(context = {}, options = {}) {
    const env = context.env || context;
    if (!env) return { skipped: true, reason: 'missing-env' };

    const storageAdapter = await getStorage(env);
    const settings = await storageAdapter.get(KV_KEY_SETTINGS) || await SettingsCache.get(env) || {};
    const config = settings.webdavBackup || {};

    if (!config.enabled || !config.autoBackup) {
        return { skipped: true, reason: 'disabled' };
    }

    const now = Date.now();
    const lastCheckedAt = parseTime(config.lastCheckedAt);
    if (!options.forceCheck && lastCheckedAt && now - lastCheckedAt < CHECK_THROTTLE_MS) {
        return { skipped: true, reason: 'throttled' };
    }

    const updatedSettings = {
        ...settings,
        webdavBackup: {
            ...config,
            lastCheckedAt: new Date(now).toISOString()
        }
    };
    await storageAdapter.put(KV_KEY_SETTINGS, updatedSettings);
    SettingsCache.clear();

    const lastBackupAt = parseTime(config.lastBackupAt);
    if (!options.forceRun && lastBackupAt && now - lastBackupAt < intervalMs(config.interval)) {
        return { skipped: true, reason: 'not-due' };
    }

    const lock = await storageAdapter.get(LOCK_KEY).catch(() => null);
    if (lock?.expiresAt && parseTime(lock.expiresAt) > now) {
        return { skipped: true, reason: 'locked' };
    }

    await storageAdapter.put(LOCK_KEY, {
        lockedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + LOCK_TTL_MS).toISOString(),
        source: options.source || 'request'
    });

    const run = async () => {
        try {
            await performWebdavBackup(env, { trigger: options.source || 'lazy-cron' });
        } finally {
            await storageAdapter.delete?.(LOCK_KEY).catch(() => {});
        }
    };

    if (typeof context.waitUntil === 'function' && !options.awaitRun) {
        context.waitUntil(run());
        return { scheduled: true };
    }

    await run();
    return { scheduled: true, completed: true };
}
