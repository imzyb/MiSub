<script setup>
import { ref, watch, nextTick } from 'vue';
import draggable from 'vuedraggable';
import ManualNodeCard from './ManualNodeCard.vue';
import ManualNodeList from './ManualNodeList.vue';

const props = defineProps({
  manualNodes: Array,
  paginatedManualNodes: Array,
  currentPage: Number,
  totalPages: Number,
  isSorting: Boolean,
  searchTerm: String,
  viewMode: String,
});

const emit = defineEmits([
  'add', 'delete', 'edit', 'changePage', 'update:searchTerm', 'update:viewMode',
  'toggleSort', 'markDirty', 'autoSort', 'deduplicate', 'import', 'deleteAll'
]);

const nodesMoreMenuRef = ref(null);
const showNodesMoreMenu = ref(false);
const localSearchTerm = ref(props.searchTerm || '');

// 简化搜索逻辑 - 直接在组件内处理
import { computed } from 'vue';

// 在组件内部直接计算过滤结果
const filteredNodes = computed(() => {
  if (!localSearchTerm.value) {
    return props.manualNodes;
  }
  
  const searchQuery = localSearchTerm.value.toLowerCase().trim();
  
  // 国家/地区代码到中文名称的映射
  const countryCodeMap = {
    'hk': ['香港', 'hk'],
    'tw': ['台湾', '臺灣', 'tw'],
    'sg': ['新加坡', '狮城', 'sg'],
    'jp': ['日本', 'jp'],
    'us': ['美国', ' США', 'us'],
    'kr': ['韩国', '韓國', 'kr'],
    'gb': ['英国', '英國', 'gb', 'uk'],
    'de': ['德国', '德國', 'de'],
    'fr': ['法国', '法國', 'fr'],
    'ca': ['加拿大', 'ca'],
    'au': ['澳大利亚', '澳洲', '澳大利亞', 'au'],
    'cn': ['中国', '大陸', '内地', 'cn'],
    'my': ['马来西亚', '馬來西亞', 'my'],
    'th': ['泰国', '泰國', 'th'],
    'vn': ['越南', 'vn'],
    'ph': ['菲律宾', '菲律賓', 'ph'],
    'id': ['印度尼西亚', '印尼', 'id'],
    'in': ['印度', 'in'],
    'pk': ['巴基斯坦', 'pk'],
    'bd': ['孟加拉国', '孟加拉國', 'bd'],
    'ae': ['阿联酋', '阿聯酋', 'ae'],
    'sa': ['沙特阿拉伯', 'sa'],
    'tr': ['土耳其', 'tr'],
    'ru': ['俄罗斯', '俄羅斯', 'ru'],
    'br': ['巴西', 'br'],
    'mx': ['墨西哥', 'mx'],
    'ar': ['阿根廷', 'ar'],
    'cl': ['智利', 'cl'],
    'za': ['南非', 'za'],
    'eg': ['埃及', 'eg'],
    'ng': ['尼日利亚', '尼日利亞', 'ng'],
    'ke': ['肯尼亚', '肯尼亞', 'ke'],
    'il': ['以色列', 'il'],
    'ir': ['伊朗', 'ir'],
    'iq': ['伊拉克', 'iq'],
    'ua': ['乌克兰', '烏克蘭', 'ua'],
    'pl': ['波兰', '波蘭', 'pl'],
    'cz': ['捷克', 'cz'],
    'hu': ['匈牙利', 'hu'],
    'ro': ['罗马尼亚', '羅馬尼亞', 'ro'],
    'gr': ['希腊', '希臘', 'gr'],
    'pt': ['葡萄牙', 'pt'],
    'es': ['西班牙', 'es'],
    'it': ['意大利', 'it'],
    'nl': ['荷兰', '荷蘭', 'nl'],
    'be': ['比利时', '比利時', 'be'],
    'se': ['瑞典', 'se'],
    'no': ['挪威', 'no'],
    'dk': ['丹麦', '丹麥', 'dk'],
    'fi': ['芬兰', '芬蘭', 'fi'],
    'ch': ['瑞士', 'ch'],
    'at': ['奥地利', '奧地利', 'at'],
    'ie': ['爱尔兰', '愛爾蘭', 'ie'],
    'nz': ['新西兰', '紐西蘭', 'nz'],
  };
  
  const filtered = props.manualNodes.filter(node => {
    if (!node.name) return false;
    
    const nodeName = node.name.toLowerCase();
    
    // 直接搜索匹配
    if (nodeName.includes(searchQuery)) {
      return true;
    }
    
    // 国家代码映射匹配
    const alternativeTerms = countryCodeMap[searchQuery] || [];
    for (const altTerm of alternativeTerms) {
      if (nodeName.includes(altTerm.toLowerCase())) {
        return true;
      }
    }
    
    return false;
  });
  
  return filtered;
});

