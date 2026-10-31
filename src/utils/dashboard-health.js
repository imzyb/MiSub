import { getSubscriptionTrafficState } from './dashboard-deeplink.js';

const DEFAULT_NOW = () => Date.now();

function getTokenState(settings = {}) {
    const token = settings.mytoken;
    if (!token) return 'missing';
    if (token === 'auto') return 'auto';
    return 'stable';
}

function getTrafficState(sub, now) {
    return getSubscriptionTrafficState(sub, now);
}

export function shouldShowFullGuide({ subscriptions = [], profiles = [] } = {}) {
    return subscriptions.length === 0 || profiles.length === 0;
}

/**
 * Derive the dashboard "待处理事项" list from the current data snapshot.
 *
 * Returns ALL matching items (no truncation) so callers can decide how many to
 * render and surface a "show more" affordance for the remainder.
 *
 * Item shape:
 * - id                   stable identifier, also used as v-for key
 * - tone                 'danger' | 'warning' | 'info'
 * - titleKey / titleParams       i18n key + params for the title
 * - descriptionKey               i18n key for the description
 * - actionLabelKey               i18n key for the primary button (optional)
 * - actionRoute          primary navigation target (optional)
 * - actionQuery          query for the primary target (optional)
 * - secondaryActionLabelKey      i18n key for the secondary button (optional)
 * - action               secondary action key, e.g. 'openLog' (optional)
 * - count                affected item count for pluralised titles (optional)
 *
 * Titles/descriptions are returned as i18n keys rather than copy so the English
 * UI no longer leaks the Chinese strings that used to be hardcoded here.
 * Consumers resolve them via `resolveHealthItemCopy(item, t)`.
 */
