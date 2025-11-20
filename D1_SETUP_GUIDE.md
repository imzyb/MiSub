# MiSub D1 数据库配置指南

## 📋 概述

本指南将帮助您为 MiSub 系统配置 Cloudflare D1 数据库，以解决 KV 存储的写入限制问题。

## 🚀 快速开始

### 1. 创建 D1 数据库

在项目根目录执行以下命令：

```bash
# 创建 D1 数据库
wrangler d1 create misub
```

命令执行后，您会看到类似以下的输出：
```
✅ Successfully created DB 'misub' in region APAC
Created your database using D1's new storage backend. The new storage backend is not yet recommended for production workloads, but backs up your data via point-in-time restore.

[[d1_databases]]
binding = "MISUB_DB"
database_name = "misub"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2. 更新 wrangler.toml 配置

将上一步输出的数据库 ID 复制到 `wrangler.toml` 文件中：

```toml
[[d1_databases]]
binding = "MISUB_DB"
database_name = "misub"
database_id = "your-actual-database-id-here"  # 替换为实际的数据库 ID
preview_database_id = "your-actual-database-id-here"  # 同样替换为实际的数据库 ID
```

### 3. 初始化数据库表结构

```bash
# 执行数据库初始化脚本
wrangler d1 execute misub --file=schema.sql
```

**如果您已经创建过数据库但遇到表结构问题，请执行修复脚本：**

```bash
# 修复现有数据库表结构
wrangler d1 execute misub --file=fix_d1_schema.sql
```

### 4. 部署应用

```bash
# 构建并部署
npm run build
wrangler pages deploy
```

## 🔧 使用方法

### 在设置中切换存储类型

1. 登录 MiSub 管理界面
2. 打开"设置"页面
3. 在"数据存储类型"部分选择"D1 数据库"
4. 点击"保存设置"

### 数据迁移

如果您已经有 KV 中的数据，可以使用内置的迁移功能：

1. 在设置页面中，当存储类型为"KV 存储"时
2. 点击"🚀 迁移数据到 D1 数据库"按钮
3. 确认迁移操作
4. 等待迁移完成
5. 系统会自动将存储类型切换为"D1 数据库"

## 📊 存储类型对比

| 特性 | KV 存储 | D1 数据库 |
|------|---------|-----------|
| 写入限制 | 有限制 | 无限制 |
| 查询速度 | 极快 | 快 |
| 数据结构 | 键值对 | 关系型 |
| 成本 | 较低 | 中等 |
| 适用场景 | 读多写少 | 频繁更新 |

## ⚠️ 注意事项

1. **数据迁移是单向的**：从 KV 迁移到 D1 后，建议不要再切换回 KV
2. **性能差异**：D1 查询可能比 KV 稍慢，但写入无限制
3. **成本考虑**：D1 有不同的计费模式，请查看 Cloudflare 定价
4. **备份建议**：迁移前建议备份重要数据

## 🔍 故障排除

### 常见问题

**Q: 创建数据库时提示权限错误**
A: 确保您已登录 Cloudflare 账户：`wrangler auth login`

**Q: 部署后无法访问 D1 数据库**
A: 检查 `wrangler.toml` 中的数据库 ID 是否正确

**Q: 迁移失败**
A: 检查 D1 数据库是否正确配置，并查看浏览器控制台的错误信息

**Q: 切换存储类型后数据丢失**
A: 不同存储类型的数据是独立的，切换前请先进行数据迁移

**Q: 数据迁移时出现 "table settings has no column named id" 错误**
A: 这是数据库表结构问题，请执行修复脚本：
```bash
wrangler d1 execute misub --file=fix_d1_schema.sql
```

**Q: 保存设置时提示 "保存设置失败"**
A: 这通常是因为 KV 写入限制或存储类型配置问题：
1. 如果使用 KV 存储，可能遇到写入限制，建议迁移到 D1
2. 如果已迁移到 D1，请确保数据库表结构正确
3. 检查浏览器控制台的详细错误信息

### 验证配置

您可以通过以下命令验证 D1 数据库配置：

```bash
# 列出所有 D1 数据库
wrangler d1 list

# 查询数据库表
wrangler d1 execute misub --command="SELECT name FROM sqlite_master WHERE type='table';"
```

## 📞 支持

如果您在配置过程中遇到问题，请：

1. 检查 Cloudflare Workers 控制台的日志
2. 查看浏览器开发者工具的网络和控制台选项卡
3. 确认 wrangler.toml 配置正确
4. 验证数据库表已正确创建

---

配置完成后，您的 MiSub 系统将能够使用 D1 数据库，有效解决 KV 写入限制的问题！