// 分页处理
const currentPage = ref(1);
const nodesPerPage = 24;
const totalPages = computed(() => Math.ceil(filteredNodes.value.length / nodesPerPage));

// 计算当前显示的节点数据
const paginatedNodes = computed(() => {
  if (localSearchTerm.value) {
    // 搜索时使用本地过滤和分页
    const start = (currentPage.value - 1) * nodesPerPage;
    const end = start + nodesPerPage;
    return filteredNodes.value.slice(start, end);
  } else {
    // 非搜索时使用props传入的分页数据
    return props.paginatedManualNodes;
  }
});

// 监听搜索词变化重置分页
watch(localSearchTerm, () => {
  currentPage.value = 1;
});

const handleDelete = (id) => emit('delete', id);
const handleEdit = (id) => emit('edit', id);
const handleAdd = () => emit('add');
const handleChangePage = (page) => {
  if (localSearchTerm.value) {
    // 搜索时使用本地分页
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page;
    }
  } else {
    // 非搜索时使用原来的分页
    emit('changePage', page);
  }
};
const handleSetViewMode = (mode) => emit('update:viewMode', mode);
const handleToggleSort = () => {
  emit('toggleSort');
  showNodesMoreMenu.value = false;

  // 使用 nextTick 等待状态更新完成后重置分页
  nextTick(() => {
    // 如果已经退出排序模式且没有搜索，重置到第一页
    if (!props.isSorting && !props.searchTerm) {
      emit('changePage', 1);
    }
  });
};
const handleSortEnd = () => {
  emit('markDirty');
  // 手动排序完成后重置到第一页
  if (!props.searchTerm) {
    emit('changePage', 1);
  }
};
const handleAutoSort = () => {
  emit('autoSort');
  showNodesMoreMenu.value = false;
};
const handleDeduplicate = () => {
  emit('deduplicate');
  showNodesMoreMenu.value = false;
};
const handleImport = () => {
  emit('import');
  showNodesMoreMenu.value = false;
};
const handleDeleteAll = () => {
  emit('deleteAll');
  showNodesMoreMenu.value = false;
};

// 添加点击外部关闭下拉菜单的功能
const handleClickOutside = (event) => {
  if (nodesMoreMenuRef.value && !nodesMoreMenuRef.value.contains(event.target)) {
    showNodesMoreMenu.value = false;
  }
};

