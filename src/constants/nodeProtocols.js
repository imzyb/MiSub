/**
 * 前端节点协议常量
 */

export const COMMON_NODE_PROTOCOLS = [
  'ss',
  'ssr',
  'vmess',
  'vless',
  'trojan',
  'hysteria',
  'hysteria2',
  'hy',
  'hy2',
  'tuic',
  'anytls',
  'socks5',
  'socks',
  'snell',
  'naive+https',
  'naive+quic',
  'naive+http',
  'http',
  'https',
  'wireguard'
];

export function createProtocolRegex(protocols, caseInsensitive = true) {
  const escaped = protocols.map(protocol => protocol.replace('+', '\\+'));
  return new RegExp(`^(${escaped.join('|')}):\\/\\/`, caseInsensitive ? 'i' : '');
}

export const NODE_PROTOCOL_PREFIXES = COMMON_NODE_PROTOCOLS.map(protocol => `${protocol}://`);
export const NODE_PROTOCOL_REGEX = createProtocolRegex(COMMON_NODE_PROTOCOLS);
