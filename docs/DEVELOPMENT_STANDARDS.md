---
title: Development Standards
created: 2026-09-06
updated: 2026-11-23
type: architecture
status: active
tags: [misub, architecture, frontend, backend, standards, conventions, testing]
related:
    [architecture/module-map, architecture/frontend-visual-system, SCHEMA, api/frontend-api-usage]
---

# Development Standards

## Purpose

MiSub 前后端开发约定。所有新代码与重构应遵循本页约定；与既有代码冲突时，以本页为准并顺手修正旧代码（小步、可逆）。

## When to Read This

- 新增前端组件 / 页面 / 状态模块 / 组合式函数。
- 新增后端接口 / 业务服务 / 工具函数，或新增外部管理 API 路由。
- 编写或修改测试。
- 提交前自查格式与结构。

## Code Style（前端 + 后端）

### 强制约定（现状已高度一致，需保持）

- **单引号**：字符串一律使用单引号，不使用双引号。
- **分号**：语句以分号结尾（与 Prettier 默认 `semi: true` 一致）。
- **缩进**：JavaScript / Vue / TypeScript 文件 4 空格，JSON / YAML 用 2 空格；不要混用两套缩进。
- **换行与编码**：UTF-8、LF、文件末尾保留换行、行尾不留空白；Markdown 不裁剪行尾空白。
- **命名**：文件 / 目录 kebab-case；函数 / 变量 camelCase；常量 UPPER_SNAKE；组件 PascalCase。
- **ESM**：统一 `import` / `export`，不使用 CommonJS（`require` / `module.exports`）。
- **无 TODO / FIXME 残留**：合并前清空。

### 自动化与格式化（现状）

- 根级编辑器配置已覆盖缩进 / 换行 / 编码，编辑器应自动读取。
- Prettier **已引入**：devDependency `prettier ^3.9.6`，并提供 `npm run format` / `npm run format:check`，覆盖后端、前端、测试与文档。
- 但仓库当前**没有** Prettier 配置文件（也没有忽略清单），等于使用 Prettier 默认值（2 空格缩进、双引号），与现状的 4 空格 + 单引号不一致。因此在补齐配置（至少 4 空格缩进、单引号）之前，**不要对整仓跑 `format` / `format:check`**；需要时只对本次改动的文件执行 `npx --no-install prettier --check <file>`，不通过再 `--write`。
- 若要把历史文件统一格式化：先补 Prettier 配置（并视需要补忽略清单，排除构建产物与示例目录），再全量跑测试（基线 190 文件 / 1184 用例全绿）确认无行为变化，最后单独提一个纯格式提交。
- ESLint 仍未引入；引入时同样先加配置、再全量跑测试验证无行为变化，单独提交。

## Frontend Structure

- Vue 3 单文件组件，**一律使用 `<script setup>`**（现有组件中仅有一个纯模板 + 样式的骨架屏组件例外），纯 JavaScript，不引入 TypeScript。
- 组件目录按职责分层：
    - 基础原子组件（按钮、输入框、卡片、轻提示、骨架屏、确认框等），**禁止在业务页面复制一套按钮 / 输入框风格**。
    - 共享复合组件（表单弹窗、数据网格、拖拽列表、筛选面板等）。
    - 其余组件按业务域组织：功能模块、弹窗、表单、布局、节点、订阅组、设置、订阅、公开页面。
- 页面与路由分离；路由表是模块级常量，标题使用翻译键，切换语言后重新求值。
- 状态用 Pinia；可复用逻辑放组合式函数。
- API 调用统一走 API 封装与接口常量，**禁止在组件里硬编码 API 路径字面量**。
- i18n 文案统一进同一份消息表；语言切换只改文字，不改布局 / 样式 / 结构。新增文案必须中英文同步补齐，缺失会回退成 key 文本，等于界面露出原始 key。
- 全站交互统一使用共享组件，不要自己造一套：
    - 确认弹窗走统一的确认弹窗机制（已内置 Promise 化、同一时刻只挂一个待确认项、无宿主时回退浏览器原生确认框），**禁止使用 `window.confirm()`**。
    - 模态框走共享表单弹窗与基础组件（已内置焦点陷阱、Esc 关闭、焦点恢复），关闭行为遵循点击遮罩关闭的约定。