// 在组件挂载和卸载时添加/移除事件监听器
import { onMounted, onUnmounted } from 'vue';

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
      <div class="flex items-center gap-3">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">手动节点</h2>
        <span class="px-2.5 py-0.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700/50 rounded-full">{{ manualNodes.length }}</span>
        <span v-if="localSearchTerm" class="px-2.5 py-0.5 text-sm font-semibold text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-500/20 rounded-full">
          搜索: "{{ localSearchTerm }}" ({{ filteredNodes.length }}/{{ manualNodes.length }} 结果)
        </span>
      </div>
      <div class="flex items-center gap-2 w-full sm:w-auto">
        <div class="relative grow">
          <input 
            type="text" 
            v-model="localSearchTerm"
            placeholder="搜索节点..."
            class="w-full pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <div class="p-0.5 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center shrink-0">
            <button @click="handleSetViewMode('card')" class="view-mode-toggle p-1.5 rounded-md transition-colors flex items-center justify-center" :class="viewMode === 'card' ? 'bg-white dark:bg-gray-900 text-indigo-600' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </button>
            <button @click="handleSetViewMode('list')" class="view-mode-toggle p-1.5 rounded-md transition-colors flex items-center justify-center" :class="viewMode === 'list' ? 'bg-white dark:bg-gray-900 text-indigo-600' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" /></svg>
            </button>
        </div>
        <button @click="handleAdd" class="text-sm font-semibold px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-xs shrink-0">新增</button>
        <div class="relative shrink-0" ref="nodesMoreMenuRef">
          <button @click="showNodesMoreMenu = !showNodesMoreMenu" class="p-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600 dark:text-gray-300" viewBox="0 0 20 20" fill="currentColor"><path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" /></svg>
          </button>
           <Transition name="slide-fade-sm">
            <div v-if="showNodesMoreMenu" class="absolute right-0 mt-2 w-36 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg dark:shadow-2xl z-50 ring-1 ring-black/5">
              <button @click="handleImport" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">导入订阅</button>
              <button @click="handleAutoSort" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">一键排序</button>
              <button @click="handleDeduplicate" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">一键去重</button>
              <button 
                @click="handleToggleSort" 
                class="w-full text-left px-4 py-2 text-sm transition-colors text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {{ isSorting ? '完成排序' : '手动排序' }}
              </button>
              <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
              <button @click="handleDeleteAll" class="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10">清空所有</button>
            </div>
          </Transition>
        </div>
      </div>
    </div>
    <div v-if="manualNodes.length > 0">
      <!-- 如果有搜索词，显示搜索提示 -->
      <div v-if="localSearchTerm && filteredNodes.length === 0" class="text-center py-8 text-gray-500">
        <p>没有找到包含 "{{ localSearchTerm }}" 的节点</p>
      </div>
      
      <div v-if="viewMode === 'card'">
        <draggable 
          v-if="isSorting"
          tag="div" 
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3" 
          :list="manualNodes" 
          item-key="id" 
          animation="300" 
          @end="handleSortEnd"
        >
          <template #item="{ element: node }">
             <div class="cursor-move">
                <ManualNodeCard 
                    :node="node" 
                    @edit="handleEdit(node.id)" 
                    @delete="handleDelete(node.id)" />
            </div>
          </template>
        </draggable>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          <div 
            v-for="(node, index) in paginatedNodes" 
            :key="node.id"
            class="list-item-animation"
            :style="{ '--delay-index': index }"
          >
            <ManualNodeCard 
              :node="node" 
              @edit="handleEdit(node.id)" 
              @delete="handleDelete(node.id)" />
          </div>
        </div>
      </div>

      <div v-if="viewMode === 'list'" class="space-y-2">
        <draggable 
          v-if="isSorting"
          tag="div" 
          class="space-y-2" 
          :list="manualNodes" 
          item-key="id" 
          animation="300" 
          @end="handleSortEnd"
        >
          <template #item="{ element: node, index }">
            <div class="cursor-move">
              <ManualNodeList
                  :node="node"
                  :index="index + 1"
                  class="list-item-animation"
                  :style="{ '--delay-index': index }"
                  @edit="handleEdit(node.id)"
                  @delete="handleDelete(node.id)"
              />
            </div>
          </template>
        </draggable>
        <div v-else class="space-y-2">
          <ManualNodeList
              v-for="(node, index) in paginatedNodes"
              :key="node.id"
              :node="node"
              :index="localSearchTerm ? (currentPage - 1) * 24 + index + 1 : (props.currentPage - 1) * 24 + index + 1"
              :class="`list-item-animation`"
              :style="{ '--delay-index': index }"
              @edit="handleEdit(node.id)"
              @delete="handleDelete(node.id)"
          />
        </div>
      </div>
      
      <!-- 分页 - 搜索时使用本地分页，否则使用props -->
      <div v-if="localSearchTerm && totalPages > 1" class="flex justify-center items-center space-x-4 mt-8 text-sm font-medium">
        <button 
          @click="handleChangePage(currentPage - 1)" 
          :disabled="currentPage === 1" 
          class="px-3 py-1 rounded-md disabled:opacity-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
        >&laquo; 上一页</button>
        <span class="text-gray-500 dark:text-gray-400">第 {{ currentPage }} / {{ totalPages }} 页</span>
        <button 
          @click="handleChangePage(currentPage + 1)" 
          :disabled="currentPage === totalPages" 
          class="px-3 py-1 rounded-md disabled:opacity-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
        >下一页 &raquo;</button>
      </div>
      
      <!-- 非搜索时的原有分页 -->
      <div v-else-if="!localSearchTerm && props.totalPages > 1" class="flex justify-center items-center space-x-4 mt-8 text-sm font-medium">
        <button 
          @click="handleChangePage(props.currentPage - 1)" 
          :disabled="props.currentPage === 1" 
          class="px-3 py-1 rounded-md disabled:opacity-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
        >&laquo; 上一页</button>
        <span class="text-gray-500 dark:text-gray-400">第 {{ props.currentPage }} / {{ props.totalPages }} 页</span>
        <button 
          @click="handleChangePage(props.currentPage + 1)" 
          :disabled="props.currentPage === props.totalPages" 
          class="px-3 py-1 rounded-md disabled:opacity-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
        >下一页 &raquo;</button>
      </div>
    </div>
    <div v-else class="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl"><svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l-4 4-4-4M6 16l-4-4 4-4" /></svg><h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">没有手动节点</h3><p class="mt-1 text-sm text-gray-500">添加分享链接或单个节点。</p></div>
  </div>
</template>

<style scoped>
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
