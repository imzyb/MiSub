<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  items: {
    type: Array,
    required: true
  },
  searchFields: {
    type: Array,
    default: () => ['name', 'url']
  },
  filters: {
    type: Array,
    default: () => []
  },
  placeholder: {
    type: String,
    default: '搜索...'
  }
});

const emit = defineEmits(['update:results', 'update:query']);

const searchQuery = ref('');
const activeFilters = ref(new Set());
const searchHistory = ref([]);

// 智能搜索结果
const searchResults = computed(() => {
  if (!searchQuery.value && activeFilters.value.size === 0) {
    return props.items;
  }

  return props.items.filter(item => {
    // 文本搜索
    const matchesText = !searchQuery.value || props.searchFields.some(field => 
      item[field]?.toLowerCase().includes(searchQuery.value.toLowerCase())
    );

    // 过滤器匹配
    const matchesFilters = activeFilters.value.size === 0 || 
      Array.from(activeFilters.value).every(filter => {
        const filterConfig = props.filters.find(f => f.key === filter);
        return filterConfig?.predicate(item) ?? true;
      });

    return matchesText && matchesFilters;
  });
});

// 搜索建议
const suggestions = computed(() => {
  if (!searchQuery.value || searchQuery.value.length < 2) return [];
  
  const suggestions = new Set();
  
  props.items.forEach(item => {
    props.searchFields.forEach(field => {
      const value = item[field];
      if (value && value.toLowerCase().includes(searchQuery.value.toLowerCase())) {
        // 提取匹配的部分作为建议
        const words = value.split(/\s+/);
        words.forEach(word => {
          if (word.toLowerCase().includes(searchQuery.value.toLowerCase()) && word.length > 2) {
            suggestions.add(word);
          }
        });
      }
    });
  });
  
  return Array.from(suggestions).slice(0, 5);
});

const toggleFilter = (filterKey) => {
  if (activeFilters.value.has(filterKey)) {
    activeFilters.value.delete(filterKey);
  } else {
    activeFilters.value.add(filterKey);
  }
  activeFilters.value = new Set(activeFilters.value); // 触发响应式更新
};

const selectSuggestion = (suggestion) => {
  searchQuery.value = suggestion;
  addToHistory(suggestion);
};

const addToHistory = (query) => {
  if (query && !searchHistory.value.includes(query)) {
    searchHistory.value.unshift(query);
    searchHistory.value = searchHistory.value.slice(0, 10); // 保留最近10个
  }
};

const clearSearch = () => {
  searchQuery.value = '';
  activeFilters.value.clear();
};

// 监听结果变化并向父组件发送
watch([searchResults, searchQuery], () => {
  emit('update:results', searchResults.value);
  emit('update:query', searchQuery.value);
});
</script>

<template>
  <div class="relative space-y-4">
    <!-- 搜索输入框 -->
    <div class="relative">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="placeholder"
        class="w-full pl-10 pr-12 py-3 bg-white/90 dark:bg-gray-900/80 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent smooth-all text-gray-900 dark:text-gray-100"
        @keyup.enter="addToHistory(searchQuery)"
      >
      
      <!-- 清除按钮 -->
      <button
        v-if="searchQuery || activeFilters.size > 0"
        @click="clearSearch"
        class="absolute inset-y-0 right-0 pr-3 flex items-center"
      >
        <svg class="h-5 w-5 text-gray-400 hover:text-gray-600 smooth-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- 快捷过滤器 -->
    <div v-if="filters.length > 0" class="flex flex-wrap gap-2">
      <button
        v-for="filter in filters"
        :key="filter.key"
        @click="toggleFilter(filter.key)"
        class="px-3 py-1.5 text-sm font-medium rounded-full smooth-all"
        :class="activeFilters.has(filter.key)
          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
        "
      >
        {{ filter.label }}
        <span v-if="filter.count !== undefined" class="ml-1 opacity-60">
          ({{ filter.count }})
        </span>
      </button>
    </div>

    <!-- 搜索建议 -->
    <div v-if="suggestions.length > 0" class="absolute top-full left-0 right-0 mt-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl card-shadow border border-gray-200 dark:border-gray-700 z-50">
      <div class="p-2">
        <p class="text-xs text-gray-500 dark:text-gray-400 px-3 py-1">搜索建议</p>
        <button
          v-for="suggestion in suggestions"
          :key="suggestion"
          @click="selectSuggestion(suggestion)"
          class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg smooth-all"
        >
          {{ suggestion }}
        </button>
      </div>
    </div>

    <!-- 搜索结果统计 -->
    <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
      <span>
        找到 {{ searchResults.length }} 个结果
        <span v-if="searchQuery">包含 "{{ searchQuery }}"</span>
      </span>
      
      <!-- 搜索历史快捷访问 -->
      <div v-if="searchHistory.length > 0" class="flex items-center gap-2">
        <span class="text-xs">最近:</span>
        <button
          v-for="history in searchHistory.slice(0, 3)"
          :key="history"
          @click="searchQuery = history"
          class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 smooth-all"
        >
          {{ history }}
        </button>
      </div>
    </div>
  </div>
</template>