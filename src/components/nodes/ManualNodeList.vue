<script setup>
import { computed } from 'vue';
import { extractHostAndPort } from '../../lib/utils.js';
import { useToastStore } from '../../stores/toast.js';

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  index: {
    type: Number,
    required: true,
  },
  isSelectionMode: Boolean,
  isSelected: Boolean,
  pingResult: Object,
  isPinging: Boolean
});

const emit = defineEmits(['delete', 'edit', 'toggle-select', 'filter-group', 'ping']);
const { showToast } = useToastStore();

const getProtocol = (url) => {
  try {
    if (!url) return 'unknown';
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.startsWith('anytls://')) return 'anytls';
    if (lowerUrl.startsWith('hysteria2://') || lowerUrl.startsWith('hy2://')) return 'hysteria2';
    if (lowerUrl.startsWith('hysteria://') || lowerUrl.startsWith('hy://')) return 'hysteria';
    if (lowerUrl.startsWith('ssr://')) return 'ssr';
    if (lowerUrl.startsWith('tuic://')) return 'tuic';
    if (lowerUrl.startsWith('ss://')) return 'ss';
    if (lowerUrl.startsWith('vmess://')) return 'vmess';
    if (lowerUrl.startsWith('vless://')) return 'vless';
    if (lowerUrl.startsWith('trojan://')) return 'trojan';
    if (lowerUrl.startsWith('socks5://') || lowerUrl.startsWith('socks://')) return 'socks5';
    if (lowerUrl.startsWith('snell://')) return 'snell';
    if (lowerUrl.startsWith('naive+https://') || lowerUrl.startsWith('naive+http://') || lowerUrl.startsWith('naive+quic://')) return 'naive';
    if (lowerUrl.startsWith('http')) return 'http';
  } catch {
    return 'unknown';
  }
  return 'unknown';
};

const protocol = computed(() => getProtocol(props.node.url));
const hostAndPort = computed(() => extractHostAndPort(props.node.url));

const protocolStyle = computed(() => {
  const p = protocol.value;
  const styles = {
    anytls: { text: 'AnyTLS', style: 'bg-slate-500/20 text-slate-500 dark:text-slate-400' },
    vless: { text: 'VLESS', style: 'bg-blue-500/20 text-blue-500 dark:text-blue-400' },
    hysteria2: { text: 'HY2', style: 'bg-purple-500/20 text-purple-500 dark:text-purple-400' },
    hysteria: { text: 'Hysteria', style: 'bg-fuchsia-500/20 text-fuchsia-500 dark:text-fuchsia-400' },
    tuic: { text: 'TUIC', style: 'bg-cyan-500/20 text-cyan-500 dark:text-cyan-400' },
    trojan: { text: 'TROJAN', style: 'bg-red-500/20 text-red-500 dark:text-red-400' },
    ssr: { text: 'SSR', style: 'bg-rose-500/20 text-rose-500 dark:text-rose-400' },
    ss: { text: 'SS', style: 'bg-orange-500/20 text-orange-500 dark:text-orange-400' },
    vmess: { text: 'VMESS', style: 'bg-teal-500/20 text-teal-500 dark:text-teal-400' },
    socks5: { text: 'SOCKS5', style: 'bg-lime-500/20 text-lime-500 dark:text-lime-400' },
    http: { text: 'HTTP', style: 'bg-green-500/20 text-green-500 dark:text-green-400' },
    snell: { text: 'SNELL', style: 'bg-indigo-500/20 text-indigo-500 dark:text-indigo-400' },
    naive: { text: 'NAIVE', style: 'bg-pink-500/20 text-pink-500 dark:text-pink-400' },
    unknown: { text: 'LINK', style: 'bg-gray-500/20 text-gray-500 dark:text-gray-400' }
  };
	return styles[p] || styles['unknown'];
});

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板', 'success');
  } catch {
    showToast('复制失败', 'error');
  }
};


</script>

