import { describe, expect, it } from 'vitest';
import {
    normalizeProfileAliases,
    sanitizeProfileAlias,
    validateProfileAliases,
} from '../../functions/modules/profile-alias.js';

describe('validateProfileAliases', () => {
    it('accepts a clean set', () => {
        const list = [
            { id: 'id-a', customId: 'home' },
            { id: 'id-b', linkId: 'game-room' },
        ];
        expect(validateProfileAliases(list).ok).toBe(true);
    });

    it('allows the migrated shape linkId === own id', () => {
        expect(validateProfileAliases([{ id: 'uuid-1', linkId: 'uuid-1' }]).ok).toBe(true);
    });

    it('accepts a full 36-char UUID as linkId', () => {
        const uuid = '3f2c9a1e-7b44-4c1d-9f3a-2b8d6e5c0a17';
        expect(validateProfileAliases([{ id: uuid, linkId: uuid }]).ok).toBe(true);
    });

    it('rejects duplicate aliases across profiles', () => {
        const result = validateProfileAliases([
            { id: 'id-a', customId: 'home' },
            { id: 'id-b', customId: 'home' },
        ]);
        expect(result.ok).toBe(false);
        expect(result.code).toBe('profile_alias_conflict');
    });

    it('rejects an alias equal to another profile id', () => {
        const result = validateProfileAliases([
            { id: 'id-a', customId: 'id-b' },
            { id: 'id-b' },
        ]);
        expect(result.ok).toBe(false);
        expect(result.code).toBe('profile_alias_conflict');
    });

    it('rejects reserved words and configured tokens', () => {
        expect(validateProfileAliases([{ id: 'a', customId: 'sub' }]).code).toBe(
            'profile_alias_reserved'
        );
        expect(
            validateProfileAliases([{ id: 'a', customId: 'admintoken1' }], {
                mytoken: 'admintoken1',
            }).code
        ).toBe('profile_alias_reserved');
    });

    it('rejects invalid charset and length', () => {
        expect(validateProfileAliases([{ id: 'a', customId: 'has space' }]).code).toBe(
            'profile_alias_invalid'
        );
        expect(validateProfileAliases([{ id: 'a', customId: 'x' }]).code).toBe(
            'profile_alias_invalid'
        );
    });
});

describe('normalizeProfileAliases', () => {
    it('trims and lowercases aliases in place', () => {
        const list = [{ id: 'a', customId: '  Home  ', linkId: 'LINK' }];
        expect(normalizeProfileAliases(list)).toBe(true);
        expect(list[0].customId).toBe('home');
        expect(list[0].linkId).toBe('link');
    });

    it('reports no change for already clean values', () => {
        expect(normalizeProfileAliases([{ id: 'a', customId: 'home' }])).toBe(false);
    });

    it('sanitizeProfileAlias tolerates null', () => {
        expect(sanitizeProfileAlias(null)).toBe('');
    });
});
