import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { generateBuiltinClashConfig } from '../../functions/modules/subscription/builtin-clash-generator.js';
import { resolveEffectiveNodeTransform } from '../../functions/modules/subscription/main-handler.js';

// 模拟 mihomo config.go:892 slices.Sort(AllProxies) —— Go string 是字节序
const goSort = (a) =>
    [...a].sort((x, y) => Buffer.compare(Buffer.from(x, 'utf8'), Buffer.from(y, 'utf8')));

const NAMES = [];
for (const [m, c] of [
    ['A100', 'US-AAA-BBB'],
    ['C300', 'DE-CCC-DDD'],
    ['D400', 'US-EEE-FFF'],
    ['E500', 'AU-GGG-HHH'],
    ['F600', 'HK-III-JJJ'],
]) {
    for (let i = 1; i <= 5; i++) NAMES.push(`${m}-${c}-${String(i).padStart(2, '0')}`);
}
const NODE_LIST = NAMES.map((n, i) => `trojan://pass@host${i}:443#${encodeURIComponent(n)}`).join(
    '\n'
);

describe('端到端：订阅路径节点顺序', () => {
    it('修复前：builtinOptions 无 addFlagEmoji → 加国旗 → mihomo 排序错乱', () => {
        const names = yaml
            .load(generateBuiltinClashConfig(NODE_LIST, {}))
            .proxies.map((p) => p.name);
        expect(names[0]).toBe('🇺🇸 A100-US-AAA-BBB-01');
        // mihomo 按字节序重排后，🇦🇺E500 排第一
        expect(goSort(names)[0]).toBe('🇦🇺 E500-AU-GGG-HHH-01');
        expect(goSort(names)).not.toEqual(NAMES);
    });

    it('修复后：透传 addFlagEmoji:false → 无国旗 → mihomo 排序正确', () => {
        const profile = { nodeTransform: { addFlagEmoji: false } };
        const config = { defaultNodeTransform: { enabled: false }, enableFlagEmoji: false };
        const effective = resolveEffectiveNodeTransform(profile, config);
        expect(effective.addFlagEmoji).toBe(false);

        const names = yaml
            .load(generateBuiltinClashConfig(NODE_LIST, { addFlagEmoji: effective.addFlagEmoji }))
            .proxies.map((p) => p.name);

        expect(names).toEqual(NAMES);
        expect(goSort(names)).toEqual(NAMES);
        expect(goSort(names)[0]).toBe('A100-US-AAA-BBB-01');
    });

    it('回归：addFlagEmoji 未配置时保持原行为（加国旗）', () => {
        const effective = resolveEffectiveNodeTransform(null, {});
        expect(effective.addFlagEmoji).toBeUndefined();
        const names = yaml
            .load(generateBuiltinClashConfig(NODE_LIST, { addFlagEmoji: effective.addFlagEmoji }))
            .proxies.map((p) => p.name);
        expect(names[0]).toBe('🇺🇸 A100-US-AAA-BBB-01');
    });
});
