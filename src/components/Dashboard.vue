<script setup>
import { ref, computed, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
import draggable from 'vuedraggable';
import { saveMisubs } from '../lib/api.js';
import { extractNodeName, getNodeUniqueKey, parseVlessLink } from '../lib/utils.js'; // 确保已导入
import { useToastStore } from '../stores/toast.js';
import { useUIStore } from '../stores/ui.js';
import { useSubscriptions } from '../composables/useSubscriptions.js';
import { useManualNodes } from '../composables/useManualNodes.js';

// --- 元件導入 ---
import Card from './Card.vue';
import ManualNodeCard from './ManualNodeCard.vue';
import RightPanel from './RightPanel.vue';
import ProfileCard from './ProfileCard.vue';
import ManualNodeList from './ManualNodeList.vue'; 

const SettingsModal = defineAsyncComponent(() => import('./SettingsModal.vue'));
const BulkImportModal = defineAsyncComponent(() => import('./BulkImportModal.vue'));
const Modal = defineAsyncComponent(() => import('./Modal.vue'));
const ProfileModal = defineAsyncComponent(() => import('./ProfileModal.vue'));

// --- 基礎 Props 和狀態 ---
const props = defineProps({ data: Object });
const { showToast } = useToastStore();
const uiStore = useUIStore();
const isLoading = ref(true);
const dirty = ref(false);
const saveState = ref('idle');

// --- 將狀態和邏輯委託給 Composables ---
const markDirty = () => { dirty.value = true; saveState.value = 'idle'; };
const initialSubs = ref([]);
const initialNodes = ref([]);

const {
  subscriptions, subsCurrentPage, subsTotalPages, paginatedSubscriptions, totalRemainingTraffic,
  changeSubsPage, addSubscription, updateSubscription, deleteSubscription, deleteAllSubscriptions,
  addSubscriptionsFromBulk, handleUpdateNodeCount,
} = useSubscriptions(initialSubs, markDirty);

const {
  manualNodes, manualNodesCurrentPage, manualNodesTotalPages, paginatedManualNodes, searchTerm,
  changeManualNodesPage, addNode, updateNode, deleteNode, deleteAllNodes,
  addNodesFromBulk, autoSortNodes,
} = useManualNodes(initialNodes, markDirty);

// --- 訂閱組 (Profile) 相關狀態 ---
const profiles = ref([]);
const config = ref({});
const isNewProfile = ref(false);
const editingProfile = ref(null);
const showProfileModal = ref(false);
const showDeleteProfilesModal = ref(false);

// --- 排序狀態 ---
const isSortingSubs = ref(false);
const isSortingNodes = ref(false);

const manualNodeViewMode = ref('card');

// --- 編輯專用模態框狀態 ---
const editingSubscription = ref(null);
const isNewSubscription = ref(false);
const showSubModal = ref(false);

const editingNode = ref(null);
const isNewNode = ref(false);
const showNodeModal = ref(false);

// --- 其他模態框和菜單狀態 ---
const showBulkImportModal = ref(false);
const showDeleteSubsModal = ref(false);
const showDeleteNodesModal = ref(false);
const showSubsMoreMenu = ref(false);
const showNodesMoreMenu = ref(false);
const showProfilesMoreMenu = ref(false);

const nodesMoreMenuRef = ref(null);
const subsMoreMenuRef = ref(null);
const handleClickOutside = (event) => {
  if (showNodesMoreMenu.value && nodesMoreMenuRef.value && !nodesMoreMenuRef.value.contains(event.target)) {
    showNodesMoreMenu.value = false;
  }
  if (showSubsMoreMenu.value && subsMoreMenuRef.value && !subsMoreMenuRef.value.contains(event.target)) {
    showSubsMoreMenu.value = false;
  }
};

// --- 初始化與生命週期 ---
const initializeState = () => {
  isLoading.value = true;
  if (props.data) {
    const subsData = props.data.misubs || [];
    initialSubs.value = subsData.filter(item => item.url && /^https?:\/\//.test(item.url));
    initialNodes.value = subsData.filter(item => !item.url || !/^https?:\/\//.test(item.url));
    
    profiles.value = (props.data.profiles || []).map(p => ({
        ...p,
        id: p.id || crypto.randomUUID(),
        enabled: p.enabled ?? true,
        subscriptions: p.subscriptions || [],
        manualNodes: p.manualNodes || [],
        customId: p.customId || ''
    }));
    config.value = props.data.config || {};
  }
  isLoading.value = false;
  dirty.value = false;
};

const handleBeforeUnload = (event) => {
  if (dirty.value) {
    event.preventDefault();
    event.returnValue = '您有未保存的更改，確定要離開嗎？';
  }
};

onMounted(() => {
  initializeState();
  window.addEventListener('beforeunload', handleBeforeUnload);
  const savedViewMode = localStorage.getItem('manualNodeViewMode');
  if (savedViewMode) {
    manualNodeViewMode.value = savedViewMode;
  }
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
  document.removeEventListener('click', handleClickOutside);
});

const setViewMode = (mode) => {
    manualNodeViewMode.value = mode;
    localStorage.setItem('manualNodeViewMode', mode);
};

// --- 其他 JS 邏輯 (省略) ---
const handleDiscard = () => {
  initializeState();
  showToast('已放弃所有未保存的更改');
};
const handleSave = async () => {
  saveState.value = 'saving';
  const combinedMisubs = [
      ...subscriptions.value.map(sub => ({ ...sub, isUpdating: undefined })),
      ...manualNodes.value.map(node => ({ ...node, isUpdating: undefined }))
  ];
  try {
    const result = await saveMisubs(combinedMisubs, profiles.value);
    if (result.success) {
        saveState.value = 'success';
        setTimeout(() => { dirty.value = false; saveState.value = 'idle'; }, 1500);
    } else {
        throw new Error(result.message || '保存失败');
    }
  } catch (error) {
    showToast(error.message, 'error');
    saveState.value = 'idle';
  }
};
const handleDeleteSubscriptionWithCleanup = (subId) => {
  deleteSubscription(subId);
  profiles.value.forEach(p => {
    p.subscriptions = p.subscriptions.filter(id => id !== subId);
  });
};
const handleDeleteNodeWithCleanup = (nodeId) => {
  deleteNode(nodeId);
  profiles.value.forEach(p => {
    p.manualNodes = p.manualNodes.filter(id => id !== nodeId);
  });
};
const handleDeleteAllSubscriptionsWithCleanup = () => {
  deleteAllSubscriptions();
  profiles.value.forEach(p => {
    p.subscriptions = [];
  });
  showDeleteSubsModal.value = false;
};
const handleDeleteAllNodesWithCleanup = () => {
  deleteAllNodes();
  profiles.value.forEach(p => {
    p.manualNodes = [];
  });
  showDeleteNodesModal.value = false;
};
const handleAutoSortNodes = () => {
    autoSortNodes();
    showToast('已按地区排序！正在为您自动保存...', 'success');
    handleSave();
};
const handleBulkImport = (importText) => {
  if (!importText) return;
  const lines = importText.split('\n').map(line => line.trim()).filter(Boolean);
  const newSubs = [], newNodes = [];
  for (const line of lines) {
      const newItem = { id: crypto.randomUUID(), name: extractNodeName(line) || '未命名', url: line, enabled: true, status: 'unchecked' };
      if (/^https?:\/\//.test(line)) {
          newSubs.push(newItem);
      } else if (/^(ss|ssr|vmess|vless|trojan|hysteria2?|hy|hy2|tuic|anytls):\/\//.test(line)) {
          newNodes.push(newItem);
      }
  }
  if (newSubs.length > 0) addSubscriptionsFromBulk(newSubs);
  if (newNodes.length > 0) addNodesFromBulk(newNodes);
  showToast(`成功导入 ${newSubs.length} 条订阅和 ${newNodes.length} 个手动节点，请点击保存`, 'success');
};
const handleAddSubscription = () => {
  isNewSubscription.value = true;
  editingSubscription.value = { name: '', url: '', enabled: true };
  showSubModal.value = true;
};
const handleEditSubscription = (subId) => {
  const sub = subscriptions.value.find(s => s.id === subId);
  if (sub) {
    isNewSubscription.value = false;
    editingSubscription.value = { ...sub };
    showSubModal.value = true;
  }
};
const handleSaveSubscription = () => {
  if (!editingSubscription.value || !editingSubscription.value.url) { showToast('订阅链接不能为空', 'error'); return; }
  if (!/^https?:\/\//.test(editingSubscription.value.url)) { showToast('请输入有效的 http:// 或 https:// 订阅链接', 'error'); return; }
  
  if (isNewSubscription.value) {
    addSubscription({ ...editingSubscription.value, id: crypto.randomUUID() });
  } else {
    updateSubscription(editingSubscription.value);
  }
  showSubModal.value = false;
};
const handleAddNode = () => {
  isNewNode.value = true;
  editingNode.value = { id: crypto.randomUUID(), name: '', url: '', enabled: true };
  showNodeModal.value = true;
};
const handleEditNode = (nodeId) => {
  const node = manualNodes.value.find(n => n.id === nodeId);
  if (node) {
    isNewNode.value = false;
    editingNode.value = { ...node };
    showNodeModal.value = true;
  }
};
const handleNodeUrlInput = (event) => {
  if (!editingNode.value) return;
  const newUrl = event.target.value;
  if (newUrl && !editingNode.value.name) {
    editingNode.value.name = extractNodeName(newUrl);
  }
};
const handleSaveNode = () => {
  if (!editingNode.value || !editingNode.value.url) {
    showToast('节点链接不能为空', 'error');
    return;
  }
  // 自动补全字段
  let node = { ...editingNode.value };
  if (node.url.startsWith('vless://')) {
    const parsed = parseVlessLink(node.url);
    if (parsed) {
      node.protocol = parsed.protocol;
      node.type = parsed.type;
      node.sni = parsed.sni;
      node.security = parsed.security;
    }
  }
  // 查找是否有重复节点
  const key = getNodeUniqueKey(node);
  const existIdx = manualNodes.value.findIndex(n => getNodeUniqueKey(n) === key);

  if (existIdx !== -1) {
    // 替换（保留原 id）
    node.id = manualNodes.value[existIdx].id;
    updateNode(node);
    showToast('已替换重复节点', 'success');
  } else {
    // 新增
    addNode({ ...node, id: crypto.randomUUID() });
    showToast('已添加新节点', 'success');
  }
  showNodeModal.value = false;
};
const handleProfileToggle = (updatedProfile) => {
    const index = profiles.value.findIndex(p => p.id === updatedProfile.id);
    if (index !== -1) {
        profiles.value[index].enabled = updatedProfile.enabled;
        markDirty();
    }
};
const handleAddProfile = () => {
    isNewProfile.value = true;
    editingProfile.value = { name: '', enabled: true, subscriptions: [], manualNodes: [], customId: '', subConverter: '', subConfig: ''};
    showProfileModal.value = true;
};
const handleEditProfile = (profileId) => {
    const profile = profiles.value.find(p => p.id === profileId);
    if (profile) {
        isNewProfile.value = false;
        editingProfile.value = JSON.parse(JSON.stringify(profile));
        showProfileModal.value = true;
    }
};
const handleSaveProfile = (profileData) => {
    if (!profileData || !profileData.name) { showToast('订阅组名称不能为空', 'error'); return; }
    if (profileData.customId) {
        profileData.customId = profileData.customId.replace(/[^a-zA-Z0-9-_]/g, '');
        if (profileData.customId && profiles.value.some(p => p.id !== profileData.id && p.customId === profileData.customId)) {
            showToast(`自定义 ID "${profileData.customId}" 已存在`, 'error');
            return;
        }
    }
    if (isNewProfile.value) {
        profiles.value.unshift({ ...profileData, id: crypto.randomUUID() });
    } else {
        const index = profiles.value.findIndex(p => p.id === profileData.id);
        if (index !== -1) profiles.value[index] = profileData;
    }
    markDirty();
    showProfileModal.value = false;
};
const handleDeleteProfile = (profileId) => {
    profiles.value = profiles.value.filter(p => p.id !== profileId);
    markDirty();
};
const handleDeleteAllProfiles = () => {
    profiles.value = [];
    markDirty();
    showDeleteProfilesModal.value = false;
};
const copyProfileLink = (profileId) => {
    const token = config.value?.profileToken;
    if (!token || token === 'auto' || !token.trim()) {
        showToast('请在设置中配置一个固定的“订阅组分享Token”', 'error');
        return;
    }
    const profile = profiles.value.find(p => p.id === profileId);
    if (!profile) return;
    const identifier = profile.customId || profile.id;
    const link = `${window.location.origin}/${token}/${identifier}`;
    navigator.clipboard.writeText(link);
    showToast('订阅组分享链接已复制！', 'success');
};
const formatBytes = (bytes, decimals = 2) => {
  if (!+bytes || bytes < 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};
const formattedTotalRemainingTraffic = computed(() => formatBytes(totalRemainingTraffic.value));

</script>

<template>
  <div v-if="isLoading" class="text-center py-16 text-gray-500">
    正在加载...
  </div>
  <div v-else class="w-full max-w-screen-xl mx-auto p-4 sm:p-6 lg:p-8">
    <div class="flex justify-between items-center mb-8">
      <div class="flex items-center gap-4">
        <h1 class="text-2xl font-bold text-gray-800 dark:text-white">仪表盘</h1>
        <span 
          v-if="formattedTotalRemainingTraffic !== '0 B'"
          class="px-3 py-1 text-sm font-semibold text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-500/20 rounded-full"
        >
          剩余总流量: {{ formattedTotalRemainingTraffic }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <button @click="showBulkImportModal = true" class="text-sm font-semibold px-4 py-2 rounded-lg text-indigo-600 dark:text-indigo-400 border-2 border-indigo-500/50 hover:bg-indigo-500/10 transition-colors">批量导入</button>
      </div>
    </div>
    <Transition name="slide-fade">
      <div v-if="dirty" class="p-3 mb-6 rounded-lg bg-indigo-600/10 dark:bg-indigo-500/20 ring-1 ring-inset ring-indigo-600/20 flex items-center justify-between">
        <p class="text-sm font-medium text-indigo-800 dark:text-indigo-200">您有未保存的更改</p>
        <div class="flex items-center gap-3">
          <button @click="handleDiscard" class="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">放弃更改</button>
          <button @click="handleSave" :disabled="saveState !== 'idle'" class="px-5 py-2 text-sm text-white font-semibold rounded-lg shadow-sm flex items-center justify-center transition-all duration-300 w-28" :class="{'bg-green-600 hover:bg-green-700': saveState === 'idle', 'bg-gray-500 cursor-not-allowed': saveState === 'saving', 'bg-teal-500 cursor-not-allowed': saveState === 'success' }">
            <div v-if="saveState === 'saving'" class="flex items-center"><svg class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>保存中...</span></div>
            <div v-else-if="saveState === 'success'" class="flex items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg><span>已保存</span></div>
            <span v-else>保存更改</span>
          </button>
        </div>
      </div>
    </Transition>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      
      <div class="lg:col-span-2 space-y-12">
        
        <div>
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
            <div class="flex items-center gap-3">
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">机场订阅</h2>
              <span class="px-2.5 py-0.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700/50 rounded-full">{{ subscriptions.length }}</span>
            </div>
            <div class="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start">
              <button @click="handleAddSubscription" class="text-sm font-semibold px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm flex-shrink-0">新增</button>
              <div class="relative flex-shrink-0" ref="subsMoreMenuRef">
                <button @click="showSubsMoreMenu = !showSubsMoreMenu" class="p-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600 dark:text-gray-300" viewBox="0 0 20 20" fill="currentColor"><path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" /></svg>
                </button>
                <Transition name="slide-fade-sm">
                  <div v-if="showSubsMoreMenu" class="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-xl z-10 ring-1 ring-black ring-opacity-5">
                    <button v-if="!isSortingSubs" @click="isSortingSubs = true; showSubsMoreMenu=false" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">手动排序</button>
                    <button v-else @click="() => { isSortingSubs = false; markDirty(); showSubsMoreMenu=false; }" class="w-full text-left px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700">完成排序</button>
                    <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                    <button @click="showDeleteSubsModal = true; showSubsMoreMenu=false" class="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10">清空所有</button>
                  </div>
                </Transition>
              </div>
            </div>
          </div>
          <div v-if="subscriptions.length > 0">
            <draggable 
              v-if="isSortingSubs" 
              tag="div" 
              class="grid grid-cols-1 md:grid-cols-2 gap-5" 
              v-model="subscriptions" 
              :item-key="item => item.id"
              animation="300" 
              @end="markDirty">
              <template #item="{ element: subscription }">
                <div class="cursor-move">
                    <Card 
                        :misub="subscription" 
                        @delete="handleDeleteSubscriptionWithCleanup(subscription.id)" 
                        @change="markDirty" 
                        @update="handleUpdateNodeCount(subscription.id)" 
                        @edit="handleEditSubscription(subscription.id)" />
                </div>
              </template>
            </draggable>
            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div v-for="subscription in paginatedSubscriptions" :key="subscription.id">
                    <Card 
                        :misub="subscription" 
                        @delete="handleDeleteSubscriptionWithCleanup(subscription.id)" 
                        @change="markDirty" 
                        @update="handleUpdateNodeCount(subscription.id)" 
                        @edit="handleEditSubscription(subscription.id)" />
                </div>
            </div>
            <div v-if="subsTotalPages > 1 && !isSortingSubs" class="flex justify-center items-center space-x-4 mt-8 text-sm font-medium">
                <button @click="changeSubsPage(subsCurrentPage - 1)" :disabled="subsCurrentPage === 1" class="px-3 py-1 rounded-md disabled:opacity-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">&laquo; 上一页</button>
                <span class="text-gray-500 dark:text-gray-400">第 {{ subsCurrentPage }} / {{ subsTotalPages }} 页</span>
                <button @click="changeSubsPage(subsCurrentPage + 1)" :disabled="subsCurrentPage === subsTotalPages" class="px-3 py-1 rounded-md disabled:opacity-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">下一页 &raquo;</button>
            </div>
          </div>
          <div v-else class="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl"><svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg><h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">没有机场订阅</h3><p class="mt-1 text-sm text-gray-500">从添加你的第一个订阅开始。</p></div>
        </div>

        <div>
           <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
             <div class="flex items-center gap-3">
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">手动节点</h2>
              <span class="px-2.5 py-0.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700/50 rounded-full">{{ manualNodes.length }}</span>
            </div>
            <div class="flex items-center gap-2 w-full sm:w-auto">
              <div class="relative flex-grow">
                <input 
                  type="text" 
                  v-model="searchTerm"
                  placeholder="搜索节点..."
                  class="w-full pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <div class="p-0.5 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center flex-shrink-0">
                  <button @click="setViewMode('card')" class="p-1 rounded-md transition-colors" :class="manualNodeViewMode === 'card' ? 'bg-white dark:bg-gray-900 text-indigo-600' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                  </button>
                  <button @click="setViewMode('list')" class="p-1 rounded-md transition-colors" :class="manualNodeViewMode === 'list' ? 'bg-white dark:bg-gray-900 text-indigo-600' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" /></svg>
                  </button>
              </div>

              <button @click="handleAddNode" class="text-sm font-semibold px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm flex-shrink-0">新增</button>
              
              <div class="relative flex-shrink-0" ref="nodesMoreMenuRef">
                <button @click="showNodesMoreMenu = !showNodesMoreMenu" class="p-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600 dark:text-gray-300" viewBox="0 0 20 20" fill="currentColor"><path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" /></svg>
                </button>
                 <Transition name="slide-fade-sm">
                  <div v-if="showNodesMoreMenu" class="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-xl z-10 ring-1 ring-black ring-opacity-5">
                    <button @click="handleAutoSortNodes(); showNodesMoreMenu=false" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">一键排序</button>
                    <button v-if="!isSortingNodes" @click="isSortingNodes = true; showNodesMoreMenu=false" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">手动排序</button>
                    <button v-else @click="() => { isSortingNodes = false; markDirty(); showNodesMoreMenu=false; }" class="w-full text-left px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700">完成排序</button>
                    <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                    <button @click="showDeleteNodesModal = true; showNodesMoreMenu=false" class="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10">清空所有</button>
                  </div>
                </Transition>
              </div>
            </div>
          </div>
          <div v-if="manualNodes.length > 0">
            <div v-if="manualNodeViewMode === 'card'">
               <draggable 
                v-if="isSortingNodes"
                tag="div" 
                class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3" 
                v-model="manualNodes" 
                :item-key="item => item.id" 
                animation="300" 
                @end="markDirty"
              >
                <template #item="{ element: node }">
                   <div class="cursor-move">
                      <ManualNodeCard 
                          :node="node" 
                          @edit="handleEditNode(node.id)" 
                          @delete="handleDeleteNodeWithCleanup(node.id)" />
                  </div>
                </template>
              </draggable>
              <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                <div v-for="node in paginatedManualNodes" :key="node.id">
                  <ManualNodeCard 
                    :node="node" 
                    @edit="handleEditNode(node.id)" 
                    @delete="handleDeleteNodeWithCleanup(node.id)" />
                </div>
              </div>
            </div>

            <div v-if="manualNodeViewMode === 'list'" class="space-y-2">
                <ManualNodeList
                    v-for="node in paginatedManualNodes"
                    :key="node.id"
                    :node="node"
                    @edit="handleEditNode(node.id)"
                    @delete="handleDeleteNodeWithCleanup(node.id)"
                />
            </div>
            
            <div v-if="manualNodesTotalPages > 1 && !isSortingNodes" class="flex justify-center items-center space-x-4 mt-8 text-sm font-medium">
              <button @click="changeManualNodesPage(manualNodesCurrentPage - 1)" :disabled="manualNodesCurrentPage === 1" class="px-3 py-1 rounded-md disabled:opacity-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">&laquo; 上一页</button>
              <span class="text-gray-500 dark:text-gray-400">第 {{ manualNodesCurrentPage }} / {{ manualNodesTotalPages }} 页</span>
              <button @click="changeManualNodesPage(manualNodesCurrentPage + 1)" :disabled="manualNodesCurrentPage === manualNodesTotalPages" class="px-3 py-1 rounded-md disabled:opacity-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">下一页 &raquo;</button>
            </div>
          </div>
          <div v-else class="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl"><svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l-4 4-4-4M6 16l-4-4 4-4" /></svg><h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">没有手动节点</h3><p class="mt-1 text-sm text-gray-500">添加分享链接或单个节点。</p></div>
        </div>
      </div>
      
      <div class="lg:col-span-1 space-y-8">
        <RightPanel :config="config" :profiles="profiles" />
        
        <div>
           <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">我的订阅组</h2>
              <span class="px-2.5 py-0.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700/50 rounded-full">{{ profiles.length }}</span>
            </div>
            <div class="flex items-center gap-2">
              <button @click="showDeleteProfilesModal = true" class="hidden md:inline-flex text-sm font-medium px-3 py-1.5 rounded-lg text-red-500 border-2 border-red-500/60 hover:bg-red-500 hover:text-white dark:text-red-400 dark:border-red-400/60 dark:hover:bg-red-400 dark:hover:text-white transition-all">清空</button>
              <button @click="handleAddProfile" class="text-sm font-semibold px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm">新增</button>
              <div class="relative md:hidden" v-on:mouseleave="showProfilesMoreMenu = false">
                <button @click="showProfilesMoreMenu = !showProfilesMoreMenu" class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" /></svg>
                </button>
                 <Transition name="slide-fade-sm">
                  <div v-if="showProfilesMoreMenu" class="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-xl z-10 ring-1 ring-black ring-opacity-5">
                    <button @click="showDeleteProfilesModal = true; showProfilesMoreMenu=false" class="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700">清空</button>
                  </div>
                </Transition>
              </div>
            </div>
          </div>
          <div v-if="profiles.length > 0" class="space-y-4">
            <ProfileCard
              v-for="profile in profiles"
              :key="profile.id"
              :profile="profile"
              @edit="handleEditProfile(profile.id)"
              @delete="handleDeleteProfile(profile.id)"
              @change="handleProfileToggle($event)"
              @copy-link="copyProfileLink(profile.id)"
            />
          </div>
          <div v-else class="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            <h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">没有订阅组</h3>
            <p class="mt-1 text-sm text-gray-500">创建一个新的订阅组来管理你的订阅和节点。</p>
          </div>
        </div>
      </div>
      
      <!-- 模态框和设置 -->
      <ProfileModal v-if="showProfileModal" v-model:show="showProfileModal" :profile="editingProfile" :is-new="isNewProfile" :all-subscriptions="subscriptions" :all-manual-nodes="manualNodes" @save="handleSaveProfile" size="2xl" />
  
      <Modal v-if="editingNode" v-model:show="showNodeModal" @confirm="handleSaveNode">
        <template #title><h3 class="text-lg font-bold text-gray-800 dark:text-white">{{ isNewNode ? '新增手动节点' : '编辑手动节点' }}</h3></template>
        <template #body>
          <div class="space-y-4">
            <div><label for="node-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">节点名称</label><input type="text" id="node-name" v-model="editingNode.name" placeholder="（可选）不填将自动获取" class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"></div>
            <div><label for="node-url" class="block text-sm font-medium text-gray-700 dark:text-gray-300">节点链接</label><textarea id="node-url" v-model="editingNode.url" @input="handleNodeUrlInput" rows="4" class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono dark:text-white"></textarea></div>
          </div>
        </template>
      </Modal>

      <Modal v-if="editingSubscription" v-model:show="showSubModal" @confirm="handleSaveSubscription">
        <template #title><h3 class="text-lg font-bold text-gray-800 dark:text-white">{{ isNewSubscription ? '新增订阅' : '编辑订阅' }}</h3></template>
        <template #body>
          <div class="space-y-4">
            <div><label for="sub-edit-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">订阅名称</label><input type="text" id="sub-edit-name" v-model="editingSubscription.name" placeholder="（可选）不填将自动获取" class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"></div>
            <div><label for="sub-edit-url" class="block text-sm font-medium text-gray-700 dark:text-gray-300">订阅链接</label><input type="text" id="sub-edit-url" v-model="editingSubscription.url" placeholder="https://..." class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono dark:text-white"></div>
          </div>
        </template>
      </Modal>
  
      <SettingsModal v-model:show="uiStore.isSettingsModalVisible" />
    </div>
  </div>
</template>

<style scoped>
.slide-fade-enter-active, .slide-fade-leave-active { transition: all 0.3s ease-out; }
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-20px);
  opacity: 0;
}
.cursor-move {
  cursor: move;
}

.slide-fade-sm-enter-active,
.slide-fade-sm-leave-active {
  transition: all 0.2s ease-out;
}
.slide-fade-sm-enter-from,
.slide-fade-sm-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}
</style>