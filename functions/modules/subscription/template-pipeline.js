import { parseIniTemplate } from './template-parsers/ini-template-parser.js';
import { applySmartModelOptimizations } from './template-processor.js';
import { renderClashFromTemplateModel } from './template-renderers/render-clash.js';
import { renderSingboxFromTemplateModel } from './template-renderers/render-singbox.js';
import { renderSurgeFromTemplateModel } from './template-renderers/render-surge.js';
import { renderLoonFromTemplateModel } from './template-renderers/render-loon.js';
import { renderQuanxFromTemplateModel } from './template-renderers/render-quanx.js';
import { renderEgernFromTemplateModel } from './template-renderers/render-egern.js';
import { urlsToClashProxies } from '../../utils/url-to-clash.js';
import { getUniqueName } from './name-utils.js';

/**
 * 处理重名节点，确保每个节点名称唯一
 * @param {Object[]} proxies - 代理对象数组
 */
function deduplicateNames(proxies) {
    if (!Array.isArray(proxies)) return;
    const usedNames = new Map();
    proxies.forEach(proxy => {
        if (proxy && proxy.name) {
            proxy.name = getUniqueName(proxy.name, usedNames);
        }
    });
}

export function renderClashFromIniTemplate(templateText, options = {}) {
    const nodeList = typeof options.nodeList === 'string' ? options.nodeList : '';
    const proxyUrls = nodeList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    const proxies = Array.isArray(options.proxies) ? options.proxies : urlsToClashProxies(proxyUrls, options);
    deduplicateNames(proxies);
    
    let model = parseIniTemplate(templateText, {
        ...options,
        proxies
    });

    // 智能注入地区分组逻辑
    model = applySmartModelOptimizations(model);
    
    return renderClashFromTemplateModel(model);
}

export function renderSingboxFromIniTemplate(templateText, options = {}) {
    const nodeList = typeof options.nodeList === 'string' ? options.nodeList : '';
    const proxyUrls = nodeList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    const proxies = Array.isArray(options.proxies) ? options.proxies : urlsToClashProxies(proxyUrls, options);
    deduplicateNames(proxies);

    let model = parseIniTemplate(templateText, {
        ...options,
        proxies
    });
    model = applySmartModelOptimizations(model);
    return renderSingboxFromTemplateModel(model, options);
}

export function renderSurgeFromIniTemplate(templateText, options = {}) {
    const nodeList = typeof options.nodeList === 'string' ? options.nodeList : '';
    const proxyUrls = nodeList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    const proxies = Array.isArray(options.proxies) ? options.proxies : urlsToClashProxies(proxyUrls, options);
    deduplicateNames(proxies);

    let model = parseIniTemplate(templateText, {
        ...options,
        proxies
    });
    model = applySmartModelOptimizations(model);
    return renderSurgeFromTemplateModel(model, options);
}

export function renderLoonFromIniTemplate(templateText, options = {}) {
    const nodeList = typeof options.nodeList === 'string' ? options.nodeList : '';
    const proxyUrls = nodeList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    const proxies = Array.isArray(options.proxies) ? options.proxies : urlsToClashProxies(proxyUrls, options);
    deduplicateNames(proxies);

    let model = parseIniTemplate(templateText, {
        ...options,
        proxies
    });
    model = applySmartModelOptimizations(model);
    return renderLoonFromTemplateModel(model, options);
}

export function renderQuanxFromIniTemplate(templateText, options = {}) {
    const nodeList = typeof options.nodeList === 'string' ? options.nodeList : '';
    const proxyUrls = nodeList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    const proxies = Array.isArray(options.proxies) ? options.proxies : urlsToClashProxies(proxyUrls, options);
    deduplicateNames(proxies);

    let model = parseIniTemplate(templateText, {
        ...options,
        proxies
    });
    model = applySmartModelOptimizations(model);
    return renderQuanxFromTemplateModel(model, options);
}

export function renderEgernFromIniTemplate(templateText, options = {}) {
    const nodeList = typeof options.nodeList === 'string' ? options.nodeList : '';
    const proxyUrls = nodeList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    const proxies = Array.isArray(options.proxies) ? options.proxies : urlsToClashProxies(proxyUrls, options);
    deduplicateNames(proxies);

    let model = parseIniTemplate(templateText, {
        ...options,
        proxies
    });
    model = applySmartModelOptimizations(model);
    return renderEgernFromTemplateModel(model);
}
