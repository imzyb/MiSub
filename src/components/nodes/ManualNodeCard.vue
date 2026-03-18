<script setup>
import { computed } from 'vue';

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  isSelectionMode: Boolean,
  isSelected: Boolean
});

const emit = defineEmits(['delete', 'edit', 'toggle-select', 'filter-group']);

const getProtocol = (url) => {
  // ... (protocol logic unchanged)
  try {
    if (!url) return 'unknown';
    const lowerUrl = url.toLowerCase();
    // [更新] 新增 anytls 支援
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

const protocolStyle = computed(() => {
  // ... (protocol style map unchanged)
  const p = protocol.value;
  switch (p) {
    case 'anytls': return { text: 'AnyTLS', style: 'bg-slate-500/20 text-slate-500 dark:text-slate-400' };
    case 'vless': return { text: 'VLESS', style: 'bg-blue-500/20 text-blue-500 dark:text-blue-400' };
    case 'hysteria2': return { text: 'HY2', style: 'bg-purple-500/20 text-purple-500 dark:text-purple-400' };
    case 'hysteria': return { text: 'Hysteria', style: 'bg-fuchsia-500/20 text-fuchsia-500 dark:text-fuchsia-400' };
    case 'tuic': return { text: 'TUIC', style: 'bg-cyan-500/20 text-cyan-500 dark:text-cyan-400' };
    case 'trojan': return { text: 'TROJAN', style: 'bg-red-500/20 text-red-500 dark:text-red-400' };
    case 'ssr': return { text: 'SSR', style: 'bg-rose-500/20 text-rose-500 dark:text-rose-400' };
    case 'ss': return { text: 'SS', style: 'bg-orange-500/20 text-orange-500 dark:text-orange-400' };
    case 'vmess': return { text: 'VMESS', style: 'bg-teal-500/20 text-teal-500 dark:text-teal-400' };
    case 'socks5': return { text: 'SOCKS5', style: 'bg-lime-500/20 text-lime-500 dark:text-lime-400' };
    case 'http': return { text: 'HTTP', style: 'bg-green-500/20 text-green-500 dark:text-green-400' };
    case 'snell': return { text: 'SNELL', style: 'bg-indigo-500/20 text-indigo-500 dark:text-indigo-400' };
    case 'naive': return { text: 'NAIVE', style: 'bg-pink-500/20 text-pink-500 dark:text-pink-400' };
    default: return { text: 'LINK', style: 'bg-gray-500/20 text-gray-500 dark:text-gray-400' };
  }
});


</script>

<template>
  <div 
    class="group glass-panel p-3 card-hover relative flex items-center justify-between gap-3 transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/10 min-h-[64px]"
    :class="{ 
        'opacity-50 grayscale': !node.enabled && !isSelectionMode,
        'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/10': isSelectionMode && isSelected,
        'cursor-pointer': isSelectionMode
    }"
    @click="isSelectionMode ? emit('toggle-select') : null"
  >
    <!-- Selection Checkbox -->
    <div v-if="isSelectionMode" class="shrink-0 mr-1">
        <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
             :class="isSelected ? 'bg-primary-500 border-primary-500' : 'border-gray-300 dark:border-gray-600'">
            <svg v-if="isSelected" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
        </div>
    </div>

    <div class="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
      <!-- Group Badge -->
      <div 
        v-if="node.group" 
        class="text-[10px] font-medium px-1.5 py-0.5 misub-radius-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 shrink-0 max-w-[90px] truncate cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" 
        :title="node.group"
        @click.stop="$emit('filter-group', node.group)"
      >
        {{ node.group }}
      </div>
      
      <div 
        class="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
        :class="protocolStyle.style"
      >
        {{ protocolStyle.text }}
      </div>
      <p class="font-medium text-sm text-gray-800 dark:text-gray-100 truncate flex-1 min-w-0" :title="node.name">
        {{ node.name || '未命名节点' }}
      </p>
    </div>

    <div v-if="!isSelectionMode" class="shrink-0 flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
        <button @click.stop="emit('edit')" class="p-1.5 misub-radius-md hover:bg-gray-500/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="编辑节点">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z" /></svg>
        </button>
        <button @click.stop="emit('delete')" class="p-1.5 misub-radius-md hover:bg-red-500/10 text-gray-400 hover:text-red-500" title="删除节点">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
    </div>
  </div>
</template>

