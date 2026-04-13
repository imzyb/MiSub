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
    include: { enabled: false, rules: [], ...props.modelValue.include },
    exclude: { enabled: false, rules: [], ...props.modelValue.exclude },
    protocols: { enabled: false, values: [], ...props.modelValue.protocols },
    regions: { enabled: false, values: [], ...props.modelValue.regions }
  }),
  set: (val) => emit('update:modelValue', val)
});

const updateParam = (key, value) => {
  const newParams = { ...params.value, [key]: value };
  emit('update:modelValue', newParams);
};

const addRule = (type) => {
  const current = { ...params.value[type] };
  current.rules = [...(current.rules || []), { pattern: '', flags: 'i' }];
  updateParam(type, current);
};

const normalizeRuleFlags = (type, index) => {
  const current = { ...params.value[type] };
  current.rules = [...(current.rules || [])];
  const rule = current.rules[index];
  if (!rule) return;
  current.rules[index] = { ...rule, flags: 'i' };
  updateParam(type, current);
};

const removeRule = (type, index) => {
  const current = { ...params.value[type] };
  current.rules = [...current.rules];
  current.rules.splice(index, 1);
  updateParam(type, current);
};

const commonProtocols = ['vless', 'vmess', 'trojan', 'ss', 'hysteria2', 'socks'];
const commonRegions = ['香港', '美国', '日本', '新加坡', '台湾', '韩国', '英国', '德国'];

const toggleValue = (type, value) => {
  const current = { ...params.value[type] };
  const values = new Set(current.values || []);
  if (values.has(value)) {
    values.delete(value);
  } else {
    values.add(value);
  }
  current.values = Array.from(values);
  updateParam(type, current);
};

</script>

<template>
  <div class="space-y-5">
    <!-- Protocol & Region Filter Layer -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Protocol -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-[11px] font-bold text-gray-400 uppercase tracking-tight">协议限制</label>
            <button 
              @click="updateParam('protocols', { ...params.protocols, enabled: !params.protocols.enabled })"
              :class="['text-[10px] font-medium transition-colors', params.protocols.enabled ? 'text-indigo-600' : 'text-gray-300']"
            >
              {{ params.protocols.enabled ? '已开启' : '关闭' }}
            </button>
          </div>
          <div v-if="params.protocols.enabled" class="flex flex-wrap gap-1.5 p-2 bg-gray-50/50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800">
            <button 
              v-for="p in commonProtocols" :key="p"
              @click="toggleValue('protocols', p)"
              :class="[
                'px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all',
                params.protocols.values?.includes(p)
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-100 dark:border-gray-700'
              ]"
            >
              {{ p }}
            </button>
          </div>
        </div>

        <!-- Region -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-[11px] font-bold text-gray-400 uppercase tracking-tight">地区限制</label>
            <button 
              @click="updateParam('regions', { ...params.regions, enabled: !params.regions.enabled })"
              :class="['text-[10px] font-medium transition-colors', params.regions.enabled ? 'text-indigo-600' : 'text-gray-300']"
            >
              {{ params.regions.enabled ? '已开启' : '关闭' }}
            </button>
          </div>
          <div v-if="params.regions.enabled" class="flex flex-wrap gap-1.5 p-2 bg-gray-50/50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700">
            <button 
              v-for="r in commonRegions" :key="r"
              @click="toggleValue('regions', r)"
              :class="[
                'px-2 py-1 rounded-md text-[10px] font-bold transition-all',
                params.regions.values?.includes(r)
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-100 dark:border-gray-700'
              ]"
            >
              {{ r }}
            </button>
          </div>
        </div>
    </div>

    <!-- Name Rules (Include/Exclude) -->
    <div v-for="type in ['include', 'exclude']" :key="type" class="space-y-2">
        <div class="flex items-center justify-between">
            <label class="text-[11px] font-bold text-gray-400 uppercase tracking-tight">
                {{ type === 'include' ? '包含节点 (正则)' : '排除节点 (正则)' }}
            </label>
            <div class="flex items-center gap-3">
                <button v-if="params[type].enabled" @click="addRule(type)" class="text-[10px] text-indigo-600 font-bold">+ 添加</button>
                <button 
                    @click="updateParam(type, { ...params[type], enabled: !params[type].enabled })"
                    :class="['text-[10px] font-medium', params[type].enabled ? 'text-indigo-600' : 'text-gray-300']"
                >
                    {{ params[type].enabled ? '已开启' : '关闭' }}
                </button>
            </div>
        </div>

        <div v-if="params[type].enabled" class="space-y-1.5">
            <div v-for="(rule, idx) in params[type].rules" :key="idx" class="flex items-center gap-2 group">
                <input 
                    v-model="rule.pattern"
                    @input="normalizeRuleFlags(type, idx)"
                    placeholder="正则表达式 (如: 香港|HK)"
                    class="flex-1 px-3 py-1.5 text-[11px] rounded-lg bg-gray-50 dark:bg-gray-900 border border-transparent focus:bg-white dark:focus:bg-gray-800 focus:border-indigo-500/30 transition-all outline-none"
                />
                <button @click="removeRule(type, idx)" class="p-1.5 text-gray-300 hover:text-rose-500">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <p class="text-[10px] text-gray-400 px-1">默认忽略大小写，无需额外设置正则标志。</p>
            <div v-if="!params[type].rules?.length" class="text-center py-2 text-[10px] text-gray-400 italic">
                点击上方“+ 添加”开始编写过滤规则
            </div>
        </div>
    </div>
  </div>
</template>
