<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { api, APIError } from '../../../lib/http.js';
import NodeFilters from './components/NodeFilters.vue';
import NodeList from './components/NodeList.vue';
import NodeCard from './components/NodeCard.vue';
import NodePagination from './components/NodePagination.vue';

const isDev = import.meta.env.DEV;

const props = defineProps({
  show: Boolean,
  // 订阅信息
  subscriptionId: String,
  subscriptionName: String,
  subscriptionUrl: String,
  profileId: String,
  profileName: String,
  apiEndpoint: {
    type: String,
    default: '/api/subscription_nodes'
  }
});

const emit = defineEmits(['update:show']);

// 响应式数据
const loading = ref(false);
const error = ref('');
const allNodes = ref([]); // 存储所有节点
const currentPage = ref(1);
const pageSize = ref(24);
const viewMode = ref('list'); // 'list' 或 'card'
const showProcessed = ref(true); // 是否显示处理后的节点名称（默认显示处理后结果）

// 响应式视图模式 - 移动端强制卡片视图
const effectiveViewMode = computed(() => {
  // 检测是否为移动端或中小屏桌面端
  const isSmallScreen = window.innerWidth < 1024; // lg 断点
  if (isSmallScreen) {
    return 'card'; // 移动端和中小屏强制使用卡片视图
  }
  return viewMode.value;
});

// 筛选条件
const protocolFilter = ref('all');
const regionFilter = ref('all');
const searchQuery = ref('');

// 统计信息
const protocolStats = ref({});
const regionStats = ref({});
const availableProtocols = ref([]);
const availableRegions = ref([]);

// 复制状态
const copiedNodeId = ref('');

// 计算属性
const title = computed(() => {
  if (props.profileName) {
    return `订阅组节点预览 - ${props.profileName}`;
  }
  return `订阅节点预览 - ${props.subscriptionName || '未知订阅'}`;
});

// 过滤后的节点
const filteredNodes = computed(() => {
  let result = allNodes.value;

  // 协议过滤
  if (protocolFilter.value && protocolFilter.value !== 'all') {
    result = result.filter(node => node.protocol === protocolFilter.value);
  }

  // 地区过滤
  if (regionFilter.value && regionFilter.value !== 'all') {
    result = result.filter(node => node.region === regionFilter.value);
  }

  // 搜索过滤
  if (searchQuery.value && searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim();
    result = result.filter(node =>
      node.name.toLowerCase().includes(query) ||
      node.protocol.toLowerCase().includes(query) ||
      node.region.toLowerCase().includes(query)
    );
  }

  return result;
});

// 当前页显示的节点
const paginatedNodes = computed(() => {
  const result = filteredNodes.value;
  const startIndex = (currentPage.value - 1) * pageSize.value;
  const endIndex = startIndex + pageSize.value;
  return result.slice(startIndex, endIndex);
});

// 分页信息
const totalPages = computed(() => {
  return Math.ceil(filteredNodes.value.length / pageSize.value);
});

// 总节点数（过滤后）
const filteredTotalCount = computed(() => {
  return filteredNodes.value.length;
});

// 监听弹窗显示状态
watch(() => props.show, (newVal) => {
  if (newVal) {
    loadNodes();
  } else {
    // 重置状态
    currentPage.value = 1;
    protocolFilter.value = 'all';
    regionFilter.value = 'all';
    searchQuery.value = '';
    showProcessed.value = false;  // 重置处理开关
    error.value = '';
    allNodes.value = [];
  }
});

onMounted(() => {
  if (props.show) {
    loadNodes();
  }
  window.addEventListener('keydown', handleKeydown);
});

// 监听筛选条件变化，重置页码
watch([protocolFilter, regionFilter, searchQuery], () => {
  currentPage.value = 1;
});

// 监听 showProcessed 变化，重新加载节点
watch(showProcessed, () => {
  loadNodes();
});

