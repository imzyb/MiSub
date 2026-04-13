<script setup>
import { computed } from 'vue';

const props = defineProps({
  searchQuery: {
    type: String,
    default: ''
  },
  protocolFilter: {
    type: String,
    default: 'all'
  },
  regionFilter: {
    type: String,
    default: 'all'
  },
  viewMode: {
    type: String,
    default: 'list'
  },
  showProcessed: {
    type: Boolean,
    default: false
  },
  availableProtocols: {
    type: Array,
    default: () => []
  },
  availableRegions: {
    type: Array,
    default: () => []
  },
  profileId: {
    type: String,
    default: ''
  },
  apiEndpoint: {
    type: String,
    default: ''
  }
});

const emit = defineEmits([
  'update:searchQuery',
  'update:protocolFilter',
  'update:regionFilter',
  'update:viewMode',
  'update:showProcessed'
]);

const searchModel = computed({
  get: () => props.searchQuery,
  set: (val) => emit('update:searchQuery', val)
});

const protocolModel = computed({
  get: () => props.protocolFilter,
  set: (val) => emit('update:protocolFilter', val)
});

const regionModel = computed({
  get: () => props.regionFilter,
  set: (val) => emit('update:regionFilter', val)
});

const isProcessedToggleVisible = computed(() => {
  return props.profileId && props.apiEndpoint !== '/api/public/preview';
});
</script>

<template>
  <!-- 响应式网格布局 -->
  <!-- 移动端：Grid (1列用于搜索，2列用于筛选)，桌面端维持原样 -->
  <div class="rounded-xl border border-gray-200/70 bg-white/80 p-3 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-4">
    <div class="flex flex-col gap-3 lg:grid lg:grid-cols-4 lg:items-end sm:gap-4">
    <!-- 搜索 (移动端置顶) -->
    <div class="w-full">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
        节点搜索
      </label>
      <div class="flex gap-2">
        <div class="relative flex-1">
          <input
            v-model="searchModel"
            type="text"
            placeholder="搜索..."
            class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-10 text-sm text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-white/10 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
          />
          <div class="absolute inset-y-0 right-0 flex items-center pr-2 sm:pr-3">
            <svg class="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
        </div>

        <!-- 处理模式 toggler (仅移动端、订阅组且非公开页显示) -->
        <button
          v-if="isProcessedToggleVisible"
          @click="emit('update:showProcessed', !showProcessed)"
          :class="showProcessed ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600'"
          class="!min-h-0 !min-w-0 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border transition-colors hover:opacity-90 lg:hidden"
          title="切换显示原始/处理后节点名称"
        >
          <!-- 原材料 Icon -->
          <svg v-if="!showProcessed" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
          </svg>
          <!-- 魔法棒 Icon -->
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- 筛选器组 (移动端并排) -->
    <div class="grid grid-cols-2 gap-3 lg:contents">
      <!-- 协议筛选 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
          协议类型
        </label>
        <select
          v-model="protocolModel"
          class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-white/10 dark:bg-gray-800 dark:text-white"
        >
          <option value="all">全部</option>
          <option v-for="protocol in availableProtocols" :key="protocol" :value="protocol">
            {{ protocol.toUpperCase() }}
          </option>
        </select>
      </div>

      <!-- 地区筛选 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
          地区筛选
        </label>
        <select
          v-model="regionModel"
          class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-white/10 dark:bg-gray-800 dark:text-white"
        >
          <option value="all">全部</option>
          <option v-for="region in availableRegions" :key="region" :value="region">
            {{ region }}
          </option>
        </select>
      </div>
    </div>

    <!-- 视图切换 & 规则处理 (Desktop Combined) -->
    <div class="hidden lg:flex gap-6">
      <!-- 视图切换 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
          显示模式
        </label>
        <div class="flex items-center gap-1 sm:gap-2">
          <button
            @click="emit('update:viewMode', 'list')"
            :class="viewMode === 'list' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'"
            class="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors"
            title="列表视图"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16"></path>
            </svg>
          </button>
          <button
            @click="emit('update:viewMode', 'card')"
            :class="viewMode === 'card' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'"
            class="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors"
            title="卡片视图"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- 规则处理 -->
      <div v-if="isProcessedToggleVisible">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
          规则处理
        </label>
        <div class="flex items-center gap-1 sm:gap-2">
          <button
            @click="emit('update:showProcessed', !showProcessed)"
            :class="showProcessed ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'"
            class="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors"
            title="切换显示模式：原始 / 处理后"
          >
            <!-- 魔法棒 Icon (处理后) -->
            <svg v-if="showProcessed" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
            <!-- 原材料 Icon (原始) -->
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>
