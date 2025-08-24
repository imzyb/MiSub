<script setup>
import { computed, ref } from 'vue';
import Modal from './Modal.vue';

const props = defineProps({
  misub: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['delete', 'change', 'update', 'edit']);

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
    case 'https': return { text: 'HTTPS', style: 'bg-green-500/20 text-green-500 dark:text-green-400' };
    case 'clash': return { text: 'CLASH', style: 'bg-sky-500/20 text-sky-500 dark:text-sky-400' };
    case 'http': return { text: 'HTTP', style: 'bg-gray-500/20 text-gray-500 dark:text-gray-400' };
    default: return { text: 'SUB', style: 'bg-gray-500/20 text-gray-500 dark:text-gray-400' };
  }
});

const formatBytes = (bytes, decimals = 2) => {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

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
    const expiryDate = new Date(expireTimestamp * 1000);
    const now = new Date();
    expiryDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    if (diffDays > REASONABLE_EXPIRY_LIMIT_DAYS) {
        return null;
    }  
    let style = 'text-gray-500 dark:text-gray-400';
    if (diffDays < 0) style = 'text-red-500 font-bold';
    else if (diffDays <= 7) style = 'text-yellow-500 font-semibold';
    return {
        date: expiryDate.toLocaleDateString(),
        daysRemaining: diffDays < 0 ? '已过期' : (diffDays === 0 ? '今天到期' : `${diffDays} 天后`),
        style: style
    };
});

const showCacheModal = ref(false);
function decodeMaybeBase64ToUtf8(input) {
  try {
    const cleaned = input.replace(/\s/g, '');
    if (cleaned.length > 20 && /^[A-Za-z0-9+/=]+$/.test(cleaned)) {
      const binaryString = atob(cleaned);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    }
  } catch {}
  return input;
}

const cachePreview = computed(() => {
  const raw = props.misub.cachedRaw || '';
  if (!raw) return '';
  const decoded = decodeMaybeBase64ToUtf8(raw);
  return decoded.length > 2000 ? decoded.slice(0, 2000) + '\n...（已截断）' : decoded;
});

const cachedLinesCount = computed(() => {
  const raw = props.misub.cachedRaw || '';
  const present = props.misub.cachedRawPresent ?? (raw && raw.length > 0);
  if (!present) return null;
  const decoded = decodeMaybeBase64ToUtf8(raw);
  const nodeRegex = /^(ss|ssr|vmess|vless|trojan|hysteria2?|hy|hy2|tuic|anytls|socks5):\/\//m;
  const count = decoded
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => nodeRegex.test(l)).length;
  return count;
});

const copyCache = async () => {
  try {
    await navigator.clipboard.writeText(props.misub.cachedRaw || '');
  } catch {}
};

</script>

