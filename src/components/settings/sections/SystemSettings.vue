<script setup>
defineProps({
    settings: {
        type: Object,
        required: true
    },
    exportBackup: Function,
    importBackup: Function
});

import { useToastStore } from '../../../stores/toast.js';
import Input from '../../ui/Input.vue';
import { ref } from 'vue';

const { showToast } = useToastStore();

const passwordForm = ref({
  newPassword: '',
  confirmPassword: ''
});
const isUpdatingPassword = ref(false);

const handleUpdatePassword = async () => {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    showToast('两次输入的密码不一致', 'error');
    return;
  }
  if (passwordForm.value.newPassword.length < 6) {
    showToast('密码长度至少需要6位', 'error');
    return;
  }

  isUpdatingPassword.value = true;
  try {
    const res = await fetch('/api/settings/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordForm.value.newPassword })
    });
    const data = await res.json();
    if (data.success) {
      showToast('密码更新成功', 'success');
      passwordForm.value.newPassword = '';
      passwordForm.value.confirmPassword = '';
    } else {
      showToast(data.error || '更新失败', 'error');
    }
  } catch (e) {
    showToast('请求失败: ' + e.message, 'error');
  } finally {
    isUpdatingPassword.value = false;
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

const emit = defineEmits(['migrate']);
</script>

<template>
    <div class="space-y-8">
        <!-- 数据存储类型卡片 -->
        <div class="rounded-xl border border-gray-100/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-gray-900/70">
            <div class="mb-5 flex items-start gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-300">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
                </div>
                <div class="space-y-1">
                    <h3 class="text-base font-semibold text-gray-900 dark:text-white">数据存储类型</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">统一管理当前数据存储方式，并在需要时迁移到 D1 数据库。</p>
                </div>
            </div>
            <div class="space-y-3">
                <div class="flex items-center">
                    <input type="radio" value="kv" v-model="settings.storageType"
                        class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 dark:bg-gray-800">
                    <span class="ml-3 text-sm dark:text-gray-300">KV 存储</span>
                </div>
                <div class="flex items-center">
                    <input type="radio" value="d1" v-model="settings.storageType"
                        class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 dark:bg-gray-800">
                    <span class="ml-3 text-sm dark:text-gray-300">D1 数据库 (推荐)</span>
                </div>

                <!-- D1 Migration Section -->
                <div v-if="settings.storageType === 'kv'"
                    class="mt-4 p-4 bg-blue-50/80 dark:bg-blue-900/20 misub-radius-lg border border-blue-100/80 dark:border-blue-800/60">
                    <h4 class="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">迁移到 D1 数据库</h4>
                    <p class="text-xs text-blue-600 dark:text-blue-400 mb-3">
                        D1 数据库提供更好的性能和无限的写入能力。迁移前请确保已完成以下步骤:
                    </p>
                    <ol class="list-decimal list-inside text-xs text-blue-600 dark:text-blue-400 mb-3 space-y-1">
                        <li>在 Cloudflare 后台创建 D1 数据库，并在 Pages 设置中绑定为 <code>MISUB_DB</code></li>
                        <li>在 D1 控制台的 "Console" 标签页中粘贴并执行 <code>schema.sql</code> 的内容</li>
                        <li>确保表结构创建成功后，在此处点击迁移按钮</li>
                    </ol>
                    <div class="flex flex-col sm:flex-row gap-3">
                        <button @click="emit('migrate')"
                            class="px-4 py-2 text-sm font-medium text-white misub-radius-lg transition-colors duration-200 bg-blue-600 hover:bg-blue-700 flex items-center justify-center min-w-[120px] shadow-sm">
                            开始迁移...
                        </button>
                        <button @click="copySchema"
                            class="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-white/80 dark:bg-gray-900/60 border border-blue-200 dark:border-blue-700/70 misub-radius-lg hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors flex items-center justify-center gap-2 shadow-sm">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            复制建表 SQL
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 备份与恢复卡片 -->
        <div class="rounded-xl border border-gray-100/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-gray-900/70">
            <div class="mb-5 flex items-start gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                </div>
                <div class="space-y-1">
                    <h3 class="text-base font-semibold text-gray-900 dark:text-white">备份与恢复</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">在变更前导出当前数据，必要时再导入恢复，减少误操作风险。</p>
                </div>
            </div>
            <div class="flex gap-4">
                <button @click="exportBackup"
                    class="px-4 py-2 text-sm font-medium text-white misub-radius-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-green-600 hover:bg-green-700">导出备份</button>
                <button @click="importBackup"
                    class="px-4 py-2 text-sm font-medium text-white misub-radius-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-orange-500 hover:bg-orange-600">导入备份</button>
            </div>
        </div>

        <!-- 管理员安全设置 -->
        <div class="rounded-xl border border-gray-100/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-gray-900/70">
            <div class="mb-5 flex items-start gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-300">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                </div>
                <div class="space-y-1">
                    <h3 class="text-base font-semibold text-gray-900 dark:text-white">管理员安全设置</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">统一管理后台登录密码，建议定期更新并避免使用弱密码。</p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/70 dark:bg-gray-900/50 p-6 misub-radius-lg border border-gray-200/70 dark:border-white/10">
                <div class="space-y-4">
                <div>
                    <Input 
                    label="新密码"
                    v-model="passwordForm.newPassword"
                    type="password"
                    placeholder="请输入新密码"
                    class="misub-radius-lg"
                    />
                </div>
                <div>
                    <Input 
                    label="确认密码"
                    v-model="passwordForm.confirmPassword"
                    type="password"
                    placeholder="请再次输入新密码"
                    class="misub-radius-lg"
                    />
                </div>
                </div>
                <div class="flex items-end">
                <button 
                    @click="handleUpdatePassword"
                    :disabled="isUpdatingPassword || !passwordForm.newPassword"
                    class="px-6 py-2.5 misub-radius-lg text-white text-sm font-medium shadow-sm transition-all flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <svg v-if="isUpdatingPassword" class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{{ isUpdatingPassword ? '更新中...' : '修改管理员密码' }}</span>
                </button>
                </div>
            </div>
        </div>
    </div>
</template>
