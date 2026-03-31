/**
 * 解析订阅内容API处理器
 * 用于前端导入订阅功能
 */

import { parseNodeList } from './utils/node-parser.js';
import { createJsonResponse, createErrorResponse } from './utils.js';

/**
 * 处理订阅内容解析请求
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleParseSubscription(request, env) {
    try {
        const { content } = await request.json();

        if (!content || typeof content !== 'string') {
            return createJsonResponse({
                success: false,
                error: '请提供有效的订阅内容'
            }, 400);
        }

        // 使用后端的节点解析器
        const parsedNodes = parseNodeList(content);

        // 过滤掉无效节点
        const validNodes = parsedNodes.filter(node => node && node.url);

        console.info(`[API /parse_subscription] Parsed ${validNodes.length} valid nodes from ${content.length} characters`);

        return createJsonResponse({
            success: true,
            data: {
                nodes: validNodes,
                totalCount: validNodes.length
            }
        });

    } catch (error) {
        console.error('[API Error /parse_subscription]', error);
        return createJsonResponse({
            success: false,
            error: `解析失败: ${error.message}`
        }, 500);
    }
}
