/**
 * 节点统一转换管道
 * 支持：正则重命名、模板重命名、智能去重、排序
 */

import { extractNodeRegion, getRegionEmoji, REGION_KEYWORDS, REGION_EMOJI } from '../modules/utils/geo-utils.js';

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

function parseSsrServerPort(decoded) {
    const s = String(decoded || '');
    const m1 = s.match(/^\[([^\]]+)\]:(\d+):/);
    if (m1) return { server: m1[1], port: m1[2] };
    const m2 = s.match(/^(.+):(\d+):/);
    if (!m2) return { server: '', port: '' };
    return { server: m2[1], port: m2[2] };
}

function extractSsrRemarks(decoded) {
    const s = String(decoded || '');
    const slashQ = s.indexOf('/?');
    const q = slashQ !== -1 ? slashQ + 2 : (s.indexOf('?') !== -1 ? s.indexOf('?') + 1 : -1);
    if (q === -1) return '';
    const params = s.slice(q);
    const m = params.match(/(?:^|&)remarks=([^&]*)/);
    if (!m) return '';
    const raw = safeDecodeURI(m[1]).replace(/\s+/g, '');
    try { return base64Decode(raw).trim(); } catch { return ''; }
}

function extractServerPort(url, protocol) {
    const proto = normalizeProtocol(protocol || getProtocol(url));

    if (proto === 'vmess') {
        try {
            const payload = getSchemePayload(url, 8);
            const obj = JSON.parse(base64Decode(payload));
            return { server: String(obj.add || ''), port: String(obj.port || '') };
        } catch { return { server: '', port: '' }; }
    }

    if (proto === 'ssr') {
        try {
            const payload = getSchemePayload(url, 6);
            const decoded = base64Decode(payload);
            return parseSsrServerPort(decoded);
        } catch { return { server: '', port: '' }; }
    }

    try {
        const parsed = new URL(url);
        if (parsed.hostname) {
            if (!(proto === 'ss' && !parsed.port && !parsed.username && !url.includes('@'))) {
                return { server: parsed.hostname, port: parsed.port || '' };
            }
        }
    } catch (error) {
        console.debug('[NodeTransform] URL parse failed, falling back to manual parsing:', error);
    }

    try {
        const main = url.split('#')[0];
        const protocolEnd = main.indexOf('://');
        if (protocolEnd === -1) return { server: '', port: '' };
        let rest = main.slice(protocolEnd + 3).split('?')[0].split('/')[0];

        if (proto === 'ss' && !rest.includes('@')) {
            try {
                const decoded = base64Decode(rest);
                if (decoded.includes('@')) rest = decoded;
            } catch (error) {
                console.debug('[NodeTransform] SS base64 decode failed, using raw host segment:', error);
            }
        }

        // [新增] 处理 VLESS Base64 编码格式：vless://Base64(auto:uuid@host:port)?...
        if (proto === 'vless' && !rest.includes('@') && rest.length > 20) {
            try {
                const decoded = base64Decode(rest);
                if (decoded.includes('@')) rest = decoded;
            } catch (error) {
                console.debug('[NodeTransform] VLESS base64 decode failed (expected for standard format)');
            }
        }

        const at = rest.lastIndexOf('@');
        return parseHostPort(at === -1 ? rest : rest.slice(at + 1));
    } catch { return { server: '', port: '' }; }
}

