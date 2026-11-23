# MiSub 后端技术细节 (Technical Details)

本文档面向开发者，详细说明 MiSub 后端（Cloudflare Pages Functions）的关键技术实现。

---

## 1. 节点处理流水线 (Processing Pipeline)

节点处理主入口是 `functions/services/subscription-service.js#generateCombinedNodeList`，订阅源级治理集中在 `functions/services/subscription-node-transform.js`。完整流程如下：

1. **目标解析 (Target Resolution)**：由 `functions/modules/subscription/profile-handler.js`、`functions/modules/subscription/main-handler.js` 根据订阅组解析机场订阅、手动节点与嵌套子订阅组（`profile.subProfiles`，服务端最多嵌套 3 层），订阅组标识统一经 `profile-resolver.js` 解析（customId > linkId > id）。
2. **节点来源 (Node Source)**：
    - 开启 D1 节点持久化（见第 5 节）时，只读快照 `subscription_node_snapshots`（`getNodeSnapshotForOutput` / `ensureSnapshotForOutput`）；单次请求通过 `lazyInitBudget`（默认 3）限制懒初始化次数。
    - 未开启时由 `functions/modules/subscription/node-fetcher.js` 实时拉取，上游失败或无有效节点时按 `subscription_node_cache` 回退保护性缓存。
    - 快照入库前已应用算子链与过滤，输出链路不再重复转换，避免重命名类算子被叠加两次。
3. **清洗与过滤 (Cleaning / Filtering)**：`fixNodeUrlEncoding` 修复节点 URL 编码；`functions/modules/utils/node-cleaner.js#parseFilterRuleText` 解析规则文本（`keep:` 前缀的行或 `---` 之后为包含规则，其余为排除规则，两类可同时生效）；`subscription-node-transform.js#applyFilterRules` 按协议 / 名称 / 地区匹配。
4. **算子链 (Operator Chain)**：`subscription-node-transform.js#applySubscriptionTransforms` → `functions/utils/operator-runner.js#runOperatorChain`，详见第 2 节。
5. **格式生成 (Generator)**：按 User-Agent 选择 `functions/modules/subscription/builtin-*-generator.js`（Clash / Sing-Box / Surge / Loon / QuanX / Egern），或走模板管线 `template-pipeline.js` + `template-renderers/*`。

手动节点（非 http(s) URL）与机场订阅共用同一转换中枢；节点分组（`node.group`）、手动节点前缀（`manualNodePrefix`）与分组名前缀（`prependGroupName`）在阶段 1 处理。

---

## 2. 操作符运行引擎 (Operator Runner)

执行引擎位于 `functions/utils/operator-runner.js`，入口为 `runOperatorChain(nodeUrls, operators, context)`：节点先经 `node-transformer.js#nodeUrlsToRecords` 转为记录对象，依次执行启用的算子，最后 `recordsToNodeUrls` 还原为节点 URL。

支持五类算子：`filter` / `rename` / `script` / `sort` / `dedup`。

### 脚本算子与受限表达式 DSL (Script Sandbox)

历史实现基于 `AsyncFunction` 闭包并注入 `$nodes` / `$context` / `$utils`，该入口现已停用：`params.code` / `params.url` 只会打印告警并原样返回节点。脚本算子改为受限声明式 DSL（`functions/utils/expression-dsl.js`），参数为 `params.dsl` 数组，支持：

- `action: 'filter'`：字段比较条件过滤。
- `action: 'rename'`：模板渲染重命名。

DSL 不使用 `eval` / `new Function`，只提供声明式模板、字段比较与少量辅助函数（如 `upper` / `lower` / `title` 一类），渲染上下文包含节点字段、`index`、`target` 等，不暴露任意宿主对象。这既便于审计，也避免了无限循环等恶意脚本。

### 排序与去重 (Sort / Dedup)

- **排序**：`sort` 读取 `params.keys`，由 `node-transformer.js#makeComparator` 生成比较器，支持 `name` / `region` / `protocol` / `group` / `port` / `server` 等键；`region`、`protocol` 支持 `customOrder` 自定义顺序。
- **正则置顶优先级**：`key: 'regex'` 时，`customOrder` 中的正则按规则书写顺序置顶，始终由高到低，不受 `order` 影响；正则预编译时剥离 `g` / `y` 标志，并按「排序键 + 节点名」缓存匹配结果。
- **去重**：`dedup` 默认按 `protocol + server:port` 去重（`includeProtocol !== false`），冲突时保留名称更长者。

### 性能优化

