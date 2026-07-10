<script setup>
import { computed, ref } from 'vue';
import Switch from '../../../ui/Switch.vue';
import { useI18n } from '../../../../i18n/index.js';

const { t } = useI18n();

const props = defineProps({
  settings: {
    type: Object,
    required: true
  }
});

const telegramPushConfig = computed({
  get() {
    return props.settings.telegram_push_config || {
      enabled: true,
      bot_token: '',
      webhook_secret: '',
      allowed_user_ids: [],
      allow_all_users: false
    };
  },
  set(value) {
    props.settings.telegram_push_config = value;
  }
});

const allowedUsersStr = computed({
  get() {
    return (telegramPushConfig.value.allowed_user_ids || []).join(', ');
  },
  set(value) {
    const ids = value.split(',').map(id => id.trim()).filter(Boolean);
    telegramPushConfig.value = {
      ...telegramPushConfig.value,
      allowed_user_ids: ids
    };
  }
});

const webhookUrl = computed(() => `${window.location.origin}/api/telegram/webhook`);

const webhookSecret = computed(() => telegramPushConfig.value.webhook_secret?.trim() || '');

const isWebhookSecretValid = computed(() => {
  return /^[A-Za-z0-9_-]{1,256}$/.test(webhookSecret.value);
});

const setWebhookUrl = computed(() => {
  const botToken = telegramPushConfig.value.bot_token?.trim();

  if (!botToken || !isWebhookSecretValid.value) {
    return '';
  }

  return `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl.value)}&secret_token=${encodeURIComponent(webhookSecret.value)}`;
});

const copyStatus = ref(null);
const showSetupGuide = ref(false);
const showUsageGuide = ref(false);
const isTesting = ref(false);
const testResult = ref(null);

