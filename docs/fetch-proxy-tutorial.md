# Vercel Edge Functions Fetch Proxy 部署指南

> 说明：本文档介绍的是可选的抓取代理组件，用于辅助 MiSub 拉取订阅内容；它不是 MiSub 主站部署方式。MiSub 主站仍然仅支持部署在 Cloudflare Pages。

当某些机场屏蔽 Cloudflare 出口 IP 时，MiSub 主站直接拉取订阅可能会失败，表现为：

- 无法获取节点数量
- 无法获取流量信息
- 无法获取到期时间
- 订阅预览或订阅输出为空/不完整

这时可以给该订阅配置一个 **Fetch Proxy**。MiSub 会先请求 Fetch Proxy，再由 Fetch Proxy 从非 Cloudflare 环境去拉取机场订阅。

本文以 **Vercel Edge Functions** 为例。它的优点：

- **冷启动 0ms**
- **IP 通常比 Cloudflare 更容易被机场放行**
- **每月免费 100GB 流量**
- 部署简单，只需要一个 `api/index.js`

---

## 一、为什么必须透传响应头

很多机场会把流量和到期信息放在 HTTP 响应头里，例如：

```http
subscription-userinfo: upload=59207660; download=166177216; total=107374182400; expire=1779862305
profile-update-interval: 24
content-disposition: attachment;filename*=UTF-8''example
```

MiSub 依赖其中的：

```http
subscription-userinfo
```

来显示：

- 已用流量：`upload + download`
- 总流量：`total`
- 到期时间：`expire`

如果 Fetch Proxy 只转发响应正文，不转发 `subscription-userinfo`，MiSub 可能只能从正文伪节点里解析出“剩余流量”，于是界面会出现类似：

```text
已用 0 B
99.79 GB
```

这并不代表机场没有返回已用流量，而是代理没有把响应头带回来。

因此，Fetch Proxy 必须显式透传这些响应头：

```text
subscription-userinfo
profile-update-interval
profile-title
profile-web-page-url
content-disposition
content-type
```

最关键的是：

```text
subscription-userinfo
```

---

## 二、部署步骤

### 1. 本地准备

在电脑上找一个方便的位置，例如：

```text
E:\proxy
```

然后：

1. 创建一个空文件夹。
2. 在文件夹内创建 `api` 目录。
3. 在 `api` 目录下创建 `index.js`。
4. 将下面的完整代码写入 `api/index.js`。

推荐使用这个增强版代码：

```javascript
export const config = { runtime: 'edge' };

const DEFAULT_USER_AGENT = 'clash-verge/v2.4.3';

// MiSub 需要这些响应头来读取流量、到期时间、文件名等信息
const PASS_THROUGH_RESPONSE_HEADERS = [
  'subscription-userinfo',
  'profile-update-interval',
  'profile-title',
  'profile-web-page-url',
  'content-disposition',
  'content-type',
  'cache-control',
];

function createCorsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,HEAD,OPTIONS',
    'access-control-allow-headers': 'content-type,user-agent',
    // 让浏览器调试时也能看到这些自定义响应头
    'access-control-expose-headers': PASS_THROUGH_RESPONSE_HEADERS.join(', '),
  };
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: createCorsHeaders(),
    });
  }

  const requestUrl = new URL(req.url);
  const targetUrl = requestUrl.searchParams.get('url');

  if (!targetUrl) {
    return new Response('Miss URL', {
      status: 400,
      headers: createCorsHeaders(),
    });
  }

  let parsedTarget;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    return new Response('Invalid URL', {
      status: 400,
      headers: createCorsHeaders(),
    });
  }

  if (!['http:', 'https:'].includes(parsedTarget.protocol)) {
    return new Response('Only http/https URLs are allowed', {
      status: 400,
      headers: createCorsHeaders(),
    });
  }

  const upstreamResponse = await fetch(parsedTarget.toString(), {
    method: req.method === 'HEAD' ? 'HEAD' : 'GET',
    redirect: 'follow',
    headers: {
      // 很多机场会根据 UA 返回不同格式；Clash 类 UA 通常会返回 YAML 和 subscription-userinfo
      'user-agent': requestUrl.searchParams.get('ua') || DEFAULT_USER_AGENT,
      'accept': '*/*',
    },
  });

  const responseHeaders = new Headers(createCorsHeaders());

  for (const headerName of PASS_THROUGH_RESPONSE_HEADERS) {
    const value = upstreamResponse.headers.get(headerName);
    if (value) responseHeaders.set(headerName, value);
  }

  // 如果上游没有 Content-Type，给一个安全默认值
  if (!responseHeaders.has('content-type')) {
    responseHeaders.set('content-type', 'text/plain; charset=utf-8');
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
```

---

## 三、执行部署

1. 打开终端（Command Prompt 或 PowerShell），进入项目根目录，例如：

   ```bash
   cd E:\proxy
   ```

2. 执行部署命令：

   ```bash
   npx vercel deploy
   ```

3. 按照提示配置：

   - **Set up and deploy "E:\proxy"?** 选择 `yes`
   - **Which scope...** 选择你的账号
   - **Link to existing project?** 选择 `no`
   - **What's your project's name?** 输入全部小写的名字，例如：`misub-proxy` 或 `my-fetch-proxy`
   - 后续选项一路回车，保持默认即可

