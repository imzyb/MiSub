# MiSub 项目结构

本文档描述当前仓库（v2.8.0）的目录布局与模块边界，方便后继开发保持统一架构。

## 总体架构

- **前端**：Vue 3 SPA（`<script setup>` + Vue Router + Pinia），使用 Vite 构建，代码位于 `src/`。
- **后端**：Cloudflare Pages Functions，代码位于 `functions/`。
- **存储**：KV 与 D1 双存储，通过统一存储适配层抽象；D1 还承载节点持久化快照。
- **国际化**：全站中英双语，文案集中在统一的文案表里，默认 `zh-CN`、可选 `en-US`。
- **构建产物**：`dist/`（`vite build` 输出，Pages 配置用它作为构建目录）。

## 仓库布局（顶层）

```
.
├─ src/                     # 前端 SPA 源码
├─ functions/               # Cloudflare Pages Functions 后端
├─ public/                  # 静态资源（robots.txt、客户端图标、Logo）
├─ tests/                   # Vitest 测试（tests/unit/*.test.js + tests/setup.js）
├─ docs/                    # 项目文档
├─ scripts/                 # 本地脚本（订阅冒烟 smoke-subscription.mjs、radius token 统一 unify-radius.js）
├─ images/                  # README 截图
├─ dist/                    # 构建产物（自动生成，已 gitignore）
├─ node_modules/            # 依赖（自动生成）
├─ index.html               # Vite 入口 HTML（字体与 data-cfasync 处理）
├─ schema.sql               # D1 表结构（集合表 + 节点快照表）
├─ wrangler-cf-pages.toml   # 仓库内的 Pages 配置（构建目录/兼容日期）
├─ wrangler.toml            # 本地开发绑定（已 gitignore，不进仓库）
├─ .editorconfig            # 缩进/换行/编码约定
├─ .github/workflows/       # GitHub Actions（fork-sync.yml）
├─ package.json             # 脚本与依赖
├─ vite.config.js           # Vite 配置（含本地 API 代理）
└─ vitest.config.js         # Vitest 配置（happy-dom + tests/setup.js）
```

## 前端 (`src/`)

```
src/
├─ App.vue                  # 应用根组件（挂载 ConfirmDialog/Toast 等全局宿主）
├─ main.js                  # 应用启动入口
├─ router/                  # Vue Router 配置与鉴权守卫
├─ views/                   # 路由级页面
├─ components/              # UI 组件、布局、弹窗
├─ composables/             # 复用逻辑（hooks）
├─ stores/                  # Pinia 状态
├─ utils/                   # 前端工具与协议处理
├─ lib/                     # API 封装与共享逻辑
├─ i18n/                    # 全站国际化（index.js + messages.js）
├─ constants/               # 常量与默认配置
├─ assets/                  # 本地资源（main.css 设计 token、logo）
└─ shared/                  # 小型共享工具
```

### 关键区域说明

- `src/views/`：页面级视图，负责页面整体布局。当前包含仪表盘、订阅组、手动节点、我的订阅、设置、首页与公开页、入口页与 404 页。
- `src/components/settings/sections/`：设置面板详情分区，新设定的 UI 组件建议放在此处（现有基础、全局、首页、服务、公告、客户端、自定义页、留言管理、系统、WebDAV 备份 10 个分区）。
- `src/composables/`：跨组件复用的业务逻辑（设置、备份、确认弹窗等）。确认弹窗为 Promise 化的全局弹窗，取代浏览器原生确认框。
- `src/stores/`：全局状态管理（会话鉴权、设置、主题、提示、UI、版本、编辑器与数据缓存）。
- `src/utils/protocols/`：协议转换、解析与校验核心工具。
- `src/i18n/`：语言注册、切换与回退（缺 key 回退到 key 本身），全站文案集中在同一张文案表。
- `src/lib/`：统一 API 调用封装；接口路径常量集中维护在 `src/constants/`。