- **Immutable 操作**：算子内部尽量返回新数组，减少对原数组的原地修改。
- **正则预编译与缓存**：正则置顶规则在比较器构建时一次性编译；地区识别正则复用模块级缓存。
- **customOrder 索引**：自定义顺序预建为 `Map`，避免每次比较做线性查找。

---

## 3. 存储适配层 (Storage Adapter)

`functions/storage-adapter.js` 同时支持 KV 与 D1：

- `StorageFactory` 按设置与绑定选择 `KVStorageAdapter` 或 `D1StorageAdapter`，两者都不可用时降级为 `NoopStorageAdapter`。
- KV 模式按全量 key 保存（`misub_subscriptions_v1` / `misub_profiles_v1` / `worker_settings_v1` 等）；D1 模式按行保存 `data` JSON（`subscriptions` / `profiles` / `settings` 表 + `updated_at` 索引），集合读取带 30 秒进程内缓存（写入时失效，返回 `structuredClone` 隔离）。
- `SettingsCache` 提供设置缓存；`DataMigrator` 负责旧 D1（含 legacy `main` 行）检测与迁移。
- 节点持久化使用同文件内的 `D1NodeStore`，采用「单行快照 + 分片」模型，详见第 5 节。

写入语义：D1 侧使用 `batch()` 组合多条语句以减少半写状态；快照写入以 `last_attempt_at` 作为版本号做后写优先（LWW）保护，晚到的旧结果不会覆盖新结果。KV 无事务能力，多 key 更新按顺序写入，失败由调用方重试。

---

## 4. 节点解析逻辑

解析器位于 `functions/modules/utils/node-parser.js`（旧文档中的 `functions/modules/subscription/parser.js` 已不存在）。核心是一个多阶段识别引擎：

1. **候选提取**：`extractValidNodes` 按协议正则（`NODE_PROTOCOL_REGEX`）与 Base64 / YAML / JSON / 行式格式扫描出节点串。
2. **格式分发**：根据关键字识别 Clash YAML（`js-yaml`）、Sing-Box、v2rayN、Surge / Quantumult X 行式格式或 URL Scheme 列表，分别走 `clash-to-url.js`、`singbox-to-url.js`、`v2rayn-parser.js` 等转换器。
3. **协议提取与归一**：`parseNodeList` 逐行提取协议参数，SS2022 走 `ss2022-validator.js` 校验并尝试自动修复，最终归一化为统一的 `ProxyNode` 对象；不在加密算法白名单内的节点会被丢弃。

---

## 5. 节点持久化 (Node Persistence)

开启条件：`env.MISUB_DB` 存在、`settings.storageType === 'd1'`、`settings.enableNodePersistence === true`（`isNodePersistenceEnabled`）。实现位于 `functions/services/node-persistence-service.js` 与 `functions/storage-adapter.js#D1NodeStore`。

- **表结构**（`schema.sql` 与 `storage-adapter.js` 的 DDL）：`subscription_node_snapshots` 每个机场订阅一行（`subscription_id` 主键），记录 `config_fingerprint`、`state`、`nodes_json`、`node_count`、`user_info_json`、`last_success_at`、`last_attempt_at`、`last_error`、`chunk_count`；节点过多时写入 `subscription_node_snapshot_chunks`，单条按 256KB 切片，最多 80 片。老库由 `ensureD1Schema` 幂等建表并补 `chunk_count` 列。
- **配置指纹**：`buildNodeConfigFingerprint` 对 `url`、`customUserAgent`、`fetchProxy`、`plusAsSpace`、`exclude`、`operators`、`nodeTransform` 做哈希；指纹不匹配时输出链路会重新拉取并覆盖本行。
- **刷新与保护**：`refreshSubscriptionSnapshot` 带进程内 refresh lock；失败只更新元数据并保留已有节点，退避期内不重复拉取同一机场；上游返回空节点或节点数骤降（`isSuspiciousNodeCountDrop`）按失败处理，不用空快照覆盖旧数据。
- **启用即全量回填**：保存设置开启持久化时调用 `startNodeBackfill`，把所有远程订阅写入 `nodePersistenceBackfill` 状态机；每批 6 个（`BACKFILL_BATCH_SIZE`），通过内部路由 `POST /api/internal/node-backfill`（`x-misub-backfill-token`）自触发下一批，页面关闭也能继续；Cron 完成全量刷新后由 `completeNodeBackfill` 收尾。
- **定时刷新**：`maybeRefreshDueNodes` 按 `autoUpdateInterval` 判断到期，跳过 `autoUpdate === false` 的机场，并通过 `waitUntil` 异步执行。

---

## 6. 订阅标识与组合订阅嵌套 (Profile Identity & Nesting)

