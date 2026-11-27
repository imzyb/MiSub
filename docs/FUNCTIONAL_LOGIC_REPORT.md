# MiSub 功能逻辑报告

> 目的：逐项说明当前代码库「实际怎么跑」的逻辑，便于对照需求核对。
> 范围：Cloudflare Pages Functions 后端 + Vue 前端；重点标注本次「节点持久化 / 更新检查」改造。
> 约定：每条包含 **入口**、**规则**、**边界/取舍**、**状态**（✅ 已实现 / ⚠️ 已知限制 / ❓ 待确认）。

---

## 0. 结论摘要

| 需求                                             | 实现状态                        |
| ------------------------------------------------ | ------------------------------- |
| 机场订阅是唯一数据来源入口，入库前按订阅设置过滤 | ✅                              |
| 一个订阅在库中只保留最后一次数据                 | ✅ 单行主键                     |
| 启用持久化 = 立刻全量拉取（等于一次 Cron）       | ✅ 内部接口链推进，关页面也继续 |
| 未启用持久化：每次订阅实时拉取、不回写           | ✅                              |
| 自动更新不是定时器，是"操作触发 + 比对时间"      | ✅ 文案与实现一致               |
| 订阅组输出、预览、卡片、外部 API 数字同源        | ✅ 快照唯一事实源               |
| 关闭"流量与到期时间节点"后不再出现伪节点         | ✅ 含旧缓存失效                 |
| Cron 仅在 D1 + 持久化时可用，且尊重单机场开关    | ✅                              |
| 预览来源可见（实时拉取 / D1 已保存节点）         | ✅                              |
| 孤儿快照                                         | ✅ 结构上不存在（单行覆盖）     |

---

## 1. 总体架构与请求入口

`functions/[[path]].js` 是所有请求的唯一入口，按路径分派：

| 路径                                           | 处理                                      | 说明                                 |
| ---------------------------------------------- | ----------------------------------------- | ------------------------------------ |
| `/api/*`                                       | `handleApiRequest(request, env, context)` | 管理 API、外部管理 API、内部回填接口 |
| `/sub/*`、`/{mytoken}`、`/{profileToken}/{id}` | `handleMisubRequest(context)`             | 订阅输出（节点/多格式）              |
| `/cron`                                        | `handleCronTrigger(env)`                  | 外部定时器触发入口，需 `cronSecret`  |
| 其他 SPA 路由                                  | 静态资源 + `index.html` fallback          | `/dashboard/*` 等                    |

关键顺序：

1. 读取 settings（`SettingsCache`）并 `migrateConfigSettings`。
2. API 路由；否则判断订阅路由；否则 `/cron`；否则静态资源。
3. 浏览器访问 + 伪装开启 + 未登录 → 返回伪装页面（品牌资源 `logo/favicon` 也受保护）。

---

## 2. 存储与能力检测

- 统一入口 `StorageFactory`（`functions/storage-adapter.js`）：
    - KV：整份 JSON；
    - D1：行级（`subscriptions`/`profiles`/`settings` + `subscription_node_snapshots`）。
- `SettingsCache`：D1 优先、KV 兜底，内存缓存 10 秒。
- 能力判定：
    - `isNodePersistenceAvailable(env, settings)` = 有 `MISUB_DB` 且 `storageType === 'd1'`；
    - `isNodePersistenceEnabled` = 上者 + `enableNodePersistence === true`。
- `/api/settings`、`/api/data` 都会返回 `capabilities`，前端据此启用/禁用开关（禁用时给橙色原因，无问号）。

---

## 3. 机场订阅（数据源）

### 3.1 数据模型

`subscriptions` 每行是一条机场订阅：`url`、`name`、`enabled`、`customUserAgent`、`fetchProxy`、`exclude`、`operators`、`nodeTransform`、`enableNodeCache`、`autoUpdate`、运行时字段（`nodeCount`/`userInfo`/`lastUpdate`）。

### 3.2 拉取流程（`fetchSingleSubscription`）

