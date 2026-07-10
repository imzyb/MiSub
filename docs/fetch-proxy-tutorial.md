# Vercel Node.js Functions Fetch Proxy 部署指南

> 说明：本文档介绍的是可选的抓取代理组件，用于辅助 MiSub 拉取订阅内容；它不是 MiSub 主站部署方式。MiSub 主站仍然仅支持部署在 Cloudflare Pages。

当某些机场屏蔽 Cloudflare 出口 IP 时，MiSub 主站直接拉取订阅可能会失败，表现为：

- 无法获取节点数量
- 无法获取流量信息
- 无法获取到期时间
- 订阅预览或订阅输出为空/不完整

这时可以给该订阅配置一个 **Fetch Proxy**。MiSub 会先请求 Fetch Proxy，再由 Fetch Proxy 从非 Cloudflare 环境去拉取机场订阅。

本文以 **Vercel Node.js Functions** 为例。原因是 Vercel Edge Runtime 对直连 IP 目标有限制，遇到类似 `http://47.242.55.240/...` 这种纯 IP 订阅地址会直接返回：

```text
Direct IP access is not allowed in Vercel's Edge environment
```

因此，如果要代理这类机场订阅，不能使用 Edge Runtime，必须使用 Node.js Serverless Function 或其他允许访问纯 IP 的运行环境。

它的特点：

- **可以访问纯 IP HTTP/HTTPS 订阅地址**
- **IP 通常比 Cloudflare 更容易被机场放行**
- 部署简单，只需要一个 `api/index.js`
- 支持透传 `subscription-userinfo` 等 MiSub 需要的响应头

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
    'access-control-allow-headers': 'content-type,user-agent,x-user-agent',
    // 让浏览器调试时也能看到这些自定义响应头
    'access-control-expose-headers': PASS_THROUGH_RESPONSE_HEADERS.join(', '),
  };
}

function applyHeaders(res, headers) {
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
}

function sanitizeHeaderValue(value) {
  return String(value || '').replace(/[\r\n]/g, '').trim();
}

function getUpstreamUserAgent(req, requestUrl) {
  // 优先使用 MiSub 自动拼接到代理前缀里的 ua 参数：
  //   /api?ua=clash-verge%2Fv2.4.3&url=<encoded-subscription-url>
  // 其次兼容手动传入的 x-user-agent 请求头，最后使用默认 Clash Verge UA。
  return sanitizeHeaderValue(
    requestUrl.searchParams.get('ua') ||
    req.headers['x-user-agent'] ||
    DEFAULT_USER_AGENT
  );
}

function sendText(res, statusCode, message) {
  applyHeaders(res, createCorsHeaders());
  res.statusCode = statusCode;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.end(message);
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    applyHeaders(res, createCorsHeaders());
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!['GET', 'HEAD'].includes(req.method)) {
    sendText(res, 405, 'Method Not Allowed');
    return;
  }

  const requestUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const targetUrl = requestUrl.searchParams.get('url');

  if (!targetUrl) {
    sendText(res, 400, 'Miss URL');
    return;
  }

  let parsedTarget;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    sendText(res, 400, 'Invalid URL');
    return;
  }

  if (!['http:', 'https:'].includes(parsedTarget.protocol)) {
    sendText(res, 400, 'Only http/https URLs are allowed');
    return;
  }

  const upstreamResponse = await fetch(parsedTarget.toString(), {
    method: req.method === 'HEAD' ? 'HEAD' : 'GET',
    redirect: 'follow',
    headers: {
      // 很多机场会根据 UA 返回不同格式；Clash 类 UA 通常会返回 YAML 和 subscription-userinfo。
      // 注意：MiSub 发给代理的 User-Agent 不一定会自动成为代理访问机场时的 UA，
      // 所以这里必须显式使用 ua 参数 / x-user-agent 覆盖上游请求 UA。
      'user-agent': getUpstreamUserAgent(req, requestUrl),
      'accept': '*/*',
    },
  });

  const responseHeaders = createCorsHeaders();

  for (const headerName of PASS_THROUGH_RESPONSE_HEADERS) {
    const value = upstreamResponse.headers.get(headerName);
    if (value) responseHeaders[headerName] = value;
  }

  // 如果上游没有 Content-Type，给一个安全默认值
  if (!responseHeaders['content-type']) {
    responseHeaders['content-type'] = 'text/plain; charset=utf-8';
  }

  applyHeaders(res, responseHeaders);
  res.statusCode = upstreamResponse.status;

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const body = Buffer.from(await upstreamResponse.arrayBuffer());
  res.end(body);
};
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
- 如果订阅源配置了“自定义 User-Agent”，新版 MiSub 会自动把 UA 拼到代理地址上，例如 `?ua=clash-verge%2Fv2.4.3&url=`，确保 Fetch Proxy 访问机场源站时也使用相同 UA

