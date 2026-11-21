import { describe, expect, it } from 'vitest';
import {
    getProfileLinkIdentifier,
    resolveInternalProfile,
    resolvePublicProfile,
} from '../../functions/modules/subscription/profile-resolver.js';

const profiles = () => [
    { id: 'id-legacy', name: 'legacy' },
    { id: 'id-with-custom', customId: 'home', linkId: 'link-home' },
    { id: 'id-with-link', linkId: 'link-only' },
    { id: 'id-migrated', linkId: 'id-migrated' },
];

describe('resolvePublicProfile', () => {
    it('keeps legacy profiles reachable by their internal id before migration', () => {
        expect(resolvePublicProfile(profiles(), 'id-legacy')?.id).toBe('id-legacy');
    });

    it('resolves by linkId', () => {
        expect(resolvePublicProfile(profiles(), 'link-only')?.id).toBe('id-with-link');
    });

    it('does not expose the internal id once a linkId exists', () => {
        expect(resolvePublicProfile(profiles(), 'id-with-link')).toBeNull();
    });

    it('lets customId win and hides both linkId and the internal id', () => {
        const list = profiles();
        expect(resolvePublicProfile(list, 'home')?.id).toBe('id-with-custom');
        expect(resolvePublicProfile(list, 'link-home')).toBeNull();
        expect(resolvePublicProfile(list, 'id-with-custom')).toBeNull();
    });

    it('accepts the migrated shape where linkId equals the internal id', () => {
        expect(resolvePublicProfile(profiles(), 'id-migrated')?.id).toBe('id-migrated');
    });

    it('matches aliases case-insensitively', () => {
        expect(resolvePublicProfile(profiles(), 'HOME')?.id).toBe('id-with-custom');
    });

    it('returns null for empty identifiers', () => {
        expect(resolvePublicProfile(profiles(), '')).toBeNull();
        expect(resolvePublicProfile(profiles(), '   ')).toBeNull();
    });
});

describe('resolveInternalProfile', () => {
    it('still matches by id, customId and linkId for internal references', () => {
        const list = profiles();
        expect(resolveInternalProfile(list, 'id-with-custom')?.id).toBe('id-with-custom');
        expect(resolveInternalProfile(list, 'home')?.id).toBe('id-with-custom');
        expect(resolveInternalProfile(list, 'link-only')?.id).toBe('id-with-link');
    });
});

describe('getProfileLinkIdentifier', () => {
    it('prefers customId, then linkId, then id', () => {
        expect(getProfileLinkIdentifier({ id: 'a', linkId: 'b', customId: 'c' })).toBe('c');
        expect(getProfileLinkIdentifier({ id: 'a', linkId: 'b' })).toBe('b');
        expect(getProfileLinkIdentifier({ id: 'a' })).toBe('a');
        expect(getProfileLinkIdentifier(null)).toBe('');
    });
});
