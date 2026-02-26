<script setup>
const props = defineProps({
  settings: {
    type: Object,
    required: true
  },
  disguiseConfig: {
    type: Object,
    required: true
  }
});

import Input from '../../ui/Input.vue';
import Switch from '../../ui/Switch.vue';
import { watch } from 'vue';
import { useToastStore } from '../../../stores/toast';

const { showToast } = useToastStore();

// 系统保留路径列表，这些路径会与前端路由或后端 API 冲突
const RESERVED_PATHS = ['settings', 'login', 'groups', 'nodes', 'subscriptions', 'dashboard', 'api', 'explore'];

// 监听自定义登录路径，禁止特殊字符、空格和保留路径
watch(() => props.settings.customLoginPath, (val) => {
  if (!val) return;
  
  // 仅允许字母、数字、下划线、中划线和斜杠
  const sanitized = val.replace(/[^a-zA-Z0-9-_\/]/g, '');
  
  if (sanitized !== val) {
    props.settings.customLoginPath = sanitized;
    showToast('路径仅允许字母、数字、下划线、中划线', 'warning');
    return;
  }

  // 检查是否为保留路径（去除前后斜杠后比较首段）
  const pathSegment = sanitized.replace(/^\/+/, '').split('/')[0].toLowerCase();
  if (RESERVED_PATHS.includes(pathSegment)) {
    props.settings.customLoginPath = '';
    showToast(`"/${pathSegment}" 是系统保留路径，不可用作自定义登录路径`, 'error');
  }
});


</script>

