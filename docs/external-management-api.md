# MiSub External Management API

本文档记录 MiSub 当前对外管理接口的真实行为，对应代码位于：

- `functions/modules/external-api-router.js`
- `functions/modules/external-api-auth.js`
- `functions/modules/external-subscriptions-handler.js`
- `functions/modules/external-manual-nodes-handler.js`
- `functions/modules/external-profiles-handler.js`
- `functions/modules/external-preview-handler.js`
- OpenAPI 文件：`docs/external-management-api.openapi.yaml`
- 使用说明：`docs/external-management-api-usage.md`

## 1. 目标与边界

External Management API 面向“外部系统受控接入”场景，用于让自动化工具或第三方后台安全地管理 MiSub 的：

- 远程订阅源（subscriptions）
- 手动节点（manual-nodes）
- 订阅组（profiles）
- 订阅组轻量预览（preview）

它不是普通 Web 管理后台的替代品，和现有 `/api/*` Cookie 登录管理接口是两套边界：

- `/api/*`：面向浏览器管理后台，默认使用登录 Cookie
- `/api/ext/v1/*`：面向外部系统，统一使用 Bearer Token

## 2. 启用方式

需要先在设置页 **System Settings → External Management API** 中启用，并配置 Bearer Token。

对应设置结构：

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

说明：

- 当前实现支持多个 token，但设置页目前默认只编辑第一个 token。
- 如果 `externalApi.enabled !== true`，所有请求统一返回 `403 forbidden`。
- 如果缺少或传错 `Authorization: Bearer <token>`，统一返回 `401 unauthorized`。

## 3. 基础约定

### 3.1 基础路径

```text
/api/ext/v1
```

### 3.2 认证头

```http
Authorization: Bearer <token>
Content-Type: application/json
```

### 3.3 成功响应

```json
{
  "success": true,
  "data": {}
}
```

列表接口会额外返回 `meta`：

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 50,
    "total": 2,
    "requestId": "req_xxx"
  }
}
```

### 3.4 错误响应

```json
{
  "success": false,
  "error": {
    "code": "unauthorized",
    "message": "Invalid or missing bearer token"
  }
}
```

## 4. 资源语义

这是这套 API 最重要的约束。

### 4.1 subscriptions

只表示 **远程订阅源**，必须满足：

- `url` 为 `http://` 或 `https://`

不会返回任何手动节点。

### 4.2 manual-nodes

只表示 **手动节点**，必须满足：

- `url` 不是 `http(s)`
- `url` 必须匹配受支持的节点协议，如：
  - `ss://`
  - `ssr://`
  - `vmess://`
  - `vless://`
  - `trojan://`
  - `hysteria://`
  - `hysteria2://`
  - `hy://`
  - `hy2://`
  - `tuic://`
  - `anytls://`
  - `socks5://`
  - `socks://`
  - `snell://`
  - `naive+https://`
  - `naive+quic://`
  - `naive+http://`
  - `wireguard://`

不会返回任何远程订阅源。

### 4.3 profiles

对外字段固定为：

- `subscriptionIds`
- `manualNodeIds`

内部存储字段 `subscriptions` / `manualNodes` 不对外暴露。

## 5. 路由总览

### 5.1 subscriptions

- `GET /subscriptions`
- `POST /subscriptions`
- `POST /subscriptions/validate`
- `POST /subscriptions/batch-refresh`
- `GET /subscriptions/:subscriptionId`
- `PATCH /subscriptions/:subscriptionId`
- `DELETE /subscriptions/:subscriptionId`
- `POST /subscriptions/:subscriptionId/refresh`

支持查询参数：

- `page`
- `pageSize`
- `enabled=true|false`
- `group=<group>`
- `keyword=<keyword>`

### 5.2 manual-nodes

- `GET /manual-nodes`
- `POST /manual-nodes`
- `POST /manual-nodes/validate`
- `GET /manual-nodes/:manualNodeId`
- `PATCH /manual-nodes/:manualNodeId`
- `DELETE /manual-nodes/:manualNodeId`

支持查询参数：

