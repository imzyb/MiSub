# MiSub Codebase Review

本文记录当前代码库的只读梳理结果，用于后续按“小步、可逆、可验证”的方式持续治理。

## 当前健康状态

- 目标测试通过：10 个测试文件 / 70 个用例。
- 全量测试通过：73 个测试文件 / 374 个用例。
- 生产构建成功：`npm run build`。
- 本轮代码变更只涉及测试治理与测试稳定性，不改业务逻辑。

## 代码规模

| 区域 | 文件数 | 行数 | 说明 |
| --- | ---: | ---: | --- |
| `src` | 207 | 30,752 | Vue 前端、状态管理、组件、协议工具 |
| `functions` | 90 | 26,476 | Cloudflare Pages Functions 后端 |
| `tests` | 73 | 8,368 | Vitest 单元/回归测试 |
| `docs` | 13 | 2,642 | 架构、数据模型与运维文档 |

主要源码语言：JavaScript 与 Vue 单文件组件。

## 后端模块地图

### 入口与路由

- `functions/[[path]].js`：Cloudflare Pages Functions 主入口，挂载安全中间件、API 路由、订阅短链、cron 与静态资源 fallback。
- `functions/modules/api-router.js`：`/api/*` 总路由，负责公开接口、认证接口、调试接口、迁移接口和管理接口分发。
- `functions/modules/api-handler.js`：核心数据读写、settings、profiles、misubs 保存与公开配置。

### 存储层

- `functions/storage-adapter.js`：KV / D1 / Noop adapter、SettingsCache、DataMigrator。
- 当前数据形态兼容 KV 全量数组、D1 行级 JSON，以及旧 D1 `main` 行。
- 风险：兼容逻辑复杂，旧结构与 row-level 结构并存时需要诊断能力支撑。

### 订阅主链路

- `functions/modules/subscription/main-handler.js`：订阅请求主流程，负责 token/profile 解析、浏览器伪装、目标节点集合、缓存、内置/外部转换、响应输出、下载计数和通知。
- `functions/services/subscription-service.js`：远程订阅拉取、手动节点、per-sub 缓存、过滤、去重、operator chain、运行态信息写回。
- `functions/services/node-cache-service.js`：节点缓存读写、清理、保护性空覆盖防护。

### 协议转换与模板

- `functions/utils/url-to-clash.js`：URL 节点转 Clash proxy，体量最大、协议分支多。
- `functions/utils/clash-to-url.js`：Clash proxy 转 URL 节点。
- `functions/modules/utils/node-parser.js`：节点文本、Base64、Clash YAML、raw line 解析。
- `functions/modules/subscription/builtin-*-generator.js`：Clash / Sing-box / Surge / Loon / QuanX / Egern 内置输出。
- `functions/modules/subscription/template-pipeline.js` 与 `template-renderers/*`：模板模型与多目标渲染。

### 定时与通知

- `functions/modules/notifications.js`：当前 `/cron` 与 `/api/cron/trigger` 使用的主定时检查逻辑。
- `functions/_cron.js`、`functions/_schedule.js`：疑似遗留定时实现，使用旧绑定/旧 key，需要标记或收敛，避免误用。

### 安全与公开接口

- `functions/modules/auth-middleware.js`：HMAC cookie 登录会话、七天有效期、auth diagnostic 开关。
- `functions/middleware/cors.js`：CORS、CSRF origin/referrer、安全响应头。
- `functions/modules/security-utils.js`：敏感字段脱敏、公开 fetch SSRF 防护、redirect 重新校验。
- 公开接口包括 public profiles/preview/guestbook/error report/Telegram webhook/GitHub release proxy，需要持续关注体积限制和滥用风险。

## 前端模块地图

### Views

- `src/views/DashboardView.vue`：主控制台页面容器。
- `src/views/PublicProfilesView.vue`：公开订阅页，包含 hero/custom page/clients/guestbook/quick import 等逻辑，当前是 view 层复杂热点。
- `src/views/ManualNodesView.vue`、`SubscriptionGroupsView.vue`、`MySubscriptionsView.vue`、`SettingsView.vue`：分别承载手动节点、订阅组、我的订阅、设置入口。

### Components

- `src/components/modals/*`：编辑、导入、节点预览、二维码、留言、设置等弹窗。
- `src/components/settings/sections/*`：设置页面各分区，其中 `ClientSettings.vue`、`BasicSettings.vue`、`TelegramCard.vue` 较大。
- `src/components/features/Dashboard/*`：Dashboard 分块。
- `src/components/shared/*`：DataGrid、DragDropList、FilterPanel 等通用复杂组件。
- `src/components/public/*`：公开页面渲染、ProfileGrid、自定义公开页。

### 状态与组合式函数

