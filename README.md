# MiSub

<div align="center">

**一个功能强大、界面精美的订阅管理与转换工具**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-orange.svg)](https://pages.cloudflare.com/)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-green.svg)](https://vuejs.org/)

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [部署指南](#-部署指南) • [使用说明](#-使用说明) • [更新日志](#-更新日志)

</div>

---

## 📸 应用截图

<div align="center">

| 登录界面 | 管理界面 |
|---------|---------|
| ![登录界面](images/1.png) | ![管理界面](images/2.png) |

</div>

---

## ✨ 功能特性

### 🎯 核心功能

- **🗂️ 订阅分组 (Profiles)**
  - 自由组合机场订阅和手动节点
  - 为不同场景生成专属订阅链接
  - 支持全选/全不选,操作便捷
  - 自定义分组名称和订阅链接

- **📦 订阅与节点分离管理**
  - 机场订阅和手动节点独立管理
  - 批量导入自动分类
  - 支持拖拽排序
  - 一键按地区自动排序

- **🎨 精致的 UI/UX**
  - 明亮/暗黑模式自动切换
  - 磨砂玻璃质感现代化设计
  - 完善的交互提示和加载状态
  - 响应式布局,支持移动端

- **🌍 公开主页 (Explore)**
  - 访客模式：无需登录即可预览公开分享的订阅
  - 管理员分享：精选中转/直连机场订阅
  - 一键复制：访客可直接复制订阅链接
  - 客户端推荐：主流全平台客户端下载指引

### 🆕 最新功能

- **📝 订阅备注**
  - 为每个订阅添加备注信息
  - 记录官网、价格、到期时间等
  - 在订阅卡片上清晰显示

- **🌐 自定义 User-Agent**
  - 为每个订阅设置独立的 UA
  - 10+ 常用客户端 UA 预设
  - 解决机场 UA 限制问题

- **🔧 Snell 协议完整支持**
  - 支持 Snell v1-v5
  - 完整的参数支持 (reuse/tfo)
  - Surge 配置导入支持

- **📊 流量与到期时间显示**
  - 订阅卡片显示已用/总流量
  - 到期时间提醒,颜色高亮
  - 自动更新节点数和流量信息

- **🛰️ VPS 探针**
  - 支持节点在线 / 离线 / 恢复 / 过载一体化监控
  - 实时查看 CPU、内存、磁盘、流量与负载曲线
  - 支持 ICMP / TCP / HTTP 网络监测与 Telegram 告警联动
  - 提供一键安装命令、上报地址、节点密钥与公开页 `/vps`
  - 需绑定 D1 数据库 (`MISUB_DB`) 并在设置中切换存储模式为 D1

- **🚫 PWA 已移除**
  - 已彻底禁用 PWA/Service Worker，避免缓存导致的白屏问题

### 💾 双重存储支持

- **Cloudflare KV 存储**
  - 极快的查询速度
  - 适合轻度使用
  - 简单易配置

- **Cloudflare D1 数据库**
  - 无写入频率限制
  - 适合频繁更新
  - 一键数据迁移

### 🔐 安全与定制

- **密码保护**: 管理界面由自定义密码保护
- **高度可定制**: 自定义输出文件名、Subconverter 地址等
- **数据备份**: 支持导出/导入备份
- **TG 推送**: 支持 Telegram 通知

### 🌍 多格式支持

支持主流代理客户端和格式:

| 客户端 | 格式支持 | 自动识别 |
|--------|---------|---------|
| Clash / Clash Meta | ✅ | ✅ |
| Sing-Box | ✅ (Base64) | ✅ |
| Surge | ✅ | ✅ |
| Shadowrocket | ✅ | ✅ |
| V2rayN / V2rayNG | ✅ | ✅ |
| Quantumult X | ✅ | ✅ |
| Loon | ✅ | ✅ |

### 📡 支持的协议

- Shadowsocks (SS/SS2022) - 包含自动修复功能
- ShadowsocksR (SSR)
- VMess
- VLESS
- Trojan
- Hysteria / Hysteria2
- TUIC
- **Snell** - 完整支持 v1-v5
- NaiveProxy
- SOCKS5 / HTTP

---

## 🚀 快速开始

### 前置要求

- Cloudflare 账号
- GitHub 账号

### 一键部署

1. **Fork 本仓库**到你的 GitHub 账号
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
3. 进入 `Workers & Pages` → `创建应用程序` → `Pages` → `连接到 Git`
4. 选择你 Fork 的仓库
5. 配置构建设置:
   - **框架预设**: `Vue`
   - **构建命令**: `npm run build`
   - **构建输出目录**: `dist`
6. 点击 `保存并部署`

---

## 📚 部署指南

### 1. 绑定 KV 命名空间 (必需)

部署完成后,进入项目设置:

1. `设置` → `函数` → `KV 命名空间绑定`
2. 点击 `添加绑定`
3. **变量名称**: `MISUB_KV`
4. **KV 命名空间**: 选择或创建一个 KV 命名空间

### 2. 绑定 D1 数据库 (可选,推荐)

**创建 D1 数据库:**
```bash
wrangler d1 create misub
```

**绑定数据库:**
1. `设置` → `函数` → `D1 数据库绑定`
2. 点击 `添加绑定`
3. **变量名称**: `MISUB_DB`
4. **D1 数据库**: 选择刚创建的数据库

**初始化表结构:**
```bash
wrangler d1 execute misub --file=schema.sql --remote
```

> 💡 若无法初始化,可在 Cloudflare 控制台手动执行 `schema.sql`

> ⚠️ VPS 探针功能必须绑定 D1 数据库 (MISUB_DB)，并在设置中切换存储模式为 D1，未满足将无法使用探针相关功能。
> ⚠️ 若启用网络监测（ICMP/TCP/HTTP），需执行最新的 `schema.sql` 创建 vps_network_targets / vps_network_samples 表。
> ⚠️ 已在使用 D1 的用户升级后也需要在 D1 控制台执行最新 `schema.sql`（新增 vps_network_targets / vps_network_samples 字段和表）。
> ⚠️ VPS 探针新增了 `overload_state_json` 字段，升级后请执行最新 `schema.sql`。

> ⚠️ PWA/Service Worker 已移除，升级后建议清理浏览器缓存与旧的 Service Worker。

若已绑定 D1 并出现如下错误：
`D1_ERROR: table vps_network_targets has no column named scheme`
说明 D1 表结构未更新，请在 D1 控制台执行最新 `schema.sql`。

> 💡 现在支持上报签名校验（HMAC），可在设置中开启，探针脚本会自动携带签名。
> 💡 新增上报间隔与记录间隔配置，用于控制上报频率与历史写入密度。

### 3. 设置环境变量

在 `设置` → `环境变量` 中添加 **生产环境** 变量：

**可选：**

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `ADMIN_PASSWORD` | 管理员登录密码 | `your_secure_password` (未设置则默认为 `admin`) |
| `COOKIE_SECRET` | Cookie 加密密钥 | `64位随机字符串` (推荐留空，系统自动生成) |

**可选（按需设置）：**

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `CORS_ORIGINS` | 允许跨域访问的来源(逗号分隔)，同域可不填 | `https://example.com,http://localhost:5173` |
| `MISUB_PUBLIC_URL` | 对外访问的公开域名，用于订阅转换回调（Docker/反代必填） | `https://your-domain.com` |
| `MISUB_CALLBACK_URL` | 订阅转换回调基础地址（优先级高于 MISUB_PUBLIC_URL） | `http://misub:8080` |

**前端构建变量（可选）：**

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `VITE_ERROR_REPORT_URL` | 前端错误上报地址，不需要上报可不填 | `/api/system/error_report` |

> 提示：启用错误上报后会发送页面地址与浏览器信息等运行数据，请根据隐私与合规要求进行评估与披露。

### 4. 重新部署

完成配置后,在 `部署` 选项卡重新部署项目。

---
<s>
## 🐳 VPS / Docker 部署

适用于自建服务器部署（与 Cloudflare Pages 保持功能兼容）。

### 1. 构建并启动

```bash
docker compose up -d --build
```

默认端口为 `8080`，访问 `http://<vps-ip>:8080`。

> ⚠️ 注意：仓库根目录的 `docker-compose.yml` 为 **镜像部署** 配置（默认 `ghcr.io/imzyb/misub:latest`）。如需源码构建，请自行新建包含 `build: .` 的 compose 文件。

### 2. 环境变量

在 `docker-compose.yml` 中配置：

- `ADMIN_PASSWORD` 管理员密码（可选，默认 `admin`）
- `COOKIE_SECRET` Cookie 加密密钥（可选，推荐留空自动生成）
- `CORS_ORIGINS` 允许跨域访问的来源（可选）
- `PORT` 服务端口（默认 8080）
- `MISUB_DB_PATH` SQLite 数据库路径（默认 `/app/data/misub.db`）
- `MISUB_PUBLIC_URL` 对外访问的公开域名，用于订阅转换回调（反代/公网环境建议配置）
- `MISUB_CALLBACK_URL` 订阅转换回调基础地址（优先级高于 MISUB_PUBLIC_URL）

> ⚠️ **关于修改 PORT**：如果将 `PORT` 修改为非 8080 的值（如 `3000`），需要同步修改 `docker-compose.yml` 中的 `ports` 映射，例如 `"3000:3000"`，确保宿主机端口与容器内端口一致。

### 3. 数据持久化

默认通过 `./data` 目录持久化数据库文件。

---

## 📦 GHCR 镜像部署（免源码）

最小化 VPS 部署步骤：

1. 新建目录并进入：
```bash
mkdir -p /opt/misub && cd /opt/misub
```

2. 创建 `docker-compose.yml`（使用 GHCR 镜像）：
```yaml
services:
  misub:
    image: ghcr.io/imzyb/misub:latest
    ports:
      - "8080:8080"
    environment:
      PORT: 8080
      MISUB_DB_PATH: /app/data/misub.db
      ADMIN_PASSWORD: "change_me"
      COOKIE_SECRET: "change_me_too"
      # CORS_ORIGINS: "https://example.com,http://localhost:5173"
      # MISUB_PUBLIC_URL: "https://your-domain.com"
      # MISUB_CALLBACK_URL: "https://your-domain.com"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

3. 启动并拉取镜像：
```bash
docker compose pull
docker compose up -d
```

4. 访问：
```
http://<vps-ip>:8080
```

---

## ☁️ Zeabur 一键部署

支持通过 [Zeabur](https://zeabur.com) 平台一键部署：

[![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/O066B9)

### 手动部署步骤

1. 在 Zeabur 创建新项目，选择 **从 Git 部署**
2. 连接 GitHub 并选择你 Fork 的 MiSub 仓库
3. 等待构建完成（使用 Docker 方式构建）
4. 在服务设置中添加环境变量：

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `ADMIN_PASSWORD` | 管理员密码 | ❌ (默认 `admin`) |
| `COOKIE_SECRET` | Cookie 加密密钥 | ❌ (自动生成) |
| `MISUB_DB_PATH` | 数据库路径（建议 `/app/data/misub.db`） | ✅ |

5. 绑定域名或使用 Zeabur 提供的 `.zeabur.app` 域名

> ⚠️ **注意**: Zeabur 部署默认使用端口 8080，已在 `zeabur.json` 中配置。
> ⚠️ **注意**: 请在 Zeabur 中启用持久化存储并挂载到 `/app/data`，否则数据库会在重建后丢失。
</s>

## 💡 使用说明

### 登录管理界面

1. 部署完成后，公开页面默认 **不开启**（访问域名会显示伪装页）。
2. 请直接访问 `您的域名/login` 进入登录页面。
3. 输入设置的 `ADMIN_PASSWORD` 即可进入管理后台。
    - **注意**：如果未设置 `ADMIN_PASSWORD`，默认密码为 **`admin`**。
    - **首次登录**：使用默认密码登录后，系统会提示您立即在「设置」->「基础设置」中修改密码。

### 添加订阅

1. 点击 `新增订阅`
2. 填写订阅名称和链接
3. (可选) 设置自定义 UA
4. (可选) 添加备注信息
5. (可选) 设置过滤规则
6. 保存订阅

### 创建订阅组

1. 在右侧面板点击 `新增订阅组`
2. 选择要包含的订阅和节点
3. 设置分组名称
4. 保存并获取订阅链接

### SubConverter 后端对齐说明

MiSub 通过 SubConverter 后端进行订阅格式转换，核心调用路径为 `/sub`，并基于客户端 User-Agent 或 URL 参数决定输出格式。

支持的常见参数（与 SubConverter 文档一致，使用时需要 URLEncode 的参数会由后端处理）：

- `target`：目标格式（`clash` / `surge&ver=4` / `loon` / `quanx` / `base64`）
- `url`：订阅链接或节点分享链接（可合并多链接）
- `config`：远程规则配置（仅对 Clash/Surge/Loon 生效）
- `scv`：跳过 TLS 证书校验（默认关闭）
- `udp`：开启 UDP（默认关闭）
- `emoji`：节点名称 Emoji（按重命名模板自动启用）

MiSub 的几个适配细节：

- `surge` 目标会自动补齐版本为 `surge&ver=4`（可用 `?target=surge&ver=3` 指定版本）。
- Surge 客户端不识别 `snell://` 订阅链接，建议确保 SubConverter 能输出原生 `snell, server, port, psk=..., version=...` 格式的 Surge 配置。
- `sing-box` 与 `singbox` 会自动落到 Base64 输出（SubConverter 目前无 sing-box 目标）。
- `quanx` 需要显式参数（`?quanx` 或 `?target=quanx`）或对应的 User-Agent。

如需检查后端可用性，可在设置页使用“测试可用性”按钮访问 `/api/test_subconverter`。

### 数据迁移 (KV → D1)

如果已在使用 KV 存储,想迁移到 D1:

1. 配置 D1 数据库 (参考部署指南)
2. 登录管理界面,进入 `设置`
3. 点击 `迁移数据到 D1 数据库`
4. 确认迁移,等待完成

### 🛰️ VPS 探针使用指南

#### 使用步骤

1. **准备环境**
   - 绑定 `MISUB_DB`，并在后台将存储模式切换为 `D1`
   - 在 D1 控制台执行最新 `schema.sql`
   - 如需接收告警，建议先完成 Telegram 通知配置

2. **新增监控节点**
   - 进入后台的 `VPS 探针`
   - 填写节点名称、标签、分组、地区、月流量限额等信息
   - 按需开启“应用全局监测目标”，复用统一的网络监测配置

3. **部署探针脚本**
   - 点击节点右侧的 `安装`
   - 复制一键安装命令，或使用页面提供的 `reportUrl`、`nodeId`、`nodeSecret`
   - 在被监控 VPS 上执行并保持定时上报，**推荐上报频率为 `60 秒`**

4. **查看与分享**
   - 后台可查看在线状态、资源曲线、流量统计与告警动态
   - 若开启公开页，可通过 `/vps` 访问；如配置了公开页 Token，则使用 `/vps?token=xxx`

#### 功能特点

- **状态监控**：自动识别节点在线、离线、恢复与过载状态
- **资源统计**：支持 CPU、内存、磁盘、负载、累计上下行流量与月流量限额展示
- **网络监测**：支持 `ICMP` / `TCP` / `HTTP` 目标检测，适合排查线路波动
- **告警联动**：复用 Telegram 通知设置，推送离线、恢复、负载异常消息
- **公开展示**：支持 VPS 探针公开页、自定义标题文案与节点展示布局

#### 注意事项

- VPS 探针 **仅支持 `D1` 存储模式**，`KV` 模式下不可用
- 升级后若遇到表结构报错，请在 D1 中重新执行最新 `schema.sql`
- 如果启用了 **HMAC 上报签名校验**，请确保探针脚本与后台密钥一致
- `nodeSecret` 和公开页 `token` 都属于敏感信息，请勿泄露给他人
- 不建议把上报间隔设置得过低，通常 `60 秒` 已足够稳定

### 🛰️ 代理抓取 (Vercel)

如果您的服务器 IP 不太纯净，或者由于网络限制导致抓取订阅内容失败，可以使用高效的 Edge Functions 代理：
- [Vercel Fetch Proxy 部署指南](docs/fetch-proxy-tutorial.md)

---

## 📊 存储类型对比

| 特性 | KV 存储 | D1 数据库 |
|------|---------|-----------|
| **写入限制** | 1000次/天 | 无限制 |
| **查询速度** | 极快 | 快 |
| **适用场景** | 读多写少 | 频繁更新 |
| **配置复杂度** | 简单 | 中等 |
| **推荐使用** | 轻度使用 | 重度使用 |

**选择建议:**
- 🔰 **新用户**: 建议直接配置 D1,避免写入限制
- 📈 **现有用户**: 遇到限制可使用迁移工具
- ⚡ **轻度使用**: KV 完全够用,速度更快
- 🚀 **重度使用**: D1 是最佳选择

---

## 🛠️ 技术栈

- **前端**: Vue 3 + Vite + Tailwind CSS
- **后端**: Cloudflare Pages Functions
- **存储**: Cloudflare KV + D1 数据库
- **部署**: Cloudflare Pages

---

## 📝 更新日志

### v2.4.0 (2026-01-14)

**✨ 重点更新：VPS 探针功能上线**
- **新增 VPS 探针** - 项目正式加入 VPS 节点监控能力，可统一管理在线状态与资源上报
- **资源与流量可视化** - 支持 CPU、内存、磁盘、负载、上下行流量的集中展示
- **网络监测与告警** - 支持 `ICMP` / `TCP` / `HTTP` 检测，并联动 Telegram 推送离线、恢复、过载提醒
- **公开页分享** - 支持通过 `/vps` 对外展示探针数据，便于公开状态页或自用巡检


### v2.3.0 (2026-01-03)

**✨ 重要更新:**
- **订阅与节点管理重构** - 订阅编辑、配置文件、节点管理与设置模块全面重构，新增节点筛选、规则编辑与统计卡片
- **订阅管理能力增强** - 新增订阅管理模块，支持多协议转换，强化手动节点管理
- **统一 ID 与数据流** - 引入统一 ID 生成工具，订阅/配置/节点数据整合到 `useDataStore`，移除旧备份与过时认证模块

**🛠️ 接口与安全:**
- **统一 API 响应** - 统一错误处理与响应格式，新增订阅解析模块
- **安全与请求** - 引入 DOMPurify 清理 SVG，API 调用迁移到 `lib/http.js`，优化 CORS 并新增错误上报

**🔧 工具与开发体验:**
- **日志与工具函数** - 优化日志级别与调试输出，统一 timing 常量，`formatBytes` 迁移到共享工具，更新地理工具函数
- **路由与构建** - 新增 Vite 代理规则，移除 `PublicProfilesView` 路由，首页增加 `/explore` 别名
- **测试覆盖** - 新增节点缓存服务单元测试

### v2.2.0 (2026-01-02)

**✨ 核心功能更新:**
- **可视化节点筛选** - 全新的节点规则编辑器，支持标签化管理包含/排除关键词，内置常用地区与协议标签，配置更轻松
- **自定义公开页 Hero** - 支持在后台自定义公共主页的标题与标语，打造个性化门户
- **留言板增强** - 新增数学验证码 (Captcha) 防护机制，优化提交成功反馈体验
- **交互体验优化** - 留言板禁用时提供友好的 Toast 提示，优化移动端入口逻辑

**🎨 界面重构:**
- **设置页全新设计** - 基础设置与服务集成页面采用现代化卡片式布局，功能分区更清晰
- **视觉优化** - 统一了图标风格与色彩系统，优化深色模式体验
- **二维码组件** - 修复二维码遮罩层级与交互问题

**⚡️ 其他改进:**
- **客户端识别升级** - 增强对 Surge、Stash 等客户端的 User-Agent 识别准确度
- **API 修正** - 修复公开配置接口字段缺失问题，增强后端数据安全性

### v2.1.0 (2025-12-30)

**新增功能:**
- ✨ **公开主页 (Explore)** - 访客可无需登录浏览精选订阅
- ✨ **访客模式** - 支持公共资源分享与客户端下载指引
- ✨ **新版登录流程** - 统一入口，更加安全便捷
- 🎨 **布局优化** - 适配公开页与仪表盘的无缝切换

**改进优化:**
- 🎨 优化订阅卡片显示
- 🐛 修复 SS2022 节点错误
- 📚 完善文档和使用说明

### v2.0.0 (2025-12-22)

**新增功能:**
- ✨ 订阅备注功能 - 记录官网、价格等信息
- ✨ 自定义 User-Agent - 解决机场 UA 限制
- ✨ Snell 协议完整支持 - 包含 reuse/tfo 参数
- ✨ Snell 协议完整支持 - 包含 reuse/tfo 参数
- ✨ Surge 配置解析增强 - 支持更多参数

### v1.5.0

**新增功能:**
- ✨ D1 数据库支持 - 解决 KV 写入限制
- ✨ 一键数据迁移工具
- ✨ 存储类型选择

### v1.0.0

**核心功能:**
- 🎯 订阅分组 (Profiles)
- 📦 订阅与节点分离管理
- 🎨 全新 UI 设计
- 🔐 密码保护

---

## 🙏 致谢

本项目基于 [CF-Workers-SUB](https://github.com/cmliu/CF-Workers-SUB) 项目发展而来,感谢 CM 大佬的开源贡献。

---

## 📄 License

[MIT](LICENSE)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

---

<div align="center">

**如果这个项目对你有帮助,请给个 ⭐ Star 支持一下!**

Made with ❤️ by AI

</div>