<template>
  <div 
    class="group bg-white dark:bg-gray-900/60 backdrop-blur-xs rounded-2xl shadow-lg dark:shadow-2xl ring-1 ring-black/5 p-4 transition-all duration-300 hover:-translate-y-0.5 flex flex-col h-full min-h-[175px]"
    :class="{ 'opacity-50': !misub.enabled, 'ring-indigo-500/50': misub.isNew }"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="w-full truncate">
        <div class="flex items-center gap-2 mb-1">
          <div class="text-xs font-bold px-2 py-0.5 rounded-full shrink-0" :class="protocolStyle.style">
            {{ protocolStyle.text }}
          </div>
        </div>
        <p class="font-bold text-lg text-gray-800 dark:text-gray-100 truncate" :title="misub.name || '未命名订阅'">
          {{ misub.name || '未命名订阅' }}
        </p>
      </div>
      
        <div class="shrink-0 flex items-center gap-1 lg:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button @click="emit('edit')" class="p-1.5 rounded-full hover:bg-gray-500/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="编辑"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z" /></svg></button>
          <button @click="emit('delete')" class="p-1.5 rounded-full hover:bg-red-500/10 text-gray-400 hover:text-red-500" title="删除"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
      </div>
    </div>
    
    <div class="mt-2 grow flex flex-col justify-center space-y-2">
      <input type="text" :value="misub.url" readonly class="w-full text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50 rounded-lg px-3 py-2 focus:outline-hidden font-mono" />
      <div class="flex items-center gap-2 mt-1 text-xs">
        <span :class="(misub.cachedRawPresent ?? (misub.cachedRaw && misub.cachedRaw.length > 0)) ? 'text-green-600 dark:text-green-400' : 'text-gray-400'">
          {{ (misub.cachedRawPresent ?? (misub.cachedRaw && misub.cachedRaw.length > 0)) ? '缓存可用' : '无缓存' }}
        </span>
        <span v-if="cachedLinesCount !== null" class="text-gray-400">· {{ cachedLinesCount }} 行</span>
        <span v-if="misub.cachedAt" class="text-gray-400">· {{ new Date(misub.cachedAt).toLocaleString() }}</span>
      </div>
      <div v-if="trafficInfo" class="space-y-1 pt-1">
        <div class="flex justify-between text-xs font-mono"><span class="text-gray-600 dark:text-gray-400">{{ trafficInfo.used }}</span><span class="text-gray-600 dark:text-gray-400">{{ trafficInfo.total }}</span></div>
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5"><div class="bg-linear-to-r from-blue-500 to-indigo-600 h-1.5 rounded-full" :style="{ width: trafficInfo.percentage + '%' }"></div></div>
      </div>
    </div>

    <div class="flex justify-between items-center mt-3">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500 dark:text-gray-400">启用</span>
            <label class="relative inline-flex items-center cursor-pointer" title="启用/禁用此订阅">
              <input type="checkbox" v-model="misub.enabled" @change="emit('change')" class="sr-only peer">
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-indigo-600 dark:peer-checked:bg-green-600"></div>
            </label>
          </div>
          <div v-if="protocol === 'http' || protocol === 'https'" class="flex items-center gap-2">
            <span class="text-xs text-gray-500 dark:text-gray-400">实时</span>
            <label class="relative inline-flex items-center cursor-pointer" title="聚合访问时是否实时拉取上游">
              <input type="checkbox" v-model="misub.realtimeFetch" @change="emit('change')" class="sr-only peer">
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-indigo-600 dark:peer-checked:bg-green-600"></div>
            </label>
          </div>
          <span v-if="expiryInfo" class="text-xs font-medium" :class="expiryInfo.style">{{ expiryInfo.daysRemaining }}</span>
        </div>
      <div class="flex items-center space-x-3">
        <span class="text-sm font-semibold" :class="misub.isUpdating ? 'text-yellow-500 animate-pulse' : 'text-gray-700 dark:text-gray-300'">{{ misub.isUpdating ? '更新中...' : `${misub.nodeCount} Nodes` }}</span>
        <button @click="emit('update')" :disabled="misub.isUpdating" class="text-gray-400 hover:text-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="更新节点数和流量"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" :class="{'animate-spin': misub.isUpdating}" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" /></svg></button>
        <button @click="showCacheModal = true" :disabled="!(misub.cachedRawPresent ?? (misub.cachedRaw && misub.cachedRaw.length > 0))" class="text-gray-400 hover:text-indigo-500 transition-colors disabled:opacity-40" title="查看缓存"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5c-7.633 0-11 7-11 7s3.367 7 11 7 11-7 11-7-3.367-7-11-7zm0 12a5 5 0 110-10 5 5 0 010 10zm0-2a3 3 0 100-6 3 3 0 000 6z"/></svg></button>
      </div>
    </div>

    <Modal v-model:show="showCacheModal" :size="'2xl'">
      <template #title>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">查看缓存</h3>
          <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{{ misub.cachedAt ? new Date(misub.cachedAt).toLocaleString() : '无时间' }}</span>
            <button class="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700" @click="copyCache">复制</button>
          </div>
        </div>
      </template>
      <template #body>
        <pre class="text-xs leading-5 whitespace-pre-wrap max-h-[60vh] overflow-auto bg-gray-50 dark:bg-gray-900/40 p-3 rounded">{{ cachePreview }}</pre>
      </template>
    </Modal>
  </div>
</template>
