import { extractNodeRegion, getRegionEmoji } from './geo-utils.js';

/**
 * 节点元数据提取器
 * 核心功能：从节点名称中解析物理/逻辑属性
 */

// 常用元数据正则表达式
const MULTIPLIER_REGEX = /(?:^|\s|[\[\(\x])([0-9]+(?:\.[0-9]+)?)(?:\s*倍|x|X)(?:\s|$|[\]\)])/i;
const TAG_REGEX = /(?:\[|\(|#|\s)([a-zA-Z0-9_\-]+)(?:\]|\)|\s|$)/g;
const EMOJI_FLAG_REGEX = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;

/**
 * 从名称中提取元数据
 * @param {string} name - 原始节点名称
 * @returns {Object} 结构化元数据
 */
export function extractNodeMetadata(name) {
    if (!name || typeof name !== 'string') {
        return { originalName: name, cleanName: name, multiplier: 1.0, tags: [], region: '其他', flag: '' };
    }

    let cleanName = name;
    
    // 1. 提取倍率 (Multiplier)
    let multiplier = 1.0;
    const mMatch = name.match(MULTIPLIER_REGEX);
    if (mMatch) {
        multiplier = parseFloat(mMatch[1]);
        // 从干净名称中移除倍率标识以净化 UI
        cleanName = cleanName.replace(mMatch[0], ' ').trim();
    }

    // 2. 提取地区与国旗 (Region & Flag)
    // 优先提取现有的国旗 Emoji
    const flagMatches = name.match(EMOJI_FLAG_REGEX);
    const flag = flagMatches ? flagMatches[0] : '';
    
    // 使用已有的 geo-utils 识别地区
    const region = extractNodeRegion(name);
    
    // 如果名称里没有国旗但识别出了地区，尝试根据地区补全国旗
    const autoFlag = flag || getRegionEmoji(region);

    // 3. 提取技术标签 (Tags)
    const tags = [];
    let tMatch;
    TAG_REGEX.lastIndex = 0;
    while ((tMatch = TAG_REGEX.exec(name)) !== null) {
        const tag = tMatch[1];
        // 过滤掉纯数字（通常是编号）和地区关键词
        if (!/^\d+$/.test(tag) && tag.length > 2) {
            tags.push(tag);
        }
    }

    // 4. 进一步净化名称
    // 移除国旗、多余的符号等
    cleanName = cleanName
        .replace(EMOJI_FLAG_REGEX, '')
        .replace(/[\[\]\(\)#]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    return {
        originalName: name,
        cleanName: cleanName || name, // 防止净化过度导致名称为空
        multiplier,
        region,
        flag: autoFlag,
        tags: Array.from(new Set(tags))
    };
}