export function getDashboardHealthItems({
    subscriptions = [],
    profiles = [],
    settings = {},
    totalNodesCount = null,
    now = DEFAULT_NOW(),
} = {}) {
    const items = [];
    const enabledSubscriptions = subscriptions.filter((sub) => sub.enabled);
    const disabledSubscriptions = subscriptions.filter((sub) => !sub.enabled);
    const activeProfiles = profiles.filter((profile) => profile.enabled !== false);
    const tokenState = getTokenState(settings);
    const resolvedTotalNodes =
        totalNodesCount ?? subscriptions.reduce((sum, sub) => sum + Number(sub.nodeCount || 0), 0);
    const errorSubscriptions = subscriptions.filter((sub) => Boolean(sub.lastError));
    const expiredSubscriptions = subscriptions.filter(
        (sub) => getTrafficState(sub, now) === 'expired'
    );
    const lowTrafficSubscriptions = subscriptions.filter(
        (sub) => getTrafficState(sub, now) === 'low'
    );

    if (subscriptions.length === 0) {
        items.push({
            id: 'missing-subscriptions',
            tone: 'warning',
            titleKey: 'dashboard.healthItems.missingSubscriptions.title',
            descriptionKey: 'dashboard.healthItems.missingSubscriptions.description',
            actionLabelKey: 'dashboard.healthItems.missingSubscriptions.action',
            actionRoute: '/dashboard/subscriptions',
            actionQuery: { status: 'missing' },
        });
    } else if (enabledSubscriptions.length === 0) {
        items.push({
            id: 'no-enabled-subscriptions',
            tone: 'danger',
            titleKey: 'dashboard.healthItems.noEnabledSubscriptions.title',
            descriptionKey: 'dashboard.healthItems.noEnabledSubscriptions.description',
            actionLabelKey: 'dashboard.healthItems.noEnabledSubscriptions.action',
            actionRoute: '/dashboard/subscriptions',
            actionQuery: { status: 'disabled' },
        });
    }

    if (profiles.length === 0) {
        items.push({
            id: 'missing-profiles',
            tone: 'warning',
            titleKey: 'dashboard.healthItems.missingProfiles.title',
            descriptionKey: 'dashboard.healthItems.missingProfiles.description',
            actionLabelKey: 'dashboard.healthItems.missingProfiles.action',
            actionRoute: '/dashboard/subscriptions',
            actionQuery: { focus: 'profiles' },
        });
    } else if (activeProfiles.length === 0) {
        items.push({
            id: 'no-active-profiles',
            tone: 'warning',
            titleKey: 'dashboard.healthItems.noActiveProfiles.title',
            descriptionKey: 'dashboard.healthItems.noActiveProfiles.description',
            actionLabelKey: 'dashboard.healthItems.noActiveProfiles.action',
            actionRoute: '/dashboard/subscriptions',
            actionQuery: { status: 'profiles-disabled' },
        });
    }

    if (tokenState === 'missing') {
        items.push({
            id: 'missing-token',
            tone: 'danger',
            titleKey: 'dashboard.healthItems.missingToken.title',
            descriptionKey: 'dashboard.healthItems.missingToken.description',
            actionLabelKey: 'dashboard.healthItems.missingToken.action',
            actionRoute: '/dashboard/settings',
            actionQuery: { focus: 'mytoken' },
        });
    } else if (tokenState === 'auto') {
        items.push({
            id: 'auto-token',
            tone: 'warning',
            titleKey: 'dashboard.healthItems.autoToken.title',
            descriptionKey: 'dashboard.healthItems.autoToken.description',
            actionLabelKey: 'dashboard.healthItems.autoToken.action',
            actionRoute: '/dashboard/settings',
            actionQuery: { focus: 'mytoken' },
        });
    }

    if (subscriptions.length > 0 && resolvedTotalNodes === 0) {
        items.push({
            id: 'zero-nodes',
            tone: 'danger',
            titleKey: 'dashboard.healthItems.zeroNodes.title',
            descriptionKey: 'dashboard.healthItems.zeroNodes.description',
            actionLabelKey: 'dashboard.healthItems.zeroNodes.action',
            actionRoute: '/dashboard/subscriptions',
            actionQuery: { status: 'zero-nodes' },
        });
    }

    if (errorSubscriptions.length > 0) {
        items.push({
            id: 'subscription-errors',
            tone: 'danger',
            titleKey: 'dashboard.healthItems.subscriptionErrors.title',
            titleParams: { count: errorSubscriptions.length },
            descriptionKey: 'dashboard.healthItems.subscriptionErrors.description',
            actionLabelKey: 'dashboard.healthItems.subscriptionErrors.action',
            actionRoute: '/dashboard/subscriptions',
            actionQuery: { status: 'error' },
            secondaryActionLabelKey: 'dashboard.healthItems.subscriptionErrors.secondaryAction',
            action: 'openLog',
            count: errorSubscriptions.length,
        });
    }

    if (expiredSubscriptions.length > 0) {
        items.push({
            id: 'expired-subscriptions',
            tone: 'danger',
            titleKey: 'dashboard.healthItems.expiredSubscriptions.title',
            titleParams: { count: expiredSubscriptions.length },
            descriptionKey: 'dashboard.healthItems.expiredSubscriptions.description',
            actionLabelKey: 'dashboard.healthItems.expiredSubscriptions.action',
            actionRoute: '/dashboard/subscriptions',
            actionQuery: { status: 'expired' },
            count: expiredSubscriptions.length,
        });
    }

    if (lowTrafficSubscriptions.length > 0) {
        items.push({
            id: 'low-traffic',
            tone: 'warning',
            titleKey: 'dashboard.healthItems.lowTraffic.title',
            titleParams: { count: lowTrafficSubscriptions.length },
            descriptionKey: 'dashboard.healthItems.lowTraffic.description',
            actionLabelKey: 'dashboard.healthItems.lowTraffic.action',
            actionRoute: '/dashboard/subscriptions',
            actionQuery: { status: 'low-traffic' },
            count: lowTrafficSubscriptions.length,
        });
    }

    if (disabledSubscriptions.length > 0 && enabledSubscriptions.length > 0) {
        items.push({
            id: 'disabled-subscriptions',
            tone: 'info',
            titleKey: 'dashboard.healthItems.disabledSubscriptions.title',
            titleParams: { count: disabledSubscriptions.length },
            descriptionKey: 'dashboard.healthItems.disabledSubscriptions.description',
            actionLabelKey: 'dashboard.healthItems.disabledSubscriptions.action',
            actionRoute: '/dashboard/subscriptions',
            actionQuery: { status: 'disabled' },
            count: disabledSubscriptions.length,
        });
    }

    return items;
}

/**
 * Resolve an item's i18n keys into display copy using the given translator.
 * Falls back to the raw key when a translation is missing, which keeps
 * incomplete locales from rendering blank cards.
 */
export function resolveHealthItemCopy(item, t) {
    if (!item || typeof t !== 'function') return item;

    const translate = (key, params) => {
        if (!key) return '';
        const value = t(key, params);
        return value === undefined || value === null ? '' : value;
    };

    return {
        ...item,
        title: translate(item.titleKey, item.titleParams),
        description: translate(item.descriptionKey),
        actionLabel: translate(item.actionLabelKey),
        secondaryActionLabel: translate(item.secondaryActionLabelKey),
    };
}
