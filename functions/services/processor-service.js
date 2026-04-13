/**
 * MiSub Core Processing Service
 * Handles the logic of: Profile Resolving -> Node Fetching -> Transformation Pipeline -> Response Rendering
 */

import { generateCombinedNodeList } from './subscription-service.js';
import { transformBuiltinSubscription } from '../modules/subscription/transformer-factory.js';
import { renderClashFromIniTemplate, renderSingboxFromIniTemplate, renderSurgeFromIniTemplate, renderLoonFromIniTemplate, renderQuanxFromIniTemplate, renderEgernFromIniTemplate } from '../modules/subscription/template-pipeline.js';
import { getBuiltinTemplate } from '../modules/subscription/builtin-template-registry.js';
import { fetchTransformTemplate } from '../modules/subscription/transform-template-cache.js';

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
            builtinOptions,
            templateSource,
            managedConfigUrl,
            storageAdapter,
            userInfoHeader
        } = options;

        // Check for Base64 (simplest case)
        if (targetFormat === 'base64') {
            return {
                content: btoa(unescape(encodeURIComponent(combinedNodeList))),
                contentType: 'text/plain; charset=utf-8',
                headers: userInfoHeader ? { 'Subscription-Userinfo': userInfoHeader } : {}
            };
        }

        // Handle built-in generation with optional templates
        const builtinProxyContent = transformBuiltinSubscription(combinedNodeList, targetFormat, {
            ...builtinOptions,
            managedConfigUrl: ''
        });

        if (!builtinProxyContent) {
            // Fallback to raw Base64 if generator fails
            return {
                content: btoa(unescape(encodeURIComponent(combinedNodeList))),
                contentType: 'text/plain; charset=utf-8',
                headers: userInfoHeader ? { 'Subscription-Userinfo': userInfoHeader } : {}
            };
        }

        let finalContent = builtinProxyContent;
        let contentType = 'text/plain; charset=utf-8';
        const headers = userInfoHeader ? { 'Subscription-Userinfo': userInfoHeader } : {};

        const builtinTemplateEntry = templateSource.kind === 'builtin' ? getBuiltinTemplate(templateSource.value) : null;
        const remoteTemplateUrl = templateSource.kind === 'remote' ? templateSource.value : '';

        if (builtinTemplateEntry || remoteTemplateUrl) {
            const templateText = builtinTemplateEntry?.content || await fetchTransformTemplate(storageAdapter, remoteTemplateUrl);
            const isIniTemplate = builtinTemplateEntry?.format === 'ini' || (remoteTemplateUrl && remoteTemplateUrl.toLowerCase().endsWith('.ini'));

            if (templateText && isIniTemplate) {
                const renderParams = {
                    nodeList: combinedNodeList,
                    fileName: subName,
                    targetFormat,
                    ruleLevel: builtinOptions.ruleLevel,
                    interval: config.UpdateInterval || 86400,
                    managedConfigUrl,
                    skipCertVerify: builtinOptions.skipCertVerify,
                    enableUdp: builtinOptions.enableUdp
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