- 无障碍与对比度：交互元素必须有可聚焦语义与焦点环（统一的设计 token），不要用颜色单独传达状态；相关守卫测试覆盖规则分区可访问性与视觉系统回归。
- 样式用 Tailwind（设计 token 集中定义）；组件样式尽量 scoped。视觉约束详见 [[architecture/frontend-visual-system]]。

## Backend Structure

- 基于 Cloudflare Pages Functions 的后端；定时刷新由 `/cron` 与管理接口触发（见下方说明）。
- 分层职责：
    - **接口层**：HTTP 语义、入参校验、响应组装。
    - **订阅链路**：转换、缓存、预览、User-Agent、DNS、分组、模板、内置生成器。
    - **路由与集成**：路由 / 鉴权 / 外部管理 API / WebDAV 备份 / 规则模板 / 通用工具。
    - **业务服务层**：订阅核心、处理编排、节点持久化、缓存、日志、通知。
    - **工具层**：纯函数，无副作用。
- 路由注册：普通管理接口与外部管理 API（前缀 `/api/ext/v1`，需 Bearer Token 且设置里开启外部 API）分开注册，两处都要补路由边界测试。
- 数据访问统一走存储适配层（KV / D1 抽象），**禁止直接访问底层 KV / D1 绑定**；节点快照的读写统一走节点持久化服务，避免出现第二份节点数据。
- 订阅输出格式的差异隔离在转换 / 生成器 / 渲染层。
- 自动更新的唯一判定在统一的自动更新工具中（只有显式 `autoUpdate === false` 才算暂停）：定时同步、批量刷新、外部 API 批量刷新都会跳过暂停的订阅，单条手动刷新不受影响。通知与备份文件名的时间一律按北京时间（UTC+8）。
- 定时刷新没有并发数、单订阅超时、并行开关一类的可调参数，实际固定为并发 6、单订阅超时 15 秒；只受“启用 Cron”开关与“已开启 D1 节点持久化”影响。`/cron` 与登录后的 `POST /api/cron/trigger` 走同一条节点快照刷新；`/cron-dashboard` 不再提供触发接口，其 POST 返回 405。
- 超过 ~800 行的文件应拆。当前体量最大的几处：中英双语文案聚合（体量大但结构简单，属可接受的例外）、Telegram 机器人消息处理（拆分候选），其后是存储适配层、API 路由层与节点转换工具。

## Testing

- 测试文件统一放在单元测试目录，kebab-case 命名；全局测试环境负责补齐浏览器存储 API 的内存实现。
- 当前基线：190 个测试文件、1184 个用例全绿（`npx vitest run`，2026-11-23 实测）。
- 行为变更用 TDD：先写复现失败的测试，再修复，再跑针对性测试。
- 涉及外部资源（订阅 URL、cookie、token、webhook）必须使用脱敏后的样例数据，**禁止真实凭据进入测试 / 提交**。
- 新增 / 改动功能要配对应守卫测试，命名沿用既有约定：外部管理 API、国际化渲染、节点持久化、订阅标识解析各有固定的命名前缀。
- 提交前必跑：
    - `npm run test:run`（全量，基线 190 文件 / 1184 用例全绿）
    - `npm run build`
    - 可选 `npm run test:coverage` 看覆盖率（v8 引擎，覆盖前端与后端源码）。

## Git / Commit

- 小步提交：一个逻辑变更一个 commit，message 用 `fix:` / `feat:` / `refactor:` / `docs:` / `test:` 前缀。
- 行为变更 + 文档变更可分两个 commit。
- 推送 `origin/main` 前确认 `git status` 干净、全量测试通过。
- Fork Sync（仓库内置的同步工作流）：只做“可合则合、冲突回滚”的合并式同步，冲突时整体 `git merge --abort` 并在运行摘要说明，**不重置分支、不强制推送**；有专门的守卫测试会扫描该工作流文件。调度与日志统一北京时间：cron 只能写 UTC（`0 22 * * *` = 北京时间次日 06:00），改时间时按 `UTC 小时 = 北京时间 HH - 8`（HH < 8 时用前一天的 24 + HH - 8）换算，网页上的运行时间戳仍显示 UTC。

## Related

- [[architecture/module-map]]
- [[architecture/frontend-visual-system]]
- [[SCHEMA]]
- [[api/frontend-api-usage]]