1. UA：`customUserAgent` → `getProcessedUserAgent`；
2. `fetchProxy` 包装请求；
3. `assertPublicNetworkUrl` 防 SSRF；
4. 超时 18s、最多重试 2 次；
5. `arrayBuffer` → UTF-8 → 必要时 base64 → `parseNodeList`；
6. 只保留真实代理协议（`isRealProxyNode`）；
7. 解析响应头 `subscription-userinfo` 作为流量/到期。

### 3.3 订阅级治理（唯一入口）

`functions/services/subscription-node-transform.js`：

```
operators（算子链） → include/exclude 文本过滤
```

- 实时输出与持久化入库**都调用同一个函数**；
- 规则解析复用 `node-cleaner.parseFilterRuleText`（`---` 分隔、`keep:` 前缀）；
- 入库后再输出时**不会二次执行**（避免重命名被叠加两次）。

### 3.4 单源保护缓存（`enableNodeCache`）

- 仅非持久化模式使用；
- 只在机场拉取失败/空节点时回退上次缓存；
- 持久化模式下不写入、不读取（改由 D1 快照兜底）。

### 3.5 运行时信息写回规则

- **订阅组访问是只读的**：只写入当前请求 context（供本次响应的流量/到期伪节点使用），不落库；
- 只有显式刷新入口才更新数据：
    - 手动 `POST /api/node_count`；
    - 批量 `POST /api/batch_update_nodes`；
    - Cron；
    - 持久化写入（快照）。
- 持久化模式下也不再写 `subscriptions.nodeCount/userInfo`（快照唯一事实源）。

### 3.6 单机场"禁用自动更新"（`autoUpdate === false`）

- 不参与：访问触发的自动更新、批量刷新、Cron；
- 仍参与：手动单机场刷新、启用持久化时的**首次全量回填**（初始化语义）；
- 订阅组**仍然从 D1 读取它的节点**，不回退实时拉取。

---

## 4. 节点持久化（D1）

### 4.1 启用条件

- 绑定 `MISUB_DB` 且 `storageType === 'd1'`，才允许 `enableNodePersistence = true`；
- 保存设置时若不满足，会强制关闭并把间隔归零。

### 4.2 单行快照模型（`subscription_node_snapshots`）

```sql
subscription_id TEXT PRIMARY KEY,   -- 一个订阅只有一行
config_fingerprint TEXT,            -- 只用于判断"设置是否改了"
state TEXT,                         -- pending / ready / failed
nodes_json TEXT,                    -- 已过滤后的节点
node_count INTEGER,
user_info_json TEXT,
last_success_at, last_attempt_at, last_error,
chunk_count,                         -- >0 表示节点分散在分片表
updated_at
```

- **超大订阅分片**：节点 JSON 超过 256KB 时，自动切成 `subscription_node_snapshot_chunks` 多行（每行一个 JSON 数组，最多 80 片 ≈ 20MB），读取时合并；刷新变小会自动清空分片回退到单行内联。

- **最后写入胜出**：upsert 条件 `excluded.last_attempt_at >= 现有`，晚到的旧刷新不会覆盖新结果；
- 旧复合主键表会被 `ensureD1Schema → migrateLegacySnapshotTable` 自动迁移为单行（保留最新一条）。

### 4.3 入库内容

- 拉取 → 解析 → **按该订阅的 operators + exclude/include 过滤** → 只保留真实节点 → 写入；
- 因此库里不会存"原始垃圾节点"。

### 4.4 启用即全量回填

触发：`enableNodePersistence` 由 false→true（或 storageType 变更到 d1 且开启）。

1. 保存设置时清空 `node_cache_*`；
2. 创建回填任务（`pendingIds` = 所有启用的 HTTP 订阅，**不跳过 `autoUpdate=false`**）；
3. 保存响应的 `waitUntil` 跑第一批（每批 6 个，并发执行）；
4. 若还有剩余，服务端 `fetch` 内部接口 `POST /api/internal/node-backfill`（带 token）继续下一批；
    - 内部接口立刻返回 **202**，批次在自己的 `waitUntil` 里跑，不会把整条链串行化；
    - 跳数上限 60（≈360 个订阅），失败退避 2 分钟，靠后续请求/Cron 续跑；
5. 页面关掉不影响（服务端到服务端请求）。

### 4.5 读取与懒初始化

