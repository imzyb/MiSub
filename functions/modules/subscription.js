/**
 * 订阅处理模块
 * 处理订阅获取、节点解析和格式转换
 */

import { isValidBase64, formatBytes, prependNodeName, getProcessedUserAgent, fetchSubscriptionWithFallback } from './utils.js';
import { sendEnhancedTgNotification } from './notifications.js';

// --- [新] 默认设置中增加通知阈值和存储类型 ---
export const defaultSettings = {
    FileName: 'MiSub',
    mytoken: 'auto',
    profileToken: 'profiles',
    subConverter: 'url.v1.mk',
    subConfig: 'https://raw.githubusercontent.com/cmliu/ACL4SSR/refs/heads/main/Clash/config/ACL4SSR_Online_Full.ini',
    prependSubName: true, // 保持向后兼容
    prefixConfig: {
        enableManualNodes: true,    // 手动节点前缀开关
        enableSubscriptions: true,  // 机场订阅前缀开关
        manualNodePrefix: '手动节点', // 手动节点前缀文本
    },
    NotifyThresholdDays: 3,
    NotifyThresholdPercent: 90,
    storageType: 'kv' // 新增：数据存储类型，默认 KV，可选 'd1'
};

/**
 * 生成组合节点列表
 * @param {Object} context - Cloudflare上下文
 * @param {Object} config - 配置对象
 * @param {string} userAgent - 用户代理
 * @param {Array} misubs - 订阅列表
 * @param {string} prependedContent - 预置内容
 * @param {Object} profilePrefixSettings - 订阅组前缀设置
 * @returns {Promise<string>} 处理后的节点列表
 */
