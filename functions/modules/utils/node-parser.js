/**
 * 节点解析工具模块
 * 提供节点URL解析和处理功能
 */

import { parseNodeInfo, extractNodeRegion } from './geo-utils.js';

/**
 * 支持的节点协议正则表达式
 */
export const NODE_PROTOCOL_REGEX = /^(ss|ssr|vmess|vless|trojan|hysteria2?|hy|hy2|tuic|anytls|socks5):\/\//i;

/**
 * 修复SS节点中的URL编码问题
 * @param {string} ssUrl - SS节点URL
 * @returns {string} 修复后的SS节点URL
 */
export function fixSSEncoding(ssUrl) {
    if (!ssUrl || !ssUrl.startsWith('ss://')) {
        return ssUrl;
    }

    try {
        const hashIndex = ssUrl.indexOf('#');
        let baseLink = hashIndex !== -1 ? ssUrl.substring(0, hashIndex) : ssUrl;
        let fragment = hashIndex !== -1 ? ssUrl.substring(hashIndex) : '';

        // 检查base64部分是否包含URL编码字符
        const protocolEnd = baseLink.indexOf('://');
        const atIndex = baseLink.indexOf('@');
        if (protocolEnd !== -1 && atIndex !== -1) {
            const base64Part = baseLink.substring(protocolEnd + 3, atIndex);
            if (base64Part.includes('%')) {
                // 解码URL编码的base64部分
                const decodedBase64 = decodeURIComponent(base64Part);
                baseLink = 'ss://' + decodedBase64 + baseLink.substring(atIndex);
            }
        }
        return baseLink + fragment;
    } catch (e) {
        // 如果处理失败，返回原始链接
        return ssUrl;
    }
}

/**
 * 修复vless和trojan节点中的URL编码问题
 * @param {string} nodeUrl - 节点URL
 * @returns {string} 修复后的节点URL
 */
export function fixNodeEncoding(nodeUrl) {
    if (!nodeUrl || typeof nodeUrl !== 'string') {
        return nodeUrl;
    }

    // 处理支持URL编码的协议
    const supportedProtocols = ['ss://', 'vless://', 'trojan://'];

    for (const protocol of supportedProtocols) {
        if (nodeUrl.startsWith(protocol)) {
            try {
                const hashIndex = nodeUrl.indexOf('#');
                let baseLink = hashIndex !== -1 ? nodeUrl.substring(0, hashIndex) : nodeUrl;
                let fragment = hashIndex !== -1 ? nodeUrl.substring(hashIndex) : '';

                // 检查base64部分是否包含URL编码字符
                const protocolEnd = baseLink.indexOf('://');
                const atIndex = baseLink.indexOf('@');
                if (protocolEnd !== -1 && atIndex !== -1) {
                    const base64Part = baseLink.substring(protocolEnd + 3, atIndex);
                    if (base64Part.includes('%')) {
                        // 解码URL编码的base64部分
                        const decodedBase64 = decodeURIComponent(base64Part);
                        baseLink = protocol + decodedBase64 + baseLink.substring(atIndex);
                    }
                }
                return baseLink + fragment;
            } catch (e) {
                // 如果处理失败，返回原始链接
                return nodeUrl;
            }
        }
    }

    return nodeUrl;
}

/**
 * 从文本中提取所有有效的节点URL
 * @param {string} text - 包含节点的文本
 * @returns {string[]} 有效的节点URL数组
 */
