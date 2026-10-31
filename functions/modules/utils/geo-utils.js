/**
 * 地理识别工具模块
 * 提供节点地区识别和相关功能
 */

/**
 * 地区关键词映射表
 * 支持多语言地区识别
 */
export const REGION_KEYWORDS = {
    香港: ['HK', 'HKG', 'HKT', '香港', 'Hong Kong', 'HongKong'],
    台湾: ['TW', 'TPE', '台湾', '台北', 'Taiwan', 'Taipei'],
    新加坡: ['SG', 'SIN', '新加坡', 'Singapore'],
    日本: [
        'JP',
        'JPN',
        'NRT',
        'HND',
        'KIX',
        'FUK',
        '东京',
        '大阪',
        '日本',
        'Japan',
        'Tokyo',
        'Osaka',
        'Fukuoka',
        'Yokohama',
    ],
    美国: [
        'US',
        'USA',
        'LAX',
        'SFO',
        'SEA',
        'JFK',
        'NYC',
        'ORD',
        'DFW',
        'IAD',
        '美国',
        'United States',
        'America',
        'Los Angeles',
        'New York',
        'San Francisco',
        'Seattle',
        'Chicago',
        '洛杉矶',
        '纽约',
        '旧金山',
        '西雅图',
        '芝加哥',
    ],
    朝鲜: ['KP', 'PRK', '朝鲜', '北朝鲜', '平壤', 'North Korea', 'DPRK', 'Pyongyang'],
    韩国: ['KR', 'KOR', 'ICN', '韩国', '首尔', 'Korea', 'Seoul'],
    英国: [
        'UK',
        'GB',
        'LHR',
        'LGW',
        'LON',
        '英国',
        'Britain',
        'London',
        'Manchester',
        '伦敦',
        '曼彻斯特',
    ],
    德国: [
        'DE',
        'DEU',
        'FRA',
        'MUC',
        '德国',
        'Germany',
        'Frankfurt',
        'Berlin',
        'Munich',
        '法兰克福',
        '柏林',
        '慕尼黑',
    ],
    法国: [
        'FR',
        'CDG',
        'ORY',
        '法国',
        'France',
        'Paris',
        'Lyon',
        'Marseille',
        '巴黎',
        '里昂',
        '马赛',
    ],
    加拿大: [
        'CA',
        'CAN',
        'YVR',
        'YYZ',
        '加拿大',
        'Canada',
        'Toronto',
        'Vancouver',
        'Montreal',
        '多伦多',
        '温哥华',
        '蒙特利尔',
    ],
    澳大利亚: [
        'AU',
        'AUS',
        'SYD',
        'MEL',
        'BNE',
        'PER',
        '澳大利亚',
        'Australia',
        'Sydney',
        'Melbourne',
        'Brisbane',
        'Perth',
        '悉尼',
        '墨尔本',
        '布里斯班',
        '珀斯',
    ],
    荷兰: [
        'NL',
        'NLD',
        'AMS',
        '荷兰',
        'Netherlands',
        'Amsterdam',
        'Rotterdam',
        '阿姆斯特丹',
        '鹿特丹',
    ],
    俄罗斯: [
        'RU',
        'RUS',
        'SVO',
        'DME',
        '俄罗斯',
        'Russia',
        'Moscow',
        'Saint Petersburg',
        '莫斯科',
        '圣彼得堡',
    ],
    印度: [
        'IN',
        'IND',
        'BOM',
        'DEL',
        'BLR',
        '印度',
        'India',
        'Mumbai',
        'Delhi',
        'Bangalore',
        '孟买',
        '德里',
        '班加罗尔',
    ],
    土耳其: ['TR', 'TUR', 'IST', '土耳其', 'Turkey', 'Istanbul', 'Ankara', '伊斯坦布尔', '安卡拉'],
    孟加拉: ['BD', 'BGD', 'DAC', '孟加拉', '孟加拉国', 'Bangladesh', 'Dhaka', '达卡'],
    巴基斯坦: [
        'PK',
        'PAK',
        'ISB',
        'LHE',
        '巴基斯坦',
        'Pakistan',
        'Islamabad',
        'Lahore',
        '伊斯兰堡',
        '拉合尔',
    ],
    马来西亚: ['MY', 'MYS', 'KUL', '马来西亚', 'Malaysia', 'Kuala Lumpur', '吉隆坡'],
    泰国: ['TH', 'THA', 'BKK', '泰国', 'Thailand', 'Bangkok', 'Pattaya', '曼谷', '芭提雅'],
    越南: [
        'VN',
        'VNM',
        'SGN',
        'HAN',
        '越南',
        'Vietnam',
        'Ho Chi Minh City',
        'Hanoi',
        '胡志明市',
        '河内',
    ],
    菲律宾: [
        'PH',
        'PHL',
        'MNL',
        'CEB',
        '菲律宾',
        'Philippines',
        'Manila',
        'Cebu',
        '马尼拉',
        '宿务',
    ],
    印尼: [
        'ID',
        'IDN',
        'CGK',
        '印尼',
        '印度尼西亚',
        'Indonesia',
        'Jakarta',
        'Surabaya',
        'Bandung',
        '雅加达',
        '泗水',
        '万隆',
    ],
    文莱: ['BN', 'BRN', 'BWN', '文莱', 'Brunei', 'Bandar Seri Begawan', '斯里巴加湾市'],
    柬埔寨: ['KH', 'KHM', 'PNH', '柬埔寨', 'Cambodia', 'Phnom Penh', '金边'],
    老挝: ['LA', 'LAO', 'VTE', '老挝', 'Laos', 'Vientiane', '万象'],
    缅甸: ['MM', 'MMR', 'RGN', '缅甸', 'Myanmar', 'Burma', 'Yangon', 'Rangoon', '仰光'],
    瑞士: [
        'CH',
        'CHE',
        'ZRH',
        'GVA',
        '瑞士',
        'Switzerland',
        'Zurich',
        'Geneva',
        '苏黎世',
        '日内瓦',
    ],
    意大利: [
        'IT',
        'ITA',
        'FCO',
        'MXP',
        '意大利',
        'Italy',
        'Rome',
        'Milan',
        'Naples',
        '罗马',
        '米兰',
        '那不勒斯',
    ],
    西班牙: [
        'ES',
        'ESP',
        'MAD',
        'BCN',
        '西班牙',
        'Spain',
        'Madrid',
        'Barcelona',
        '马德里',
        '巴塞罗那',
    ],
    巴西: [
        'BR',
        'BRA',
        'GRU',
        'GIG',
        '巴西',
        'Brazil',
        'São Paulo',
        'Rio de Janeiro',
        '圣保罗',
        '里约',
    ],
    阿根廷: ['AR', 'ARG', 'EZE', '阿根廷', 'Argentina', 'Buenos Aires', '布宜诺斯艾利斯'],
    墨西哥: ['MX', 'MEX', '墨西哥', 'Mexico', 'Mexico City', '墨西哥城'],
    哥伦比亚: ['CO', 'COL', 'BOG', '哥伦比亚', 'Colombia', 'Bogota', 'Bogotá', '波哥大'],
    秘鲁: ['PE', 'PER', 'LIM', '秘鲁', 'Peru', 'Lima', '利马'],
    南非: [
        'ZA',
        'ZAF',
        'JNB',
        'CPT',
        '南非',
        'South Africa',
        'Johannesburg',
        'Cape Town',
        '约翰内斯堡',
        '开普敦',
    ],
    埃及: ['EG', 'EGY', 'CAI', '埃及', 'Egypt', 'Cairo', '开罗'],
    以色列: [
        'IL',
        'ISR',
        'TLV',
        '以色列',
        'Israel',
        'Tel Aviv',
        'Jerusalem',
        '特拉维夫',
        '耶路撒冷',
    ],
    阿联酋: [
        'AE',
        'ARE',
        'DXB',
        'AUH',
        '阿联酋',
        'UAE',
        'Dubai',
        'Abu Dhabi',
        'Sharjah',
        '迪拜',
        '阿布扎比',
        '沙迦',
    ],
    阿曼: ['OM', 'OMN', 'MCT', '阿曼', 'Oman', 'Muscat', '马斯喀特'],
    沙特: ['SA', 'SAU', 'RUH', 'JED', '沙特', 'Saudi Arabia', 'Riyadh', 'Jeddah', '利雅得', '吉达'],
    波兰: ['PL', 'POL', 'WAW', '波兰', 'Poland', 'Warsaw', 'Krakow', '华沙', '克拉科夫'],
    捷克: ['CZ', 'CZE', 'PRG', '捷克', 'Czech Republic', 'Prague', '布拉格'],
    匈牙利: ['HU', 'HUN', 'BUD', '匈牙利', 'Hungary', 'Budapest', '布达佩斯'],
    罗马尼亚: ['RO', 'ROU', 'OTP', '罗马尼亚', 'Romania', 'Bucharest', '布加勒斯特'],
    保加利亚: ['BG', 'BGR', 'SOF', '保加利亚', 'Bulgaria', 'Sofia', '索非亚'],
    希腊: ['GR', 'GRC', 'ATH', '希腊', 'Greece', 'Athens', 'Thessaloniki', '雅典', '塞萨洛尼基'],
    葡萄牙: ['PT', 'PRT', 'LIS', '葡萄牙', 'Portugal', 'Lisbon', 'Porto', '里斯本', '波尔图'],
    瑞典: ['SE', 'SWE', 'ARN', '瑞典', 'Sweden', 'Stockholm', 'Gothenburg', '斯德哥尔摩', '哥德堡'],
    挪威: ['NO', 'NOR', 'OSL', '挪威', 'Norway', 'Oslo', 'Bergen', '奥斯陆', '卑尔根'],
    丹麦: ['DK', 'DNK', 'CPH', '丹麦', 'Denmark', 'Copenhagen', 'Aarhus', '哥本哈根', '奥胡斯'],
    芬兰: ['FI', 'FIN', 'HEL', '芬兰', 'Finland', 'Helsinki', '赫尔辛基'],
    奥地利: ['AT', 'AUT', 'VIE', '奥地利', 'Austria', 'Vienna', 'Salzburg', '维也纳', '萨尔茨堡'],
    爱尔兰: ['IE', 'IRL', 'DUB', '爱尔兰', 'Ireland', 'Dublin', '都柏林'],
    冰岛: ['IS', 'ISL', 'KEF', '冰岛', 'Iceland', 'Reykjavik', '雷克雅未克'],
    卢森堡: ['LU', 'LUX', '卢森堡', 'Luxembourg', 'Luxembourg City', '卢森堡市'],
    马耳他: ['MT', 'MLT', 'MLA', '马耳他', 'Malta', 'Valletta', '瓦莱塔'],
    斯洛伐克: ['SK', 'SVK', 'BTS', '斯洛伐克', 'Slovakia', 'Bratislava', '布拉迪斯拉发'],
    斯洛文尼亚: ['SI', 'SVN', 'LJU', '斯洛文尼亚', 'Slovenia', 'Ljubljana', '卢布尔雅那'],
    克罗地亚: ['HR', 'HRV', 'ZAG', '克罗地亚', 'Croatia', 'Zagreb', '萨格勒布'],
    拉脱维亚: ['LV', 'LVA', 'RIX', '拉脱维亚', 'Latvia', 'Riga', '里加'],
    立陶宛: ['LT', 'LTU', 'VNO', '立陶宛', 'Lithuania', 'Vilnius', '维尔纽斯'],
    爱沙尼亚: ['EE', 'EST', 'TLL', '爱沙尼亚', 'Estonia', 'Tallinn', '塔林'],
    塞浦路斯: ['CY', 'CYP', 'LCA', '塞浦路斯', 'Cyprus', 'Nicosia', '尼科西亚'],
    列支敦士登: ['LI', 'LIE', '列支敦士登', 'Liechtenstein', 'Vaduz', '瓦杜兹'],
    阿尔巴尼亚: ['AL', 'ALB', 'TIA', '阿尔巴尼亚', 'Albania', 'Tirana', '地拉那'],
    安道尔: ['AD', 'AND', '安道尔', 'Andorra', 'Andorra la Vella', '安道尔城'],
    白俄罗斯: ['BY', 'BLR', 'MSQ', '白俄罗斯', 'Belarus', 'Minsk', '明斯克'],
    波黑: [
        'BA',
        'BIH',
        'SJJ',
        '波黑',
        '波斯尼亚',
        'Bosnia',
        'Bosnia and Herzegovina',
        'Sarajevo',
        '萨拉热窝',
    ],
    摩尔多瓦: ['MD', 'MDA', 'KIV', '摩尔多瓦', 'Moldova', 'Chisinau', 'Chișinău', '基希讷乌'],
    摩纳哥: ['MC', 'MCO', '摩纳哥', 'Monaco', 'Monte Carlo', '蒙特卡洛'],
    黑山: ['ME', 'MNE', 'TGD', '黑山', 'Montenegro', 'Podgorica', '波德戈里察'],
    北马其顿: [
        'MK',
        'MKD',
        'SKP',
        '北马其顿',
        'North Macedonia',
        'Macedonia',
        'Skopje',
        '斯科普里',
    ],
    塞尔维亚: ['RS', 'SRB', 'BEG', '塞尔维亚', 'Serbia', 'Belgrade', '贝尔格莱德'],
    乌克兰: ['UA', 'UKR', 'KBP', '乌克兰', 'Ukraine', 'Kyiv', 'Kiev', '基辅'],
    科索沃: ['XK', 'XKS', 'PRN', '科索沃', 'Kosovo', 'Pristina', '普里什蒂纳'],
    圣马力诺: ['SM', 'SMR', '圣马力诺', 'San Marino'],
    梵蒂冈: ['VA', 'VAT', '梵蒂冈', 'Vatican', 'Vatican City', '梵蒂冈城'],
    格鲁吉亚: ['GE', 'GEO', 'TBS', '格鲁吉亚', 'Georgia', 'Tbilisi', '第比利斯'],
    亚美尼亚: ['AM', 'ARM', 'EVN', '亚美尼亚', 'Armenia', 'Yerevan', '埃里温'],
    阿塞拜疆: ['AZ', 'AZE', 'GYD', '阿塞拜疆', 'Azerbaijan', 'Baku', '巴库'],
    比利时: [
        'BE',
        'BEL',
        'BRU',
        '比利时',
        'Belgium',
        'Brussels',
        '安特卫普',
        '布鲁塞尔',
        'Antwerp',
    ],
    "南乔治亚和南桑威奇群岛": ["南乔治亚和南桑威奇群岛", "South Georgia & South Sandwich Islands"],
    "赫德岛和麦克唐纳群岛": ["赫德岛和麦克唐纳群岛", "Heard & McDonald Islands"],
    "圣皮埃尔和密克隆群岛": ["圣皮埃尔和密克隆群岛", "St. Pierre & Miquelon"],
    "圣文森特和格林纳丁斯": ["圣文森特和格林纳丁斯", "St. Vincent & Grenadines"],
    "科科斯（基林）群岛": ["科科斯（基林）群岛", "Cocos (Keeling) Islands"],
    "特克斯和凯科斯群岛": ["特克斯和凯科斯群岛", "Turks & Caicos Islands"],
    "美国本土外小岛屿": ["美国本土外小岛屿", "U.S. Outlying Islands"],
    "圣多美和普林西比": ["圣多美和普林西比", "São Tomé & Príncipe"],
    "斯瓦尔巴和扬马延": ["斯瓦尔巴和扬马延", "Svalbard & Jan Mayen"],
    "特立尼达和多巴哥": ["特立尼达和多巴哥", "Trinidad & Tobago"],
    "安提瓜和巴布达": ["安提瓜和巴布达", "Antigua & Barbuda"],
    "巴布亚新几内亚": ["巴布亚新几内亚", "Papua New Guinea"],
    "北马里亚纳群岛": ["北马里亚纳群岛", "Northern Mariana Islands"],
    "法属波利尼西亚": ["法属波利尼西亚", "French Polynesia"],
    "美属维尔京群岛": ["美属维尔京群岛", "U.S. Virgin Islands"],
    "圣基茨和尼维斯": ["圣基茨和尼维斯", "St. Kitts & Nevis"],
    "瓦利斯和富图纳": ["瓦利斯和富图纳", "Wallis & Futuna"],
    "英属维尔京群岛": ["英属维尔京群岛", "British Virgin Islands"],
    "英属印度洋领地": ["英属印度洋领地", "British Indian Ocean Territory"],
    "法属南部领地": ["法属南部领地", "French Southern Territories"],
    "荷属加勒比区": ["荷属加勒比区", "Caribbean Netherlands"],
    "吉尔吉斯斯坦": ["吉尔吉斯斯坦", "Kyrgyzstan"],
    "密克罗尼西亚": ["密克罗尼西亚", "Micronesia"],
    "皮特凯恩群岛": ["皮特凯恩群岛", "Pitcairn Islands"],
    "乌兹别克斯坦": ["乌兹别克斯坦", "Uzbekistan"],
    "新喀里多尼亚": ["新喀里多尼亚", "New Caledonia"],
    "阿尔及利亚": ["阿尔及利亚", "Algeria"],
    "埃塞俄比亚": ["埃塞俄比亚", "Ethiopia"],
    "布基纳法索": ["布基纳法索", "Burkina Faso"],
    "赤道几内亚": ["赤道几内亚", "Equatorial Guinea"],
    "厄立特里亚": ["厄立特里亚", "Eritrea"],
    "法属圭亚那": ["法属圭亚那", "French Guiana"],
    "法属圣马丁": ["法属圣马丁", "St. Martin"],
    "福克兰群岛": ["福克兰群岛", "Falkland Islands"],
    "刚果（布）": ["刚果（布）", "Congo-Brazzaville", "刚果布", "Brazzaville"],
    "刚果（金）": ["刚果（金）", "DR Congo", "刚果金", "Congo-Kinshasa", "Kinshasa"],
    "哥斯达黎加": ["哥斯达黎加", "Costa Rica"],
    "哈萨克斯坦": ["哈萨克斯坦", "Kazakhstan"],
    "荷属圣马丁": ["荷属圣马丁", "Sint Maarten"],
    "几内亚比绍": ["几内亚比绍", "Guinea-Bissau"],
    "马达加斯加": ["马达加斯加", "Madagascar"],
    "马绍尔群岛": ["马绍尔群岛", "Marshall Islands"],
    "毛里塔尼亚": ["毛里塔尼亚", "Mauritania"],
    "美属萨摩亚": ["美属萨摩亚", "American Samoa"],
    "蒙特塞拉特": ["蒙特塞拉特", "Montserrat"],
    "圣巴泰勒米": ["圣巴泰勒米", "St. Barthélemy"],
    "所罗门群岛": ["所罗门群岛", "Solomon Islands"],
    "塔吉克斯坦": ["塔吉克斯坦", "Tajikistan"],
    "土库曼斯坦": ["土库曼斯坦", "Turkmenistan"],
    "中非共和国": ["中非共和国", "Central African Republic"],
    "奥兰群岛": ["奥兰群岛", "Åland Islands"],
    "巴巴多斯": ["巴巴多斯", "Barbados"],
    "巴勒斯坦": ["巴勒斯坦", "Palestine", "巴勒斯坦领土"],
    "波多黎各": ["波多黎各", "Puerto Rico"],
    "玻利维亚": ["玻利维亚", "Bolivia"],
    "博茨瓦纳": ["博茨瓦纳", "Botswana"],
    "多米尼加": ["多米尼加", "Dominican Republic", "Dominican", "多米尼加共和国"],
    "多米尼克": ["多米尼克", "Dominica"],
    "厄瓜多尔": ["厄瓜多尔", "Ecuador"],
    "法罗群岛": ["法罗群岛", "Faroe Islands"],
    "格林纳达": ["格林纳达", "Grenada"],
    "瓜德罗普": ["瓜德罗普", "Guadeloupe"],
    "洪都拉斯": ["洪都拉斯", "Honduras"],
    "基里巴斯": ["基里巴斯", "Kiribati"],
    "津巴布韦": ["津巴布韦", "Zimbabwe"],
    "开曼群岛": ["开曼群岛", "Cayman Islands"],
    "科特迪瓦": ["科特迪瓦", "Cote d'Ivoire", "Ivory Coast"],
    "库克群岛": ["库克群岛", "Cook Islands"],
    "利比里亚": ["利比里亚", "Liberia"],
    "马尔代夫": ["马尔代夫", "Maldives"],
    "马提尼克": ["马提尼克", "Martinique"],
    "毛里求斯": ["毛里求斯", "Mauritius"],
    "莫桑比克": ["莫桑比克", "Mozambique"],
    "纳米比亚": ["纳米比亚", "Namibia"],
    "尼加拉瓜": ["尼加拉瓜", "Nicaragua"],
    "尼日利亚": ["尼日利亚", "Nigeria"],
    "诺福克岛": ["诺福克岛", "Norfolk Island"],
    "萨尔瓦多": ["萨尔瓦多", "El Salvador"],
    "塞拉利昂": ["塞拉利昂", "Sierra Leone"],
    "塞内加尔": ["塞内加尔", "Senegal"],
    "圣赫勒拿": ["圣赫勒拿", "St. Helena"],
    "圣卢西亚": ["圣卢西亚", "St. Lucia"],
    "斯里兰卡": ["斯里兰卡", "Sri Lanka"],
    "斯威士兰": ["斯威士兰", "Eswatini"],
    "坦桑尼亚": ["坦桑尼亚", "Tanzania"],
    "瓦努阿图": ["瓦努阿图", "Vanuatu"],
    "危地马拉": ["危地马拉", "Guatemala"],
    "委内瑞拉": ["委内瑞拉", "Venezuela"],
    "西撒哈拉": ["西撒哈拉", "Western Sahara"],
    "直布罗陀": ["直布罗陀", "Gibraltar"],
    "阿富汗": ["阿富汗", "Afghanistan"],
    "阿鲁巴": ["阿鲁巴", "Aruba"],
    "安哥拉": ["安哥拉", "Angola"],
    "安圭拉": ["安圭拉", "Anguilla"],
    "巴哈马": ["巴哈马", "Bahamas"],
    "巴拉圭": ["巴拉圭", "Paraguay"],
    "巴拿马": ["巴拿马", "Panama"],
    "百慕大": ["百慕大", "Bermuda"],
    "伯利兹": ["伯利兹", "Belize"],
    "布隆迪": ["布隆迪", "Burundi"],
    "布韦岛": ["布韦岛", "Bouvet Island"],
    "东帝汶": ["东帝汶", "Timor-Leste"],
    "佛得角": ["佛得角", "Cape Verde"],
    "冈比亚": ["冈比亚", "Gambia"],
    "格陵兰": ["格陵兰", "Greenland"],
    "根西岛": ["根西岛", "Guernsey"],
    "圭亚那": ["圭亚那", "Guyana"],
    "吉布提": ["吉布提", "Djibouti"],
    "几内亚": ["几内亚", "Guinea"],
    "喀麦隆": ["喀麦隆", "Cameroon"],
    "卡塔尔": ["卡塔尔", "Qatar"],
    "科摩罗": ["科摩罗", "Comoros"],
    "科威特": ["科威特", "Kuwait"],
    "肯尼亚": ["肯尼亚", "Kenya"],
    "库拉索": ["库拉索", "Curaçao"],
    "莱索托": ["莱索托", "Lesotho"],
    "黎巴嫩": ["黎巴嫩", "Lebanon"],
    "利比亚": ["利比亚", "Libya"],
    "留尼汪": ["留尼汪", "Réunion"],
    "卢旺达": ["卢旺达", "Rwanda"],
    "马恩岛": ["马恩岛", "Isle of Man"],
    "马拉维": ["马拉维", "Malawi"],
    "马约特": ["马约特", "Mayotte"],
    "摩洛哥": ["摩洛哥", "Morocco"],
    "南极洲": ["南极洲", "Antarctica"],
    "南苏丹": ["南苏丹", "South Sudan"],
    "尼泊尔": ["尼泊尔", "Nepal"],
    "尼日尔": ["尼日尔", "Niger"],
    "萨摩亚": ["萨摩亚", "Samoa"],
    "塞舌尔": ["塞舌尔", "Seychelles"],
    "圣诞岛": ["圣诞岛", "Christmas Island"],
    "苏里南": ["苏里南", "Suriname"],
    "索马里": ["索马里", "Somalia"],
    "突尼斯": ["突尼斯", "Tunisia"],
    "图瓦卢": ["图瓦卢", "Tuvalu"],
    "托克劳": ["托克劳", "Tokelau"],
    "乌干达": ["乌干达", "Uganda"],
    "乌拉圭": ["乌拉圭", "Uruguay"],
    "新西兰": ["新西兰", "New Zealand"],
    "叙利亚": ["叙利亚", "Syria"],
    "牙买加": ["牙买加", "Jamaica"],
    "伊拉克": ["伊拉克", "Iraq"],
    "赞比亚": ["赞比亚", "Zambia"],
    "泽西岛": ["泽西岛"],
    "澳门": ["澳门", "Macao", "Macau", "澳門", "中国澳门特别行政区"],
    "巴林": ["巴林", "Bahrain"],
    "贝宁": ["贝宁", "Benin"],
    "不丹": ["不丹", "Bhutan"],
    "多哥": ["多哥", "Togo"],
    "斐济": ["斐济", "Fiji"],
    "古巴": ["古巴", "Cuba"],
    "关岛": ["关岛", "Guam"],
    "海地": ["海地", "Haiti"],
    "加纳": ["加纳", "Ghana"],
    "加蓬": ["加蓬", "Gabon"],
    "马里": ["马里", "Mali"],
    "蒙古": ["蒙古", "Mongolia"],
    "瑙鲁": ["瑙鲁", "Nauru"],
    "纽埃": ["纽埃", "Niue"],
    "帕劳": ["帕劳", "Palau"],
    "苏丹": ["苏丹", "Sudan"],
    "汤加": ["汤加", "Tonga"],
    "也门": ["也门", "Yemen"],
    "伊朗": ["伊朗", "Iran"],
    "约旦": ["约旦", "Jordan"],
    "乍得": ["乍得", "Chad"],
    "智利": ["智利", "Chile"],
    "中国": ["中国", "China", "PRC"],
};