### 前端组件目录 (`src/components/`)

```
src/components/
├─ ui/                      # 基础 UI 组件（Button/Input/Card/Toast/Skeleton/GroupSelector/ConfirmDialog 等）
├─ layout/                  # 全局布局组件（NavBar/Header/Footer/SettingsLayout/LanguageSwitcher 等）
├─ modals/                  # 弹窗组件集合
│  ├─ SubscriptionImport/   # 订阅导入流程（FileImport/FormatDetector/ImportForm/ParseResult）
│  ├─ SubscriptionEditModal/ # 订阅编辑（EditForm/AdvancedOptions/RuleSection）
│  ├─ NodePreview/          # 节点预览（Container/Header/Modal）
│  └─ ProfileModal/         # 订阅组编辑（ProfileForm/NodeSelector/SubProfileSelector/SubscriptionSelector）
├─ nodes/                   # 节点管理相关组件
│  └─ ManualNodePanel/      # 手动节点管理面板（NodeTable/NodeActions/BulkOperations）
├─ features/                # 复杂功能模块
│  ├─ Dashboard/            # 仪表盘核心视图模块
│  └─ Operators/            # 操作符链核心组件（Filter/Rename/Sort 编辑器）
├─ settings/                # 设置页骨架（SettingsSidebar/SettingsContent/SectionHeader）
│  └─ sections/             # 设置详情分区组件
├─ subscriptions/           # 订阅源列表相关组件
├─ profiles/                # 订阅组展示卡片与面板
├─ public/                  # 公开页面组件（访客视图、Hero 区、Public 卡片）
├─ shared/                  # 跨模块共享组件（DataGrid/DragDropList/FilterPanel/FormModal 等）
├─ forms/                   # 表单控件与表单布局封装
└─ index.js                 # 组件出口汇总
```

独立弹窗（不进子目录）覆盖订阅导入、快速导入、批量导入、复制链接、二维码、分组管理、批量分组、日志、留言板、数据迁移、旧版 D1 迁移、手动节点编辑、手动节点去重、设置、版本更新与登录等场景；部分入口组件与其同名子目录并存（入口 + 子组件）。

## 后端 (`functions/`)

```
functions/
├─ [[path]].js              # Pages Functions 入口：路由分发、伪装、SPA 回退、中间件串联
├─ cron-dashboard.js        # 定时任务状态页（只读展示，不再提供触发入口）
├─ storage-adapter.js       # KV/D1 存储适配层（缓存与快照分片）
├─ middleware/              # 仅 cors.js：CORS、CSRF 来源校验、安全响应头
├─ modules/                 # 核心模块（API、订阅、处理器、外部管理 API）
├─ services/                # 后端业务服务（节点持久化、处理编排、缓存、日志）
└─ utils/                   # 后端工具函数（协议转换、排序、表达式 DSL）
```

### 核心流程说明

