import JSON5 from 'json5';
import yaml from 'js-yaml';

const MEMBER_MARKER_RE = /^\{\{MISUB_(ALL|INCLUDE|EXCLUDE)(?::([\s\S]+))?\}\}$/i;

function unique(values = []) {
    return Array.from(new Set(values.filter(Boolean)));
}

function createFilter(pattern) {
    try {
        return new RegExp(pattern, 'i');
    } catch (error) {
        throw new Error(`Invalid MiSub group filter "${pattern}": ${error.message}`);
    }
}

export function expandProfileTemplateMembers(members = [], nodeNames = []) {
    const expanded = [];

    for (const member of Array.isArray(members) ? members : []) {
        const marker = String(member || '').trim().match(MEMBER_MARKER_RE);
        if (!marker) {
            expanded.push(member);
            continue;
        }

        const action = marker[1].toUpperCase();
        const pattern = String(marker[2] || '').trim();
        if (action === 'ALL') {
            expanded.push(...nodeNames);
            continue;
        }

        if (!pattern) {
            throw new Error(`MiSub ${action} marker requires a regular expression`);
        }
        const regex = createFilter(pattern);
        expanded.push(...nodeNames.filter(name => action === 'INCLUDE' ? regex.test(name) : !regex.test(name)));
    }

    return unique(expanded);
}

function mergeNamedEntries(staticEntries, dynamicEntries, getName, label) {
    const result = Array.isArray(staticEntries) ? [...staticEntries] : [];
    const names = new Set(result.map(getName).filter(Boolean));

    for (const entry of dynamicEntries) {
        const name = getName(entry);
        if (!name) continue;
        if (names.has(name)) {
            throw new Error(`${label} "${name}" already exists in the profile template`);
        }
        names.add(name);
        result.push(entry);
    }

    return result;
}

function getClashProxyName(proxy) {
    return String(proxy?.name || '').trim();
}

function getEgernProxyName(proxy) {
    if (!proxy || typeof proxy !== 'object' || Array.isArray(proxy)) return '';
    const value = Object.values(proxy)[0];
    return String(value?.name || '').trim();
}

function expandClashGroups(config, nodeNames) {
    if (!Array.isArray(config['proxy-groups'])) return;
    config['proxy-groups'] = config['proxy-groups'].map(group => ({
        ...group,
        proxies: expandProfileTemplateMembers(group?.proxies, nodeNames)
    }));
}

function expandEgernGroups(config, nodeNames) {
    if (!Array.isArray(config.policy_groups)) return;
    config.policy_groups = config.policy_groups.map(group => {
        if (!group || typeof group !== 'object' || Array.isArray(group)) return group;
        const [kind, body] = Object.entries(group)[0] || [];
        if (!kind || !body || typeof body !== 'object') return group;
        return {
            [kind]: {
                ...body,
                policies: expandProfileTemplateMembers(body.policies, nodeNames)
            }
        };
    });
}

function renderYamlProfileTemplate(templateText, generatedContent, targetFormat) {
    const template = yaml.load(templateText);
    const generated = yaml.load(generatedContent);
    if (!template || typeof template !== 'object' || Array.isArray(template)) {
        throw new Error('Profile template must be a YAML object');
    }

    if (targetFormat === 'egern') {
        const dynamicProxies = Array.isArray(generated?.proxies) ? generated.proxies : [];
        const nodeNames = dynamicProxies.map(getEgernProxyName).filter(Boolean);
        template.proxies = mergeNamedEntries(template.proxies, dynamicProxies, getEgernProxyName, 'Egern proxy');
        expandEgernGroups(template, nodeNames);
    } else {
        const dynamicProxies = Array.isArray(generated?.proxies) ? generated.proxies : [];
        const nodeNames = dynamicProxies.map(getClashProxyName).filter(Boolean);
        template.proxies = mergeNamedEntries(template.proxies, dynamicProxies, getClashProxyName, 'Clash proxy');
        expandClashGroups(template, nodeNames);
    }

    return yaml.dump(template, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
        quotingType: '"',
        forceQuotes: false
    });
}

function isSingboxNode(outbound) {
    return Boolean(
        outbound &&
        typeof outbound === 'object' &&
        typeof outbound.tag === 'string' &&
        typeof outbound.type === 'string' &&
        outbound.server &&
        outbound.server_port
    );
}

function expandSingboxGroups(config, nodeNames) {
    if (!Array.isArray(config.outbounds)) return;
    config.outbounds = config.outbounds.map(outbound => {
        if (!Array.isArray(outbound?.outbounds)) return outbound;
        return {
            ...outbound,
            outbounds: expandProfileTemplateMembers(outbound.outbounds, nodeNames)
        };
    });
}

function renderSingboxProfileTemplate(templateText, generatedContent) {
    const template = JSON5.parse(templateText);
    const generated = JSON.parse(generatedContent);
    if (!template || typeof template !== 'object' || Array.isArray(template)) {
        throw new Error('Sing-box profile template must be a JSON object');
    }

    const dynamicOutbounds = (generated.outbounds || []).filter(isSingboxNode);
    const dynamicEndpoints = Array.isArray(generated.endpoints) ? generated.endpoints : [];
    const nodeNames = unique([
        ...dynamicOutbounds.map(item => item.tag),
        ...dynamicEndpoints.map(item => item?.tag)
    ]);

    template.outbounds = mergeNamedEntries(
        template.outbounds,
        dynamicOutbounds,
        item => String(item?.tag || '').trim(),
        'Sing-box outbound'
    );
    if (dynamicEndpoints.length > 0) {
        template.endpoints = mergeNamedEntries(
            template.endpoints,
            dynamicEndpoints,
            item => String(item?.tag || '').trim(),
            'Sing-box endpoint'
        );
    }
    expandSingboxGroups(template, nodeNames);
    return JSON.stringify(template, null, 2) + '\n';
}

