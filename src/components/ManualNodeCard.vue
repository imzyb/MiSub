<script setup>
import { computed } from 'vue';

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['delete', 'edit']);

const getProtocol = (url) => {
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
    if (lowerUrl.startsWith('socks5://')) return 'socks5';
    if (lowerUrl.startsWith('http')) return 'http';
  } catch { 
    return 'unknown';
  }
  return 'unknown';
};

const protocol = computed(() => getProtocol(props.node.url));

const protocolStyle = computed(() => {
  const p = protocol.value;
  switch (p) {
    // [更新] 新增 anytls 的樣式
    case 'anytls':
      return { text: 'AnyTLS', style: 'bg-slate-500/20 text-slate-500 dark:text-slate-400' };
    case 'vless':
      return { text: 'VLESS', style: 'bg-blue-500/20 text-blue-500 dark:text-blue-400' };
    case 'hysteria2':
      return { text: 'HY2', style: 'bg-purple-500/20 text-purple-500 dark:text-purple-400' };
    case 'hysteria':
       return { text: 'Hysteria', style: 'bg-fuchsia-500/20 text-fuchsia-500 dark:text-fuchsia-400' };
    case 'tuic':
        return { text: 'TUIC', style: 'bg-cyan-500/20 text-cyan-500 dark:text-cyan-400' };
    case 'trojan':
      return { text: 'TROJAN', style: 'bg-red-500/20 text-red-500 dark:text-red-400' };
    case 'ssr':
      return { text: 'SSR', style: 'bg-rose-500/20 text-rose-500 dark:text-rose-400' };
    case 'ss':
      return { text: 'SS', style: 'bg-orange-500/20 text-orange-500 dark:text-orange-400' };
    case 'vmess':
      return { text: 'VMESS', style: 'bg-teal-500/20 text-teal-500 dark:text-teal-400' };
    case 'socks5':
      return { text: 'SOCKS5', style: 'bg-lime-500/20 text-lime-500 dark:text-lime-400' };
    case 'http':
      return { text: 'HTTP', style: 'bg-green-500/20 text-green-500 dark:text-green-400' };
    default:
      return { text: 'LINK', style: 'bg-gray-500/20 text-gray-500 dark:text-gray-400' };
  }
});
</script>

<template>
  <div 
    class="group bg-white/90 dark:bg-gray-900/80 backdrop-blur-md rounded-xl card-shadow hover:card-shadow-hover p-3 smooth-all hover:-translate-y-0.5 relative flex items-center justify-between gap-3"
    :class="{ 'opacity-50': !node.enabled }"
  >
    <div class="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
      <div 
        class="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
        :class="protocolStyle.style"
      >
        {{ protocolStyle.text }}
      </div>
      <p class="font-medium text-sm text-gray-800 dark:text-gray-100 truncate flex-1 min-w-0" :title="node.name">
        {{ node.name || '未命名节点' }}
      </p>
    </div>

    <div class="shrink-0 flex items-center gap-1 lg:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button @click.stop="emit('edit')" class="p-1.5 rounded-full hover:bg-gray-500/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="编辑节点">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z" /></svg>
        </button>
        <button @click.stop="emit('delete')" class="p-1.5 rounded-full hover:bg-red-500/10 text-gray-400 hover:text-red-500" title="删除节点">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
    </div>
  </div>
</template>