- **全局请求入口**：拦截所有请求，先做 CORS、CSRF 来源校验与安全响应头；再按配置决定是否返回「伪装页」（伪装页面渲染在 `modules/` 下）；随后按路径分发——`/api/*` 走 API 路由与鉴权，`/sub/*` 显式前缀与自定义 `mytoken`/`profileToken` 短链走订阅输出，`/cron` 走定时刷新（需设置里的 Cron Secret，支持 `Authorization: Bearer` 或 `?secret=`），其余走前端 SPA 回退；本地开发时把前端请求代理到 5173。
- **API 路由**：定义 API 路径到具体处理器的映射与鉴权。除常规业务接口外，还包含：`/api/migrate`、`/api/migrate_to_d1`、`/api/detect_legacy_d1`、`/api/migrate_legacy_d1`（数据迁移）；`/api/ext/v1/*`（外部管理 API）；`/api/internal/node-backfill`（节点全量回填，只认回填 token）；`/api/external-nodes-callback`（外部节点回调）。
- **订阅请求主流程**：处理 `/sub/*` 的核心流程——请求模式判定、节点拉取、转换、缓存、User-Agent 归一化。订阅组标识解析顺序为 自定义 ID > 系统生成的标识 > 内部主键；单机场输出与节点持久化快照在此汇合。
- **定时刷新（Cron）**：只有一条链路——`/cron` 与登录后的 `POST /api/cron/trigger` 都触发「节点快照刷新」，共用同一个实现；旧的定时同步实现已删除。`/cron-dashboard` 只是只读状态页，不再提供触发入口（对该页发 POST 会返回 405），手动触发请用登录后的 `/api/cron/trigger`。刷新并发为 6、单订阅超时 15 秒，没有可调参数；是否执行只取决于「定时刷新开关」与「是否已启用 D1 节点持久化」。
- **D1 节点持久化**：一个订阅只保留一份节点快照；启用持久化会触发一次全量回填（等价一次定时刷新），全量通过自触发链分批推进（每批 6 个订阅、最多 60 批）；超大订阅按 256KB 分片写入（最多 80 片）；输出链路只读快照，仅在该订阅没有快照或配置发生变化时懒初始化，快照就绪后才参与订阅组输出。

### 后端模块目录 (`functions/modules/`)

```
functions/modules/
├─ api-router.js            # API 路由表（含鉴权、迁移、外部 API 分派）
├─ api-handler.js           # 通用 API 处理逻辑（数据/设置/公开接口）
├─ auth-middleware.js       # 登录态校验与会话续期
├─ subscription-handler.js  # /sub/*、预览与节点接口入口
├─ profile-alias.js         # 订阅组标识校验（自定义 ID / 系统标识规则、互斥与存量补齐）
├─ external-api-router.js   # 外部管理 API 路由（/api/ext/v1）
├─ external-api-auth.js     # 外部 API Bearer Token 鉴权
├─ external-api-mappers.js  # 外部 API 数据映射
├─ external-api-utils.js    # 外部 API 错误体与设置读取
├─ external-subscriptions-handler.js # 外部 API：订阅增删改查/校验/刷新
├─ external-manual-nodes-handler.js  # 外部 API：手动节点
├─ external-profiles-handler.js      # 外部 API：订阅组与关联关系
├─ external-preview-handler.js       # 外部 API：订阅组预览
├─ webdav-backup-handler.js # WebDAV 备份/恢复、导出与备份状态
├─ rule-template-handler.js # 自定义规则模板读写
├─ parse-subscription-handler.js # 订阅内容解析接口
├─ scheduled-task-runner.js # 前端触发的定时任务（自动更新等）
├─ security-utils.js        # SSRF 防护、公网 URL 校验、脱敏
├─ notifications.js         # 通知与定时刷新编排
├─ disguise-page.js         # 伪装页面渲染
├─ config.js                # KV 键、Cookie 与默认设置
├─ patch-utils.js           # 增量补丁合并
├─ utils.js                 # 模块内通用工具（响应/限流/JSON 读取等）
├─ handlers/                # 按功能拆分的 API 处理器（Controller 层）
├─ subscription/            # 订阅请求处理流水线
└─ utils/                   # 后端专用工具（地理识别/解析/校验等）
```

#### 1. 处理器 (`functions/modules/handlers/`)

这是 API 的具体实现层：

```
functions/modules/handlers/
├─ disguise-handler.js      # 伪装页面逻辑处理器
├─ guestbook-handler.js     # 留言板：公开/管理接口
├─ client-handler.js        # 客户端推荐数据接口
├─ node-handler.js          # 节点统计、健康检查、批量更新
├─ debug-handler.js         # 调试与系统信息接口
├─ error-report-handler.js  # 前端错误上报
├─ github-proxy-handler.js  # GitHub Release 代理
└─ telegram-webhook-handler.js # Telegram Bot 推送回调
```

#### 2. 订阅处理 (`functions/modules/subscription/`)

