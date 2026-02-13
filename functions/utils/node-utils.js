/**
 * 节点处理工具函数
 * @author MiSub Team
 */

// [修复] 使用正确的相对路径引用 modules/utils 下的 geo-utils
import { extractNodeRegion, getRegionEmoji } from '../modules/utils/geo-utils.js';

/**
 * 节点协议正则表达式
 */
export const NODE_PROTOCOL_REGEX = /^(ss|ssr|vmess|vless|trojan|hysteria2?|hy|hy2|tuic|anytls|socks5|socks):\/\//g;

/**
 * 为节点名称添加前缀
 */
export function prependNodeName(link, prefix) {
    if (!prefix) return link;

    const appendToFragment = (baseLink, namePrefix) => {
        const hashIndex = baseLink.lastIndexOf('#');
        let originalName = '';
        if (hashIndex !== -1) {
            const rawName = baseLink.substring(hashIndex + 1);
            try {
                originalName = decodeURIComponent(rawName);
            } catch (e) {
                // 避免非法百分号编码导致 Worker 1101，回退使用原始片段
                originalName = rawName;
            }
        }
        const base = hashIndex !== -1 ? baseLink.substring(0, hashIndex) : baseLink;
        if (originalName.startsWith(namePrefix)) {
            return baseLink;
        }
        const newName = originalName ? `${namePrefix} - ${originalName}` : namePrefix;
        return `${base}#${encodeURIComponent(newName)}`;
    };

    if (link.startsWith('vmess://')) {
        try {
            const base64Part = link.substring('vmess://'.length);
            const binaryString = atob(base64Part);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const jsonString = new TextDecoder('utf-8').decode(bytes);
            const nodeConfig = JSON.parse(jsonString);
            const originalPs = nodeConfig.ps || '';
            if (!originalPs.startsWith(prefix)) {
                nodeConfig.ps = originalPs ? `${prefix} - ${originalPs}` : prefix;
            }
            const newJsonString = JSON.stringify(nodeConfig);
            const newBase64Part = btoa(unescape(encodeURIComponent(newJsonString)));
            return 'vmess://' + newBase64Part;
        } catch (e) {
            console.error("为 vmess 节点添加名称前缀失败，将回退到通用方法。", e);
            return appendToFragment(link, prefix);
        }
    }
    return appendToFragment(link, prefix);
}

/**
 * [兼容导出] 从节点URL提取地区信息
 */
export function extractRegionFromNodeName(nodeName) {
    return extractNodeRegion(nodeName);
}

/**
 * 为节点链接添加国旗 Emoji
 */
export function addFlagEmoji(link) {
    if (!link) return link;

    const appendEmoji = (name) => {
        // [修复] 先将台湾旗帜替换为中国国旗
        let processedName = name.replace(/🇹🇼/g, '🇨🇳');

        const region = extractNodeRegion(processedName);
        const emoji = getRegionEmoji(region);
        if (!emoji) return processedName;
        if (processedName.includes(emoji)) return processedName;
        return `${emoji} ${processedName}`;
    };

    if (link.startsWith('vmess://')) {
        try {
            const base64Part = link.substring('vmess://'.length);
            const binaryString = atob(base64Part);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const jsonString = new TextDecoder('utf-8').decode(bytes);
            const nodeConfig = JSON.parse(jsonString);
            if (nodeConfig.ps) {
                nodeConfig.ps = appendEmoji(nodeConfig.ps);
                const newJsonString = JSON.stringify(nodeConfig);
                const newBase64Part = btoa(unescape(encodeURIComponent(newJsonString)));
                return 'vmess://' + newBase64Part;
            }
            return link;
        } catch (e) {
            return link;
        }
    } else {
        const hashIndex = link.lastIndexOf('#');
        if (hashIndex === -1) return link;
        try {
            const originalName = decodeURIComponent(link.substring(hashIndex + 1));
            const newName = appendEmoji(originalName);
            return link.substring(0, hashIndex + 1) + encodeURIComponent(newName);
        } catch (e) {
            return link;
        }
    }
}

