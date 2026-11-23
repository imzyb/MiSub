/**
 * 统一的剪贴板写入工具。
 *
 * 背景：项目里多处「复制」按钮各自实现，行为不一致——
 * 有的直接调用 navigator.clipboard.writeText 且不处理失败（在 http 局域网、
 * 或被浏览器禁用剪贴板时会抛异常，点击后既没提示也没复制，表现为“按钮没反应”），
 * 有的复制成功却没有任何 UI 反馈。这里收敛成一份实现：
 * 1. 优先使用异步 Clipboard API（仅安全上下文可用）；
 * 2. 失败时回退到 textarea + execCommand('copy')，兼容非 HTTPS 的局域网部署；
 * 3. 返回布尔值，调用方据此给出成功/失败提示。
 */

export function isClipboardApiWritable() {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
    // 非安全上下文（http://192.168.x.x 之类）里 navigator.clipboard 可能存在但写入会抛错。
    if (typeof window !== 'undefined' && window.isSecureContext === false) return false;
    return true;
}

export function copyTextWithFallback(text) {
    if (typeof document === 'undefined') return false;

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);

    let copied = false;
    try {
        textarea.focus({ preventScroll: true });
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        copied = document.execCommand('copy');
    } catch {
        copied = false;
    } finally {
        document.body.removeChild(textarea);
    }

    return copied;
}

export async function copyTextToClipboard(text) {
    if (typeof text !== 'string' || text.length === 0) return false;

    if (isClipboardApiWritable()) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // 权限被拒 / 被策略拦截时继续走回退方案
        }
    }

    return copyTextWithFallback(text);
}

export default copyTextToClipboard;
