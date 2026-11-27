import { describe, expect, it } from 'vitest';
import {
    findLegacyInvalidAliases,
    normalizeProfileAliases,
    sanitizeProfileAlias,
    validateProfileAliases,
    validateProfileCandidate,
} from '../../functions/modules/profile-alias.js';

// 早期 customId 没有长度限制，库里可能留着这种 128 位的历史值
const LEGACY_LONG_ID =
    '0raswaes5ts8izlquol8nwj6pffyvf3sidx82u2utrgcgsr8a8opkoamptwe3s3hrka5bvzo1yhkgeymhlaw1hnjmum9tdzlmsts9ytznqwku6ubeflt7bjul63ze0z5';

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

describe('validateProfileAliases 存量豁免', () => {
    it('未改动的超长历史 customId 不再阻断保存', () => {
        const stored = [{ id: 'p1', name: '旧组', customId: LEGACY_LONG_ID }];
        const incoming = [{ id: 'p1', name: '旧组', customId: LEGACY_LONG_ID }];

        expect(validateProfileAliases(incoming).ok).toBe(false);
        expect(validateProfileAliases(incoming, { previousProfiles: stored }).ok).toBe(true);
    });

    it('保存无关改动时，历史超长 ID 不阻断其它字段的修改', () => {
        const stored = [{ id: 'p1', customId: LEGACY_LONG_ID }];
        const incoming = [{ id: 'p1', customId: LEGACY_LONG_ID, name: '改了名字' }];

        expect(validateProfileAliases(incoming, { previousProfiles: stored }).ok).toBe(true);
    });

    it('用户改动该字段后必须重新合法', () => {
        const stored = [{ id: 'p1', customId: LEGACY_LONG_ID }];
        const edited = [{ id: 'p1', customId: LEGACY_LONG_ID + 'x' }];

        const result = validateProfileAliases(edited, { previousProfiles: stored });
        expect(result.ok).toBe(false);
        expect(result.code).toBe('profile_alias_invalid');
    });

    it('新增组的超长 customId 仍然拒绝', () => {
        const result = validateProfileAliases([{ id: 'new', customId: LEGACY_LONG_ID }], {
            previousProfiles: [],
        });
        expect(result.ok).toBe(false);
        expect(result.code).toBe('profile_alias_invalid');
    });

    it('存量豁免不影响冲突检测', () => {
        const stored = [
            { id: 'p1', customId: 'home' },
            { id: 'p2' },
        ];
        const incoming = [
            { id: 'p1', customId: 'home' },
            { id: 'p2', customId: 'home' },
        ];

        expect(validateProfileAliases(incoming, { previousProfiles: stored }).code).toBe(
            'profile_alias_conflict'
        );
    });

    it('把历史超长值复制给另一个组会被判为非法', () => {
        const stored = [
            { id: 'p1', customId: LEGACY_LONG_ID },
            { id: 'p2' },
        ];
        const incoming = [
            { id: 'p1', customId: LEGACY_LONG_ID },
            { id: 'p2', customId: LEGACY_LONG_ID },
        ];

        // p2 是新增该值，不享受豁免，因此先撞上字符集/长度规则
        expect(validateProfileAliases(incoming, { previousProfiles: stored }).code).toBe(
            'profile_alias_invalid'
        );
    });

    it('外部 API 单条写入同样豁免未改动的存量值', () => {
        const all = [{ id: 'p1', customId: LEGACY_LONG_ID, name: '旧组' }];
        const candidate = { id: 'p1', customId: LEGACY_LONG_ID, name: '新名字' };

        expect(validateProfileCandidate(all, candidate).ok).toBe(true);
    });

    it('findLegacyInvalidAliases 报出需要手动修复的历史值', () => {
        const list = [
            { id: 'p1', name: '旧组', customId: LEGACY_LONG_ID },
            { id: 'p2', name: '新组', customId: 'home' },
        ];

        const found = findLegacyInvalidAliases(list);
        expect(found).toHaveLength(1);
        expect(found[0]).toMatchObject({ id: 'p1', field: 'customId' });
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
