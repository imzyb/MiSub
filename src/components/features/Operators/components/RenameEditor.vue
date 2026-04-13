<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['update:modelValue']);

// Local working copy with defaults
const params = computed({
  get: () => ({
    regex: { enabled: false, rules: [], ...props.modelValue.regex },
    template: { enabled: false, text: '', offset: 1, ...props.modelValue.template }
  }),
  set: (val) => emit('update:modelValue', val)
});

const updateParam = (key, value) => {
  const newParams = { ...params.value, [key]: value };
  emit('update:modelValue', newParams);
};

const addRule = () => {
  const current = { ...params.value.regex };
  current.rules = [...(current.rules || []), { pattern: '', replacement: '', flags: 'g' }];
  updateParam('regex', current);
};

const normalizeRuleFlags = (index) => {
  const current = { ...params.value.regex };
  current.rules = [...(current.rules || [])];
  const rule = current.rules[index];
  if (!rule) return;
  current.rules[index] = { ...rule, flags: 'gi' };
  updateParam('regex', current);
};

const removeRule = (index) => {
  const current = { ...params.value.regex };
  current.rules = [...current.rules];
  current.rules.splice(index, 1);
  updateParam('regex', current);
};

// 预设模板
const presetTemplates = [
  { name: '标准', template: '{emoji}{region}-{protocol}-{index:2}' },
  { name: '正则', template: '{emoji}{g1}-{g2}-{index:2}' },
  { name: '简洁', template: '{emoji}{regionZh} {index:2}' },
  { name: '名称', template: '{name}' },
];

const applyPresetTemplate = (tpl) => {
  const current = { ...params.value.template };
  current.enabled = true;
  current.text = tpl;
  updateParam('template', current);
};

// 预设正则
const presetRegexRules = [
  { name: '地区-机场-线路', pattern: '\\[(.*?)\\]-(.*?)-(.*?)', replacement: '' },
  { name: '提取后缀', pattern: '(.*?) -(.*?)$', replacement: '$1' },
];

const applyPresetRegex = (rule) => {
  const current = { ...params.value.regex };
  current.enabled = true;
  current.rules = [...(current.rules || []), { ...rule, flags: 'gi' }];
  updateParam('regex', current);
};

</script>

<template>
  <div class="space-y-6">
    <!-- Regex Rename -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <label class="text-[11px] font-bold text-gray-400 uppercase tracking-tight">正则替换</label>
          <div class="flex items-center gap-2">
            <div class="relative group/presets">
              <button class="text-[10px] text-gray-400 font-medium hover:text-indigo-600 transition-colors flex items-center gap-0.5">
                常用正则
                <svg xmlns="http://www.w3.org/2000/svg" class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div class="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover/presets:opacity-100 group-hover/presets:visible transition-all z-10 py-1">
                <button v-for="rule in presetRegexRules" :key="rule.name" @click="applyPresetRegex(rule)"
                  class="w-full text-left px-3 py-1.5 text-[10px] hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 transition-colors">
                  {{ rule.name }}
                </button>
              </div>
            </div>
            <button v-if="params.regex.enabled" @click="addRule" class="text-[10px] text-indigo-600 font-bold ml-1">+ 添加项</button>
            <button 
              @click="updateParam('regex', { ...params.regex, enabled: !params.regex.enabled })"
              :class="['text-[10px] font-medium transition-colors ml-2', params.regex.enabled ? 'text-indigo-600' : 'text-gray-300']"
            >
              {{ params.regex.enabled ? '已开启' : '关闭' }}
            </button>
          </div>
      </div>

      <div v-if="params.regex.enabled" class="space-y-2">
        <div v-for="(rule, idx) in params.regex.rules" :key="idx" 
          class="flex flex-col gap-2 p-3 bg-gray-50/50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800 relative group transition-all">
          <button 
            @click="removeRule(idx)"
            class="absolute top-2 right-2 p-1 text-gray-300 hover:text-rose-500 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 pr-6">
            <div class="space-y-1">
              <input 
                v-model="rule.pattern"
                @input="normalizeRuleFlags(idx)"
                placeholder="查找正则 (如: 香港-(.*))"
                class="w-full px-2 py-1.5 text-[11px] rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 outline-none focus:border-indigo-500/30"
              />
            </div>
            <div class="space-y-1">
              <input 
                v-model="rule.replacement"
                @input="normalizeRuleFlags(idx)"
                placeholder="替换为 (如: HK $1)"
                class="w-full px-2 py-1.5 text-[11px] rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 outline-none focus:border-indigo-500/30"
              />
            </div>
          </div>
        </div>
        <p class="px-1 text-[10px] text-gray-400">默认忽略大小写，并替换所有匹配内容，无需额外设置正则标志。</p>
        <div v-if="!params.regex.rules?.length" class="text-center py-2 text-[10px] text-gray-400 italic">
          暂无正则规则，点击上方“+ 添加项”
        </div>
      </div>
    </div>

    <!-- Template Rename -->
    <div class="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-800/50">
      <div class="flex items-center justify-between">
        <label class="text-[11px] font-bold text-gray-400 uppercase tracking-tight">模板重写</label>
        <button 
          @click="updateParam('template', { ...params.template, enabled: !params.template.enabled })"
          :class="['text-[10px] font-medium transition-colors', params.template.enabled ? 'text-teal-600' : 'text-gray-300']"
        >
          {{ params.template.enabled ? '已开启' : '关闭' }}
        </button>
      </div>

      <div v-if="params.template.enabled" class="space-y-3">
        <div class="p-3 bg-teal-50/20 dark:bg-teal-900/5 rounded-xl border border-teal-100/50 dark:border-teal-900/30">
          <div class="space-y-2">
            <input 
              v-model="params.template.text"
              placeholder="{emoji}{region}-{index}"
              class="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-gray-800 border border-teal-100/50 dark:border-teal-900/30 outline-none focus:ring-2 focus:ring-teal-500/10"
            />
            <div class="flex flex-wrap gap-1.5">
              <button v-for="tag in ['{name}', '{protocol}', '{regionZh}', '{region}', '{emoji}', '{index}', '{index:2}', '{g1}', '{g2}', '{g3}', '{server}']" :key="tag"
                class="text-[9px] bg-white dark:bg-gray-800 text-teal-600 px-1.5 py-0.5 rounded border border-teal-100/30 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                @click="params.template.text += tag"
              >
                {{ tag }}
              </button>
            </div>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-[9px] text-gray-400">推荐模板:</span>
              <button v-for="tpl in presetTemplates" :key="tpl.name" @click="applyPresetTemplate(tpl.template)"
                class="text-[9px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors">
                {{ tpl.name }}
              </button>
            </div>
          </div>
          
          <div class="flex items-center gap-2 mt-3 pt-3 border-t border-teal-100/20">
            <span class="text-[10px] text-teal-600/60 font-medium">起步索引</span>
            <input 
              v-model.number="params.template.offset"
              type="number"
              class="w-14 px-2 py-1 text-[10px] rounded bg-white dark:bg-gray-800 border border-teal-100/30 outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
