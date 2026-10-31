<script setup>
    import { useI18n } from '../../i18n/index.js';

    const { t } = useI18n();
    import { ref, watch } from 'vue';
    import { useToastStore } from '../../stores/toast.js';
    import Modal from '../forms/Modal.vue';
    import { handleError } from '../../utils/errorHandler.js';
    import { generateNodeId } from '../../utils/id.js';
    import { api, APIError } from '../../lib/http.js';
    import FormatDetector from './SubscriptionImport/FormatDetector.vue';
    import ImportForm from './SubscriptionImport/ImportForm.vue';
    import FileImport from './SubscriptionImport/FileImport.vue';
    import ParseResult from './SubscriptionImport/ParseResult.vue';
    import GroupSelector from '../ui/GroupSelector.vue'; // Added
    import { readFilesAsText } from '../../utils/importFile.js';
    import { buildAutoGroupName } from '../../utils/auto-group-name.js';

    const isDev = import.meta.env.DEV;

    const props = defineProps({
        show: Boolean,
        addNodesFromBulk: Function,
        groups: {
            // Added
            type: Array,
            default: () => [],
        },
    });

    const emit = defineEmits(['update:show']);

    const activeTab = ref('url'); // 'url' | 'file'
    const subscriptionUrl = ref('');
    const isLoading = ref(false);
    const errorMessage = ref('');
    const successMessage = ref('');
    const parseStatus = ref('');
    const groupName = ref(''); // Added

    const toastStore = useToastStore();

    watch(
        () => props.show,
        (newVal) => {
            if (!newVal) {
                // 重置所有状态
                subscriptionUrl.value = '';
                groupName.value = ''; // Added
                errorMessage.value = '';
                successMessage.value = '';
                parseStatus.value = '';
                isLoading.value = false;
                activeTab.value = 'url';
            }
        }
    );

    /**
     * 把后端返回的节点写入手动节点列表（URL 导入与文件导入共用）。
     * @returns {boolean} 是否至少写入了一个节点
     */
    const commitParsedNodes = (backendNodes, targetGroupName, sourceLabel) => {
        const nodes = (backendNodes || []).map((node) => ({
            id: generateNodeId(),
            name: node.name || 'Unknown',
            url: node.url,
            enabled: true,
            protocol: node.protocol || 'unknown',
            source: 'import',
        }));

        if (nodes.length === 0) return false;

        // 去重处理
        const uniqueNodes = nodes.filter(
            (node, index, self) => index === self.findIndex((n) => n.url === node.url)
        );
        const duplicateCount = nodes.length - uniqueNodes.length;

        props.addNodesFromBulk(uniqueNodes, targetGroupName);

        const successMsg =
            t('importNodes.addedNodes', { count: uniqueNodes.length }) +
            (targetGroupName ? t('importNodes.addedToGroup', { group: targetGroupName }) : '') +
            (duplicateCount > 0 ? t('importNodes.dedupedSuffix', { count: duplicateCount }) : '');

        successMessage.value = successMsg;
        toastStore.showToast(successMsg, 'success');
        if (isDev) {
            console.debug(
                `[Import] ${sourceLabel}: ${uniqueNodes.length} unique nodes, ${duplicateCount} duplicates`
            );
        }

        setTimeout(() => {
            emit('update:show', false);
        }, 2000);
        return true;
    };

    /**
     * 上传本地文件导入：读取文件文本 → 后端解析 → 入库。
     */
    const importFiles = async (fileList) => {
        // 用户未填分组时，用文件名自动生成，免去手填
        if (!groupName.value.trim() && fileList?.length) {
            groupName.value = buildAutoGroupName({ fileName: fileList[0].name });
        }
        const targetGroupName = groupName.value;
        errorMessage.value = '';
        successMessage.value = '';
        isLoading.value = true;

        try {
            parseStatus.value = t('importNodes.readingFile');
            const { text, fileCount } = await readFilesAsText(fileList);

            if (!text.trim()) {
                throw new Error(t('importNodes.emptyFile'));
            }

            parseStatus.value = t('importNodes.parsingFiles', { count: fileCount });

            const parseResult = await api.post('/api/parse_subscription', { content: text });

            if (!parseResult.success) {
                throw new Error(parseResult.error || t('importNodes.parseFileFailed'));
            }

            const backendNodes = parseResult.data?.nodes || [];

            if (backendNodes.length === 0) {
                parseStatus.value = '';
                throw new Error(t('importNodes.noValidNodesFromFile'));
            }

            parseStatus.value = '';
            commitParsedNodes(backendNodes, targetGroupName, 'File upload');
        } catch (error) {
            console.error('文件导入失败:', error);
            handleError(error, 'File Import Error', { parseStatus: parseStatus.value });
            parseStatus.value = '';
            errorMessage.value = error.message || t('importNodes.failed');
            toastStore.showToast(
                t('importNodes.failedWithMessage', { message: error.message }),
                'error'
            );
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * 验证URL格式
     */
    const isValidUrl = (url) => {
        try {
            const u = new URL(url);
            return u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
            return false;
        }
    };

    /**
     * 导入订阅
     */
    const importSubscription = async () => {
        const targetGroupName = groupName.value; // Capture immediately to avoid reset by watcher when modal closes

        // 验证URL
        if (!isValidUrl(subscriptionUrl.value)) {
            errorMessage.value = t('importNodes.invalidUrl');
            return;
        }

        isLoading.value = true;
        parseStatus.value = t('importNodes.fetchingSubscription');

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000); // 20秒超时

            let responseData;
            try {
                responseData = await api.post(
                    '/api/fetch_external_url',
                    {
                        url: subscriptionUrl.value,
                        timeout: 15000,
                    },
                    {
                        signal: controller.signal,
                    }
                );
            } catch (error) {
                if (error instanceof APIError) {
                    const errorMsg =
                        error.data?.error ||
                        error.data?.message ||
                        error.message ||
                        `HTTP ${error.status}`;

                    // 根据错误类型提供友好的错误信息
                    if (error.status === 408 || errorMsg.includes('timeout')) {
                        throw new Error(t('importNodes.requestTimeout'));
                    } else if (error.status === 413 || errorMsg.includes('too large')) {
                        throw new Error(t('importNodes.contentTooLarge'));
                    } else if (errorMsg.includes('DNS')) {
                        throw new Error(t('importNodes.dnsFailed'));
                    } else if (error.status >= 500) {
                        throw new Error(t('importNodes.serverError'));
                    }
                    throw new Error(errorMsg);
                }
                throw error;
            } finally {
                clearTimeout(timeoutId);
            }

            if (!responseData.success) {
                throw new Error(responseData.error || t('importNodes.fetchFailed'));
            }

            parseStatus.value = t('importNodes.parsingSubscription');

            // [重构] 调用后端解析API
            const parseResult = await api.post('/api/parse_subscription', {
                content: responseData.content,
            });

            if (!parseResult.success) {
                throw new Error(parseResult.error || t('importNodes.parseSubscriptionFailed'));
            }

            const backendNodes = parseResult.data.nodes || [];

            if (backendNodes.length > 0) {
                commitParsedNodes(backendNodes, targetGroupName, 'URL import');
            } else {
                parseStatus.value = '';
                throw new Error(t('importNodes.noValidNodesFromSubscription'));
            }
        } catch (error) {
            console.error('导入订阅失败:', error);
            handleError(error, 'Subscription Import Error', {
                url: subscriptionUrl.value,
                parseStatus: parseStatus.value,
            });

            errorMessage.value = error.message || t('importNodes.failed');
            toastStore.showToast(
                t('importNodes.failedWithMessage', { message: error.message }),
                'error'
            );
        } finally {
            isLoading.value = false;
        }
    };
