/**
 * Shadowsocks 2022 节点验证工具
 * 用于检测 SS 2022 节点的密钥长度是否与加密方式匹配
 */

/**
 * SS 2022 加密方式与密钥长度映射表
 */
const SS2022_KEY_LENGTHS = {
    '2022-blake3-aes-128-gcm': 16,
    '2022-blake3-aes-256-gcm': 32,
};

/**
 * 验证 SS 2022 节点的配置是否正确
 * @param {string} nodeUrl - SS 节点 URL
 * @returns {Object} 验证结果
 */
export function validateSS2022Node(nodeUrl) {
    if (!nodeUrl || typeof nodeUrl !== 'string') {
        return { valid: true };
    }

    if (!nodeUrl.startsWith('ss://')) {
        return { valid: true };
    }

    try {
        // 提取 Base64 部分 (在 @ 或 # 之前)
        const atIndex = nodeUrl.indexOf('@');
        const hashIndex = nodeUrl.indexOf('#');

        if (atIndex === -1) {
            // 检查是否为 SIP002 格式 (纯 Base64)
            // ss://base64string
            // 如果长度足够且是有效 Base64，可能就是 SIP002
            const possibleBase64 = nodeUrl.substring(5, hashIndex !== -1 ? hashIndex : undefined);
            if (/^[A-Za-z0-9+/=-_]+$/.test(possibleBase64)) {
                // 认为是 SIP002，暂不校验内部，或者解码后再校验
                // 这里简单返回 valid，因为 geo-utils 已经在负责解码提取了
                return { valid: true };
            }
            return { valid: true, warning: 'SS 节点格式不标准 (缺少 @)' };
        }

        const base64Part = nodeUrl.substring(5, atIndex);

        // 解码 Base64
        let decoded;
        try {
            const binaryString = atob(base64Part);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            decoded = new TextDecoder('utf-8').decode(bytes);
        } catch (e) {
            return { valid: true, warning: `无法解码 SS 节点: ${e.message}` };
        }

        // 分离加密方式和密码
        const colonIndex = decoded.indexOf(':');
        if (colonIndex === -1) {
            return { valid: true, warning: 'SS 节点格式不标准 (缺少 :)' };
        }

        const cipher = decoded.substring(0, colonIndex);
        const password = decoded.substring(colonIndex + 1);

        // 检查是否为 SS 2022 加密方式
        if (!cipher.startsWith('2022-')) {
            return { valid: true }; // 不是 SS 2022,跳过验证
        }

        // 获取期望的密钥长度
        const expectedLength = SS2022_KEY_LENGTHS[cipher];
        if (!expectedLength) {
            return {
                valid: true,
                warning: `未知的 SS 2022 加密方式: ${cipher}`
            };
        }

        // SS 2022 的密码是 Base64 编码的密钥
        // 需要解码后检查实际密钥长度
        let keyBytes;
        try {
            // 对于 SS 2022,密码字段就是 Base64 编码的密钥
            // 解码后的长度才是实际密钥长度
            const keyBinaryString = atob(password);
            keyBytes = keyBinaryString.length;
        } catch (e) {
            // 如果无法解码,可能密码不是 Base64 格式
            // 对于 SS 2022,这是不符合规范的
            return {
                valid: false,
                error: `SS 2022 密码不是有效的 Base64: ${e.message}`,
                details: {
                    cipher,
                    password: password.substring(0, 20) + '...'
                }
            };
        }

        // 验证密钥长度
        if (keyBytes !== expectedLength) {
            // 根据实际密钥长度推荐正确的加密方式
            let suggestion = '请联系节点提供商修正配置';
            let suggestedCipher = null;

            for (const [cipherName, requiredLength] of Object.entries(SS2022_KEY_LENGTHS)) {
                if (requiredLength === keyBytes) {
                    suggestedCipher = cipherName;
                    suggestion = `建议使用 ${cipherName} 加密方式`;
                    break;
                }
            }

            return {
                valid: false,
                error: `SS 2022 密钥长度不匹配`,
                details: {
                    cipher,
                    expectedKeyLength: expectedLength,
                    actualKeyLength: keyBytes,
                    suggestedCipher,
                    suggestion
                }
            };
        }

        return { valid: true };
    } catch (e) {
        return {
            valid: true,
            warning: `验证 SS 节点时出错: ${e.message}`
        };
    }
}

/**
 * 尝试修复 SS 2022 节点的加密方式
 * @param {string} nodeUrl - 原始 SS 节点 URL
 * @returns {Object} 修复结果
 */
export function fixSS2022Node(nodeUrl) {
    const validation = validateSS2022Node(nodeUrl);

    if (validation.valid || !validation.details?.suggestedCipher) {
        return {
            fixed: false,
            originalUrl: nodeUrl,
            reason: validation.valid ? '节点配置正确,无需修复' : '无法自动修复'
        };
    }

    try {
        // 提取各部分
        const atIndex = nodeUrl.indexOf('@');
        const hashIndex = nodeUrl.indexOf('#');
        const base64Part = nodeUrl.substring(5, atIndex);
        const serverPart = nodeUrl.substring(atIndex);

        // 解码原始配置
        const binaryString = atob(base64Part);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const decoded = new TextDecoder('utf-8').decode(bytes);

        const colonIndex = decoded.indexOf(':');
        const password = decoded.substring(colonIndex + 1);

        // 构建新的配置
        const newConfig = `${validation.details.suggestedCipher}:${password}`;
        const newBase64 = btoa(unescape(encodeURIComponent(newConfig)));
        const fixedUrl = `ss://${newBase64}${serverPart}`;

        return {
            fixed: true,
            originalUrl: nodeUrl,
            fixedUrl,
            changes: {
                from: validation.details.cipher,
                to: validation.details.suggestedCipher,
                reason: validation.details.suggestion
            }
        };
    } catch (e) {
        return {
            fixed: false,
            originalUrl: nodeUrl,
            error: `修复失败: ${e.message}`
        };
    }
}

/**
 * 批量验证节点列表
 * @param {Array<string>} nodeUrls - 节点 URL 列表
 * @returns {Object} 验证统计
 */
export function validateNodeList(nodeUrls) {
    if (!Array.isArray(nodeUrls)) {
        return { error: '输入必须是数组' };
    }

    const results = {
        total: nodeUrls.length,
        valid: 0,
        invalid: 0,
        warnings: 0,
        invalidNodes: [],
        warningNodes: []
    };

    nodeUrls.forEach((url, index) => {
        const validation = validateSS2022Node(url);

        if (!validation.valid) {
            results.invalid++;
            results.invalidNodes.push({
                index,
                url,
                error: validation.error,
                details: validation.details
            });
        } else if (validation.warning) {
            results.warnings++;
            results.warningNodes.push({
                index,
                url,
                warning: validation.warning
            });
        } else {
            results.valid++;
        }
    });

    return results;
}