export async function generateCombinedNodeList(context, config, userAgent, misubs, prependedContent = '', profilePrefixSettings = null) {
    const nodeRegex = /^(ss|ssr|vmess|vless|trojan|hysteria2?|hy|hy2|tuic|anytls|socks5):\/\//g;

    // 判断是否启用手动节点前缀
    const shouldPrependManualNodes = profilePrefixSettings?.enableManualNodes ??
        config.prefixConfig?.enableManualNodes ??
        config.prependSubName ?? true;

    // 手动节点前缀文本
    const manualNodePrefix = profilePrefixSettings?.manualNodePrefix ??
        config.prefixConfig?.manualNodePrefix ??
        '手动节点';

    const processedManualNodes = misubs.filter(sub => !sub.url.toLowerCase().startsWith('http')).map(node => {
        if (node.isExpiredNode) {
            return node.url; // Directly use the URL for expired node
        } else {
            // 修复手动SS节点中的URL编码问题
            let processedUrl = node.url;
            if (processedUrl.startsWith('ss://')) {
                try {
                    const hashIndex = processedUrl.indexOf('#');
                    let baseLink = hashIndex !== -1 ? processedUrl.substring(0, hashIndex) : processedUrl;
                    let fragment = hashIndex !== -1 ? processedUrl.substring(hashIndex) : '';

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
                    processedUrl = baseLink + fragment;
                } catch (e) {
                    // 如果处理失败，使用原始链接
                }
            }

            return shouldPrependManualNodes ? prependNodeName(processedUrl, manualNodePrefix) : processedUrl;
        }
    }).join('\n');

    const httpSubs = misubs.filter(sub => sub.url.toLowerCase().startsWith('http'));
    const subPromises = httpSubs.map(async (sub) => {
        try {
            // 使用智能回退机制获取订阅
            const processedUserAgent = getProcessedUserAgent(userAgent, sub.url);
            const fetchResult = await fetchSubscriptionWithFallback(sub.url, processedUserAgent);

            if (!fetchResult.success) {
                console.warn(`订阅请求失败: ${sub.url}, 错误: ${fetchResult.error}`);
                return '';
            }

            let text = fetchResult.content;
            console.log(`[Subscription] 成功获取订阅: ${sub.url}, User-Agent: ${fetchResult.userAgent}, 长度: ${text.length}`);

            // 智能内容类型检测 - 更精确的判断条件
            if (text.includes('proxies:') && text.includes('rules:')) {
                // 这是完整的Clash配置文件，不是节点列表
                return '';
            } else if (text.includes('outbounds') && text.includes('inbounds') && text.includes('route')) {
                // 这是完整的Singbox配置文件，不是节点列表
                return '';
            }
            try {
                const cleanedText = text.replace(/\s/g, '');
                if (isValidBase64(cleanedText)) {
                    const binaryString = atob(cleanedText);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
                    text = new TextDecoder('utf-8').decode(bytes);
                }
            } catch (e) {
                // Base64解码失败，使用原始内容
            }
            let validNodes = text.replace(/\r\n/g, '\n').split('\n')
                .map(line => line.trim())
                .filter(line => /^(ss|ssr|vmess|vless|trojan|hysteria2?|hy|hy2|tuic|anytls|socks5):\/\//.test(line))
                .map(line => {
                    // 修复SS节点中的URL编码问题
                    if (line.startsWith('ss://') || line.startsWith('vless://') || line.startsWith('trojan://')) {
                        try {
                            const hashIndex = line.indexOf('#');
                            let baseLink = hashIndex !== -1 ? line.substring(0, hashIndex) : line;
                            let fragment = hashIndex !== -1 ? line.substring(hashIndex) : '';

                            // 检查base64部分是否包含URL编码字符
                            const protocolEnd = baseLink.indexOf('://');
                            const atIndex = baseLink.indexOf('@');
                            if (protocolEnd !== -1 && atIndex !== -1) {
                                const base64Part = baseLink.substring(protocolEnd + 3, atIndex);
                                if (base64Part.includes('%')) {
                                    // 解码URL编码的base64部分
                                    const decodedBase64 = decodeURIComponent(base64Part);
                                    const protocol = baseLink.substring(0, protocolEnd);
                                    baseLink = protocol + '://' + decodedBase64 + baseLink.substring(atIndex);
                                }
                            }
                            return baseLink + fragment;
                        } catch (e) {
                            // 如果处理失败，返回原始链接
                            return line;
                        }
                    }
                    return line;
                });

            // [核心重構] 引入白名單 (keep:) 和黑名單 (exclude) 模式
            if (sub.exclude && sub.exclude.trim() !== '') {
                const rules = sub.exclude.trim().split('\n').map(r => r.trim()).filter(Boolean);

                const keepRules = rules.filter(r => r.toLowerCase().startsWith('keep:'));

                if (keepRules.length > 0) {
                    // --- 白名單模式 (Inclusion Mode) ---
                    const nameRegexParts = [];
                    const protocolsToKeep = new Set();

                    keepRules.forEach(rule => {
                        const content = rule.substring('keep:'.length).trim();
                        if (content.toLowerCase().startsWith('proto:')) {
                            const protocols = content.substring('proto:'.length).split(',').map(p => p.trim().toLowerCase());
                            protocols.forEach(p => protocolsToKeep.add(p));
                        } else {
                            nameRegexParts.push(content);
                        }
                    });

                    const nameRegex = nameRegexParts.length > 0 ? new RegExp(nameRegexParts.join('|'), 'i') : null;

                    validNodes = validNodes.filter(nodeLink => {
                        // 檢查協議是否匹配
                        const protocolMatch = nodeLink.match(/^(.*?):\/\//);
                        const protocol = protocolMatch ? protocolMatch[1].toLowerCase() : '';
                        if (protocolsToKeep.has(protocol)) {
                            return true;
                        }

                        // 檢查名稱是否匹配
                        if (nameRegex) {
                            const hashIndex = nodeLink.lastIndexOf('#');
                            if (hashIndex !== -1) {
                                try {
                                    const nodeName = decodeURIComponent(nodeLink.substring(hashIndex + 1));
                                    if (nameRegex.test(nodeName)) {
                                        return true;
                                    }
                                } catch (e) { /* 忽略解碼錯誤 */ }
                            }
                        }
                        return false; // 白名單模式下，不匹配任何規則則排除
                    });

                } else {
                    // --- 黑名單模式 (Exclusion Mode) ---
                    const protocolsToExclude = new Set();
                    const nameRegexParts = [];

                    rules.forEach(rule => {
                        if (rule.toLowerCase().startsWith('proto:')) {
                            const protocols = rule.substring('proto:'.length).split(',').map(p => p.trim().toLowerCase());
                            protocols.forEach(p => protocolsToExclude.add(p));
                        } else {
                            nameRegexParts.push(rule);
                        }
                    });

                    const nameRegex = nameRegexParts.length > 0 ? new RegExp(nameRegexParts.join('|'), 'i') : null;

                    validNodes = validNodes.filter(nodeLink => {
                        const protocolMatch = nodeLink.match(/^(.*?):\/\//);
                        const protocol = protocolMatch ? protocolMatch[1].toLowerCase() : '';
                        if (protocolsToExclude.has(protocol)) {
                            return false;
                        }

                        if (nameRegex) {
                            const hashIndex = nodeLink.lastIndexOf('#');
                            if (hashIndex !== -1) {
                                try {
                                    const nodeName = decodeURIComponent(nodeLink.substring(hashIndex + 1));
                                    if (nameRegex.test(nodeName)) {
                                        return false;
                                    }
                                } catch (e) { /* 忽略解碼錯誤 */ }
                            }
                            // 修复：对于vmess协议，需要特殊处理节点名称
                            else if (protocol === 'vmess') {
                                try {
                                    // 提取vmess链接中的Base64部分
                                    const base64Part = nodeLink.substring('vmess://'.length);
                                    // 解码Base64
                                    const binaryString = atob(base64Part);
                                    const bytes = new Uint8Array(binaryString.length);
                                    for (let i = 0; i < binaryString.length; i++) {
                                        bytes[i] = binaryString.charCodeAt(i);
                                    }
                                    const jsonString = new TextDecoder('utf-8').decode(bytes);
                                    const nodeConfig = JSON.parse(jsonString);
                                    const nodeName = nodeConfig.ps || '';
                                    if (nameRegex.test(nodeName)) {
                                        return false;
                                    }
                                } catch (e) { /* 忽略解码错误 */ }
                            }
                        }
                        return true;
                    });
                }
            }

            // 判断是否启用订阅前缀
            const shouldPrependSubscriptions = profilePrefixSettings?.enableSubscriptions ??
                config.prefixConfig?.enableSubscriptions ??
                config.prependSubName ?? true;

            return (shouldPrependSubscriptions && sub.name)
                ? validNodes.map(node => prependNodeName(node, sub.name)).join('\n')
                : validNodes.join('\n');
        } catch (e) {
            // 订阅处理错误，生成错误节点
            const errorNodeName = `连接错误-${sub.name || '未知'}`;
            return `trojan://error@127.0.0.1:8888?security=tls&allowInsecure=1&type=tcp#${encodeURIComponent(errorNodeName)}`;
        }
    });
    const processedSubContents = await Promise.all(subPromises);
    const combinedContent = (processedManualNodes + '\n' + processedSubContents.join('\n'));
    const uniqueNodesString = [...new Set(combinedContent.split('\n').map(line => line.trim()).filter(line => line))].join('\n');

    // 确保最终的字符串在非空时以换行符结束，以兼容 subconverter
    let finalNodeList = uniqueNodesString;
    if (finalNodeList.length > 0 && !finalNodeList.endsWith('\n')) {
        finalNodeList += '\n';
    }

    // 将虚假节点（如果存在）插入到列表最前面
    if (prependedContent) {
        return `${prependedContent}\n${finalNodeList}`;
    }
    return finalNodeList;
}