import { NODE_PROTOCOL_PREFIXES } from '@/constants/nodeProtocols.js';

/**
 * 验证工具函数
 * @author MiSub Team
 */

/**
 * 验证URL格式
 * @param {string} url - 要验证的URL
 * @returns {boolean} 是否为有效的URL
 */
export function isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;

    try {
        const urlObj = new URL(url);
        return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
        return false;
    }
}

/**
 * 验证节点URL格式
 * @param {string} nodeUrl - 节点URL
 * @returns {boolean} 是否为有效的节点URL
 */
export function isValidNodeUrl(nodeUrl) {
    if (!nodeUrl || typeof nodeUrl !== 'string') return false;

    // 检查是否为支持的协议
    return NODE_PROTOCOL_PREFIXES.some(protocol => nodeUrl.startsWith(protocol));
}

/**
 * 验证邮箱格式
 * @param {string} email - 邮箱地址
 * @returns {boolean} 是否为有效的邮箱格式
 */
export function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * 验证密码强度
 * @param {string} password - 密码
 * @returns {Object} 密码强度信息
 */
export function validatePasswordStrength(password) {
    if (!password) {
        return { score: 0, message: '密码不能为空', suggestions: ['请输入密码'] };
    }

    let score = 0;
    const suggestions = [];

    // 长度检查
    if (password.length >= 8) {
        score += 1;
    } else {
        suggestions.push('密码长度至少8位');
    }

    // 包含小写字母
    if (/[a-z]/.test(password)) {
        score += 1;
    } else {
        suggestions.push('包含小写字母');
    }

    // 包含大写字母
    if (/[A-Z]/.test(password)) {
        score += 1;
    } else {
        suggestions.push('包含大写字母');
    }

    // 包含数字
    if (/\d/.test(password)) {
        score += 1;
    } else {
        suggestions.push('包含数字');
    }

    // 包含特殊字符
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        score += 1;
    } else {
        suggestions.push('包含特殊字符');
    }

    let message = '';
    if (score <= 2) {
        message = '密码强度弱';
    } else if (score <= 4) {
        message = '密码强度中等';
    } else {
        message = '密码强度强';
    }

    return { score, message, suggestions };
}

/**
 * 验证表单字段
 * @param {Object} formData - 表单数据
 * @param {Object} rules - 验证规则
 * @returns {Object} 验证结果
 */
export function validateForm(formData, rules) {
    const errors = {};
    const isValid = true;

    for (const [field, fieldRules] of Object.entries(rules)) {
        const value = formData[field];
        const fieldErrors = [];

        // 必填验证
        if (fieldRules.required && (!value || value.toString().trim() === '')) {
            fieldErrors.push(fieldRules.required || `${field}不能为空`);
        }

        // 如果值为空且不是必填，跳过其他验证
        if (!value && !fieldRules.required) {
            continue;
        }

        // 类型验证
        if (fieldRules.type) {
            switch (fieldRules.type) {
                case 'url':
                    if (!isValidUrl(value)) {
                        fieldErrors.push('请输入有效的URL');
                    }
                    break;
                case 'email':
                    if (!isValidEmail(value)) {
                        fieldErrors.push('请输入有效的邮箱地址');
                    }
                    break;
                case 'nodeUrl':
                    if (!isValidNodeUrl(value)) {
                        fieldErrors.push('请输入有效的节点URL');
                    }
                    break;
            }
        }

        // 长度验证
        if (fieldRules.minLength && value.length < fieldRules.minLength) {
            fieldErrors.push(`最少需要${fieldRules.minLength}个字符`);
        }

        if (fieldRules.maxLength && value.length > fieldRules.maxLength) {
            fieldErrors.push(`最多允许${fieldRules.maxLength}个字符`);
        }

        // 自定义验证
        if (fieldRules.validator && typeof fieldRules.validator === 'function') {
            const customError = fieldRules.validator(value);
            if (customError) {
                fieldErrors.push(customError);
            }
        }

        if (fieldErrors.length > 0) {
            errors[field] = fieldErrors;
        }
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}

/**
 * 验证订阅配置
 * @param {Object} subscription - 订阅配置
 * @returns {Object} 验证结果
 */
export function validateSubscription(subscription) {
    const rules = {
        name: {
            required: '订阅名称不能为空',
            minLength: 1,
            maxLength: 100
        },
        url: {
            required: '订阅URL不能为空',
            type: 'url'
        }
    };

    return validateForm(subscription, rules);
}

/**
 * 验证配置文件
 * @param {Object} profile - 配置文件
 * @returns {Object} 验证结果
 */
export function validateProfile(profile) {
    const rules = {
        name: {
            required: '配置名称不能为空',
            minLength: 1,
            maxLength: 100
        },
        customId: {
            maxLength: 50
        },
        subConverter: {
            validator: (value) => {
                if (value && !isValidUrl(value)) {
                    return '请输入有效的订阅转换器URL';
                }
                return null;
            }
        }
    };

    return validateForm(profile, rules);
}
