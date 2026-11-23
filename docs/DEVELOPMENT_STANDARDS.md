---
title: Development Standards
created: 2026-09-06
updated: 2026-11-23
type: architecture
status: active
tags: [misub, architecture, frontend, backend, standards, conventions, testing]
sources: [package.json, .editorconfig, schema.sql, src, functions, tests/unit]
related:
    [architecture/module-map, architecture/frontend-visual-system, SCHEMA, api/frontend-api-usage]
---

# Development Standards

## Purpose

MiSub 前后端开发规范。所有新代码与重构应遵循本页约定；与既有代码冲突时，以本页为准并顺手修正旧代码（小步、可逆）。

## When to Read This

- 新增前端组件 / 页面 / store / composable。
- 新增后端模块 / handler / service / utility，或新增外部管理 API 路由。
- 编写或修改测试。
- 提交前自查格式与结构。

## Code Style（前端 + 后端）

### 强制约定（现状已高度一致，需保持）

- **单引号**：字符串一律单引号（`src/` 下 188 个文件使用单引号 import，0 个使用双引号）。
- **分号**：语句以分号结尾（与 Prettier 默认 `semi: true` 一致）。
- **缩进**：4 空格。`.editorconfig` 对 `*.{js,mjs,cjs,ts,vue}` 规定 `indent_size = 4`，JSON/YAML 用 2 空格；不要混用两套缩进。
- **换行与编码**：UTF-8、LF、文件末尾保留换行、行尾不留空白（`.editorconfig` 的 `[*]` 段）；Markdown 不裁剪行尾空白。
- **命名**：文件/目录 kebab-case；函数/变量 camelCase；常量 UPPER_SNAKE；组件 PascalCase。
- **ESM**：统一 `import` / `export`，不使用 CommonJS（`require` / `module.exports`）。
- **无 TODO/FIXME 残留**：合并前清空。

### 自动化与格式化（现状）

- `.editorconfig` 已存在（根级，覆盖缩进/换行/编码），编辑器应自动读取。
- Prettier **已引入**：devDependency `prettier ^3.9.6`，并提供 `npm run format` / `npm run format:check`，覆盖 `functions/**/*.js`、`src/**/*.{js,vue}`、`tests/**/*.js`、`docs/**/*.md`。
- 但仓库当前**没有** `.prettierrc` / `.prettierignore` / `package.json` 里的 `prettier` 配置段，等于使用 Prettier 默认值（`tabWidth: 2`、双引号），与现状的 4 空格 + 单引号不一致。因此在补齐配置（至少 `tabWidth: 4`、`singleQuote: true`）之前，**不要对整仓跑 `format` / `format:check`**；需要时只对本次改动的文件使用 `npx --no-install prettier --check <file>`，不通过再 `--write`。
- 若要把历史文件统一格式化：先补 `.prettierrc`（并视需要补 `.prettierignore` 排除 `dist/`、`docs/examples/`），再全量跑测试（基线 190 文件 / 1184 用例全绿）确认无行为变化，最后单独提一个纯格式提交。
- ESLint 仍未引入；引入时同样先加配置、再全量跑测试验证无行为变化，单独提交。

## Frontend Structure

- Vue 3 SFC，**一律 `<script setup>`**（131 个 `.vue` 中 130 个符合；唯一例外 `src/components/ui/SkeletonCard.vue` 是纯模板 + 样式、没有 script），纯 JS（不引 TS）。
- 组件目录职责：
    - `src/components/ui/*`：基础原子组件（Button、Input、Card、Toast、Skeleton、ConfirmDialog 等），**禁止在业务页面复制一套按钮/输入框风格**。
    - `src/components/shared/*`：共享复合组件（FormModal、DataGrid、DragDropList、FilterPanel 等）。
    - `src/components/features/*` / `modals/*` / `forms/*` / `layout/*` / `nodes/*` / `profiles/*` / `settings/*` / `subscriptions/*` / `public/*`：按业务域组织。
- 页面在 `src/views/*`，路由在 `src/router/index.js`（路由表是模块级常量，标题用 `meta.titleKey`，切换语言后重新求值）。
- 状态用 Pinia（`src/stores/*`）；可复用逻辑放 composable（`src/composables/*`）。
- API 调用统一走 `src/lib/api.js` + `src/constants/api-endpoints.js` 常量，**禁止在组件里硬编码 API 路径字面量**。
- i18n 文案统一进 `src/i18n/messages.js`；语言切换只改文字，不改布局/样式/结构。新增文案必须 `zh-CN` 与 `en-US` 同步补齐，缺失会回退成 key 文本（`src/i18n/index.js`），等于界面露出原始 key。
- 全站交互统一使用共享组件，不要自己造一套：
    - 确认弹窗走 `src/composables/useConfirm.js`（`confirmAction`）+ `src/components/ui/ConfirmDialog.vue`，**禁止 `window.confirm()`**。
    - 模态框走 `src/components/shared/FormModal.vue` / `ui` 层组件（已内置焦点陷阱、Esc 关闭、焦点恢复），关闭行为遵循 `useBackdropDismiss`。
