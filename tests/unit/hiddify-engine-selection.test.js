import { describe, expect, it } from 'vitest';
import {
    determineTargetFormat,
    isHiddifyAgent
} from '../../functions/modules/subscription/user-agent-utils.js';
import {
    resolveEffectiveEngine,
    resolveBuiltinRequestOptions
} from '../../functions/modules/subscription/main-handler.js';

const hiddifyUa = 'HiddifyNext/4.1.1 (android) like ClashMeta v2ray sing-box';

describe('Hiddify subscription compatibility', () => {
    it('detects Hiddify clients as Clash-compatible by default', () => {
        const params = new URLSearchParams('');

        expect(isHiddifyAgent(hiddifyUa)).toBe(true);
        expect(determineTargetFormat(hiddifyUa, params)).toBe('clash');
    });

    it('forces automatic Hiddify requests to builtin engine even when global default is external', () => {
        const params = new URLSearchParams('');

        expect(resolveEffectiveEngine({
            searchParams: params,
            userAgent: hiddifyUa,
            profileEngineMode: '',
            globalEngineMode: 'external'
        })).toBe('builtin');
    });

    it('still respects explicit engine and builtin parameters for Hiddify requests', () => {
        expect(resolveEffectiveEngine({
            searchParams: new URLSearchParams('?engine=external'),
            userAgent: hiddifyUa,
            profileEngineMode: '',
            globalEngineMode: 'builtin'
        })).toBe('external');

        expect(resolveEffectiveEngine({
            searchParams: new URLSearchParams('?builtin=external'),
            userAgent: hiddifyUa,
            profileEngineMode: '',
            globalEngineMode: 'builtin'
        })).toBe('external');

        expect(resolveEffectiveEngine({
            searchParams: new URLSearchParams('?target=singbox'),
            userAgent: hiddifyUa,
            profileEngineMode: '',
            globalEngineMode: 'external'
        })).toBe('external');
    });

    it('exposes Hiddify compatibility options for builtin rendering', () => {
        const params = new URLSearchParams('');

        expect(resolveBuiltinRequestOptions({
            searchParams: params,
            userAgent: hiddifyUa
        })).toMatchObject({
            userAgent: hiddifyUa,
            searchParams: params,
            hiddifyCompatible: true
        });
    });
});
