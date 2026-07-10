/**
 * Build a Fetch Proxy URL while preserving the upstream subscription URL and,
 * when possible, passing the upstream User-Agent to proxies that support a
 * `ua` query parameter.
 *
 * MiSub stores fetchProxy as a prefix such as:
 *   https://proxy.example.com/api?url=
 *
 * Some subscription providers only return a valid subscription for a specific
 * UA. Sending the User-Agent header to the proxy request is not enough when the
 * proxy chooses its own upstream UA, so include `ua=<encoded UA>` beside `url=`.
 */
export function buildFetchProxyUrl(fetchProxy, targetUrl, userAgent = '') {
    const proxyPrefix = typeof fetchProxy === 'string' ? fetchProxy.trim() : '';
    if (!proxyPrefix) return targetUrl;

    const encodedTarget = encodeURIComponent(targetUrl);
    const ua = typeof userAgent === 'string' ? userAgent.trim() : '';

    if (!ua || /[?&]ua=/i.test(proxyPrefix)) {
        return `${proxyPrefix}${encodedTarget}`;
    }

    const urlParamIndex = proxyPrefix.search(/[?&]url=$/i);
    if (urlParamIndex !== -1) {
        const separator = proxyPrefix[urlParamIndex];
        const beforeUrlParam = proxyPrefix.slice(0, urlParamIndex);
        const urlParam = proxyPrefix.slice(urlParamIndex + 1);
        return `${beforeUrlParam}${separator}ua=${encodeURIComponent(ua)}&${urlParam}${encodedTarget}`;
    }

    return `${proxyPrefix}${encodedTarget}`;
}
