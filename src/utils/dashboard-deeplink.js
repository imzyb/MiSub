/**
 * Shared handling for the `?status=` / `?focus=` deep-link params that the
 * dashboard's health cards and setup checklist attach to their action buttons.
 *
 * Why this exists: those buttons used to navigate with `?status=error` /
 * `?focus=mytoken` but no downstream view read the query, so every action
 * degraded into a bare navigation that landed on an unfiltered page.
 *
 * The helpers here are deliberately pure so both the views and the tests can
 * share one definition of the contract.
 */

/**
 * Subscription status filters keyed by the `?status=` value emitted from the
 * dashboard. Mirrors the ids in `getDashboardHealthItems`.
 */
export const SUBSCRIPTION_STATUS_FILTERS = {
    missing: 'all',
    disabled: 'disabled',
    error: 'error',
    expired: 'expired',
    'low-traffic': 'low-traffic',
    'zero-nodes': 'zero-nodes',
};

/**
 * Normalise an unknown `?status=` value into a known subscription filter id.
 * Returns `null` when the value is absent or unrecognised, so callers can fall
 * back to their default (unfiltered) behaviour.
 */
export function resolveSubscriptionStatusFilter(status) {
    if (typeof status !== 'string') return null;
    const key = status.trim().toLowerCase();
    if (!key) return null;
    return Object.prototype.hasOwnProperty.call(SUBSCRIPTION_STATUS_FILTERS, key)
        ? SUBSCRIPTION_STATUS_FILTERS[key]
        : null;
}

/**
 * True when the given subscription matches the active status filter.
 * `all` (and any unknown value) matches everything.
 *
 * `now` is injectable so time-dependent filters stay deterministic in tests.
 */
export function matchesSubscriptionStatus(sub, filter, now = Date.now()) {
    if (!filter || filter === 'all') return true;
    if (!sub) return false;

    switch (filter) {
        case 'disabled':
            return !sub.enabled;
        case 'error':
            return Boolean(sub.lastError);
        case 'expired':
            return getSubscriptionTrafficState(sub, now) === 'expired';
        case 'low-traffic':
            return getSubscriptionTrafficState(sub, now) === 'low';
        case 'zero-nodes':
            return Number(sub.nodeCount || 0) === 0;
        default:
            return true;
    }
}

/**
 * Mirrors the traffic classification used by `dashboard-health.js` so the
 * dashboard badge and the filtered list agree on what "expired"/"low" means.
 */
export function getSubscriptionTrafficState(sub, now = Date.now()) {
    const info = sub?.userInfo;
    if (!sub?.enabled || !info) return null;

    const total = Number(info.total || 0);
    const used = Number(info.upload || 0) + Number(info.download || 0);
    const expire = Number(info.expire || 0);

    if (expire > 0 && expire * 1000 < now) return 'expired';
    if (total > 0 && Math.max(0, total - used) / total <= 0.2) return 'low';
    return null;
}

/**
 * Settings tab ids keyed by the `?focus=` value emitted from the dashboard.
 * Lookups are case-insensitive, so keys are stored lowercased.
 */
export const SETTINGS_FOCUS_TABS = {
    mytoken: 'basic',
    profiletoken: 'basic',
};

/**
 * Anchor ids for the settings inputs the dashboard wants to highlight.
 */
export const SETTINGS_FOCUS_ANCHORS = {
    mytoken: 'setting-mytoken',
    profiletoken: 'setting-profileToken',
};

function normalizeFocusKey(focus) {
    if (typeof focus !== 'string') return '';
    return focus.trim().toLowerCase();
}

export function resolveSettingsFocusTab(focus) {
    const key = normalizeFocusKey(focus);
    if (!key) return null;
    return SETTINGS_FOCUS_TABS[key] || null;
}

export function resolveSettingsFocusAnchor(focus) {
    const key = normalizeFocusKey(focus);
    if (!key) return null;
    return SETTINGS_FOCUS_ANCHORS[key] || null;
}

/**
 * Profile list "focus" values. `profiles` means "scroll the user to the profile
 * section", which this project expresses by switching the subscriptions page
 * into its profile view.
 */
export function resolveProfileFocus(focus) {
    if (typeof focus !== 'string') return null;
    return focus.trim().toLowerCase() === 'profiles' ? 'profiles' : null;
}

/**
 * Count how many subscriptions match a filter — used for the "filtered" hint
 * the list shows so a deep-linked user understands why the list is short.
 */
export function countSubscriptionsByStatus(subscriptions = [], filter) {
    return subscriptions.filter((sub) => matchesSubscriptionStatus(sub, filter)).length;
}
