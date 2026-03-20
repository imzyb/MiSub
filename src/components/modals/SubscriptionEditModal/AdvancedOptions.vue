<script setup>
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
      <option value="clash.meta">Clash Meta</option>
      <option value="v2rayN/7.23">v2rayN</option>
      <option value="Shadowrocket/1.9.0">Shadowrocket</option>
      <option value="Mozilla/5.0">Mozilla</option>
    </select>
    <p v-if="editingSubscription.customUserAgent" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
      当前 UA: {{ editingSubscription.customUserAgent }}
    </p>
  </div>

  <!-- 备注 -->
  <div>
    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">备注</label>
    <textarea v-model="editingSubscription.notes" placeholder="例如: 官网: example.com | 价格: ¥20/月 | 到期: 2024-12-31"
      rows="2"
      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 misub-radius-md dark:text-white"></textarea>
  </div>

  <!-- 兼容 + 号为空格 -->
  <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
    <input type="checkbox" v-model="editingSubscription.plusAsSpace"
      class="h-4 w-4 rounded border-gray-300 text-slate-700 focus:ring-slate-500" />
    节点名称中的 + 视为空格
  </label>
</template>
