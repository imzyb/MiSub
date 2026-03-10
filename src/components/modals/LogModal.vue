

<script setup>
import { ref, computed, onMounted, watch } from 'vue'; // Added watch
import Modal from '../forms/Modal.vue';
import { useToastStore } from '../../stores/toast';
import { getClientInfo } from '../../lib/utils';
import { api } from '../../lib/http.js';

const props = defineProps({
  show: Boolean,
  filterProfileName: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:show']);

const { showToast } = useToastStore();
const logs = ref([]);
const isLoading = ref(false);
const expandedLogId = ref(null);

// Pagination State
const currentPage = ref(1);
const pageSize = 20;

// Pagination Computed Properties
// Pagination Computed Properties
const filteredLogs = computed(() => {
    if (!props.filterProfileName) return logs.value;
    return logs.value.filter(log => log.profileName === props.filterProfileName);
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredLogs.value.length / pageSize)));
const paginatedLogs = computed(() => {
    const start = (currentPage.value - 1) * pageSize;
    const end = start + pageSize;
    return filteredLogs.value.slice(start, end);
});

const fetchLogs = async () => {
    isLoading.value = true;
    try {
        // Cache busting with explicit timestamp
        const data = await api.get(`/api/logs?t=${Date.now()}`);
        logs.value = data.data || [];
        // Reset to first page on refresh
        currentPage.value = 1;
    } catch (e) {
        showToast('获取日志失败', 'error');
    } finally {
        isLoading.value = false;
    }
};

const clearLogs = async () => {
    if (!confirm('确定要清空所有日志吗？')) return;
    
    try {
        await api.del('/api/logs');
        logs.value = [];
        currentPage.value = 1;
        showToast('日志已清空', 'success');
    } catch (e) {
        showToast('清空日志失败', 'error');
    }
};

const formatTime = (ts) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('zh-CN', { hour12: false });
};

const toggleExpand = (id) => {
    expandedLogId.value = expandedLogId.value === id ? null : id;
};

// Pagination Controls
const nextPage = () => {
    if (currentPage.value < totalPages.value) {
        currentPage.value++;
    }
};

const prevPage = () => {
    if (currentPage.value > 1) {
        currentPage.value--;
    }
};

// Reset pagination when modal opens or closes? 
// Maybe just watch 'show'
watch(() => props.show, (newVal) => {
    if (newVal) {
        fetchLogs();
    }
});
</script>

