import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { fetchGithubLatestRelease } from '../lib/api.js';
import { t } from '../i18n/index.js';
import { useToastStore } from './toast.js';
import { readRawPreference, writeRawPreference } from '../utils/local-preference.js';
import packageJson from '../../package.json';

export const useVersionStore = defineStore('version', () => {
    // --- State ---
    const currentVersion = ref(packageJson.version);
    const latestRelease = ref(null);
    const showModal = ref(false);
    const showUpdateNotice = ref(false);
    const upstreamRepo = 'imzyb/MiSub';

    // 本地更新日志 (v2.8.0)
    const localChangelog = `✨ **节点持久化、订阅标识重构与全站国际化**
- **节点持久化**：新增持久化开关，启用即全量回填；订阅输出接入 D1 单行快照并支持超大订阅分片，Cron 与外部 API 刷新口径统一。
- **订阅标识 linkId**：订阅链接改用独立 linkId，新增服务端校验与重置，退役标识不再可访问，历史 ID 自动兼容。
- **组合订阅与排序**：支持「我的订阅」嵌套组合订阅、单机场订阅禁用自动更新、包含与剔除规则并存，节点排序新增正则置顶优先级。
- **国际化与无障碍**：全站中英双语覆盖，补齐静默失败的用户反馈，加固对比度与焦点样式，全局确认弹窗替代原生 confirm。
- **同步工作流**：Fork Sync 改为合并式同步（冲突回滚、不重置不强推），日志与运行摘要统一北京时间。`;

    // --- Getters ---
    const hasUpdate = computed(() => {
        if (!latestRelease.value?.tag_name) return false;
        return compareVersions(latestRelease.value.tag_name, currentVersion.value) > 0;
    });

    const isUpToDate = computed(() => {
        if (!latestRelease.value?.tag_name) return true;
        return compareVersions(latestRelease.value.tag_name, currentVersion.value) === 0;
    });

    // --- Helpers ---
    function normalizeVersion(version) {
        return String(version || '')
            .trim()
            .replace(/^v/i, '');
    }

    function compareVersions(left, right) {
        const a = normalizeVersion(left)
            .split('.')
            .map((n) => parseInt(n, 10) || 0);
        const b = normalizeVersion(right)
            .split('.')
            .map((n) => parseInt(n, 10) || 0);
        const maxLen = Math.max(a.length, b.length);
        for (let i = 0; i < maxLen; i += 1) {
            const av = a[i] || 0;
            const bv = b[i] || 0;
            if (av > bv) return 1;
            if (av < bv) return -1;
        }
        return 0;
    }

    function getDismissKey(releaseTag) {
        return `misub_release_notes_hidden:${normalizeVersion(currentVersion.value)}:${normalizeVersion(releaseTag)}`;
    }

    // --- Actions ---
    async function checkVersion(suppressModal = false) {
        try {
            const release = await fetchGithubLatestRelease(upstreamRepo);
            if (release?.tag_name) {
                latestRelease.value = release;
                const comparison = compareVersions(release.tag_name, currentVersion.value);

                if (comparison > 0) {
                    showUpdateNotice.value = true;
                } else if (comparison === 0 && !suppressModal) {
                    // 如果已是最新且未被禁止，则尝试显示更新日志
                    const dismissKey = getDismissKey(release.tag_name);
                    if (readRawPreference(dismissKey) !== 'true') {
                        showModal.value = true;
                    }
                }
            }
        } catch (error) {
            console.error('[VersionStore] Failed to check version:', error);
        }
    }

    function openModal() {
        showModal.value = true;
    }

    function closeModal() {
        showModal.value = false;
    }

    function suppressUpdateModal() {
        if (latestRelease.value?.tag_name) {
            // 写失败时必须告知用户：否则下次启动更新提示又会冒出来。
            const persisted = writeRawPreference(
                getDismissKey(latestRelease.value.tag_name),
                'true'
            );
            if (!persisted) useToastStore().showToast(t('errors.preferenceNotSaved'), 'error');
        }
        showModal.value = false;
    }

    return {
        currentVersion,
        latestRelease,
        localChangelog,
        showModal,
        showUpdateNotice,
        hasUpdate,
        isUpToDate,
        checkVersion,
        openModal,
        closeModal,
        suppressUpdateModal,
    };
});
