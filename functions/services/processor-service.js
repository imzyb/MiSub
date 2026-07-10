/**
 * MiSub Core Processing Service
 * Handles the logic of: Profile Resolving -> Node Fetching -> Transformation Pipeline -> Response Rendering
 */

import { generateCombinedNodeList } from './subscription-service.js';
import { transformBuiltinSubscription } from '../modules/subscription/transformer-factory.js';
import { renderClashFromIniTemplate, renderSingboxFromIniTemplate, renderSurgeFromIniTemplate, renderLoonFromIniTemplate, renderQuanxFromIniTemplate, renderEgernFromIniTemplate } from '../modules/subscription/template-pipeline.js';
import { getBuiltinTemplate } from '../modules/subscription/builtin-template-registry.js';
import { fetchTransformTemplate } from '../modules/subscription/transform-template-cache.js';
import { resolveRuleTemplateSource } from '../modules/rule-template-handler.js';
import { base64EncodeUtf8 } from '../modules/utils.js';
import yaml from 'js-yaml';
import { urlsToClashProxies } from '../utils/url-to-clash.js';

function getTemplateExtension(templateUrl) {
    const raw = typeof templateUrl === 'string' ? templateUrl.trim() : '';
    if (!raw) return '';

    try {
        const parsed = new URL(raw);
        return parsed.pathname.split('/').pop()?.split('.').pop()?.toLowerCase() || '';
    } catch {
        const cleanPath = raw.split('#')[0].split('?')[0];
        return cleanPath.split('/').pop()?.split('.').pop()?.toLowerCase() || '';
    }
}

export function isIniTemplateSource(templateSource, builtinTemplateEntry = null) {
    if (builtinTemplateEntry?.format === 'ini') return true;
    if (templateSource?.kind === 'custom') return true;
    return getTemplateExtension(templateSource?.value) === 'ini';
}

function stripInternalProxyFields(proxy) {
    if (!proxy || typeof proxy !== 'object') return proxy;
    const { metadata, ...publicProxy } = proxy;
    return publicProxy;
}

function deduplicateProxyNames(proxies) {
    const seen = new Map();
    proxies.forEach(proxy => {
        if (!proxy?.name) return;
        const originalName = proxy.name;
        const count = seen.get(originalName) || 0;
        seen.set(originalName, count + 1);
        if (count > 0) {
            proxy.name = `${originalName} ${count + 1}`;
        }
    });
}

export function isClashYamlProfileTemplate(templateText) {
    if (typeof templateText !== 'string' || templateText.trim() === '') return false;

    try {
        const parsed = yaml.load(templateText);
        return Boolean(
            parsed &&
            typeof parsed === 'object' &&
            !Array.isArray(parsed) &&
            Array.isArray(parsed['proxy-groups']) &&
            Array.isArray(parsed.rules)
        );
    } catch {
        return false;
    }
}

export function renderClashYamlProfileTemplate(templateText, nodeList, options = {}) {
    const config = yaml.load(templateText);
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return '';
    }

    const nodeUrls = String(nodeList || '')
        .split(/\r?\n+/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    const proxies = urlsToClashProxies(nodeUrls, options).map(stripInternalProxyFields);
    deduplicateProxyNames(proxies);

    return yaml.dump({
        ...config,
        proxies
    }, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        quotingType: '"',
        forceQuotes: false
    });
}

export class ProcessorService {
    /**
     * Generate nodes based on target format and configuration
     * @param {Object} context 
     * @param {Object} config 
     * @param {Object} params 
     */
    static async processNodes(context, config, params) {
        const { 
            userAgent, 
            targetMisubs, 
            prependedContent, 
            generationSettings, 
            isDebugToken, 
            shouldSkipCertVerify 
        } = params;

        // 1. Fetch and combine nodes
        const combinedNodeList = await generateCombinedNodeList(
            context,
            { ...config, enableAccessLog: false },
            userAgent,
            targetMisubs,
            prependedContent,
            generationSettings,
            isDebugToken,
            shouldSkipCertVerify
        );

        return combinedNodeList;
    }

