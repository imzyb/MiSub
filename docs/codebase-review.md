# MiSub Codebase Review

本文记录当前代码库的只读梳理结果，用于后续按“小步、可逆、可验证”的方式持续治理。

## 当前健康状态

- 全量测试通过：190 个测试文件 / 1184 个用例（`npm run test:run`，测试全部位于 `tests/unit`）。
- 生产构建成功：`npm run build`（Vite 7）。
- 当前版本：`package.json` 为 2.8.0（发布版本）。
- 本轮只做文档校对：按 2.8.0 的源码现状更新描述，不改业务逻辑。

## 代码规模

| 区域        | 文件数 |   行数 | 说明                                                   |
| ----------- | -----: | -----: | ------------------------------------------------------ |
| `src`       |    237 | 49,289 | Vue 前端、状态管理、组件、协议工具（106 JS / 131 Vue） |
| `functions` |    103 | 37,997 | Cloudflare Pages Functions 后端                        |
| `tests`     |    191 | 28,415 | Vitest 单元/回归测试（190 个 `*.test.js` + setup.js）  |
| `docs`      |     20 |  4,690 | 架构、数据模型与运维文档                               |

主要源码语言：JavaScript 与 Vue 单文件组件。

## 后端模块地图

### 入口与路由

- `functions/[[path]].js`：Cloudflare Pages Functions 主入口，挂载安全中间件、API 路由、订阅短链（`/sub/` 与自定义 mytoken/profileToken）、`/cron`（cronSecret 校验）、静态资源 fallback，以及伪装模式下的品牌资源拦截。
- `functions/modules/api-router.js`：`/api/*` 总路由，负责公开接口、认证接口、外部管理 API（`/ext/v1`）、内部回填接口（`/internal/node-backfill`）、迁移接口与受保护的管理接口分发。
- `functions/modules/api-handler.js`：核心数据读写、settings、profiles、misubs 保存与公开配置；开启节点持久化时会触发全量回填与到期刷新。

### 节点持久化

- `functions/services/node-persistence-service.js`：D1 单行快照的生命周期——配置指纹、刷新锁与退避、输出链路懒初始化、启用即全量回填（内部接口链 + token 校验）、Cron 完成标记。
- `functions/storage-adapter.js` 中的 `D1NodeStore`：单行快照 + 256KB 分片（最多 80 片）、以 `last_attempt_at` 为版本号的 LWW 写入、失败保留旧节点、老库建表与补列。
- `functions/services/subscription-node-transform.js`：机场订阅级节点治理唯一入口（算子链 + include/exclude），订阅输出与持久化写库共用，保证库里存的是用户设置后的结果。

### 存储层

- `functions/storage-adapter.js`：KV / D1 / Noop adapter、`SettingsCache`、`DataMigrator`、`D1NodeStore`。
- 当前数据形态兼容 KV 全量数组、D1 行级 JSON、旧 D1 `main` 行，以及新增的快照/分片表。
- 风险：兼容逻辑复杂，旧结构与 row-level 结构、快照并存时需要诊断能力支撑。

### 订阅主链路

- `functions/modules/subscription/main-handler.js`：订阅请求主流程，负责标识解析、浏览器伪装、目标节点集合（含嵌套子订阅组）、缓存、内置/外部转换、响应输出、下载计数和通知。
- `functions/modules/subscription/profile-handler.js`：公开预览的订阅组模式，负责嵌套子组（`subProfiles`）与循环引用拦截。
- `functions/modules/subscription/single-subscription.js`：单订阅 / 单节点预览的节点来源（持久化开启时读快照）。
- `functions/services/subscription-service.js`：远程订阅拉取、手动节点、per-sub 缓存、过滤、去重、operator chain、运行态信息写回。
- `functions/modules/subscription/node-fetcher.js`：单订阅拉取与保护性缓存回退。
- `functions/services/node-cache-service.js`：节点缓存读写、清理、保护性空覆盖防护。

### 协议转换与模板

