# 订阅请求链路

本文档记录 MiSub 当前真实订阅请求链路，重点覆盖路由入口、token/profile 解析、浏览器伪装、订阅源读取、节点解析、缓存、转换输出、访问计数和通知/日志。

> 代码基准：`functions/[[path]].js`、`functions/modules/subscription/main-handler.js`、`functions/services/subscription-service.js`、`functions/modules/subscription/cache-manager.js`、`functions/services/node-cache-service.js`。

## 1. 路由入口

全局入口是 `functions/[[path]].js` 的 `onRequest(context)`。

请求进入后会先通过三层通用中间件：

1. `corsMiddleware`
2. `csrfOriginMiddleware`
3. `securityHeadersMiddleware`

然后执行内部 `handleRequest()` 做路由分发。

订阅请求会被转交给 `handleMisubRequest(context)`，条件包括：

- 路径显式以 `/sub/` 开头。
- 路径第一段等于配置中的 `mytoken` 或 `profileToken`。
- 非 API、非 SPA、非静态资源路径的兜底订阅短链。

API 路径 `/api/*` 总是优先进入 `handleApiRequest(request, env)`，不会进入订阅链路。

## 2. 基础数据加载

`handleMisubRequest(context)` 开始后会：

1. 记录请求方法、路径和 User-Agent（路径会脱敏）。
2. 通过 `StorageFactory.createAdapter()` 获取存储适配器。
3. 并行读取：
   - `KV_KEY_SETTINGS`
   - 所有订阅源 `getAllSubscriptions()`
   - 所有订阅组 `getAllProfiles()`
4. 将默认设置与存储设置合并，并执行 `migrateConfigSettings()`。
5. 如果订阅组 ID 仍是旧格式，执行 `migrateProfileIds()` 并异步写回。
6. 将 `context.storage` 与 `context.accessLogPersistenceMode` 挂到请求上下文。

## 3. 浏览器伪装判定

订阅入口会先根据 User-Agent 判定是否浏览器访问：

- 使用 `isBrowserAgent(userAgentHeader)`。
- 必须像浏览器，例如包含 `Mozilla` 以及 Chrome/Safari/Firefox 等关键词。
- 同时排除 Clash、Mihomo、Surge、Loon、Shadowrocket、Sing-box、Hiddify、curl、wget、Postman 等代理客户端或工具。

如果满足以下条件，会直接返回伪装页：

- `config.disguise.enabled` 为真。
- 当前请求看起来是浏览器。
- URL 没有 `callback_token`。
- `authMiddleware(request, env)` 判断未登录。

这一步发生在 token/profile 校验之前，用来避免浏览器直接打开订阅短链时暴露订阅内容。

## 4. token 与 profile 解析

解析逻辑在 `resolveRequestContext(url, config, allProfiles)`。

支持格式：

- `/{token}`：管理员全量订阅。
- `/{profileToken}/{profileId}`：订阅组访问。
- `/sub/{token}`：带路由前缀的管理员全量订阅。
- `/sub/{profileToken}/{profileId}`：带路由前缀的订阅组访问。
- 空路径可从 `?token=` 读取 token。

当前实现的路径段规则：

- 3 段及以上：跳过第一段，将第二段视为 token，第三段视为 profile 标识。
- 2 段：
  - 第一段等于 `profileToken` 或 `mytoken` 时，按 `/{token}/{profileId}` 处理。
  - 第一段为 `sub` 时，按 `/sub/{token}` 处理。
  - 其他情况兜底按 `/{token}/{profileId}` 处理，后续再校验 token。
- 1 段：该段就是 token。

## 5. profile 模式与全量 token 模式

### 5.1 profile 模式

当 `profileIdentifier` 存在时：

1. 必须提供 token，且 token 必须等于 `config.profileToken`。
2. 按 `customId` 或 `id` 查找订阅组。
3. 订阅组必须存在且 `enabled` 为真。
4. 如果设置了 `expiresAt` 且已过期：
   - 只返回一个过期提示伪节点。
   - 文件名仍使用订阅组名称。
5. 未过期时：
   - 按订阅组中 `subscriptions` 的顺序选择 HTTP 订阅源。
   - 支持订阅组内对象覆盖，例如 `{ id, exclude, operators, ... }`。
   - 按订阅组中 `manualNodes` 的顺序选择手动节点。
   - 仅加入启用状态、URL 类型匹配的项目。

profile 模式下，如果访问日志开启且不是 `callback_token`/内部请求，会异步增加订阅组下载计数：

- key：`misub_profile_download_count_{customId || id}`
- 更新方式：读取当前值后 `+1`，通过 `context.waitUntil()` 异步写入。
- 计数失败只记录错误，不影响订阅响应。

### 5.2 管理员全量 token 模式

