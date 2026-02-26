/**
 * 地理识别工具模块
 * 提供节点地区识别和相关功能
 */

/**
 * 地区关键词映射表
 * 支持多语言地区识别
 */
export const REGION_KEYWORDS = {
    '香港': ['HK', 'HKG', '香港', 'Hong Kong', 'HongKong'],
    '台湾': ['TW', 'TPE', '台湾', '台北', 'Taiwan', 'Taipei'],
    '新加坡': ['SG', 'SIN', '新加坡', 'Singapore'],
    '日本': ['JP', 'JPN', 'NRT', 'HND', 'KIX', 'FUK', '东京', '大阪', '日本', 'Japan', 'Tokyo', 'Osaka', 'Fukuoka', 'Yokohama'],
    '美国': ['US', 'USA', 'LAX', 'SFO', 'SEA', 'JFK', 'NYC', 'ORD', 'DFW', 'IAD', '美国', 'United States', 'America', 'Los Angeles', 'New York', 'San Francisco', 'Seattle', 'Chicago', '洛杉矶', '纽约', '旧金山', '西雅图', '芝加哥'],
    '韩国': ['KR', 'KOR', 'ICN', '韩国', '首尔', 'Korea', 'Seoul'],
    '英国': ['UK', 'GB', 'LHR', 'LGW', 'LON', '英国', 'Britain', 'London', 'Manchester', '伦敦', '曼彻斯特'],
    '德国': ['DE', 'DEU', 'FRA', 'MUC', '德国', 'Germany', 'Frankfurt', 'Berlin', 'Munich', '法兰克福', '柏林', '慕尼黑'],
    '法国': ['FR', 'CDG', 'ORY', '法国', 'France', 'Paris', 'Lyon', 'Marseille', '巴黎', '里昂', '马赛'],
    '加拿大': ['CA', 'CAN', 'YVR', 'YYZ', '加拿大', 'Canada', 'Toronto', 'Vancouver', 'Montreal', '多伦多', '温哥华', '蒙特利尔'],
    '澳大利亚': ['AU', 'AUS', 'SYD', 'MEL', 'BNE', 'PER', '澳大利亚', 'Australia', 'Sydney', 'Melbourne', 'Brisbane', 'Perth', '悉尼', '墨尔本', '布里斯班', '珀斯'],
    '荷兰': ['NL', 'NLD', 'AMS', '荷兰', 'Netherlands', 'Amsterdam', 'Rotterdam', '阿姆斯特丹', '鹿特丹'],
    '俄罗斯': ['RU', 'RUS', 'SVO', 'DME', '俄罗斯', 'Russia', 'Moscow', 'Saint Petersburg', '莫斯科', '圣彼得堡'],
    '印度': ['IN', 'IND', 'BOM', 'DEL', 'BLR', '印度', 'India', 'Mumbai', 'Delhi', 'Bangalore', '孟买', '德里', '班加罗尔'],
    '土耳其': ['TR', 'TUR', 'IST', '土耳其', 'Turkey', 'Istanbul', 'Ankara', '伊斯坦布尔', '安卡拉'],
    '孟加拉': ['BD', 'BGD', 'DAC', '孟加拉', '孟加拉国', 'Bangladesh', 'Dhaka', '达卡'],
    '巴基斯坦': ['PK', 'PAK', 'ISB', 'LHE', '巴基斯坦', 'Pakistan', 'Islamabad', 'Lahore', '伊斯兰堡', '拉合尔'],
    '马来西亚': ['MY', 'MYS', 'KUL', '马来西亚', 'Malaysia', 'Kuala Lumpur', '吉隆坡'],
    '泰国': ['TH', 'THA', 'BKK', '泰国', 'Thailand', 'Bangkok', 'Pattaya', '曼谷', '芭提雅'],
    '越南': ['VN', 'VNM', 'SGN', 'HAN', '越南', 'Vietnam', 'Ho Chi Minh City', 'Hanoi', '胡志明市', '河内'],
    '菲律宾': ['PH', 'PHL', 'MNL', 'CEB', '菲律宾', 'Philippines', 'Manila', 'Cebu', '马尼拉', '宿务'],
    '印尼': ['ID', 'IDN', 'CGK', '印尼', '印度尼西亚', 'Indonesia', 'Jakarta', 'Surabaya', 'Bandung', '雅加达', '泗水', '万隆'],
    '文莱': ['BN', 'BRN', 'BWN', '文莱', 'Brunei', 'Bandar Seri Begawan', '斯里巴加湾市'],
    '柬埔寨': ['KH', 'KHM', 'PNH', '柬埔寨', 'Cambodia', 'Phnom Penh', '金边'],
    '老挝': ['LA', 'LAO', 'VTE', '老挝', 'Laos', 'Vientiane', '万象'],
    '缅甸': ['MM', 'MMR', 'RGN', '缅甸', 'Myanmar', 'Burma', 'Yangon', 'Rangoon', '仰光'],
    '瑞士': ['CH', 'CHE', 'ZRH', 'GVA', '瑞士', 'Switzerland', 'Zurich', 'Geneva', '苏黎世', '日内瓦'],
    '意大利': ['IT', 'ITA', 'FCO', 'MXP', '意大利', 'Italy', 'Rome', 'Milan', 'Naples', '罗马', '米兰', '那不勒斯'],
    '西班牙': ['ES', 'ESP', 'MAD', 'BCN', '西班牙', 'Spain', 'Madrid', 'Barcelona', '马德里', '巴塞罗那'],
    '巴西': ['BR', 'BRA', 'GRU', 'GIG', '巴西', 'Brazil', 'São Paulo', 'Rio de Janeiro', '圣保罗', '里约'],
    '阿根廷': ['AR', 'ARG', 'EZE', '阿根廷', 'Argentina', 'Buenos Aires', '布宜诺斯艾利斯'],
    '墨西哥': ['MX', 'MEX', '墨西哥', 'Mexico', 'Mexico City', '墨西哥城'],
    '哥伦比亚': ['CO', 'COL', 'BOG', '哥伦比亚', 'Colombia', 'Bogota', 'Bogotá', '波哥大'],
    '秘鲁': ['PE', 'PER', 'LIM', '秘鲁', 'Peru', 'Lima', '利马'],
    '南非': ['ZA', 'ZAF', 'JNB', 'CPT', '南非', 'South Africa', 'Johannesburg', 'Cape Town', '约翰内斯堡', '开普敦'],
    '埃及': ['EG', 'EGY', 'CAI', '埃及', 'Egypt', 'Cairo', '开罗'],
    '以色列': ['IL', 'ISR', 'TLV', '以色列', 'Israel', 'Tel Aviv', 'Jerusalem', '特拉维夫', '耶路撒冷'],
    '阿联酋': ['AE', 'ARE', 'DXB', 'AUH', '阿联酋', 'UAE', 'Dubai', 'Abu Dhabi', 'Sharjah', '迪拜', '阿布扎比', '沙迦'],
    '阿曼': ['OM', 'OMN', 'MCT', '阿曼', 'Oman', 'Muscat', '马斯喀特'],
    '沙特': ['SA', 'SAU', 'RUH', 'JED', '沙特', 'Saudi Arabia', 'Riyadh', 'Jeddah', '利雅得', '吉达'],
    '波兰': ['PL', 'POL', 'WAW', '波兰', 'Poland', 'Warsaw', 'Krakow', '华沙', '克拉科夫'],
    '捷克': ['CZ', 'CZE', 'PRG', '捷克', 'Czech Republic', 'Prague', '布拉格'],
    '匈牙利': ['HU', 'HUN', 'BUD', '匈牙利', 'Hungary', 'Budapest', '布达佩斯'],
    '罗马尼亚': ['RO', 'ROU', 'OTP', '罗马尼亚', 'Romania', 'Bucharest', '布加勒斯特'],
    '保加利亚': ['BG', 'BGR', 'SOF', '保加利亚', 'Bulgaria', 'Sofia', '索非亚'],
    '希腊': ['GR', 'GRC', 'ATH', '希腊', 'Greece', 'Athens', 'Thessaloniki', '雅典', '塞萨洛尼基'],
    '葡萄牙': ['PT', 'PRT', 'LIS', '葡萄牙', 'Portugal', 'Lisbon', 'Porto', '里斯本', '波尔图'],
    '瑞典': ['SE', 'SWE', 'ARN', '瑞典', 'Sweden', 'Stockholm', 'Gothenburg', '斯德哥尔摩', '哥德堡'],
    '挪威': ['NO', 'NOR', 'OSL', '挪威', 'Norway', 'Oslo', 'Bergen', '奥斯陆', '卑尔根'],
    '丹麦': ['DK', 'DNK', 'CPH', '丹麦', 'Denmark', 'Copenhagen', 'Aarhus', '哥本哈根', '奥胡斯'],
    '芬兰': ['FI', 'FIN', 'HEL', '芬兰', 'Finland', 'Helsinki', '赫尔辛基'],
    '奥地利': ['AT', 'AUT', 'VIE', '奥地利', 'Austria', 'Vienna', 'Salzburg', '维也纳', '萨尔茨堡'],
    '爱尔兰': ['IE', 'IRL', 'DUB', '爱尔兰', 'Ireland', 'Dublin', '都柏林'],
    '冰岛': ['IS', 'ISL', 'KEF', '冰岛', 'Iceland', 'Reykjavik', '雷克雅未克'],
    '卢森堡': ['LU', 'LUX', '卢森堡', 'Luxembourg', 'Luxembourg City', '卢森堡市'],
    '马耳他': ['MT', 'MLT', 'MLA', '马耳他', 'Malta', 'Valletta', '瓦莱塔'],
    '斯洛伐克': ['SK', 'SVK', 'BTS', '斯洛伐克', 'Slovakia', 'Bratislava', '布拉迪斯拉发'],
    '斯洛文尼亚': ['SI', 'SVN', 'LJU', '斯洛文尼亚', 'Slovenia', 'Ljubljana', '卢布尔雅那'],
    '克罗地亚': ['HR', 'HRV', 'ZAG', '克罗地亚', 'Croatia', 'Zagreb', '萨格勒布'],
    '拉脱维亚': ['LV', 'LVA', 'RIX', '拉脱维亚', 'Latvia', 'Riga', '里加'],
    '立陶宛': ['LT', 'LTU', 'VNO', '立陶宛', 'Lithuania', 'Vilnius', '维尔纽斯'],
    '爱沙尼亚': ['EE', 'EST', 'TLL', '爱沙尼亚', 'Estonia', 'Tallinn', '塔林'],
    '塞浦路斯': ['CY', 'CYP', 'LCA', '塞浦路斯', 'Cyprus', 'Nicosia', '尼科西亚'],
    '列支敦士登': ['LI', 'LIE', '列支敦士登', 'Liechtenstein', 'Vaduz', '瓦杜兹'],
    '阿尔巴尼亚': ['AL', 'ALB', 'TIA', '阿尔巴尼亚', 'Albania', 'Tirana', '地拉那'],
    '安道尔': ['AD', 'AND', '安道尔', 'Andorra', 'Andorra la Vella', '安道尔城'],
    '白俄罗斯': ['BY', 'BLR', 'MSQ', '白俄罗斯', 'Belarus', 'Minsk', '明斯克'],
    '波黑': ['BA', 'BIH', 'SJJ', '波黑', '波斯尼亚', 'Bosnia', 'Bosnia and Herzegovina', 'Sarajevo', '萨拉热窝'],
    '摩尔多瓦': ['MD', 'MDA', 'KIV', '摩尔多瓦', 'Moldova', 'Chisinau', 'Chișinău', '基希讷乌'],
    '摩纳哥': ['MC', 'MCO', '摩纳哥', 'Monaco', 'Monte Carlo', '蒙特卡洛'],
    '黑山': ['ME', 'MNE', 'TGD', '黑山', 'Montenegro', 'Podgorica', '波德戈里察'],
    '北马其顿': ['MK', 'MKD', 'SKP', '北马其顿', 'North Macedonia', 'Macedonia', 'Skopje', '斯科普里'],
    '塞尔维亚': ['RS', 'SRB', 'BEG', '塞尔维亚', 'Serbia', 'Belgrade', '贝尔格莱德'],
    '乌克兰': ['UA', 'UKR', 'KBP', '乌克兰', 'Ukraine', 'Kyiv', 'Kiev', '基辅'],
    '科索沃': ['XK', 'XKS', 'PRN', '科索沃', 'Kosovo', 'Pristina', '普里什蒂纳'],
    '圣马力诺': ['SM', 'SMR', '圣马力诺', 'San Marino'],
    '梵蒂冈': ['VA', 'VAT', '梵蒂冈', 'Vatican', 'Vatican City', '梵蒂冈城'],
    '格鲁吉亚': ['GE', 'GEO', 'TBS', '格鲁吉亚', 'Georgia', 'Tbilisi', '第比利斯'],
    '亚美尼亚': ['AM', 'ARM', 'EVN', '亚美尼亚', 'Armenia', 'Yerevan', '埃里温'],
    '阿塞拜疆': ['AZ', 'AZE', 'GYD', '阿塞拜疆', 'Azerbaijan', 'Baku', '巴库'],
    '比利时': ['BE', 'BEL', 'BRU', '比利时', 'Belgium', 'Brussels', '安特卫普', '布鲁塞尔', 'Antwerp']
};

