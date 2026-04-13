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

</script>

<template>
  <div class="space-y-6">
    <!-- Regex Rename -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <label class="text-[11px] font-bold text-gray-400 uppercase tracking-tight">正则替换</label>
        <div class="flex items-center gap-3">
          <button v-if="params.regex.enabled" @click="addRule" class="text-[10px] text-indigo-600 font-bold">+ 添加项</button>
          <button 
            @click="updateParam('regex', { ...params.regex, enabled: !params.regex.enabled })"
            :class="['text-[10px] font-medium transition-colors', params.regex.enabled ? 'text-indigo-600' : 'text-gray-300']"
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
              <button v-for="tag in ['{name}', '{protocol}', '{regionZh}', '{emoji}', '{index}', '{server}']" :key="tag"
                class="text-[9px] bg-white dark:bg-gray-800 text-teal-600 px-1.5 py-0.5 rounded border border-teal-100/30 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                @click="params.template.text += tag"
              >
                {{ tag }}
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
