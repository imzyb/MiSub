// FILE: src/composables/useManualNodes.js
import { ref, computed, watch } from 'vue';
import { getNodeUniqueKey } from '../lib/utils.js';

export function useManualNodes(initialNodesRef, markDirty) {
  const manualNodes = ref([]);
  const manualNodesCurrentPage = ref(1);
  const manualNodesPerPage = 24;

  const searchTerm = ref('');

  // 国家/地区代码到旗帜和中文名称的映射
  const countryCodeMap = {
    'hk': ['🇭🇰', '香港'],
    'tw': ['🇹🇼', '台湾', '臺灣'],
    'sg': ['🇸🇬', '新加坡', '狮城'],
    'jp': ['🇯🇵', '日本'],
    'us': ['🇺🇸', '美国', '美國'],
    'kr': ['🇰🇷', '韩国', '韓國'],
    'gb': ['🇬🇧', '英国', '英國'],
    'de': ['🇩🇪', '德国', '德國'],
    'fr': ['🇫🇷', '法国', '法國'],
    'ca': ['🇨🇦', '加拿大'],
    'au': ['🇦🇺', '澳大利亚', '澳洲', '澳大利亞'],
    'cn': ['🇨🇳', '中国', '大陸', '内地'],
    'my': ['🇲🇾', '马来西亚', '馬來西亞'],
    'th': ['🇹🇭', '泰国', '泰國'],
    'vn': ['🇻🇳', '越南'],
    'ph': ['🇵🇭', '菲律宾', '菲律賓'],
    'id': ['🇮🇩', '印度尼西亚', '印尼'],
    'in': ['🇮🇳', '印度'],
    'pk': ['🇵🇰', '巴基斯坦'],
    'bd': ['🇧🇩', '孟加拉国', '孟加拉國'],
    'ae': ['🇦🇪', '阿联酋', '阿聯酋'],
    'sa': ['🇸🇦', '沙特阿拉伯'],
    'tr': ['🇹🇷', '土耳其'],
    'ru': ['🇷🇺', '俄罗斯', '俄羅斯'],
    'br': ['🇧🇷', '巴西'],
    'mx': ['🇲🇽', '墨西哥'],
    'ar': ['🇦🇷', '阿根廷'],
    'cl': ['🇨🇱', '智利'],
    'za': ['🇿🇦', '南非'],
    'eg': ['🇪🇬', '埃及'],
    'ng': ['🇳🇬', '尼日利亚', '尼日利亞'],
    'ke': ['🇰🇪', '肯尼亚', '肯尼亞'],
    'il': ['🇮🇱', '以色列'],
    'ir': ['🇮🇷', '伊朗'],
    'iq': ['🇮🇶', '伊拉克'],
    'ua': ['🇺🇦', '乌克兰', '烏克蘭'],
    'pl': ['🇵🇱', '波兰', '波蘭'],
    'cz': ['🇨🇿', '捷克'],
    'hu': ['🇭🇺', '匈牙利'],
    'ro': ['🇷🇴', '罗马尼亚', '羅馬尼亞'],
    'gr': ['🇬🇷', '希腊', '希臘'],
    'pt': ['🇵🇹', '葡萄牙'],
    'es': ['🇪🇸', '西班牙'],
    'it': ['🇮🇹', '意大利'],
    'nl': ['🇳🇱', '荷兰', '荷蘭'],
    'be': ['🇧🇪', '比利时', '比利時'],
    'se': ['🇸🇪', '瑞典'],
    'no': ['🇳🇴', '挪威'],
    'dk': ['🇩🇰', '丹麦', '丹麥'],
    'fi': ['🇫🇮', '芬兰', '芬蘭'],
    'ch': ['🇨🇭', '瑞士'],
    'at': ['🇦🇹', '奥地利', '奧地利'],
    'ie': ['🇮🇪', '爱尔兰', '愛爾蘭'],
    'nz': ['🇳🇿', '新西兰', '紐西蘭'],
  };

  function initializeManualNodes(nodesData) {
    manualNodes.value = (nodesData || []).map(node => ({
      ...node,
      id: node.id || crypto.randomUUID(),
      enabled: node.enabled ?? true,
    }));
  }

  // [新增] 根据搜索词过滤节点
  const filteredManualNodes = computed(() => {
    if (!searchTerm.value) {
      return manualNodes.value;
    }
    const lowerCaseSearch = searchTerm.value.toLowerCase();
    
    // 获取可能的替代搜索词
    const alternativeTerms = countryCodeMap[lowerCaseSearch] || [];
    
    return manualNodes.value.filter(node => {
      const nodeNameLower = node.name ? node.name.toLowerCase() : '';
      
      // 检查节点名称是否包含原始搜索词
      if (nodeNameLower.includes(lowerCaseSearch)) {
        return true;
      }
      
      // 检查节点名称是否包含任何替代词
      for (const altTerm of alternativeTerms) {
        if (nodeNameLower.includes(altTerm.toLowerCase())) {
          return true;
        }
      }
      
      return false;
    });
  });
  const manualNodesTotalPages = computed(() => Math.ceil(filteredManualNodes.value.length / manualNodesPerPage));

  // [修改] 分页使用过滤后的节点
  const paginatedManualNodes = computed(() => {
    const start = (manualNodesCurrentPage.value - 1) * manualNodesPerPage;
    const end = start + manualNodesPerPage;
    return filteredManualNodes.value.slice(start, end);
  });
  
  const enabledManualNodes = computed(() => manualNodes.value.filter(n => n.enabled));

  function changeManualNodesPage(page) {
    if (page < 1 || page > manualNodesTotalPages.value) return;
    manualNodesCurrentPage.value = page;
  }  

  function addNode(node) {
    const key = getNodeUniqueKey(node);
    const idx = manualNodes.value.findIndex(n => getNodeUniqueKey(n) === key);
    if (idx !== -1) {
      manualNodes.value[idx] = { ...node, id: manualNodes.value[idx].id }; // 保持原id
    } else {
      manualNodes.value.unshift(node);
    }
    manualNodesCurrentPage.value = 1;
    markDirty();
  }

  function updateNode(updatedNode) {
    const index = manualNodes.value.findIndex(n => n.id === updatedNode.id);
    if (index !== -1) {
      manualNodes.value[index] = updatedNode;
      markDirty();
    }
  }

  function deleteNode(nodeId) {
    manualNodes.value = manualNodes.value.filter(n => n.id !== nodeId);
    if (paginatedManualNodes.value.length === 0 && manualNodesCurrentPage.value > 1) {
      manualNodesCurrentPage.value--;
    }
    markDirty();
  }

  function deleteAllNodes() {
    manualNodes.value = [];
    manualNodesCurrentPage.value = 1;
    markDirty();
  }

  function addNodesFromBulk(nodes) {
    const nodeMap = new Map();
    // 先放入已有节点
    for (const n of manualNodes.value) {
      nodeMap.set(getNodeUniqueKey(n), n);
    }
    // 用新节点覆盖
    for (const n of nodes) {
      nodeMap.set(getNodeUniqueKey(n), n);
    }
    manualNodes.value = Array.from(nodeMap.values());
    markDirty();
  }
  
  function autoSortNodes() {
    const regionKeywords = { HK: [/香港/,/HK/,/Hong Kong/i], TW: [/台湾/,/TW/,/Taiwan/i], SG: [/新加坡/,/SG/,/狮城/,/Singapore/i], JP: [/日本/,/JP/,/Japan/i], US: [/美国/,/US/,/United States/i], KR: [/韩国/,/KR/,/Korea/i], GB: [/英国/,/GB/,/UK/,/United Kingdom/i], DE: [/德国/,/DE/,/Germany/i], FR: [/法国/,/FR/,/France/i], CA: [/加拿大/,/CA/,/Canada/i], AU: [/澳大利亚/,/AU/,/Australia/i], };
    const regionOrder = ['HK', 'TW', 'SG', 'JP', 'US', 'KR', 'GB', 'DE', 'FR', 'CA', 'AU'];
    const getRegionCode = (name) => { for (const code in regionKeywords) { for (const keyword of regionKeywords[code]) { if (keyword.test(name)) return code; } } return 'ZZ'; };
    
    manualNodes.value.sort((a, b) => {
        const regionA = getRegionCode(a.name);
        const regionB = getRegionCode(b.name);
        const indexA = regionOrder.indexOf(regionA);
        const indexB = regionOrder.indexOf(regionB);
        const effectiveIndexA = indexA === -1 ? Infinity : indexA;
        const effectiveIndexB = indexB === -1 ? Infinity : indexB;
        if (effectiveIndexA !== effectiveIndexB) return effectiveIndexA - effectiveIndexB;
        return a.name.localeCompare(b.name, 'zh-CN');
    });
    // [修正] 只標記為 dirty，不呼叫 handleSave
    markDirty();
  }

    // [新增] 监听搜索词变化，重置分页
  watch(searchTerm, () => {
    manualNodesCurrentPage.value = 1;
  });

  watch(initialNodesRef, (newInitialNodes) => {
    initializeManualNodes(newInitialNodes);
  }, { immediate: true, deep: true });

  return {
    manualNodes,
    manualNodesCurrentPage,
    manualNodesTotalPages,
    paginatedManualNodes,
    enabledManualNodesCount: computed(() => enabledManualNodes.value.length),
    searchTerm, // [新增] 导出搜索词
    changeManualNodesPage,
    addNode,
    updateNode,
    deleteNode,
    deleteAllNodes,
    addNodesFromBulk,
    autoSortNodes,
  };
}