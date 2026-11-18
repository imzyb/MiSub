import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { generateBuiltinClashConfig } from '../../functions/modules/subscription/builtin-clash-generator.js';
import {
    resolveEffectiveNodeTransform,
    resolveAddFlagEmoji,
} from '../../functions/modules/subscription/main-handler.js';

const NODE = 'trojan://pass@example.com:443#US-AAA-BBB-01';

describe('addFlagEmoji 透传到内置 Clash 生成器', () => {
    it('addFlagEmoji: false 时不加国旗', () => {
        const name = yaml.load(generateBuiltinClashConfig(NODE, { addFlagEmoji: false })).proxies[0]
            .name;
        expect(name).toBe('US-AAA-BBB-01');
    });

    it('addFlagEmoji: true 时加国旗', () => {
        const name = yaml.load(generateBuiltinClashConfig(NODE, { addFlagEmoji: true })).proxies[0]
            .name;
        expect(name).toBe('🇺🇸 US-AAA-BBB-01');
    });

    it('未传 addFlagEmoji 时默认加国旗（保持向后兼容）', () => {
        const name = yaml.load(generateBuiltinClashConfig(NODE, {})).proxies[0].name;
        expect(name).toBe('🇺🇸 US-AAA-BBB-01');
    });
});

describe('resolveEffectiveNodeTransform 回退链', () => {
    const globalOff = { addFlagEmoji: false };
    const globalOn = { addFlagEmoji: true };

    it('无 profile 时回退到全局', () => {
        expect(resolveEffectiveNodeTransform(null, { defaultNodeTransform: globalOff })).toEqual(
            globalOff
        );
    });

    it('profile 有 nodeTransform 时整体覆盖全局', () => {
        expect(
            resolveEffectiveNodeTransform(
                { nodeTransform: { addFlagEmoji: true } },
                { defaultNodeTransform: globalOff }
            )
        ).toEqual({ addFlagEmoji: true });
    });

    it('profile.nodeTransform 为空对象时回退到全局', () => {
        expect(
            resolveEffectiveNodeTransform(
                { nodeTransform: {} },
                { defaultNodeTransform: globalOff }
            )
        ).toEqual(globalOff);
    });

    it('profile 引用预设时使用预设配置', () => {
        const config = {
            defaultNodeTransform: globalOn,
            nodeTransformPresets: [{ id: 'p1', config: { addFlagEmoji: false } }],
        };
        expect(resolveEffectiveNodeTransform({ nodeTransformPresetId: 'p1' }, config)).toEqual({
            addFlagEmoji: false,
        });
    });

    it('profile 自身优先于预设', () => {
        const config = {
            defaultNodeTransform: globalOn,
            nodeTransformPresets: [{ id: 'p1', config: { addFlagEmoji: false } }],
        };
        expect(
            resolveEffectiveNodeTransform(
                { nodeTransformPresetId: 'p1', nodeTransform: { addFlagEmoji: true } },
                config
            )
        ).toEqual({ addFlagEmoji: true });
    });

    it('配置缺失时返回空对象，不抛错', () => {
        expect(resolveEffectiveNodeTransform(null, {})).toEqual({});
        expect(resolveEffectiveNodeTransform(undefined, undefined)).toEqual({});
    });
});

describe('resolveAddFlagEmoji 优先级', () => {
    it('profile.nodeTransform.addFlagEmoji 优先于全局 enableFlagEmoji', () => {
        expect(
            resolveAddFlagEmoji(
                { nodeTransform: { addFlagEmoji: false } },
                { enableFlagEmoji: true }
            )
        ).toBe(false);
        expect(
            resolveAddFlagEmoji(
                { nodeTransform: { addFlagEmoji: true } },
                { enableFlagEmoji: false }
            )
        ).toBe(true);
    });

    it('无 profile 时回退到全局 enableFlagEmoji', () => {
        expect(resolveAddFlagEmoji(null, { enableFlagEmoji: false })).toBe(false);
        expect(resolveAddFlagEmoji(null, { enableFlagEmoji: true })).toBe(true);
    });

    it('两边都未配置时返回 undefined（保持默认加国旗）', () => {
        expect(resolveAddFlagEmoji(null, {})).toBeUndefined();
        expect(resolveAddFlagEmoji(null, { defaultNodeTransform: {} })).toBeUndefined();
    });

    it('全局 defaultNodeTransform.addFlagEmoji 也生效', () => {
        expect(resolveAddFlagEmoji(null, { defaultNodeTransform: { addFlagEmoji: false } })).toBe(
            false
        );
    });
});
