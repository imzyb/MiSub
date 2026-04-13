export { convertClashProxyToUrl } from './clash.js';
export { validateGeneratedUrl } from './validator.js';
export { batchConvertClashProxies } from './batch.js';

import { parseLoonConfig } from './loon-parser.js';
import { parseSurgeConfig } from './surge-parser.js';
import { parseQuantumultXConfig } from './quantumultx-parser.js';

export { parseLoonConfig, parseSurgeConfig, parseQuantumultXConfig };

export function parseClientConfig(content) {
    const text = String(content || '');
    const lower = text.toLowerCase();

    if (lower.includes('[server_local]') || lower.includes('shadowsocks=') || lower.includes('vmess=')) {
        return { client: 'quantumultx', nodes: parseQuantumultXConfig(text) };
    }

    if (lower.includes('[proxy]') && (lower.includes(' = shadowsocks,') || lower.includes(' = vmess,') || lower.includes(' = vless,') || lower.includes(' = hysteria2,') || lower.includes(' = tuic,'))) {
        return { client: 'loon', nodes: parseLoonConfig(text) };
    }

    if (lower.includes('[proxy]') && (lower.includes('ss=') || lower.includes('trojan=') || lower.includes('wireguard,') || lower.includes('anytls') || lower.includes('http-proxy') || lower.includes('https-proxy'))) {
        return { client: 'surge', nodes: parseSurgeConfig(text) };
    }

    return { client: 'unknown', nodes: [] };
}
