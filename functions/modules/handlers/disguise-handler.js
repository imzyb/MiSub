
import { StorageFactory } from '../../storage-adapter.js';
import { KV_KEY_SETTINGS } from '../config.js';
import { createDisguiseResponse } from '../disguise-page.js';
import { authMiddleware } from '../auth-middleware.js';

/**
 * Handle Disguise Logic for Root and SPA paths.
 * Returns a Response if disguise should be effective (block access),
 * or null if access should be allowed (proceed to next handler/static asset).
 * 
 * @param {Object} context 
 * @param {Object} [preloadedSettings] Optional, if already fetched
 * @returns {Promise<Response|null>}
 */
export async function handleDisguiseRequest(context, preloadedSettings = null) {
    const { request, env } = context;
    const url = new URL(request.url);

    // 1. Get Settings
    let settings = preloadedSettings;
    if (!settings) {
        const { StorageFactory } = await import('../../storage-adapter.js');
        const { KV_KEY_SETTINGS } = await import('../config.js');
        const storageAdapter = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));
        const settingsData = await storageAdapter.get(KV_KEY_SETTINGS);
        settings = settingsData || {};
    }

    const disguise = settings.disguise;

    // Custom Login Path Logic (Priority: High)
    // If the user accessed the configured custom login path, ALWAYS allow access.
    // This bypasses the Disguise check.
    const customLoginPath = settings.customLoginPath ? '/' + settings.customLoginPath.replace(/^\//, '') : '/login';
    const defaultLoginPath = '/login';
    if (customLoginPath !== defaultLoginPath && url.pathname === defaultLoginPath) {
        return new Response(null, {
            status: 302,
            headers: { Location: customLoginPath }
        });
    }
    if (url.pathname === customLoginPath) {
        return null; // Allow access to custom login path
    }

    // If disguise is not enabled, allow everything.
    if (!disguise || !disguise.enabled) {
        return null; // Allow access
    }

    // 2. Check Authentication
    // If user is already logged in, they bypass disguise.
    const isAuthenticated = await authMiddleware(request, env);
    if (isAuthenticated) {
        return null; // Proceed
    }

    // 3. Disguise Logic
    // If we are here, User is NOT authenticated. we check if we should block the request.

    // [Public Page Logic]
    // If Public Page is enabled, we allow access to root '/' and '/explore'.
    // NOTE: We do NOT automatically allow /login here anymore if disguise is on.
    const isPublicAccessAllowed = settings.enablePublicPage && (url.pathname === '/' || url.pathname === '/explore');
    if (isPublicAccessAllowed) {
        return null; // Allow access
    }

    // List of protected SPA routes that should be hidden/disguised
    // Note: We don't need to list EVERY route, just the ones that exist.
    // Anything else falls through to 404 (or index.html -> 404), which is also disguised if it matches typical SPA behavior?
    // Actually, in [[path]].js we only call this handler for specific SPA routes or root.
    // So if we are here, we are already on a potentially protected path.
    // We just return the disguise response.

    // However, to be safe and consistent with previous logic, let's keep the check or just return disguise.
    // Since [[path]].js calls this ONLY for (root || isSpaRoute) && !static,
    // we can assume we SHOULD disguise if we reached here.

    return createDisguiseResponse(disguise, request.url);
}
