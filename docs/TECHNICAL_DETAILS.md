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

### QuickJS 脚本沙箱

旧版同步 JavaScript 由 `functions/utils/quickjs-sandbox.js` 在独立的
QuickJS/Wasm Runtime 中执行。宿主侧不调用 `eval` 或 `Function`，也不向来宾
运行时暴露网络、存储、环境变量或 Worker 全局能力。

- **资源限制**：限制脚本、输入、输出、节点数量、内存、栈和执行时间。
- **输入隔离**：节点及有限上下文通过 JSON 复制进入沙箱。
- **输出校验**：结果必须是字段有效的节点对象数组，随后重新同步节点 URL。
- **失败回退**：语法错误、超限、死循环或无效输出均保留进入该操作符前的节点。
- **远程代码**：不加载 `url` 配置，只执行管理员明确保存的内联代码。

### 安全规则引擎 (Safe Rules)

简单转换也可使用受限的声明式 DSL，不执行任意 JavaScript。

- **条件**：字段比较、包含、正则、`when` 与 `unless`。
- **转换**：模板重命名、按 `groupBy` 分组编号。
- **顺序**：通过规则 `rank` 标记和稳定 `sort` 操作调整类别顺序。
- **上下文**：节点名称、协议、地区、Emoji、服务器、端口和目标格式。

旧版内联 `code` 会自动进入 QuickJS 沙箱；远程 `url` 仅用于显示迁移提示，不会加载。

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
