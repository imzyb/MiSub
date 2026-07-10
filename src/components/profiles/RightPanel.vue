<script setup>
import { ref, computed, onUnmounted } from 'vue';
import { useToastStore } from '../../stores/toast.js';
import { useUIStore } from '../../stores/ui.js';
import { useI18n } from '../../i18n/index.js';

const props = defineProps({
  config: Object,
  profiles: Array,
  compact: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['qrcode']);

const { showToast } = useToastStore();
const uiStore = useUIStore();
const { t } = useI18n();

const copied = ref(false);
let copyTimeout = null;

const formats = ['universal', 'Base64', 'Clash', 'Sing-Box', 'Surge', 'Loon'];
const selectedFormat = ref('universal');
const selectedId = ref('default');

const formatLabel = (format) => format === 'universal' ? t('dashboard.linkCard.universalFormat') : format;
const isStableToken = (value) => typeof value === 'string' && value.trim() === value && value !== 'auto' && /^[a-zA-Z0-9-_]+$/.test(value);

const hasProfiles = computed(() => (props.profiles || []).length > 0);
const mainTokenReady = computed(() => isStableToken(props.config?.mytoken));
const profileTokenReady = computed(() => isStableToken(props.config?.profileToken));

const setupTasks = computed(() => {
  const tasks = [];
  if (!mainTokenReady.value) {
    tasks.push({
      id: 'main-token',
      title: t('dashboard.linkCard.mainTokenTitle'),
      description: t('dashboard.linkCard.mainTokenDesc'),
      to: '/dashboard/settings?focus=mytoken'
    });
  }
  if (!hasProfiles.value) {
    tasks.push({
      id: 'profile',
      title: t('dashboard.linkCard.profileTitle'),
      description: t('dashboard.linkCard.profileDesc'),
      to: '/dashboard/subscriptions?focus=profiles'
    });
  }
  if (hasProfiles.value && !profileTokenReady.value) {
    tasks.push({
      id: 'profile-token',
      title: t('dashboard.linkCard.profileTokenTitle'),
      description: t('dashboard.linkCard.profileTokenDesc'),
      to: '/dashboard/settings?focus=profileToken'
    });
  }
  return tasks;
});

const hasSetupTasks = computed(() => setupTasks.value.length > 0);

const requiredToken = computed(() => {
  return selectedId.value === 'default'
    ? { type: 'mytoken', value: props.config?.mytoken, name: t('dashboard.linkCard.tokenNameMain') }
    : { type: 'profileToken', value: props.config?.profileToken, name: t('dashboard.linkCard.tokenNameShare') };
});

const isLinkValid = computed(() => isStableToken(requiredToken.value.value));

const subLink = computed(() => {
  if (!isLinkValid.value) {
    return t('dashboard.linkCard.configureTokenFirst', { name: requiredToken.value.name });
  }
  
  const origin = window.location.origin;
  const token = requiredToken.value.value;
  let baseUrl = selectedId.value === 'default'
    ? `${origin}/${token}`
    : `${origin}/${token}/${selectedId.value}`;

  if (selectedFormat.value === 'universal') {
    return baseUrl;
  }
  
  const targetMapping = { 'Sing-Box': 'base64', 'QuanX': 'quanx' };
  const formatKey = (targetMapping[selectedFormat.value] || selectedFormat.value.toLowerCase());
  return `${baseUrl}?${formatKey}`;
});

const copyToClipboard = () => {
    if (!isLinkValid.value) {
        showToast(t('notices.linkInvalid'), 'error');
        return;
    }
    navigator.clipboard.writeText(subLink.value);
    showToast(t('notices.copied'), 'success');
    copied.value = true;
    clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => { copied.value = false; }, 2000);
};

onUnmounted(() => {
  clearTimeout(copyTimeout);
});
</script>