- `functions/utils/url-to-clash.js`：URL 节点转 Clash proxy，体量最大、协议分支多。
- `functions/utils/clash-to-url.js`：Clash proxy 转 URL 节点。
- `functions/modules/utils/node-parser.js`：节点文本、Base64、Clash YAML、Sing-Box、v2rayN、Surge/QuanX 与 raw line 解析。
- `functions/modules/subscription/builtin-*-generator.js`：Clash / Sing-box / Surge / Loon / QuanX / Egern 内置输出。
- `functions/modules/subscription/template-pipeline.js` 与 `template-renderers/*`：模板模型与多目标渲染。

### 外部管理 API

- `functions/modules/external-api-router.js`：`/api/ext/v1` 路由，覆盖 subscriptions / manual-nodes / profiles 及 validate、refresh、batch-refresh、preview 等动作。
- `functions/modules/external-api-auth.js`：Bearer Token 鉴权（需在设置中开启外部 API）。
- `functions/modules/external-api-utils.js`、`external-api-mappers.js`：分页、错误结构、DTO 映射。
- `functions/modules/external-*-handler.js`：订阅、手动节点、订阅组、预览四个业务处理器；开启持久化时列表叠加快照。

### 备份

- `functions/modules/webdav-backup-handler.js`：WebDAV 备份 / 恢复与本地导出 / 恢复（`/api/backup/webdav/*`、`/api/backup/export`、`/api/backup/restore`），按业务域导出、不写入凭据。

### 定时与通知

- `functions/modules/notifications.js`：当前 `/cron` 使用的主定时检查逻辑（`handleCronTrigger`），要求 D1 + 节点持久化开启，强制刷新快照。
- `functions/modules/scheduled-task-runner.js`：`/api/cron/trigger` 触发的定时任务执行。
- `functions/_cron.js`、`functions/_schedule.js`：遗留定时实现，使用旧绑定（`env.KV_STORAGE` / `env.DB`）与 `auto_sync` 列；`/api/cron/trigger` 仍导入 `_schedule.js#performSubscriptionSync`，需要收敛，避免误用。
- `functions/cron-dashboard.js`：`/cron-dashboard` 管理面板；其「手动触发同步」目前只返回占位成功响应，并未真正调用同步逻辑，属历史遗留，需与真实 Cron 入口对齐。
- `functions/utils/auto-update.js`：`autoUpdate` 语义（仅显式 `false` 视为暂停自动更新）。

### 安全与公开接口

- `functions/modules/auth-middleware.js`：HMAC cookie 登录会话、30 天闲置过期与 7 天活动续期、auth diagnostic 开关。
- `functions/middleware/cors.js`：CORS、CSRF origin/referrer、安全响应头。
- `functions/modules/security-utils.js`：敏感字段脱敏、公开 fetch SSRF 防护、redirect 重新校验。
- 公开接口包括 public profiles/preview/guestbook/error report/Telegram webhook/GitHub release proxy，以及外部管理 API 与内部回填接口，需要持续关注体积限制和滥用风险；请求体统一走 `readJsonWithLimit` + `JSON_BODY_LIMITS`。

## 前端模块地图

### Views

- `src/views/DashboardView.vue`：主控制台页面容器。
- `src/views/PublicProfilesView.vue`：公开订阅页，包含 hero/custom page/clients/guestbook/quick import 等逻辑，仍是 view 层复杂热点。
- `src/views/ManualNodesView.vue`、`SubscriptionGroupsView.vue`、`MySubscriptionsView.vue`、`SettingsView.vue`：分别承载手动节点、订阅组、我的订阅、设置入口。
- `src/views/HomeView.vue`、`Entrance.vue`、`NotFound.vue`：首页、入口与 404 页面。

### Components

