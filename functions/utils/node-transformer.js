/**
 * 节点统一转换管道
 * 支持：正则过滤、正则重命名、模板重命名、智能去重、排序
 */

import { parseNodeInfo, extractNodeRegion, getRegionEmoji, REGION_KEYWORDS, REGION_EMOJI } from '../modules/utils/geo-utils.js';
import { extractNodeMetadata } from '../modules/utils/metadata-extractor.js';

// ============ 默认配置 ============

const DEFAULT_SORT_KEYS = [
    { key: 'region', order: 'asc', customOrder: ['香港', '台湾', '日本', '新加坡', '美国', '韩国', '英国', '德国', '法国', '加拿大'] },
    { key: 'protocol', order: 'asc', customOrder: ['vless', 'trojan', 'vmess', 'hysteria2', 'ss', 'ssr'] },
    { key: 'name', order: 'asc' }
];

const REGION_CODE_TO_ZH = buildRegionCodeToZhMap();
const REGION_ZH_TO_CODE = buildZhToCodeMap();
const warnedRegexRules = new Set();

function warnInvalidRegex(rule, error) {
    const key = `${rule.pattern || ''}|${rule.flags || ''}`;
    if (warnedRegexRules.has(key)) return;
    warnedRegexRules.add(key);
    console.warn('[NodeTransform] Invalid rename regex:', {
        pattern: rule.pattern,
        flags: rule.flags,
        error: error?.message || String(error)
    });
}

// ============ 工具函数 ============

function safeDecodeURI(value) {
    try { return decodeURIComponent(value); }
    catch { return value; }
}

function normalizeBase64(input) {
    let s = String(input || '').trim().replace(/\s+/g, '');
    if (!s) return '';
    // 处理可能被 URL 编码的 Base64
    if (s.includes('%')) {
        try {
            s = decodeURIComponent(s);
        } catch (error) {
            console.debug('[NodeTransform] Failed to decode base64 segment:', error);
        }
    }
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4 !== 0) s += '=';
    return s;
}