/**
 * [新增] 地区 Emoji 映射表
 */
export const REGION_EMOJI = {
    '香港': '🇭🇰',
    '台湾': '🇨🇳',
    '新加坡': '🇸🇬',
    '日本': '🇯🇵',
    '美国': '🇺🇸',
    '韩国': '🇰🇷',
    '英国': '🇬🇧',
    '德国': '🇩🇪',
    '法国': '🇫🇷',
    '加拿大': '🇨🇦',
    '澳大利亚': '🇦🇺',
    '荷兰': '🇳🇱',
    '俄罗斯': '🇷🇺',
    '印度': '🇮🇳',
    '土耳其': '🇹🇷',
    '孟加拉': '🇧🇩',
    '巴基斯坦': '🇵🇰',
    '马来西亚': '🇲🇾',
    '泰国': '🇹🇭',
    '越南': '🇻🇳',
    '菲律宾': '🇵🇭',
    '印尼': '🇮🇩',
    '文莱': '🇧🇳',
    '柬埔寨': '🇰🇭',
    '老挝': '🇱🇦',
    '缅甸': '🇲🇲',
    '瑞士': '🇨🇭',
    '意大利': '🇮🇹',
    '西班牙': '🇪🇸',
    '巴西': '🇧🇷',
    '阿根廷': '🇦🇷',
    '墨西哥': '🇲🇽',
    '哥伦比亚': '🇨🇴',
    '秘鲁': '🇵🇪',
    '南非': '🇿🇦',
    '埃及': '🇪🇬',
    '以色列': '🇮🇱',
    '阿联酋': '🇦🇪',
    '阿曼': '🇴🇲',
    '沙特': '🇸🇦',
    '波兰': '🇵🇱',
    '捷克': '🇨🇿',
    '匈牙利': '🇭🇺',
    '罗马尼亚': '🇷🇴',
    '希腊': '🇬🇷',
    '葡萄牙': '🇵🇹',
    '瑞典': '🇸🇪',
    '挪威': '🇳🇴',
    '丹麦': '🇩🇰',
    '芬兰': '🇫🇮',
    '奥地利': '🇦🇹',
    '爱尔兰': '🇮🇪',
    '冰岛': '🇮🇸',
    '卢森堡': '🇱🇺',
    '马耳他': '🇲🇹',
    '斯洛伐克': '🇸🇰',
    '斯洛文尼亚': '🇸🇮',
    '克罗地亚': '🇭🇷',
    '拉脱维亚': '🇱🇻',
    '立陶宛': '🇱🇹',
    '爱沙尼亚': '🇪🇪',
    '塞浦路斯': '🇨🇾',
    '列支敦士登': '🇱🇮',
    '阿尔巴尼亚': '🇦🇱',
    '安道尔': '🇦🇩',
    '白俄罗斯': '🇧🇾',
    '波黑': '🇧🇦',
    '摩尔多瓦': '🇲🇩',
    '摩纳哥': '🇲🇨',
    '黑山': '🇲🇪',
    '北马其顿': '🇲🇰',
    '塞尔维亚': '🇷🇸',
    '乌克兰': '🇺🇦',
    '科索沃': '🇽🇰',
    '圣马力诺': '🇸🇲',
    '梵蒂冈': '🇻🇦',
    '格鲁吉亚': '🇬🇪',
    '亚美尼亚': '🇦🇲',
    '阿塞拜疆': '🇦🇿',
    '比利时': '🇧🇪',
    '其他': '🌍'
};

