/**
 * 判断 customLoginPath 是否为有效的自定义路径。
 * 空字符串、纯斜杠、'login' 均视为无效（等同于使用默认 /login）。
 */
export function isValidCustomLoginPath(raw) {
  if (!raw || typeof raw !== 'string') return false;
  const normalized = raw.trim().replace(/^\/+/, '');
  return normalized.length > 0 && normalized !== 'login';
}
