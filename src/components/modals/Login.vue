<script setup>
import { ref } from 'vue';
import Button from '../ui/Button.vue';

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
  <div class="w-full max-w-[420px] relative z-10 px-6">
    <!-- Clean Minimalist Card -->
    <div class="relative bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-[2rem] p-10 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] dark:shadow-none overflow-hidden transition-all duration-500 hover:shadow-[0_20px_60px_-12px_rgba(0,0,0,0.15)]">
      
      <div class="flex flex-col items-center relative z-10">
        <!-- Modern Gradient Logo -->
        <div class="w-24 h-24 mb-8 relative group cursor-default">
           <div class="absolute inset-0 bg-indigo-500/30 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
           <div class="w-full h-full rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/40 relative z-10">
              <svg width="60%" height="60%" viewBox="0 0 128 128" fill="currentColor">
                 <path d="M64 128a64 64 0 1 1 64-64a64.07 64.07 0 0 1-64 64Zm0-122a58 58 0 1 0 58 58A58.07 58.07 0 0 0 64 6Z"/>
                 <path d="M64 100a36 36 0 1 1 36-36a36 36 0 0 1-36 36Zm0-66a30 30 0 1 0 30 30a30 30 0 0 0-30-30Z"/>
              </svg>
           </div>
        </div>
        
        <div class="text-center mb-10">
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
            欢迎回来
          </h1>
          <p class="text-base text-gray-500 dark:text-gray-400 font-medium">
            请验证您的管理员身份
          </p>
        </div>
      </div>

      <form @submit.prevent="submitLogin" class="space-y-8 relative z-10 w-full mb-4">
        
        <div class="relative w-full group" :class="{ 'animate-shake': error }">
          <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors"
               :class="error ? 'text-red-500' : 'text-gray-400 group-focus-within:text-primary-500'">
            <svg v-if="!error" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          </div>
          <input 
            v-model="password"
            @input="error = ''"
            type="password"
            placeholder="Access Token"
            :disabled="isLoading"
            class="w-full bg-transparent border rounded-xl py-3.5 pl-11 pr-4 outline-none transition-all duration-300 disabled:opacity-50"
            :class="[
              error 
                ? 'border-red-500 text-red-500 placeholder-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500/50' 
                : 'border-gray-200 dark:border-white/20 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:border-primary-500 dark:focus:border-primary-400 focus:ring-1 focus:ring-primary-500/50 dark:focus:ring-primary-400/50'
            ]"
          />
          <!-- Error Message with Animation -->
          <transition name="fade">
            <p v-if="error" class="absolute top-full mt-2 left-0 right-0 text-center text-xs text-red-500 font-bold tracking-wide flex items-center justify-center gap-1">
              {{ error }}
            </p>
          </transition>
        </div>
        
<Button
type="submit"
class="w-full"
:loading="isLoading"
variant="primary"
size="lg"
>
<span v-if="!isLoading">授权登录</span>
<span v-else>验证中...</span>
</Button>

      </form>
    </div>
    
    <div class="mt-8 text-center">
        <a href="/" class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-sm text-gray-500 dark:text-gray-400 font-medium transition-all hover:-translate-y-0.5">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4"viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
          </svg>
          返回首页
        </a>
    </div>
  </div>
</template>

<style scoped>
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.animate-shake {
  animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>