```
functions/modules/subscription/
├─ main-handler.js          # 主订阅请求入口（模式判定、缓存、后端归一化）
├─ index.js                 # 对外导出（主处理与预览）
├─ preview-handler.js       # 预览节点列表接口
├─ profile-handler.js       # 订阅组输出
├─ profile-resolver.js      # 订阅组标识解析（自定义 ID > 系统标识 > 内部主键）
├─ single-subscription.js   # 单机场订阅输出（对接节点持久化快照）
├─ node-fetcher.js          # 拉取远端订阅内容
├─ user-agent-utils.js      # User-Agent 解析与格式判断
├─ cache-manager.js         # 订阅缓存策略管理
├─ request-context.js       # 请求上下文解析
├─ transformer-factory.js   # 订阅格式转换分发工厂
├─ builtin-clash-generator.js / builtin-surge-generator.js / builtin-loon-generator.js
├─ builtin-quanx-generator.js / builtin-singbox-generator.js / builtin-egern-generator.js
├─ builtin-template-registry.js / builtin-rules-provider.js
├─ template-model.js / template-pipeline.js / template-processor.js
├─ template-compatibility.js / transform-template-cache.js / transform-template-renderer.js
├─ template-parsers/ini-template-parser.js
├─ template-renderers/render-clash.js / render-surge.js / render-loon.js / render-quanx.js / render-singbox.js / render-egern.js
├─ region-groups.js / protocol-groups.js / name-utils.js  # 分组与命名
├─ safe-dns.js              # 安全 DNS 解析
├─ mihomo-chain-proxy.js    # Mihomo 链式代理支持
└─ access-logger.js         # 访问日志记录
```

#### 3. 外部管理 API

- **开关与鉴权**：先读外部 API 设置，未启用返回 403；随后要求 `Authorization: Bearer <token>`，与设置里的 token 列表比对，失败返回 401。
- **路由**：按路径分派，前缀为 `/api/ext/v1`：`/subscriptions`、`/subscriptions/validate`、`/subscriptions/batch-refresh`、`/subscriptions/{id}`、`/subscriptions/{id}/refresh`、`/manual-nodes`、`/manual-nodes/validate`、`/manual-nodes/{id}`、`/profiles`、`/profiles/{id}`、`/profiles/{id}/refresh`、`/profiles/{id}/(subscriptions|manual-nodes)`、`POST /profiles/{id}/preview`。
- **响应约定**：统一错误体由外部 API 的公共错误构造逻辑生成，数据映射也统一收口。
- **文档与测试**：`docs/external-management-api.md`、`docs/external-management-api.openapi.yaml`；路由边界的守卫测试与外部 API 用例放在 `tests/` 下对应的测试文件中。

`functions/modules/utils/` 与 `functions/utils/` 都是纯工具层，区别是前者服务 `modules/` 内部、后者被 services 与订阅流水线共用：

```
functions/modules/utils/
├─ geo-utils.js             # 地理/区域识别
├─ metadata-extractor.js    # 订阅元信息提取
├─ node-cleaner.js          # 节点清洗、过滤规则解析与 URL 修复
├─ node-parser.js           # 节点解析（Parse Logic）
├─ singbox-to-url.js        # SingBox 配置转节点链接
├─ ss2022-validator.js      # SS2022 参数校验
└─ v2rayn-parser.js         # v2rayN 分享链接解析

functions/utils/
├─ auto-update.js           # 自动更新策略（Cron 与外部触发的统一口径）
├─ clash-to-url.js / url-to-clash.js  # 配置与链接互转
├─ expression-dsl.js        # 表达式 DSL 解析
├─ fetch-proxy-utils.js     # 请求代理 URL 拼装
├─ format-utils.js          # 格式化与 User-Agent 处理
├─ node-transformer.js      # 节点变换与排序引擎（含正则置顶优先级）
├─ node-utils.js            # 节点通用工具
├─ operator-runner.js       # 操作符执行引擎（Filter/Rename/Sort 链）
└─ xhttp-extra.js           # XHTTP 扩展参数处理
```

