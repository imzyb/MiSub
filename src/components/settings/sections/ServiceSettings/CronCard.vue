<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
    settings: {
        type: Object,
        required: true
    }
});

// 折叠状态
const showCronGuide = ref(false);

// Cron URL
const cronUrl = computed(() => {
    const secret = props.settings.cronSecret;
    if (!secret) {
        return '';
    }
    return `${window.location.origin}/cron?secret=${secret}`;
});

// 复制 Cron URL
function copyCronUrl() {
    if (cronUrl.value) {
        navigator.clipboard.writeText(cronUrl.value);
    }
}
</script>

<template>
    <!-- 自动任务配置 (Cron) 卡片 -->
    <div
        class="bg-white/90 dark:bg-gray-900/70 misub-radius-lg p-6 space-y-5 border border-gray-100/80 dark:border-white/10 shadow-sm transition-shadow duration-300">
        <div class="flex justify-between items-start">
            <div>
                <h3 class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-500" fill="none"
                        viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    自动任务配置 (Cron)
                </h3>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    定时更新所有订阅的流量信息和节点数量，并在订阅临期或流量不足时通过 Telegram 发送提醒。
                </p>
            </div>
            <button @click="showCronGuide = !showCronGuide"
                class="text-blue-600 hover:text-blue-500 text-xs font-medium">
                {{ showCronGuide ? '收起' : '如何配置?' }}
            </button>
        </div>

        <!-- Cron Secret 输入框 -->
        <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cron Secret</label>
            <input type="text" v-model="settings.cronSecret" placeholder="自定义一个密钥，用于保护定时任务接口"
                class="block w-full px-3 py-2.5 bg-white/70 dark:bg-gray-900/50 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 sm:text-sm dark:text-white transition-colors">
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                设置一个随机字符串用于验证定时任务请求，保存后将自动生成访问链接
            </p>
        </div>

        <!-- Cron 访问链接（自动生成） -->
        <div v-if="cronUrl">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cron 访问链接（自动生成）
            </label>
            <div class="flex misub-radius-lg shadow-xs">
                <input type="text" :value="cronUrl" readonly
                    class="flex-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-l-xl sm:text-sm dark:text-white font-mono text-xs">
                <button @click="copyCronUrl" type="button"
                    class="inline-flex items-center px-4 py-2 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-hidden">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                </button>
            </div>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                复制此链接配置到外部定时任务服务
            </p>
        </div>
        <div v-else
            class="bg-yellow-50/80 dark:bg-yellow-900/20 border border-yellow-200/80 dark:border-yellow-800/70 misub-radius-md p-3">
            <p class="text-xs text-yellow-700 dark:text-yellow-300">
                💡 填写 Cron Secret 后，将自动生成访问链接
            </p>
        </div>

        <div v-if="showCronGuide" class="text-xs text-gray-600 dark:text-gray-300 space-y-2">
            <p>由于 Cloudflare Pages 免费版不支持 Cron Trigger，请使用外部监控服务（如 UptimeRobot, Cron-Job.org）定时访问上方生成的链接。</p>
            <p class="text-gray-500">建议频率：每天一次 (Every 24 hours)</p>
        </div>
    </div>
</template>
