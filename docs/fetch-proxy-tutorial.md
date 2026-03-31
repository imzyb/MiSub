# Vercel Edge Functions 代理部署指南

这是一段极其短小却强大的纯拉取代理解析代码，利用 Vercel Edge Functions 实现，具备以下优势：
- **冷启动 0ms**
- **IP 纯净**
- **每月免费 100GB 流量**

## 部署步骤

### 1. 本地准备
在电脑上找一个方便的地方（例如 `E:\proxy`），执行以下操作：
1. 创建一个空文件夹。
2. 在文件夹内创建 `api` 目录。
3. 在 `api` 目录下创建 `index.js`，并填入以下代码：

```javascript
export const config = { runtime: 'edge' };
export default async function handler(req) {
  const url = new URL(req.url).searchParams.get('url');
  if (!url) return new Response('Miss URL', { status: 400 });
  return fetch(url, { headers: { 'User-Agent': 'v2rayN/7.23' }});
}
```

### 2. 执行部署
1. 打开终端（Command Prompt 或 PowerShell），确保当前在项目根目录（例如 `E:\proxy`）。
2. 执行以下命令：
   ```bash
   npx vercel deploy
   ```
3. 按照提示进行配置：
   - **Set up and deploy "E:\proxy"?** 选择 `yes`
   - **Which scope...** 选择您的名字
   - **Link to existing project?** 选择 `no`
   - **What's your project's name?** 输入全部小写的名字，例如：`misub-proxy` 或 `my-fetch-proxy`（**绝对不要带有大写字母**）。
   - **后续选项：** 一直按回车（保持默认配置），直到开始上传并构建。

### 3. 在 MiSub 中配置
1. 部署完成后，Vercel 会提供一个网址（例如 `https://misub-proxy.vercel.app`）。
2. 将该网址填入 MiSub 设置里的 `fetchProxy` 项。
3. **注意：** 必须在网址后缀带上 `api?url=`，完整格式如下：
   `https://misub-proxy.vercel.app/api?url=`

---
配置完成后，MiSub 即可通过该 Vercel 代理拉取订阅内容。
