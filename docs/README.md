# MiSub 文档

MiSub 仓库文档索引。工程知识体系以本地思源笔记本 `MiSub 文档`（源目录 `/root/wiki/misub`）为准，本镜像用于仓库内快速查阅。

## 核心文档

- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) — 仓库布局、模块边界、开发约定。
- [TECHNICAL_DETAILS.md](TECHNICAL_DETAILS.md) — 后端管道、operator chain、存储适配器、节点解析说明。
- [DEVELOPMENT_STANDARDS.md](DEVELOPMENT_STANDARDS.md) — 前后端开发规范（风格、目录、测试、提交约定）。
- [architecture.md](architecture.md) — 总体架构说明（跟随本地 architecture/ 页面）。
- [data-model.md](data-model.md) — 数据模型说明（跟随本地 data-model 页面）。

## API / 外部管理

- [api-routes.md](api-routes.md) — 后端 /api 路由与 handler 映射。
- [external-management-api.md](external-management-api.md) — 外部管理 API 使用说明。
- [external-management-api.openapi.yaml](external-management-api.openapi.yaml) — 外部管理 API OpenAPI 规范。
- [external-management-api-usage.md](external-management-api-usage.md) — 外部管理 API 用法示例。

## 订阅 / 转换

- [subscription-request-flow.md](subscription-request-flow.md) — `/sub/*` 订阅请求处理链路。
- [fetch-proxy-tutorial.md](fetch-proxy-tutorial.md) — fetch proxy 行为与配置。
- [OPERATOR_CHAIN_GUIDE.md](OPERATOR_CHAIN_GUIDE.md) — operator chain 用法与概念。
- [examples/](examples/) — 订阅/模板示例。

## 运维 / 迁移

- [CRON_DASHBOARD_GUIDE.md](CRON_DASHBOARD_GUIDE.md) — cron 仪表盘指南。
- [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) — 迁移指南。
- [UPGRADE_V2.5.md](UPGRADE_V2.5.md) — v2.5 升级历史。
- [plans/](plans/) — 历史规划文档。
