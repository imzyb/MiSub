# MiSub 项目结构

本文档描述当前仓库的目录布局与模块边界，方便后继开发保持统一架构。

## 总体架构

- **前端**：Vue 3 SPA，使用 Vite 构建，代码位于 `src/`。
- **后端**：Cloudflare Pages Functions，代码位于 `functions/`。
- **存储**：KV 与 D1 双存储，通过 `functions/storage-adapter.js` 统一抽象。
- **构建产物**：`dist/`（生产）与 `dev-dist/`（开发）。

## 仓库布局（顶层）

```
.
├─ src/                     # 前端 SPA 源码
├─ functions/               # Cloudflare Pages Functions 后端
├─ public/                  # 静态资源与 PWA 文件
├─ tests/                   # 单元测试
├─ docs/                    # 项目文档
├─ dist/                    # 构建产物（自动生成）
├─ dev-dist/                # 开发构建产物（自动生成）
├─ node_modules/            # 依赖（自动生成）
├─ schema.sql               # D1 表结构
├─ fix_d1_schema.sql        # D1 表结构修复脚本
├─ wrangler.toml            # Cloudflare 配置
├─ package.json             # 脚本与依赖
├─ vite.config.js           # Vite 配置
└─ vitest.config.js         # Vitest 配置
```

## 前端 (`src/`)

```
src/
├─ App.vue                  # 应用根组件
├─ main.js                  # 应用启动入口
├─ router/                  # Vue Router 配置
├─ views/                   # 路由级页面
├─ components/              # UI 组件、布局、弹窗
├─ composables/             # 复用逻辑（hooks）
├─ stores/                  # Pinia 状态
├─ utils/                   # 前端工具与协议处理
├─ lib/                     # API 封装与共享逻辑
├─ constants/               # 常量与默认配置
├─ assets/                  # 本地资源（图标/图片）
└─ shared/                  # 小型共享工具
```

### 关键区域说明
- `src/views/`：页面级视图（仪表盘、设置、订阅等），负责页面整体布局。
- `src/components/settings/sections/`：设置面板详情分区，新设定的 UI 组件建议放在此处。
- `src/composables/`：跨组件复用的业务逻辑（如 `useSettingsLogic.js`, `useBackupLogic.js`）。
- `src/stores/`：全局状态管理（会话 Auth、UI 状态、数据缓存）。
- `src/utils/protocols/`：协议转换、解析与校验核心工具。

### 前端组件目录 (`src/components/`)

```
src/components/
├─ ui/                      # 基础 UI 组件（按钮、提示、加载、卡片等）
├─ layout/                  # 全局布局组件（导航栏、侧边栏、底部导航）
├─ settings/
│  ├─ sections/             # 设置页各功能分区（基础/服务/公告/留言等）
│  └─ NodeTransformSettings/ # 节点转换/重命名相关配置 UI
├─ modals/                  # 弹窗组件集合
│  ├─ SubscriptionImport/   # 订阅导入流程
│  ├─ SubscriptionEditModal/ # 订阅编辑
│  ├─ NodePreview/          # 节点预览
│  └─ ProfileModal/         # 订阅组/配置文件编辑
├─ nodes/                   # 节点管理相关组件
│  └─ ManualNodePanel/      # 手动节点管理面板
├─ features/                # 复杂功能模块
│  └─ Dashboard/            # 仪表盘核心视图模块
├─ subscriptions/           # 订阅源列表相关组件
├─ profiles/                # 订阅组展示卡片等
├─ public/                  # 公开页面组件（访客视图、Hero区）
├─ shared/                  # 跨模块共享组件
└─ forms/                   # 表单控件与表单布局封装
```

## 后端 (`functions/`)

```
functions/
├─ [[path]].js              # Pages Functions 入口，负责路由分发与伪装逻辑
├─ storage-adapter.js       # KV/D1 存储适配层
├─ middleware/              # 中间件（CORS、认证、安全头）
├─ modules/                 # 核心模块（API、订阅、处理器）
├─ services/                # 后端业务服务（缓存、聚合、日志）
└─ utils/                   # 后端工具函数
```