- 无障碍与对比度：交互元素必须有可聚焦语义与 focus ring（`--focus-ring` token），不要用颜色单独传达状态；相关守卫测试 `tests/unit/rule-section-accessibility.test.js`、`tests/unit/visual-system-regression.test.js`。
- 样式用 Tailwind（`src/assets/main.css` 定义 token）；组件样式尽量 scoped。视觉约束详见 [[architecture/frontend-visual-system]]。

## Backend Structure

- Cloudflare Pages Functions，入口 `functions/[[path]].js`；Cron 入口为 `functions/_cron.js` / `functions/_schedule.js`（校验 `CF-Cron` 头），定时任务状态页在 `functions/cron-dashboard.js`。
- 分层职责：
    - `functions/modules/handlers/*`：API controller（HTTP 语义、入参校验、响应组装）。
    - `functions/modules/subscription/*`：订阅链路专用模块（转换、缓存、预览、UA、DNS、分组、模板、内置生成器）。
    - `functions/modules/*.js`：路由 / 鉴权 / 外部管理 API（`external-api-*`、`external-*-handler`）/ WebDAV 备份 / 规则模板 / 工具。
    - `functions/services/*`：跨模块业务服务（订阅核心、处理编排、节点持久化、缓存、日志、通知）。
    - `functions/utils/*` + `functions/modules/utils/*`：纯工具函数，无副作用。
- 路由注册：普通接口进 `functions/modules/api-router.js`；外部管理 API 进 `functions/modules/external-api-router.js`（前缀 `/api/ext/v1`，需 Bearer Token 且设置里开启外部 API），两处都要补路由边界测试。
- 数据访问统一走 `functions/storage-adapter.js`（KV/D1 抽象），**禁止直接调 `env.KV` / `env.DB`**；节点快照的读写统一走 `functions/services/node-persistence-service.js`（D1 单行快照 + 256KB 分片，最多 80 片）。
- 订阅输出格式差异隔离在 transformer/generator/renderer 层（`transform-*.js`、`builtin-*-generator.js`、`template-renderers/*`）。
- 自动更新的唯一判定在 `functions/utils/auto-update.js`（`autoUpdate === false` 才算暂停）：Cron 定时同步、批量刷新、外部 API 批量刷新都走 `filterAutoUpdateSubscriptions`，单条手动刷新不受影响。通知与备份文件名的时间一律按北京时间（UTC+8，见 `notification-service.js`、`webdav-backup-handler.js`）。
- 超过 ~800 行的文件应拆。当前最大文件：`src/i18n/messages.js` 3822 行（双语文案聚合，属可接受的例外）、`functions/modules/handlers/telegram-webhook-handler.js` 3627 行（拆分候选）；其后是 `functions/storage-adapter.js` 1409 行、`functions/modules/api-router.js` 1107 行、`functions/utils/node-transformer.js` 1065 行。

## Testing

- 测试文件统一放 `tests/unit/*.test.js`，kebab-case 命名；全局环境在 `tests/setup.js`（happy-dom 缺省 `localStorage` / `sessionStorage` 时补内存实现）。
- 当前基线：190 个测试文件、1184 个用例全绿（`npx vitest run`，2026-11-23 实测）。
- 行为变更用 TDD：先写复现失败的测试，再修复，再跑针对性测试。
- 涉及外部资源（订阅 URL、cookie、token、webhook）必须用 sanitized fixtures，**禁止真实凭据进测试/提交**。
- 新增/改动功能要配对应守卫测试，优先复用既有命名：外部 API 用 `external-*.test.js`，国际化渲染用 `*-i18n.test.js` / `i18n-contract.test.js`，节点持久化用 `node-persistence-*.test.js`，标识解析用 `profile-linkid-*` / `profile-legacy-*`。
- 提交前必跑：
    - `npm run test:run`（全量，基线 190 文件 / 1184 用例全绿）
    - `npm run build`
    - 可选 `npm run test:coverage` 看覆盖率（v8，覆盖 `src/**` 与 `functions/**`）。

## Git / Commit

- 小步提交：一个逻辑变更一个 commit，message 用 `fix:` / `feat:` / `refactor:` / `docs:` / `test:` 前缀。
- 行为变更 + 文档变更可分两个 commit。
- 推送 `origin/main` 前确认 `git status` 干净、全量测试通过。
- Fork Sync（`.github/workflows/fork-sync.yml`）：只做「可合则合、冲突回滚」的合并式同步，冲突时整体 `git merge --abort` 并在运行摘要说明，**不重置分支、不强制推送**；`tests/unit/fork-sync-workflow.test.js` 会扫描该文件做守卫。调度与日志统一北京时间：cron 只能写 UTC（`0 22 * * *` = 北京时间次日 06:00），改时间时按 `UTC 小时 = 北京时间 HH - 8`（HH < 8 时用前一天的 24 + HH - 8）换算，网页上的运行时间戳仍显示 UTC。

## Related

- [[architecture/module-map]]
- [[architecture/frontend-visual-system]]
- [[SCHEMA]]
- [[api/frontend-api-usage]]
