// 地区展示配置：包含 Emoji 和标准中文名称
const REGION_DISPLAY_CONFIG = {
    '香港': { flag: '🇭🇰', name: '香港节点' },
    '台湾': { flag: '🇹🇼', name: '台湾节点' },
    '日本': { flag: '🇯🇵', name: '日本节点' },
    '新加坡': { flag: '🇸🇬', name: '狮城节点' },
    '美国': { flag: '🇺🇸', name: '美国节点' },
    '韩国': { flag: '🇰🇷', name: '韩国节点' },
    '英国': { flag: '🇬🇧', name: '英国节点' },
    '德国': { flag: '🇩🇪', name: '德国节点' },
    '法国': { flag: '🇫🇷', name: '法国节点' },
    '加拿大': { flag: '🇨🇦', name: '加拿大节点' },
    '澳大利亚': { flag: '🇦🇺', name: '澳洲节点' },
    '巴西': { flag: '🇧🇷', name: '巴西节点' },
    '西班牙': { flag: '🇪🇸', name: '西班牙节点' },
    '荷兰': { flag: '🇳🇱', name: '荷兰节点' },
    '俄罗斯': { flag: '🇷🇺', name: '俄国节点' },
    '印度': { flag: '🇮🇳', name: '印度节点' },
    '土耳其': { flag: '🇹🇷', name: '土耳其节点' }
};

export const REGION_GROUP_PATTERNS = [
    { name: '🇭🇰 香港节点', pattern: /港|HK|Hong Kong/i },
    { name: '🇹🇼 台湾节点', pattern: /台|TW|Taiwan/i },
    { name: '🇯🇵 日本节点', pattern: /日|JP|Japan/i },
    { name: '🇸🇬 狮城节点', pattern: /狮城|新|SG|Singapore/i },
    { name: '🇺🇸 美国节点', pattern: /美|US|America/i },
    { name: '🇰🇷 韩国节点', pattern: /韩|KR|Korea/i },
    { name: '🇬🇧 英国节点', pattern: /英|UK|England/i },
    { name: '🇩🇪 德国节点', pattern: /德|DE|Germany/i },
    { name: '🇫🇷 法国节点', pattern: /法|FR|France/i },
    { name: '🇧🇷 巴西节点', pattern: /巴西|BR|Brazil/i },
    { name: '🇪🇸 西班牙节点', pattern: /西班牙|ES|Spain/i },
    { name: '🇳🇱 荷兰节点', pattern: /荷兰|NL|Netherlands/i },
    { name: '🇦🇺 澳洲节点', pattern: /澳|AU|Australia/i }
];

function normalizeRegionOverrides(overrides = []) {
    if (!Array.isArray(overrides)) return [];
    return overrides
        .map(rule => {
            if (!rule || !rule.pattern || !rule.region) return null;
            try {
                return {
                    pattern: new RegExp(rule.pattern, rule.flags || 'i'),
                    region: String(rule.region).trim()
                };
            } catch {
                return null;
            }
        })
        .filter(Boolean);
}

export function groupNodeLinesByRegion(nodes = [], options = {}) {
    const groups = new Map();
    const regionOverrides = normalizeRegionOverrides(options.regionOverrides);

    nodes.forEach(node => {
        const tagName = node.tag || node.name;
        let region = '其他';
        const override = regionOverrides.find(rule => rule.pattern.test(tagName));

        // 1. 用户自定义规则优先，用于修正自动地区识别误判
        if (override) {
            region = override.region;
        } else if (node.metadata && node.metadata.region && node.metadata.region !== '其他') {
            // 2. 使用预提取的元数据
            region = node.metadata.region;
        } else {
            // 3. 回退到正则匹配逻辑
            for (const { name: groupName, pattern } of REGION_GROUP_PATTERNS) {
                if (pattern.test(tagName)) {
                    // [核心修复] 增强提取能力：直接由预设名称提取中文核心地名，解决 split 导致的问题
                    const match = groupName.match(/[\u4e00-\u9fa5]+/);
                    region = match ? match[0].replace('节点', '') : '其他';
                    break;
                }
            }
        }

        if (region === '其他') {
            region = '其他';
        }

        // 4. 构造标准的展示组名
        const config = REGION_DISPLAY_CONFIG[region] || { flag: '🌍', name: `${region}节点` };
        const groupName = `${config.flag} ${config.name}`;

        if (!groups.has(groupName)) {
            groups.set(groupName, []);
        }
        groups.get(groupName).push(node);
    });

    const result = [];
    groups.forEach((matchedNodes, name) => {
        result.push({
            name,
            tags: matchedNodes.map(item => item.tag || item.name),
            nodes: matchedNodes,
            count: matchedNodes.length,
            selectorTag: `${name} 选择`,
            urltestTag: `${name} 测速`,
            fallbackTag: `${name} 兜底`
        });
    });

    return result;
}
