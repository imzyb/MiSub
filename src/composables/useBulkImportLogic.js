import { ref } from 'vue';
import { useToastStore } from '../stores/toast.js';
import { useDataStore } from '../stores/useDataStore.js';
import { extractNodeName } from '../lib/utils.js';
import { generateNodeId, generateSubscriptionId } from '../utils/id.js';
import { COMMON_NODE_PROTOCOLS, createProtocolRegex } from '@/constants/nodeProtocols.js';
import { normalizeManualNodeGroupName } from './manual-nodes/groups.js';
import { parseSurgeConfig } from '../utils/protocolConverter.js';
import { api } from '../lib/http.js';
import { t } from '../i18n/index.js';

const BULK_IMPORT_NODE_PROTOCOLS = COMMON_NODE_PROTOCOLS;
const BULK_IMPORT_NODE_REGEX = createProtocolRegex(BULK_IMPORT_NODE_PROTOCOLS, false);

/**
 * 判断粘贴内容里是否含有前端无法解析、必须交给后端处理的节点格式：
 * - v2rayn:// 私有分享格式（base64 JSON，需要解码 + 证书指纹计算）
 * - Clash / mihomo YAML（proxies: ...）
 * - sing-box JSON（{"outbounds": [...]}）
 */
export function needsServerParsing(text) {
    if (/^v2rayn:\/\//im.test(text)) return true;
    if (/^\s*proxies\s*:/im.test(text)) return true;
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && /"outbounds"\s*:/.test(trimmed)) return true;
    return false;
}

export function useBulkImportLogic({ addSubscriptionsFromBulk, addNodesFromBulk }) {
    const { showToast } = useToastStore();
    const dataStore = useDataStore();
    const showModal = ref(false);

    /**
     * 交给后端把特殊格式转成标准分享 URI；失败时回退原文（前端能识别多少算多少）
     */
    const convertViaServer = async (importText) => {
        try {
            const parsed = await api.post('/api/parse_subscription', { content: importText });
            const converted = (parsed?.data?.nodes || [])
                .map((node) => node?.url)
                .filter(Boolean);
            if (!parsed?.success || converted.length === 0) return importText;

            // 订阅链接（http/https）后端不处理，原样保留
            const keptLines = importText
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => /^https?:\/\//i.test(line));

            return [...converted, ...keptLines].join('\n');
        } catch (error) {
            console.error('[bulk import] 后端解析失败，回退到前端解析:', error);
            return importText;
        }
    };

    const handleBulkImport = async (importText, group) => {
        if (!importText) return;

        const normalizedGroup = normalizeManualNodeGroupName(group);

        // v2rayn:// / YAML / sing-box JSON 前端解析不了，先交给后端统一转换
        let text = importText;
        if (needsServerParsing(importText)) {
            text = await convertViaServer(importText);
        }

        // 获取已存在的所有 URL，用于去重
        const existingUrls = new Set(
            (dataStore.subscriptions || []).map((s) => s.url).filter(Boolean)
        );

        // 先尝试解析 Surge 格式（name = protocol, server, port, ...）
        const surgeNodes = parseSurgeConfig(text);

        const lines = text
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
        const validSubs = [];
        const validNodes = [];

        // 如果成功解析出 Surge 节点，使用解析结果
        if (surgeNodes && surgeNodes.length > 0) {
            surgeNodes.forEach((node) => {
                // 去重检查：跳过已存在的 URL
                if (!existingUrls.has(node.url)) {
                    validNodes.push({
                        id: generateNodeId(),
                        name: node.name || t('bulkImport.unnamed'),
                        url: node.url,
                        enabled: true,
                        status: 'unchecked',
                        group: normalizedGroup || null,
                        colorTag: null,
                        exclude: '',
                        customUserAgent: '',
                        notes: '',
                    });
                }
            });
        }

        // 处理标准 URL 格式（逐行检查）
        lines.forEach((line) => {
            const baseItem = {
                name: extractNodeName(line) || t('bulkImport.unnamed'),
                url: line,
                enabled: true,
                status: 'unchecked',
                group: normalizedGroup || null,
                colorTag: null,
                // Default fields for subscriptions
                exclude: '',
                customUserAgent: '',
                notes: '',
            };

            if (/^https?:\/\//.test(line) && !BULK_IMPORT_NODE_REGEX.test(line)) {
                // 去重检查：订阅 URL
                if (!existingUrls.has(line)) {
                    validSubs.push({ ...baseItem, id: generateSubscriptionId() });
                }
            } else if (BULK_IMPORT_NODE_REGEX.test(line)) {
                // 避免重复添加已从 Surge 格式解析的节点
                const alreadyParsed = validNodes.some((n) => n.url === line);
                // 去重检查：节点 URL
                if (!alreadyParsed && !existingUrls.has(line)) {
                    validNodes.push({ ...baseItem, id: generateNodeId() });
                }
            }
        });

        let message = '';

        if (validSubs.length > 0) {
            addSubscriptionsFromBulk(validSubs);
            message += t('bulkImport.importedSubscriptions', { count: validSubs.length }) + ' ';
        }

        if (validNodes.length > 0) {
            addNodesFromBulk(validNodes, normalizedGroup);
            message += t('bulkImport.importedNodes', { count: validNodes.length });
        }

        if (message) {
            showToast(message, 'success');
        } else {
            showToast(t('bulkImport.noValidLinks'), 'warning');
        }
        showModal.value = false;
    };

    return {
        showModal,
        handleBulkImport,
    };
}
