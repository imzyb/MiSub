# MiSub 后端技术细节 (Technical Details)

本文档面向开发者，详细说明 MiSub 后端（Cloudflare Pages Functions）的关键技术实现。

---

## 1. 节点处理流水线 (Processing Pipeline)

节点处理由 `functions/services/subscription-service.js` 驱动。完整流程如下：

1. **组合 (Combination)**：从 D1/KV 获取订阅源（Subscriptions）和手动节点（Manual Nodes）。
2. **清洗 (Cleaning)**：初步修复破损的节点 URL，移除已知无法识别的非法字符。
3. **执行操作符链 (Operator Chain Executor)**：
   - 优先级：`订阅组操作符 (Profile Operators)` > `全局操作符 (Global Operators)`。
   - 兼容逻辑：若两者皆无且存在旧版配置，则通过 `adaptLegacyTransform` 进行桥接。
4. **格式生成 (Generator)**：将处理后的通用节点模型转换为 Clash、Sing-Box 等目标格式。

---

## 2. 操作符运行引擎 (Operator Runner)

执行引擎位于 `functions/utils/operator-runner.js`。

### 脚本执行沙箱 (Script Sandbox)
为了支持自定义逻辑，我们实现了 JavaScript 脚本操作符。
- **实现方式**：基于 `AsyncFunction` 构建闭包。
- **传入上下文**：
  - `$nodes`: 原始节点数组的深拷贝。
  - `$context`: 包含 `target` (目标格式), `userAgent`, `timestamp` 等。
  - `$utils`: 提供 `formatBytes`, `getRegionCode` 等内置工具。

> [!WARNING]
> **安全局限性**：由于 Cloudflare Workers 环境暂不支持完整的 WASM 沙箱（如 V8 Isolate），目前的脚本执行虽然处于闭包中，但无法实现 100% 的恶意代码防御（如无限循环攻击）。建议仅运行受信任的脚本。

### 性能优化
- **Immutable 操作**：操作符内部尽量减少对原数组的修改，使用 map/filter 返回新数组，减少内存碎片。
- **正则预编译**：常用的地区识别正则在 Worker 启动时进行一次性编译。

---

## 3. 存储适配层 (Storage Adapter)

为了同时支持 KV 和 D1，我们实现了一个抽象层 `functions/storage-adapter.js`：
- **混合模式**：读请求优先从 KV（如果开启了缓存）或 D1 读取。
- **事务模拟**：由于 KV 不支持事务，涉及多表操作时，Adapter 会执行乐观锁重试逻辑。

---

## 4. 节点解析逻辑

解析器位于 `functions/modules/subscription/parser.js`。其核心是一个多阶段识别引擎：
1. **Base64 探测**：识别内容是否为经过编码的节点列表。
2. **格式分发**：根据关键字识别 YAML (Clash), JSON, 或 URL Scheme 列表。
3. **协议提取**：逐行提取协议参数，并归一化为统一的 `ProxyNode` 对象。