// 加载节点数据
const loadNodes = async () => {
  if (!props.show) return;

  loading.value = true;
  error.value = '';

  try {
    const requestData = {
      userAgent: 'v2rayN/7.23'
    };

    if (props.profileId) {
      requestData.profileId = props.profileId;
      // 仅在订阅组模式下传递 applyTransform 参数
      requestData.applyTransform = showProcessed.value;
    } else if (props.subscriptionId) {
      requestData.subscriptionId = props.subscriptionId;
    } else if (props.subscriptionUrl) {
      requestData.url = props.subscriptionUrl;
    } else {
      throw new Error('缺少必要的参数');
    }

    if (isDev) {
      console.debug('[Preview] Sending request to:', props.apiEndpoint, requestData);
    }

    const data = await api.post(props.apiEndpoint, requestData);
    if (isDev) {
      console.debug('[Preview] Data received:', data);
    }

    if (!data.success) {
      throw new Error(data.error || '获取节点失败');
    }

    allNodes.value = data.nodes || [];
    protocolStats.value = data.stats?.protocols || {};
    regionStats.value = data.stats?.regions || {};

    // 更新可用筛选选项
    // 协议类型按常见程度排序
    const protocolOrder = ['vmess', 'vless', 'trojan', 'ss', 'ssr', 'hysteria2', 'tuic', 'socks5', 'anytls', 'unknown'];
    availableProtocols.value = Object.keys(protocolStats.value).sort((a, b) => {
      const aIndex = protocolOrder.indexOf(a.toLowerCase());
      const bIndex = protocolOrder.indexOf(b.toLowerCase());
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    // 地区按常见地区优先排序
    const regionOrder = ['香港', '台湾', '新加坡', '日本', '美国', '韩国', '英国', '德国', '法国', '加拿大', '澳大利亚', '其他'];
    availableRegions.value = Object.keys(regionStats.value).sort((a, b) => {
      const aIndex = regionOrder.indexOf(a);
      const bIndex = regionOrder.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    // 重置页码
    currentPage.value = 1;

  } catch (err) {
    // 提供更友好的错误信息
    if (err instanceof APIError && err.status === 401) {
      try {
        await api.get('/api/data');
        error.value = '认证异常，请刷新页面后重试';
      } catch (testErr) {
        error.value = '认证失败，请重新登录后再试';
      }
    } else if (err.message.includes('网络')) {
      error.value = '网络连接失败，请检查网络连接';
    } else {
      error.value = err.message || '加载节点失败';
    }

    allNodes.value = [];
  } finally {
    loading.value = false;
  }
};

// 复制节点链接
const copyNodeUrl = async (node, nodeId) => {
  try {
    await navigator.clipboard.writeText(node.url);
    copiedNodeId.value = nodeId;
    setTimeout(() => {
      copiedNodeId.value = '';
    }, 2000);
  } catch (err) {
    // 降级方案
    const textArea = document.createElement('textarea');
    textArea.value = node.url;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    copiedNodeId.value = nodeId;
    setTimeout(() => {
      copiedNodeId.value = '';
    }, 2000);
  }
};

// 获取协议类型的显示样式
const getProtocolStyle = (protocol) => {
  const styles = {
    vmess: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    vless: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    trojan: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    ss: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    ssr: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    hysteria2: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    hy2: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    tuic: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    socks5: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    anytls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    unknown: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  };
  return styles[protocol] || styles.unknown;
};

// 获取地区 Emoji
const getRegionEmoji = (region) => {
  if (!region) return '🌐';
  
  // 常见国家/地区映射
  const regionMap = {
    'HK': '🇭🇰', 'Hong Kong': '🇭🇰', '香港': '🇭🇰',
    'TW': '🇨🇳', 'Taiwan': '🇨🇳', '台湾': '🇨🇳',
    'JP': '🇯🇵', 'Japan': '🇯🇵', '日本': '🇯🇵',
    'US': '🇺🇸', 'United States': '🇺🇸', '美国': '🇺🇸',
    'SG': '🇸🇬', 'Singapore': '🇸🇬', '新加坡': '🇸🇬',
    'KR': '🇰🇷', 'Korea': '🇰🇷', '韩国': '🇰🇷',
    'UK': '🇬🇧', 'United Kingdom': '🇬🇧', '英国': '🇬🇧',
    'DE': '🇩🇪', 'Germany': '🇩🇪', '德国': '🇩🇪',
    'FR': '🇫🇷', 'France': '🇫🇷', '法国': '🇫🇷',
    'RU': '🇷🇺', 'Russia': '🇷🇺', '俄罗斯': '🇷🇺',
    'CA': '🇨🇦', 'Canada': '🇨🇦', '加拿大': '🇨🇦',
    'MO': '🇲🇴', 'Macao': '🇲🇴', '澳门': '🇲🇴',
    'CN': '🇨🇳', 'China': '🇨🇳', '中国': '🇨🇳',
    'IN': '🇮🇳', 'India': '🇮🇳', '印度': '🇮🇳',
    'NL': '🇳🇱', 'Netherlands': '🇳🇱', '荷兰': '🇳🇱',
    'AU': '🇦🇺', 'Australia': '🇦🇺', '澳大利亚': '🇦🇺',
    'TH': '🇹🇭', 'Thailand': '🇹🇭', '泰国': '🇹🇭',
    'VN': '🇻🇳', 'Vietnam': '🇻🇳', '越南': '🇻🇳',
    'ID': '🇮🇩', 'Indonesia': '🇮🇩', '印尼': '🇮🇩',
    'MY': '🇲🇾', 'Malaysia': '🇲🇾', '马来西亚': '🇲🇾',
    'PH': '🇵🇭', 'Philippines': '🇵🇭', '菲律宾': '🇵🇭',
    'TR': '🇹🇷', 'Turkey': '🇹🇷', '土耳其': '🇹🇷',
  };

  if (regionMap[region]) return regionMap[region];
  
  // 尝试在字符串中查找 Emoji
  const emojiMatch = region.match(/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
  if (emojiMatch) return emojiMatch[0];

  return '🌐';
};

// 解析节点信息
const parseNodeInfo = (node) => {
  const result = {
    name: node.name,
    server: node.server || '',
    port: node.port || '',
    protocol: node.protocol,
    region: node.region
  };

  // 如果后端已经返回了服务器和端口，直接使用，不再前端解析
  if (result.server && result.port) {
      return result;
  }

  try {
    const url = new URL(node.url);
    result.server = url.hostname || '';
    result.port = url.port || '';

    // 对于vmess协议，需要特殊处理
    if (node.protocol === 'vmess') {
      try {
        const base64Part = node.url.substring('vmess://'.length);
        const binaryString = atob(base64Part);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const jsonString = new TextDecoder('utf-8').decode(bytes);
        const nodeConfig = JSON.parse(jsonString);
        result.server = nodeConfig.add || result.server;
        result.port = nodeConfig.port || result.port;
      } catch (e) {
        if (isDev) {
          console.debug('[Preview] VMess parse failed, using URL fallback:', e);
        }
      }
    }
  } catch (e) {
    if (isDev) {
      console.debug('[Preview] URL parse failed, falling back to regex:', e);
    }
    const match = node.url.match(/@([^:\/]+):(\d+)/);
    if (match) {
      result.server = match[1];
      result.port = match[2];
    }
  }

  return result;
};

// 分页控件
const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
};

// 键盘事件处理
const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    emit('update:show', false);
  }
};
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
    @click="$emit('update:show', false)"
  >
    <div
      class="bg-white dark:bg-gray-800 misub-radius-lg shadow-2xl w-full text-left ring-1 ring-black/5 dark:ring-white/10 flex flex-col max-h-[95vh] max-w-none mx-4 sm:mx-auto sm:max-w-5xl"
      @click.stop
    >
      <!-- 标题栏 -->
      <div class="p-6 pb-4 shrink-0 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">
            {{ title }}
          </h3>
          <button
            @click="$emit('update:show', false)"
            class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- 统计信息 -->
      <div v-if="!loading && !error && Object.keys(protocolStats).length > 0" class="px-4 sm:px-6 py-2 sm:py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
        <!-- 桌面端统计布局 -->
        <div class="hidden lg:grid grid-cols-4 gap-4">
          <div class="text-center">
            <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ allNodes.length }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">总节点数</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ Object.keys(protocolStats).length }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">协议类型</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ Object.keys(regionStats).length }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">地区数量</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ totalPages }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">总页数</div>
          </div>
        </div>

        <!-- 移动端统计布局 (彩色标签) -->
        <div class="lg:hidden grid grid-cols-4 gap-2 text-xs">
          <div class="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded px-2 py-1 text-center">
            <div class="font-bold">{{ allNodes.length }}</div>
            <div class="scale-90 opacity-80">节点</div>
          </div>
          <div class="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded px-2 py-1 text-center">
             <div class="font-bold">{{ Object.keys(protocolStats).length }}</div>
             <div class="scale-90 opacity-80">协议</div>
          </div>
          <div class="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded px-2 py-1 text-center">
             <div class="font-bold">{{ Object.keys(regionStats).length }}</div>
             <div class="scale-90 opacity-80">地区</div>
          </div>
          <div class="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded px-2 py-1 text-center">
             <div class="font-bold">{{ totalPages }}</div>
             <div class="scale-90 opacity-80">页数</div>
          </div>
        </div>
      </div>

      <!-- 筛选控件 - 统一响应式布局 -->
      <NodeFilters
        v-if="!loading && !error && Object.keys(protocolStats).length > 0"
        class="px-3 sm:px-6 py-2 sm:py-4 border-b border-gray-200 dark:border-gray-700"
        :search-query="searchQuery"
        :protocol-filter="protocolFilter"
        :region-filter="regionFilter"
        :view-mode="viewMode"
        :show-processed="showProcessed"
        :available-protocols="availableProtocols"
        :available-regions="availableRegions"
        :profile-id="profileId"
        :api-endpoint="apiEndpoint"
        @update:search-query="searchQuery = $event"
        @update:protocol-filter="protocolFilter = $event"
        @update:region-filter="regionFilter = $event"
        @update:view-mode="viewMode = $event"
        @update:show-processed="showProcessed = $event"
      />

      <!-- 节点列表 -->
      <div class="flex-1 overflow-hidden" style="min-height: 0;">
        <div class="h-full overflow-y-auto px-4 sm:px-6 py-4" style="max-height: calc(95vh - 320px);">
          <!-- 加载状态 -->
          <div v-if="loading" class="flex items-center justify-center h-64">
            <div class="text-center">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p class="mt-4 text-sm text-gray-500 dark:text-gray-400">正在加载节点信息...</p>
            </div>
          </div>

          <!-- 错误状态 -->
          <div v-else-if="error" class="flex items-center justify-center h-64">
            <div class="text-center">
              <svg class="mx-auto h-12 w-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p class="mt-4 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
              <button
                @click="loadNodes"
                class="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm misub-radius-md transition-colors"
              >
                重试
              </button>
            </div>
          </div>

          <!-- 无数据状态 -->
          <div v-else-if="paginatedNodes.length === 0" class="flex items-center justify-center h-64">
            <div class="text-center">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p class="mt-4 text-sm text-gray-500 dark:text-gray-400">未找到符合条件的节点</p>
            </div>
          </div>

          <!-- 节点列表/卡片视图 -->
          <div v-else class="h-full flex flex-col">
            <!-- 简洁列表视图 (仅大屏桌面端) -->
            <NodeList
              v-if="effectiveViewMode === 'list'"
              :nodes="paginatedNodes"
              :copied-node-id="copiedNodeId"
              :parse-node-info="parseNodeInfo"
              :get-protocol-style="getProtocolStyle"
              @copy="copyNodeUrl"
            />

            <!-- 卡片视图 container -->
            <NodeCard
              v-else
              :nodes="paginatedNodes"
              :copied-node-id="copiedNodeId"
              :parse-node-info="parseNodeInfo"
              :get-protocol-style="getProtocolStyle"
              @copy="copyNodeUrl"
            />
          </div>
        </div>
      </div>

      <NodePagination
        v-if="!loading && !error"
        :current-page="currentPage"
        :total-pages="totalPages"
        :page-size="pageSize"
        :total-items="filteredTotalCount"
        @go-to-page="goToPage"
      />
    </div>
  </div>
</template>