function base64UrlEncode(text) {
    return base64Encode(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function getSchemePayload(url, prefixLen) {
    const rest = String(url || '').slice(prefixLen);
    const cut = rest.search(/[?#]/);
    return (cut === -1 ? rest : rest.slice(0, cut)).trim();
}

function splitSchemeQueryAndFragment(url, prefixLen) {
    const rest = String(url || '').slice(prefixLen);
    const hashIdx = rest.indexOf('#');
    const queryIdx = rest.indexOf('?');
    const queryActive = queryIdx !== -1 && (hashIdx === -1 || queryIdx < hashIdx);
    let payloadEnd = -1;
    if (hashIdx !== -1) payloadEnd = hashIdx;
    if (queryActive) payloadEnd = payloadEnd === -1 ? queryIdx : Math.min(payloadEnd, queryIdx);
    const payload = (payloadEnd === -1 ? rest : rest.slice(0, payloadEnd)).trim();
    const query = queryActive ? rest.slice(queryIdx, hashIdx === -1 ? undefined : hashIdx) : '';
    return { payload, query, hasFragment: hashIdx !== -1 };
}

function base64Decode(base64) {
    const binary = atob(normalizeBase64(base64));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
}

function base64Encode(text) {
    const bytes = new TextEncoder().encode(String(text));
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function getProtocol(url) {
    const m = String(url || '').match(/^([a-zA-Z0-9+.-]+):\/\//);
    return m ? m[1].toLowerCase() : 'unknown';
}

/**
 * 归一化协议名称，将别名统一为标准名
 */
function normalizeProtocol(proto) {
    const p = String(proto || 'unknown').toLowerCase();
    if (p === 'hy' || p === 'hy2' || p === 'hysteria') return 'hysteria2';
    return p;
}

function getFragment(url) {
    const idx = String(url || '').lastIndexOf('#');
    if (idx === -1) return '';
    return safeDecodeURI(url.slice(idx + 1)).trim();
}

function setFragment(url, name) {
    const s = String(url || '');
    const idx = s.lastIndexOf('#');
    const base = idx === -1 ? s : s.slice(0, idx);
    return `${base}#${encodeURIComponent(String(name || ''))}`;
}

function parseHostPort(hostPort) {
    const s = String(hostPort || '').trim();
    if (!s) return { server: '', port: '' };
    if (s.startsWith('[') && s.includes(']')) {
        const end = s.indexOf(']');
        const host = s.slice(1, end);
        const rest = s.slice(end + 1);
        return { server: host, port: rest.startsWith(':') ? rest.slice(1) : '' };
    }
    const lastColon = s.lastIndexOf(':');
    if (lastColon === -1) return { server: s, port: '' };
    const host = s.slice(0, lastColon);
    if (host.includes(':')) return { server: s, port: '' };
    return { server: host, port: s.slice(lastColon + 1) };
}

// ============ 节点解析 ============

function stripLeadingEmoji(name) {
    return String(name || '').replace(/^[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]\s*/g, '').trim();
}

// ============ 配置标准化 ============

function normalizeConfig(cfg) {
    const config = cfg && typeof cfg === 'object' ? cfg : {};
    const filter = config.filter || {};
    const rename = config.rename || {};
    const regex = rename.regex || {};
    const template = rename.template || {};
    const dedup = config.dedup || {};
    const sort = config.sort || {};

    return {
        enabled: Boolean(config.enabled),
        enableEmoji: config.enableEmoji !== false,
        filter: {
            include: {
                enabled: Boolean(filter.include?.enabled),
                rules: Array.isArray(filter.include?.rules) ? filter.include.rules : []
            },
            exclude: {
                enabled: Boolean(filter.exclude?.enabled),
                rules: Array.isArray(filter.exclude?.rules) ? filter.exclude.rules : []
            },
            protocols: {
                enabled: Boolean(filter.protocols?.enabled),
                values: Array.isArray(filter.protocols?.values)
                    ? filter.protocols.values.map(value => normalizeProtocol(value)).filter(Boolean)
                    : []
            },
            regions: {
                enabled: Boolean(filter.regions?.enabled),
                values: Array.isArray(filter.regions?.values)
                    ? filter.regions.values.map(value => toRegionZh(value)).filter(Boolean)
                    : []
            },
            script: {
                enabled: Boolean(filter.script?.enabled),
                expression: String(filter.script?.expression || '').trim()
            },
            useless: {
                enabled: Boolean(filter.useless?.enabled)
            }
        },
        rename: {
            regex: {
                enabled: Boolean(regex.enabled),
                rules: Array.isArray(regex.rules) ? regex.rules : []
            },
            script: {
                enabled: Boolean(rename.script?.enabled),
                expression: String(rename.script?.expression || '').trim()
            },
            template: {
                enabled: Boolean(template.enabled),
                template: template.template || '{emoji}{region}-{protocol}-{index}',
                indexStart: Number.isFinite(template.indexStart) ? template.indexStart : 1,
                indexPad: Number.isFinite(template.indexPad) ? template.indexPad : 2,
                indexScope: template.indexScope || 'regionProtocol',
                regionAlias: template.regionAlias || {},
                protocolAlias: template.protocolAlias || {}
            }
        },
        dedup: {
            enabled: Boolean(dedup.enabled),
            mode: dedup.mode === 'url' ? 'url' : 'serverPort',
            includeProtocol: Boolean(dedup.includeProtocol),
            prefer: {
                protocolOrder: Array.isArray(dedup.prefer?.protocolOrder)
                    ? dedup.prefer.protocolOrder.map(s => String(s).toLowerCase())
                    : []
            }
        },
        sort: {
            enabled: Boolean(sort.enabled),
            nameIgnoreEmoji: sort.nameIgnoreEmoji !== false,
            keys: Array.isArray(sort.keys) && sort.keys.length > 0
                ? sort.keys
                : DEFAULT_SORT_KEYS
        }
    };
}

// ============ 转换函数 ============

export function matchesRegexRules(name, rules) {
    const value = String(name || '');
    for (const rule of rules) {
        if (!rule) continue;
        
        // 兼容规则既可以是对象 {pattern: "...", flags: "..."} 也可以是纯字符串
        const pattern = typeof rule === 'string' ? rule : rule.pattern;
        const flags = typeof rule === 'string' ? 'i' : (rule.flags || 'i');
        
        if (!pattern) continue;
        
        try {
            const re = new RegExp(pattern, flags);
            if (re.test(value)) return true;
        } catch (error) {
            warnInvalidRegex(typeof rule === 'string' ? { pattern: rule } : rule, error);
        }
    }
    return false;
}

export function ensureRegionInfo(record, enableEmoji = false) {
    if (record.regionZh) return record;
    
    // 优先使用预解析的元数据
    let regionZh = record.metadata?.regionZh || extractNodeRegion(record.name);
    let regionCode = record.metadata?.region || '';

    if (regionZh === '其他' && record.server) {
        regionZh = extractNodeRegion(record.server);
    }
    
    if (!regionCode) {
        regionCode = toRegionCode(regionZh);
    }
    
    const emoji = enableEmoji ? (record.metadata?.flag || getRegionEmoji(regionZh)) : '';
    return { ...record, region: regionCode, regionZh, emoji };
}

function isUselessNode(record) {
    const name = String(record?.name || '').trim();
    const protocol = normalizeProtocol(record?.protocol);
    const server = String(record?.server || '').trim().toLowerCase();

    if (!name) return true;

    if (
        protocol === 'trojan'
        && server === '127.0.0.1'
        && /(?:流量剩余|剩余流量|订阅已失效|订阅已到期|已过期|到期提醒|到期时间|套餐到期|过期时间)/i.test(name)
    ) {
        return true;
    }

    return /(?:流量剩余|剩余流量|已用流量|总流量|套餐到期|到期时间|过期时间|订阅已失效|订阅已到期|已过期|官网|群组|频道|联系客服|测试节点|回车更新|点击订阅|剩余套餐|订阅信息)/i.test(name);
}

/**
 * [核心引擎] 将新名称写回不同协议的节点 URL
 * 支持 VMess (JSON-Base64)、VLESS/Trojan/SS (Fragment)
 */
export function setNodeName(url, protocol, newName) {
    if (!url || !newName) return url;
    const proto = String(protocol || '').toLowerCase();

    try {
        if (proto === 'vmess') {
            let base64Part = url.replace('vmess://', '');
            // 处理 URL-Safe Base64
            let safeBody = base64Part.replace(/-/g, '+').replace(/_/g, '/');
            while (safeBody.length % 4) safeBody += '=';
            
            const decoded = new TextDecoder().decode(Uint8Array.from(atob(safeBody), c => c.charCodeAt(0)));
            const config = JSON.parse(decoded);
            config.ps = newName;
            
            // 重新编码为标准 Base64 (非 URL-Safe 以保持最大兼容性)
            const newJson = JSON.stringify(config);
            const newBase64 = btoa(unescape(encodeURIComponent(newJson)));
            return 'vmess://' + newBase64;
        } else {
            // VLESS / Trojan / SS / Shadowsocks / Hysteria2 / Snell
            // 处理 # 后缀即可
            const hashIndex = url.lastIndexOf('#');
            const baseUrl = hashIndex !== -1 ? url.substring(0, hashIndex) : url;
            return baseUrl + '#' + encodeURIComponent(newName);
        }
    } catch (e) {
        console.warn('[NodeUtils] setNodeName failed:', e);
        return url;
    }
}

export function applyRegexRename(name, rules) {
    let result = String(name || '');
    if (!Array.isArray(rules)) return result;

    for (const rule of rules) {
        if (!rule) continue;
        
        // 兼容规则既可以是对象 {pattern: "...", flags: "...", replacement: "..."} 也可以是纯字符串
        const pattern = typeof rule === 'string' ? rule : rule.pattern;
        const replacement = typeof rule === 'string' ? '' : (rule.replacement || '');
        const flags = typeof rule === 'string' ? 'gi' : (rule.flags || 'gi');

        if (!pattern) continue;
        
        try {
            const re = new RegExp(pattern, flags);
            result = result.replace(re, replacement);
        } catch (error) {
            warnInvalidRegex(typeof rule === 'string' ? { pattern: rule } : rule, error);
        }
    }
    return result.trim();
}

function safeTitle(value) {
    const text = String(value || '');
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function safeContains(value, keyword) {
    return String(value || '').toLowerCase().includes(String(keyword || '').toLowerCase());
}

function safeMatch(value, pattern, flags = 'i') {
    try {
        return new RegExp(pattern, flags).test(String(value || ''));
    } catch {
        return false;
    }
}

function safeFallback(...values) {
    for (const value of values) {
        if (value !== null && value !== undefined && String(value).trim() !== '') return value;
    }
    return '';
}

function safePick(condition, truthyValue, falsyValue = '') {
    return condition ? truthyValue : falsyValue;
}

function safeRegionAlias(regionValue) {
    const region = toRegionZh(regionValue);
    const aliases = {
        '香港': 'HK',
        '台湾': 'TW',
        '日本': 'JP',
        '新加坡': 'SG',
        '美国': 'US',
        '韩国': 'KR',
        '英国': 'UK'
    };
    return aliases[region] || toRegionCode(region);
}

function safeProtocolAlias(protocolValue) {
    const protocol = normalizeProtocol(protocolValue);
    const aliases = {
        hysteria2: 'hy2',
        shadowsocks: 'ss'
    };
    return aliases[protocol] || protocol;
}

function applyScriptRename(record, expression) {
    if (!expression) return record.name;
    try {
        const runner = new Function(
            'ctx',
            'helpers',
            `"use strict"; const { name, originalName, protocol, region, regionZh, emoji, server, port, index } = ctx; const { upper, lower, title, trim, replace, contains, match, fallback, pick, regionAlias, protocolAlias } = helpers; return (${expression});`
        );
        const result = runner({
            name: record.name,
            originalName: record.originalName,
            protocol: record.protocol,
            region: record.region,
            regionZh: record.regionZh,
            emoji: record.emoji,
            server: record.server,
            port: record.port,
            index: record.index ?? ''
        }, {
            upper: value => String(value || '').toUpperCase(),
            lower: value => String(value || '').toLowerCase(),
            title: value => safeTitle(value),
            trim: value => String(value || '').trim(),
            replace: (value, pattern, replacement, flags = 'g') => String(value || '').replace(new RegExp(pattern, flags), replacement || ''),
            contains: (value, keyword) => safeContains(value, keyword),
            match: (value, pattern, flags = 'i') => safeMatch(value, pattern, flags),
            fallback: (...values) => safeFallback(...values),
            pick: (condition, truthyValue, falsyValue = '') => safePick(condition, truthyValue, falsyValue),
            regionAlias: value => safeRegionAlias(value),
            protocolAlias: value => safeProtocolAlias(value)
        });
        return String(result ?? '').trim() || record.name;
    } catch (error) {
        console.warn('[NodeTransform] Invalid rename script expression:', error?.message || String(error));
        return record.name;
    }
}

function evaluateScriptExpression(record, expression) {
    if (!expression) return true;
    try {
        const runner = new Function(
            'ctx',
            'helpers',
            `"use strict"; const { name, originalName, protocol, region, regionZh, emoji, server, port, index } = ctx; const { upper, lower, title, trim, replace, contains, match, fallback, pick, regionAlias, protocolAlias } = helpers; return (${expression});`
        );
        return runner({
            name: record.name,
            originalName: record.originalName,
            protocol: record.protocol,
            region: record.region,
            regionZh: record.regionZh,
            emoji: record.emoji,
            server: record.server,
            port: record.port,
            index: record.index ?? ''
        }, {
            upper: value => String(value || '').toUpperCase(),
            lower: value => String(value || '').toLowerCase(),
            title: value => safeTitle(value),
            trim: value => String(value || '').trim(),
            replace: (value, pattern, replacement, flags = 'g') => String(value || '').replace(new RegExp(pattern, flags), replacement || ''),
            contains: (value, keyword) => safeContains(value, keyword),
            match: (value, pattern, flags = 'i') => safeMatch(value, pattern, flags),
            fallback: (...values) => safeFallback(...values),
            pick: (condition, truthyValue, falsyValue = '') => safePick(condition, truthyValue, falsyValue),
            regionAlias: value => safeRegionAlias(value),
            protocolAlias: value => safeProtocolAlias(value)
        });
    } catch (error) {
        console.warn('[NodeTransform] Invalid filter script expression:', error?.message || String(error));
        return true;
    }
}

function makeDedupKey(record, cfg) {
    const server = String(record.server || '').trim().toLowerCase();
    const port = String(record.port || '').trim();
    if (!server || !port) return '';
    const base = `${server}:${port}`;
    return cfg.dedup.includeProtocol ? `${record.protocol}|${base}` : base;
}

function choosePreferred(existing, candidate, protocolOrder) {
    if (!existing) return candidate;
    if (!protocolOrder?.length) return existing;
    const rank = p => {
        const idx = protocolOrder.indexOf(String(p || '').toLowerCase());
        return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    };
    return rank(candidate.protocol) < rank(existing.protocol) ? candidate : existing;
}

function buildRegionCodeToZhMap() {
    const map = {};
    for (const [zhName, keywords] of Object.entries(REGION_KEYWORDS || {})) {
        if (!Array.isArray(keywords)) continue;
        for (const keyword of keywords) {
            const code = String(keyword || '').trim();
            if (/^[A-Za-z]{2,3}$/.test(code)) {
                const upper = code.toUpperCase();
                if (!map[upper]) map[upper] = zhName;
            }
        }
    }
    if (map['GB'] && !map['UK']) map['UK'] = map['GB'];
    return map;
}

/**
 * 构建中文地区名到地区代码的映射
 * 例如: { '美国': 'US', '香港': 'HK' }
 */
function buildZhToCodeMap() {
    const map = {};
    for (const [zhName, keywords] of Object.entries(REGION_KEYWORDS || {})) {
        if (!Array.isArray(keywords)) continue;
        // 取第一个符合地区代码格式的关键词作为该地区的代码
        for (const keyword of keywords) {
            const code = String(keyword || '').trim();
            if (/^[A-Za-z]{2,3}$/.test(code)) {
                map[zhName] = code.toUpperCase();
                break;
            }
        }
    }
    return map;
}

/**
 * 将中文地区名转换为地区代码
 * @param {string} zhRegion - 中文地区名 (如 '美国')
 * @returns {string} 地区代码 (如 'US')，如未找到则返回原值
 */
function toRegionCode(zhRegion) {
    const region = String(zhRegion || '').trim();
    if (!region) return '';
    // 如果已经是地区代码格式，直接返回大写
    if (/^[A-Za-z]{2,3}$/.test(region)) return region.toUpperCase();
    // 从映射表中查找
    return REGION_ZH_TO_CODE[region] || region;
}

function toRegionZh(value) {
    const region = String(value || '').trim();
    if (!region) return '';
    if (/[\u4e00-\u9fa5]/.test(region)) return region;
    const upper = region.toUpperCase();
    return REGION_CODE_TO_ZH[upper] || region;
}

function applyModifier(key, value, modifier, record) {
    const val = value == null ? '' : String(value);
    switch (modifier) {
        case 'UPPER': return val.toUpperCase();
        case 'lower': return val.toLowerCase();
        case 'Title': return val.charAt(0).toUpperCase() + val.slice(1);
        case 'zh':
            // 对于 region:zh，直接返回 regionZh（中文地区名）
            if (key === 'region' && record && record.regionZh) {
                return record.regionZh;
            }
            return key === 'region' ? toRegionZh(val) : val;
        default: return val;
    }
}

function renderTemplate(template, vars, record) {
    return String(template || '').replace(/\{([a-zA-Z0-9_]+)(?::([a-zA-Z]+))?\}/g, (_, key, modifier) => {
        if (!Object.prototype.hasOwnProperty.call(vars, key)) return '';
        let v = vars[key];
        if (modifier) v = applyModifier(key, v, modifier, record);
        return v == null ? '' : String(v);
    }).trim();
}

function padIndex(n, width) {
    return width > 0 ? String(n).padStart(width, '0') : String(n);
}

function getIndexGroupKey(record, scope) {
    switch (scope) {
        case 'region': return `r:${record.region}`;
        case 'protocol': return `p:${record.protocol}`;
        case 'regionProtocol': return `rp:${record.region}|${record.protocol}`;
        default: return 'global';
    }
}

export function makeComparator(sortCfg) {
    const keys = sortCfg.keys || [];
    const nameIgnoreEmoji = sortCfg.nameIgnoreEmoji !== false;

    // 预先构建 customOrder 索引 Map，将 O(n) 查找优化为 O(1)
    const customOrderMaps = keys.map(k => {
        if (!Array.isArray(k?.customOrder)) return null;
        const map = new Map();
        k.customOrder.forEach((v, i) => map.set(String(v), i));
        return map;
    });

    const cmpStr = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });
    const cmpNum = (a, b) => {
        const an = Number(a), bn = Number(b);
        if (Number.isNaN(an) && Number.isNaN(bn)) return 0;
        if (Number.isNaN(an)) return 1;
        if (Number.isNaN(bn)) return -1;
        return an - bn;
    };

    /**
     * IP 地址比较器
     * 支持 IPv4 用于数字排序，其他作为字符串排序
     */
    const cmpIp = (a, b) => {
        const ip4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        const ma = String(a).match(ip4Regex);
        const mb = String(b).match(ip4Regex);

        if (ma && mb) {
            for (let i = 1; i <= 4; i++) {
                const diff = parseInt(ma[i]) - parseInt(mb[i]);
                if (diff !== 0) return diff;
            }
            return 0;
        }
        // 如果其中一个是 IPv4，让 IPv4 排在前面 (可选优化)
        if (ma) return -1;
        if (mb) return 1;

        // 否则按字符串排序
        return cmpStr(a, b);
    };

    return (ra, rb) => {
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if (!k?.key) continue;
            const key = String(k.key);
            const order = String(k.order || 'asc').toLowerCase() === 'desc' ? -1 : 1;
            const orderMap = customOrderMaps[i];

            let va, vb;
            if (key === 'name') {
                va = nameIgnoreEmoji ? stripLeadingEmoji(ra.name) : ra.name;
                vb = nameIgnoreEmoji ? stripLeadingEmoji(rb.name) : rb.name;
                const r = cmpStr(va, vb);
                if (r !== 0) return r * order;
                continue;
            }
            if (key === 'region') {
                va = ra.regionZh || ra.region;
                vb = rb.regionZh || rb.region;
                if (orderMap) {
                    const ia = orderMap.get(String(va || ''));
                    const ib = orderMap.get(String(vb || ''));
                    const raIdx = ia === undefined ? Number.MAX_SAFE_INTEGER : ia;
                    const rbIdx = ib === undefined ? Number.MAX_SAFE_INTEGER : ib;
                    if (raIdx !== rbIdx) return (raIdx - rbIdx) * order;
                }
                const r = cmpStr(va, vb);
                if (r !== 0) return r * order;
                continue;
            }
            if (key === 'port') {
                const r = cmpNum(ra.port, rb.port);
                if (r !== 0) return r * order;
                continue;
            }
            if (key === 'server') {
                const r = cmpIp(ra.server, rb.server);
                if (r !== 0) return r * order;
                continue;
            }

            va = ra[key];
            vb = rb[key];

            if (orderMap) {
                const ia = orderMap.get(String(va || ''));
                const ib = orderMap.get(String(vb || ''));
                const raIdx = ia === undefined ? Number.MAX_SAFE_INTEGER : ia;
                const rbIdx = ib === undefined ? Number.MAX_SAFE_INTEGER : ib;
                if (raIdx !== rbIdx) return (raIdx - rbIdx) * order;
            }

            const r = cmpStr(va, vb);
            if (r !== 0) return r * order;
        }
        return 0;
    };
}

// ============ 主管道函数 ============

/**
 * 对节点 URL 列表应用统一转换管道
 * @param {string[]} nodeUrls - 节点 URL 数组
 * @param {Object} transformConfig - 转换配置
 * @returns {string[]} 处理后的节点 URL 数组
 */
/**
 * 将 URL 列表转换为结构化 Record 列表
 */
export function nodeUrlsToRecords(nodeUrls, options = {}) {
    const input = Array.isArray(nodeUrls)
        ? nodeUrls.map(s => String(s || '').trim()).filter(Boolean)
        : [];
    
    return input.map(url => {
        // 使用统一的解析引擎
        const nodeInfo = parseNodeInfo(url);
        const metadata = extractNodeMetadata(nodeInfo.name);
        
        const record = { 
            url, 
            protocol: nodeInfo.protocol, 
            name: nodeInfo.name, 
            originalName: nodeInfo.name, 
            region: '', 
            emoji: '', 
            server: nodeInfo.server || '', 
            port: nodeInfo.port || '',
            metadata: metadata // 注入完整元数据
        };
        
        return options.ensureRegion ? ensureRegionInfo(record, options.enableEmoji) : record;
    });
}

/**
 * 将 Record 列表写回 URL 列表
 */
export function recordsToNodeUrls(records) {
    if (!Array.isArray(records)) return [];
    return records.map(r => {
        // 如果名称发生变化（例如被正则重命名或脚本重命名），同步更新 URL
        if (r.name && r.name !== r.originalName) {
            return setNodeName(r.url, r.protocol, r.name);
        }
        return r.url;
    });
}

export function applyNodeTransformPipeline(nodeUrls, transformConfig = {}) {
    const cfg = normalizeConfig(transformConfig);
    if (!cfg.enabled) return nodeUrls;

    const sortKeys = cfg.sort.enabled ? (cfg.sort.keys || []) : [];
    const sortKeySet = new Set(sortKeys.map(k => String(k?.key || '')));
    const needServerPort = (cfg.dedup.enabled && cfg.dedup.mode !== 'url')
        || cfg.rename.template.enabled
        || (cfg.sort.enabled && (sortKeySet.has('server') || sortKeySet.has('port')));

    let records = nodeUrlsToRecords(nodeUrls, { 
        needServerPort, 
        ensureRegion: false 
    });

    const needRegionEmoji = cfg.rename.template.enabled
        || (cfg.filter.regions.enabled && cfg.filter.regions.values.length > 0)
        || (cfg.sort.enabled && sortKeySet.has('region'))
        || (cfg.filter.script.enabled && cfg.filter.script.expression);

    // Stage 1: 正则过滤
    if (cfg.filter.include.enabled && cfg.filter.include.rules.length > 0) {
        records = records.filter(r => matchesRegexRules(r.name, cfg.filter.include.rules));
    }
    // ... (rest of the pipe remains similar but simplified)

    if (cfg.filter.exclude.enabled && cfg.filter.exclude.rules.length > 0) {
        records = records.filter(r => !matchesRegexRules(r.name, cfg.filter.exclude.rules));
    }

    if (cfg.filter.protocols.enabled && cfg.filter.protocols.values.length > 0) {
        const allowedProtocols = new Set(cfg.filter.protocols.values.map(value => normalizeProtocol(value)));
        records = records.filter(r => allowedProtocols.has(r.protocol));
    }

    if (cfg.filter.regions.enabled && cfg.filter.regions.values.length > 0) {
        const allowedRegions = new Set(cfg.filter.regions.values.map(value => toRegionZh(value)));
        records = records
            .map(r => ensureRegionInfo(r, cfg.enableEmoji))
            .filter(r => allowedRegions.has(r.regionZh));
    }

    if (cfg.filter.script.enabled && cfg.filter.script.expression) {
        records = records
            .map((r, index) => ({ ...(needRegionEmoji ? r : ensureRegionInfo(r, cfg.enableEmoji)), index: index + 1 }))
            .filter(r => Boolean(evaluateScriptExpression(r, cfg.filter.script.expression)));
    }

    if (cfg.filter.useless.enabled) {
        records = records.filter(r => !isUselessNode(r));
    }

    // Stage 2: 正则重命名
    if (cfg.rename.regex.enabled && cfg.rename.regex.rules.length > 0) {
        records = records.map(r => ({
            ...r,
            name: applyRegexRename(r.name, cfg.rename.regex.rules)
        }));
    }

    // Stage 3: 智能去重
    if (cfg.dedup.enabled) {
        if (cfg.dedup.mode === 'url') {
            const seen = new Set();
            records = records.filter(r => {
                if (seen.has(r.url)) return false;
                seen.add(r.url);
                return true;
            });
        } else {
            const map = new Map();
            for (const r of records) {
                const key = makeDedupKey(r, cfg);
                if (!key) {
                    map.set(`__raw__:${r.url}`, r);
                    continue;
                }
                map.set(key, choosePreferred(map.get(key), r, cfg.dedup.prefer.protocolOrder));
            }
            records = Array.from(map.values());
        }
    }

    // 去重后再计算 region/emoji：修复"正则改名后 region 未更新"问题，并减少大列表开销
    // 注意：extractNodeRegion 返回中文地区名，我们需要同时保存中文名和代码
    if (needRegionEmoji) {
        records = records.map(r => ensureRegionInfo(r, cfg.enableEmoji));
    }

    // Stage 4: 受限表达式改写
    if (cfg.rename.script.enabled && cfg.rename.script.expression) {
        records = records.map((r, index) => {
            const enriched = needRegionEmoji ? r : ensureRegionInfo(r, cfg.enableEmoji);
            const newName = applyScriptRename({ ...enriched, index: index + 1 }, cfg.rename.script.expression);
            return {
                ...enriched,
                name: newName,
                url: newName ? setNodeName(enriched.url, enriched.protocol, newName) : enriched.url
            };
        });
    }

    // Stage 5: 模板重命名
    if (cfg.rename.template.enabled) {
        const templateHasEmoji = cfg.rename.template.template.includes('{emoji}');
        const groupBuckets = new Map();
        for (const r of records) {
            const gk = getIndexGroupKey(r, cfg.rename.template.indexScope);
            const arr = groupBuckets.get(gk) || [];
            arr.push(r);
            groupBuckets.set(gk, arr);
        }

        // [Modified] Remove forced sorting to preserve original node order
        // Users can enable explicit sorting if they want deterministic ordering
        // arr.sort((a, b) => { ... });

        const nextIndex = new Map();
        for (const [gk, arr] of groupBuckets.entries()) {
            nextIndex.set(gk, cfg.rename.template.indexStart);
            for (const r of arr) {
                const regionText = cfg.rename.template.regionAlias[r.region] || r.region;
                const protocolText = cfg.rename.template.protocolAlias[r.protocol] || r.protocol;
                const currentIndex = nextIndex.get(gk);
                nextIndex.set(gk, currentIndex + 1);

                const vars = {
                    emoji: r.emoji,
                    region: regionText,
                    protocol: protocolText,
                    index: padIndex(currentIndex, cfg.rename.template.indexPad),
                    name: templateHasEmoji ? stripLeadingEmoji(r.name) : r.name,
                    server: r.server,
                    port: r.port
                };
                const newName = renderTemplate(cfg.rename.template.template, vars, r);
                r.name = newName;
                r.url = setNodeName(r.url, r.protocol, newName);
            }
        }
    } else if (cfg.rename.regex.enabled && cfg.rename.regex.rules.length > 0) {
        // 仅正则时也要写回 URL
        records = records.map(r => ({
            ...r,
            url: r.name ? setNodeName(r.url, r.protocol, r.name) : r.url
        }));
    }

    // Stage 6: 排序
    if (cfg.sort.enabled && cfg.sort.keys.length > 0) {
        records.sort(makeComparator(cfg.sort));
    }

    return records.map(r => r.url);
}
