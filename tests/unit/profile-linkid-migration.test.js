import { describe, expect, it } from 'vitest';
import { migrateProfileLinkIds } from '../../functions/modules/utils.js';

describe('migrateProfileLinkIds', () => {
    it('backfills linkId with the internal id so old links keep working', () => {
        const list = [{ id: 'uuid-1' }, { id: 'uuid-2', customId: 'home' }];
        expect(migrateProfileLinkIds(list)).toBe(true);
        expect(list[0].linkId).toBe('uuid-1');
        expect(list[1].linkId).toBe('uuid-2');
        expect(list[1].customId).toBe('home');
    });

    it('is idempotent and never overwrites an existing linkId', () => {
        const list = [{ id: 'uuid-1', linkId: 'rotated' }];
        expect(migrateProfileLinkIds(list)).toBe(false);
        expect(list[0].linkId).toBe('rotated');
    });

    it('tolerates malformed input', () => {
        expect(migrateProfileLinkIds(null)).toBe(false);
        expect(migrateProfileLinkIds([null, {}])).toBe(false);
    });
});
