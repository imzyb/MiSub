import { describe, expect, it } from 'vitest';
import { groupNodeLinesByRegion } from '../../functions/modules/subscription/region-groups.js';

describe('region group overrides', () => {
    it('should allow user-defined regex rules to override the built-in region guess', () => {
        const groups = groupNodeLinesByRegion([
            { name: '机场A 新加坡 原生', tag: '机场A 新加坡 原生' },
            { name: '机场A US-West', tag: '机场A US-West' }
        ], {
            regionOverrides: [
                { pattern: '新加坡 原生', region: '美国' }
            ]
        });

        const usGroup = groups.find(group => group.name === '🇺🇸 美国节点');
        const sgGroup = groups.find(group => group.name === '🇸🇬 狮城节点');

        expect(usGroup?.tags).toContain('机场A 新加坡 原生');
        expect(usGroup?.tags).toContain('机场A US-West');
        expect(sgGroup).toBeUndefined();
    });
});
