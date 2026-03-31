<script setup>
import { computed } from 'vue';
import TagBuilder from './TagBuilder.vue';
import SortRuleEditor from './SortRuleEditor.vue';

const props = defineProps({
  config: {
    type: Object,
    required: true
  },
  ruleBuilder: {
    type: Object,
    required: true
  },
  presets: {
    type: Object,
    required: true
  },
  templatePresets: {
    type: Array,
    required: true
  },
  protocolOrderText: {
    type: String,
    default: ''
  },
  addVisualRule: {
    type: Function,
    required: true
  },
  removeRegexRule: {
    type: Function,
    required: true
  },
  moveRule: {
    type: Function,
    required: true
  },
  applyTemplate: {
    type: Function,
    required: true
  },
  insertTemplateTag: {
    type: Function,
    required: true
  }
});

const emit = defineEmits(['update:protocolOrderText']);

const protocolOrderModel = computed({
  get: () => props.protocolOrderText,
  set: (val) => emit('update:protocolOrderText', val)
});
</script>

<template>
  <!-- 2. 积木式规则构建器 (Regex) -->
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
        <span>🪄 魔术清理</span>
        <span class="text-xs font-normal text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">Regex
          引擎</span>
      </h4>
      <label class="inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
        <input type="checkbox" v-model="config.rename.regex.enabled"
          class="mr-1 rounded text-indigo-600 focus:ring-indigo-500">
        启用清理
      </label>
    </div>

    <div v-if="config.rename.regex.enabled"
      class="bg-gray-50 dark:bg-gray-800/50 misub-radius-lg p-4 border border-gray-100 dark:border-gray-700">
      <!-- 规则添加器 -->
      <div class="flex flex-col sm:flex-row gap-2 mb-4">
        <!-- 动作 -->
        <select v-model="ruleBuilder.action"
          class="text-sm bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 misub-radius-md focus:ring-indigo-500 px-2 py-1.5 focus:border-indigo-500 dark:text-white">
          <option value="remove">🗑️ 删除/包含</option>
          <option value="replace">✏️ 替换为</option>
          <option value="prefix">⏮️ 添加前缀</option>
          <option value="suffix">⏭️ 添加后缀</option>
        </select>

        <!-- 对象 -->
        <div class="flex-1 flex gap-2">
          <select v-if="['remove', 'replace'].includes(ruleBuilder.action)" v-model="ruleBuilder.targetType"
            class="text-sm bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 misub-radius-md w-20 px-2 py-1.5 dark:text-white">
            <option value="preset">⚡️ 预设</option>
            <option value="custom">✍️ 手填</option>
          </select>

          <!-- 动态输入区 -->
          <div class="flex-1 flex gap-2 w-full items-center">
            <template v-if="['remove', 'replace'].includes(ruleBuilder.action)">
              <!-- 预设选择 -->
              <select v-if="ruleBuilder.targetType === 'preset'" v-model="ruleBuilder.preset"
                class="flex-1 text-sm bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 misub-radius-md px-2 py-1.5 dark:text-white">
                <option value="" disabled>请选择预设...</option>
                <option v-for="(v, k) in presets" :key="k" :value="k">{{ v.label }}</option>
              </select>
              <!-- 自定义输入 -->
              <div v-else class="flex-1 relative group">
                <input v-model="ruleBuilder.customInput" placeholder="输入关键字..."
                  class="w-full text-sm bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 misub-radius-md px-2 py-1.5 dark:text-white">
                <p
                  class="absolute -bottom-5 left-1 text-[10px] text-gray-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white dark:bg-gray-800 px-1 rounded shadow-sm border border-gray-100 dark:border-gray-700">
                  💡 提示: 支持用 <code class="bg-gray-100 dark:bg-gray-600 px-1 rounded">|</code> 分隔多个词 (例如: 倍率|VIP)</p>
              </div>
            </template>

            <!-- 替换内容输入 -->
            <input v-if="['replace', 'prefix', 'suffix'].includes(ruleBuilder.action)"
              v-model="ruleBuilder.replacement" placeholder="输入文字..."
              class="flex-1 text-sm bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 misub-radius-md px-2 py-1.5 dark:text-white">
          </div>
        </div>

        <div class="flex-shrink-0">
          <button @click="addVisualRule" type="button"
            class="w-full sm:w-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium misub-radius-md shadow-sm transition-colors">
            添加
          </button>
        </div>
      </div>

      <!-- 规则列表 -->
      <div class="space-y-2 max-h-48 overflow-y-auto">
        <div v-for="(rule, idx) in config.rename.regex.rules" :key="rule.pattern + '_' + idx"
          class="flex items-center gap-2 text-xs bg-white dark:bg-gray-700 p-2 misub-radius-md border border-gray-200 dark:border-gray-600 group hover:shadow-sm transition-shadow">

          <!-- 排序按钮 -->
          <div class="flex flex-col gap-0.5 opacity-30 group-hover:opacity-100 transition-opacity">
            <button @click="moveRule(idx, -1)" :disabled="idx === 0"
              class="hover:text-indigo-600 disabled:opacity-30"><svg class="w-3 h-3" fill="none"
                stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 15l7-7 7 7"></path>
              </svg></button>
            <button @click="moveRule(idx, 1)" :disabled="idx === config.rename.regex.rules.length - 1"
              class="hover:text-indigo-600 disabled:opacity-30"><svg class="w-3 h-3" fill="none"
                stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7"></path>
              </svg></button>
          </div>

          <span
            class="bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">{{
              rule._meta?.action || 'Regex' }}</span>

          <span class="flex-1 truncate font-mono text-gray-700 dark:text-gray-200">
            <span v-if="rule._meta">
              {{ rule._meta.targetDisplay }}
              <span
                v-if="rule.replacement && rule._meta.action !== 'remove' && rule._meta.action !== 'prefix' && rule._meta.action !== 'suffix'"
                class="text-gray-400 mx-1">➝</span>
              <span v-if="rule.replacement && rule._meta.action !== 'remove'">{{ rule.replacement }}</span>
            </span>
            <span v-else class="text-gray-400">{{ rule.pattern }} <span v-if="rule.replacement">➝
                {{ rule.replacement }}</span></span>
          </span>

          <button type="button" @click="removeRegexRule(idx)"
            class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16">
              </path>
            </svg>
          </button>
        </div>
        <div v-if="config.rename.regex.rules.length === 0"
          class="text-center text-gray-400 text-xs py-4 border-2 border-dashed border-gray-200 dark:border-gray-700 misub-radius-md">
          列表为空，请在上方添加规则
        </div>
      </div>
    </div>
  </div>

  <!-- 3. 智能重命名 (Template) -->
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
        <span>🏷️ 智能重命名</span>
        <span
          class="text-xs font-normal text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">Template
          引擎</span>
      </h4>
      <label class="inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
        <input type="checkbox" v-model="config.rename.template.enabled"
          class="mr-1 rounded text-indigo-600 focus:ring-indigo-500">
        启用重命名
      </label>
    </div>

    <div v-if="config.rename.template.enabled"
      class="bg-gray-50 dark:bg-gray-800/50 misub-radius-lg p-4 border border-gray-100 dark:border-gray-700">
      <!-- 快捷模板 -->
      <div class="flex flex-wrap gap-2 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        <span class="text-xs text-gray-500 self-center mr-1">⚡️ 快捷模板:</span>
        <button v-for="preset in templatePresets" :key="preset.label" @click="applyTemplate(preset.value)"
          :title="preset.desc"
          class="px-2 py-1 sm:px-2 sm:py-1 text-[12px] sm:text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 transition-colors !min-h-0 !min-w-0">{{
          preset.label }}</button>
      </div>

      <TagBuilder :template-config="config.rename.template" :insert-template-tag="insertTemplateTag" />
    </div>
  </div>

  <!-- 4. 智能去重 -->
  <div class="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
    <div class="flex items-center justify-between mb-2">
      <h4 class="text-sm font-bold text-gray-700 dark:text-gray-200">👯 智能去重</h4>
      <label class="inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
        <input type="checkbox" v-model="config.dedup.enabled"
          class="mr-1 rounded text-indigo-600 focus:ring-indigo-500">
        启用去重
      </label>
    </div>
    <div v-if="config.dedup.enabled"
      class="bg-gray-50 dark:bg-gray-800/50 misub-radius-lg p-4 border border-gray-100 dark:border-gray-700">
      <div class="flex items-center gap-2 mb-3">
        <span class="text-xs text-gray-600 dark:text-gray-400">去重模式:</span>
        <select v-model="config.dedup.mode"
          class="flex-1 px-2 py-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
          <option value="serverPort">服务器+端口 (推荐)</option>
          <option value="url">完整 URL</option>
        </select>
      </div>
      <div v-if="config.dedup.mode === 'serverPort'" class="space-y-3">
        <label class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <input type="checkbox" v-model="config.dedup.includeProtocol"
            class="rounded text-indigo-600 focus:ring-indigo-500">
          去重时区分协议
        </label>
        <div class="space-y-1">
          <span class="text-xs text-gray-600 dark:text-gray-400">协议优先级（逗号分隔，越靠前越优先保留）:</span>
          <input v-model="protocolOrderModel"
            class="w-full px-2 py-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="vless, trojan, vmess, hysteria2, ss, ssr">
        </div>
      </div>
      <p class="text-[10px] text-gray-400 mt-2">
        {{ config.dedup.mode === 'serverPort'
          ? '基于服务器地址和端口去重，可识别不同协议的相同节点'
          : '基于完整 URL 去重，仅移除完全相同的节点' }}
      </p>
    </div>
  </div>

  <!-- 5. 节点排序 -->
  <SortRuleEditor :config="config.sort" @update:config="config.sort = $event" />
</template>