当没有 `profileIdentifier` 时：

1. token 必须等于 `config.mytoken`。
2. 目标订阅源为所有 `enabled` 的订阅源。

无效 token 返回：

- profile 模式：`403 Invalid Profile Token`
- 全量 token 模式：`403 Invalid Token`
- profile 不存在或禁用：`404 Profile not found or disabled`

## 6. 目标格式与转换引擎选择

目标格式由 `determineTargetFormat(userAgentHeader, url.searchParams)` 决定。

优先级：

1. URL 参数：
   - `target=...`
   - 或存在 `clash`、`singbox`、`surge`、`loon`、`base64`、`v2ray`、`trojan`、`quanx`、`egern`、`nodes` 等参数。
   - `v2ray` 和 `trojan` 会归一为 `base64`。
   - `target=surge&ver=N` 会保留版本，`target=surge` 默认使用 `surge&ver=4`。
2. User-Agent：
   - Mihomo/Meta/Clash/Stash/NekoBox 等默认 `clash`。
   - Sing-box 默认 `singbox`。
   - Shadowrocket、v2rayN、v2rayNG 默认 `base64`。
   - Loon 默认 `loon`。
   - Quantumult X 默认 `quanx`。
3. 默认回退：`base64`。

转换引擎由 `resolveEffectiveEngine()` 决定：

- URL 参数 `engine=` 优先。
- `builtin=external` 强制第三方转换。
- `builtin=true/1/builtin` 强制内置转换。
- Hiddify 且无明确格式时强制内置转换。
- 否则按订阅组 `subconverter.engineMode`、全局 `subconverter.engineMode`、默认 `builtin`。

## 7. 模板、规则等级与请求参数覆盖

模板来源：

1. 全局：`config.transformConfigMode` + `config.transformConfig`。
2. 订阅组：`currentProfile.transformConfigMode` + `currentProfile.transformConfig`，可覆盖全局。
3. `resolveTemplateSource()` 将模板分为：
   - `none`
   - `builtin:*`
   - `custom:*`
   - remote URL

规则等级 `ruleLevel`：

- URL `level` 或 `ruleLevel` 优先。
- 其次订阅组 `ruleLevel`/`clashRuleLevel`。
- 再其次全局 `ruleLevel`/`clashRuleLevel`。
- 默认 `std`。
- 如果使用 remote/custom 模板，内置规则等级强制为 `none`。

URL 参数可以覆盖部分转换行为：

- `include`
- `exclude`
- `rename`
- `emoji=true|false`
- `udp=true|false`
- `tfo=true|false`
- `scv=true|false`
- `list=true`
- `refresh`、`nocache`、`debug` 强制刷新缓存。

## 8. 节点缓存链路

订阅聚合前会构造聚合缓存 key：

- profile：`node_cache_profile_{profileIdentifier}`
- 全量 token：`node_cache_token_{token}`

缓存读取由 `resolveNodeListWithCache()` 完成：

- `fresh` 且有可用节点：直接返回缓存，响应头 `X-Cache-Status: HIT`。
- `stale` 或 `expired` 且有可用节点：先返回缓存，响应头 `X-Cache-Status: REFRESHING`，并通过 `waitUntil()` 后台刷新。
- 缓存缺失、不可用、强制刷新：同步执行 `refreshNodes(false)`，响应头 `X-Cache-Status: MISS`。

缓存 TTL 语义：

- fresh：3 分钟。
- stale：1 小时内可用并后台刷新。
- max age：12 小时。
- 后台刷新超时：25 秒。
- stale/expired 后台刷新有 10 秒防抖，避免同一 key 高频重复刷新。

写聚合缓存时：

- 空节点不会覆盖已有非空缓存。
- 如果有 HTTP 订阅源，只有至少一个远程源真正拉取成功才刷新聚合缓存时间。
- 纯手动节点或过期订阅组可直接写缓存。

## 9. 订阅源拉取与节点解析

节点生成由 `generateCombinedNodeList()` 完成。

### 9.1 手动节点

手动节点定义为 URL 不以 `http` 开头的订阅项。

处理步骤：

1. 修复节点 URL 编码：`fixNodeUrlEncoding()`。
2. 如果订阅项有名称，将名称写入节点：
   - VMess 会尝试修改 base64 JSON 中的 `ps`。
   - 其他协议修改 URL fragment。
3. 如果启用分组名前缀，且未启用智能重命名模板，则加分组名前缀。
4. 如果启用手动节点前缀，且未启用智能重命名模板，则加手动节点前缀。
5. 执行订阅源级转换：算子链 + include/exclude 过滤。

### 9.2 HTTP 订阅源

HTTP 订阅源定义为 URL 以 `http` 开头的订阅项。

处理特征：

