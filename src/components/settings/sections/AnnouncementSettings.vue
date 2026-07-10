<script setup>
import { computed, watch } from 'vue';
import DOMPurify from 'dompurify';
import Switch from '../../ui/Switch.vue';
import { useI18n } from '../../../i18n/index.js';

const { t } = useI18n();

const props = defineProps({
    settings: {
        type: Object,
        required: true
    }
});

const defaultAnnouncement = {
    enabled: false,
    title: '',
    content: '',
    type: 'info', // info, warning, success
    dismissible: true,
    updatedAt: null
};

const ensureAnnouncement = () => {
    if (!props.settings.announcement) {
        props.settings.announcement = { ...defaultAnnouncement };
    }
};

ensureAnnouncement();

watch(() => props.settings.announcement, (val) => {
    if (!val) ensureAnnouncement();
});

// 确保 announcement 对象存在
const announcement = computed(() => props.settings.announcement || defaultAnnouncement);

const allowedContentTags = ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'li'];
const allowedContentAttrs = ['href', 'target', 'rel'];

const sanitizedContent = computed(() => DOMPurify.sanitize(announcement.value.content || '', {
    ALLOWED_TAGS: allowedContentTags,
    ALLOWED_ATTR: allowedContentAttrs
}));

const handleContentUpdate = () => {
    announcement.value.updatedAt = new Date().toISOString();
};
</script>

<template>
    <div class="space-y-6">
        <!-- 头部说明 -->
        <div
            class="bg-white/90 dark:bg-gray-900/70 misub-radius-lg p-6 space-y-6 border border-gray-100/80 dark:border-white/10 shadow-sm animate-fade-in-down">
            <h3 class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
                {{ t('settings.announcementTitle') }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('settings.announcementDesc') }}
            </p>

            <div
                class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 misub-radius-lg">
                <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.announcementEnable') }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('settings.announcementEnableDesc') }}</p>
                </div>
                <Switch 
                    v-model="announcement.enabled"
                    @change="handleContentUpdate"
                />
            </div>
        </div>

        <!-- 内容编辑 -->
        <div v-if="announcement.enabled"
            class="bg-white dark:bg-gray-800 misub-radius-lg p-6 space-y-6 border border-gray-100 dark:border-gray-700 shadow-sm animate-fade-in-down">

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- 标题 -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('settings.announcementFieldTitle') }}</label>
                    <input type="text" v-model="announcement.title" @input="handleContentUpdate" :placeholder="t('settings.announcementTitlePlaceholder')"
                        class="block w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 misub-radius-lg shadow-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors">
                </div>

                <!-- 类型 -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('settings.announcementType') }}</label>
                    <select v-model="announcement.type" @change="handleContentUpdate"
                        class="block w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 misub-radius-lg shadow-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors">
                        <option value="info">{{ t('settings.announcementInfo') }}</option>
                        <option value="success">{{ t('settings.announcementSuccess') }}</option>
                        <option value="warning">{{ t('settings.announcementWarning') }}</option>
                        <option value="error">{{ t('settings.announcementError') }}</option>
                    </select>
                </div>
            </div>

            <!-- 内容 -->
            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('settings.announcementContent') }}</label>
                <div class="relative">
                    <textarea v-model="announcement.content" @input="handleContentUpdate" rows="6"
                        :placeholder="t('settings.announcementContentPlaceholder')"
                        class="block w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 misub-radius-lg shadow-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors font-mono"></textarea>
                    <div class="absolute bottom-2 right-2 text-xs text-gray-400">
                        {{ t('settings.announcementHtmlSupported') }}
                    </div>
                </div>
                <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {{ t('settings.announcementHtmlHint') }}
                </p>
            </div>

            <!-- 选项 -->
            <div class="flex items-center gap-4">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" v-model="announcement.dismissible" @change="handleContentUpdate"
                        class="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50">
                    <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('settings.announcementDismissible') }}</span>
                </label>
            </div>

            <!-- 预览区域 (可选) -->
            <div
                class="mt-4 p-4 border border-dashed border-gray-300 dark:border-gray-600 misub-radius-lg bg-gray-50 dark:bg-gray-900/30">
                <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{{ t('settings.announcementPreview') }}</h4>
                <div class="bg-white dark:bg-gray-800 misub-radius-md shadow-sm border p-4" :class="{
                    'border-blue-100 bg-blue-50/50 dark:border-blue-900/30 dark:bg-blue-900/10': announcement.type === 'info',
                    'border-green-100 bg-green-50/50 dark:border-green-900/30 dark:bg-green-900/10': announcement.type === 'success',
                    'border-yellow-100 bg-yellow-50/50 dark:border-yellow-900/30 dark:bg-yellow-900/10': announcement.type === 'warning',
                    'border-red-100 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10': announcement.type === 'error'
                }">
                    <div class="flex items-start gap-3">
                        <div class="flex-shrink-0 mt-0.5">
                            <span v-if="announcement.type === 'info'" class="text-blue-500">ℹ️</span>
                            <span v-if="announcement.type === 'success'" class="text-green-500">✅</span>
                            <span v-if="announcement.type === 'warning'" class="text-yellow-500">⚠️</span>
                            <span v-if="announcement.type === 'error'" class="text-red-500">⛔</span>
                        </div>
                        <div class="flex-1">
                            <h3 class="text-sm font-semibold text-gray-900 dark:text-white" v-if="announcement.title">
                                {{ announcement.title }}
                            </h3>
                            <div class="text-sm text-gray-600 dark:text-gray-300 mt-1 prose prose-sm dark:prose-invert max-w-none"
                                v-html="sanitizedContent"></div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>
</template>

<style scoped>
/* Toggle Switch CSS - Reused */


.animate-fade-in-down {
    animation: fadeInDown 0.3s ease-out;
}

@keyframes fadeInDown {
    from {
        opacity: 0;
        transform: translateY(-5px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
