import { ref } from 'vue';
import { useToastStore } from '../stores/toast.js';
import { useDataStore } from '../stores/useDataStore.js';
import { extractNodeName } from '../lib/utils.js';
import { generateNodeId, generateSubscriptionId } from '../utils/id.js';
import { COMMON_NODE_PROTOCOLS, createProtocolRegex } from '@/constants/nodeProtocols.js';
import { normalizeManualNodeGroupName } from './manual-nodes/groups.js';
import { parseSurgeConfig } from '../utils/protocolConverter.js';
import { t } from '../i18n/index.js';

const BULK_IMPORT_NODE_PROTOCOLS = COMMON_NODE_PROTOCOLS.filter(protocol => protocol !== 'http' && protocol !== 'https');
const BULK_IMPORT_NODE_REGEX = createProtocolRegex(BULK_IMPORT_NODE_PROTOCOLS, false);

export function useBulkImportLogic({ addSubscriptionsFromBulk, addNodesFromBulk }) {
    const { showToast } = useToastStore();
    const dataStore = useDataStore();
    const showModal = ref(false);

    const handleBulkImport = (importText, group) => {
        if (!importText) return;

        const normalizedGroup = normalizeManualNodeGroupName(group);
        
        // 获取已存在的所有 URL，用于去重
        const existingUrls = new Set(
            (dataStore.subscriptions || []).map(s => s.url).filter(Boolean)
        );
        
        // 先尝试解析 Surge 格式（name = protocol, server, port, ...）
        const surgeNodes = parseSurgeConfig(importText);
        
        const lines = importText.split('\n').map(line => line.trim()).filter(Boolean);
        const validSubs = [];
        const validNodes = [];

        // 如果成功解析出 Surge 节点，使用解析结果
        if (surgeNodes && surgeNodes.length > 0) {
            surgeNodes.forEach(node => {
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
                        notes: ''
                    });
                }
            });
        }

        // 处理标准 URL 格式（逐行检查）
        lines.forEach(line => {
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
                notes: ''
            };

            if (/^https?:\/\//.test(line)) {
                // 去重检查：订阅 URL
                if (!existingUrls.has(line)) {
                    validSubs.push({ ...baseItem, id: generateSubscriptionId() });
                }
            } else if (BULK_IMPORT_NODE_REGEX.test(line)) {
                // 避免重复添加已从 Surge 格式解析的节点
                const alreadyParsed = validNodes.some(n => n.url === line);
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
            addNodesFromBulk(validNodes);
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
        handleBulkImport
    };
}
