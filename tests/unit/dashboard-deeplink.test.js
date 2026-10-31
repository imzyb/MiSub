import { describe, expect, it } from 'vitest';
import {
    resolveSubscriptionStatusFilter,
    matchesSubscriptionStatus,
    getSubscriptionTrafficState,
    resolveSettingsFocusTab,
    resolveSettingsFocusAnchor,
    resolveProfileFocus,
    countSubscriptionsByStatus,
} from '../../src/utils/dashboard-deeplink.js';

const now = 1_800_000_000_000;

const sub = (over = {}) => ({ id: 's', enabled: true, nodeCount: 3, ...over });

describe('dashboard deep-link helpers', () => {
    describe('subscription status filter', () => {
        it('maps every status the dashboard emits to a known filter', () => {
            // These are the exact values produced by getDashboardHealthItems.
            expect(resolveSubscriptionStatusFilter('missing')).toBe('all');
            expect(resolveSubscriptionStatusFilter('disabled')).toBe('disabled');
            expect(resolveSubscriptionStatusFilter('error')).toBe('error');
            expect(resolveSubscriptionStatusFilter('expired')).toBe('expired');
            expect(resolveSubscriptionStatusFilter('low-traffic')).toBe('low-traffic');
            expect(resolveSubscriptionStatusFilter('zero-nodes')).toBe('zero-nodes');
        });

        it('returns null for absent or unrecognised values', () => {
            expect(resolveSubscriptionStatusFilter(undefined)).toBeNull();
            expect(resolveSubscriptionStatusFilter('')).toBeNull();
            expect(resolveSubscriptionStatusFilter('   ')).toBeNull();
            expect(resolveSubscriptionStatusFilter('bogus')).toBeNull();
            expect(resolveSubscriptionStatusFilter(['error'])).toBeNull();
        });

        it('is case and whitespace tolerant', () => {
            expect(resolveSubscriptionStatusFilter('  ERROR ')).toBe('error');
            expect(resolveSubscriptionStatusFilter('Low-Traffic')).toBe('low-traffic');
        });

        it('classifies subscriptions by the shared traffic rules', () => {
            const expired = sub({
                userInfo: { total: 100, upload: 1, download: 1, expire: now / 1000 - 60 },
            });
            const low = sub({ userInfo: { total: 100, upload: 85, download: 0 } });
            const healthy = sub({ userInfo: { total: 100, upload: 1, download: 0 } });

            expect(getSubscriptionTrafficState(expired, now)).toBe('expired');
            expect(getSubscriptionTrafficState(low, now)).toBe('low');
            expect(getSubscriptionTrafficState(healthy, now)).toBeNull();
        });

        it('ignores traffic for disabled subscriptions', () => {
            const disabled = sub({
                enabled: false,
                userInfo: { total: 100, upload: 95, download: 0 },
            });
            expect(getSubscriptionTrafficState(disabled, now)).toBeNull();
        });

        it('matches each filter against the right predicate', () => {
            expect(matchesSubscriptionStatus(sub({ enabled: false }), 'disabled')).toBe(true);
            expect(matchesSubscriptionStatus(sub(), 'disabled')).toBe(false);

            expect(matchesSubscriptionStatus(sub({ lastError: 'boom' }), 'error')).toBe(true);
            expect(matchesSubscriptionStatus(sub(), 'error')).toBe(false);

            expect(matchesSubscriptionStatus(sub({ nodeCount: 0 }), 'zero-nodes')).toBe(true);
            expect(matchesSubscriptionStatus(sub({ nodeCount: 2 }), 'zero-nodes')).toBe(false);

            const expired = sub({
                userInfo: { total: 100, upload: 1, download: 1, expire: now / 1000 - 60 },
            });
            expect(matchesSubscriptionStatus(expired, 'expired', now)).toBe(true);
        });

        it('treats `all` and unknown filters as pass-through', () => {
            expect(matchesSubscriptionStatus(sub({ enabled: false }), 'all')).toBe(true);
            expect(matchesSubscriptionStatus(sub(), '')).toBe(true);
            expect(matchesSubscriptionStatus(sub(), undefined)).toBe(true);
        });

        it('counts the subscriptions a filter would show', () => {
            const list = [
                sub({ id: 'a', lastError: 'x' }),
                sub({ id: 'b' }),
                sub({ id: 'c', lastError: 'y' }),
            ];
            expect(countSubscriptionsByStatus(list, 'error')).toBe(2);
            expect(countSubscriptionsByStatus(list, 'all')).toBe(3);
        });
    });

    describe('settings focus', () => {
        it('maps token focus values onto the basic tab', () => {
            expect(resolveSettingsFocusTab('mytoken')).toBe('basic');
            expect(resolveSettingsFocusTab('profileToken')).toBe('basic');
        });

        it('resolves anchor ids for the target inputs', () => {
            expect(resolveSettingsFocusAnchor('mytoken')).toBe('setting-mytoken');
            expect(resolveSettingsFocusAnchor('profileToken')).toBe('setting-profileToken');
        });

        it('returns null for unknown focus values so callers keep defaults', () => {
            expect(resolveSettingsFocusTab('nope')).toBeNull();
            expect(resolveSettingsFocusTab(undefined)).toBeNull();
            expect(resolveSettingsFocusAnchor('nope')).toBeNull();
        });
    });

    describe('profile focus', () => {
        it('recognises the profiles focus value only', () => {
            expect(resolveProfileFocus('profiles')).toBe('profiles');
            expect(resolveProfileFocus('  PROFILES ')).toBe('profiles');
            expect(resolveProfileFocus('mytoken')).toBeNull();
            expect(resolveProfileFocus(undefined)).toBeNull();
        });
    });
});