    /**
     * Render the combined node list into the final format
     * @param {Object} options 
     */
    static async renderOutput(options) {
        const {
            targetFormat,
            combinedNodeList,
            subName,
            config,
            builtinOptions = {},
            templateSource = { kind: 'none', value: '' },
            managedConfigUrl,
            storageAdapter,
            userInfoHeader
        } = options || {};

        // Check for Base64 (simplest case)
        if (targetFormat === 'base64') {
            return {
                content: base64EncodeUtf8(combinedNodeList),
                contentType: 'text/plain; charset=utf-8',
                headers: userInfoHeader ? { 'Subscription-Userinfo': userInfoHeader } : {}
            };
        }

        // Handle built-in generation with optional templates
        const builtinProxyContent = transformBuiltinSubscription(combinedNodeList, targetFormat, {
            ...builtinOptions,
            managedConfigUrl
        });

        if (!builtinProxyContent) {
            // Fallback to raw Base64 if generator fails
            return {
                content: base64EncodeUtf8(combinedNodeList),
                contentType: 'text/plain; charset=utf-8',
                headers: userInfoHeader ? { 'Subscription-Userinfo': userInfoHeader } : {}
            };
        }

        let finalContent = builtinProxyContent;
        let contentType = 'text/plain; charset=utf-8';
        const headers = userInfoHeader ? { 'Subscription-Userinfo': userInfoHeader } : {};

        const shouldApplyTemplate = !builtinOptions.hiddifyCompatible;
        const builtinTemplateEntry = shouldApplyTemplate && templateSource.kind === 'builtin' ? getBuiltinTemplate(templateSource.value) : null;
        const customTemplateEntry = shouldApplyTemplate && templateSource.kind === 'custom' ? await resolveRuleTemplateSource(storageAdapter, templateSource) : null;
        const remoteTemplateUrl = shouldApplyTemplate && templateSource.kind === 'remote' ? templateSource.value : '';

        if (builtinTemplateEntry || customTemplateEntry || remoteTemplateUrl) {
            const templateText = builtinTemplateEntry?.content || customTemplateEntry?.content || await fetchTransformTemplate(storageAdapter, remoteTemplateUrl);
            const isIniTemplate = isIniTemplateSource(templateSource, builtinTemplateEntry || customTemplateEntry);

            if (templateText && isIniTemplate) {
                const renderParams = {
                    nodeList: combinedNodeList,
                    fileName: subName,
                    targetFormat,
                    ruleLevel: builtinOptions.ruleLevel,
                    interval: config.UpdateInterval || 86400,
                    managedConfigUrl,
                    skipCertVerify: builtinOptions.skipCertVerify,
                    enableUdp: builtinOptions.enableUdp,
                    isMeta: builtinOptions.isMeta
                };

                switch (targetFormat) {
                    case 'clash':
                        finalContent = renderClashFromIniTemplate(templateText, renderParams);
                        contentType = 'application/x-yaml; charset=utf-8';
                        break;
                    case 'singbox':
                    case 'sing-box':
                        finalContent = renderSingboxFromIniTemplate(templateText, renderParams);
                        contentType = 'application/json; charset=utf-8';
                        break;
                    case 'surge':
                    case 'surge&ver=4':
                        finalContent = renderSurgeFromIniTemplate(templateText, renderParams);
                        break;
                    case 'loon':
                        finalContent = renderLoonFromIniTemplate(templateText, renderParams);
                        break;
                    case 'quanx':
                        finalContent = renderQuanxFromIniTemplate(templateText, renderParams);
                        break;
                    case 'egern':
                        finalContent = renderEgernFromIniTemplate(templateText, renderParams);
                        contentType = 'application/x-yaml; charset=utf-8';
                        break;
                }
            } else if (templateText && targetFormat === 'clash' && isClashYamlProfileTemplate(templateText)) {
                finalContent = renderClashYamlProfileTemplate(templateText, combinedNodeList, builtinOptions);
                contentType = 'application/x-yaml; charset=utf-8';
                headers['X-MiSub-Template-Mode'] = 'clash-yaml-profile';
            }
        }

        // Set proper content type for built-in formats if not set by template
        if (contentType === 'text/plain; charset=utf-8') {
             if (targetFormat === 'clash' || targetFormat === 'egern') contentType = 'application/x-yaml; charset=utf-8';
             else if (targetFormat === 'singbox' || targetFormat === 'sing-box') contentType = 'application/json; charset=utf-8';
        }

        return {
            content: finalContent,
            contentType,
            headers
        };
    }
}
