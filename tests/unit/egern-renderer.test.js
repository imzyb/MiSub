import { describe, it, expect } from 'vitest';
import { transformBuiltinSubscription } from '../../functions/modules/subscription/transformer-factory.js';

describe('Egern native renderer', () => {
  it('renders a Profile.yaml style config for Egern', () => {
    const nodeList = [
      'trojan://password@1.2.3.4:443?sni=example.com#HK-01',
      'vless://11111111-1111-1111-1111-111111111111@2.2.2.2:443?security=tls&sni=example.com#JP-01'
    ].join('\n');

    const rendered = transformBuiltinSubscription(nodeList, 'egern', {
      fileName: 'MiSub',
      managedConfigUrl: 'https://example.com/sub?target=egern'
    });

    expect(rendered).toContain('auto_update:');
    expect(rendered).toContain('proxies:');
    expect(rendered).toContain('policy_groups:');
    expect(rendered).toContain('rules:');
    expect(rendered).toContain('trojan:');
    expect(rendered).toContain('vless:');
    expect(rendered).toContain('HK-01');
    expect(rendered).toContain('JP-01');
  });
});