export function removeFlagEmoji(link) {
    if (!link) return link;

    const stripFlagEmoji = (name) => {
        if (!name) return name;
        let cleaned = name;
        const patterns = [
            /[\u{1F1E6}-\u{1F1FF}]{2}/gu, // 区旗字母对
            /\u{1F3F4}[\u{E0061}-\u{E007A}]{2,}\u{E007F}/gu, // 标签序列旗帜
            /\u{1F3F3}\uFE0F?\u200D\u{1F308}/gu, // 彩虹旗
            /\u{1F3F3}\uFE0F?\u200D\u{26A7}/gu, // 跨性别旗
            /[\u{1F3F1}\u{1F3F3}\u{1F3F4}\u{1F6A9}\u{1F3C1}\u{1F38C}]/gu // 常见旗帜符号
        ];
        for (const pattern of patterns) {
            cleaned = cleaned.replace(pattern, '');
        }
        return cleaned.replace(/\s{2,}/g, ' ').trim();
    };
    const decodeVmessPayload = (raw) => {
        try {
            let base64Part = raw;
            if (base64Part.includes('%')) {
                base64Part = decodeURIComponent(base64Part);
            }
            base64Part = base64Part.replace(/\s+/g, '');
            base64Part = base64Part.replace(/-/g, '+').replace(/_/g, '/');
            while (base64Part.length % 4 !== 0) {
                base64Part += '=';
            }
            return JSON.parse(new TextDecoder('utf-8').decode(Uint8Array.from(atob(base64Part), c => c.charCodeAt(0))));
        } catch (e) {
            return null;
        }
    };

    if (link.startsWith('vmess://')) {
        try {
            const payload = link.substring('vmess://'.length);
            const nodeConfig = decodeVmessPayload(payload);
            if (!nodeConfig || typeof nodeConfig !== 'object') return link;
            if (nodeConfig.ps) {
                nodeConfig.ps = stripFlagEmoji(nodeConfig.ps);
                const newJsonString = JSON.stringify(nodeConfig);
                const newBase64Part = btoa(unescape(encodeURIComponent(newJsonString)));
                return 'vmess://' + newBase64Part;
            }
            return link;
        } catch (e) {
            return link;
        }
    }

    const hashIndex = link.lastIndexOf('#');
    if (hashIndex === -1) return link;
    try {
        const originalName = decodeURIComponent(link.substring(hashIndex + 1));
        const newName = stripFlagEmoji(originalName);
        return link.substring(0, hashIndex + 1) + encodeURIComponent(newName);
    } catch (e) {
        return link;
    }
}

/**
 * [核心修复] 修复节点URL中的编码问题（包含 Hysteria2 密码解码）
 */