export function extractValidNodes(text) {
    console.log(`[DEBUG] extractValidNodes: Input text length: ${text ? text.length : 0}`);

    if (!text || typeof text !== 'string') {
        console.log(`[DEBUG] extractValidNodes: Invalid input`);
        return [];
    }

    // 标准化换行符并分割文本
    const lines = text
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .filter(line => {
            // 使用test方法而不是全局regex，因为我们移除了全局标志
            const matches = NODE_PROTOCOL_REGEX.test(line);
            return matches;
        });

    console.log(`[DEBUG] extractValidNodes: Filtered to ${lines.length} lines matching protocol regex`);

    // 调试：输出匹配的行
    if (lines.length > 0 && lines.length <= 10) {
        console.log(`[DEBUG] extractValidNodes: Matching lines:`, lines.map(line => line.substring(0, 50) + '...'));
    } else if (lines.length > 10) {
        console.log(`[DEBUG] extractValidNodes: First 10 matching lines:`, lines.slice(0, 10).map(line => line.substring(0, 50) + '...'));
        console.log(`[DEBUG] extractValidNodes: ... and ${lines.length - 10} more lines`);
    }

    // 修复每个节点的编码问题
    const result = lines.map(nodeUrl => fixNodeEncoding(nodeUrl));
    console.log(`[DEBUG] extractValidNodes: Final result: ${result.length} nodes`);

    return result;
}

/**
 * Base64解码文本
 * @param {string} text - 要解码的文本
 * @returns {string} 解码后的文本
 */
export function decodeBase64Text(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    try {
        const cleanedText = text.replace(/\s/g, '');

        // 简单的Base64格式检查
        const base64Regex = /^[A-Za-z0-9+\/=]+$/;
        if (!base64Regex.test(cleanedText) || cleanedText.length < 20) {
            return text;
        }

        // 尝试Base64解码
        const binaryString = atob(cleanedText);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
        // Base64解码失败，返回原始内容
        return text;
    }
}

/**
 * 智能内容类型检测
 * @param {string} text - 要检测的文本内容
 * @returns {string} 内容类型描述
 */
export function detectContentType(text) {
    if (!text || typeof text !== 'string') {
        return 'unknown';
    }

    if (text.includes('proxies:') && text.includes('rules:')) {
        return 'clash-config';
    }

    if (text.includes('outbounds') && text.includes('inbounds') && text.includes('route')) {
        return 'singbox-config';
    }

    // 检查是否包含节点URL
    const nodeCount = (text.match(new RegExp(NODE_PROTOCOL_REGEX.source, 'gi')) || []).length;
    if (nodeCount > 0) {
        return 'node-list';
    }

    return 'unknown';
}

/**
 * 解析节点列表
 * @param {string} content - 包含节点的文本内容
 * @returns {Array} 解析后的节点对象数组
 */
export function parseNodeList(content) {
    console.log(`[DEBUG] parseNodeList: Input content length: ${content ? content.length : 0}`);

    if (!content) {
        console.log(`[DEBUG] parseNodeList: No content provided`);
        return [];
    }

    // 检测内容类型
    const contentType = detectContentType(content);
    console.log(`[DEBUG] parseNodeList: Detected content type: ${contentType}`);

    // 即使是配置文件，也尝试提取节点URL
    // 不再跳过，因为很多订阅混合了配置和节点列表

    // 尝试Base64解码
    let processedContent = content;
    let decoded = false;
    try {
        processedContent = decodeBase64Text(content);
        decoded = processedContent !== content;
        console.log(`[DEBUG] parseNodeList: Base64 decoded: ${decoded}, processed content length: ${processedContent.length}`);
    } catch (e) {
        console.log(`[DEBUG] parseNodeList: Base64 decode failed: ${e.message}`);
        // 解码失败，使用原始内容
    }

    // 提取有效节点
    const validNodes = extractValidNodes(processedContent);
    console.log(`[DEBUG] parseNodeList: Extracted ${validNodes.length} valid nodes`);

    // 调试：输出前5个节点
    if (validNodes.length > 0) {
        console.log(`[DEBUG] parseNodeList: First 5 nodes:`, validNodes.slice(0, 5).map(n => n.substring(0, 50) + '...'));
    }

    // 解析每个节点的详细信息
    const result = validNodes.map(nodeUrl => {
        const nodeInfo = parseNodeInfo(nodeUrl);
        return {
            url: nodeUrl,
            ...nodeInfo
        };
    });

    console.log(`[DEBUG] parseNodeList: Final result: ${result.length} nodes`);
    return result;
}