function getNodeName(url, protocol) {
    const proto = normalizeProtocol(protocol || getProtocol(url));
    const fragmentName = getFragment(url);
    if (fragmentName) return fragmentName;

    // [修复] 如果 fragment 为空，尝试从 URL 查询参数中提取名称
    // 支持 remarks, des, remark 等常见参数（部分订阅源使用）
    const remarksMatch = String(url || '').match(/[?&](remarks|des|remark)=([^&#]+)/i);
    if (remarksMatch && remarksMatch[2]) {
        try {
            return decodeURIComponent(remarksMatch[2]).trim();
        } catch {
            return remarksMatch[2].trim();
        }
    }

    const nameMatch = String(url || '').match(/[?&](name|tag)=([^&#]+)/i);
    if (nameMatch && nameMatch[2]) {
        try {
            return decodeURIComponent(nameMatch[2]).trim();
        } catch {
            return nameMatch[2].trim();
        }
    }

    if (proto === 'vmess') {
        try {
            const payload = getSchemePayload(url, 8);
            const obj = JSON.parse(base64Decode(payload));
            return String(obj.ps || '').trim();
        } catch { return ''; }
    }
    if (proto === 'ssr') {
        try {
            const payload = getSchemePayload(url, 6);
            const decoded = base64Decode(payload);
            return extractSsrRemarks(decoded);
        } catch { return ''; }
    }
    return '';
}

function setNodeName(url, protocol, name) {
    const proto = normalizeProtocol(protocol || getProtocol(url));

    if (proto === 'vmess') {
        try {
            const { payload, query, hasFragment } = splitSchemeQueryAndFragment(url, 8);
            const obj = JSON.parse(base64Decode(payload));
            obj.ps = String(name || '');
            const rebuilt = `vmess://${base64Encode(JSON.stringify(obj))}${query}`;
            return hasFragment ? setFragment(rebuilt, name) : rebuilt;
        } catch { return setFragment(url, name); }
    }
    if (proto === 'ssr') {
        // SSR 需要同时更新 remarks 参数和 fragment
        try {
            const { payload, query } = splitSchemeQueryAndFragment(url, 6);
            const decoded = base64Decode(payload);
            const slashQ = decoded.indexOf('/?');
            const qIdx = slashQ !== -1 ? slashQ + 2 : (decoded.indexOf('?') !== -1 ? decoded.indexOf('?') + 1 : -1);
            if (qIdx === -1) return setFragment(url, name);

            const prefix = decoded.slice(0, qIdx);
            const paramStr = decoded.slice(qIdx);
            // 手动解析和重建参数，过滤空段避免非法拼接
            const rawParts = String(paramStr || '').split('&').filter(p => p && p.trim() !== '');
            let replaced = false;
            const parts = rawParts.map(p => {
                const eq = p.indexOf('=');
                const k = eq === -1 ? p : p.slice(0, eq);
                const v = eq === -1 ? '' : p.slice(eq + 1);
                if (k === 'remarks') {
                    replaced = true;
                    return `remarks=${base64UrlEncode(String(name || ''))}`;
                }
                return `${k}=${v}`;
            });
            if (!replaced) parts.push(`remarks=${base64UrlEncode(String(name || ''))}`);
            const rebuiltDecoded = prefix + parts.join('&');
            const rebuilt = `ssr://${base64UrlEncode(rebuiltDecoded)}${query}`;
            return setFragment(rebuilt, name);
        } catch { return setFragment(url, name); }
    }
    return setFragment(url, name);
}

function stripLeadingEmoji(name) {
    return String(name || '').replace(/^[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]\s*/g, '').trim();
}

// ============ 配置标准化 ============

function normalizeConfig(cfg) {
    const config = cfg && typeof cfg === 'object' ? cfg : {};
    const rename = config.rename || {};
    const regex = rename.regex || {};
    const template = rename.template || {};
    const dedup = config.dedup || {};
    const sort = config.sort || {};

    return {
        enabled: Boolean(config.enabled),
        enableEmoji: config.enableEmoji !== false,
        rename: {
            regex: {
                enabled: Boolean(regex.enabled),
                rules: Array.isArray(regex.rules) ? regex.rules : []
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

function applyRegexRename(name, rules) {
    let result = String(name || '');
    for (const rule of rules) {
        if (!rule?.pattern) continue;
        try {
            const re = new RegExp(rule.pattern, rule.flags || 'g');
            result = result.replace(re, rule.replacement || '');
        } catch (error) {
            warnInvalidRegex(rule, error);
        }
    }
    return result.trim();
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

function makeComparator(sortCfg) {
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
export function applyNodeTransformPipeline(nodeUrls, transformConfig = {}) {
    const cfg = normalizeConfig(transformConfig);
    const input = Array.isArray(nodeUrls)
        ? nodeUrls.map(s => String(s || '').trim()).filter(Boolean)
        : [];

    if (!cfg.enabled) return input;

    // 预判哪些字段需要计算，避免不必要的开销
    const sortKeys = cfg.sort.enabled ? (cfg.sort.keys || []) : [];
    const sortKeySet = new Set(sortKeys.map(k => String(k?.key || '')));
    const needServerPort = (cfg.dedup.enabled && cfg.dedup.mode !== 'url')
        || cfg.rename.template.enabled
        || (cfg.sort.enabled && (sortKeySet.has('server') || sortKeySet.has('port')));
    const needRegionEmoji = cfg.rename.template.enabled
        || (cfg.sort.enabled && sortKeySet.has('region'));

    // 解析为结构化记录（延迟计算 region/emoji）
    let records = input.map(url => {
        const protocol = normalizeProtocol(getProtocol(url));
        let name = getNodeName(url, protocol);
        // [修复] 将台湾旗帜替换为中国国旗
        name = name.replace(/🇹🇼/g, '🇨🇳');
        const { server, port } = needServerPort ? extractServerPort(url, protocol) : { server: '', port: '' };
        return { url, protocol, name, originalName: name, region: '', emoji: '', server, port };
    });

    // Stage 1: 正则重命名
    if (cfg.rename.regex.enabled && cfg.rename.regex.rules.length > 0) {
        records = records.map(r => ({
            ...r,
            name: applyRegexRename(r.name, cfg.rename.regex.rules)
        }));
    }

    // Stage 2: 智能去重
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
        records = records.map(r => {
            let regionZh = extractNodeRegion(r.name);           // 中文地区名，如 '美国'
            if (regionZh === '其他' && r.server) {
                regionZh = extractNodeRegion(r.server);
            }
            const regionCode = toRegionCode(regionZh);             // 地区代码，如 'US'
            const emoji = cfg.enableEmoji ? getRegionEmoji(regionZh) : '';  // emoji 需要用中文名查找
            return { ...r, region: regionCode, regionZh, emoji };
        });
    }

    // Stage 3: 模板重命名
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

    // Stage 4: 排序
    if (cfg.sort.enabled && cfg.sort.keys.length > 0) {
        records.sort(makeComparator(cfg.sort));
    }

    return records.map(r => r.url);
}