/**
 * [新增] 地区 Emoji 映射表
 */
export const REGION_EMOJI = {
    香港: '🇭🇰',
    台湾: '🇨🇳',
    新加坡: '🇸🇬',
    日本: '🇯🇵',
    美国: '🇺🇸',
    朝鲜: '🇰🇵',
    韩国: '🇰🇷',
    英国: '🇬🇧',
    德国: '🇩🇪',
    法国: '🇫🇷',
    加拿大: '🇨🇦',
    澳大利亚: '🇦🇺',
    荷兰: '🇳🇱',
    俄罗斯: '🇷🇺',
    印度: '🇮🇳',
    土耳其: '🇹🇷',
    孟加拉: '🇧🇩',
    巴基斯坦: '🇵🇰',
    马来西亚: '🇲🇾',
    泰国: '🇹🇭',
    越南: '🇻🇳',
    菲律宾: '🇵🇭',
    印尼: '🇮🇩',
    文莱: '🇧🇳',
    柬埔寨: '🇰🇭',
    老挝: '🇱🇦',
    缅甸: '🇲🇲',
    瑞士: '🇨🇭',
    意大利: '🇮🇹',
    西班牙: '🇪🇸',
    巴西: '🇧🇷',
    阿根廷: '🇦🇷',
    墨西哥: '🇲🇽',
    哥伦比亚: '🇨🇴',
    秘鲁: '🇵🇪',
    南非: '🇿🇦',
    埃及: '🇪🇬',
    以色列: '🇮🇱',
    阿联酋: '🇦🇪',
    阿曼: '🇴🇲',
    沙特: '🇸🇦',
    波兰: '🇵🇱',
    捷克: '🇨🇿',
    匈牙利: '🇭🇺',
    罗马尼亚: '🇷🇴',
    保加利亚: '🇧🇬',
    希腊: '🇬🇷',
    葡萄牙: '🇵🇹',
    瑞典: '🇸🇪',
    挪威: '🇳🇴',
    丹麦: '🇩🇰',
    芬兰: '🇫🇮',
    奥地利: '🇦🇹',
    爱尔兰: '🇮🇪',
    冰岛: '🇮🇸',
    卢森堡: '🇱🇺',
    马耳他: '🇲🇹',
    斯洛伐克: '🇸🇰',
    斯洛文尼亚: '🇸🇮',
    克罗地亚: '🇭🇷',
    拉脱维亚: '🇱🇻',
    立陶宛: '🇱🇹',
    爱沙尼亚: '🇪🇪',
    塞浦路斯: '🇨🇾',
    列支敦士登: '🇱🇮',
    阿尔巴尼亚: '🇦🇱',
    安道尔: '🇦🇩',
    白俄罗斯: '🇧🇾',
    波黑: '🇧🇦',
    摩尔多瓦: '🇲🇩',
    摩纳哥: '🇲🇨',
    黑山: '🇲🇪',
    北马其顿: '🇲🇰',
    塞尔维亚: '🇷🇸',
    乌克兰: '🇺🇦',
    科索沃: '🇽🇰',
    圣马力诺: '🇸🇲',
    梵蒂冈: '🇻🇦',
    格鲁吉亚: '🇬🇪',
    亚美尼亚: '🇦🇲',
    阿塞拜疆: '🇦🇿',
    比利时: '🇧🇪',
    "南乔治亚和南桑威奇群岛": "🇬🇸",
    "赫德岛和麦克唐纳群岛": "🇭🇲",
    "圣皮埃尔和密克隆群岛": "🇵🇲",
    "圣文森特和格林纳丁斯": "🇻🇨",
    "科科斯（基林）群岛": "🇨🇨",
    "特克斯和凯科斯群岛": "🇹🇨",
    "美国本土外小岛屿": "🇺🇲",
    "圣多美和普林西比": "🇸🇹",
    "斯瓦尔巴和扬马延": "🇸🇯",
    "特立尼达和多巴哥": "🇹🇹",
    "安提瓜和巴布达": "🇦🇬",
    "巴布亚新几内亚": "🇵🇬",
    "北马里亚纳群岛": "🇲🇵",
    "法属波利尼西亚": "🇵🇫",
    "美属维尔京群岛": "🇻🇮",
    "圣基茨和尼维斯": "🇰🇳",
    "瓦利斯和富图纳": "🇼🇫",
    "英属维尔京群岛": "🇻🇬",
    "英属印度洋领地": "🇮🇴",
    "法属南部领地": "🇹🇫",
    "荷属加勒比区": "🇧🇶",
    "吉尔吉斯斯坦": "🇰🇬",
    "密克罗尼西亚": "🇫🇲",
    "皮特凯恩群岛": "🇵🇳",
    "乌兹别克斯坦": "🇺🇿",
    "新喀里多尼亚": "🇳🇨",
    "阿尔及利亚": "🇩🇿",
    "埃塞俄比亚": "🇪🇹",
    "布基纳法索": "🇧🇫",
    "赤道几内亚": "🇬🇶",
    "厄立特里亚": "🇪🇷",
    "法属圭亚那": "🇬🇫",
    "法属圣马丁": "🇲🇫",
    "福克兰群岛": "🇫🇰",
    "刚果（布）": "🇨🇬",
    "刚果（金）": "🇨🇩",
    "哥斯达黎加": "🇨🇷",
    "哈萨克斯坦": "🇰🇿",
    "荷属圣马丁": "🇸🇽",
    "几内亚比绍": "🇬🇼",
    "马达加斯加": "🇲🇬",
    "马绍尔群岛": "🇲🇭",
    "毛里塔尼亚": "🇲🇷",
    "美属萨摩亚": "🇦🇸",
    "蒙特塞拉特": "🇲🇸",
    "圣巴泰勒米": "🇧🇱",
    "所罗门群岛": "🇸🇧",
    "塔吉克斯坦": "🇹🇯",
    "土库曼斯坦": "🇹🇲",
    "中非共和国": "🇨🇫",
    "奥兰群岛": "🇦🇽",
    "巴巴多斯": "🇧🇧",
    "巴勒斯坦": "🇵🇸",
    "波多黎各": "🇵🇷",
    "玻利维亚": "🇧🇴",
    "博茨瓦纳": "🇧🇼",
    "多米尼加": "🇩🇴",
    "多米尼克": "🇩🇲",
    "厄瓜多尔": "🇪🇨",
    "法罗群岛": "🇫🇴",
    "格林纳达": "🇬🇩",
    "瓜德罗普": "🇬🇵",
    "洪都拉斯": "🇭🇳",
    "基里巴斯": "🇰🇮",
    "津巴布韦": "🇿🇼",
    "开曼群岛": "🇰🇾",
    "科特迪瓦": "🇨🇮",
    "库克群岛": "🇨🇰",
    "利比里亚": "🇱🇷",
    "马尔代夫": "🇲🇻",
    "马提尼克": "🇲🇶",
    "毛里求斯": "🇲🇺",
    "莫桑比克": "🇲🇿",
    "纳米比亚": "🇳🇦",
    "尼加拉瓜": "🇳🇮",
    "尼日利亚": "🇳🇬",
    "诺福克岛": "🇳🇫",
    "萨尔瓦多": "🇸🇻",
    "塞拉利昂": "🇸🇱",
    "塞内加尔": "🇸🇳",
    "圣赫勒拿": "🇸🇭",
    "圣卢西亚": "🇱🇨",
    "斯里兰卡": "🇱🇰",
    "斯威士兰": "🇸🇿",
    "坦桑尼亚": "🇹🇿",
    "瓦努阿图": "🇻🇺",
    "危地马拉": "🇬🇹",
    "委内瑞拉": "🇻🇪",
    "西撒哈拉": "🇪🇭",
    "直布罗陀": "🇬🇮",
    "阿富汗": "🇦🇫",
    "阿鲁巴": "🇦🇼",
    "安哥拉": "🇦🇴",
    "安圭拉": "🇦🇮",
    "巴哈马": "🇧🇸",
    "巴拉圭": "🇵🇾",
    "巴拿马": "🇵🇦",
    "百慕大": "🇧🇲",
    "伯利兹": "🇧🇿",
    "布隆迪": "🇧🇮",
    "布韦岛": "🇧🇻",
    "东帝汶": "🇹🇱",
    "佛得角": "🇨🇻",
    "冈比亚": "🇬🇲",
    "格陵兰": "🇬🇱",
    "根西岛": "🇬🇬",
    "圭亚那": "🇬🇾",
    "吉布提": "🇩🇯",
    "几内亚": "🇬🇳",
    "喀麦隆": "🇨🇲",
    "卡塔尔": "🇶🇦",
    "科摩罗": "🇰🇲",
    "科威特": "🇰🇼",
    "肯尼亚": "🇰🇪",
    "库拉索": "🇨🇼",
    "莱索托": "🇱🇸",
    "黎巴嫩": "🇱🇧",
    "利比亚": "🇱🇾",
    "留尼汪": "🇷🇪",
    "卢旺达": "🇷🇼",
    "马恩岛": "🇮🇲",
    "马拉维": "🇲🇼",
    "马约特": "🇾🇹",
    "摩洛哥": "🇲🇦",
    "南极洲": "🇦🇶",
    "南苏丹": "🇸🇸",
    "尼泊尔": "🇳🇵",
    "尼日尔": "🇳🇪",
    "萨摩亚": "🇼🇸",
    "塞舌尔": "🇸🇨",
    "圣诞岛": "🇨🇽",
    "苏里南": "🇸🇷",
    "索马里": "🇸🇴",
    "突尼斯": "🇹🇳",
    "图瓦卢": "🇹🇻",
    "托克劳": "🇹🇰",
    "乌干达": "🇺🇬",
    "乌拉圭": "🇺🇾",
    "新西兰": "🇳🇿",
    "叙利亚": "🇸🇾",
    "牙买加": "🇯🇲",
    "伊拉克": "🇮🇶",
    "赞比亚": "🇿🇲",
    "泽西岛": "🇯🇪",
    "澳门": "🇲🇴",
    "巴林": "🇧🇭",
    "贝宁": "🇧🇯",
    "不丹": "🇧🇹",
    "多哥": "🇹🇬",
    "斐济": "🇫🇯",
    "古巴": "🇨🇺",
    "关岛": "🇬🇺",
    "海地": "🇭🇹",
    "加纳": "🇬🇭",
    "加蓬": "🇬🇦",
    "马里": "🇲🇱",
    "蒙古": "🇲🇳",
    "瑙鲁": "🇳🇷",
    "纽埃": "🇳🇺",
    "帕劳": "🇵🇼",
    "苏丹": "🇸🇩",
    "汤加": "🇹🇴",
    "也门": "🇾🇪",
    "伊朗": "🇮🇷",
    "约旦": "🇯🇴",
    "乍得": "🇹🇩",
    "智利": "🇨🇱",
    "中国": "🇨🇳",
    其他: '🌍',
};

