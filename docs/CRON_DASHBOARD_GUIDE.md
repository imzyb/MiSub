# 🎉 Cron Triggers 管理面板使用指南

## 📍 访问路由

### 管理面板地址
```
https://your-domain.pages.dev/cron-dashboard
```

将 `your-domain` 替换为你的实际Cloudflare Pages域名。

### API 路由
```
GET  /api/cron/status     - 获取同步状态
POST /api/cron/trigger    - 手动触发同步
```

---

## 🚀 功能说明

### 1️⃣ 状态查看
- **总订阅数**: 当前配置的订阅数量
- **成功同步**: 本次同步中成功的订阅数
- **失败同步**: 本次同步中失败的订阅数
- **上次同步**: 上一次成功同步的时间

### 2️⃣ 手动同步
- 点击"手动同步"按钮可立即触发一次订阅同步
- 同步过程中按钮会禁用，显示"同步中..."
- 同步完成后会显示结果提示

### 3️⃣ 同步日志
- 实时显示同步的详细日志
- 成功的同步日志显示为绿色
- 失败的同步日志显示为红色
- 最多显示最近50条日志

### 4️⃣ 自动刷新
- 管理面板会每30秒自动刷新一次状态
- 无需手动刷新即可看到最新数据

---

## ⚙️ 配置说明

### Cron 定时配置

在 `wrangler.toml` 中配置定时任务：

```toml
[triggers]
crons = [
  "0 * * * *",      # 每小时整点执行（0分钟）
  "0 8 * * *",      # 每天早上8点执行
  "*/30 * * * *"    # 每30分钟执行一次
]
```

### 自定义配置

在 `functions/modules/config.js` 中可以调整：

```javascript
export const DEFAULT_SETTINGS = {
    // Cron相关配置
    enableSubscriptionSync: true,     // 启用同步
    enableTrafficMonitor: true,       // 启用流量监控
    enableIOSCache: true,             // 启用iOS缓存
    maxConcurrentSyncs: 5,            // 最大并发同步数
    syncTimeoutMs: 30000,             // 同步超时时间
    cacheTTLMs: 600000,               // 缓存TTL (10分钟)
};
```

---

## 📊 数据存储

### KV 存储
- **cron_sync_status**: 最近一次同步的状态信息
- **subscriptions**: 订阅列表数据
- **subscription_***: 订阅缓存数据

### D1 数据库
如果配置了D1，同步状态也会保存到数据库表：
- `subscriptions` - 订阅表
- `sync_logs` - 同步日志表（可选）

---

## 🔧 故障排查

### Q: 管理面板无法打开
**A**: 检查URL是否正确，应该是 `/cron-dashboard`（注意没有 `.html` 扩展名）

### Q: 点击同步后提示"API route not found"
**A**: 确保以下文件存在：
- `functions/api/[[path]].js` - API处理器
- `functions/cron-dashboard.js` - 管理面板

### Q: 同步一直显示"同步中..."
**A**: 可能是：
1. 网络连接问题
2. 订阅源不可用
3. Cloudflare Pages CPU时间限制（10秒）

### Q: 显示"同步失败 - API route not found"
**A**: 这表示 `functions/api/[[path]].js` 没有正确处理请求。检查：
1. 确保文件在正确的路径
2. 确保部署时包含了该文件
3. 检查Cloudflare Pages的部署日志

---

## 📈 性能优化

### 同步时间
- 单次同步限制: 4秒
- 单个订阅源超时: 2秒
- 这样可以在Cloudflare Pages 10秒CPU限制内完成多个订阅的同步

### 并发控制
- 最多同时同步5个订阅
- 防止并发请求过多导致超时

### 缓存策略
- iOS客户端缓存: 5分钟TTL
- KV存储同步状态: 1小时TTL
- 自动清理过期缓存

---

## 🔐 安全注意事项

### 当前限制
- 管理面板没有身份验证
- 任何人都可以访问 `/cron-dashboard` 路由
- 任何人都可以调用 `/api/cron/trigger`

### 建议改进
可以添加身份验证（示例）：

```javascript
// 在 functions/cron-dashboard.js 中添加
const ADMIN_TOKEN = 'your-secret-token';

function checkAuth(request) {
    const token = new URL(request.url).searchParams.get('token');
    return token === ADMIN_TOKEN;
}

export async function onRequest(context) {
    if (!checkAuth(context.request)) {
        return new Response('Unauthorized', { status: 401 });
    }
    // 继续处理...
}
```

---

## 📱 移动设备支持

管理面板已优化为响应式设计，可以在以下设备上正常使用：
- ✅ PC 浏览器
- ✅ 平板设备
- ✅ 手机浏览器

---

## 🚀 部署步骤

### 1. 本地验证
```bash
npm run test:run
```

### 2. 更新 wrangler.toml
```toml
[triggers]
crons = ["0 * * * *", "0 8 * * *", "*/30 * * * *"]
```

### 3. 部署到 Cloudflare Pages
```bash
npm run deploy
# 或
wrangler pages deploy
```

### 4. 验证部署
访问 `https://your-domain.pages.dev/cron-dashboard`

### 5. 测试手动同步
- 打开管理面板
- 点击"手动同步"按钮
- 确认成功响应

---

## 📚 相关文档

- [HOW_TO_VERIFY.md](HOW_TO_VERIFY.md) - 验证本次更新
- [SESSION_VERIFICATION_REPORT.md](SESSION_VERIFICATION_REPORT.md) - 详细报告
- [VERIFICATION_CHECKLIST.md](VERIFICATION_CHECKLIST.md) - 完整清单

---

## 🆘 常见问题

### Q: API 返回 404 错误
**原因**: `functions/api/[[path]].js` 不存在或路由配置错误

**解决方案**:
1. 检查文件是否存在: `ls functions/api/`
2. 检查文件名是否正确: `[[path]].js`（注意双方括号）
3. 重新部署: `npm run deploy`

### Q: 同步状态一直为空
**原因**: 还没有执行任何同步，或者KV存储不可用

**解决方案**:
1. 点击"手动同步"按钮
2. 确保KV_STORAGE环境变量已配置
3. 检查Cloudflare Pages日志

### Q: 管理面板加载缓慢
**原因**: 网络连接问题或Functions响应慢

**解决方案**:
1. 刷新页面
2. 检查浏览器控制台错误
3. 查看Cloudflare Pages性能日志

---

## 💡 建议

1. **定期备份**: 定期导出重要的订阅配置
2. **配置告警**: 可以集成Telegram/邮件通知失败的同步
3. **性能监控**: 使用Cloudflare Analytics Engine监控同步性能
4. **错误分析**: 保存同步日志，分析失败原因

---

**最后更新**: 2026-04-01  
**版本**: 1.0.0