- `src/stores/useDataStore.js`：主数据状态与保存入口，是前端状态热点。
- `src/composables/useSubscriptions.js`、`useManualNodes.js`、`useProfiles.js`、`useNodePreview.js`：前端业务状态与 API 调用封装。
- `src/lib/api.js`、`src/lib/http.js`：API facade 与 HTTP 封装。

### 前端风险热点

- `PublicProfilesView.vue` 同时处理公开配置、客户端版本、QR、custom page、guestbook 事件，职责偏多。
- `NodePreviewModal.vue`、`Dashboard.vue`、`ClientSettings.vue`、`DragDropList.vue`、`FilterPanel.vue` 文件较大，改动应先补/定位目标测试。
- `defineAsyncComponent` 使用较多，测试中需要等待 `vi.dynamicImportSettled()`，否则可能产生未处理异步错误。
- `window` / `document` / storage 使用分布较广，DOM 测试要注意 unmount 与清理。

## 测试覆盖地图

### 强覆盖区域

- 内置转换输出：Clash / Surge / QuanX / Sing-box / Loon / Egern。
- 协议转换和模板 pipeline。
- 订阅缓存、节点计数、fetch proxy UA、保护性缓存。
- 安全回归：CSRF/CORS、私网 URL 防护、敏感信息脱敏、auth session。

### 待治理区域

- 覆盖率命令存在但缺少 `@vitest/coverage-v8`，当前不可作为 CI 强制项。
- 剩余 stdout 噪音主要来自：
  - `misub-request-regression.test.js` 的 MiSub request 日志。
  - `api-handler-storage-helpers.test.js` 的 diff/cache clear 日志。
  - `notifications-cron-storage.test.js` 的 cron start/completed 日志。
  - `node-handler-batch-update.test.js` 的 storage auto-detect 日志。
- 时间、fetch、DOM、dynamic import 是主要 flaky 风险来源。

## 最大复杂热点

1. `functions/modules/handlers/telegram-webhook-handler.js`：约 2748 行，Bot 命令、权限、存储、消息格式混合。
2. `functions/utils/url-to-clash.js`：约 1382 行，协议分支复杂。
3. `functions/services/subscription-service.js`：约 997 行，拉取、缓存、过滤、统计、写回混合。
4. `functions/modules/subscription/main-handler.js`：约 919 行，订阅主链路职责集中。
5. `functions/modules/api-router.js`：约 910 行，路由权限边界需要显式化。
6. `functions/storage-adapter.js`：约 845 行，KV/D1/legacy 兼容复杂。
7. `src/components/modals/NodePreview/NodePreviewModal.vue`：约 713 行，前端弹窗复杂热点。
8. `src/views/PublicProfilesView.vue`：约 578 行，公开页职责偏多。
9. `src/components/settings/sections/ClientSettings.vue`：约 518 行，设置 UI 热点。
10. `src/stores/useDataStore.js`：约 433 行，前端主状态热点。

## 下一轮小可逆治理建议

### 优先级 1：继续测试输出治理

- 对剩余 stdout 噪音加局部 console spy，并断言已知日志前缀。
- 不改业务代码。
- 每次只处理 1~2 个测试文件，跑目标测试 + 全量测试 + build。

### 优先级 2：标记 legacy cron

- 在 `_cron.js` / `_schedule.js` 顶部加明确注释，说明当前主 cron 入口是 `modules/notifications.js`，这两个文件使用旧绑定/旧 key，禁止作为生产主链路依据。
- 暂不删除文件，避免破坏部署兼容。

### 优先级 3：显式化 API 路由权限清单

- 在 `api-router.js` 顶部或文档中维护 public/auth/diagnostic/migration route 分类。
- 先做文档/注释，不改行为。

### 优先级 4：为协议转换加 fixture 快照

- 在继续拆 `url-to-clash.js` 或 `node-parser.js` 前，先补典型协议 fixture。
- 保护 URL → Clash → URL roundtrip 与 Clash YAML/Base64/raw line 解析。

### 优先级 5：前端测试稳定性

- 对使用 `defineAsyncComponent` 的测试统一等待 `vi.dynamicImportSettled()`。
- 对 DOM/storage 测试引入统一清理习惯。
- 时间相关测试逐步使用 fake timers。

### 优先级 6：公开接口请求体大小限制

- 先新增通用 `readJsonWithLimit` 工具并从公开接口逐个接入。
- 优先 guestbook、error_report、telegram webhook、parse subscription。

## 不建议立即做的事

- 不直接拆 `telegram-webhook-handler.js` 或 `main-handler.js` 的大块业务逻辑。
- 不直接删除 `_cron.js` / `_schedule.js`。
- 不在没有 fixture 的情况下重写协议转换器。
- 不把 coverage 纳入 CI，除非先补齐 `@vitest/coverage-v8` 并跑通。