- 有快照且 `fingerprint` 与当前设置一致 → **直接返回，不请求机场**；
- 无快照或指纹不一致 → 当次请求拉一次并覆盖；
- 单次请求最多初始化 3 个机场（订阅组/预览各自的预算），其余下次继续；
- 失败：保留旧节点，记 `last_attempt_at`，**5 分钟内不重复打机场**。

### 4.6 读取路径（全部同源）

| 场景                         | 行为                                                |
| ---------------------------- | --------------------------------------------------- |
| 订阅组输出                   | 只读快照；绕过聚合缓存；不写聚合缓存                |
| 预览（单机场/订阅组/公开页） | 读快照，返回 `nodeSource`（`persistence` / `live`） |
| `/api/data`                  | 用快照覆盖 `nodeCount/userInfo/lastUpdate`          |
| 外部管理 API                 | 订阅 DTO 前先叠加快照                               |
| 卡片                         | 直接用 `/api/data` 的结果                           |

### 4.7 触发矩阵

| 入口          | 是否检查更新                    | 是否推进回填     |
| ------------- | ------------------------------- | ---------------- |
| `/api/data`   | 是（interval > 0）              | 是               |
| 订阅组访问    | 是                              | 是               |
| 预览          | 是（有 context 走 `waitUntil`） | 否               |
| 手动/批量刷新 | 强制刷新                        | 否               |
| Cron          | 强制全量                        | 收尾（标记完成） |
| 内部接口      | 每批 6 个                       | 是               |

### 4.8 清理

- 删除订阅 → 删除其快照行；
- 启用持久化 → 清空历史 `node_cache_*`（聚合缓存 + 单源缓存）；
- 单行模型下不存在"旧指纹孤儿行"。

---

## 5. "订阅更新检查间隔"的准确语义

**不是定时任务**（免费版 Worker 没有定时能力）。只有满足以下条件才更新：

```
任意后端请求命中
  → 读取快照 last_success_at
  → now - last_success_at >= autoUpdateInterval
  → 且订阅 autoUpdate !== false
  → 后台 waitUntil 刷新
```

- `0` = 不自动更新（仍读 D1，可用 Cron / 手动刷新）；
- 每次触发最多刷 2 个（`DEFAULT_REFRESH_LIMIT`），避免单次请求打满；
- 前端文案已按此口径描述。

---

## 6. 订阅组（Profile）

### 6.1 模型

`profiles`：`id`/`customId`/`linkId`/`name`/`enabled`/`subscriptions[]`/`manualNodes[]`/`subProfiles[]`/`expiresAt`/`prefixSettings`/`operators`/`ruleLevel` 等；链接解析优先级 `customId > linkId > id`，退役标识不可用。

### 6.2 输出链路（顺序固定）

1. 确定目标订阅（本组订阅 + 手动节点 + 嵌套子组）；
2. 拉取或读快照；
3. 组合去空行、去重；
4. 组合级算子链（组 > 全局 > 旧 nodeTransform 桥接）；
5. 组级 include/exclude；
6. 全局 include/exclude；
7. YAML 净化；
8. emoji 处理；
9. 伪节点前置（受总开关控制）。

### 6.3 输出格式

- 明文 `target=nodes`；
- base64；
- 第三方转换（302，内联节点，`|` 分隔）；
- 内置：Clash/Mihomo、Sing-Box、Surge、Loon、Quantumult X、Egern；
- 模板：内置 / 自定义规则模板 / 远程模板；内置失败回退 base64。

### 6.4 聚合缓存

- `node_cache_profile_*` / `node_cache_token_*`：3 分钟新鲜、1 小时可用、最长 12 小时；
- 防截断：节点数骤降、疑似"只剩伪节点"的缓存会被忽略；
- 防空覆盖：空结果不覆盖非空缓存；
- **行为开关指纹**：缓存里记录 `flags.trafficNodes`，与当前设置不一致即视为 miss（解决"关了开关还出伪节点"）；
- `refresh/nocache/debug` 参数强制绕过。

### 6.5 公共页与访问控制

- 公开订阅组需 `isPublic`；未登录访问受 `enablePublicPage` 控制；
- 浏览器 + 伪装开启 + 未登录 → 伪装页。

---

## 7. 流量/到期伪节点