### 核心流程说明
- `functions/[[path]].js`：
  - 全局入口，拦截所有请求。
  - **伪装逻辑**：调用 `disguise-handler.js`，根据配置决定是否伪装根路径或 SPA 路由。
  - **路由分发**：将 `/api/*` 分发给 API 路由，`/sub/*` 分发给订阅处理，`/cron` 分发给定时任务。
  - **SPA 回退**：处理前端路由的 `index.html` 返回。

- `functions/modules/api-router.js`：定义 API 路径到具体 Handlers 的映射，包含鉴权逻辑。
- `functions/modules/subscription/main-handler.js`：处理 `/sub/*` 订阅请求的核心流程（获取、转换、缓存）。

### 后端模块目录 (`functions/modules/`)

```
functions/modules/
├─ api-router.js            # API 路由表
├─ api-handler.js           # 通用 API 处理逻辑
├─ handlers/                # 按功能拆分的 API 处理器（Controller 层）
├─ subscription/            # 订阅请求处理流水线
└─ utils/                   # 后端专用工具（地理识别/解析/校验等）
```

#### 1. 处理器 (`functions/modules/handlers/`)
这是 API 的具体实现层：
```
functions/modules/handlers/
├─ disguise-handler.js      # [新增] 伪装页面逻辑处理器
├─ guestbook-handler.js     # 留言板：公开/管理接口
├─ client-handler.js        # 客户端推荐数据接口
├─ node-handler.js          # 节点统计、健康检查、批量更新
├─ debug-handler.js         # 调试与系统信息接口
├─ error-report-handler.js  # 前端错误上报
└─ telegram-webhook-handler.js # Telegram Bot 推送回调
```

#### 2. 订阅处理 (`functions/modules/subscription/`)
```
functions/modules/subscription/
├─ main-handler.js          # 主订阅请求入口
├─ user-agent-utils.js      # [新增] User-Agent 解析与格式判断
├─ preview-handler.js       # 预览节点列表接口
├─ cache-manager.js         # 订阅缓存策略管理
├─ request-context.js       # 请求上下文解析
├─ subconverter-client.js   # Subconverter 后端调用适配
└─ access-logger.js         # 访问日志记录
```

#### 3. 后端工具 (`functions/modules/utils/`)
```
functions/modules/utils/
├─ node-cleaner.js          # [新增] 节点清洗与URL修复
├─ node-parser.js           # 节点解析 (Parse Logic)
└─ node-transformer.js      # 节点变换 (Rename/Sort/Emoji)
```

### 服务层 (`functions/services/`)
```
functions/services/
├─ subscription-service.js  # 订阅核心业务 (生成、组合)
├─ fetch-utils.js           # [新增] 网络请求工具 (Fetch/Retry/Concurrency)
├─ node-cache-service.js    # 节点数据缓存服务
├─ log-service.js           # 访问日志读写服务
└─ notification-service.js  # 通知服务封装
```

## 开发约定

### 1. 新功能开发
- **UI**：新的 Vue 组件放入 `src/components/` 下对应分类，页面级组件放入 `src/views/`。
- **API**：
  1. 在 `functions/modules/handlers/` 创建新的 Handler 文件。
  2. 在 `functions/modules/api-router.js` 中注册路由。
- **数据**：所有数据库操作**必须**通过 `functions/storage-adapter.js` 提供的 Adapter 实例进行，禁止直接调用 `env.KV` 或 `env.DB`，以保持 KV/D1 的兼容性。

### 2. 伪装与安全
- 伪装逻辑位于 `functions/modules/handlers/disguise-handler.js`，在 `[[path]].js` 中被优先调用。
- 涉及敏感操作的 API 需在 `api-router.js` 中添加 `authMiddleware` 保护。

### 3. 公共资源
- PWA 相关文件（`manifest.json`, `sw.js` 等）位于 `public/` 目录。
