<script setup>
import { ref } from 'vue';

const emit = defineEmits(['success']);
const password = ref('');
const isLoading = ref(false);
const error = ref('');

const props = defineProps({
  login: Function,
});

const submitLogin = async () => {
  if (!password.value) {
    error.value = '请输入密码';
    return;
  }
  isLoading.value = true;
  error.value = '';
  try {
    await props.login(password.value);
    // 成功后不再需要 emit，因为父组件会处理状态变更
  } catch (err) {
    error.value = err.message || '发生未知错误';
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="w-full max-w-md">
    <div class="bg-white dark:bg-gray-900/80 backdrop-blur-xs shadow-2xl rounded-2xl p-10">
      <div class="flex flex-col items-center">
        <div class="w-16 h-16 mb-4 text-indigo-600 dark:text-indigo-400">
           <svg width="64" height="64" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
              <path d="M64 128a64 64 0 1 1 64-64a64.07 64.07 0 0 1-64 64Zm0-122a58 58 0 1 0 58 58A58.07 58.07 0 0 0 64 6Z"/>
              <path d="M64 100a36 36 0 1 1 36-36a36 36 0 0 1-36 36Zm0-66a30 30 0 1 0 30 30a30 30 0 0 0-30-30Z"/>
              <path d="M64 78a14 14 0 1 1 14-14a14 14 0 0 1-14 14Zm0-22a8 8 0 1 0 8 8a8 8 0 0 0-8-8Z"/>
          </svg>
        </div>
        <h1 class="text-3xl font-bold text-gray-800 dark:text-white">MISUB</h1>
        <p class="mt-2 text-sm text-gray-500">请输入管理员密码</p>
      </div>

      <form @submit.prevent="submitLogin" class="mt-8 space-y-6">
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <input 
            v-model="password"
            id="password" 
            name="password" 
            type="password" 
            autocomplete="current-password" 
            required 
            class="w-full pl-10 pr-3 py-3 bg-gray-100 dark:bg-gray-800 border-2 border-transparent rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 dark:text-white" 
            placeholder="请输入密码"
          >
        </div>
        <div v-if="error" class="text-sm text-red-500 text-center">
          {{ error }}
        </div>
        <div>
          <button 
            type="submit" 
            :disabled="isLoading"
            class="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-xs text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-75 transition-opacity"
          >
            <svg v-if="isLoading" class="animate-spin h-5 w-5 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span>{{ isLoading ? '登录中...' : '授权访问' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>