function normalizeBase64(input) {
    let s = String(input || '')
        .trim()
        .replace(/\s+/g, '');
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
    return REGION_EMOJI[region] || (region === '其他' || !region ? '🌍' : '');
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
            url: nodeUrl,
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
            const base64Part = nodeUrl.replace('vmess://', '').split('#')[0].split('?')[0].trim();
            if (base64Part && !base64Part.includes('@')) {
                // 排除可能是明文的情况(虽然vmess少见)
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
                    let ssrServer = '',
                        ssrPort = '';
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
                    const paramStart =
                        slashQ !== -1
                            ? slashQ + 2
                            : decoded.indexOf('?') !== -1
                              ? decoded.indexOf('?') + 1
                              : -1;
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
        } else if (protocol === 'wireguard') {
            // WireGuard 格式: wireguard://privatekey@server:port?params#name
            let body = nodeUrl.substring('wireguard://'.length);

            // 提取名称
            const hIndex = body.indexOf('#');
            if (hIndex !== -1) {
                try {
                    nodeName = decodeURIComponent(body.substring(hIndex + 1));
                } catch (e) {
                    nodeName = body.substring(hIndex + 1);
                }
                body = body.substring(0, hIndex);
            }

            // 提取服务器和端口
            const atIndex = body.lastIndexOf('@');
            if (atIndex !== -1) {
                const serverPart = body.substring(atIndex + 1);
                const qIndex = serverPart.indexOf('?');
                const addrPart = qIndex !== -1 ? serverPart.substring(0, qIndex) : serverPart;

                // 处理 IPv6
                if (addrPart.startsWith('[')) {
                    const closeBracket = addrPart.indexOf(']');
                    if (closeBracket !== -1) {
                        server = addrPart.substring(1, closeBracket);
                        const afterBracket = addrPart.substring(closeBracket + 1);
                        if (afterBracket.startsWith(':')) {
                            port = afterBracket.substring(1);
                        }
                    }
                } else {
                    const parts = addrPart.split(':');
                    if (parts.length >= 2) {
                        server = parts[0];
                        port = parts[1];
                    }
                }
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
            let serverPart = atIndex !== -1 ? body.substring(atIndex + 1) : body;

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
                    console.debug(
                        '[GeoUtils] VLESS base64 decode attempt failed (expected for standard format)'
                    );
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
        url: nodeUrl,
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

    nodes.forEach((node) => {
        const region = extractNodeRegion(node.name || '');
        stats[region] = (stats[region] || 0) + 1;
    });

    // 添加百分比信息
    for (const [region, count] of Object.entries(stats)) {
        stats[region] = {
            count,
            percentage: Math.round((count / total) * 100),
        };
    }

    return stats;
}
