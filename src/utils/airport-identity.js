import { inferAirportRootDomain } from './airport-domain.js';

/** Stable grouping key shared by list sorting and visual grouping. */
export function getAirportIdentityKey(subscription) {
    const identityKey = String(subscription?.airportIdentity?.groupId || '').trim();
    if (identityKey) return `identity:${identityKey}`;
    const root = inferAirportRootDomain(subscription?.url);
    if (root) return `site:${root}`;
    try {
        const host = new URL(subscription?.url).hostname.toLowerCase().replace(/^www\./, '');
        return host ? `site:${host}` : `id:${subscription?.id || ''}`;
    } catch {
        return `id:${subscription?.id || ''}`;
    }
}

export function getAirportIdentityName(subscription) {
    return String(subscription?.airportIdentity?.name || '').trim();
}

export function createAirportGroupId() {
    return (
        globalThis.crypto?.randomUUID?.() ||
        `airport-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
}

export function setAirportIdentity(subscription, groupId, name) {
    if (!subscription || typeof subscription !== 'object') return subscription;
    const normalizedId = String(groupId || '').trim();
    const normalizedName = String(name || '').trim();
    if (!normalizedId || !normalizedName) return subscription;
    subscription.airportIdentity = { groupId: normalizedId, name: normalizedName };
    return subscription;
}

export function resetAirportIdentity(subscription) {
    if (!subscription || typeof subscription !== 'object') return subscription;
    subscription.airportIdentity = null;
    return subscription;
}
