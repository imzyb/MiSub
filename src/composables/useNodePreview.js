/**
 * 节点预览 Composable
 * @author MiSub Team
 */

import { ref, computed, watch } from 'vue';
import { api, APIError } from '@/lib/http.js';

const isDev = import.meta.env.DEV;

export function useNodePreview(props) {
  // 响应式数据
  const loading = ref(false);
  const error = ref('');
  const allNodes = ref([]); // 存储所有节点
  const currentPage = ref(1);
  const pageSize = ref(20);
  const viewMode = ref('list'); // 'list' 或 'card'

  // 响应式视图模式 - 移动端强制卡片视图
  const effectiveViewMode = computed(() => {
    // 检测是否为移动端或中小屏桌面端
    if (typeof window !== 'undefined') {
      const isSmallScreen = window.innerWidth < 1024; // lg 断点
      if (isSmallScreen) {
        return 'card'; // 移动端和中小屏强制使用卡片视图
      }
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

  // 监听筛选条件变化，重置页码
  watch([protocolFilter, regionFilter, searchQuery], () => {
    currentPage.value = 1;
  });

  // 加载节点数据
  const loadNodes = async () => {
    if (!props.show) return;

    loading.value = true;
    error.value = '';

    try {
      const requestData = {
        userAgent: 'MiSub-Node-Preview/1.0'
      };

      if (props.profileId) {
        requestData.profileId = props.profileId;
      } else if (props.subscriptionId) {
        requestData.subscriptionId = props.subscriptionId;
      } else if (props.subscriptionUrl) {
        requestData.url = props.subscriptionUrl;
      } else {
        throw new Error('缺少必要的参数');
      }

      if (isDev) {
        console.debug('Sending API request with data:', requestData);
      }

      const data = await api.post('/api/subscription_nodes', requestData);

      if (!data.success) {
        throw new Error(data.error || '获取节点失败');
      }

      allNodes.value = data.nodes || [];
      protocolStats.value = data.stats?.protocols || {};
      regionStats.value = data.stats?.regions || {};

      // 更新可用筛选选项
      availableProtocols.value = Object.keys(protocolStats.value).sort();
      availableRegions.value = Object.keys(regionStats.value).sort();

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

  // 重置过滤器
  const resetFilters = () => {
    currentPage.value = 1;
    protocolFilter.value = 'all';
    regionFilter.value = 'all';
    searchQuery.value = '';
  };

  // 分页控件
  const nextPage = () => {
    if (currentPage.value < totalPages.value) {
      currentPage.value++;
    }
  };

  const prevPage = () => {
    if (currentPage.value > 1) {
      currentPage.value--;
    }
  };

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page;
    }
  };

  // 更新视图模式
  const updateViewMode = (mode) => {
    viewMode.value = mode;
  };

  return {
    // 状态
    loading,
    error,
    allNodes,
    filteredNodes,
    paginatedNodes,
    protocolStats,
    regionStats,
    availableProtocols,
    availableRegions,
    currentPage,
    pageSize,
    totalPages,
    protocolFilter,
    regionFilter,
    searchQuery,
    viewMode,
    effectiveViewMode,
    title,
    copiedNodeId,

    // 方法
    loadNodes,
    copyNodeUrl,
    resetFilters,
    nextPage,
    prevPage,
    goToPage,
    updateViewMode
  };
}
