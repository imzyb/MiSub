<script setup>
import { ref, computed, watch } from 'vue';
import DOMPurify from 'dompurify';

const props = defineProps({
    announcement: {
        type: Object,
        required: true
    }
});

const isVisible = ref(true);

const allowedContentTags = ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'li', 'code', 'pre'];
const allowedContentAttrs = ['href', 'target', 'rel', 'class'];

const sanitizedContent = computed(() => {
    const rawContent = props.announcement?.content?.trim()
        ? props.announcement.content
        : '暂无详细内容';
    return DOMPurify.sanitize(rawContent, {
        ALLOWED_TAGS: allowedContentTags,
        ALLOWED_ATTR: allowedContentAttrs
    });
});

const dismiss = (e) => {
    e.stopPropagation(); 
    isVisible.value = false;
    try {
        if (props.announcement.updatedAt) {
            localStorage.setItem(`announcement_dismissed_${props.announcement.updatedAt}`, 'true');
        }
    } catch (e) {
        console.warn('LocalStorage access failed', e);
    }
};

const checkVisibility = () => {
    if (props.announcement?.dismissible && props.announcement?.updatedAt) {
        const dismissed = localStorage.getItem(`announcement_dismissed_${props.announcement.updatedAt}`);
        if (dismissed) {
            isVisible.value = false;
        } else {
            isVisible.value = true;
        }
    } else {
        isVisible.value = true;
    }
};

checkVisibility();

watch(() => props.announcement, () => {
    checkVisibility();
}, { deep: true });

const typeConfig = computed(() => {
    const types = {
        info: {
            bg: 'bg-indigo-50/50 dark:bg-indigo-900/10',
            border: 'border-indigo-100 dark:border-indigo-800/30',
            text: 'text-indigo-700 dark:text-indigo-300',
            iconBg: 'bg-indigo-500',
            glow: 'rgba(99, 102, 241, 0.15)'
        },
        success: {
            bg: 'bg-emerald-50/50 dark:bg-emerald-900/10',
            border: 'border-emerald-100 dark:border-emerald-800/30',
            text: 'text-emerald-700 dark:text-emerald-300',
            iconBg: 'bg-emerald-500',
            glow: 'rgba(16, 185, 129, 0.15)'
        },
        warning: {
            bg: 'bg-amber-50/50 dark:bg-amber-900/10',
            border: 'border-amber-100 dark:border-amber-800/30',
            text: 'text-amber-700 dark:text-amber-300',
            iconBg: 'bg-amber-500',
            glow: 'rgba(245, 158, 11, 0.15)'
        },
        error: {
            bg: 'bg-rose-50/50 dark:bg-rose-900/10',
            border: 'border-rose-100 dark:border-rose-800/30',
            text: 'text-rose-700 dark:text-rose-300',
            iconBg: 'bg-rose-500',
            glow: 'rgba(244, 63, 94, 0.15)'
        }
    };
    return types[props.announcement.type] || types.info;
});

</script>

<template>
    <Transition name="fade-slide">
        <div v-if="isVisible" 
             class="announcement-glass group relative overflow-hidden transition-all duration-500 misub-radius-lg border backdrop-blur-xl shadow-lg"
             :class="[typeConfig.bg, typeConfig.border]">
            
            <!-- Subtle Background Glow -->
            <div class="absolute -right-20 -top-20 w-64 h-64 blur-[80px] rounded-full opacity-20 pointer-events-none transition-transform duration-1000 group-hover:scale-125"
                 :style="{ background: typeConfig.glow }"></div>

            <div class="relative p-5 sm:p-6 z-10 flex flex-col sm:flex-row gap-5">
                <!-- Icon Area -->
                <div class="shrink-0">
                    <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
                         :class="typeConfig.iconBg">
                        <svg v-if="announcement.type === 'success'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                        <svg v-else-if="announcement.type === 'warning'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <svg v-else-if="announcement.type === 'error'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <svg v-else class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                </div>

                <!-- Content Area -->
                <div class="flex-1 space-y-1.5 min-w-0">
                    <div class="flex items-center justify-between gap-4">
                        <h3 class="text-lg font-bold truncate transition-colors duration-300"
                            :class="[typeConfig.text]">
                            {{ announcement.title || '系统公告' }}
                        </h3>
                        <button v-if="announcement.dismissible" 
                                @click="dismiss"
                                class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                                title="不再显示">
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    
                    <div class="prose prose-sm max-w-none text-gray-600 dark:text-gray-300 leading-relaxed dark:prose-invert transition-colors duration-300"
                        v-html="sanitizedContent">
                    </div>

                    <div v-if="announcement.updatedAt" class="pt-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <span class="w-1 h-1 rounded-full bg-current opacity-40"></span>
                        最后更新于 {{ new Date(announcement.updatedAt).toLocaleString() }}
                    </div>
                </div>
            </div>
        </div>
    </Transition>
</template>

<style scoped>
.announcement-glass {
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
}

.announcement-glass:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 30px -10px rgba(0, 0, 0, 0.15);
}

.fade-slide-enter-active,
.fade-slide-leave-active {
    transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
    filter: blur(10px);
}

:deep(.prose) {
    --tw-prose-body: currentColor;
}

:deep(.prose a) {
    color: var(--primary-600, #4f46e5);
    text-decoration: underline;
    text-underline-offset: 2px;
    font-weight: 600;
}

:deep(.prose code) {
    background: rgba(0, 0, 0, 0.05);
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 0.9em;
}

.dark :deep(.prose code) {
    background: rgba(255, 255, 255, 0.1);
}
</style>
