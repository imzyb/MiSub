export const BUILTIN_TEMPLATE_REGISTRY = {
    clash_misub_minimal: {
        id: 'clash_misub_minimal',
        name: 'MiSub 极简默认分流',
        target: 'clash',
        format: 'ini',
        description: '更偏日常使用的极简模板，仅保留主选择、自动选择、常用媒体与兜底分组，适合作为统一模板主线默认配置。',
        content: `[custom]
ruleset=🎬 流媒体,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ProxyMedia.list
ruleset=📲 电报消息,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Telegram.list
ruleset=🎯 全球直连,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ChinaDomain.list
ruleset=🎯 全球直连,[]GEOIP,CN
ruleset=🐟 漏网之鱼,[]FINAL

custom_proxy_group=🚀 节点选择\`select\`[]♻️ 自动选择\`[]☑️ 手动切换\`[]DIRECT
custom_proxy_group=♻️ 自动选择\`url-test\`[]<%regionStrategyChain%>\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=☑️ 手动切换\`select\`.*
custom_proxy_group=🎬 流媒体\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT
custom_proxy_group=📲 电报消息\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT
custom_proxy_group=🎯 全球直连\`select\`[]DIRECT\`[]🚀 节点选择
custom_proxy_group=🐟 漏网之鱼\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT

enable_rule_generator=true
overwrite_original_rules=true`
    },
    clash_acl4ssr_lite: {
        id: 'clash_acl4ssr_lite',
        name: 'ACL4SSR 精简分流',
        target: 'clash',
        format: 'ini',
        description: '内置精简 ACL4SSR 分流模板，保留常用分组和核心规则，适合作为轻量默认预设。',
        content: `[custom]
ruleset=🎯 全球直连,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/LocalAreaNetwork.list
ruleset=🛑 广告拦截,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/BanAD.list
ruleset=📲 电报消息,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Telegram.list
ruleset=📹 油管视频,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/YouTube.list
ruleset=🎥 奈飞视频,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Netflix.list
ruleset=🚀 节点选择,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ProxyGFWlist.list
ruleset=🎯 全球直连,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ChinaDomain.list
ruleset=🎯 全球直连,[]GEOIP,CN
ruleset=🐟 漏网之鱼,[]FINAL

custom_proxy_group=🚀 节点选择\`select\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇯🇵 日本节点\`[]🇺🇲 美国节点\`[]☑️ 手动切换\`[]DIRECT
custom_proxy_group=☑️ 手动切换\`select\`.*
custom_proxy_group=♻️ 自动选择\`url-test\`[]🇭🇰 香港节点\`[]🇯🇵 日本节点\`[]🇺🇲 美国节点\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=📲 电报消息\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT
custom_proxy_group=📹 油管视频\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT
custom_proxy_group=🎥 奈飞视频\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT
custom_proxy_group=🎯 全球直连\`select\`[]DIRECT\`[]🚀 节点选择
custom_proxy_group=🛑 广告拦截\`select\`[]REJECT\`[]DIRECT
custom_proxy_group=🐟 漏网之鱼\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT
custom_proxy_group=🇭🇰 香港节点\`url-test\`(港|HK|Hong Kong|HKG)\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇯🇵 日本节点\`url-test\`(日本|JP|Japan|Tokyo|NRT|KIX)\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇺🇲 美国节点\`url-test\`(美|US|United States|LAX|SJC|SEA)\`http://www.gstatic.com/generate_204\`300,,100

        enable_rule_generator=true
        overwrite_original_rules=true`
    },
    clash_misub_media_ai: {
        id: 'clash_misub_media_ai',
        name: 'MiSub 流媒体与 AI 分流',
        target: 'clash',
        format: 'ini',
        description: '面向常见流媒体和 AI 服务场景的内置模板，保留自动选择、地区组和核心服务分流。',
        content: `[custom]
ruleset=🤖 AI 服务,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/OpenAi.list
ruleset=🤖 AI 服务,https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/Claude.list
ruleset=📹 油管视频,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/YouTube.list
ruleset=🎥 奈飞视频,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Netflix.list
ruleset=📲 电报消息,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Telegram.list
ruleset=🎯 全球直连,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ChinaDomain.list
ruleset=🎯 全球直连,[]GEOIP,CN
ruleset=🐟 漏网之鱼,[]FINAL

custom_proxy_group=🚀 节点选择\`select\`[]♻️ 自动选择\`[]<%regionStrategyChain%>\`[]<%protocolStrategyChain%>\`[]☑️ 手动切换\`[]DIRECT
custom_proxy_group=♻️ 自动选择\`url-test\`[]<%regionStrategyChain%>\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=☑️ 手动切换\`select\`.*
custom_proxy_group=🤖 AI 服务\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]🇺🇲 美国节点\`[]🇯🇵 日本节点\`[]DIRECT
custom_proxy_group=📹 油管视频\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT
custom_proxy_group=🎥 奈飞视频\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT
custom_proxy_group=📲 电报消息\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT
custom_proxy_group=🎯 全球直连\`select\`[]DIRECT\`[]🚀 节点选择
custom_proxy_group=🐟 漏网之鱼\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT

enable_rule_generator=true
overwrite_original_rules=true`
    },
    clash_acl4ssr_full: {
        id: 'clash_acl4ssr_full',
        name: 'ACL4SSR 完整分流',
        target: 'clash',
        format: 'ini',
        description: '内置完整 ACL4SSR 分流模板，适合作为 Clash 系列的高完整度规则预设。',
        content: `[custom]
;不要随意改变关键字，否则会导致出错
;acl4SSR规则

ruleset=🎯 全球直连,https://raw.githubusercontent.com/cmliu/ACL4SSR/refs/heads/main/Clash/CFnat.list
ruleset=🎯 全球直连,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/LocalAreaNetwork.list
ruleset=🎯 全球直连,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/UnBan.list
ruleset=🛑 广告拦截,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/BanAD.list
ruleset=🍃 应用净化,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/BanProgramAD.list
ruleset=📢 谷歌FCM,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/GoogleFCM.list
ruleset=🎯 全球直连,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/GoogleCN.list
ruleset=🎯 全球直连,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/SteamCN.list
ruleset=Ⓜ️ 微软Bing,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Bing.list
ruleset=Ⓜ️ 微软云盘,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/OneDrive.list
ruleset=Ⓜ️ 微软服务,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Microsoft.list
ruleset=🍎 苹果服务,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Apple.list
ruleset=📲 电报消息,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Telegram.list
ruleset=🤖 OpenAi,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/OpenAi.list
ruleset=🤖 OpenAi,https://raw.githubusercontent.com/juewuy/ShellClash/master/rules/ai.list
ruleset=🤖 OpenAi,https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/Copilot.list
ruleset=🤖 OpenAi,https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/GithubCopilot.list
ruleset=🤖 OpenAi,https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/Claude.list
ruleset=🎶 网易音乐,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/NetEaseMusic.list
ruleset=🎮 游戏平台,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Epic.list
ruleset=🎮 游戏平台,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Origin.list
ruleset=🎮 游戏平台,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Sony.list
ruleset=🎮 游戏平台,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Steam.list
ruleset=🎮 游戏平台,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Nintendo.list
ruleset=📹 油管视频,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/YouTube.list
ruleset=🎥 奈飞视频,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Netflix.list
ruleset=📺 巴哈姆特,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Bahamut.list
ruleset=📺 哔哩哔哩,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/BilibiliHMT.list
ruleset=📺 哔哩哔哩,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Bilibili.list
ruleset=🌏 国内媒体,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ChinaMedia.list
ruleset=🌍 国外媒体,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ProxyMedia.list
ruleset=🌍 国外媒体,https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/Emby.list
ruleset=🚀 节点选择,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ProxyGFWlist.list
ruleset=🚀 节点选择,https://raw.githubusercontent.com/UlinoyaPed/ShellClash/dev/lists/proxy.list
ruleset=🚀 节点选择,https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/CMBlog.list
ruleset=🎯 全球直连,https://raw.githubusercontent.com/UlinoyaPed/ShellClash/dev/lists/direct.list
ruleset=🎯 全球直连,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ChinaDomain.list
ruleset=🎯 全球直连,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ChinaCompanyIp.list
ruleset=🎯 全球直连,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Download.list
ruleset=🎯 全球直连,[]GEOIP,CN
ruleset=🍃 应用净化,https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/adobe.list
ruleset=🍃 应用净化,https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/IDM.list
ruleset=🐟 漏网之鱼,[]FINAL

custom_proxy_group=🚀 节点选择\`select\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇹🇼 台湾节点\`[]🇸🇬 狮城节点\`[]🇯🇵 日本节点\`[]🇺🇲 美国节点\`[]🇰🇷 韩国节点\`[]☑️ 手动切换\`[]DIRECT
custom_proxy_group=☑️ 手动切换\`select\`.*
custom_proxy_group=♻️ 自动选择\`url-test\`[]🇭🇰 香港节点\`[]🇸🇬 狮城节点\`[]🇯🇵 日本节点\`[]🇰🇷 韩国节点\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=📲 电报消息\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]🇸🇬 狮城节点\`[]🇭🇰 香港节点\`[]🇹🇼 台湾节点\`[]🇯🇵 日本节点\`[]🇺🇲 美国节点\`[]🇰🇷 韩国节点\`[]☑️ 手动切换\`[]DIRECT
custom_proxy_group=🤖 OpenAi\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]🇸🇬 狮城节点\`[]🇭🇰 香港节点\`[]🇹🇼 台湾节点\`[]🇯🇵 日本节点\`[]🇺🇲 美国节点\`[]🇰🇷 韩国节点\`[]☑️ 手动切换\`[]DIRECT
custom_proxy_group=📹 油管视频\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]🇸🇬 狮城节点\`[]🇭🇰 香港节点\`[]🇹🇼 台湾节点\`[]🇯🇵 日本节点\`[]🇺🇲 美国节点\`[]🇰🇷 韩国节点\`[]☑️ 手动切换\`[]DIRECT
custom_proxy_group=🎥 奈飞视频\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]🇸🇬 狮城节点\`[]🇭🇰 香港节点\`[]🇹🇼 台湾节点\`[]🇯🇵 日本节点\`[]🇺🇲 美国节点\`[]🇰🇷 韩国节点\`[]☑️ 手动切换\`[]DIRECT\`(NF|奈飞|解锁|Netflix|NETFLIX|Media|MITM)
custom_proxy_group=📺 巴哈姆特\`select\`[]🇹🇼 台湾节点\`[]🚀 节点选择\`[]☑️ 手动切换\`[]DIRECT
custom_proxy_group=📺 哔哩哔哩\`select\`[]🎯 全球直连\`[]🇹🇼 台湾节点\`[]🇭🇰 香港节点
custom_proxy_group=🌍 国外媒体\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇹🇼 台湾节点\`[]🇸🇬 狮城节点\`[]🇯🇵 日本节点\`[]🇺🇲 美国节点\`[]🇰🇷 韩国节点\`[]☑️ 手动切换\`[]DIRECT\`(MITM|emby|Emby)
custom_proxy_group=🌏 国内媒体\`select\`[]DIRECT\`[]🇭🇰 香港节点\`[]🇹🇼 台湾节点\`[]🇸🇬 狮城节点\`[]🇯🇵 日本节点\`[]☑️ 手动切换
custom_proxy_group=📢 谷歌FCM\`select\`[]DIRECT\`[]🚀 节点选择\`[]🇺🇲 美国节点\`[]🇭🇰 香港节点\`[]🇹🇼 台湾节点\`[]🇸🇬 狮城节点\`[]🇯🇵 日本节点\`[]🇰🇷 韩国节点\`[]☑️ 手动切换
custom_proxy_group=Ⓜ️ 微软Bing\`select\`[]DIRECT\`[]🚀 节点选择\`[]🇺🇲 美国节点\`[]🇭🇰 香港节点\`[]🇹🇼 台湾节点\`[]🇸🇬 狮城节点\`[]🇯🇵 日本节点\`[]🇰🇷 韩国节点\`[]☑️ 手动切换
custom_proxy_group=Ⓜ️ 微软云盘\`select\`[]DIRECT\`[]🚀 节点选择\`[]🇺🇲 美国节点\`[]🇭🇰 香港节点\`[]🇹🇼 台湾节点\`[]🇸🇬 狮城节点\`[]🇯🇵 日本节点\`[]🇰🇷 韩国节点\`[]☑️ 手动切换
custom_proxy_group=Ⓜ️ 微软服务\`select\`[]DIRECT\`[]🚀 节点选择\`[]🇺🇲 美国节点\`[]🇭🇰 香港节点\`[]🇹🇼 台湾节点\`[]🇸🇬 狮城节点\`[]🇯🇵 日本节点\`[]🇰🇷 韩国节点\`[]☑️ 手动切换
custom_proxy_group=🍎 苹果服务\`select\`[]DIRECT\`[]🚀 节点选择\`[]🇺🇲 美国节点\`[]🇭🇰 香港节点\`[]🇹🇼 台湾节点\`[]🇸🇬 狮城节点\`[]🇯🇵 日本节点\`[]🇰🇷 韩国节点\`[]☑️ 手动切换
custom_proxy_group=🎮 游戏平台\`select\`[]DIRECT\`[]🚀 节点选择\`[]🇺🇲 美国节点\`[]🇭🇰 香港节点\`[]🇹🇼 台湾节点\`[]🇸🇬 狮城节点\`[]🇯🇵 日本节点\`[]🇰🇷 韩国节点\`[]☑️ 手动切换
custom_proxy_group=🎶 网易音乐\`select\`[]DIRECT\`[]🚀 节点选择\`[]♻️ 自动选择\`(网易|音乐|解锁|Music|NetEase)
custom_proxy_group=🎯 全球直连\`select\`[]DIRECT\`[]🚀 节点选择\`[]♻️ 自动选择
custom_proxy_group=🛑 广告拦截\`select\`[]REJECT\`[]DIRECT
custom_proxy_group=🍃 应用净化\`select\`[]REJECT\`[]DIRECT
custom_proxy_group=🐟 漏网之鱼\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT\`[]🇭🇰 香港节点\`[]🇹🇼 台湾节点\`[]🇸🇬 狮城节点\`[]🇯🇵 日本节点\`[]🇺🇲 美国节点\`[]🇰🇷 韩国节点\`[]☑️ 手动切换
custom_proxy_group=🇭🇰 香港节点\`url-test\`(港|HK|hk|Hong Kong|HongKong|hongkong|HKG)\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇯🇵 日本节点\`url-test\`(日本|川日|东京|大阪|泉日|埼玉|沪日|深日|[^-]日|JP|Japan|Tokyo|NRT|KIX)\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇺🇲 美国节点\`url-test\`(美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|US|United States|ATL|BUF|DFW|EWR|IAD|LAX|MCI|MIA|ORD|PHX|PDX|SEA|SJC)\`http://www.gstatic.com/generate_204\`300,,150
custom_proxy_group=🇹🇼 台湾节点\`url-test\`(台|新北|彰化|TW|Taiwan|TPE|KHH)\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇸🇬 狮城节点\`url-test\`(新加坡|坡|狮城|SG|Singapore|SIN)\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇰🇷 韩国节点\`url-test\`(KR|Korea|KOR|Seoul|首尔|春川|韩|韓|ICN)\`http://www.gstatic.com/generate_204\`300,,50

enable_rule_generator=true
overwrite_original_rules=true`
    }
};

export function getBuiltinTemplate(templateId) {
    return BUILTIN_TEMPLATE_REGISTRY[templateId] || null;
}
