import { describe, it, expect } from 'vitest';
import { generateCombinedNodeList } from '../../functions/services/subscription-service.js';

describe('subscription-service 手动节点健壮性', () => {
    it('应在包含异常节点时跳过坏节点并继续生成订阅', async () => {
        const misubs = [
            {
                id: 'bad-1',
                name: '坏节点',
                // 故意传非字符串，模拟历史脏数据
                url: null,
                enabled: true
            },
            {
                id: 'bad-2',
                name: '坏节点2',
                // 非法编码，历史导入可能出现
                url: 'vless://uuid@example.com:443?security=tls#%E0%A4%A',
                enabled: true
            },
            {
                id: 'ok-1',
                name: '正常节点',
                url: 'trojan://pass@example.com:443#ok',
                enabled: true
            }
        ];

        const result = await generateCombinedNodeList(
            {},
            { enableAccessLog: false },
            'ClashMeta',
            misubs,
            '',
            {
                enableManualNodes: true,
                manualNodePrefix: '手动节点',
                enableSubscriptions: true
            },
            false
        );

        expect(typeof result).toBe('string');
        expect(result).toContain('trojan://pass@example.com:443#');
        expect(result).toContain(encodeURIComponent('手动节点 - 正常节点'));
    });
});
