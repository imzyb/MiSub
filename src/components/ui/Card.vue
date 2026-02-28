<script setup>
import { computed } from 'vue';
import { formatBytes } from '../../lib/utils.js';
import { TIMING } from '../../constants/timing.js';
import Switch from './Switch.vue';

const props = defineProps({
  misub: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['delete', 'change', 'update', 'edit', 'preview', 'qrcode']);

const getProtocol = (url) => {
  try {
    if (!url) return 'unknown';
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.startsWith('https://')) return 'https';
    if (lowerUrl.startsWith('http://')) return 'http';
    if (lowerUrl.includes('clash')) return 'clash';
  } catch {
    return 'unknown';
  }
  return 'unknown';
};

const protocol = computed(() => getProtocol(props.misub.url));

const protocolStyle = computed(() => {
  const p = protocol.value;
  switch (p) {
    case 'https': return { text: 'HTTPS', style: 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' };
    case 'clash': return { text: 'CLASH', style: 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20' };
    case 'http': return { text: 'HTTP', style: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20' };
    default: return { text: 'SUB', style: 'bg-gray-500/10 text-gray-500 dark:text-gray-400 border border-gray-500/20' };
  }
});

const trafficInfo = computed(() => {
  const info = props.misub.userInfo;
  const REASONABLE_TRAFFIC_LIMIT_BYTES = 10 * 1024 * 1024 * 1024 * 1024 * 1024; // 10 PB
  if (
    !info ||
    info.total === undefined ||
    info.download === undefined ||
    info.upload === undefined ||
    info.total >= REASONABLE_TRAFFIC_LIMIT_BYTES
  ) {
    return null;
  }  
  const total = info.total;
  const used = info.download + info.upload;
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  return {
    used: formatBytes(used),
    total: formatBytes(total),
    percentage: percentage,
  };
});

const expiryInfo = computed(() => {
    const expireTimestamp = props.misub.userInfo?.expire;
    if (!expireTimestamp) return null;
    const REASONABLE_EXPIRY_LIMIT_DAYS = 365 * 10;
    const expiryDate = new Date(expireTimestamp * TIMING.SECOND_IN_MS);
    const now = new Date();
    expiryDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    if (diffDays > REASONABLE_EXPIRY_LIMIT_DAYS) {
        return null;
    }  
    let style = 'text-gray-500 dark:text-gray-400';
    if (diffDays < 0) style = 'text-red-500 font-bold';
    else if (diffDays <= 7) style = 'text-orange-500 font-semibold';
    return {
        date: expiryDate.toLocaleDateString(),
        daysRemaining: diffDays < 0 ? '已过期' : (diffDays === 0 ? '今天到期' : `${diffDays} 天后`),
        style: style
    };
});
</script>

<template>
  <div 
    class="group relative glass-panel p-5 card-hover flex flex-col h-full min-h-[180px] overflow-hidden"
    :class="{ 
      'opacity-75 grayscale-[0.8]': !misub.enabled,
    }"
  >
    <!-- Background Decor (Optional Subtle Glow) -->
    <div class="absolute -top-10 -right-10 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl group-hover:bg-primary-500/20 transition-all duration-500"></div>

    <div class="relative z-10 flex flex-col h-full">
      <!-- Header -->
      <div class="flex items-start justify-between gap-3 mb-4">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full uppercase" :class="protocolStyle.style">
              {{ protocolStyle.text }}
            </span>
            <span v-if="expiryInfo" class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/5 border border-transparent" :class="expiryInfo.style">
              {{ expiryInfo.daysRemaining }}
            </span>
          </div>
          <h3 class="font-display font-semibold text-lg text-gray-900 dark:text-white truncate leading-tight" :title="misub.name || '未命名订阅'">
            {{ misub.name || '未命名订阅' }}
          </h3>
        </div>
        
<!-- Action Buttons (Visible on Hover/Touch) -->
<div class="flex items-center gap-1 opacity-100 xl:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
<button @click.stop="emit('preview')" class="p-2 rounded-full hover:bg-primary-50 dark:hover:bg-white/10 text-gray-400 hover:text-primary-500 transition-colors" title="预览节点" aria-label="预览节点">
<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
</button>
<button @click.stop="emit('qrcode')" class="p-2 rounded-full hover:bg-primary-50 dark:hover:bg-white/10 text-gray-400 hover:text-primary-500 transition-colors" title="显示二维码" aria-label="显示二维码">
<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
</svg>
</button>
<button @click.stop="emit('edit')" class="p-2 rounded-full hover:bg-primary-50 dark:hover:bg-white/10 text-gray-400 hover:text-primary-500 transition-colors" title="编辑" aria-label="编辑订阅">
<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z" /></svg>
</button>
<button @click.stop="emit('delete')" class="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-500/20 text-gray-400 hover:text-red-500 transition-colors" title="删除" aria-label="删除订阅">
<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
</button>
</div>
      </div>

      <!-- URL Display -->
      <div class="relative group/input mb-3">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
        </div>
        <input type="text" :value="misub.url" readonly class="w-full text-xs text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-black/20 rounded-lg pl-9 pr-3 py-2 border border-transparent focus:border-primary-500/30 focus:bg-white dark:focus:bg-black/40 focus:outline-none transition-all font-mono truncate" />
      </div>

      <!-- Traffic Usage -->
      <div v-if="trafficInfo" class="mt-auto space-y-2">
        <div class="flex justify-between items-end text-xs">
          <span class="text-gray-500 dark:text-gray-400">已用 <span class="font-semibold text-gray-700 dark:text-gray-200">{{ trafficInfo.used }}</span></span>
          <span class="text-gray-400">{{ trafficInfo.total }}</span>
        </div>
        <div class="w-full bg-gray-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div class="bg-gradient-to-r from-primary-400 to-cyan-400 h-full rounded-full transition-all duration-500" :style="{ width: trafficInfo.percentage + '%' }"></div>
        </div>
      </div>
      <div v-else class="mt-auto h-8 flex items-center text-xs text-gray-400">
        暂无流量数据
      </div>

      <!-- Footer Actions -->
      <div class="flex justify-between items-center mt-4 pt-3 border-t border-gray-100 dark:border-white/5">
        
        <!-- Toggle Switch -->
        <!-- Toggle Switch -->
        <Switch 
          v-model="misub.enabled" 
          @change="emit('change')" 
        />

        <!-- Node Count / Update -->
        <div class="flex items-center gap-3">
          <span class="text-xs font-semibold" :class="misub.isUpdating ? 'text-primary-500 animate-pulse' : 'text-gray-600 dark:text-gray-400'">
            {{ misub.isUpdating ? 'Updating...' : `${misub.nodeCount || 0} Nodes` }}
          </span>
          <button @click.stop="emit('update')" :disabled="misub.isUpdating" class="p-1.5 rounded-full hover:bg-primary-50 dark:hover:bg-white/10 text-gray-400 hover:text-primary-500 transition-colors disabled:opacity-50" :title="misub.isUpdating ? '更新中' : '更新节点信息'">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" :class="{'animate-spin text-primary-500': misub.isUpdating}" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

      </div>

      <!-- Notes (Collapsible or Small) -->
      <div v-if="misub.notes" class="mt-2 text-[10px] text-gray-400 truncate flex items-center gap-1">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
        {{ misub.notes }}
      </div>

    </div>
  </div>
</template>


