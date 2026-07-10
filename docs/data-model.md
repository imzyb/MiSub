# MiSub 数据模型与存储说明

本文记录 MiSub 当前代码中的数据模型、前后端字段约定与 KV/D1 存储映射。目标是描述现状，帮助后续维护时判断字段来源、读写入口和迁移边界；不作为历史变更记录。

## 1. 数据入口总览

MiSub 的核心持久化数据分为四类：

- 订阅源与手动节点：前端称 `subscriptions`，接口载荷称 `misubs`。
- 订阅组：前后端均称 `profiles`。
- 全局设置：后端称 `settings`，前端 Pinia 中以 `config` 暴露。
- 自定义规则模板：`ruleTemplates`，用于模板输出链路。

主要接口：

- `GET /api/data`：一次性读取 `misubs`、`profiles`、`ruleTemplates`、`config`。
- `POST /api/misubs`：保存订阅源/手动节点与订阅组，支持全量保存和 `diff` 增量保存。
- `GET /api/settings`：读取全局设置。
- `POST /api/settings`：保存全局设置，并同步 KV/D1 设置副本。
- `GET /api/rule_templates`：读取自定义规则模板。
- `POST /api/rule_templates`：保存自定义规则模板。

关键代码入口：

- 前端数据 Store：`src/stores/useDataStore.js`
- 前端默认设置：`src/constants/default-settings.js`
- 订阅表单：`src/composables/useSubscriptionForms.js`
- 订阅组逻辑：`src/composables/useProfiles.js`
- API 路由：`functions/modules/api-router.js`
- API 处理器：`functions/modules/api-handler.js`
- 存储适配器：`functions/storage-adapter.js`
- Worker 默认设置：`functions/modules/config.js`
- 订阅组输出链路：`functions/modules/subscription/profile-handler.js`
- 自定义规则模板：`functions/modules/rule-template-handler.js`

## 2. 存储键与 D1 表

### KV 模式

KV 使用固定 key 存 JSON：

- `misub_subscriptions_v1`：订阅源与手动节点数组。
- `misub_profiles_v1`：订阅组数组。
- `worker_settings_v1`：全局设置对象。
- `misub_rule_templates_v1`：自定义规则模板数组。
- `misub_profile_download_count_<profileIdOrCustomId>`：订阅组下载计数。
- `misub_guestbook_v1...`：留言板相关数据，按设置表兼容逻辑处理。

### D1 模式

D1 当前采用“行级 JSON”结构：

- `subscriptions`
  - `id TEXT PRIMARY KEY`
  - `data TEXT NOT NULL`：单个订阅源或手动节点 JSON。
  - `created_at DATETIME`
  - `updated_at DATETIME`
- `profiles`
  - `id TEXT PRIMARY KEY`
  - `data TEXT NOT NULL`：单个订阅组 JSON。
  - `created_at DATETIME`
  - `updated_at DATETIME`
- `settings`
  - `key TEXT PRIMARY KEY`
  - `value TEXT NOT NULL`：设置、下载计数、留言板、自定义规则模板等 JSON 或字符串值。
  - `created_at DATETIME`
  - `updated_at DATETIME`

兼容点：

- 旧 D1 结构可能把整个订阅数组写在 `subscriptions.id = 'main'`，整个订阅组数组写在 `profiles.id = 'main'`。
- `DataMigrator.migrateLegacyD1MainRows()` 会把旧的 `main` 数组拆成行级数据，再删除 `main` 行。
- `_parseKey()` 对 `misub_subscriptions_v1`、`misub_profiles_v1`、`worker_settings_v1` 仍映射到 D1 的 `main` 兼容行；但常规读写优先使用 `getAllSubscriptions()`、`putSubscription()`、`getAllProfiles()`、`putProfile()` 等行级方法。

## 3. 订阅源与手动节点模型

前端 Store 中的集合名是 `subscriptions`，后端接口载荷中称为 `misubs`。同一个数组同时容纳两种项目：

- HTTP/HTTPS URL：订阅源。
- 非 HTTP URL：手动节点，例如 `vmess://`、`vless://`、`trojan://`、`ss://` 等。

常见字段：

- `id`：唯一 ID，前端由 `generateSubscriptionId()` 或 `generateNodeId()` 生成。
- `name`：显示名称；手动节点输出时会作为节点名写回 URL。
- `url`：订阅链接或节点链接。
- `enabled`：是否启用。
- `group`：分组名，可为空。
- `sortIndex`：保存时后端按数组顺序写入，用于 D1 行级排序恢复。
- `notes`：备注。

订阅源常见字段：

- `exclude`：排除规则，拉取节点时传入 `fetchSubscriptionNodes()`。
- `customUserAgent`：单个订阅源自定义 User-Agent。
- `fetchProxy`：拉取订阅时使用的代理。
- `enableNodeCache`：是否保留该订阅源节点缓存。
- `plusAsSpace`：拉取订阅时是否把 `+` 视为空格。
- `website`：订阅源网站/来源信息。
- `userInfo`：运行时或历史流量信息，可能包含 `upload`、`download`、`total`、`expire`。