4. 部署完成后，Vercel 会给出一个预览地址，例如：

   ```text
   https://misub-proxy-xxxx.vercel.app
   ```

5. 如果确认没问题，可以部署到生产环境：

   ```bash
   npx vercel --prod
   ```

生产环境地址通常类似：

```text
https://misub-proxy.vercel.app
```

---

## 四、在 MiSub 中配置 Fetch Proxy

假设你的 Vercel 地址是：

```text
https://misub-proxy.vercel.app
```

那么在 MiSub 的订阅源里，`Fetch Proxy` 应填写：

```text
https://misub-proxy.vercel.app/api?url=
```

注意：

- 必须包含 `/api?url=`
- 最后的 `=` 不能省略
- MiSub 会自动把原始订阅链接拼接到后面

例如 MiSub 实际请求会变成：

```text
https://misub-proxy.vercel.app/api?url=https%3A%2F%2Fexample.com%2Fsub%2Fxxxx
```

---

## 五、如何验证是否透传了流量响应头

部署完成后，可以用下面的命令检查 Fetch Proxy 是否成功透传 `subscription-userinfo`。

请把示例里的两个地址换成你自己的：

```bash
curl -I "https://misub-proxy.vercel.app/api?url=https%3A%2F%2Fexample.com%2Fsub%2Fxxxx"
```

如果正常，输出里应该能看到类似：

```http
subscription-userinfo: upload=59207660; download=166177216; total=107374182400; expire=1779862305
profile-update-interval: 24
content-disposition: attachment;filename*=UTF-8''example
```

其中：

```http
subscription-userinfo
```

是最关键的。

如果你只看到 `content-type`，看不到 `subscription-userinfo`，说明代理仍然没有透传响应头，MiSub 就无法显示真实已用流量。

---

## 六、常见问题

### 1. 节点数量能获取，流量/到期时间获取不到

通常是 Fetch Proxy 没有透传：

```http
subscription-userinfo
```

请确认你使用的是本文的增强版代码，而不是下面这种极简代码：

```javascript
export const config = { runtime: 'edge' };
export default async function handler(req) {
  const url = new URL(req.url).searchParams.get('url');
  if (!url) return new Response('Miss URL', { status: 400 });
  return fetch(url, { headers: { 'User-Agent': 'v2rayN/7.23' }});
}
```

极简代码在部分平台/场景下可能只保证正文可用，不适合排查自定义响应头问题。

### 2. 显示“已用 0 B / 99.79 GB”

这通常代表 MiSub 没拿到 `subscription-userinfo`，只从订阅正文伪节点里解析到了“剩余流量”。

这种情况下 `99.79 GB` 实际上是剩余流量，不是套餐总量；因为正文里没有 upload/download，所以已用量只能显示为 `0 B`。

解决方法：让 Fetch Proxy 透传 `subscription-userinfo`。

### 3. 机场根据 User-Agent 返回不同内容

有些机场会根据 UA 返回不同格式：

- Clash UA：可能返回 YAML 配置，并带 `subscription-userinfo`
- Quantumult X UA：可能返回 QuanX 格式
- 默认浏览器 UA：可能返回 Base64 或其他格式

本文默认使用：

```text
clash-verge/v2.4.3
```

如果某个机场对这个 UA 不兼容，可以临时通过 `ua` 参数覆盖：

```text
https://misub-proxy.vercel.app/api?ua=v2rayN%2F7.23&url=
```

在 MiSub 的 Fetch Proxy 中也可以填这个完整前缀：

```text
https://misub-proxy.vercel.app/api?ua=v2rayN%2F7.23&url=
```

注意最后仍然要以 `url=` 结尾。

### 4. 使用 curl 能看到头，但 MiSub 仍然没显示

请检查：

1. MiSub 订阅源里是否确实配置了 Fetch Proxy。
2. Fetch Proxy 是否以 `/api?url=` 结尾。
3. 订阅源是否已经点击刷新/更新节点数量。
4. 浏览器或后端是否仍有旧缓存，可以保存订阅源后重新刷新。
5. `curl -I` 检查代理地址时是否能看到 `subscription-userinfo`。

---

## 七、安全建议

这个 Fetch Proxy 会帮你请求任意 `url` 参数中的地址。为了避免被滥用，建议至少做一项限制：

1. **只自己使用，不公开代理地址。**
2. **给代理加一个简单 token。**
3. **限制只允许访问你自己的机场域名。**

例如只允许访问指定域名：

```javascript
const ALLOWED_HOSTS = new Set([
  'example.com',
  'sub.example.com',
]);

if (!ALLOWED_HOSTS.has(parsedTarget.hostname)) {
  return new Response('Host not allowed', { status: 403 });
}
```

如果你把 Fetch Proxy 地址公开到网页或仓库里，建议一定加白名单或 token。

---

## 八、最终检查清单

- [ ] Vercel 项目已部署成功
- [ ] MiSub 订阅源已填写 `https://你的域名.vercel.app/api?url=`
- [ ] `curl -I` 代理地址能看到 `subscription-userinfo`
- [ ] MiSub 中点击刷新后能显示节点数量
- [ ] MiSub 中能显示已用流量、总流量、到期时间

配置完成后，MiSub 即可通过 Vercel Fetch Proxy 拉取被 Cloudflare 屏蔽的订阅，并正确读取节点数量、流量和到期信息。
