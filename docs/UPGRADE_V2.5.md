# MiSub v2.5.0 破坏性变更与深度升级手册

v2.5.0 是 MiSub 的一个重大里程碑。我们不仅重构了核心节点处理引擎，还对项目进行了“瘦身”，使其回归订阅管理的本质。

如果您之前已经 Fork 了本仓库，**请在升级前仔细阅读此手册**。

---

## 1. 核心变化与功能下线

### ❌ 移除 VPS 探针监控
**变更说明**：我们移除了原有的 VPS 监控探针和后台数据收集功能。
**原因**：为了减轻 Cloudflare Workers 的运行负担，并让 MiSub 聚焦于“订阅管理”和“节点转换”。
**建议**：如果您需要监控 VPS，建议使用专业的 [Uptime-Kuma](https://github.com/louislam/uptime-kuma) 或 [Server-Status](https://github.com/cppla/ServerStatus)。

### 🔄 废弃第三方订阅转换后端
**变更说明**：默认不再支持调用外部的 Sub-Store 或 ACL4SSR 转换接口。
**现状**：自研的内置渲染器（Built-in Generator）现已支持全部主流客户端（Clash, Sing-Box, Surge, Loon, QX, Base64），且性能更佳。

---

## 2. 代码同步指南 (Git Sync)

由于许多组件被删除或移动，直接同步可能会产生冲突。

### 推荐步骤：
1. **备份数据**：在升级前，建议在 MiSub 后台导出一次数据备份（Settings -> Backup）。
2. **连接上游**（如果未连接）：
   ```bash
   git remote add upstream https://github.com/imzyb/MiSub.git
   ```
3. **获取更新并合并**：
   ```bash
   git fetch upstream
   git merge upstream/main
   ```
4. **处理冲突**：
   - 重点检查 `wrangler.toml` 和 `package.json`。
   - 如果本地修改过多导致合并失败，建议强制覆盖本地代码（注意：这会丢失您本地的 UI 修改）：
     ```bash
     git reset --hard upstream/main
     ```

---

## 3. 配置迁移 (Config Migration)

### 3.1 环境变量核对
请前往 Cloudflare Pages 控制台检查以下环境变量：
- **Node.js 版本**：确保 `NODE_VERSION` 设置在 `18` 以上（推荐 `20`）。
- **兼容性日期**：建议更新到最新日期。

### 3.2 节点管道迁移
v2.5.0 引入了**操作符链 (Operator Chain)**。
- **自动兼容**：后端内置了桥接层，旧的“净化规则”会被自动转化为操作符运行。
- **建议操作**：进入“订阅组”编辑页面，点击橙色的“立即迁移”按钮，将配置持久化为新格式。详情请参考 [迁移指南](MIGRATION_GUIDE.md)。

---

## 4. 前端构建注意事项

本项目已升级至 **Vite 7** 和 **Tailwind CSS 4**。
- 如果您之前手动修改过 CSS 文件，请注意新版 Tailwind 的语法变化。
- 确保运行过 `npm install` 以更新所有依赖。

---

## 5. 常见问题排查

**Q: 升级后原来的 VPS 统计图表不见了？**
A: 是的，该功能已永久移除。相关 API 端口已关闭。

**Q: 外部转换链接无法生成？**
A: 请检查订阅地址中的参数。新版推荐直接使用生成的短链接或内置路径。

**Q: D1 数据库需要重置吗？**
A: **不需要**。v2.5.0 采用 JSON 字段扩展，Schema 与 v2.4 保持兼容。您只需在 D1 控制台运行最新的 `schema.sql`（如果此前未更新过）即可。
