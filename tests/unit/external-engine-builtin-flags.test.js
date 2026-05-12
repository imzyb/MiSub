import { describe, expect, it } from 'vitest';
import { resolveBuiltinEngineFlags } from '../../functions/modules/subscription/main-handler.js';

describe('resolveBuiltinEngineFlags', () => {
    it('第三方转换引擎应忽略并关闭内置引擎专属开关', () => {
        const flags = resolveBuiltinEngineFlags({
            builtinSkipCertVerify: true,
            builtinEnableUdp: true
        }, true);

        expect(flags).toEqual({
            shouldSkipCertificateVerify: false,
            shouldEnableUdp: false
        });
    });

    it('内置转换引擎应保留内置引擎专属开关', () => {
        const flags = resolveBuiltinEngineFlags({
            builtinSkipCertVerify: true,
            builtinEnableUdp: true
        }, false);

        expect(flags).toEqual({
            shouldSkipCertificateVerify: true,
            shouldEnableUdp: true
        });
    });
});
