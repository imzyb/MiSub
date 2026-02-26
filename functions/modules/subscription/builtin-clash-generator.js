/**
 * 内置 Clash 配置生成器
 * 不依赖外部 subconverter，直接将节点 URL 转换为完整 Clash 配置
 * 支持 dialer-proxy、reality-opts 等特殊参数
 */

import { urlToClashProxy, urlsToClashProxies } from '../../utils/url-to-clash.js';
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
 * 生成内置 Clash 配置
 * @param {string} nodeList - 节点列表（换行分隔的 URL）
 * @param {Object} options - 配置选项
 * @returns {string} Clash YAML 配置
 */
export function generateBuiltinClashConfig(nodeList, options = {}) {
    const {
        fileName = 'MiSub',
        enableUdp = true,
        externalConfig = null
    } = options;

    // 解析节点 URL 列表
    const nodeUrls = nodeList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

    // 转换为 Clash 代理对象
    let proxies = urlsToClashProxies(nodeUrls);

    // 清理控制字符
    proxies = deepCleanControlChars(proxies);

    // 处理重名节点
    const usedNames = new Set();
    proxies.forEach(proxy => {
        let name = proxy.name;
        if (usedNames.has(name)) {
            let i = 1;
            while (usedNames.has(`${name}_${i}`)) {
                i++;
            }
            proxy.name = `${name}_${i}`;
        }
        usedNames.add(proxy.name);
    });

    if (proxies.length === 0) {
        return '# No valid proxies found\nproxies: []\n';
    }

    // 获取所有代理名称
    const proxyNames = proxies.map(p => p.name);

    // 分离出带有 dialer-proxy 的节点（链式代理）
    const chainedProxies = proxies.filter(p => p['dialer-proxy']);
    const directProxies = proxies.filter(p => !p['dialer-proxy']);

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
                'proxies': [...proxyNames, '♻️ 自动选择', '🔯 故障转移',]
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

    // 如果有链式代理节点，添加说明注释
    if (chainedProxies.length > 0) {
        console.log(`[BuiltinClash] ${chainedProxies.length} proxies with dialer-proxy`);
    }

    // 生成 YAML
    try {
        const yamlStr = yaml.dump(config, {
            indent: 2,
            lineWidth: -1,
            noRefs: true,
            quotingType: '"',
            forceQuotes: false
        });
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
    const nodeUrls = nodeList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

    let proxies = urlsToClashProxies(nodeUrls);

    // 清理控制字符
    proxies = deepCleanControlChars(proxies);

    try {
        const yamlStr = yaml.dump({ proxies }, {
            indent: 2,
            lineWidth: -1,
            noRefs: true
        });
        return cleanControlChars(yamlStr);
    } catch (e) {
        return `proxies:\n${proxies.map(p => `  - ${JSON.stringify(p)}`).join('\n')}\n`;
    }
}
