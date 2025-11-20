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
    <!-- 🆕 升级：现代磨砂玻璃卡片 -->
    <div class="bg-white/90 dark:bg-gray-900/80 backdrop-blur-xl card-shadow hover:card-shadow-hover rounded-3xl p-12 transition-all duration-300">
      <div class="flex flex-col items-center">
        <!-- 🆕 升级：动态Logo -->
        <div class="w-20 h-20 mb-6 text-indigo-600 dark:text-indigo-400 transform hover:scale-110 transition-transform duration-300">
           <svg width="80" height="80" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="drop-shadow-lg">
              <path d="M64 128a64 64 0 1 1 64-64a64.07 64.07 0 0 1-64 64Zm0-122a58 58 0 1 0 58 58A58.07 58.07 0 0 0 64 6Z"/>
              <path d="M64 100a36 36 0 1 1 36-36a36 36 0 0 1-36 36Zm0-66a30 30 0 1 0 30 30a30 30 0 0 0-30-30Z"/>
              <path d="M64 78a14 14 0 1 1 14-14a14 14 0 0 1-14 14Zm0-22a8 8 0 1 0 8 8a8 8 0 0 0-8-8Z"/>
          </svg>
        </div>
        <h1 class="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">MISUB</h1>
        <p class="text-gray-600 dark:text-gray-400 font-medium">请输入管理员密码以继续</p>
      </div>

      <form @submit.prevent="submitLogin" class="mt-10 space-y-8">
        <!-- 🆕 升级：现代化密码输入框 -->
        <div class="relative group">
          <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200 group-focus-within:text-indigo-500">
            <svg class="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <input 
            v-model="password"
            id="password" 
            name="password" 
            type="password" 
            autocomplete="current-password" 
            required 
            class="w-full pl-12 pr-4 py-4 bg-gray-100/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl focus:outline-none dark:text-white transition-all duration-200 placeholder:text-gray-400" 
            placeholder="请输入管理员密码"
          >
        </div>
        
        <!-- 错误信息 -->
        <div v-if="error" class="bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm rounded-lg p-3 text-sm text-red-600 dark:text-red-400 text-center">
          {{ error }}
        </div>
        
        <!-- 🆕 升级：现代化提交按钮 -->
        <div>
          <button 
            type="submit" 
            :disabled="isLoading"
            class="w-full flex justify-center items-center py-4 px-6 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <svg v-if="isLoading" class="animate-spin h-5 w-5 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span class="transition-all duration-200">{{ isLoading ? '登录中...' : '授权访问' }}</span>
            <svg v-if="!isLoading" class="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>