手动节点常见字段：

- `url`：节点原始 URL，通常不是 `http(s)`。
- `group`：手动节点分组。
- `status`：导入/检查状态，批量导入时默认 `unchecked`。

运行时字段：

- `isUpdating`：前端临时状态。`saveData()` 保存前会剔除，不应作为持久字段依赖。

读写行为：

- `GET /api/data` 返回 `misubs`。
- 前端 `hydrateFromData()` 将 `data.misubs` 写入 `subscriptions`，并给每项补 `isUpdating: false`。
- `POST /api/misubs` 保存时后端为每项补 `sortIndex`。
- KV 模式下保存整个数组到 `misub_subscriptions_v1`。
- D1 模式下优先逐行 upsert/delete；不支持行级处理时回退到兼容主 key 写入。

## 4. 订阅组 Profile 模型

订阅组用于把多个订阅源和手动节点组合成一个可分享输出入口。

常见字段：

- `id`：唯一 ID，前端由 `generateProfileId()` 生成。
- `name`：订阅组名称。
- `customId`：自定义公开 ID；分享链接优先使用它，否则使用 `id`。
- `enabled`：是否启用。
- `isPublic`：是否在公开页面展示。
- `subscriptions`：订阅源 ID 列表；兼容对象数组，后端会取对象的 `id`。
- `manualNodes`：手动节点 ID 列表。
- `sortIndex`：保存时按数组顺序写入。
- `downloadCount`：展示用下载次数；读取时会从 `misub_profile_download_count_<id>` 叠加。
- `expiresAt`：订阅组过期时间。

输出与转换相关字段：

- `transformConfigMode`：转换模板来源模式，如 `global`、`preset`、`custom_template` 等。
- `transformConfig`：转换模板地址或模板引用。
- `ruleLevel`：规则等级；保存时会把旧字段 `clashRuleLevel` 归一到 `ruleLevel` 并删除旧字段。
- `operators`：新版操作符链。
- `nodeTransform`：旧版节点转换配置或包含操作符的转换配置。
- `nodeTransformPresetId`：引用全局 `settings.nodeTransformPresets` 中的预设。
- `prefixSettings`：订阅组级前缀配置，覆盖或继承全局默认。
- `subconverter`：订阅组级转换器设置，覆盖或继承全局默认。
- `skipCertVerify` / `skipCertificateVerify` / `settings.builtinSkipCertVerify` / `settings.transformBackendScv`：公开预览和转换链路中兼容的跳过证书校验来源。

Profile 输出链路：

1. 通过 `profileId` 查找 `id` 或 `customId` 匹配的订阅组。
2. 若订阅组不存在或 `enabled === false`，返回 404。
3. 按 `profile.subscriptions` 与 `profile.manualNodes` 的顺序收集关联项目。
4. HTTP 订阅源调用 `fetchSubscriptionNodes()` 拉取节点。
5. 手动节点直接解析，必要时用自定义名称写回 URL。
6. 若启用转换，优先执行：`profile.operators` → `profile.nodeTransform.operators` → `settings.defaultOperators` → 旧版 `nodeTransform` 适配链。
7. 输出节点列表、统计信息以及后续模板转换所需数据。

## 5. 全局 Settings 模型

设置由前端默认值和 Worker 默认值共同定义，读取时通过 `{ ...defaultSettings, ...settings }` 合并。

核心字段：

- `FileName`：默认输出文件名。
- `mytoken`：单订阅输出 token，默认 `auto`。
- `profileToken`：订阅组分享 token，默认 `profiles`。
- `storageType`：当前存储类型，`kv` 或 `d1`。
- `transformConfigMode`：全局转换模板模式。
- `transformConfig`：全局转换模板地址或引用。
- `ruleLevel`：全局规则等级。
- `builtinSkipCertVerify`：内置转换输出是否跳过证书校验。
- `builtinEnableUdp`：内置转换输出是否启用 UDP。
- `builtinLoonSkipCertVerify`：Loon 输出相关证书校验选项。
- `enableAccessLog`：是否启用访问日志。
- `accessLogPersistenceMode`：访问日志持久化模式。
- `NotifyThresholdDays`：到期提醒阈值。
- `NotifyThresholdPercent`：流量提醒阈值。
- `enableTrafficNode`：是否启用流量节点。
- `enableFlagEmoji`：是否启用国旗 emoji。
- `enablePublicPage`：是否启用公开页。
- `autoUpdateInterval`：自动更新间隔，`0` 表示禁用。

节点与转换相关字段：

- `defaultPrefixSettings`：默认前缀设置。
  - `enableManualNodes`
  - `enableSubscriptions`
  - `manualNodePrefix`
  - `subscriptionPrefix`
  - `prependGroupName`
