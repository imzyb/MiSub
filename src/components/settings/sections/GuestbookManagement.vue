<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useToastStore } from '../../../stores/toast.js';
import { api } from '../../../lib/http.js';
import Switch from '../../ui/Switch.vue';

const props = defineProps({
    settings: {
        type: Object,
        required: true
    }
});

const { showToast } = useToastStore();

const messages = ref([]);
const loading = ref(false);
const filterStatus = ref('all'); // all, pending, approved, replied
const replyingId = ref(null);
const replyContent = ref('');

const defaultGuestbookConfig = {
    enabled: false,
    allowAnonymous: true
};

const ensureGuestbookConfig = () => {
    if (!props.settings.guestbook) {
        props.settings.guestbook = { ...defaultGuestbookConfig };
    }
};

ensureGuestbookConfig();

watch(() => props.settings.guestbook, (val) => {
    if (!val) ensureGuestbookConfig();
});

// 确保 guestbook settings 存在
const guestbookConfig = computed(() => props.settings.guestbook || defaultGuestbookConfig);

const fetchMessages = async () => {
    loading.value = true;
    try {
        const data = await api.get('/api/guestbook/manage');
        if (data.success) {
            messages.value = data.data;
        } else {
            showToast(data.message || '获取留言失败', 'error');
        }
    } catch (e) {
        showToast('网络错误', 'error');
        console.error(e);
    } finally {
        loading.value = false;
    }
};

const filteredMessages = computed(() => {
    if (filterStatus.value === 'all') return messages.value;
    return messages.value.filter(m => {
        if (filterStatus.value === 'pending') return m.status === 'pending';
        if (filterStatus.value === 'approved') return m.status === 'approved';
        if (filterStatus.value === 'replied') return m.status === 'replied';
        return true;
    });
});

const handleAction = async (action, id, payload = {}) => {
    try {
        const data = await api.post('/api/guestbook/manage', { action, id, ...payload });

        if (data.success) {
            showToast('操作成功', 'success');
            // Update local state
            if (action === 'delete') {
                messages.value = messages.value.filter(m => m.id !== id);
            } else {
                const index = messages.value.findIndex(m => m.id === id);
                if (index !== -1) {
                    messages.value[index] = data.data;
                }
            }
            // Clear reply state if replying
            if (action === 'reply') {
                replyingId.value = null;
                replyContent.value = '';
            }
        } else {
            showToast(data.message || '操作失败', 'error');
        }
    } catch (e) {
        showToast('网络错误', 'error');
        console.error(e);
    }
};

const startReply = (msg) => {
    replyingId.value = msg.id;
    replyContent.value = msg.reply || '';
};

const cancelReply = () => {
    replyingId.value = null;
    replyContent.value = '';
};

const submitReply = (id) => {
    if (!replyContent.value.trim()) return;
    handleAction('reply', id, { replyContent: replyContent.value });
};

const formatDate = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleString();
};