<template>
  <div
    class="group flex w-full items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary-500/5 dark:border-white/10 dark:bg-gray-900/70"
    :class="{ 
        'opacity-50': !node.enabled && !isSelectionMode,
        'ring-2 ring-indigo-500': isSelectionMode && isSelected,
        'cursor-pointer': isSelectionMode
    }"
    @click="isSelectionMode ? emit('toggle-select') : null"
  >
    <!-- Mobile Layout -->
    <div class="w-full sm:hidden">
      <div class="flex items-start gap-3">
        <div v-if="isSelectionMode" class="shrink-0 mt-0.5">
          <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
               :class="isSelected ? 'bg-indigo-50 border-indigo-500' : 'border-gray-300 dark:border-gray-600'">
              <svg v-if="isSelected" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
          </div>
        </div>

        <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700/50">
          <span class="text-xs font-semibold text-gray-500 dark:text-gray-300">
            {{ index }}
          </span>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 flex-wrap min-w-0">
              <div
                class="inline-block shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                :class="protocolStyle.style"
              >
                {{ protocolStyle.text }}
              </div>
              <div v-if="node.group"
                class="max-w-[100px] cursor-pointer truncate rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                @click.stop="$emit('filter-group', node.group)">
                {{ node.group }}
              </div>
            </div>

            <!-- Header Actions for Mobile -->
            <div v-if="!isSelectionMode" class="flex shrink-0 items-center gap-0.5">
              <button @click.stop="emit('ping')" class="rounded-md p-2 text-gray-400 transition-colors hover:bg-green-500/10 hover:text-green-500" title="测速" :disabled="isPinging" :class="{ 'animate-pulse text-green-500': isPinging }">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </button>
              <button @click.stop="copyToClipboard(node.url)" class="rounded-md p-2 text-gray-400 transition-colors hover:bg-primary-500/10 hover:text-primary-500" title="复制链接">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </button>
              <button @click.stop="emit('edit')" class="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-500/10 hover:text-gray-600 dark:hover:text-gray-200" title="编辑节点">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z" /></svg>
              </button>
              <button @click.stop="emit('delete')" class="rounded-md p-2 text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-500" title="删除节点">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>

          <div class="flex flex-row items-center gap-2 mt-1">
              <p class="flex-1 break-words text-sm font-semibold leading-snug text-gray-900 dark:text-white" :title="node.name">
                {{ node.name || '未命名节点' }}
              </p>
            <div v-if="pingResult" class="flex shrink-0 flex-row items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                 :class="{
                    'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400': pingResult.status === 'ok' && pingResult.latency < 300,
                    'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400': pingResult.status === 'ok' && pingResult.latency >= 300,
                    'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400': pingResult.status === 'error' || pingResult.status === 'timeout',
                    'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400': pingResult.status === 'loading'
                 }"
            >
              <svg v-if="pingResult.status === 'loading'" class="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <span v-if="pingResult.status === 'loading'">测速中</span><span v-else-if="pingResult.status === 'ok'">{{ pingResult.latency }}ms</span><span v-else>不通</span>
            </div>
          </div>

          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono">
            {{ hostAndPort.host || 'N/A' }}:{{ hostAndPort.port || 'N/A' }}
          </p>
        </div>
      </div>

    </div>

    <!-- Desktop Layout -->
    <div class="hidden w-full items-center gap-4 sm:grid"
      :class="[isSelectionMode ? 'grid-cols-[auto_auto_auto_auto_1fr_1fr_auto_auto]' : 'grid-cols-[auto_auto_auto_1fr_1fr_auto_auto]']">
      <div v-if="isSelectionMode" class="shrink-0">
        <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
             :class="isSelected ? 'bg-indigo-50 border-indigo-500' : 'border-gray-300 dark:border-gray-600'">
            <svg v-if="isSelected" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
        </div>
      </div>

      <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700/50">
        <span class="text-xs font-semibold text-gray-500 dark:text-gray-300">
          {{ index }}
        </span>
      </div>

      <div v-if="node.group" class="max-w-[140px] truncate rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        {{ node.group }}
      </div>
      <div v-else class="text-[10px] text-gray-300 dark:text-gray-600">-</div>

      <div class="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
        :class="protocolStyle.style">
        {{ protocolStyle.text }}
      </div>

      <div class="min-w-0 flex items-center gap-2 pr-4">
        <p class="truncate text-sm font-semibold text-gray-900 dark:text-white" :title="node.name">
          {{ node.name || '未命名节点' }}
        </p>
        <div v-if="pingResult" class="flex shrink-0 flex-row items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
             :class="{
                'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400': pingResult.status === 'ok' && pingResult.latency < 300,
                'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400': pingResult.status === 'ok' && pingResult.latency >= 300,
                'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400': pingResult.status === 'error' || pingResult.status === 'timeout',
                'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400': pingResult.status === 'loading'
             }"
        >
          <svg v-if="pingResult.status === 'loading'" class="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <span v-if="pingResult.status === 'loading'">测速中</span><span v-else-if="pingResult.status === 'ok'">{{ pingResult.latency }}ms</span><span v-else>不通</span>
        </div>
      </div>

      <div class="min-w-0">
        <p class="font-mono text-xs text-gray-500 dark:text-gray-400 truncate" :title="hostAndPort.host">
          {{ hostAndPort.host || 'N/A' }}
        </p>
      </div>

      <div class="w-16 text-center">
        <p class="font-mono text-xs text-gray-500 dark:text-gray-400">
          {{ hostAndPort.port || 'N/A' }}
        </p>
      </div>

      <div v-if="!isSelectionMode" class="shrink-0 flex items-center gap-1 opacity-100 transition-opacity duration-200 group-hover:opacity-100 lg:opacity-0">
        <button 
          @click.stop="emit('ping')" 
          class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-gray-400 transition-colors hover:bg-green-500/10 hover:text-green-500 lg:min-h-0 lg:min-w-0" 
          title="测速"
          :disabled="isPinging"
          :class="{ 'animate-pulse text-green-500': isPinging }"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </button>
        <button 
          @click.stop="copyToClipboard(node.url)" 
          class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-gray-400 transition-colors hover:bg-primary-500/10 hover:text-primary-500 lg:min-h-0 lg:min-w-0" 
          title="复制链接"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        <button @click.stop="emit('edit')" class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-500/10 hover:text-gray-600 dark:hover:text-gray-200 lg:min-h-0 lg:min-w-0" title="编辑节点">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z" /></svg>
        </button>
        <button @click.stop="emit('delete')" class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-500 lg:min-h-0 lg:min-w-0" title="删除节点">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  </div>
</template>
