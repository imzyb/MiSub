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

    // 本地更新日志 (v2.6.0)
    const localChangelog = `✨ **核心特性 - 规则引擎重构**
- **全节点覆盖逻辑**：优化了地区识别算法，所有未匹配地区的节点均会归类至“🌍 其他地区”，彻底解决了以往部分节点在内置规则下“失踪”的问题。
- **三维监控策略组**：在内置规则中引入了“♻️ 全球自动”、“🔯 故障转移”与“👋 手动切换”三大核心策略组，提升了在不同网络波动环境下的适应性。
- **嵌套自动化深度分组**：重构了地区分组层级，现在每个地区组（如“🇭🇰 香港节点”）均内置二级“⚡ 自动选择”子组，实现“先自动、后手动”的专业化路由逻辑。

🎨 **预设模板库扩充**
- **AI 开发者专用**：新增针对 OpenAI、Claude 等 AI 服务的深度优化模板，提供更稳定的连接保持能力。
- **游戏竞技优化**：新增针对各主流竞技平台（Steam, Epic, Sony 等）的专项分流模板，大幅降低联机延迟。

🚀 **性能与稳定性**
- **Sing-Box 适配优化**：精细化了 Sing-box 的 outbound 映射逻辑，降低了自动测速带来的设备能耗。
- **单 KV 模式缓存修复**：彻底修复了单 KV 环境下的 UI 缓存回退 Bug，并优化了边缘节点响应头。

🔧 **UI/UX 增强**
- **搜索与交互**：修复了仪表盘搜索崩溃问题，并为各层级选择器增加了直观的 Emoji 引导。`;

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