- 并发限制：最多 4 个远程请求同时进行。
- 单次超时：18 秒。
- 最大重试：2 次。
- 可重试状态码：`500`、`502`、`503`、`504`、`429`。
- 重试延迟使用指数退避，并尊重 `Retry-After`。

单源请求步骤：

1. User-Agent：
   - 优先使用订阅项 `customUserAgent`。
   - 否则由 `getProcessedUserAgent(userAgent, sub.url)` 生成。
2. 拉取代理：
   - 如果订阅项配置 `fetchProxy`，通过 `buildFetchProxyUrl()` 包装原始订阅地址。
3. 发起 fetch，并跟随重定向。
4. 如果开启内置跳过证书校验，会附加 Cloudflare `cf` 相关跳过证书参数。
5. 非 OK 响应：
   - 写入空运行时信息。
   - 如果开启单源节点缓存，回退使用单源缓存。
6. OK 响应：
   - 读取 `arrayBuffer()`。
   - 先按 UTF-8 解码为文本。
   - 尝试识别并解码 Base64。
   - 使用统一 `parseNodeList(text)` 解析节点，保证与预览链路一致。
   - 如果解析结果为空，会再尝试将原始 buffer 转 base64 后解码再解析。
   - 执行订阅源级转换：算子链 + include/exclude 过滤。
   - 只将真实代理节点计入单源节点缓存和运行时统计。

真实代理协议包括：

- `ss://`
- `ssr://`
- `vmess://`
- `vless://`
- `trojan://`
- `hysteria://`
- `hysteria2://`
- `hy2://`
- `tuic://`
- `anytls://`
- `socks5://`
- `socks://`

## 10. 单源缓存与运行时信息

订阅项可以开启 `enableNodeCache`。

单源缓存 key：

- 有 `sub.id`：`node_cache_subscription_{encodeURIComponent(id)}`
- 无 id：`node_cache_subscription_url_{hash(url)}`

行为：

- 写入时只保存真实代理节点。
- 远程失败、非 OK、解析为空时，如果启用单源缓存，会回退返回缓存节点。
- 读取缓存时也会再次过滤真实代理节点。

运行时信息：

- 成功解析真实节点后，记录：
  - `nodeCount`
  - `userInfo`，来自响应头 `subscription-userinfo`
- 会写入：
  - 当前请求上下文 `context.currentSubscriptionRuntimeInfo`
  - 存储中的订阅项 `nodeCount`、`userInfo`、`lastUpdate`、`lastError: null`
- 写入通过 `context.waitUntil()` 异步执行，不阻塞响应。

## 11. 组合节点治理

所有手动节点和 HTTP 订阅源结果会进入组合治理阶段：

1. 原始聚合：手动节点 + HTTP 订阅结果。
2. 去空行。
3. 去重，保留首次出现。
4. 根据 emoji 配置决定是否移除旗帜 emoji。
5. 选择组合级算子链：
   - 订阅组 `operators`
   - 全局 `defaultOperators`
   - 旧版 `nodeTransform` 桥接为算子链
6. 执行组合级算子链。
7. 应用订阅组级 include/exclude。
8. 应用全局 include/exclude。
9. 执行 YAML 安全净化 `sanitizeNodeForYaml()`。
10. 根据配置补齐 flag emoji。
11. 如果存在流量剩余伪节点或过期伪节点，将其插入最前。

流量剩余伪节点：

- 当未过期、`config.enableTrafficNode !== false` 且目标订阅源有有效 `userInfo.total` 时生成。
- 名称格式：`流量剩余 ≫ {formatBytes(remaining)}`。

## 12. 输出分支

节点列表生成后，根据目标格式和引擎进入不同输出分支。

### 12.1 `target=nodes`

直接返回明文节点：

- `Content-Type: text/plain; charset=utf-8`
- `Cache-Control: no-store, no-cache`
- `X-MiSub-Mode: node-export-plain`
- 如有流量信息，附加：
  - `Subscription-Userinfo`
  - `Profile-Update-Interval`

这是给第三方转换器使用的数据源格式。

### 12.2 第三方转换模式

当 `effectiveEngine === 'external'` 且目标格式不是 `base64`：

1. 使用 `buildExternalSubconverterUrl()` 构造第三方后端 URL。
2. 将 MiSub 已预处理后的节点列表作为内联 `url` 参数传给 subconverter。
3. 节点用 `|` 拼接，避免部分后端只解析首行或报 No nodes found。
4. 透传/设置：
   - `target`
   - `meta`
   - `udp`
   - `emoji`
   - `scv`
   - `sort`
   - `tfo`
   - `list`
   - `config`（仅 remote 模板）
   - `filename`
5. 返回 302：
   - `Location: {externalUrl}`
   - `Cache-Control: no-store, no-cache`
   - `X-MiSub-Mode: external-redirect-v2`

