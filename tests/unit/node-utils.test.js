import { describe, it, expect } from 'vitest';
import { prependNodeName } from '../../functions/utils/node-utils.js';

describe('node-utils', () => {
    it('prependNodeName 应在 hash 非法编码时安全回退而不是抛错', () => {
        const malformed = 'vless://uuid@example.com:443?security=tls#%E0%A4%A';

        expect(() => prependNodeName(malformed, '手动节点')).not.toThrow();

        const renamed = prependNodeName(malformed, '手动节点');
        expect(renamed).toContain('#');
        expect(decodeURIComponent(renamed.split('#')[1])).toContain('手动节点');
    });
});