- `page`
- `pageSize`
- `enabled=true|false`
- `group=<group>`
- `protocol=<protocol>`
- `keyword=<keyword>`

### 5.3 profiles

- `GET /profiles`
- `POST /profiles`
- `GET /profiles/:profileId`
- `PATCH /profiles/:profileId`
- `DELETE /profiles/:profileId`
- `POST /profiles/:profileId/subscriptions`
- `DELETE /profiles/:profileId/subscriptions`
- `POST /profiles/:profileId/manual-nodes`
- `DELETE /profiles/:profileId/manual-nodes`
- `POST /profiles/:profileId/preview`
- `POST /profiles/:profileId/refresh`

列表支持查询参数：

- `page`
- `pageSize`
- `enabled=true|false`
- `keyword=<keyword>`

## 6. 数据结构

### 6.1 Subscription

```json
{
  "id": "sub_xxx",
  "type": "subscription",
  "name": "Airport A",
  "url": "https://example.com/sub",
  "enabled": true,
  "group": "HK",
  "tags": ["prod"],
  "userAgent": "",
  "proxy": "",
  "nodeCount": 128,
  "userInfo": {
    "upload": 1024,
    "download": 2048,
    "total": 4096,
    "expire": 1790000000
  },
  "lastError": "",
  "lastUpdate": "2026-07-10T18:05:00.000Z",
  "sortIndex": 1,
  "createdAt": "2026-07-10T18:00:00.000Z",
  "updatedAt": "2026-07-10T18:05:00.000Z"
}
```

### 6.2 Manual Node

```json
{
  "id": "node_xxx",
  "type": "manual_node",
  "name": "HK-01",
  "url": "vless://...",
  "protocol": "vless",
  "enabled": true,
  "group": "HK",
  "tags": ["manual"],
  "remarks": "",
  "sortIndex": 2,
  "createdAt": "2026-07-10T18:00:00.000Z",
  "updatedAt": "2026-07-10T18:00:00.000Z"
}
```

### 6.3 Profile

```json
{
  "id": "profile_xxx",
  "name": "Main",
  "description": "",
  "enabled": true,
  "isPublic": false,
  "customId": "",
  "subscriptionIds": ["sub_1"],
  "manualNodeIds": ["node_1"],
  "target": "clash",
  "sortIndex": 1,
  "createdAt": "2026-07-10T18:00:00.000Z",
  "updatedAt": "2026-07-10T18:00:00.000Z"
}
```

## 7. 关键行为

### 7.1 删除资源时自动清理 profile 引用

- 删除 subscription 后，会从所有 profile 的 `subscriptions` 中移除该 ID
- 删除 manual node 后，会从所有 profile 的 `manualNodes` 中移除该 ID

返回值会包含：

```json
{
  "success": true,
  "data": {
    "deleted": true,
    "id": "sub_xxx",
    "removedFromProfiles": ["profile_1", "profile_2"]
  }
}
```

### 7.2 profile 关联接口是“追加/移除”语义

- `POST /profiles/:id/subscriptions`：追加并自动去重
- `DELETE /profiles/:id/subscriptions`：移除指定 ID
- `POST /profiles/:id/manual-nodes`：追加并自动去重
- `DELETE /profiles/:id/manual-nodes`：移除指定 ID

这些接口不会 merge 非目标字段，只更新对应引用数组。

### 7.3 validate / refresh 系列接口会读取真实运行时信息

#### `POST /subscriptions/validate`

用于第三方在创建/更新前校验候选远程订阅源：

- 只接受 `http://` / `https://` URL
- 会实际请求远程订阅内容
- 会尝试解析节点数量
- 会读取 `subscription-userinfo`
- 不写入存储

返回核心字段：

- `valid`
- `requestedUrl`
- `effectiveUserAgent`
- `fetchProxyUsed`
- `nodeCount`
- `userInfo`
- `checkedAt`

#### `POST /subscriptions/:id/refresh`

刷新单个已存储远程订阅源，并持久化：

- `nodeCount`
- `userInfo`
- `lastError`
- `lastUpdate`

#### `POST /subscriptions/batch-refresh`