### 服务层 (`functions/services/`)

```
functions/services/
├─ subscription-service.js  # 订阅核心业务（组合、节点聚合）
├─ processor-service.js     # 处理编排：组解析 → 节点拉取 → 变换 → 渲染
├─ subscription-node-transform.js # 机场订阅级节点治理（算子链 + include/exclude）
├─ node-persistence-service.js # D1 节点持久化（单行快照、分片、全量回填）
├─ node-cache-service.js    # 节点数据缓存（首屏快速响应 + 后台刷新）
├─ profile-stats-service.js # 订阅组下载计数与统计
├─ external-nodes-callback-service.js # 外部节点回调接口（加密回调缓存）
├─ fetch-utils.js           # 网络请求工具（Fetch/Retry/Concurrency）
├─ misub-service.js         # 兼容层：统一转出订阅处理
├─ log-service.js           # 访问日志读写服务
└─ notification-service.js  # 通知服务封装（Telegram 等，时间显示 UTC+8）
```

### 数据模型

- `subscriptions` / `profiles` / `settings`：D1 行级集合表（`id` + `data` JSON），另有 `created_at` / `updated_at` 与对应索引。
- `subscription_node_snapshots`：每个「订阅 + 配置指纹」一行节点快照，记录状态（`pending` / `ready`，仅 `ready` 参与订阅组输出）、节点数据、节点数、分片数、最近成功 / 尝试时间与最近错误。
- `subscription_node_snapshot_chunks`：单条订阅节点数据超过 256KB 时按块分片存放（上限 80 片），以订阅 ID 与分片序号为主键。

## 开发约定

### 1. 新功能开发

- **UI**：新的 Vue 组件放入 `src/components/` 下对应分类，页面级组件放入 `src/views/`。
- **API**：
    1. 在 `functions/modules/handlers/` 创建新的处理器（或复用 `modules/` 下的领域模块）。
    2. 在 API 路由表注册路由；若属于外部管理 API，则在外部 API 路由里注册并补上对应的边界测试。
- **数据**：所有数据库操作**必须**通过统一存储适配层进行，禁止直接访问 KV 或 D1，以保持双存储兼容；节点快照读写统一走节点持久化服务。
- **文案**：新增界面文案同时补中英两套，不要在组件里硬编码中文。

### 2. 伪装与安全

- 伪装逻辑统一放在 `functions/modules/`，在全局入口被优先调用。
- 涉及敏感操作的 API 需在路由表中添加登录态校验；外部管理 API 额外要求开启外部 API 开关并携带 Bearer Token。
- 对外抓取（订阅拉取、WebDAV、回调）必须经过公网 URL 校验，避免 SSRF。

### 3. 公共资源

- 通用静态资源位于 `public/` 目录（`robots.txt`、`logo.png`、客户端图标 `public/icons/clients/`）。

### 4. 国际化

- 语言注册与切换集中管理（支持 `zh-CN` / `en-US`，默认 `zh-CN`），全站文案在同一张文案表里。
- 组件内使用统一的翻译能力；路由标题用翻译 key（不要写死 `t()` 的求值结果，否则切换语言后不更新）。
- 前后端文案键的一致性由国际化契约测试覆盖。

### 5. 订阅标识与链接

- 三层标识：自定义 ID（用户自定义订阅 ID）> 系统生成的标识（可重置）> 内部主键；解析只有一个入口。
- 公开入口（订阅链接、公开预览）只认当前生效的标识：设置自定义 ID 后，内部主键与系统生成的标识都不再可达；未落库系统标识的存量数据保留用主键访问的兼容窗口（升级时把系统标识补成原主键 ID，旧链接不断链）。
- 系统生成的标识可在订阅组编辑弹窗里重置：确认后写入新值，保存后生效，旧标识随即不可访问。
- 细节与 URL 形态见 `docs/profile-url.md`。