async function copyText(value, key) {
  if (!value) return;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    copyStatus.value = { key, message: t('settings.copiedShort') };
  } catch (error) {
    console.error('[TelegramCard] Copy failed:', error);
    copyStatus.value = { key, message: t('settings.copyFailedManualSelect') };
  } finally {
    window.setTimeout(() => {
      if (copyStatus.value?.key === key) {
        copyStatus.value = null;
      }
    }, 2500);
  }
}

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
      testResult.value = { success: true, message: t('settings.telegramTestSuccess') };
    } else {
      testResult.value = {
        success: false,
        message: data.error || t('settings.telegramTestFailed'),
        detail: data.detail
      };
    }
  } catch (error) {
    testResult.value = {
      success: false,
      message: error.message || t('settings.telegramRequestFailed')
    };
  } finally {
    isTesting.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <section class="bg-white/90 dark:bg-gray-900/70 misub-radius-lg p-6 border border-gray-100/80 dark:border-white/10 shadow-sm space-y-4">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.telegramNotifyBotTitle') }}</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.telegramNotifyBotDesc') }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bot Token</label>
          <input
            v-model="settings.BotToken"
            type="text"
            placeholder="123456:ABC-DEF..."
            class="block w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 misub-radius-lg shadow-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:text-white transition-colors"
          >
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.telegramBotTokenHint') }}</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chat ID</label>
          <input
            v-model="settings.ChatID"
            type="text"
            placeholder="123456789"
            class="block w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 misub-radius-lg shadow-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:text-white transition-colors"
          >
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.telegramChatIdHint') }}</p>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          type="button"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium misub-radius-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          :disabled="isTesting || !settings.BotToken || !settings.ChatID"
          @click="testNotification"
        >
          <svg v-if="isTesting" class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>{{ isTesting ? t('settings.telegramTesting') : t('settings.telegramSendTest') }}</span>
        </button>

        <div
          v-if="testResult"
          class="text-sm"
          :class="testResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
        >
          <span>{{ testResult.message }}</span>
          <details v-if="testResult.detail" class="mt-2 text-xs font-mono bg-gray-100 dark:bg-gray-900 p-2 rounded max-h-32 overflow-auto">
            <summary class="cursor-pointer text-gray-500">{{ t('settings.telegramDetails') }}</summary>
            <pre>{{ JSON.stringify(testResult.detail, null, 2) }}</pre>
          </details>
        </div>
      </div>
    </section>

    <section class="bg-white/90 dark:bg-gray-900/70 misub-radius-lg p-6 border border-gray-100/80 dark:border-white/10 shadow-sm space-y-6">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">Telegram Push Bot</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.telegramPushBotDesc') }}</p>
        </div>
        <Switch v-model="telegramPushConfig.enabled" />
      </div>

      <div v-if="telegramPushConfig.enabled" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Push Bot Token</label>
            <input
              v-model="telegramPushConfig.bot_token"
              type="text"
              placeholder="123456:ABC-DEF..."
              class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"
            >
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.telegramPushTokenHint') }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.telegramWebhookSecret') }}</label>
            <input
              v-model="telegramPushConfig.webhook_secret"
              type="text"
              placeholder="random_secret-token"
              class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"
            >
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.telegramWebhookSecretHint') }}</p>
            <p v-if="webhookSecret && !isWebhookSecretValid" class="mt-1 text-xs text-red-600 dark:text-red-400">
              {{ t('settings.telegramWebhookSecretInvalid') }}
            </p>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.telegramAllowedUsers') }}</label>
          <textarea
            v-model="allowedUsersStr"
            rows="2"
            placeholder="123456789, 987654321"
            class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 misub-radius-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"
          />
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ t('settings.telegramAllowedUsersHint') }}
            <a href="https://t.me/userinfobot" target="_blank" class="text-indigo-600 hover:text-indigo-500">{{ t('settings.telegramGetUserId') }}</a>
          </p>
        </div>

        <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 misub-radius-md p-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <label class="block text-sm font-medium text-amber-900 dark:text-amber-200">{{ t('settings.telegramPublicAccess') }}</label>
              <p class="mt-1 text-xs text-amber-800 dark:text-amber-300">{{ t('settings.telegramPublicAccessHint') }}</p>
            </div>
            <Switch v-model="telegramPushConfig.allow_all_users" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Webhook URL</label>
          <div class="mt-1 flex misub-radius-md shadow-xs">
            <input
              :value="webhookUrl"
              type="text"
              readonly
              class="flex-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-l-md sm:text-sm dark:text-white"
            >
            <button
              type="button"
              class="inline-flex items-center px-4 py-2 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-hidden"
              @click="copyText(webhookUrl, 'webhook')"
            >
              {{ copyStatus?.key === 'webhook' ? copyStatus.message : t('actions.copy') }}
            </button>
          </div>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.telegramWebhookUrlHint') }}</p>
        </div>

        <div v-if="setWebhookUrl">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.telegramSetWebhookLink') }}</label>
          <div class="mt-1 flex misub-radius-md shadow-xs">
            <input
              :value="setWebhookUrl"
              type="text"
              readonly
              class="flex-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-l-md sm:text-sm dark:text-white font-mono text-xs"
            >
            <button
              type="button"
              class="inline-flex items-center px-4 py-2 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-hidden"
              @click="copyText(setWebhookUrl, 'setWebhook')"
            >
              {{ copyStatus?.key === 'setWebhook' ? copyStatus.message : t('actions.copy') }}
            </button>
          </div>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.telegramSetWebhookHint') }}</p>
        </div>

        <div v-else class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 misub-radius-md p-3">
          <p class="text-xs text-yellow-700 dark:text-yellow-300">
            {{ t('settings.telegramSetWebhookEmpty') }}
          </p>
        </div>

        <div class="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            class="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 text-sm font-medium misub-radius-md border transition-colors flex-1"
            :class="showSetupGuide
              ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
            @click="showSetupGuide = !showSetupGuide"
          >
            <span>{{ t('settings.telegramSetupSteps') }}</span>
          </button>

          <button
            type="button"
            class="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 text-sm font-medium misub-radius-md border transition-colors flex-1"
            :class="showUsageGuide
              ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
            @click="showUsageGuide = !showUsageGuide"
          >
            <span>{{ t('settings.telegramUsageGuide') }}</span>
          </button>
        </div>

        <div v-if="showSetupGuide" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 misub-radius-md p-4">
          <ol class="list-decimal list-inside space-y-2 text-sm text-blue-700 dark:text-blue-300">
            <li>{{ t('settings.telegramSetupStep1') }}</li>
            <li>{{ t('settings.telegramSetupStep2') }}</li>
            <li>{{ t('settings.telegramSetupStep3') }}</li>
            <li>{{ t('settings.telegramSetupStep4') }}</li>
          </ol>
        </div>

        <div v-if="showUsageGuide" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 misub-radius-md p-4">
          <div class="space-y-2 text-sm text-green-700 dark:text-green-300">
            <p>{{ t('settings.telegramUsageCommands') }}</p>
            <p>{{ t('settings.telegramUsageImport') }}</p>
            <p>{{ t('settings.telegramUsageIsolation') }}</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
