import { createUnifiedTemplateModel } from '../template-model.js';

function parseIniSections(templateText) {
    const lines = String(templateText || '').split(/\r?\n/);
    const sections = new Map();
    let currentSection = '';

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith(';') || line.startsWith('#')) continue;

        const sectionMatch = line.match(/^\[(.+)]$/);
        if (sectionMatch) {
            currentSection = sectionMatch[1].trim().toLowerCase();
            if (!sections.has(currentSection)) sections.set(currentSection, []);
            continue;
        }

        if (!sections.has(currentSection)) sections.set(currentSection, []);
        sections.get(currentSection).push(rawLine);
    }

    return sections;
}

function parseGroupLine(line) {
    const parts = line.split('=');
    if (parts.length < 2) return null;

    const name = parts[0].trim();
    const bodyParts = parts.slice(1).join('=').split(',').map(part => part.trim()).filter(Boolean);
    if (bodyParts.length === 0) return null;

    const type = bodyParts[0];
    const members = [];
    const options = {};

    for (const part of bodyParts.slice(1)) {
        if (part.includes('=')) {
            const [key, value] = part.split(/=(.*)/, 2);
            options[key.trim()] = (value || '').trim();
        } else {
            members.push(part);
        }
    }

    return { name, type, members, options };
}

function parseRuleLine(line) {
    const parts = line.split(',').map(part => part.trim()).filter(Boolean);
    if (parts.length < 2) return null;

    return {
        type: parts[0].toLowerCase(),
        value: parts.length > 2 ? parts[1] : '',
        policy: parts.length > 2 ? parts[2] : parts[1],
        extras: parts.length > 3 ? parts.slice(3) : []
    };
}

function parseAclRuleSetLine(line) {
    const raw = line.replace(/^ruleset=/i, '');
    const parts = raw.split(',').map(part => part.trim());
    if (parts.length < 2) return null;

    const policy = parts[0];
    const source = parts.slice(1).join(',');
    if (source.startsWith('[]')) {
        const inlineValue = source.slice(2);
        const inlineParts = inlineValue.split(',').map(part => part.trim()).filter(Boolean);
        const type = (inlineParts[0] || '').toLowerCase();
        return {
            type,
            value: inlineParts[1] || '',
            policy,
            source: 'inline',
            extras: inlineParts.slice(2)
        };
    }

    return {
        type: 'rule-set',
        value: source,
        policy,
        source: 'remote',
        extras: []
    };
}

function parseAclProxyGroupLine(line) {
    const raw = line.replace(/^custom_proxy_group=/i, '');
    const parts = raw.split('`').map(part => part.trim()).filter(Boolean);
    if (parts.length < 2) return null;

    const name = parts[0];
    const type = parts[1];
    const members = [];
    const filters = [];
    const options = {};

    for (const part of parts.slice(2)) {
        if (part.startsWith('[]')) {
            members.push(part.slice(2));
            continue;
        }
        if (/^https?:\/\//i.test(part)) {
            options.url = part;
            continue;
        }
        if (/^\d+$/.test(part)) {
            if (!options.interval) {
                options.interval = Number(part);
            } else if (!options.tolerance) {
                options.tolerance = Number(part);
            }
            continue;
        }
        if (part.startsWith('(') && part.endsWith(')')) {
            filters.push(part.slice(1, -1));
            continue;
        }
        if (part === ',') continue;
    }

    return { name, type, members, filters, options };
}

export function parseIniTemplate(templateText, options = {}) {
    const sections = parseIniSections(templateText);
    const aclCustomLines = sections.get('custom') || [];
    const parsedAclGroups = aclCustomLines
        .filter(line => /^custom_proxy_group=/i.test(line.trim()))
        .map(parseAclProxyGroupLine)
        .filter(Boolean);
    const parsedAclRules = aclCustomLines
        .filter(line => /^ruleset=/i.test(line.trim()))
        .map(parseAclRuleSetLine)
        .filter(Boolean);

    const groups = (sections.get('proxy group') || [])
        .map(parseGroupLine)
        .filter(Boolean)
        .concat(parsedAclGroups);
    const rules = (sections.get('rule') || [])
        .map(parseRuleLine)
        .filter(Boolean)
        .concat(parsedAclRules);

    return createUnifiedTemplateModel({
        meta: {
            name: options.fileName || 'MiSub',
            source: 'ini',
            target: options.targetFormat || 'clash',
            // [逻辑说明] ruleLevel 在 INI 模式下暂不直接影响生成，因为 INI 自带了 hardcoded rules。
            // 仅作为元数据打包进 TemplateModel，供未来动态模板扩展使用。
            ruleLevel: options.ruleLevel || 'std'
        },
        proxies: options.proxies || [],
        groups,
        rules,
        settings: {
            managedConfigUrl: options.managedConfigUrl || '',
            interval: options.interval || 86400,
            skipCertVerify: Boolean(options.skipCertVerify),
            enableUdp: Boolean(options.enableUdp)
        }
    });
}