- 总开关：`enableTrafficNode`，**只有 `=== true` 才注入**（缺省/undefined 一律关闭）；
- 数据来源：本次请求的 `userInfo`（持久化模式来自快照）；
- 名称：`流量剩余 ≫ …`、`到期时间 ≫ …`，URL 为 `127.0.0.1` 虚拟节点；
- 订阅组已过期时注入"您的订阅已到期"提示节点（**不受该开关控制**，属产品提示）。

---

## 8. Cron

| 项       | 逻辑                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| 入口     | `GET/POST /cron?secret=…` 或 `Authorization: Bearer`；后台 `POST /api/cron/trigger`（需登录）                    |
| 前置     | 必须 D1 + `enableNodePersistence`；否则 `{success:true, skipped:true, reason:'node_persistence_disabled'}` / 400 |
| 刷新     | 全量刷新所有启用 HTTP 订阅（并发 6，15s 超时）                                                                   |
| 开关尊重 | 跳过 `autoUpdate === false`                                                                                      |
| 结果     | 成功后标记回填任务完成、触发到期/流量通知                                                                        |
| 与间隔   | Cron 不受 `autoUpdateInterval` 限制（间隔 0 也能刷）                                                             |

---

## 9. 管理后台 API 清单（`/api/*`）

`/misubs`、`/data`、`/settings`、`/settings/password`、`/settings/reset`、`/rule_templates`、
`/node_count`、`/batch_update_nodes`、`/subscription_nodes`、`/nodes/health`、`/nodes/clean`、
`/preview/content`、`/parse_subscription`、`/debug_subscription`、`/fetch_external_url`、
`/detect_airport_name`、`/system/info`、`/system/storage_test`、`/system/export`、
`/logs`、`/backup/*`（export/restore/webdav）、`/guestbook/manage`、`/cron/status`、`/cron/trigger`、
`/internal/node-backfill`（仅 token）。

> `/internal/node-backfill` 不走登录态，只校验 `x-misub-backfill-token`（存于 settings 的回填任务里）。

---

## 10. 外部管理 API（`/api/ext/v1`）

- 鉴权：`Authorization: Bearer <token>`，token 列表在 `settings.externalApi`，需 `enabled=true`；
- 资源与动作：
    - `/subscriptions`（列表/创建）、`/:id`（读/改/删）、`/validate`、`/batch-refresh`、`/:id/refresh`；
    - `/manual-nodes`（含 validate、单条）；
    - `/profiles`（列表/创建）、`/:id`、`/:id/preview`、`/:id/refresh`、`/:id/(subscriptions|manual-nodes)`。
- 语义：
    - 批量刷新跳过 `autoUpdate=false`，返回 `skipped[]`；单条 refresh 可强制；
    - 持久化模式下订阅 DTO 会先叠加快照，节点数/流量同源。

---

## 11. 认证与安全

- 管理员密码优先级：`ADMIN_PASSWORD` 环境变量 → KV `SYSTEM_ADMIN_PASSWORD` → 默认 `admin`（默认时前端红条警告）；
- 会话：HMAC 签名 Cookie（`auth_session`），30 天有效，7 天后自动续期；
- CSRF：写操作校验 `Origin` 与请求源；
- CORS：`CORS_ORIGINS` 配置，未配置时仅同源；
- SSRF：`assertPublicNetworkUrl` / `validatePublicFetchUrl` 拦截私网地址；
- 请求体限制：`readJsonWithLimit`（不同路由不同上限）；
- 日志脱敏：token 以 `token:hash` 形式记录；
- 伪装：未登录浏览器返回伪装页，品牌资源同样不暴露。

---

## 12. 通知（Telegram）

- 类型：订阅访问、订阅临期、流量预警、设置变更、Cron 汇总；
- 去重：`lastNotifiedExpire` / `lastNotifiedTraffic` 一天一次；
- Webhook 命令（节选）：`/list`、`/stats`、`/enable`、`/disable`、`/delete`、`/search`、`/sub`、`/rename`、`/info`、`/export`、`/backup`、`/import`、`/sort`、`/dedup`、`/groups`、`/bind` 等。

---

## 13. 备份与恢复

