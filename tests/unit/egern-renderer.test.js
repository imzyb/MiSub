import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { transformBuiltinSubscription } from '../../functions/modules/subscription/transformer-factory.js';

const SS2022_V2RAY_PLUGIN_NODE = 'ss://MjAyMi1ibGFrZTMtYWVzLTI1Ni1nY206TldSak1UVmxNVFZtTWpnMU5HRTVaRGsxT1dJd1pUUm1ZbVJrTnpkaU5qTT0@cf.090227.xyz:8080?plugin=v2ray-plugin%3Bmode%3Dwebsocket%3Bhost%3Dss.2227tsj.workers.dev%3Bpath%3D%2F%3Fenc%5C%3D2022-blake3-aes-256-gcm%3Bmux%3D0#2022-blake3-aes-256-gcm';

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

  it('maps trojan ws, vmess ws tls, and vless ws tls using Egern proxy schema', () => {
    const nodeList = [
      'trojan://password@saas.sin.fan:443?security=tls&sni=kyjp.stoo.us.ci&type=ws&host=kyjp.stoo.us.ci&path=%2Ftrojan-argo%3Fed%3D2560#Trojan-WS',
      'vmess://eyJ2IjoiMiIsInBzIjoiVk1FU1MtV1MiLCJhZGQiOiJzYWFzLnNpbi5mYW4iLCJwb3J0IjoiNDQzIiwiaWQiOiIwYTRhMGJhMS1iZjAyLTQyOTgtYmYxNi0xOWExZjg2MzkzZmEiLCJhaWQiOiIwIiwic2N5IjoiYXV0byIsIm5ldCI6IndzIiwidHlwZSI6Im5vbmUiLCJob3N0Ijoia3lqcC5zdG9vLnVzLmNpIiwicGF0aCI6Ii92bWVzcy1hcmdvP2VkPTI1NjAiLCJ0bHMiOiJ0bHMiLCJzbmkiOiJreWpwLnN0b28udXMuY2kiLCJmcCI6ImZpcmVmb3gifQ==',
      'vless://0a4a0ba1-bf02-4298-bf16-19a1f86393fa@saas.sin.fan:443?encryption=none&security=tls&sni=kyjp.stoo.us.ci&fp=firefox&insecure=0&allowInsecure=0&type=ws&host=kyjp.stoo.us.ci&path=%2Fvless-argo%3Fed%3D2560#VLESS-WS'
    ].join('\n');

    const rendered = transformBuiltinSubscription(nodeList, 'egern');
    const parsed = yaml.load(rendered);
    const trojan = parsed.proxies.find(item => item.trojan)?.trojan;
    const vmess = parsed.proxies.find(item => item.vmess)?.vmess;
    const vless = parsed.proxies.find(item => item.vless)?.vless;

    expect(trojan.websocket.path).toBe('/trojan-argo?ed=2560');
    expect(trojan.websocket.host).toBe('kyjp.stoo.us.ci');
    expect(trojan.sni).toBe('kyjp.stoo.us.ci');

    expect(vmess.transport.wss.path).toBe('/vmess-argo?ed=2560');
    expect(vmess.transport.wss.headers.Host).toBe('kyjp.stoo.us.ci');
    expect(vmess.transport.wss.sni).toBe('kyjp.stoo.us.ci');

    expect(vless.transport.wss.path).toBe('/vless-argo?ed=2560');
    expect(vless.transport.wss.headers.Host).toBe('kyjp.stoo.us.ci');
    expect(vless.transport.wss.sni).toBe('kyjp.stoo.us.ci');
  });

  it('maps anytls using Egern proxy schema', () => {
    const rendered = transformBuiltinSubscription('anytls://9d6c62f6-e38d-4146-ab3e-d40568555f89@156.239.232.67:443/?sni=xkhkfree.99887766.best&allowInsecure=1#AnyTLS-HK', 'egern');
    const parsed = yaml.load(rendered);
    const anytls = parsed.proxies.find(item => item.anytls)?.anytls;

    expect(anytls.name).toBe('🇭🇰 AnyTLS-HK');
    expect(anytls.server).toBe('156.239.232.67');
    expect(anytls.port).toBe(443);
    expect(anytls.password).toBe('9d6c62f6-e38d-4146-ab3e-d40568555f89');
    expect(anytls.sni).toBe('xkhkfree.99887766.best');
    expect(anytls.udp_relay).toBe(true);
  });

  it('maps SS2022 v2ray-plugin websocket using Egern Shadowsocks transport', () => {
    const rendered = transformBuiltinSubscription(SS2022_V2RAY_PLUGIN_NODE, 'egern');
    const parsed = yaml.load(rendered);
    const shadowsocks = parsed.proxies.find(item => item.shadowsocks)?.shadowsocks;

    expect(shadowsocks.method).toBe('2022-blake3-aes-256-gcm');
    expect(shadowsocks.server).toBe('cf.090227.xyz');
    expect(shadowsocks.port).toBe(8080);
    expect(shadowsocks.transport.ws.path).toBe('/?enc=2022-blake3-aes-256-gcm');
    expect(shadowsocks.transport.ws.headers.Host).toBe('ss.2227tsj.workers.dev');
    expect(shadowsocks.transport.wss).toBeUndefined();
  });
});