function normalizeBase64(input) {
    let s = String(input || '').trim().replace(/\s+/g, '');
    if (!s) return '';
    if (s.includes('%')) {
        try {
            s = decodeURIComponent(s);
        } catch {
            // keep raw when decode fails
        }
    }
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return s;
}

function isLikelyBase64(input) {
    const s = String(input || '').trim();
    if (!s) return false;
    if (!/^[A-Za-z0-9+/=_-]+$/.test(s)) return false;
    return s.length >= 6;
}

function tryDecodeBase64(input) {
    if (!isLikelyBase64(input)) return null;
    try {
        return atob(normalizeBase64(input));
    } catch {
        return null;
    }
}

function parseHostPort(value) {
    let segment = String(value || '');
    if (!segment) return { server: '', port: '' };
    const cut = segment.search(/[/?#]/);
    if (cut !== -1) segment = segment.slice(0, cut);

    if (segment.startsWith('[')) {
        const closeBracket = segment.indexOf(']');
        if (closeBracket !== -1) {
            const server = segment.slice(1, closeBracket);
            const after = segment.slice(closeBracket + 1);
            const port = after.startsWith(':') ? after.slice(1).split('/')[0] : '';
            return { server, port };
        }
    }

    const parts = segment.split(':');
    if (parts.length >= 2) {
        return { server: parts[0], port: parts[1].split('/')[0] };
    }
    return { server: segment, port: '' };
}

/**
 * 从节点名称中识别地区
 * @param {string} nodeName - 节点名称
 * @returns {string} 识别出的地区，如未识别返回"其他"
 */
export function extractNodeRegion(nodeName) {
    if (!nodeName || typeof nodeName !== 'string') {
        return '其他';
    }

    const normalizedNodeName = nodeName.toLowerCase();

    // 遍历所有地区关键词
    for (const [regionName, keywords] of Object.entries(REGION_KEYWORDS)) {
        for (const keyword of keywords) {
            const lowerKeyword = keyword.toLowerCase();

            // 对于短关键词（2-3个字符的纯英文），要求匹配独立单词边界
            // 避免 "kristi" 匹配 "kr"，"user" 匹配 "us" 等误匹配
            if (lowerKeyword.length <= 3 && /^[a-z]+$/i.test(lowerKeyword)) {
                // 使用更兼容的方式检查单词边界（不使用 lookbehind）
                const idx = normalizedNodeName.indexOf(lowerKeyword);
                if (idx !== -1) {
                    // 检查前一个字符
                    const charBefore = idx > 0 ? normalizedNodeName[idx - 1] : '';
                    const isLetterBefore = charBefore && /[a-z]/i.test(charBefore);

                    // 检查后一个字符
                    const charAfter = normalizedNodeName[idx + lowerKeyword.length] || '';
                    const isLetterAfter = charAfter && /[a-z]/i.test(charAfter);

                    // 只有当前后都不是字母时才匹配
                    if (!isLetterBefore && !isLetterAfter) {
                        return regionName;
                    }
                }
            } else {
                // 对于长关键词或中文，直接使用 includes
                if (normalizedNodeName.includes(lowerKeyword)) {
                    return regionName;
                }
            }
        }
    }

    return '其他';
}

/**
 * 获取所有支持的地区列表
 * @returns {string[]} 支持的地区名称数组
 */
export function getSupportedRegions() {
    return Object.keys(REGION_KEYWORDS);
}

/**
 * 获取指定地区的所有关键词
 * @param {string} region - 地区名称
 * @returns {string[]} 该地区的所有关键词，如地区不存在返回空数组
 */
export function getRegionKeywords(region) {
    return REGION_KEYWORDS[region] || [];
}

/**
 * [新增] 获取地区 Emoji
 * @param {string} region - 地区名称
 * @returns {string} 对应的 Emoji，如果未找到则返回空字符串
 */
export function getRegionEmoji(region) {
    return REGION_EMOJI[region] || '';
}

/**
 * 检查节点名称是否包含指定地区
 * @param {string} nodeName - 节点名称
 * @param {string} region - 要检查的地区
 * @returns {boolean} 是否包含该地区
 */
export function containsRegion(nodeName, region) {
    if (!nodeName || !region || !REGION_KEYWORDS[region]) {
        return false;
    }

    const normalizedNodeName = nodeName.toLowerCase();
    const keywords = REGION_KEYWORDS[region];

    for (const keyword of keywords) {
        if (normalizedNodeName.includes(keyword.toLowerCase())) {
            return true;
        }
    }

    return false;
}

/**
 * 获取节点的详细信息（协议、名称、地区等）
 * @param {string} nodeUrl - 节点URL
 * @returns {Object} 节点详细信息
 */
export function parseNodeInfo(nodeUrl) {
    if (!nodeUrl || typeof nodeUrl !== 'string') {
        return {
            protocol: 'unknown',
            name: '未命名节点',
            region: '其他',
            url: nodeUrl
        };
    }

    // 提取协议
    const protocolMatch = nodeUrl.match(/^(.*?):\/\//);
    const protocol = protocolMatch ? protocolMatch[1].toLowerCase() : 'unknown';

    // 提取节点名称
    let nodeName = '';
    const hashIndex = nodeUrl.lastIndexOf('#');
    if (hashIndex !== -1) {
        try {
            nodeName = decodeURIComponent(nodeUrl.substring(hashIndex + 1));
        } catch (e) {
            nodeName = nodeUrl.substring(hashIndex + 1);
        }
    }

    // [增强] 如果 Hash 中没有名称，尝试从 URL 参数中提取 (支持 remarks, des, remark)
    if (!nodeName) {
        const paramsMatch = nodeUrl.match(/[?&](remarks|des|remark)=([^&#]+)/);
        if (paramsMatch && paramsMatch[2]) {
            try {
                nodeName = decodeURIComponent(paramsMatch[2]);
            } catch (e) {
                nodeName = paramsMatch[2];
            }
        }
    }

    // 如果没有名称，从URL生成一个
    if (!nodeName) {
        // 从URL中提取一些信息作为名称
        const urlWithoutProtocol = nodeUrl.replace(/^[^:]*:\/\//, '');
        const urlParts = urlWithoutProtocol.split(/[:@?#]/);
        nodeName = urlParts[0] || '未命名节点';
    }

    // [修复] 将台湾旗帜替换为中国国旗
    nodeName = nodeName.replace(/🇹🇼/g, '🇨🇳');

    // [新增] 提取服务器地址和端口
    let server = '';
    let port = '';

    try {
        if (protocol === 'vmess') {
            const base64Part = nodeUrl.replace('vmess://', '');
            if (base64Part && !base64Part.includes('@')) { // 排除可能是明文的情况(虽然vmess少见)
                try {
                    // 处理 URL-safe Base64 字符
                    let safeBody = base64Part.replace(/-/g, '+').replace(/_/g, '/');
                    // 补全 Padding
                    while (safeBody.length % 4) {
                        safeBody += '=';
                    }
                    const jsonStr = atob(safeBody); // 使用 decodeURIComponent(escape(atob(safeBody))) 处理中文? 
                    // 不, atob 解码后通常是 UTF-8 字节流乱码 if directly used as string for Chinese
                    // 需要用 TextDecoder
                    const binaryString = atob(safeBody);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    const decodedStr = new TextDecoder('utf-8').decode(bytes);

                    const config = JSON.parse(decodedStr);
                    server = config.add || config.host || '';
                    port = config.port || '';
                    // [Fix] 提取名称
                    if (config.ps) {
                        nodeName = config.ps;
                    }
                } catch (e) {
                    console.debug('[GeoUtils] VMess base64 decode failed:', e);
                }
            }
        } else if (protocol === 'ss') {
            // ss://base64(user:pass@host:port)#name
            // 或者 ss://base64(user:pass)@host:port#name
            let body = nodeUrl.substring(5); // remove ss://
            const hIndex = body.indexOf('#');
            if (hIndex !== -1) body = body.substring(0, hIndex);
            const qIndex = body.indexOf('?');
            if (qIndex !== -1) body = body.substring(0, qIndex);

            const atLast = body.lastIndexOf('@');
            let serverPart = '';
            if (atLast !== -1) {
                // 明文或 SIP002 (base64 userinfo)
                serverPart = body.substring(atLast + 1);
            } else {
                const decoded = tryDecodeBase64(body);
                if (decoded && decoded.includes('@')) {
                    serverPart = decoded.substring(decoded.lastIndexOf('@') + 1);
                } else {
                    serverPart = body;
                }
            }

            const parsed = parseHostPort(serverPart);
            server = parsed.server;
            port = parsed.port;
        } else if (protocol === 'ssr') {
            // SSR 格式: ssr://base64(server:port:protocol:method:obfs:base64(password)/?params)
            // params 中包含 remarks=base64(name), obfsparam=..., protoparam=...
            try {
                let payload = nodeUrl.substring(6); // 去掉 ssr://
                // 去掉可能存在的 # fragment
                const hIdx = payload.indexOf('#');
                if (hIdx !== -1) payload = payload.substring(0, hIdx);
                // 去掉外层查询参数（不常见但防御性处理）
                const qIdx = payload.indexOf('?');
                if (qIdx !== -1) payload = payload.substring(0, qIdx);

                const decoded = tryDecodeBase64(payload);
                if (decoded) {
                    // 解析 server:port:protocol:method:obfs:password_base64/?params
                    // server 可能是 IPv6 [::1]
                    let ssrServer = '', ssrPort = '';
                    if (decoded.startsWith('[')) {
                        // IPv6 格式: [ipv6]:port:...
                        const closeBracket = decoded.indexOf(']');
                        if (closeBracket !== -1) {
                            ssrServer = decoded.substring(1, closeBracket);
                            const afterBracket = decoded.substring(closeBracket + 1);
                            const portMatch = afterBracket.match(/^:(\d+):/);
                            if (portMatch) ssrPort = portMatch[1];
                        }
                    } else {
                        // IPv4/domain 格式: host:port:...
                        const colonParts = decoded.split(':');
                        if (colonParts.length >= 2) {
                            ssrServer = colonParts[0];
                            ssrPort = colonParts[1];
                        }
                    }
                    server = ssrServer;
                    port = ssrPort;

                    // 提取 remarks 名称（SSR 名称在 Base64 编码的 remarks 参数中）
                    const slashQ = decoded.indexOf('/?');
                    const paramStart = slashQ !== -1 ? slashQ + 2 : (decoded.indexOf('?') !== -1 ? decoded.indexOf('?') + 1 : -1);
                    if (paramStart !== -1) {
                        const paramStr = decoded.substring(paramStart);
                        const remarksMatch = paramStr.match(/(?:^|&)remarks=([^&]*)/);
                        if (remarksMatch && remarksMatch[1]) {
                            const remarksB64 = remarksMatch[1].replace(/\s+/g, '');
                            // remarks 通常包含中文，需要 UTF-8 安全解码
                            try {
                                const normalized = normalizeBase64(remarksB64);
                                const binaryString = atob(normalized);
                                const bytes = new Uint8Array(binaryString.length);
                                for (let i = 0; i < binaryString.length; i++) {
                                    bytes[i] = binaryString.charCodeAt(i);
                                }
                                const remarksDecoded = new TextDecoder('utf-8').decode(bytes);
                                if (remarksDecoded) {
                                    nodeName = remarksDecoded.trim();
                                }
                            } catch (e) {
                                // Base64 解码失败，尝试使用原始值
                                const fallback = tryDecodeBase64(remarksB64);
                                if (fallback) nodeName = fallback.trim();
                            }
                        }
                    }
                }
            } catch (e) {
                console.debug('[GeoUtils] SSR decode failed:', e);
            }
        } else {
            // 通用格式: protocol://user@host:port... 或 protocol://host:port...
            // vless, trojan, hysteria2, socks5, http 等
            // 去掉 protocol://
            let body = nodeUrl.substring(nodeUrl.indexOf('://') + 3);
            const hIndex = body.indexOf('#');
            if (hIndex !== -1) body = body.substring(0, hIndex);

            const qIndex = body.indexOf('?');
            if (qIndex !== -1) body = body.substring(0, qIndex);

            const atIndex = body.lastIndexOf('@');
            let serverPart = (atIndex !== -1) ? body.substring(atIndex + 1) : body;

            // [新增] 检测 Base64 编码的用户信息（某些非标准 VLESS URL）
            // 格式：vless://Base64(auto:uuid@host:port)?params
            if (atIndex === -1 && protocol === 'vless' && body.length > 20) {
                try {
                    // 尝试 Base64 解码
                    let b64 = body.replace(/-/g, '+').replace(/_/g, '/');
                    while (b64.length % 4) b64 += '=';
                    const binaryString = atob(b64);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    const decoded = new TextDecoder('utf-8').decode(bytes);
                    // 检查解码结果是否包含 @ 符号（形如 auto:uuid@host:port）
                    if (decoded.includes('@')) {
                        const decodedAtIndex = decoded.lastIndexOf('@');
                        serverPart = decoded.substring(decodedAtIndex + 1);
                    }
                } catch (e) {
                    // Base64 解码失败，继续使用原逻辑
                    console.debug('[GeoUtils] VLESS base64 decode attempt failed (expected for standard format)');
                }
            }

            // 处理 IPv6 [::1]:port
            if (serverPart.startsWith('[')) {
                const closeBracket = serverPart.indexOf(']');
                if (closeBracket !== -1) {
                    server = serverPart.substring(1, closeBracket);
                    const afterBracket = serverPart.substring(closeBracket + 1);
                    if (afterBracket.startsWith(':')) {
                        port = afterBracket.substring(1).split('/')[0];
                    }
                }
            } else {
                const parts = serverPart.split(':');
                if (parts.length >= 2) {
                    server = parts[0];
                    port = parts[1].split('/')[0];
                }
            }
        }
    } catch (e) {
        console.error('Error extracting server/port:', e);
    }

    // 识别地区
    const region = extractNodeRegion(nodeName);

    return {
        protocol,
        name: nodeName,
        region,
        server,
        port,
        url: nodeUrl
    };
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
