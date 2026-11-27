<script setup>
    /**
     * 路由切换进度条 + 慢加载提示。
     *
     * 为什么需要它：路由组件都是 () => import() 懒加载的，vue-router 只有等异步组件
     * 解析完才确认导航 —— 期间 URL 不变、内容不变，用户点了菜单会觉得“没反应”。
     * 这个组件在导航刚开始时立刻画出顶部进度条，超过 threshold 毫秒仍未完成，
     * 再补一个居中的“正在加载”小胶囊，保证点击永远有即时反馈。
     */
    import { computed, onUnmounted, ref, watch } from "vue";
    import { useI18n } from "../../i18n/index.js";

    const props = defineProps({
        active: { type: Boolean, default: false },
        /** 超过多少毫秒才显示居中提示（短导航不打扰） */
        threshold: { type: Number, default: 400 },
    });

    const { t } = useI18n();

    const visible = ref(false);
    const percent = ref(0);
    const showHint = ref(false);

    let tickTimer = null;
    let hintTimer = null;
    let hideTimer = null;

    function clearTimers() {
        clearInterval(tickTimer);
        clearTimeout(hintTimer);
        clearTimeout(hideTimer);
        tickTimer = null;
        hintTimer = null;
        hideTimer = null;
    }

    watch(
        () => props.active,
        (isActive) => {
            clearTimers();

            if (isActive) {
                visible.value = true;
                percent.value = 10;
                showHint.value = false;

                tickTimer = setInterval(() => {
                    const remain = 90 - percent.value;
                    percent.value += Math.max(0.4, remain * 0.14);
                }, 110);

                hintTimer = setTimeout(() => {
                    showHint.value = true;
                }, props.threshold);
                return;
            }

            if (!visible.value) return;

            percent.value = 100;
            hideTimer = setTimeout(() => {
                visible.value = false;
                showHint.value = false;
                percent.value = 0;
            }, 220);
        },
        { immediate: true }
    );

    onUnmounted(clearTimers);

    const barStyle = computed(() => ({
        width: percent.value + "%",
        opacity: percent.value >= 100 ? 0 : 1,
    }));
</script>

<template>
    <div class="pointer-events-none fixed inset-x-0 top-0 z-[120]" aria-hidden="true">
        <div v-show="visible" class="h-[2px] w-full bg-transparent">
            <div
                class="h-full rounded-r-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 transition-[width,opacity] duration-200 ease-out"
                :style="barStyle"
            ></div>
        </div>
    </div>

    <Transition name="fade">
        <div
            v-if="showHint && active"
            class="pointer-events-none fixed left-1/2 top-14 z-[119] flex -translate-x-1/2 items-center gap-2 rounded-full border border-gray-200/70 bg-white/95 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-gray-900/95 dark:text-gray-200"
            role="status"
            aria-live="polite"
            data-route-loading
        >
            <svg class="h-3.5 w-3.5 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            {{ t("notices.routeLoading") }}
        </div>
    </Transition>
</template>
