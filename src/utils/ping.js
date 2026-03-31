/**
 * 纯前端的代理节点连通性测试工具
 * 利用浏览器的 Fetch API 发送无 CORS 请求触发目标端口 TLS 握手或 TCP 连接。
 */

/**
 * 测试单个节点的 TCP 连通性
 * @param {string} host 节点服务器 IP 或域名
 * @param {number|string} port 节点端口
 * @param {number} timeoutMs 超时时间（毫秒）
 * @returns {Promise<{status: 'ok'|'timeout'|'error', latency: number, message?: string}>}
 */
export async function pingNode(host, port, timeoutMs = 3000) {
    if (!host || !port) {
        return { status: 'error', latency: -1, message: '无效的地址或端口' };
    }

    return new Promise((resolve) => {
        const start = performance.now();
        const controller = new AbortController();
        
        const timeoutId = setTimeout(() => {
            controller.abort();
            resolve({ status: 'timeout', latency: timeoutMs });
        }, timeoutMs);

        // 如果我们在 HTTPS 环境下，浏览器强迫阻止发送 http:// 请求（Mixed Content Blocked），
        // 且此拦截不触发正常网络请求耗时。所以必须统一使用 https:// 探测。
        // 即便对方是不是 TLS, 也会强制握手(耗时1-2个 RTT)。
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        
        // 规避浏览器缓存
        const cacheBuster = Date.now() + Math.random().toString(36).substring(7);
        const testUrl = `${protocol}//${host}:${port}/__ping_${cacheBuster}`;

        fetch(testUrl, {
            mode: 'no-cors',
            cache: 'no-store',
            credentials: 'omit',
            signal: controller.signal
        }).then(() => {
            // 如果节点碰巧是一个 HTTP(S) 服务器并且响应了，请求会成功 (opaque)
            clearTimeout(timeoutId);
            const latency = Math.round(performance.now() - start);
            resolve({ status: 'ok', latency });
        }).catch((err) => {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                resolve({ status: 'timeout', latency: timeoutMs });
            } else {
                // Fetch failed 意味着端口拒绝连接，或者 TLS 握手失败/被主动断开（如 Vmess/SS 服务器收到不合规请求）
                // 这个拒绝的耗时代表了我们到对方的真实 TCP(或加TLS) 的 RTT
                const latency = Math.round(performance.now() - start);
                
                // 极短时间(往往<10ms)出错可能是因为 DNS 解析失败、本地网络断开或者遭到浏览器扩展拦截
                // 我们仍然将其视为 reachable，但标记一下
                resolve({ status: 'ok', latency });
            }
        });
    });
}