如果使用 builtin 模板但选择第三方转换，会返回警告头：

- `X-MiSub-Template-Warning: external-engine-ignores-builtin-template`

### 12.3 `base64`

返回 base64 编码后的节点列表：

- `Content-Type: text/plain; charset=utf-8`
- `Cache-Control: no-store, no-cache`
- 附加聚合缓存头。

### 12.4 内置转换

内置转换支持：

- `clash`
- `egern`
- `surge&ver=N`
- `loon`
- `quanx`
- `singbox` / `sing-box`

流程：

1. 构造 `builtinOptions`：
   - User-Agent、URL 参数、Hiddify 兼容标记。
   - 文件名。
   - 更新间隔。
   - `skipCertVerify`、`enableUdp`、`enableTfo`。
   - `ruleLevel`。
   - 是否 Meta 核心。
2. 调用 `ProcessorService.renderOutput()`。
3. 先用 `transformBuiltinSubscription()` 生成基础格式内容。
4. 如配置模板且不是 Hiddify 兼容模式：
   - builtin 模板从注册表读取。
   - custom 模板从规则模板存储读取。
   - remote 模板通过模板缓存读取。
   - ini 模板按目标格式渲染 Clash/Singbox/Surge/Loon/QuanX/Egern。
5. `list=true` 时，从内置输出中提取节点片段。
6. 返回最终内容，并设置：
   - 标准 `Content-Disposition`，同时支持 ASCII fallback 与 UTF-8 `filename*`。
   - 正确 `Content-Type`。
   - `Cache-Control: no-store, no-cache`。
   - `X-MiSub-Mode: builtin-{targetFormat}`。
   - 聚合缓存头。
   - 如有流量信息，附加 `Subscription-Userinfo` 与 `Profile-Update-Interval`。

如果内置转换失败，会回退到 base64 输出。

## 13. 通知与访问日志

订阅访问通知与访问日志不是完全同一个开关。

共同跳过条件：

- URL 包含 `callback_token`。
- User-Agent 包含 `MiSub-Backend` 或 `TelegramBot`。

### 13.1 Telegram 通知

只要未被上述条件跳过，base64、第三方转换、内置转换分支都会通过 `sendEnhancedTgNotification()` 发送访问通知。

通知内容包含：

- 域名。
- 客户端 User-Agent。
- 请求格式。
- 订阅组名称。
- 客户端 IP。

通知标题会区分：

- `订阅被访问`
- `订阅被访问 (第三方转换)`
- `订阅被访问 (内置转换)`

### 13.2 访问日志

访问日志需要 `config.enableAccessLog` 为真。

在 base64 和内置转换分支，成功响应后会调用 `logAccessSuccess()` 写日志。

日志字段包括：

- profileName
- clientIp
- geoInfo
- userAgent
- status
- format
- token
- type：`profile` 或 `token`
- domain
- persistenceMode
- details：节点数、源数量、成功/失败数量、耗时
- summary

`generateCombinedNodeList()` 内部也有日志写入能力，但主链路调用时传入 `{ ...config, enableAccessLog: false }`，因此服务内日志被关闭，由 handler 负责延迟记录，避免重复日志。

## 14. 响应头速查

常见订阅响应头：

- `Cache-Control: no-store, no-cache`
- `X-Cache-Status: HIT | REFRESHING | MISS`
- `X-Node-Count: {count}`
- `X-Cache-Time: {iso-time}`
- `X-MiSub-Mode: node-export-plain | external-redirect-v2 | builtin-{targetFormat}`
- `Subscription-Userinfo: upload=...; download=...; total=...; expire=...`
- `Profile-Update-Interval: {UpdateInterval || 24}`
- `Content-Disposition: attachment; filename="..."; filename*=utf-8''...`（内置转换分支）

## 15. 重要维护约束

- API 路由优先于订阅路由，新增订阅短链前缀不能破坏 `/api/*`。
- 浏览器伪装发生在 token 校验前；改动时要避免让未登录浏览器拿到真实节点。
- profile 模式只接受 `profileToken`，全量模式只接受 `mytoken`。
- 聚合缓存不能被空节点覆盖。
- 有 HTTP 订阅源时，只有至少一个远程源真正成功，才应刷新聚合缓存时间。
- 单源缓存只保存真实代理节点，不能保存流量/到期/公告伪节点。
- 第三方转换模式使用 MiSub 预处理后的节点列表作为内联输入，不应回退为原始订阅 URL，除非节点列表为空。
- Meta/Mihomo 链式代理语义应使用 `dialer-proxy`，不要恢复旧 relay 策略组语义。
- Hiddify 兼容模式会影响引擎和模板应用，修改目标格式逻辑时必须保留相关判断。