const getStatusBadgeClass = (status) => {
    switch (status) {
        case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
        case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
        case 'replied': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
        default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
};

const getStatusLabel = (status) => {
    switch (status) {
        case 'pending': return '待审核';
        case 'approved': return '已通过';
        case 'replied': return '已回复';
        default: return status;
    }
};

const getTypeLabel = (type) => {
    switch (type) {
        case 'bug': return '🐛 Bug反馈';
        case 'feature': return '✨ 功能建议';
        default: return '💬 普通留言';
    }
};

onMounted(() => {
    fetchMessages();
});
</script>

<template>
    <div class="space-y-6">
        <!-- 头部说明 -->
        <div
            class="bg-white/90 dark:bg-gray-900/70 misub-radius-lg p-6 space-y-5 border border-gray-100/80 dark:border-white/10 shadow-sm overflow-hidden">
            <h3 class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                留言管理
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                    class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 misub-radius-lg">
                    <div>
                        <p class="text-sm font-medium text-gray-900 dark:text-gray-200">启用留言板</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">允许用户在公开页提交反馈和建议</p>
                    </div>
                    <Switch 
                        v-model="guestbookConfig.enabled"
                    />
                </div>


            </div>
        </div>

        <!-- 留言管理区域 -->
        <div v-if="guestbookConfig.enabled"
            class="bg-white dark:bg-gray-800 misub-radius-lg border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <!-- Toolbar -->
            <div
                class="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex items-center gap-2">
                    <h3 class="text-base font-semibold text-gray-900 dark:text-white">留言列表</h3>
                    <span
                        class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">{{
                            messages.length }}</span>
                </div>

                <div class="flex items-center gap-2">
                    <select v-model="filterStatus"
                        class="block w-full sm:w-auto pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm misub-radius-md bg-white dark:bg-gray-700 dark:text-white">
                        <option value="all">全部状态</option>
                        <option value="pending">待审核</option>
                        <option value="approved">已通过</option>
                        <option value="replied">已回复</option>
                    </select>
                    <button @click="fetchMessages"
                        class="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M4 4v5h.058M20.9 14.25A10.053 10.053 0 0021.1 12c0-5.523-4.477-10-10-10S1.1 6.477 1.1 12c0 4.456 2.934 8.216 7 9.542V21h3" />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- List -->
            <div class="divide-y divide-gray-100 dark:divide-gray-700">
                <div v-if="loading" class="p-8 text-center text-gray-500">加载中...</div>
                <div v-else-if="filteredMessages.length === 0" class="p-8 text-center text-gray-500">
                    暂无相关留言
                </div>

                <div v-for="msg in filteredMessages" :key="msg.id"
                    class="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <div class="flex items-start justify-between mb-2">
                        <div class="flex items-center gap-3">
                            <span class="font-medium text-gray-900 dark:text-white">{{ msg.nickname || '匿名' }}</span>
                            <span class="text-xs px-2 py-0.5 rounded border"
                                :class="msg.type === 'bug' ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-800' :
                                    (msg.type === 'feature' ? 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800' :
                                        'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-700/50 dark:border-gray-600')">
                                {{ getTypeLabel(msg.type) }}
                            </span>
                            <span :class="['text-xs px-2 py-0.5 rounded', getStatusBadgeClass(msg.status)]">
                                {{ getStatusLabel(msg.status) }}
                            </span>
                        </div>
                        <span class="text-xs text-gray-500">{{ formatDate(msg.createdAt) }}</span>
                    </div>

                    <div class="mb-4 text-sm text-gray-700 dark:text-gray-300 break-words">{{ msg.content }}</div>

                    <!-- Reply Display -->
                    <div v-if="msg.reply && replyingId !== msg.id"
                        class="mb-4 ml-4 bg-gray-50 dark:bg-gray-900/50 p-3 misub-radius-lg border-l-4 border-indigo-500">
                        <div class="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-1 flex justify-between">
                            <span>管理员回复</span>
                            <span class="text-gray-400 font-normal">{{ formatDate(msg.replyAt) }}</span>
                        </div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">{{ msg.reply }}</div>
                    </div>

                    <!-- Reply Input -->
                    <div v-if="replyingId === msg.id" class="mb-4 ml-4">
                        <textarea v-model="replyContent" rows="3"
                            class="block w-full misub-radius-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white dark:bg-gray-700 dark:text-white sm:text-sm"
                            placeholder="请输入回复内容..."></textarea>
                        <div class="mt-2 flex justify-end gap-2">
                            <button @click="cancelReply"
                                class="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 misub-radius-md">取消</button>
                            <button @click="submitReply(msg.id)"
                                class="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm">发送回复</button>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center gap-4 text-sm">
                        <button v-if="!msg.isVisible" @click="handleAction('toggle', msg.id)"
                            class="text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            通过审核/显示
                        </button>
                        <button v-else @click="handleAction('toggle', msg.id)"
                            class="text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                            隐藏
                        </button>

                        <button @click="startReply(msg)"
                            class="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                            回复
                        </button>

                        <button @click="handleAction('delete', msg.id)"
                            class="text-red-600 hover:text-red-700 font-medium flex items-center gap-1 ml-auto">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            删除
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>

</style>
