<script setup>
import Switch from '../../ui/Switch.vue';

const props = defineProps({
  editingSubscription: {
    type: Object,
    required: true
  }
});
</script>

<template>
  <!-- User-Agent -->
  <div>
    <label for="sub-edit-ua" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
      自定义 User-Agent
      <span class="text-xs text-gray-500 ml-2">(可选,留空使用默认)</span>
    </label>
    <select id="sub-edit-ua" v-model="editingSubscription.customUserAgent"
      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 misub-radius-md dark:text-white">
      <option value="">使用默认 UA</option>
      <option value="MiSub">MiSub</option>
      <option value="clash-verge/v2.4.3">Clash Verge</option>
      <option value="clash.meta">Clash Meta</option>
      <option value="v2rayN/7.23">v2rayN</option>
      <option value="Shadowrocket/1.9.0">Shadowrocket</option>
      <option value="Mozilla/5.0">Mozilla</option>
    </select>
    <p v-if="editingSubscription.customUserAgent" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
      当前 UA: {{ editingSubscription.customUserAgent }}
    </p>
  </div>

  <!-- 官网 -->
  <div>
    <label for="sub-edit-website" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
      官网
      <span class="text-xs text-gray-500 ml-2">(可选，用于卡片跳转)</span>
    </label>
    <input
      id="sub-edit-website"
      v-model="editingSubscription.website"
      type="url"
      inputmode="url"
      placeholder="https://example.com"
      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 misub-radius-md dark:text-white font-mono text-sm"
    />
    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">填写机场官网或用户中心地址；未写协议时会自动按 https:// 打开。</p>
  </div>

  <!-- 备注 -->
  <div>
    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">备注</label>
    <textarea v-model="editingSubscription.notes" placeholder="例如: 价格: ¥20/月 | 到期: 2024-12-31"
      rows="2"
      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 misub-radius-md dark:text-white"></textarea>
  </div>

  <!-- 开关选项 -->
  <div class="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
    <div class="flex items-center justify-between gap-4">
      <div>
        <span class="text-sm font-medium text-gray-700 dark:text-gray-200">保护性缓存节点</span>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">拉取失败或空节点时使用上次缓存，避免节点清零</p>
      </div>
      <Switch v-model="editingSubscription.enableNodeCache" />
    </div>

    <div class="flex items-center justify-between gap-4">
      <div>
        <span class="text-sm font-medium text-gray-700 dark:text-gray-200">+ 号转空格</span>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">将节点名中的 + 号显示为空格</p>
      </div>
      <Switch v-model="editingSubscription.plusAsSpace" />
    </div>
  </div>
</template>
