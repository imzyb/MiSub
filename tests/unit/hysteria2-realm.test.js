import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { extractValidNodes } from '../../functions/modules/utils/node-parser.js';
import { urlToClashProxy } from '../../functions/utils/url-to-clash.js';
import { generateBuiltinClashConfig } from '../../functions/modules/subscription/builtin-clash-generator.js';

const realmProxyYaml = `
proxies:
  - name: "hy2realms"
    type: hysteria2
    server: realm.hy2.io
    port: 443
    password: cxxxx-79cf9c5e2b5a
    skip-cert-verify: true
    realm-opts:
      enable: true
      server-url: https://realm.hy2.io
      realm-id: cxxxx-79cf9c5e2b5a
      token: public
      stun-servers:
        - stun.sip.us:3478
        - stun.nextcloud.com:3478
`;

describe('Hysteria2 realm support', () => {
    it('preserves realm-opts when importing Clash YAML manual nodes', () => {
        const nodes = extractValidNodes(realmProxyYaml);
        expect(nodes).toHaveLength(1);
        expect(nodes[0]).toContain('realm-id=cxxxx-79cf9c5e2b5a');
        expect(nodes[0]).toContain('realm-token=public');
        expect(nodes[0]).toContain('realm-server=https%3A%2F%2Frealm.hy2.io');
        expect(nodes[0]).toContain('stun-servers=stun.sip.us%3A3478%2Cstun.nextcloud.com%3A3478');

        const proxy = urlToClashProxy(nodes[0]);
        expect(proxy['realm-opts']).toEqual({
            enable: true,
            'realm-id': 'cxxxx-79cf9c5e2b5a',
            token: 'public',
            'server-url': 'https://realm.hy2.io',
            'stun-servers': ['stun.sip.us:3478', 'stun.nextcloud.com:3478']
        });
    });

    it('renders realm-opts into built-in Clash YAML output', () => {
        const node = 'hysteria2://cxxxx-79cf9c5e2b5a@realm.hy2.io:443?insecure=1&realm-id=cxxxx-79cf9c5e2b5a&realm-token=public&realm-server=https%3A%2F%2Frealm.hy2.io&stun-servers=stun.sip.us%3A3478%2Cstun.nextcloud.com%3A3478#hy2realms';
        const rendered = generateBuiltinClashConfig(node, { ruleLevel: 'minimal' });
        const config = yaml.load(rendered);
        expect(config.proxies[0]['realm-opts']).toEqual({
            enable: true,
            'realm-id': 'cxxxx-79cf9c5e2b5a',
            token: 'public',
            'server-url': 'https://realm.hy2.io',
            'stun-servers': ['stun.sip.us:3478', 'stun.nextcloud.com:3478']
        });
    });
});
