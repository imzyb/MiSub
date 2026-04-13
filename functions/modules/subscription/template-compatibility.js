export const TEMPLATE_COMPATIBILITY = {
    clash: {
        allowExternalTemplate: true,
        externalTemplateTypes: ['yaml', 'template'],
        strategy: 'external-first',
        description: 'Clash 系列可使用外部模板进行完整覆写。'
    },
    surge: {
        allowExternalTemplate: true,
        externalTemplateTypes: ['ini'],
        strategy: 'model-driven',
        description: 'Surge 通过统一模板模型接入，支持将 ini 模板转译为 Surge 配置。'
    },
    loon: {
        allowExternalTemplate: true,
        externalTemplateTypes: ['ini'],
        strategy: 'model-driven',
        description: 'Loon 通过统一模板模型接入，支持将 ini 模板转译为 Loon 配置。'
    },
    quanx: {
        allowExternalTemplate: true,
        externalTemplateTypes: ['ini'],
        strategy: 'model-driven',
        description: 'Quantumult X 通过统一模板模型接入，支持将 ini 模板转译为 Quantumult X 配置。'
    },
    singbox: {
        allowExternalTemplate: true,
        externalTemplateTypes: ['ini', 'json'],
        strategy: 'model-driven',
        description: 'Sing-Box 通过统一模板模型接入，支持将 ini/json 模板转译为 JSON 配置。'
    }
};

export function normalizeTemplateTarget(targetFormat) {
    const normalizedTarget = typeof targetFormat === 'string' ? targetFormat.toLowerCase() : '';
    if (normalizedTarget.startsWith('surge&ver=')) return 'surge';
    if (normalizedTarget === 'sing-box') return 'singbox';
    return normalizedTarget;
}

export function getTemplateCompatibility(targetFormat) {
    const normalizedTarget = normalizeTemplateTarget(targetFormat);
    return TEMPLATE_COMPATIBILITY[normalizedTarget] || null;
}

export function shouldApplyExternalTemplateForTarget(targetFormat, templateUrl) {
    const normalizedTemplateUrl = typeof templateUrl === 'string' ? templateUrl.trim() : '';
    const targetRule = getTemplateCompatibility(targetFormat);

    if (!normalizedTemplateUrl) return false;
    if (!targetRule) return false;
    if (!targetRule.allowExternalTemplate) return false;

    return true;
}
