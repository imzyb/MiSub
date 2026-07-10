# MiSub External Management API 使用说明

本文档面向“要真正开始调用”的使用者，提供一套从启用、认证、资源创建到刷新校验的最短上手路径。

如果你需要完整路由与字段定义，请同时查看：

- 概览文档：`docs/external-management-api.md`
- OpenAPI：`docs/external-management-api.openapi.yaml`

## 1. 前置条件

调用前需要满足：

- MiSub 实例已经正常部署
- 已在 **System Settings → External Management API** 中启用该功能
- 已配置至少一个 Bearer Token

对应设置示例：

```json
{
  "externalApi": {
    "enabled": true,
    "tokens": [
      {
        "name": "default",
        "token": "your-strong-random-token"
      }
    ]
  }
}
```

如果未启用，会返回：

```json
{
  "success": false,
  "error": {
    "code": "forbidden",
    "message": "External API is disabled"
  }
}
```

如果 Token 缺失或错误，会返回：

```json
{
  "success": false,
  "error": {
    "code": "unauthorized",
    "message": "Invalid or missing bearer token"
  }
}
```

## 2. 请求约定

基础路径：

```text
https://your-domain.example/api/ext/v1
```

建议先在 shell 中设置两个环境变量：

```bash
export MISUB_BASE_URL='https://your-domain.example/api/ext/v1'
export MISUB_TOKEN='your-strong-random-token'
```

后续请求统一带：

```bash
-H "Authorization: Bearer $MISUB_TOKEN"
```

如果是 JSON 请求，再加：

```bash
-H 'Content-Type: application/json'
```

## 3. 先做最小可用连通性测试

先确认 API 已启用、Token 正确、路由可达：

```bash
curl -s \
  -H "Authorization: Bearer $MISUB_TOKEN" \
  "$MISUB_BASE_URL/subscriptions"
```

成功时典型返回：

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 50,
    "total": 0,
    "requestId": "req_xxx"
  }
}
```

## 4. 三类资源分别怎么理解

### 4.1 subscriptions

表示**远程订阅源**：

- `url` 必须是 `http://` 或 `https://`
- 会参与远程拉取、节点统计、流量信息提取

适合机场订阅、聚合订阅等远程地址。

### 4.2 manual-nodes

表示**手动节点**：

- `url` 必须是单条节点协议链接
- 不能是 `http(s)`

适合直接保存 `vless://`、`trojan://`、`ss://` 等单节点。

### 4.3 profiles

表示**订阅组**：

- 通过 `subscriptionIds` 引用远程订阅源
- 通过 `manualNodeIds` 引用手动节点

profile 本身不直接内嵌完整资源内容，只维护引用关系。

## 5. 推荐调用顺序

推荐外部系统按下面顺序接入：

1. 连通性测试
2. 校验候选 subscription / manual node
3. 创建 subscription / manual node
4. 创建 profile
5. 给 profile 绑定 subscriptionIds / manualNodeIds
6. 需要时执行 preview / refresh

## 6. 常见操作示例

### 6.1 校验远程订阅源

用于“先试一遍远程地址是否可拉取、可解析”。

```bash
curl -s -X POST \
  -H "Authorization: Bearer $MISUB_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://example.com/subscription.txt",
    "userAgent": "ClashMeta",
    "proxy": ""
  }' \
  "$MISUB_BASE_URL/subscriptions/validate"
```

适用场景：

- 外部面板保存前预检
- 用户输入远程订阅地址后即时校验
- 调试 user-agent / fetch proxy 是否影响拉取结果

### 6.2 创建远程订阅源

```bash
curl -s -X POST \
  -H "Authorization: Bearer $MISUB_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Airport A",
    "url": "https://example.com/subscription.txt",
    "enabled": true,
    "group": "HK",
    "tags": ["prod"],
    "userAgent": "ClashMeta",
    "proxy": "",
    "sortIndex": 1
  }' \
  "$MISUB_BASE_URL/subscriptions"
```

### 6.3 校验手动节点

```bash
curl -s -X POST \
  -H "Authorization: Bearer $MISUB_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "SG-01",
    "url": "trojan://password@example.com:443#SG-01"
  }' \
  "$MISUB_BASE_URL/manual-nodes/validate"
```

适用场景：

- 外部表单在保存前检测节点链接是否合法
- 解析节点协议、名称、基础元信息

### 6.4 创建手动节点

```bash
curl -s -X POST \
  -H "Authorization: Bearer $MISUB_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "SG-01",
    "url": "trojan://password@example.com:443#SG-01",
    "group": "SG",
    "tags": ["manual"],
    "remarks": "from external system"
  }' \
  "$MISUB_BASE_URL/manual-nodes"
```