<template>
  <div>
    <div class="bg-white/90 dark:bg-gray-900/80 backdrop-blur-md misub-radius-lg border border-gray-100/80 dark:border-white/10 shadow-sm transition-all duration-300" :class="compact ? 'p-4' : 'p-6'">
      <h3 class="font-bold text-gray-900 dark:text-white mb-4 list-item-animation" :class="compact ? 'text-base' : 'text-lg'" style="--delay-index: 0">{{ t('dashboard.linkCard.title') }}</h3>

      <div v-if="hasSetupTasks" class="mb-4 rounded-[var(--misub-radius-md)] border border-amber-200/80 bg-amber-50/80 p-3 text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200 list-item-animation" style="--delay-index: 1">
        <p class="text-sm font-semibold">{{ t('dashboard.linkCard.setupTitle') }}</p>
        <div class="mt-2 grid gap-2">
          <router-link
            v-for="task in setupTasks"
            :key="task.id"
            :to="task.to"
            class="block rounded-[var(--misub-radius-sm)] border border-current/15 bg-white/50 px-3 py-2 text-xs hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/15 transition-colors"
          >
            <span class="block font-semibold">{{ task.title }}</span>
            <span class="mt-0.5 block opacity-80">{{ task.description }}</span>
          </router-link>
        </div>
      </div>

      <div class="mb-4 list-item-animation" style="--delay-index: 2">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('dashboard.linkCard.selectContent') }}</label>
        <select v-model="selectedId" class="w-full px-3 py-2.5 bg-white/80 dark:bg-gray-800/70 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:outline-hidden focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 text-sm text-gray-900 dark:text-white input-enhanced">
            <option value="default">{{ t('dashboard.linkCard.defaultSubscription') }}</option>
            <option v-for="profile in profiles" :key="profile.id" :value="profile.customId || profile.id">
                {{ profile.name }}
            </option>
        </select>
      </div>

      <div class="mb-5 list-item-animation" style="--delay-index: 3">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('dashboard.linkCard.selectFormat') }}</label>
        <div class="grid gap-2" :class="compact ? 'grid-cols-2' : 'grid-cols-3'">
            <button
              v-for="(format, index) in formats"
              :key="format"
              @click="selectedFormat = format"
              :aria-pressed="selectedFormat === format"
              class="min-h-11 px-3 py-2.5 text-xs font-medium misub-radius-lg border transition-colors flex justify-center items-center text-center list-item-animation"
              :style="{ '--delay-index': index }"
              :class="[
                selectedFormat === format
                  ? 'bg-primary-600 text-white border-primary-600 shadow-sm shadow-primary-500/30'
                  : 'bg-white/70 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 border-gray-200/70 dark:border-white/10 hover:bg-white dark:hover:bg-gray-800'
              ]"
            >
              {{ formatLabel(format) }}
            </button>
        </div>
      </div>

      <div class="relative list-item-animation" style="--delay-index: 4">
        <input
          type="text"
          :value="subLink"
          readonly
          :disabled="!isLinkValid"
          class="w-full min-h-12 text-sm text-gray-600 dark:text-gray-300 bg-gray-100/80 dark:bg-gray-800/60 misub-radius-lg pl-3 pr-24 py-3 border border-gray-200/70 dark:border-white/10 focus:outline-hidden focus:ring-2 font-mono input-enhanced"
          :class="{
            'focus:ring-primary-500': isLinkValid,
            'focus:ring-red-500 cursor-not-allowed': !isLinkValid,
            'text-red-500 dark:text-red-500': !isLinkValid
          }"
        />
        <div class="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button @click="$emit('qrcode', subLink, t('dashboard.linkCard.qrTitle'))" :disabled="!isLinkValid" class="flex h-11 w-11 items-center justify-center misub-radius-md text-gray-400 transition-colors duration-200" :class="isLinkValid ? 'hover:text-primary-600 hover:bg-white/80 dark:hover:bg-gray-800' : 'cursor-not-allowed'" :title="t('dashboard.linkCard.showQrCode')">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
               <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
               <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
             </svg>
          </button>
          <button @click="copyToClipboard" :disabled="!isLinkValid" class="flex h-11 w-11 items-center justify-center misub-radius-md text-gray-400 transition-colors duration-200" :class="isLinkValid ? 'hover:text-primary-600 hover:bg-white/80 dark:hover:bg-gray-800' : 'cursor-not-allowed'" :title="t('dashboard.linkCard.copyLink')">
             <Transition name="fade" mode="out-in">
                 <svg v-if="copied" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                     <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                 </svg>
                 <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                     <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                 </svg>
             </Transition>
          </button>
        </div>
      </div>

       <p v-if="!isLinkValid || requiredToken.value === 'auto'" class="text-xs text-yellow-600 dark:text-yellow-500 mt-2 list-item-animation" style="--delay-index: 5">
           {{ t('dashboard.linkCard.hintPrefix') }}
           <span v-if="!isLinkValid">
             {{ t('dashboard.linkCard.fixedTokenHint', { name: requiredToken.name }) }}
             <router-link to="/dashboard/settings" class="font-bold underline hover:text-yellow-400">{{ t('dashboard.linkCard.settingsLink') }}</router-link>
             {{ t('dashboard.linkCard.fixedTokenHintSuffix', { name: requiredToken.name }) }}
           </span>
           <span v-else-if="requiredToken.type === 'mytoken' && requiredToken.value === 'auto'">
             {{ t('dashboard.linkCard.autoTokenWarning') }}
           </span>
       </p>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