export function fixNodeUrlEncoding(nodeUrl) {
    if (typeof nodeUrl !== 'string' || nodeUrl.length === 0) {
        return nodeUrl;
    }

    // 1. 针对 Hysteria2/Hy2 的用户名与参数进行解码
    if (nodeUrl.startsWith('hysteria2://') || nodeUrl.startsWith('hy2://')) {
        const safeDecode = (value) => {
            try {
                return decodeURIComponent(value);
            } catch (e) {
                return value;
            }
        };
        const shouldKeepRaw = (decoded) => /[&=]/.test(decoded);

        // 解码 userinfo（密码）
        nodeUrl = nodeUrl.replace(/^(hysteria2|hy2):\/\/([^@]+)@/i, (match, scheme, auth) => {
            const decodedAuth = safeDecode(auth);
            if (decodedAuth === auth) return match;
            // 若解码后包含 URL 分隔符，保留原始值避免破坏结构
            if (/[@/?#]/.test(decodedAuth)) return match;
            return `${scheme}://${decodedAuth}@`;
        });

        // 解码 query 中的常用字段
        nodeUrl = nodeUrl.replace(/([?&](?:obfs-password|auth|password)=)([^&]+)/gi, (match, prefix, value) => {
            const decoded = safeDecode(value);
            return shouldKeepRaw(decoded) ? match : `${prefix}${decoded}`;
        });

        return nodeUrl;
    }

    // 2. 其他协议的 Base64 修复逻辑
    if (!nodeUrl.startsWith('ss://') && !nodeUrl.startsWith('vless://') && !nodeUrl.startsWith('trojan://')) {
        return nodeUrl;
    }

    try {
        const hashIndex = nodeUrl.indexOf('#');
        let baseLink = hashIndex !== -1 ? nodeUrl.substring(0, hashIndex) : nodeUrl;
        let fragment = hashIndex !== -1 ? nodeUrl.substring(hashIndex) : '';

        const protocolEnd = baseLink.indexOf('://');
        const atIndex = baseLink.indexOf('@');
        if (protocolEnd !== -1 && atIndex !== -1) {
            const base64Part = baseLink.substring(protocolEnd + 3, atIndex);
            if (base64Part.includes('%')) {
                const decodedBase64 = decodeURIComponent(base64Part);
                const protocol = baseLink.substring(0, protocolEnd);
                baseLink = protocol + '://' + decodedBase64 + baseLink.substring(atIndex);
            }
        }

        return baseLink + fragment;
    } catch (e) {
        return nodeUrl;
    }
}

/**
 * 净化节点名称以兼容 YAML Flow Style
 * 防止 Subconverter 生成的 YAML 包含非法起始字符（如 *）
 * @param {string} nodeUrl 
 * @returns {string} processedNodeUrl
 */
export function sanitizeNodeForYaml(nodeUrl) {
    if (!nodeUrl) return nodeUrl;

    // 针对不同协议提取和替换名称
    const sanitizeName = (name) => {
        if (!name) return name;
        // YAML Flow Style Unquoted Scalars cannot start with:
        // [, ], {, }, ,, :, -, ?, !, #, &, *, %, >, |, @
        // We replace them with full-width equivalents or '★' for *
        const unsafeStartRegex = /^([*&!\[\]\{\},:?#%|>@\-])/;
        if (unsafeStartRegex.test(name)) {
            return name.replace(/^[*]/, '★')
                .replace(/^&/, '＆')
                .replace(/^!/, '！')
                .replace(/^\[/, '【')
                .replace(/^\]/, '】')
                .replace(/^\{/, '｛')
                .replace(/^\}/, '｝')
                .replace(/^,/, '，')
                .replace(/^:/, '：')
                .replace(/^-/, '－')
                .replace(/^\?/, '？')
                .replace(/^#/, '＃')
                .replace(/^%/, '％')
                .replace(/^\|/, '｜')
                .replace(/^>/, '＞')
                .replace(/^@/, '＠');
        }
        return name;
    };

    if (nodeUrl.startsWith('vmess://')) {
        try {
            let base64Part = nodeUrl.substring('vmess://'.length);
            if (base64Part.includes('%')) {
                base64Part = decodeURIComponent(base64Part);
            }
            base64Part = base64Part.replace(/\s+/g, '');
            base64Part = base64Part.replace(/-/g, '+').replace(/_/g, '/');
            while (base64Part.length % 4 !== 0) {
                base64Part += '=';
            }
            const jsonString = new TextDecoder('utf-8').decode(Uint8Array.from(atob(base64Part), c => c.charCodeAt(0)));
            const nodeConfig = JSON.parse(jsonString);

            if (nodeConfig.ps) {
                const newPs = sanitizeName(nodeConfig.ps);
                if (newPs !== nodeConfig.ps) {
                    nodeConfig.ps = newPs;
                    const newJsonString = JSON.stringify(nodeConfig);
                    const newBase64Part = btoa(unescape(encodeURIComponent(newJsonString)));
                    return 'vmess://' + newBase64Part;
                }
            }
            return nodeUrl;
        } catch (e) {
            return nodeUrl;
        }
    } else {
        const hashIndex = nodeUrl.lastIndexOf('#');
        if (hashIndex === -1) return nodeUrl;
        try {
            const originalName = decodeURIComponent(nodeUrl.substring(hashIndex + 1));
            const newName = sanitizeName(originalName);
            if (newName !== originalName) {
                return nodeUrl.substring(0, hashIndex + 1) + encodeURIComponent(newName);
            }
            return nodeUrl;
        } catch (e) {
            return nodeUrl;
        }
    }
}