### 6.5 创建 profile

```bash
curl -s -X POST \
  -H "Authorization: Bearer $MISUB_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Main",
    "description": "default profile",
    "target": "clash",
    "subscriptionIds": [],
    "manualNodeIds": []
  }' \
  "$MISUB_BASE_URL/profiles"
```

### 6.6 给 profile 追加订阅源引用

```bash
curl -s -X POST \
  -H "Authorization: Bearer $MISUB_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "subscriptionIds": ["sub_xxx"]
  }' \
  "$MISUB_BASE_URL/profiles/profile_xxx/subscriptions"
```

### 6.7 给 profile 追加手动节点引用

```bash
curl -s -X POST \
  -H "Authorization: Bearer $MISUB_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "manualNodeIds": ["node_xxx"]
  }' \
  "$MISUB_BASE_URL/profiles/profile_xxx/manual-nodes"
```

### 6.8 刷新单个远程订阅源

```bash
curl -s -X POST \
  -H "Authorization: Bearer $MISUB_TOKEN" \
  "$MISUB_BASE_URL/subscriptions/sub_xxx/refresh"
```

该接口会更新并持久化：

- `nodeCount`
- `userInfo`
- `lastError`
- `lastUpdate`

### 6.9 批量刷新远程订阅源

```bash
curl -s -X POST \
  -H "Authorization: Bearer $MISUB_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "subscriptionIds": ["sub_a", "sub_b"]
  }' \
  "$MISUB_BASE_URL/subscriptions/batch-refresh"
```

适合：

- 外部后台手动触发批量同步
- 周期任务对指定机场做刷新

### 6.10 预览 profile

```bash
curl -s -X POST \
  -H "Authorization: Bearer $MISUB_TOKEN" \
  "$MISUB_BASE_URL/profiles/profile_xxx/preview"
```

注意：

- 这是**轻量预览**
- 当前不会主动拉取远程订阅内容
- 更适合做资源概览，不适合当作真实刷新结果

### 6.11 刷新 profile 下的远程订阅源

```bash
curl -s -X POST \
  -H "Authorization: Bearer $MISUB_TOKEN" \
  "$MISUB_BASE_URL/profiles/profile_xxx/refresh"
```

适合：

- 外部系统希望“一次刷新某个 profile 关联的全部远程订阅”
- 获取聚合后的 `summary.totalNodes`

## 7. 常见集成模式

### 7.1 外部面板保存前校验

推荐流程：

- 远程订阅地址 → `POST /subscriptions/validate`
- 手动节点链接 → `POST /manual-nodes/validate`
- 校验通过后再调用创建接口

优点：

- 减少脏数据进入 MiSub
- 可以把错误尽早反馈给用户

### 7.2 外部系统做资源镜像管理

推荐流程：

- 定期 `GET /subscriptions` / `GET /manual-nodes` / `GET /profiles`
- 基于本地业务系统决定增删改
- 对远程订阅定期调用 `refresh`

### 7.3 按 profile 做同步按钮

如果外部 UI 上有“同步这个配置组”按钮，推荐直接调用：

- `POST /profiles/:profileId/refresh`

这样外部系统不需要自己枚举其关联的 subscriptionIds。

## 8. 需要注意的当前限制

### 8.1 preview 和 refresh 不是一回事

- `preview`：轻量聚合视图
- `refresh`：真实刷新远程订阅，并写回运行时字段

如果你要真实节点数、流量信息、失败原因，应该用 `refresh`。

### 8.2 删除资源会清理 profile 引用

- 删除 subscription 时，会从所有 profile 移除其 ID
- 删除 manual node 时，也会做同样处理

所以外部系统不需要再额外手工清理关联关系。

### 8.3 profile 关联接口是追加/移除语义

- `POST /profiles/:id/subscriptions`：追加并去重
- `DELETE /profiles/:id/subscriptions`：移除指定 ID
- `POST /profiles/:id/manual-nodes`：追加并去重
- `DELETE /profiles/:id/manual-nodes`：移除指定 ID

它们不是“整对象覆盖写入”。

## 9. 最小接入样板

下面是一条从 0 到 1 的最短链路：

1. `GET /subscriptions` 验证 Token 与路由
2. `POST /subscriptions/validate` 校验远程订阅地址
3. `POST /subscriptions` 创建订阅源
4. `POST /profiles` 创建 profile
5. `POST /profiles/:id/subscriptions` 绑定订阅源
6. `POST /profiles/:id/refresh` 获取真实刷新结果

## 10. 进一步查看

如果你要：

- 看完整字段定义 → `docs/external-management-api.openapi.yaml`
- 看真实行为边界 → `docs/external-management-api.md`
- 看整个项目 API 边界 → `docs/api-routes.md`
