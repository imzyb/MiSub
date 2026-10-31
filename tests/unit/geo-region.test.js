import { describe, expect, it } from 'vitest';
import { extractNodeRegion, getRegionEmoji } from '../../functions/modules/utils/geo-utils.js';
import { addFlagEmoji } from '../../functions/utils/node-utils.js';

function ss(name) {
    return `ss://YWVzLTI1Ni1nY206cGFzcw@example.com:443#${encodeURIComponent(name)}`;
}

function flagName(link) {
    return decodeURIComponent(link.split('#').pop());
}

describe('region flags', () => {
    it('识别澳门和朝鲜，台湾继续用中国国旗', () => {
        expect(extractNodeRegion('澳门 Debee-Po0')).toBe('澳门');
        expect(extractNodeRegion('澳门-Debee(Z)')).toBe('澳门');
        expect(extractNodeRegion('Macao CTM')).toBe('澳门');
        expect(getRegionEmoji('澳门')).toBe('🇲🇴');

        expect(extractNodeRegion('朝鲜 Debee-Po0')).toBe('朝鲜');
        expect(extractNodeRegion('朝鲜-Debee(Z)')).toBe('朝鲜');
        expect(extractNodeRegion('North Korea 1')).toBe('朝鲜');
        expect(getRegionEmoji('朝鲜')).toBe('🇰🇵');

        expect(extractNodeRegion('韩国 Legend')).toBe('韩国');
        expect(extractNodeRegion('台湾 BestVM-Po0')).toBe('台湾');
        expect(getRegionEmoji('台湾')).toBe('🇨🇳');
        expect(getRegionEmoji('中国')).toBe('🇨🇳');
        expect(extractNodeRegion('中国香港 HKT')).toBe('香港');
        expect(getRegionEmoji('保加利亚')).toBe('🇧🇬');
    });

    it('已有地球或国旗时不再重复补', () => {
        const macau = flagName(addFlagEmoji(ss('澳门 Debee-Po0')));
        expect(macau.startsWith('🇲🇴 ')).toBe(true);
        expect(macau.match(/🇲🇴/g)).toHaveLength(1);
        expect(flagName(addFlagEmoji(ss(macau))).match(/🇲🇴/g)).toHaveLength(1);

        const korea = flagName(addFlagEmoji(ss('朝鲜 Debee-Po0')));
        expect(korea.startsWith('🇰🇵 ')).toBe(true);

        const taiwan = flagName(addFlagEmoji(ss('台湾 BestVM')));
        expect(taiwan.startsWith('🇨🇳 ')).toBe(true);
        expect(taiwan.includes('🇹🇼')).toBe(false);

        const doubled = flagName(addFlagEmoji(ss('🌍 神秘节点')));
        expect(doubled.match(/🌍/g)).toHaveLength(1);
    });
});
