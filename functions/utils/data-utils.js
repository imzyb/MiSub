/**
 * 数据处理工具函数
 * @author MiSub Team
 */

function getKV(env) {
    return env?.MISUB_KV || null;
}

/**
 * 计算数据的简单哈希值，用于检测变更
 * @param {any} data - 要计算哈希的数据
 * @returns {string} - 数据的哈希值
 */
export function calculateDataHash(data) {
    const jsonString = JSON.stringify(data, Object.keys(data).sort());
    let hash = 0;
    for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
    }
    return hash.toString();
}

/**
 * 检测数据是否发生变更
 * @param {any} oldData - 旧数据
 * @param {any} newData - 新数据
 * @returns {boolean} - 是否发生变更
 */
export function hasDataChanged(oldData, newData) {
    if (!oldData && !newData) return false;
    if (!oldData || !newData) return true;
    return calculateDataHash(oldData) !== calculateDataHash(newData);
}

/**
 * 条件性写入KV存储，只在数据真正变更时写入
 * @param {Object} env - Cloudflare环境对象
 * @param {string} key - KV键名
 * @param {any} newData - 新数据
 * @param {any} oldData - 旧数据（可选）
 * @returns {Promise<boolean>} - 是否执行了写入操作
 */
export async function conditionalKVPut(env, key, newData, oldData = null) {
    const kv = getKV(env);
    // 如果没有提供旧数据，先从KV读取
    if (oldData === null) {
        try {
            oldData = await kv.get(key).then(r => r ? JSON.parse(r) : null);
        } catch (error) {
            // 读取失败时，为安全起见执行写入
            await kv.put(key, JSON.stringify(newData));
            return true;
        }
    }

    // 检测数据是否变更
    if (hasDataChanged(oldData, newData)) {
        await kv.put(key, JSON.stringify(newData));
        return true;
    } else {
        return false;
    }
}

/**
 * 格式化字节大小
 * @param {number} bytes - 字节数
 * @param {number} decimals - 小数位数
 * @returns {string} - 格式化后的字符串
 */
export { formatBytes } from '../../src/shared/utils.js';