- `src/components/ui/*`：基础组件（Button/Card/Input/Switch/ConfirmDialog/ConfirmPopover/GroupSelector/SavePrompt/ProgressiveDisclosure 等），承载全站交互与无障碍基线。
- `src/components/modals/*`：编辑、导入、节点预览、二维码、留言、设置、迁移、手动节点分组管理与批量分组等弹窗。
- `src/components/settings/sections/*`：设置页面各分区，其中 `ClientSettings.vue`、`BasicSettings.vue`、`TelegramCard.vue` 较大。
- `src/components/features/Dashboard/*` 与 `src/components/features/Operators/*`：Dashboard 分块与算子链编辑器（Filter/Rename/Sort/Dedup）。
- `src/components/shared/*`：DataGrid、DragDropList、FilterPanel 等通用复杂组件。
- `src/components/public/*`：公开页面渲染、ProfileGrid、自定义公开页。
- `src/components/nodes/*`、`profiles/*`、`subscriptions/*`：手动节点面板、订阅组面板与订阅面板（机场分组折叠与批量操作）。

### 状态与组合式函数

- `src/stores/useDataStore.js`：主数据状态与保存入口，是前端状态热点。
- `src/stores/` 其余 store：editor、session、settings、theme、toast、ui、version。
- `src/composables/*`：业务状态与 API 调用封装（useSubscriptions / useManualNodes / useProfiles / useNodePreview / useConfirm 等），以及 `manual-nodes/` 下的 dedup、filters、groups、sorting 等纯逻辑模块。
- `src/lib/api.js`、`src/lib/http.js`：API facade 与 HTTP 封装。

### i18n 与全局交互

- `src/i18n/index.js` + `src/i18n/messages.js`：全站中英双语（默认 zh-CN、可选 en-US），支持 `misub:locale` 持久化、浏览器语言探测与缺失 key 回退；语言切换入口为 `LanguageSwitcher.vue`，由 `tests/unit/i18n-contract.test.js` 等契约测试约束。
- 全局确认弹窗：`src/composables/useConfirm.js`（Promise 化、同一时刻只挂一个待确认项、无宿主时回退 `window.confirm`）+ `src/components/ui/ConfirmDialog.vue`（在 `App.vue` 挂载）。
- 无障碍与对比度：ui/layout/shared 组件广泛使用 `aria-*`、`focus-visible` 焦点环与 `prefers-reduced-motion` 降级（见 `src/assets/main.css`）。

### 前端风险热点

- `PublicProfilesView.vue` 同时处理公开配置、客户端版本、QR、custom page、guestbook 事件，职责偏多。
- `NodePreviewModal.vue`、`Dashboard.vue`、`ClientSettings.vue`、`DragDropList.vue`、`FilterPanel.vue` 文件较大，改动应先补/定位目标测试。
- `defineAsyncComponent` 使用较多（App、Dashboard、DashboardView、Entrance、HomeView、ManualNodesView、MySubscriptionsView、PublicProfilesView、SubscriptionGroupsView），测试中需要等待 `vi.dynamicImportSettled()`，否则可能产生未处理异步错误。
- `window` / `document` / storage 使用分布较广，DOM 测试要注意 unmount 与清理。

## 测试覆盖地图

### 强覆盖区域

- 内置转换输出：Clash / Surge / QuanX / Sing-box / Loon / Egern。
- 协议转换和模板 pipeline。
- 订阅缓存、节点计数、fetch proxy UA、保护性缓存。
- 安全回归：CSRF/CORS、私网 URL 防护、敏感信息脱敏、auth session。
- 2.7.0 之后新增能力的回归：节点持久化（快照回填、分片重载）、linkId 迁移、组合订阅嵌套、手动节点分组、外部管理 API 路由与操作、WebDAV 备份、全局确认弹窗、i18n 契约、Fork Sync 工作流。

### 待治理区域

- 覆盖率命令存在但缺少 `@vitest/coverage-v8`，当前不可作为 CI 强制项。
- 剩余 stdout 噪音主要来自：
    - `misub-request-regression.test.js` 的 MiSub request 日志。
    - `api-handler-storage-helpers.test.js` 的 diff/cache clear 日志。
    - `notifications-cron-storage.test.js` 的 cron start/completed 日志。
    - `node-handler-batch-update.test.js` 的 storage auto-detect 日志。
    - Node 的 `localStorage is not available because --localstorage-file was not provided` 实验性警告会在大量测试中重复出现。