- `defaultOperators`：全局默认操作符链。
- `defaultNodeTransform`：旧版节点转换配置，已被 `defaultOperators` 取代但仍需兼容。
- `nodeTransformPresets`：节点转换预设列表。
- `subconverter`：订阅转换配置。
  - `engineMode`
  - `defaultBackend`
  - `defaultOptions.udp`
  - `defaultOptions.emoji`
  - `defaultOptions.scv`
  - `defaultOptions.tfo`
  - `defaultOptions.sort`
  - `defaultOptions.list`

页面与交互相关字段：

- `announcement`：公告配置。
- `guestbook`：留言板配置。
- `customPage`：自定义公开页配置。

扩展/运行相关字段：

- `enableSubscriptionSync`
- `subscriptionCacheExpireMinutes`
- `enableTrafficMonitor`
- `enableTemplateEngine`
- `enableEnhancedLogging`
- `maxSubscriptionConcurrency`
- `defaultUserAgent`
- `externalApi`
  - `enabled`：是否启用 `/api/ext/v1/*` External Management API。
  - `tokens[]`
    - `name`：token 标签名。
    - `token`：Bearer Token 明文。
- `isDefaultPassword`：只在 `GET /api/data` 返回时动态附加，不是持久设置字段。

保存规则：

- `POST /api/settings` 会读取旧设置后与新设置浅合并。
- `customLoginPath`、`mytoken`、`profileToken` 会校验保留路径，避免与系统路由冲突。
- 设置保存后会清除 `SettingsCache` 和节点缓存。
- 设置保存时会尽量同步到 D1 和 KV，以保持双存储环境一致。

## 6. 自定义规则模板模型

自定义规则模板通过 `misub_rule_templates_v1` 存储，D1 模式下会落在 `settings` 表的同名 key。

字段：

- `id`：模板 ID，清洗后仅允许字母、数字、`_`、`-`，最长 80。
- `name`：模板名称，最长 80。
- `description`：描述，最长 300。
- `type`：当前固定为 `ini`。
- `content`：模板内容，最长 128 KiB，必须具备 ini 形态。
- `enabled`：是否启用。
- `createdAt`：创建时间。
- `updatedAt`：更新时间，保存时刷新。

限制：

- 最多保存 50 个模板。
- 内容必须匹配 `[custom]`、`[proxy group]`、`[rule]`、`[ruleset]` 或 `[proxy]` 等 ini 结构。

## 7. 前后端命名差异

需要特别注意的命名差异：

- 前端 Store：`subscriptions`。
- 后端 API 载荷：`misubs`。
- KV key：`misub_subscriptions_v1`。
- D1 表：`subscriptions`。

因此维护时不要简单用变量名判断业务含义。当前代码里 `subscriptions` 数组不只包含 HTTP 订阅，也包含手动节点。

## 8. External Management API 的对外 DTO

External Management API（`/api/ext/v1/*`）不会直接暴露内部混合数组语义，而是拆成三类资源：

- `subscriptions`：只表示远程订阅源，要求 `url` 为 `http(s)`。
- `manual-nodes`：只表示手动节点，要求 `url` 为受支持的节点协议。
- `profiles`：对外固定返回 `subscriptionIds` 与 `manualNodeIds`，不暴露内部 `subscriptions` / `manualNodes` 字段名。

当前轻量预览接口 `POST /api/ext/v1/profiles/:id/preview` 返回：

- `profile`：对外 Profile DTO
- `counts.subscriptions`：远程订阅源数量
- `counts.manualNodes`：手动节点数量
- `counts.totalNodes`：当前实现等于手动节点数量
- `byProtocol`：手动节点按协议统计
- `sources`：订阅源/手动节点摘要

## 9. 数据一致性与维护注意事项

- `isUpdating` 是前端临时字段，保存前剔除。
- `sortIndex` 是后端保存时补充的排序字段，D1 行级读取会按它排序。
- `downloadCount` 主要从独立计数 key 附加，不应只看 profile JSON 内的值。
- `profile.subscriptions` 兼容字符串 ID 数组和对象数组，但新代码应优先保存 ID 数组。
- `clashRuleLevel` 是旧字段，保存时会归一为 `ruleLevel`。
- `defaultNodeTransform` 与 `profile.nodeTransform` 的旧结构仍被输出链路兼容；新功能应优先走 `operators` / `defaultOperators`。
- KV 模式的订阅源和订阅组保存是全量覆盖；D1 模式优先行级 upsert/delete。
- `worker_settings_v1` 是决定 `storageType` 的关键设置；读取存储类型时会优先通过 `SettingsCache` 查询设置。
- 修改设置、订阅源或订阅组后，相关节点缓存会被清理；开启 `enableNodeCache` 的订阅源可在部分保存路径中保留节点缓存。
