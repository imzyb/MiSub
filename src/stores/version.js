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

    // 本地更新日志 (v2.6.1)
    const localChangelog = `🚀 **核心重构 - 级联转换引擎**
- **引擎驱动架构**：引入了全新的“引擎驱动”逻辑模型，支持 **URL 参数 > 订阅组配置 > 全局设置 > 内置默认** 的四级级联逻辑，彻底解决逻辑混淆。
- **物理总开关**：在全局设置面板新增了“默认引擎主控”卡片，通过显式的物理开关决定主订阅生成的基准，并配备活跃状态视觉反馈。
- **分步配置交互**：重构了订阅组编辑 UI，将引擎选择提升为“第一步”首要开关，并根据选择动态渲染后续参数面板。
- **状态感知透传**：在订阅组选择“跟随全局”时，现在会实时提示当前系统默认生效的具体引擎状态，消除配置不确定性。

🔧 **后端与兼容性优化**
- **默认后端升级**：将默认第三方 Subconverter 接口更新为更稳定的 \`subapi.cmliussss.net\`。
- **参数透传矩阵**：优化了第三方引擎下的参数拼接算法，支持更精准的 UDP 转发、Emoji 过滤及节点排序等 20+ 项高级参数的级联覆盖。
- **稳定性修复**：彻底清理了重定向逻辑中的潜在循环引用问题，提升了在 Edge 环境下的响应速度。`;

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
