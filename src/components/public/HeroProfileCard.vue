<script setup>
import QRCodeOverlay from './QRCodeOverlay.vue';
import BaseIcon from '../ui/BaseIcon.vue';

const props = defineProps({
    profile: {
        type: Object,
        required: true
    },
    isQrExpanded: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits([
    'quick-import',
    'preview',
    'copy-link',
    'toggle-qr',
    'download-qr',
    'register-canvas'
]);

const ICONS = {
    import: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
    preview: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
    link: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
    qr: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z'
};
</script>

<template>
    <div class="relative w-full">

        
        <!-- Main Card Content -->
        <div
            class="relative glass-panel dark:bg-white/5 backdrop-blur-2xl rounded-[2rem] p-8 lg:p-10 shadow-xl border border-white/40 dark:border-white/5">
            
            <div class="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
                
                <!-- 1. Brand / Header Column -->
                <div class="flex-shrink-0 flex flex-col items-center lg:items-start text-center lg:text-left space-y-4">
                    <div class="inline-flex items-center gap-2 rounded-full bg-primary-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-700 dark:bg-primary-500/20 dark:text-primary-300">
                        <span>精选推荐</span>
                    </div>
                    
                    <div class="flex items-center gap-4">
                        <div class="h-16 w-16 misub-radius-lg bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-lg shadow-primary-500/20 text-3xl">
                             🚀
                        </div>
                        <div>
                             <h3 class="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white leading-tight">
                                {{ profile.name }}
                            </h3>
                        </div>
                    </div>
                </div>

                <!-- 2. Description Column (Middle) -->
                <div class="flex-1 border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-white/5 pt-6 lg:pt-0 lg:pl-12 w-full lg:w-auto text-center lg:text-left">
                    <p class="text-gray-600 dark:text-gray-400 text-base leading-relaxed max-w-2xl mx-auto lg:mx-0">
                        {{ profile.description || '该订阅组由管理员维护，可用于快速预览节点并一键导入到客户端。' }}
                    </p>
                </div>

                <!-- 3. Action Column (Right) -->
                <div class="flex-shrink-0 w-full lg:w-auto flex flex-col gap-3 min-w-[200px]">
                    <button @click="emit('quick-import', profile)"
                        class="group flex w-full items-center justify-center rounded-lg bg-primary-600 px-6 py-3.5 font-semibold text-white transition-colors hover:bg-primary-700">
                        <BaseIcon :path="ICONS.import" className="mr-2 w-5 h-5" />
                        一键导入
                    </button>
                    
                    <div class="grid grid-cols-2 gap-3">
                        <button @click="emit('preview', profile)"
                            class="flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10">
                            <BaseIcon :path="ICONS.preview" className="w-4 h-4 mr-1" />
                            预览
                        </button>
                         <button @click="emit('copy-link', profile)"
                            class="flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10">
                            <BaseIcon :path="ICONS.link" className="w-4 h-4 mr-1" />
                            复制
                        </button>
                    </div>

                    <button @click="emit('toggle-qr', profile)" class="mt-1 flex items-center justify-center gap-2 cursor-pointer text-xs text-gray-400 hover:text-primary-500 transition-colors w-full bg-transparent border-0">
                        <BaseIcon :path="ICONS.qr" className="w-4 h-4" />
                        <span>{{ isQrExpanded ? '隐藏二维码' : '显示二维码' }}</span>
                    </button>
                </div>

            </div>

            <QRCodeOverlay
                :profile="profile"
                :is-expanded="isQrExpanded"
                @close="emit('toggle-qr', profile)"
                @download="emit('download-qr', profile)"
                @register-canvas="(id, el) => emit('register-canvas', id, el)"
            />
        </div>
    </div>
</template>