<template>
    <Modal 
        :show="show" 
        @update:show="emit('update:show', $event)"
        size="4xl"
        :confirm-disabled="true" 
        class="log-modal"
    >
        <template #title>
             <div class="flex justify-between items-center w-full">
                <span class="text-lg font-bold text-gray-900 dark:text-white">订阅访问日志</span>
                 <div class="flex gap-2">
                    <button 
                    @click="fetchLogs" 
                    class="text-xs px-2 py-1 misub-radius-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-600 dark:text-gray-300">
                        刷新
                    </button>
                    <button 
                    @click="clearLogs" 
                    class="text-xs px-2 py-1 misub-radius-md bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors text-red-600 dark:text-red-400">
                        清空
                    </button>
                </div>
            </div>
        </template>

        <template #body>
             <div class="flex flex-col h-[60vh]">
                <div class="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-0">
                    <div v-if="isLoading" class="py-12 text-center text-gray-500">
                        <svg class="animate-spin h-8 w-8 mx-auto mb-2 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        加载中...
                    </div>
                    <div v-else-if="filteredLogs.length === 0" class="py-16 text-center">
                        <svg class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            {{ filterProfileName ? '该订阅暂无日志记录' : '暂无日志记录' }}
                        </p>
                    </div>
                    <ul v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <li v-for="log in paginatedLogs" :key="log.id || log.timestamp" class="bg-gray-50 dark:bg-gray-700/30 misub-radius-md p-2.5 text-xs border border-gray-100 dark:border-gray-700 relative overflow-hidden group hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors cursor-pointer" @click="toggleExpand(log.id)">
                            <!-- Status Indicator Stripe -->
                            <div class="absolute left-0 top-0 bottom-0 w-1" :class="{
                                'bg-green-500': log.status === 'success',
                                'bg-yellow-500': log.status === 'partial',
                                'bg-red-500': log.status === 'error'
                            }"></div>

                            <div class="pl-2">
                                <div class="flex justify-between items-start mb-1.5 gap-2">
                                    <span class="font-bold text-gray-900 dark:text-gray-100 truncate text-sm">
                                        {{ log.profileName || 'Unknown Profile' }}
                                    </span>
                                    <span :class="getClientInfo(log.userAgent).className" class="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap">
                                        {{ getClientInfo(log.userAgent).name }}
                                    </span>
                                </div>
                                
                                <div class="flex flex-col gap-0.5 text-xs text-gray-600 dark:text-gray-300">
                                    <!-- Compact Info Rows -->
                                    <div class="flex justify-between items-center">
                                         <div class="flex items-center gap-1.5 opacity-80">
                                            <span class="text-[10px] px-1 py-px rounded bg-gray-100 dark:bg-gray-700 text-gray-500 min-w-[24px] text-center">时间</span>
                                            <span class="font-mono text-[10px]">{{ formatTime(log.timestamp) }}</span>
                                         </div>
                                    </div>
                                    <div class="flex items-center gap-1.5 opacity-80">
                                        <span class="text-[10px] px-1 py-px rounded bg-gray-100 dark:bg-gray-700 text-gray-500 min-w-[24px] text-center">位置</span>
                                        <span class="truncate">
                                           {{ log.geoInfo?.country || 'Unknown' }} 
                                           <span v-if="log.geoInfo?.city" class="text-gray-500 dark:text-gray-400 text-[10px]"> / {{ log.geoInfo.city }}</span>
                                        </span>
                                    </div>
                                    <div class="flex items-center gap-1.5 opacity-80">
                                         <span class="text-[10px] px-1 py-px rounded bg-gray-100 dark:bg-gray-700 text-gray-500 min-w-[24px] text-center">IP</span>
                                         <span class="font-mono text-[10px]">{{ log.clientIp }}</span>
                                    </div>
                                </div>

                                <!-- Expandable Details -->
                                <div v-show="expandedLogId === log.id" class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600/50 text-xs space-y-1.5 animate-fadeIn">
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div class="flex">
                                            <span class="text-gray-400 w-16 shrink-0">ISP:</span>
                                            <span class="text-gray-700 dark:text-gray-300 truncate">{{ log.geoInfo?.isp || '-' }} ({{ log.geoInfo?.asn ? 'AS' + log.geoInfo.asn : '-' }})</span>
                                        </div>
                                        <div class="flex">
                                            <span class="text-gray-400 w-16 shrink-0">耗时:</span>
                                            <span class="text-gray-700 dark:text-gray-300">{{ log.details?.duration || 0 }} ms</span>
                                        </div>
                                        <div class="flex col-span-1 sm:col-span-2">
                                            <span class="text-gray-400 w-16 shrink-0">节点数:</span>
                                            <span class="text-gray-700 dark:text-gray-300 truncate">
                                                总计 {{ log.details?.totalNodes || 0 }} (源: {{ log.details?.sourceCount || 0 }}, 成功: {{ log.details?.successCount || 0 }})
                                            </span>
                                        </div>
                                        <div class="flex col-span-1 sm:col-span-2">
                                            <span class="text-gray-400 w-16 shrink-0">UA:</span>
                                            <span class="text-gray-700 dark:text-gray-300 truncate" :title="log.userAgent">{{ log.userAgent }}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div v-show="expandedLogId !== log.id" class="mt-2 text-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mx-auto text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </li>
                    </ul>
                </div>
                
                <!-- Pagination Footer -->
                <div v-if="filteredLogs.length > 0" class="pt-4 mt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center shrink-0">
                    <span class="text-sm text-gray-500 dark:text-gray-400">
                        第 {{ currentPage }} 页 / 共 {{ totalPages }} 页 ({{ filteredLogs.length }} 条)
                    </span>
                    <div class="flex gap-2">
                        <button 
                            @click="prevPage" 
                            :disabled="currentPage === 1"
                            class="px-3 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            上一页
                        </button>
                        <button 
                            @click="nextPage" 
                            :disabled="currentPage === totalPages"
                            class="px-3 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            下一页
                        </button>
                    </div>
                </div>
             </div>
        </template>
    </Modal>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(156, 163, 175, 0.5);
    border-radius: 20px;
}
.animate-fadeIn {
    animation: fadeIn 0.2s ease-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Override Modal Button styles via deep selector or global styles if needed, 
   but since we can't easily change the footer buttons in the shared Modal without props, 
   we'll just let the "Confirm" button exist (maybe as a secondary "Refresh" if we link it? 
   No, it closes the modal in the shared component). 
   Let's just leave it and maybe use CSS to hide the footer if super picky, 
   but "Cancel" / "Confirm" is okay for a modal even if viewing logs. 
   Actually, "Confirm" is confusing for a read-only modal.
   We can hide the footer using deep CSS selector since Modal.vue doesn't have a footer slot.
*/
:deep(.modal-footer) {
    display: none;
}
/* The Modal.vue classes: 
   .p-6.pt-4.flex.justify-end.space-x-3.shrink-0.border-t.border-gray-200
   It doesn't have a specific class name. We might target it by structure or just accept it.
   Wait, if I can't pass a slot for footer, I'm stuck with "Cancel" and "Confirm". 
   Let's see if I can modify Modal.vue to optionally hide footer or use a slot.
   But I should avoid modifying shared components if possible.
   However, for this strict requirement avoiding new deps, a small tweak to shared Modal is better than broken build.
*/
</style>
