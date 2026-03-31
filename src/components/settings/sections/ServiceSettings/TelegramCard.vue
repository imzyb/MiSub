<script setup>
import { ref, computed } from 'vue';
import Switch from '../../../ui/Switch.vue';

const props = defineProps({
  settings: {
    type: Object,
    required: true
  }
});

// Telegram Push Bot 配置
const telegramPushConfig = computed({
  get() {
    return props.settings.telegram_push_config || {
      enabled: true,
      bot_token: '',
      webhook_secret: '',
      allowed_user_ids: []
    };
  },
  set(value) {
    props.settings.telegram_push_config = value;
  }
});

// 白名单用户 ID（逗号分隔的字符串）
const allowedUsersStr = computed({
  get() {
    return (telegramPushConfig.value.allowed_user_ids || []).join(', ');
  },
  set(value) {
    const ids = value.split(',').map(id => id.trim()).filter(id => id);
    telegramPushConfig.value = {
      ...telegramPushConfig.value,
      allowed_user_ids: ids
    };
  }
});

// Webhook URL
const webhookUrl = computed(() => {
  return `${window.location.origin}/api/telegram/webhook`;
});

// Webhook 设置链接（自动生成）
const setWebhookUrl = computed(() => {
  const botToken = telegramPushConfig.value.bot_token;
  const secret = telegramPushConfig.value.webhook_secret;

  if (!botToken) {
    return '';
  }

  let url = `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl.value)}`;

  if (secret) {
    url += `&secret_token=${encodeURIComponent(secret)}`;
  }

  return url;
});

// 复制 Webhook URL
function copyWebhookUrl() {
  navigator.clipboard.writeText(webhookUrl.value);
  // 可以添加 toast 提示
}

// 复制 Webhook 设置链接
function copySetWebhookUrl() {
  if (setWebhookUrl.value) {
    navigator.clipboard.writeText(setWebhookUrl.value);
    // 可以添加 toast 提示
  }
}

// 折叠状态
const showSetupGuide = ref(false);
const showUsageGuide = ref(false);

const isTesting = ref(false);
const testResult = ref(null);

async function testNotification() {
  isTesting.value = true;
  testResult.value = null;
  try {
    const response = await fetch('/api/test_notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botToken: props.settings.BotToken,
        chatId: props.settings.ChatID
      })
    });
    const data = await response.json();
    if (data.success) {
      testResult.value = { success: true, message: '测试成功！消息已发送。' };
    } else {
      testResult.value = {
        success: false,
        message: '测试失败',
        error: data.error || '未知错误',
        detail: data.detail
      };
    }
  } catch (e) {
    testResult.value = { success: false, message: '请求失败', error: e.message };
  } finally {
    isTesting.value = false;
  }
}
</script>