- **三层标识**：`functions/modules/subscription/profile-resolver.js` 是唯一解析入口，公开入口优先级为 customId > linkId > id；内部入口 `resolveInternalProfile` 保持宽松匹配，供嵌套子组、外部管理 API 与后台引用使用。
- **linkId 规则**：`functions/modules/profile-alias.js` 定义校验规则——只允许 `[a-z0-9_-]`，customId 长度 2..32、linkId 长度 2..64，保存前统一转小写，二者在全局范围内互斥；linkId 由系统生成（UUID，36 位）。
- **退役与兼容**：订阅组设置 customId 后，其主键与 linkId 不再可访问（issue #538）；升级时通过 `ensureProfileLinkIds` 为存量订阅组补齐 `linkId = 原 id`（幂等），旧订阅链接不断链；重置 linkId 后旧值立即失效。
- **组合订阅嵌套**：订阅组通过 `subProfiles` 引用其它订阅组，服务端最多嵌套 3 层，并用访问集合拦截循环引用；前端 `src/utils/profile-graph.js#wouldCreateCycle` 在保存前做环检测。
- **包含与剔除规则共存**：单条规则文本即可同时包含两类规则（`keep:` 行或 `---` 之后为包含，其余为排除），由 `parseFilterRuleText` 统一解析。
- **单机场禁用自动更新**：仅显式 `autoUpdate === false` 视为暂停（`functions/utils/auto-update.js`，历史数据默认开启）。自动到期刷新、批量刷新与外部 API 批量刷新会跳过暂停机场；Cron 路由是独立于 `autoUpdateInterval` 的强制刷新通道。

---

## 7. 外部管理 API 与 WebDAV 备份

- **外部管理 API**：入口 `functions/modules/external-api-router.js`，基址 `/api/ext/v1`，先由 `external-api-auth.js` 校验 Bearer Token（需在设置中开启外部 API 且 token 匹配）。
    - `/subscriptions`、`/subscriptions/validate`、`/subscriptions/batch-refresh`、`/subscriptions/:id`、`/subscriptions/:id/refresh`
    - `/manual-nodes`、`/manual-nodes/validate`、`/manual-nodes/:id`
    - `/profiles`、`/profiles/:id`、`/profiles/:id/preview`、`/profiles/:id/refresh`、`/profiles/:id/(subscriptions|manual-nodes)`
    - DTO 由 `external-api-mappers.js` 生成，分页与错误结构在 `external-api-utils.js`；开启节点持久化时，列表/详情通过 `decorateSubscriptionsWithSnapshots` 叠加快照，节点数与流量以快照为唯一事实源。
- **WebDAV 备份**：`functions/modules/webdav-backup-handler.js`，路由 `/api/backup/webdav/{status,test,run,list,restore}`，另有 `/api/backup/{export,restore}`。备份按业务域导出（`misub-backup` v1，scope 可选 `dataOnly` / `dataAndSettings`），默认文件名 `misub-backup-{datetime}.json`，时间按北京时间（UTC+8）生成，默认保留 7 份；WebDAV 凭据与运行时密钥不写入备份内容。

---

## 8. 定时任务与刷新口径

- **Cron 路由**：`functions/[[path]].js` 中的 `/cron` 使用设置里的 `cronSecret` 校验（`Authorization: Bearer <secret>` 或 `?secret=`），通过后调用 `functions/modules/notifications.js#handleCronTrigger`。该入口要求 D1 + 节点持久化已开启，逐个调用 `refreshSubscriptionSnapshot`（`reason: 'cron'`），是独立于 `autoUpdateInterval` 的强制刷新通道。
- **管理接口**：`/api/cron/status` 返回持久化开关与执行状态；`/api/cron/trigger` 校验持久化后调用 `_schedule.js#performSubscriptionSync`，并顺带运行 `scheduled-task-runner.js` 中的定时任务。
- **刷新口径统一**：Cron、手动刷新（`/api/node_count`）、批量刷新（`/api/batch_update_nodes`）以及外部 API 针对已存在订阅的 validate / refresh / batch-refresh，最终都落到 `refreshSubscriptionSnapshot`（快照的唯一写入实现）；读取侧再以快照回填节点数与 `userInfo`，避免各通道各写一份。
- **遗留实现**：`functions/_schedule.js` 仍使用旧绑定（`env.KV_STORAGE` / `env.DB`）与 `auto_sync` 列，与当前 `MISUB_DB` / row-level D1 体系不一致；`functions/_cron.js` 同属旧 Cron Triggers 实现。治理建议见 `docs/codebase-review.md`，勿作为生产主链路依据。
