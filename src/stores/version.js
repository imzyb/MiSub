import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { fetchGithubLatestRelease } from '../lib/api.js';
import packageJson from '../../package.json';

export const useVersionStore = defineStore('version', () => {
    // --- State ---
    const currentVersion = ref(packageJson.version);
    const latestRelease = ref(null);
    const showModal = ref(false);
    const showUpdateNotice = ref(false);
    const upstreamRepo = 'imzyb/MiSub';

    // 本地更新日志 (v2.7.0)
    const localChangelog = `✨ **订阅生成链路、内置模板与安全兼容性增强**
- **第三方转换链路修复**：第三方后端模式会先由 MiSub 完成节点预处理，再以内联节点发送给转换后端，避免外部服务回调 MiSub 链接时出现 \`No nodes were found!\`。
- **多节点外部转换兼容**：多节点内联统一使用 \`|\` 分隔，提升 FatSheep / subconverter 兼容性。
- **内置模板与规则集增强**：补强 ACL4SSR provider、远程规则集、Sing-Box 规则源、Hysteria2 realm 等输出细节。
- **服务集成 Cron 兼容恢复**：\`/cron?secret=[REDACTED]\` 兼容链接与 Bearer Token Header 推荐方式均可使用。
- **UI 与导入体验优化**：优化模板变量提示、自定义规则模板、客户端导入链接和节点刷新错误提示。`;

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
        return String(version || '').trim().replace(/^v/i, '');
    }

    function compareVersions(left, right) {
        const a = normalizeVersion(left).split('.').map(n => parseInt(n, 10) || 0);
        const b = normalizeVersion(right).split('.').map(n => parseInt(n, 10) || 0);
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
                    if (localStorage.getItem(dismissKey) !== 'true') {
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
            localStorage.setItem(getDismissKey(latestRelease.value.tag_name), 'true');
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
        suppressUpdateModal
    };
});