/**
 * 统计节点协议类型分布
 * @param {Array} nodes - 节点数组
 * @returns {Object} 协议统计信息
 */
export function calculateProtocolStats(nodes) {
    const stats = {};
    const total = nodes.length;

    nodes.forEach(node => {
        const protocol = node.protocol || 'unknown';
        stats[protocol] = (stats[protocol] || 0) + 1;
    });

    // 添加百分比信息
    for (const [protocol, count] of Object.entries(stats)) {
        stats[protocol] = {
            count,
            percentage: Math.round((count / total) * 100)
        };
    }

    return stats;
}

/**
 * 统计节点地区分布
 * @param {Array} nodes - 节点数组
 * @returns {Object} 地区统计信息
 */
export function calculateRegionStats(nodes) {
    const stats = {};
    const total = nodes.length;

    nodes.forEach(node => {
        const region = extractNodeRegion(node.name || '');
        stats[region] = (stats[region] || 0) + 1;
    });

    // 添加百分比信息
    for (const [region, count] of Object.entries(stats)) {
        stats[region] = {
            count,
            percentage: Math.round((count / total) * 100)
        };
    }

    return stats;
}

/**
 * 去除重复节点
 * @param {Array} nodes - 节点数组
 * @returns {Array} 去重后的节点数组
 */
export function removeDuplicateNodes(nodes) {
    if (!Array.isArray(nodes)) {
        return [];
    }

    const seen = new Set();
    return nodes.filter(node => {
        const url = node.url || '';
        if (seen.has(url)) {
            return false;
        }
        seen.add(url);
        return true;
    });
}

/**
 * 根据地区对节点进行排序
 * @param {Array} nodes - 节点数组
 * @returns {Array} 排序后的节点数组
 */
export function sortNodesByRegion(nodes) {
    if (!Array.isArray(nodes)) {
        return nodes;
    }

    const regionOrder = [
        '香港', '台湾', '新加坡', '日本', '美国', '韩国',
        '英国', '德国', '法国', '加拿大', '澳大利亚',
        '荷兰', '俄罗斯', '印度', '土耳其', '马来西亚',
        '泰国', '越南', '菲律宾', '印尼', '其他'
    ];

    return nodes.sort((a, b) => {
        const aRegionIndex = regionOrder.indexOf(a.region);
        const bRegionIndex = regionOrder.indexOf(b.region);

        // 如果地区相同，按名称排序
        if (aRegionIndex === bRegionIndex) {
            return a.name.localeCompare(b.name);
        }

        return aRegionIndex - bRegionIndex;
    });
}

/**
 * 格式化节点数量显示
 * @param {number} count - 节点数量
 * @returns {string} 格式化后的显示文本
 */
export function formatNodeCount(count) {
    if (typeof count !== 'number' || count < 0) {
        return '0 个节点';
    }

    return `${count} 个节点`;
}

/**
 * 验证节点URL格式
 * @param {string} nodeUrl - 节点URL
 * @returns {boolean} 是否为有效的节点URL
 */
export function isValidNodeUrl(nodeUrl) {
    if (!nodeUrl || typeof nodeUrl !== 'string') {
        return false;
    }

    return NODE_PROTOCOL_REGEX.test(nodeUrl.trim());
}

/**
 * 清理节点名称
 * @param {string} nodeName - 原始节点名称
 * @returns {string} 清理后的节点名称
 */
export function cleanNodeName(nodeName) {
    if (!nodeName || typeof nodeName !== 'string') {
        return '';
    }

    return nodeName
        .trim()
        .replace(/\s+/g, ' ') // 合并多余空格
        .replace(/[^\w\s\-_().[\]{}]/g, ''); // 移除特殊字符，保留基本字符
}