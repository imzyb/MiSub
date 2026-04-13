<script setup>
import { ref, computed } from 'vue';
import Modal from '../forms/Modal.vue';
import { migrateToD1 } from '../../lib/api.js';
import { useToastStore } from '../../stores/toast.js';

const props = defineProps({
  show: Boolean,
});

const emit = defineEmits(['update:show', 'success']);
const { showToast } = useToastStore();

const isMigrating = ref(false);
const logs = ref([]);
const step = ref('check'); // check, migrating, done, error

const addLog = (message, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    logs.value.unshift({ time, message, type });
};

const handleMigrate = async () => {
    step.value = 'migrating';
    isMigrating.value = true;
    logs.value = [];
    
    addLog('开始迁移流程...');
    addLog('正在连接后端接口...');

    try {
        const result = await migrateToD1();

        if (result.success) {
            addLog('连接成功，收到后端响应。', 'success');
            
            if (result.details) {
                if (result.details.subscriptions) addLog('✅ 订阅数据迁移成功', 'success');
                else addLog('⚠️ 无订阅数据或迁移跳过', 'warning');
                
                if (result.details.profiles) addLog('✅ 配置文件迁移成功', 'success');
                else addLog('⚠️ 无配置文件或迁移跳过', 'warning');
                
                if (result.details.settings) addLog('✅ 系统设置迁移成功', 'success');
                else addLog('⚠️ 无系统设置或迁移跳过', 'warning');
            }

            addLog('🎉 所有步骤完成！正在切换存储模式...', 'success');
            step.value = 'done';
            emit('success');
        } else {
            addLog(`❌ 迁移失败: ${result.message}`, 'error');
            if (result.details && Array.isArray(result.details)) {
                result.details.forEach(err => addLog(`   - 错误详情: ${err}`, 'error'));
            }
            throw new Error(result.message || '迁移失败');
        }
    } catch (err) {
        step.value = 'error';
        addLog(`❌ 发生异常: ${err.message}`, 'error');
        addLog('请检查 D1 数据库是否已初始化，表结构是否完整。', 'warning');
        addLog('若未执行 SQL 脚本，先点击“复制 SQL 脚本内容”并在 D1 Console 执行。', 'warning');
        addLog('提示：若仍失败，请确认 MISUB_DB 绑定与 D1 表创建权限。', 'warning');
        showToast(`迁移失败: ${err.message}`, 'error');
    } finally {
        isMigrating.value = false;
        addLog('流程结束。', 'info');
    }
};

const handleClose = () => {
    emit('update:show', false);
    // Reset state after close
    setTimeout(() => {
        step.value = 'check';
        logs.value = [];
        isMigrating.value = false;
    }, 300);
};

const confirmText = computed(() => {
    if (step.value === 'check') return '开始迁移';
    if (step.value === 'migrating') return '迁移中...';
    return '完成';
});

const handleConfirm = () => {
    if (step.value === 'check') {
        handleMigrate();
    } else if (step.value === 'done' || step.value === 'error') {
        handleClose();
    }
};

const getLogClass = (type) => {
    switch (type) {
        case 'success': return 'text-green-400';
        case 'error': return 'text-red-400';
        case 'warning': return 'text-yellow-400';
        default: return 'text-gray-300';
    }
};

const SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_updated_at ON subscriptions(updated_at);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);
CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at);`;

const copySchema = async () => {
    try {
        await navigator.clipboard.writeText(SCHEMA_SQL);
        showToast('SQL 脚本已复制到剪贴板', 'success');
    } catch (err) {
        showToast('复制失败，请手动复制文件内容', 'error');
    }
};
</script>

<template>
  <Modal 
    :show="show" 
    @update:show="handleClose" 
    @confirm="handleConfirm"
    size="2xl"
    :confirm-disabled="isMigrating"
    :confirm-text="confirmText"
    cancel-text="关闭"
  >
    <template #title>
        <div class="flex items-center gap-2">
            <span class="text-lg font-bold text-gray-900 dark:text-white">D1 数据库迁移</span>
            <span v-if="step === 'migrating'" class="flex h-3 w-3 relative">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
            </span>
        </div>
    </template>
    
    <template #body>
       <div class="h-[400px] flex flex-col">
           <!-- Step 1: Checklist -->
           <div v-if="step === 'check'" class="flex-1 space-y-4">
               <div class="bg-blue-50 dark:bg-blue-900/20 p-4 misub-radius-md border border-blue-100 dark:border-blue-800">
                   <h4 class="font-medium text-blue-800 dark:text-blue-300 mb-2">准备工作检查</h4>
                   <p class="text-sm text-blue-600 dark:text-blue-400 mb-4 leading-relaxed">
                        即将把所有 KV 存储的数据迁移到 D1 数据库。此操作不可逆，迁移成功后系统将自动切换到 D1 模式。<br/>
                        请务必确认您已完成以下操作：
                   </p>
                   <ul class="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                       <li class="flex items-start gap-2">
                           <input type="checkbox" checked disabled class="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300">
                           <span>在 Cloudflare 后台创建 D1 数据库</span>
                       </li>
                       <li class="flex items-start gap-2">
                           <input type="checkbox" checked disabled class="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300">
                           <span>在 Pages 设置中绑定 D1 数据库变量为 <code>MISUB_DB</code></span>
                       </li>
                       <li class="flex items-start gap-2">
                           <input type="checkbox" class="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500">
                           <div class="flex flex-col gap-1">
                                 <span class="font-medium text-orange-600 dark:text-orange-400">重要：已在 D1 Console 中执行 SQL 建表脚本</span>
                               <button @click="copySchema" class="text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline underline-offset-2 transition-colors w-fit">
                                   <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                                   复制 SQL 脚本内容
                               </button>
                           </div>
                       </li>
                   </ul>
               </div>
               
               <div class="text-xs text-gray-500 text-center">
                   点击“开始迁移”即表示您已确认上述配置无误。
               </div>
           </div>

           <!-- Step 2 & 3: Logs -->
           <div v-else class="flex-1 flex flex-col min-h-0">
               <div class="bg-gray-900 misub-radius-md p-4 font-mono text-xs overflow-y-auto flex-1 custom-scrollbar shadow-inner border border-gray-700">
                   <div v-if="logs.length === 0" class="text-gray-500 text-center mt-10">等待开始...</div>
                   <div v-for="(log, idx) in logs" :key="idx" class="mb-1.5 break-all">
                       <span class="opacity-50 text-gray-500 mr-2">[{{ log.time }}]</span>
                       <span :class="getLogClass(log.type)">{{ log.message }}</span>
                   </div>
               </div>
               
               <div v-if="step === 'done'" class="mt-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded border border-green-200 dark:border-green-800 text-sm flex items-center gap-2">
                   <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                   <span>迁移成功！点击“完成”关闭窗口并刷新页面。</span>
               </div>
               
               <div v-if="step === 'error'" class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-800 text-sm flex items-center gap-2">
                   <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                   <span>迁移遇到错误，请检查日志并修复问题后重试。</span>
               </div>
           </div>
       </div>
    </template>
  </Modal>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: #1f2937;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: #4b5563;
    border-radius: 3px;
}
</style>
