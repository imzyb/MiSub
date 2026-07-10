import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { generateBuiltinClashConfig } from '../../functions/modules/subscription/builtin-clash-generator.js';

const hiddifyUa = 'HiddifyNext/4.1.1 (android) like ClashMeta v2ray sing-box';

describe('Hiddify Clash compatibility', () => {
    it('does not emit remote rule-providers for automatic Hiddify requests', () => {
        const node = 'vless://8b540f5c-62c1-4492-83f6-944f534ad026@cf.example.com:443?security=tls&sni=edge.example.com&type=ws&host=edge.example.com&path=%2F&encryption=none#Hiddify-Test';

        const result = generateBuiltinClashConfig(node, {
            userAgent: hiddifyUa,
            searchParams: new URLSearchParams('')
        });
        const parsed = yaml.load(result);

        expect(parsed.proxies).toHaveLength(1);
        expect(parsed).not.toHaveProperty('rule-providers');
        expect(parsed.rules).toEqual(['MATCH,🚀 节点选择']);
    });
});
