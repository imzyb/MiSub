<script setup>
const props = defineProps({
  templateConfig: {
    type: Object,
    required: true
  },
  insertTemplateTag: {
    type: Function,
    required: true
  }
});

const variableTags = ['{emoji}', '{region}', '{protocol}', '{index}', '{name}', '{server}'];
</script>

<template>
  <!-- 变量行 -->
  <div class="flex flex-wrap items-center text-xs gap-2 mb-2">
    <span
      class="text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded"
    >变量</span>
    <button
      v-for="tag in variableTags"
      :key="tag"
      @click="insertTemplateTag(tag)"
      :title="tag === '{name}' ? '这是第1步清理后的剩余名称' : ''"
      class="px-2 py-1 sm:px-2 sm:py-1 text-[12px] sm:text-xs bg-white dark:bg-gray-700 border border-indigo-200 dark:border-gray-600 misub-radius-md text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-gray-600 transition-colors !min-h-0 !min-w-0"
    >
      + {{ tag }}
    </button>
  </div>

  <!-- 修饰行 -->
  <div class="flex flex-wrap items-center text-xs gap-2 mb-3">
    <span
      class="text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded"
    >修饰</span>

    <!-- 地区修饰 -->
    <div class="flex gap-1">
      <button @click="insertTemplateTag('{region:UPPER}')"
        class="px-2 py-1 sm:px-2 sm:py-1 text-[12px] sm:text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md hover:bg-gray-50 dark:hover:bg-gray-600 !min-h-0 !min-w-0"
        title="大写地区 (US)">US</button>
      <button @click="insertTemplateTag('{region:lower}')"
        class="px-2 py-1 sm:px-2 sm:py-1 text-[12px] sm:text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md hover:bg-gray-50 dark:hover:bg-gray-600 !min-h-0 !min-w-0"
        title="小写地区 (us)">us</button>
      <button @click="insertTemplateTag('{region:zh}')"
        class="px-2 py-1 sm:px-2 sm:py-1 text-[12px] sm:text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md hover:bg-gray-50 dark:hover:bg-gray-600 text-indigo-600 dark:text-indigo-400 font-medium !min-h-0 !min-w-0"
        title="中文地区 (美国)">中</button>
    </div>

    <span class="w-px h-3 bg-gray-300 dark:bg-gray-600 mx-1"></span>

    <!-- 协议修饰 -->
    <div class="flex gap-1">
      <button @click="insertTemplateTag('{protocol:UPPER}')"
        class="px-2 py-1 sm:px-2 sm:py-1 text-[12px] sm:text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md hover:bg-gray-50 dark:hover:bg-gray-600 !min-h-0 !min-w-0"
        title="大写协议 (VMESS)">PRO</button>
      <button @click="insertTemplateTag('{protocol:Title}')"
        class="px-2 py-1 sm:px-2 sm:py-1 text-[12px] sm:text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md hover:bg-gray-50 dark:hover:bg-gray-600 !min-h-0 !min-w-0"
        title="首字母大写 (Vmess)">Pro</button>
    </div>

    <span class="w-px h-3 bg-gray-300 dark:bg-gray-600 mx-1"></span>

    <!-- 分隔符 -->
    <div class="flex gap-1">
      <button @click="insertTemplateTag(' - ')"
        class="px-2 py-1 sm:px-2 sm:py-1 text-[12px] sm:text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md hover:bg-gray-50 dark:hover:bg-gray-600 !min-h-0 !min-w-0">-</button>
      <button @click="insertTemplateTag(' | ')"
        class="px-2 py-1 sm:px-2 sm:py-1 text-[12px] sm:text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md hover:bg-gray-50 dark:hover:bg-gray-600 !min-h-0 !min-w-0">|</button>
      <button @click="insertTemplateTag(' ')"
        class="px-2 py-1 sm:px-2 sm:py-1 text-[12px] sm:text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md hover:bg-gray-50 dark:hover:bg-gray-600 !min-h-0 !min-w-0"
        title="空格">␣</button>
    </div>
  </div>

  <div class="relative">
    <input
      v-model="templateConfig.template"
      class="block w-full text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md py-2 pl-3 pr-10 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
      placeholder="点击上方标签构建模板..."
    >
  </div>

  <!-- 高级选项 -->
  <div class="mt-3 grid grid-cols-2 gap-4">
    <div class="flex items-center gap-2">
      <span class="text-xs text-gray-500 dark:text-gray-400">序号起始:</span>
      <input
        type="number"
        v-model.number="templateConfig.indexStart"
        class="w-16 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:text-white"
      >
    </div>
    <div class="flex items-center gap-2">
      <span class="text-xs text-gray-500 dark:text-gray-400">序号补零:</span>
      <input
        type="number"
        v-model.number="templateConfig.indexPad"
        class="w-16 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:text-white"
        title="例如设为2，则1显示为01"
      >
    </div>
  </div>
</template>