例如 MiSub 实际请求会变成：

```text
https://misub-proxy.vercel.app/api?url=https%3A%2F%2Fexample.com%2Fsub%2Fxxxx
```

如果该订阅设置了 `Clash Verge` UA，实际请求会变成：

```text
https://misub-proxy.vercel.app/api?ua=clash-verge%2Fv2.4.3&url=https%3A%2F%2Fexample.com%2Fsub%2Fxxxx
```

这是为了避免“MiSub 请求代理时用了正确 UA，但代理请求机场源站时又换成默认 UA”的问题。

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

### 1. 代理返回 `Direct IP access is not allowed in Vercel's Edge environment`

这说明你的 Fetch Proxy 仍在运行 **Vercel Edge Runtime**。Edge Runtime 不允许访问 `47.242.55.240` 这类纯 IP 目标，所以即使 UA 正确也会失败。

请确认 `api/index.js` 里没有下面这行：

```javascript
export const config = { runtime: 'edge' };
```

如果有，删除它，并改用本文上方的 Node.js Serverless Function 版本代码，然后重新部署生产环境：

```bash
npx vercel --prod
```

部署后再次验证：

```bash
curl -I "https://你的代理域名.vercel.app/api?ua=clash-verge%2Fv2.4.3&url=http%3A%2F%2F47.242.55.240%2Flink%2FVyB3JGVTdxskaBk9%3Fclash%3D2"
```

正常情况下应该返回 `HTTP 200`，并且能看到 `subscription-userinfo`。

### 2. 节点数量能获取，流量/到期时间获取不到

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

### 3. 显示“已用 0 B / 99.79 GB”

这通常代表 MiSub 没拿到 `subscription-userinfo`，只从订阅正文伪节点里解析到了“剩余流量”。

这种情况下 `99.79 GB` 实际上是剩余流量，不是套餐总量；因为正文里没有 upload/download，所以已用量只能显示为 `0 B`。

解决方法：让 Fetch Proxy 透传 `subscription-userinfo`。

### 4. 机场根据 User-Agent 返回不同内容

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

新版 MiSub 会在你为订阅源选择“自定义 User-Agent”后自动拼接 `ua` 参数；如果你手动在 Fetch Proxy 前缀中写了 `ua=...`，MiSub 不会重复添加。

### 5. 使用 curl 能看到头，但 MiSub 仍然没显示

请检查：

1. MiSub 订阅源里是否确实配置了 Fetch Proxy。
2. Fetch Proxy 是否以 `/api?url=` 结尾。
3. 订阅源是否已经点击刷新/更新节点数量。
4. 如果机场依赖特定 UA，实际代理请求里是否出现了 `ua=...&url=`。
5. 浏览器或后端是否仍有旧缓存，可以保存订阅源后重新刷新。
6. `curl -I` 检查代理地址时是否能看到 `subscription-userinfo`。

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
- [ ] 需要特定 UA 的订阅源已在 MiSub 中选择对应“自定义 User-Agent”
- [ ] `curl -I` 代理地址能看到 `subscription-userinfo`
- [ ] MiSub 中点击刷新后能显示节点数量
- [ ] MiSub 中能显示已用流量、总流量、到期时间

配置完成后，MiSub 即可通过 Vercel Fetch Proxy 拉取被 Cloudflare 屏蔽的订阅，并正确读取节点数量、流量和到期信息。