</script>

<template>
    <Modal
        :show="show"
        @update:show="emit('update:show', $event)"
        @confirm="activeTab === 'url' ? importSubscription() : null"
    >
        <template #title>{{ t('importNodes.title') }}</template>
        <template #footer>
            <button
                @click="emit('update:show', false)"
                class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold text-sm misub-radius-lg transition-colors"
            >
                {{ t('actions.cancel') }}
            </button>
            <button
                v-if="activeTab === 'url'"
                @click="importSubscription"
                :disabled="isLoading || !subscriptionUrl.trim()"
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm misub-radius-lg transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {{ t('actions.import') }}
            </button>
        </template>
        <template #body>
            <div class="space-y-4">
                <!-- 来源切换 -->
                <div class="grid grid-cols-2 gap-1 p-1 bg-gray-100 dark:bg-white/5 misub-radius-lg">
                    <button
                        type="button"
                        class="py-1.5 text-sm font-medium misub-radius-md transition-colors"
                        :class="
                            activeTab === 'url'
                                ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-xs'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        "
                        @click="activeTab = 'url'"
                    >
                        {{ t('importNodes.subscriptionUrl') }}
                    </button>
                    <button
                        type="button"
                        class="py-1.5 text-sm font-medium misub-radius-md transition-colors"
                        :class="
                            activeTab === 'file'
                                ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-xs'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        "
                        @click="activeTab = 'file'"
                    >
                        {{ t('importNodes.tabFile') }}
                    </button>
                </div>

                <!-- Group Selector Added -->
                <div class="relative">
                    <label
                        class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 ml-1 block"
                    >
                        {{ t('importNodes.targetGroup') }}
                    </label>
                    <GroupSelector
                        v-model="groupName"
                        :groups="groups"
                        :placeholder="t('importNodes.targetGroupPlaceholder')"
                        class="w-full"
                    />
                </div>

                <template v-if="activeTab === 'url'">
                    <FormatDetector />
                    <ImportForm
                        :subscription-url="subscriptionUrl"
                        :is-loading="isLoading"
                        @update:subscription-url="subscriptionUrl = $event"
                        @submit="importSubscription"
                    />
                    <ParseResult
                        :is-loading="isLoading"
                        :parse-status="parseStatus"
                        :error-message="errorMessage"
                        :success-message="successMessage"
                    />
                </template>

                <FileImport
                    v-else
                    :is-processing="isLoading"
                    :parse-status="parseStatus"
                    :error-message="errorMessage"
                    :success-message="successMessage"
                    @files="importFiles"
                />
            </div>
        </template>
    </Modal>
</template>
