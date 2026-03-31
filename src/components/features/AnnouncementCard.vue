<script setup>
import { ref, onMounted, computed } from 'vue';
import DOMPurify from 'dompurify';

const props = defineProps({
    announcement: {
        type: Object,
        required: true
    }
});

const isVisible = ref(true);
const isExpanded = ref(false); // 默认折叠

const allowedContentTags = ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'li'];
const allowedContentAttrs = ['href', 'target', 'rel'];

const sanitizedContent = computed(() => {
    const rawContent = props.announcement?.content?.trim()
        ? props.announcement.content
        : '暂无详细内容';
    return DOMPurify.sanitize(rawContent, {
        ALLOWED_TAGS: allowedContentTags,
        ALLOWED_ATTR: allowedContentAttrs
    });
});

const toggleExpand = () => {
    isExpanded.value = !isExpanded.value;
};

const dismiss = (e) => {
    e.stopPropagation(); // 防止触发展开
    isVisible.value = false;
    try {
        if (props.announcement.updatedAt) {
            localStorage.setItem(`announcement_dismissed_${props.announcement.updatedAt}`, 'true');
        }
    } catch (e) {
        console.warn('LocalStorage access failed', e);
    }
};

onMounted(() => {
    if (props.announcement.dismissible && props.announcement.updatedAt) {
        const dismissed = localStorage.getItem(`announcement_dismissed_${props.announcement.updatedAt}`);
        if (dismissed) {
            isVisible.value = false;
        }
    }
});
</script>

<template>
    <Transition name="fade">
        <div v-if="isVisible" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
            <div @click="toggleExpand"
                class="relative misub-radius-lg p-4 shadow-sm border transition-all duration-300 cursor-pointer hover:shadow-md group"
                :class="{
                    'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800': announcement.type === 'info',
                    'bg-green-50 border-green-100 dark:bg-green-900/20 dark:border-green-800': announcement.type === 'success',
                    'bg-yellow-50 border-yellow-100 dark:bg-yellow-900/20 dark:border-yellow-800': announcement.type === 'warning',
                    'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800': announcement.type === 'error'
                }">

                <div class="flex items-center gap-4">
                    <!-- Icon -->
                    <div class="flex-shrink-0">
                        <div class="w-8 h-8 misub-radius-md flex items-center justify-center text-lg shadow-sm" :class="{
                            'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300': announcement.type === 'info',
                            'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300': announcement.type === 'success',
                            'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-300': announcement.type === 'warning',
                            'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300': announcement.type === 'error'
                        }">
                            <span v-if="announcement.type === 'info'">ℹ️</span>
                            <span v-if="announcement.type === 'success'">✅</span>
                            <span v-if="announcement.type === 'warning'">⚠️</span>
                            <span v-if="announcement.type === 'error'">⛔</span>
                        </div>
                    </div>

                    <!-- Header / Summary -->
                    <div class="flex-1 min-w-0 flex items-center justify-between">
                        <h3 class="text-base font-semibold text-gray-900 dark:text-white truncate pr-4">
                            {{ announcement.title || '系统公告' }}
                        </h3>

                        <!-- Actions -->
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline-block"
                                v-if="!isExpanded">
                                点击展开
                            </span>
                            <!-- Expand Icon -->
                            <svg class="w-5 h-5 text-gray-400 transition-transform duration-300 transform"
                                :class="{ 'rotate-180': isExpanded }" fill="none" viewBox="0 0 24 24"
                                stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>

                    <!-- Close Button (Always visible if dismissible) -->
                    <button v-if="announcement.dismissible" @click="dismiss"
                        class="flex-shrink-0 p-1.5 -mr-1 misub-radius-md text-gray-400 hover:text-gray-500 hover:bg-black/5 dark:hover:bg-white/10 transition-colors z-10"
                        title="关闭公告">
                        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <!-- Expandable Content -->
                <div v-show="isExpanded" class="mt-4 pt-4 border-t border-black/5 dark:border-white/5 animate-fade-in">
                    <div class="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 break-words"
                        v-html="sanitizedContent">
                    </div>
                    <div v-if="announcement.updatedAt"
                        class="mt-4 text-xs text-gray-400 dark:text-gray-500 flex justify-end">
                        发布时间: {{ new Date(announcement.updatedAt).toLocaleString() }}
                    </div>
                </div>
            </div>
        </div>
    </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
    transform: translateY(-10px);
}

.animate-fade-in {
    animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
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