- 时间、fetch、DOM、dynamic import 是主要 flaky 风险来源。
- 测试目录当前只有 `tests/unit` 一层、190 个测试文件平铺，定位依赖文件名约定，后续可考虑分组（不急）。

## 最大复杂热点

1. `functions/modules/handlers/telegram-webhook-handler.js`：约 3627 行，Bot 命令、权限、存储、消息格式混合。
2. `functions/utils/url-to-clash.js`：约 1637 行，协议分支复杂。
3. `functions/modules/subscription/main-handler.js`：约 1582 行，订阅主链路职责集中。
4. `functions/storage-adapter.js`：约 1409 行，KV/D1/legacy 与快照/分片兼容复杂。
5. `functions/services/subscription-service.js`：约 1310 行，拉取、缓存、过滤、统计、写回混合。
6. `functions/modules/api-router.js`：约 1107 行，路由权限边界需要显式化。
7. `src/components/modals/NodePreview/NodePreviewModal.vue`：约 1004 行，前端弹窗复杂热点。
8. `src/components/settings/sections/ClientSettings.vue`：约 813 行，设置 UI 热点。
9. `src/views/PublicProfilesView.vue`：约 806 行，公开页职责偏多。
10. `src/stores/useDataStore.js`：约 514 行，前端主状态热点。

另有 `src/i18n/messages.js` 约 3822 行，体量大但只是双语文案字典，结构简单，不按复杂度热点处理。

## 下一轮小可逆治理建议

### 优先级 1：继续测试输出治理

- 对剩余 stdout 噪音加局部 console spy，并断言已知日志前缀；顺带评估在测试环境屏蔽 `--localstorage-file` 实验性警告。
- 不改业务代码。
- 每次只处理 1~2 个测试文件，跑目标测试 + 全量测试 + build。

### 优先级 2：收敛 legacy cron

- 明确 `_cron.js` / `_schedule.js` 的定位：当前 `/cron` 已走 `modules/notifications.js`，但 `/api/cron/trigger` 仍导入 `_schedule.js#performSubscriptionSync`，且该模块使用旧绑定（`env.KV_STORAGE` / `env.DB`）与 `auto_sync` 列。
- 建议把 `/api/cron/trigger` 改为复用 `refreshSubscriptionSnapshot` / `handleCronTrigger` 的统一刷新口径，或先在这两个文件顶部加明确注释说明其遗留状态；暂不删除文件，避免破坏部署兼容。

### 优先级 3：显式化 API 路由权限清单

- 在 `api-router.js` 顶部或 `docs/api-routes.md` 中维护 public / auth / diagnostic / migration / external / internal route 分类，并与 `/api/ext/v1`、`/api/internal/node-backfill` 的鉴权方式对齐。
- 先做文档/注释，不改行为。

### 优先级 4：为协议转换加 fixture 快照

- 在继续拆 `url-to-clash.js` 或 `node-parser.js` 前，先补典型协议 fixture。
- 保护 URL → Clash → URL roundtrip 与 Clash YAML/Base64/raw line 解析。

### 优先级 5：前端测试稳定性

- 对使用 `defineAsyncComponent` 的测试统一等待 `vi.dynamicImportSettled()`。
- 对 DOM/storage 测试引入统一清理习惯。
- 时间相关测试逐步使用 fake timers。

### 优先级 6：公开接口请求体大小限制巡检

- `readJsonWithLimit` + `JSON_BODY_LIMITS` 已覆盖 guestbook、error_report、telegram webhook、parse subscription、node/backup 等处理器；后续新增公开入口需逐一体检是否接入。

## 不建议立即做的事

- 不直接拆 `telegram-webhook-handler.js` 或 `main-handler.js` 的大块业务逻辑。
- 不直接删除 `_cron.js` / `_schedule.js`。
- 不在没有 fixture 的情况下重写协议转换器。
- 不把 coverage 纳入 CI，除非先补齐 `@vitest/coverage-v8` 并跑通。