批量刷新多个已存储远程订阅源，返回：

- `results[]`
- `summary.total`
- `summary.succeeded`
- `summary.failed`
- `summary.totalNodes`

#### `POST /manual-nodes/validate`

用于校验候选手动节点链接：

- 只接受受支持协议（如 `vless://`、`trojan://`、`ss://`）
- 使用本地解析器解析单条节点
- 不写入存储

返回核心字段：

- `valid`
- `requestedName`
- `requestedUrl`
- `protocol`
- `nodeCount`
- `parsedNode`
- `checkedAt`

#### `POST /profiles/:id/refresh`

刷新 profile 里引用的所有远程订阅源，并汇总返回：

- `profile`
- `results[]`
- `summary.totalSubscriptions`
- `summary.refreshedSubscriptions`
- `summary.failedSubscriptions`
- `summary.manualNodes`
- `summary.totalNodes`

其中：

- `manualNodes` 直接按当前引用数量统计
- `totalNodes = 成功刷新的远程订阅节点总数 + 手动节点数量`
- 失败的远程订阅也会把 `lastError` / `lastUpdate` 持久化回库

### 7.4 preview 仍是轻量预览，不拉远程订阅内容

当前 `POST /profiles/:id/preview` 只做轻量聚合：

- 返回 profile 对外 DTO
- 统计远程订阅源数量
- 统计手动节点数量
- `totalNodes` 当前等于手动节点数量
- 按协议统计手动节点
- 返回 sources 摘要

当前不会实际拉取远程订阅内容，也不会生成完整节点预览。

## 8. 示例

### 8.1 列出远程订阅源

```bash
curl -s \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  'https://your-domain.example/api/ext/v1/subscriptions?page=1&pageSize=50'
```

### 8.2 创建手动节点

```bash
curl -s -X POST \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "HK-01",
    "url": "vless://uuid@example.com:443?security=tls#HK-01",
    "group": "HK"
  }' \
  'https://your-domain.example/api/ext/v1/manual-nodes'
```

### 8.3 创建订阅组

```bash
curl -s -X POST \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Main",
    "subscriptionIds": ["sub_1"],
    "manualNodeIds": ["node_1"],
    "target": "clash"
  }' \
  'https://your-domain.example/api/ext/v1/profiles'
```

### 8.4 校验候选手动节点

```bash
curl -s -X POST \
  -H 'Authorization: Bearer ***' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "SG-01",
    "url": "trojan://password@example.com:443#SG-01"
  }' \
  'https://your-domain.example/api/ext/v1/manual-nodes/validate'
```

### 8.5 刷新单个远程订阅源

```bash
curl -s -X POST \
  -H 'Authorization: Bearer ***' \
  'https://your-domain.example/api/ext/v1/subscriptions/sub_1/refresh'
```

### 8.6 刷新 profile 下的远程订阅源

```bash
curl -s -X POST \
  -H 'Authorization: Bearer ***' \
  'https://your-domain.example/api/ext/v1/profiles/profile_1/refresh'
```

### 8.7 获取轻量预览

```bash
curl -s -X POST \
  -H 'Authorization: Bearer ***' \
  'https://your-domain.example/api/ext/v1/profiles/profile_1/preview'
```

## 9. 错误码约定（当前实现）

常见错误码：

- `unauthorized`
- `forbidden`
- `not_found`
- `method_not_allowed`
- `subscription_not_found`
- `manual_node_not_found`
- `profile_not_found`
- `subscription_name_required`
- `subscription_url_required`
- `invalid_subscription_url`
- `manual_node_name_required`
- `manual_node_url_required`
- `invalid_manual_node_url`
- `profile_name_required`
- `subscription_id_not_found`
- `manual_node_id_not_found`
- `invalid_profile_reference`

## 10. 当前限制

- 认证只支持 Bearer Token，不支持 Cookie 复用
- 设置页当前默认只编辑第一个 token
- preview 仅是轻量预览，不解析远程订阅内容
- 没有 batch / validate / refresh 第二阶段接口
- OpenAPI 文档描述的是当前真实实现，不包含尚未落地的能力
