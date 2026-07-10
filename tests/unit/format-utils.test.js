import { describe, it, expect } from 'vitest';
import { getProcessedUserAgent } from '../../functions/utils/format-utils.js';

describe('format-utils getProcessedUserAgent', () => {
    it('带 clash 参数的订阅源应使用 Clash UA 拉取', () => {
        expect(getProcessedUserAgent('ClashMeta', 'http://example.com/link/token?clash=2'))
            .toBe('clash-verge/v2.4.3');
    });

    it('普通订阅源保持默认 v2rayN UA', () => {
        expect(getProcessedUserAgent('ClashMeta', 'http://example.com/link/token'))
            .toBe('v2rayN/7.23');
    });
});