- 导出/导入：JSON 领域级备份（订阅、订阅组、手动节点、规则模板；可选设置）；
- WebDAV：手动/请求触发自动备份（5 分钟节流、10 分钟锁），按保留份数清理；
- 恢复前写入 `misub_restore_snapshot_latest` 快照，可回滚；
- 凭据（WebDAV 密码、token）不写入备份文件。

---

## 14. 日志与统计

- 存储：`misub_system_logs`（D1 下迁移到 settings 表）；
- 上限：200 条 / 30 天；
- 模式：`light`（成功日志 5 分钟去重、错误 1 分钟、每分钟最多 12 条落库）/ `full`；
- 下载计数：`misub_profile_download_count_*`，清空日志时同步归零。

---

## 15. 前端结构与交互

- 路由页面：Home/Explore、Dashboard、机场订阅（groups）、手动节点、我的订阅、设置、公共页、登录入口（Entrance）、404；
- 设置分区：基础、首页、自定义公开页、全局、服务集成、客户端管理、系统；
- 卡片动作：预览、二维码、编辑、删除、更新节点信息；禁用自动更新徽标仅在持久化开启时展示；
- 预览弹窗：标题+来源标签（D1 已保存节点 / 实时拉取）、来源说明条、统计、筛选、列表/卡片视图、提取为手动节点；
- 弹窗/浮层定位：`usePopoverPosition` / `computePopoverPosition` 统一 fixed + 视口翻转（ConfirmPopover 在用）；
- 禁用态说明：统一使用橙色行内文案，不再叠加问号 tooltip。

---

## 16. 关键设置项

| key                                            | 默认          | 影响                              |
| ---------------------------------------------- | ------------- | --------------------------------- |
| `storageType`                                  | `kv`          | 主存储                            |
| `enableNodePersistence`                        | `false`       | 是否从 D1 读节点 / 启用时全量回填 |
| `autoUpdateInterval`                           | `0`           | 操作触发的更新检查阈值（分钟）    |
| `enableTrafficNode`                            | `false`       | 是否注入流量/到期伪节点           |
| `enableAccessLog` / `accessLogPersistenceMode` | false / light | 日志与配额                        |
| `enableFlagEmoji`                              | true          | 节点名 emoji                      |
| `enablePublicPage` / `customPage`              | true / 关     | 公开页                            |
| `disguise`                                     | 关            | 伪装                              |
| `externalApi`                                  | 关            | 外部 API                          |
| `webdavBackup`                                 | 关            | 备份                              |
| `subconverter`                                 | 内置          | 转换引擎                          |

---

## 17. 已知限制 / 待确认

1. **单行覆盖的必然结果**：改了订阅的过滤/算子后，在新数据拉回来之前，输出仍使用旧快照（指纹不一致会触发重刷）。
2. **内部接口自调用**依赖同域可达；生产自定义域若有 WAF 需实测（本地已验证 202 链）。
3. **预览触发的到期刷新**依赖 API 传入的 `context.waitUntil`；无 context 时退化为 best-effort。
4. **"您的订阅已到期"节点**不受 `enableTrafficNode` 控制（产品提示）。
5. **外部 API 的 DTO** 依赖快照装饰；若直接读 D1 表会看到旧的 `subscriptions.nodeCount`。
6. **超大订阅**：已实现自动分片（256KB/片、最多 80 片），单订阅约可容纳 20MB 节点数据；超过上限会刷新失败并保留旧快照。
7. **跨实例并发**靠 SQL 条件写（LWW）兜底，内存锁只在单实例内有效。

---

## 18. 本次验证矩阵

| 层         | 方式                                                           | 结果                             |
| ---------- | -------------------------------------------------------------- | -------------------------------- |
| 单测       | `vitest` 187 文件 / 1169 用例                                  | 全通过                           |
| 构建       | `vite build`                                                   | 通过                             |
| UI         | Playwright：PC 6 页 + 5 设置分区；移动 3 页 + 2 分区           | 无溢出、无控制台错误、无失败请求 |
| API        | 管理 API / Cron 门槛 / 外部 API 鉴权 / 持久化开关              | 全部符合预期                     |
| 持久化链路 | Miniflare + 真实 dev：迁移、过滤入库、只读快照、LWW、回填 2 批 | 全部通过                         |