<template>
  <!-- Telegram 通知 Bot 卡片 -->
  <div class="bg-white/90 dark:bg-gray-900/70 misub-radius-lg p-6 space-y-5 border border-gray-100/80 dark:border-white/10 shadow-sm transition-shadow duration-300">
    <h3 class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24"
        stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      Telegram 通知 Bot
    </h3>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bot Token</label>
        <input type="text" v-model="settings.BotToken"
          class="block w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 misub-radius-lg shadow-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:text-white transition-colors">
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">用于推送订阅更新通知</p>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chat ID</label>
        <input type="text" v-model="settings.ChatID"
          class="block w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 misub-radius-lg shadow-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:text-white transition-colors">
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">接收通知的聊天 ID</p>
      </div>
    </div>


    <!-- Test Button & Result -->
    <div class="border-t border-gray-100 dark:border-gray-700 pt-4">
      <div class="flex items-center gap-4">
        <button @click="testNotification" :disabled="isTesting || !settings.BotToken || !settings.ChatID"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium misub-radius-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
          <svg v-if="isTesting" class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none"
            viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
            </path>
          </svg>
          <span v-else>🔔</span>
          {{ isTesting ? '发送中...' : '测试通知' }}
        </button>
        <div v-if="testResult"
          :class="testResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
          class="text-sm">
          <span v-if="testResult.success">✅ {{ testResult.message }}</span>
          <span v-else>
            ❌ {{ testResult.message }}: {{ testResult.error }}
            <details v-if="testResult.detail"
              class="mt-1 text-xs font-mono bg-gray-100 dark:bg-gray-900 p-2 rounded max-h-32 overflow-auto">
              <summary class="cursor-pointer text-gray-500">查看详细信息</summary>
              <pre>{{ JSON.stringify(testResult.detail, null, 2) }}</pre>
            </details>
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- Telegram 推送 Bot 卡片 -->
  <div class="bg-white/90 dark:bg-gray-900/70 misub-radius-lg p-6 space-y-5 border border-gray-100/80 dark:border-white/10 shadow-sm transition-shadow duration-300">
    <h3 class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24"
        stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
      Telegram 推送 Bot
    </h3>

      <div
        class="flex items-center justify-between p-4 bg-white/70 dark:bg-gray-900/50 border border-gray-200/70 dark:border-white/10 misub-radius-lg">
        <div>
          <label class="text-sm font-medium text-gray-900 dark:text-gray-200">启用节点推送功能</label>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">通过 Telegram Bot 快速推送代理节点</p>
        </div>
        <Switch 
          v-model="telegramPushConfig.enabled"
        />
      </div>

    <!-- 配置内容 -->
    <div v-if="telegramPushConfig.enabled" class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Bot Token -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            推送 Bot Token
          </label>
          <input type="text" v-model="telegramPushConfig.bot_token" placeholder="123456:ABC-DEF..."
            class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white">
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">独立的 Bot，用于接收节点推送</p>
        </div>

        <!-- Webhook Secret -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Webhook Secret（可选）
          </label>
          <input type="text" v-model="telegramPushConfig.webhook_secret" placeholder="随机字符串"
            class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white">
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">用于验证 Webhook 请求来源</p>
        </div>
      </div>

      <!-- 白名单用户 ID -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          允许的用户 ID（白名单）
        </label>
        <textarea v-model="allowedUsersStr" rows="2" placeholder="123456789, 987654321"
          class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"></textarea>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          多个 ID 用逗号分隔。只有这些用户可以通过 Bot 推送节点。
          <a href="https://t.me/userinfobot" target="_blank" class="text-indigo-600 hover:text-indigo-500">
            获取你的 User ID
          </a>
        </p>
      </div>

      <!-- Webhook URL -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Webhook URL
        </label>
        <div class="mt-1 flex misub-radius-md shadow-xs">
          <input type="text" :value="webhookUrl" readonly
            class="flex-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-l-md sm:text-sm dark:text-white">
          <button @click="copyWebhookUrl" type="button"
            class="inline-flex items-center px-4 py-2 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-hidden">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          用于接收 Telegram 消息的回调地址
        </p>
      </div>

      <!-- Webhook 设置链接（自动生成） -->
      <div v-if="setWebhookUrl">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Webhook 设置链接（自动生成）
        </label>
        <div class="mt-1 flex misub-radius-md shadow-xs">
          <input type="text" :value="setWebhookUrl" readonly
            class="flex-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-l-md sm:text-sm dark:text-white font-mono text-xs">
          <button @click="copySetWebhookUrl" type="button"
            class="inline-flex items-center px-4 py-2 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-hidden">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          <strong>使用方法：</strong>复制此链接 → 在浏览器地址栏粘贴 → 回车访问 → 看到 "ok":true 即成功
        </p>
      </div>
      <div v-else
        class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 misub-radius-md p-3">
        <p class="text-xs text-yellow-700 dark:text-yellow-300">
          💡 填写 Bot Token 后，将自动生成 Webhook 设置链接
        </p>
      </div>

      <!-- 快速帮助 -->
      <div class="flex flex-col sm:flex-row gap-2">
        <button @click="showSetupGuide = !showSetupGuide" type="button"
          class="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 text-sm font-medium misub-radius-md border transition-colors flex-1"
          :class="showSetupGuide
            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'">
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clip-rule="evenodd" />
          </svg>
          <span>配置步骤</span>
          <svg class="h-4 w-4 transition-transform ml-auto sm:ml-0" :class="showSetupGuide ? 'rotate-180' : ''"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <button @click="showUsageGuide = !showUsageGuide" type="button"
          class="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 text-sm font-medium misub-radius-md border transition-colors flex-1"
          :class="showUsageGuide
            ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'">
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd"
              d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd" />
          </svg>
          <span>使用说明</span>
          <svg class="h-4 w-4 transition-transform ml-auto sm:ml-0" :class="showUsageGuide ? 'rotate-180' : ''"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <!-- 配置步骤内容（无折叠动画） -->
      <div v-if="showSetupGuide" class="overflow-hidden">
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 misub-radius-md p-4">
          <div class="text-sm text-blue-700 dark:text-blue-300">
            <ol class="list-decimal list-inside space-y-2">
              <li>
                <strong>创建 Bot：</strong>在 Telegram 中找到
                <a href="https://t.me/botfather" target="_blank" class="underline hover:text-blue-600">@BotFather</a>
                ，发送 <code class="bg-blue-100 dark:bg-blue-800 px-1.5 py-0.5 rounded text-xs">/newbot</code>
              </li>
              <li><strong>填写配置：</strong>将获得的 Bot Token 和 Webhook Secret（可选）填入上方</li>
              <li>
                <strong>添加白名单：</strong>获取你的
                <a href="https://t.me/userinfobot" target="_blank" class="underline hover:text-blue-600">Telegram User
                  ID</a>
                并添加到白名单
              </li>
              <li>
                <strong>设置 Webhook：</strong>
                <div class="mt-1 ml-6 space-y-1">
                  <div>① 复制上方自动生成的 "Webhook 设置链接"</div>
                  <div>② 在浏览器地址栏粘贴并访问</div>
                  <div>③ 看到 <code class="bg-blue-100 dark:bg-blue-800 px-1.5 py-0.5 rounded text-xs">"ok":true</code>
                    即成功</div>
                </div>
              </li>
              <li><strong>开始使用：</strong>保存设置后，向 Bot 发送节点链接即可推送</li>
            </ol>
          </div>
        </div>
      </div>

      <!-- 使用说明内容（无折叠动画） -->
      <div v-show="showUsageGuide" class="overflow-hidden">
        <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 misub-radius-md p-4">
          <div class="text-sm text-green-700 dark:text-green-300 space-y-3">
            <!-- Bot 命令 -->
            <div>
              <p class="font-medium mb-1">📖 基础命令</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-1 ml-4 text-xs">
                <div><code class="bg-green-100 dark:bg-green-800 px-1.5 py-0.5 rounded">/start</code> - 欢迎信息</div>
                <div><code class="bg-green-100 dark:bg-green-800 px-1.5 py-0.5 rounded">/help</code> - 帮助信息</div>
                <div><code class="bg-green-100 dark:bg-green-800 px-1.5 py-0.5 rounded">/menu</code> - 快捷菜单</div>
                <div><code class="bg-green-100 dark:bg-green-800 px-1.5 py-0.5 rounded">/list</code> - 节点列表</div>
                <div><code class="bg-green-100 dark:bg-green-800 px-1.5 py-0.5 rounded">/stats</code> - 统计信息</div>
                <div><code class="bg-green-100 dark:bg-green-800 px-1.5 py-0.5 rounded">/search</code> - 搜索节点</div>
              </div>
            </div>

            <!-- 管理命令 -->
            <div>
              <p class="font-medium mb-1">✏️ 管理命令</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-1 ml-4 text-xs">
                <div><code class="bg-green-100 dark:bg-green-800 px-1.5 py-0.5 rounded">/delete 1</code> - 删除节点</div>
                <div><code class="bg-green-100 dark:bg-green-800 px-1.5 py-0.5 rounded">/enable 1</code> - 启用节点</div>
                <div><code class="bg-green-100 dark:bg-green-800 px-1.5 py-0.5 rounded">/disable 1</code> - 禁用节点</div>
                <div><code class="bg-green-100 dark:bg-green-800 px-1.5 py-0.5 rounded">/rename 1 新名</code> - 重命名</div>
                <div><code class="bg-green-100 dark:bg-green-800 px-1.5 py-0.5 rounded">/sub</code> - 获取订阅链接</div>
                <div><code class="bg-green-100 dark:bg-green-800 px-1.5 py-0.5 rounded">/delete all</code> - 删除全部</div>
              </div>
            </div>

            <!-- 推送方式 -->
            <div>
              <p class="font-medium mb-1">📤 推送方式</p>
              <ul class="space-y-0.5 ml-4 text-xs">
                <li>• <strong class="text-green-800 dark:text-green-200">直接发送节点链接</strong>（无需命令）</li>
                <li>• 批量：一次多条（每行一个）</li>
                <li>• 协议：SS, VMess, VLESS, Trojan, Hysteria 等</li>
              </ul>
            </div>

            <!-- 注意事项 -->
            <div>
              <p class="font-medium mb-1">⚠️ 注意</p>
              <ul class="space-y-0.5 ml-4 text-xs">
                <li>• 节点在 <strong>手动节点</strong> 页面查看</li>
                <li>• 需在 <strong>订阅组</strong> 中勾选使用</li>
                <li>• 序号支持：单个(1)、多个(1,3,5)、全部(all)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
