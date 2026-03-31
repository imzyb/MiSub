/**
 * 内置 Clash 配置生成器
 * 不依赖外部 subconverter，直接将节点 URL 转换为完整 Clash 配置
 * 支持 dialer-proxy、reality-opts 等特殊参数
 */

import { urlsToClashProxies } from '../../utils/url-to-clash.js';
import { getUniqueName } from './name-utils.js';
import { clashFix } from '../../utils/format-utils.js';
import yaml from 'js-yaml';

/**
 * 清理字符串中的控制字符（保留换行和制表符）
 * @param {string} str - 输入字符串
 * @returns {string} 清理后的字符串
 */
function cleanControlChars(str) {
    if (typeof str !== 'string') return str;
    // 移除控制字符，但保留换行(\n)、回车(\r)、制表符(\t)
    // eslint-disable-next-line no-control-regex
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * 递归清理对象中所有字符串的控制字符
 * @param {any} obj - 输入对象
 * @returns {any} 清理后的对象
 */
function deepCleanControlChars(obj) {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
        return cleanControlChars(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => deepCleanControlChars(item));
    }

    if (typeof obj === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            cleaned[cleanControlChars(key)] = deepCleanControlChars(value);
        }
        return cleaned;
    }

    return obj;
}

/**
 * 处理重名节点，确保每个节点名称唯一
 * @param {Object[]} proxies - 代理对象数组
 */
function deduplicateNames(proxies) {
    const usedNames = new Map();
    proxies.forEach(proxy => {
        proxy.name = getUniqueName(proxy.name, usedNames);
    });
}

/**
 * 生成内置 Clash 配置
 * @param {string} nodeList - 节点列表（换行分隔的 URL）
 * @param {Object} options - 配置选项
 * @returns {string} Clash YAML 配置
 */
export function generateBuiltinClashConfig(nodeList, options = {}) {
    const {
        fileName = 'MiSub',
        enableUdp = true,
        skipCertVerify = false
    } = options;

    // 解析节点 URL 列表（先清理控制字符）
    const cleanedNodeList = cleanControlChars(nodeList);
    const nodeUrls = cleanedNodeList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

    // 转换为 Clash 代理对象
    let proxies = urlsToClashProxies(nodeUrls);

    // 清理控制字符
    proxies = deepCleanControlChars(proxies);

    // 应用 UDP 开关：强制设置所有节点的 UDP 参数
    if (enableUdp) {
        proxies.forEach(proxy => {
            proxy.udp = true;
        });
    }

    // 强制跳过证书验证
    if (skipCertVerify) {
        proxies.forEach(proxy => {
            proxy['skip-cert-verify'] = true;
        });
    }

    // 处理重名节点
    deduplicateNames(proxies);

    if (proxies.length === 0) {
        return '# No valid proxies found\nproxies: []\n';
    }

    // 获取所有代理名称
    const proxyNames = proxies.map(p => p.name);

    // 基础配置
    const config = {
        'mixed-port': 7890,
        'allow-lan': true,
        'mode': 'rule',
        'log-level': 'info',
        'external-controller': ':9090',

        'dns': {
            'enable': true,
            'listen': '0.0.0.0:1053',
            'default-nameserver': ['223.5.5.5', '1.1.1.1'],
            'enhanced-mode': 'fake-ip',
            'fake-ip-range': '198.18.0.1/16',
            'fake-ip-filter': ['*.lan', '*.localhost'],
            'nameserver': [
                'https://dns.alidns.com/dns-query',
                'https://doh.pub/dns-query'
            ]
        },

        'proxies': proxies,

        'proxy-groups': [
            {
                'name': '🚀 节点选择',
                'type': 'select',
                'proxies': [...proxyNames, '♻️ 自动选择', '🔯 故障转移']
            },
            {
                'name': '♻️ 自动选择',
                'type': 'url-test',
                'url': 'http://www.gstatic.com/generate_204',
                'interval': 300,
                'tolerance': 50,
                'proxies': proxyNames
            },
            {
                'name': '🔯 故障转移',
                'type': 'fallback',
                'url': 'http://www.gstatic.com/generate_204',
                'interval': 300,
                'proxies': proxyNames
            }
        ],

        'rules': [
            'GEOIP,CN,DIRECT',
            'MATCH,🚀 节点选择'
        ]
    };

    // 生成 YAML
    try {
        let yamlStr = yaml.dump(config, {
            indent: 2,
            lineWidth: -1,
            noRefs: true,
            quotingType: '"',
            forceQuotes: false
        });

        // 应用 WireGuard 修复
        yamlStr = clashFix(yamlStr);

        // 最终清理，确保输出没有控制字符
        return cleanControlChars(yamlStr);
    } catch (e) {
        console.error('[BuiltinClash] YAML generation failed:', e);
        // Fallback: 使用简单的 JSON 转换
        return `proxies:\n${proxies.map(p => `  - ${JSON.stringify(p)}`).join('\n')}\n`;
    }
}

/**
 * 仅生成代理列表（不包含完整配置）
 * @param {string} nodeList - 节点列表
 * @returns {string} 仅包含 proxies 部分的 YAML
 */
export function generateProxiesOnly(nodeList) {
    const cleanedNodeList = cleanControlChars(nodeList);
    const nodeUrls = cleanedNodeList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

    let proxies = urlsToClashProxies(nodeUrls);

    // 清理控制字符
    proxies = deepCleanControlChars(proxies);

    // 处理重名节点
    deduplicateNames(proxies);

    try {
        let yamlStr = yaml.dump({ proxies }, {
            indent: 2,
            lineWidth: -1,
            noRefs: true
        });

        // 应用 WireGuard 修复
        yamlStr = clashFix(yamlStr);

        return cleanControlChars(yamlStr);
    } catch (e) {
        return `proxies:\n${proxies.map(p => `  - ${JSON.stringify(p)}`).join('\n')}\n`;
    }
}