<template>
  <div class="space-y-8">
    <!-- 订阅基本信息配置 -->
    <div
      class="bg-white/90 dark:bg-gray-900/70 rounded-3xl p-6 space-y-5 border border-gray-100/80 dark:border-white/10 shadow-sm transition-shadow duration-300">
      <h3 class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24"
          stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        订阅配置
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <Input 
            label="自定义订阅文件名"
            v-model="settings.FileName"
            class="rounded-xl"
          />
        </div>
        <div>
          <Input 
            label="自定义订阅Token"
            v-model="settings.mytoken"
            class="rounded-xl"
          />
        </div>
        <div>
          <Input 
            label="订阅组分享Token"
            v-model="settings.profileToken"
            placeholder="用于生成订阅组链接专用Token"
            class="rounded-xl"
          />
        </div>
      </div>
    </div>

    <!-- 功能开关区域 -->
    <div
      class="bg-white/90 dark:bg-gray-900/70 rounded-3xl p-6 space-y-5 border border-gray-100/80 dark:border-white/10 shadow-sm transition-shadow duration-300">
      <h3 class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24"
          stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        功能控制
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- 订阅自动更新间隔 -->
        <div
          class="flex flex-col p-4 bg-white/70 dark:bg-gray-900/50 border border-gray-200/70 dark:border-white/10 rounded-2xl">
          <div class="flex items-center justify-between mb-3">
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-gray-200">订阅自动更新间隔</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">页面打开时自动刷新订阅节点数和流量</p>
            </div>
          </div>
          <div class="flex flex-wrap gap-3">
            <div class="flex items-center gap-2">
              <input
                type="number"
                :value="![0, 30, 60, 120].includes(settings.autoUpdateInterval) ? settings.autoUpdateInterval : ''"
                @input="e => { const v = parseInt(e.target.value); if (v >= 5) settings.autoUpdateInterval = v; }"
                placeholder="自定义"
                min="5"
                class="w-24 px-2.5 py-2 text-sm bg-white/70 dark:bg-black/20 border border-gray-200/80 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 outline-none transition-all"
              >
              <span class="text-xs text-gray-500 dark:text-gray-400">分钟</span>
            </div>
            <span class="text-xs text-gray-400 dark:text-gray-500 self-center">快捷选择</span>
            <button
              v-for="option in [
                { value: 0, label: '禁用' },
                { value: 30, label: '30分钟' },
                { value: 60, label: '1小时' },
                { value: 120, label: '2小时' }
              ]"
              :key="option.value"
              @click="settings.autoUpdateInterval = option.value"
              :aria-pressed="settings.autoUpdateInterval === option.value"
              :class="[
                'px-3 py-2 text-xs font-medium rounded-lg border transition-colors',
                settings.autoUpdateInterval === option.value
                  ? 'bg-primary-600 text-white border-primary-600 shadow-sm shadow-primary-500/30'
                  : 'bg-white/70 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 border-gray-200/70 dark:border-white/10 hover:bg-white dark:hover:bg-gray-800'
              ]"
            >
              {{ option.label }}
            </button>
          </div>
          <p v-if="settings.autoUpdateInterval === 0" class="text-xs text-amber-600 dark:text-amber-400 mt-2">
            ⚠️ 自动更新已禁用，订阅信息需手动刷新
          </p>
        </div>

        <!-- 访问日志 -->
        <div
          class="flex items-center justify-between p-4 bg-white/70 dark:bg-gray-900/50 border border-gray-200/70 dark:border-white/10 rounded-2xl">
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-gray-200">开启访问日志 & 计数</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">记录订阅访问并统计流量与IP</p>
          </div>
          <Switch 
            v-model="settings.enableAccessLog"
          />
        </div>

        <!-- 流量统计节点 -->
        <div
          class="flex items-center justify-between p-4 bg-white/70 dark:bg-gray-900/50 border border-gray-200/70 dark:border-white/10 rounded-2xl">
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-gray-200">显示流量统计节点</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">在订阅中生成虚拟节点显示剩余流量</p>
          </div>
          <Switch 
            v-model="settings.enableTrafficNode"
          />
        </div>
      </div>
    </div>



    <!-- Web 访问控制 -->
    <div
      class="bg-white/90 dark:bg-gray-900/70 rounded-3xl p-6 space-y-5 border border-gray-100/80 dark:border-white/10 shadow-sm transition-shadow duration-300">
      <h3 class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24"
          stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
        Web 访问控制
      </h3>

      <div
        class="bg-white/70 dark:bg-gray-900/50 border border-gray-200/70 dark:border-white/10 rounded-2xl divide-y divide-gray-200/60 dark:divide-white/10 overflow-hidden">
        <!-- 公开页访问 -->
        <div
          class="p-4 flex items-center justify-between hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors">
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-gray-200">允许未登录访问公开页</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">关闭后访问首页将跳转登录页面</p>
          </div>
          <Switch 
            v-model="settings.enablePublicPage"
          />
        </div>

        <!-- 伪装页面 -->
        <div class="p-4 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-gray-200">启用伪装页面</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">浏览器访问订阅链接时显示伪装内容，防止被探测</p>
            </div>
            <Switch 
              v-model="disguiseConfig.enabled"
            />
          </div>

          <!-- 自定义登录路径设置 -->
          <div class="pt-4 border-t border-gray-200/70 dark:border-white/10">
             <div class="max-w-md">
                <!-- 隐藏的诱饵输入框，吸收浏览器自动填充 -->
                <input type="text" name="fake_user_for_autofill" autocomplete="username" style="display:none" tabindex="-1" aria-hidden="true" />
                <input type="password" name="fake_pass_for_autofill" autocomplete="current-password" style="display:none" tabindex="-1" aria-hidden="true" />
                <Input 
                  label="自定义管理后台路径"
                  v-model="settings.customLoginPath"
                  placeholder="默认: login"
                  prefix="/"
                  autocomplete="off"
                  name="custom_admin_path_setting_no_autofill"
                  type="search"
                />
             </div>
             <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
               设置后，只有访问此路径才能进入登录页面。默认路径 <code>/login</code> 将失效（除非未设置）。
             </p>
             <p class="text-xs text-amber-600 dark:text-amber-400 mt-1">
               ⚠️ 不可使用系统保留路径：/settings, /login, /groups, /nodes, /subscriptions, /dashboard
             </p>
          </div>

            <div v-show="disguiseConfig.enabled"
            class="bg-white/80 dark:bg-gray-900/60 rounded-2xl p-4 space-y-4 border border-gray-200/70 dark:border-white/10 transition-all duration-300">
            <div>
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">伪装策略</label>
              <div class="flex flex-col sm:flex-row gap-4">
                <label class="flex items-center cursor-pointer group">
                  <input type="radio" value="default" v-model="disguiseConfig.pageType"
                    class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 dark:bg-gray-800">
                  <div class="ml-3">
                    <span
                      class="block text-sm font-medium text-gray-900 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">默认
                      404</span>
                    <span class="block text-xs text-gray-500">显示标准的 404 Not Found 页面</span>
                  </div>
                </label>
                <label class="flex items-center cursor-pointer group">
                  <input type="radio" value="redirect" v-model="disguiseConfig.pageType"
                    class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 dark:bg-gray-800">
                  <div class="ml-3">
                    <span
                      class="block text-sm font-medium text-gray-900 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">URL
                      跳转</span>
                    <span class="block text-xs text-gray-500">自动重定向到指定的网页地址</span>
                  </div>
                </label>
              </div>
            </div>

            <div v-if="disguiseConfig.pageType === 'redirect'" class="animate-fade-in-down">
              <div>
                <Input 
                  label="目标网址"
                  v-model="disguiseConfig.redirectUrl"
                  placeholder="www.example.com"
                  type="url"
                  prefix="https://"
                />
              </div>
            </div>

            <div
              class="flex items-start gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-900/20 p-2.5 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0 mt-0.5" viewBox="0 0 20 20"
                fill="currentColor">
                <path fill-rule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clip-rule="evenodd" />
              </svg>
              <span>伪装仅对浏览器 (User-Agent) 访问生效，不会影响 Clash、V2Ray 等代理客户端的正常订阅更新。</span>
            </div>
      </div>
      </div>
    </div>
  </div>



  </div>
</template>

<style scoped>
/* Toggle Switch CSS */


.animate-fade-in-down {
  animation: fadeInDown 0.3s ease-out;
}

@keyframes fadeInDown {
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