function parseIniSections(content) {
    const lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
    const sections = [];
    let current = { name: '', header: '', lines: [] };
    sections.push(current);

    for (const line of lines) {
        const match = line.trim().match(/^\[([^\]]+)\]$/);
        if (match) {
            current = { name: match[1].trim().toLowerCase(), header: line, lines: [] };
            sections.push(current);
        } else {
            current.lines.push(line);
        }
    }
    return sections;
}

function findIniSection(sections, name) {
    const normalized = String(name || '').toLowerCase();
    return sections.find(section => section.name === normalized);
}

function extractIniEntryName(line) {
    const trimmed = String(line || '').trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) return '';
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex <= 0) return '';
    return trimmed.slice(0, equalIndex).trim();
}

function extractQuanxNodeName(line) {
    const match = String(line || '').match(/,\s*tag=([^,]+)\s*$/i);
    return String(match?.[1] || '').trim();
}

function mergeIniNodeLines(templateSection, generatedSection, getName = extractIniEntryName) {
    const dynamicLines = (generatedSection?.lines || []).filter(line => {
        const name = getName(line);
        return name && !['direct', 'reject'].includes(name.toLowerCase());
    });
    const dynamicNames = dynamicLines.map(getName);
    const staticNames = new Set((templateSection.lines || []).map(getName).filter(Boolean));

    for (const name of dynamicNames) {
        if (staticNames.has(name)) {
            throw new Error(`Proxy "${name}" already exists in the profile template`);
        }
    }

    const trailingBlankIndex = templateSection.lines.findIndex((line, index) =>
        index === templateSection.lines.length - 1 && line.trim() === ''
    );
    const insertAt = trailingBlankIndex === -1 ? templateSection.lines.length : trailingBlankIndex;
    templateSection.lines.splice(insertAt, 0, ...dynamicLines);
    return dynamicNames;
}

function expandIniGroupLine(line, nodeNames) {
    if (!line.includes('{{MISUB_')) return line;
    const equalIndex = line.indexOf('=');
    if (equalIndex < 0) return line;
    const prefix = line.slice(0, equalIndex + 1);
    const leadingWhitespace = line.slice(equalIndex + 1).match(/^\s*/)?.[0] || '';
    const parts = line.slice(equalIndex + 1).split(',').map(part => part.trim());
    const expanded = [];
    for (const part of parts) {
        const values = expandProfileTemplateMembers([part], nodeNames);
        expanded.push(...values);
    }
    return `${prefix}${leadingWhitespace}${unique(expanded).join(', ')}`;
}

function serializeIniSections(sections) {
    return sections
        .map(section => section.header ? [section.header, ...section.lines].join('\n') : section.lines.join('\n'))
        .join('\n')
        .replace(/\n+$/, '') + '\n';
}

function renderIniProfileTemplate(templateText, generatedContent, targetFormat) {
    const templateSections = parseIniSections(templateText);
    const generatedSections = parseIniSections(generatedContent);
    const nodeSectionName = targetFormat === 'quanx' ? 'server_local' : 'proxy';
    const groupSectionName = targetFormat === 'quanx' ? 'policy' : 'proxy group';
    const templateNodeSection = findIniSection(templateSections, nodeSectionName);
    const generatedNodeSection = findIniSection(generatedSections, nodeSectionName);

    if (!templateNodeSection) {
        throw new Error(`Profile template is missing [${nodeSectionName}]`);
    }
    const nodeNames = mergeIniNodeLines(
        templateNodeSection,
        generatedNodeSection,
        targetFormat === 'quanx' ? extractQuanxNodeName : extractIniEntryName
    );
    const groupSection = findIniSection(templateSections, groupSectionName);
    if (groupSection) {
        groupSection.lines = groupSection.lines.map(line => expandIniGroupLine(line, nodeNames));
    }
    return serializeIniSections(templateSections);
}

export function renderFullProfileTemplate(templateText, generatedContent, targetFormat) {
    const normalizedTarget = String(targetFormat || '').toLowerCase().replace(/^sing-box$/, 'singbox');
    if (normalizedTarget === 'singbox') {
        return renderSingboxProfileTemplate(templateText, generatedContent);
    }
    if (normalizedTarget === 'clash' || normalizedTarget === 'egern') {
        return renderYamlProfileTemplate(templateText, generatedContent, normalizedTarget);
    }
    if (normalizedTarget === 'surge' || normalizedTarget.startsWith('surge&ver=') || normalizedTarget === 'loon' || normalizedTarget === 'quanx') {
        return renderIniProfileTemplate(templateText, generatedContent, normalizedTarget.startsWith('surge') ? 'surge' : normalizedTarget);
    }
    throw new Error(`Full profile templates are not supported for target "${targetFormat}"`);
}
