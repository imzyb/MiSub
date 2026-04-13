<script setup>
import { ref, computed } from 'vue';
import FilterEditor from './components/FilterEditor.vue';
import RenameEditor from './components/RenameEditor.vue';
import SortEditor from './components/SortEditor.vue';
import DedupEditor from './components/DedupEditor.vue';

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  legacyData: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['update:modelValue']);

// Migration Logic
const canMigrate = computed(() => {
  return props.modelValue.length === 0 && props.legacyData && props.legacyData.enabled;
});

const migrateFromLegacy = () => {
    if (!props.legacyData) return;
    const config = props.legacyData;
    const ops = [];
    
    // 1. Filter
    const filter = config.filter;
    if (filter && (filter.include?.enabled || filter.exclude?.enabled || filter.protocols?.enabled || filter.regions?.enabled || filter.script?.enabled || filter.useless?.enabled)) {
        ops.push({ id: crypto.randomUUID(), type: 'filter', enabled: true, params: JSON.parse(JSON.stringify(filter)) });
    }

    // 2. Rename (Regex)
    const regex = config.rename?.regex;
    if (regex?.enabled && regex.rules?.length > 0) {
        ops.push({ id: crypto.randomUUID(), type: 'rename', enabled: true, params: { regex: JSON.parse(JSON.stringify(regex)) } });
    }

    // 3. Rename (Template)
    const template = config.rename?.template;
    if (template?.enabled) {
        ops.push({ id: crypto.randomUUID(), type: 'rename', enabled: true, params: { template: { enabled: true, text: template.template || '{emoji}{region}-{protocol}-{index}', offset: template.indexStart || 1 } } });
    }

    // 4. Script Rename
    const renameScript = config.rename?.script;
    if (renameScript?.enabled && renameScript.expression) {
        ops.push({ id: crypto.randomUUID(), type: 'script', enabled: true, params: { code: `return ($nodes) => { return $nodes.map(n => { n.name = (${renameScript.expression})(n.name, n); return n; }); }` } });
    }

    // 5. Dedup
    const dedup = config.dedup;
    if (dedup?.enabled) {
        ops.push({ id: crypto.randomUUID(), type: 'dedup', enabled: true, params: JSON.parse(JSON.stringify(dedup)) });
    }

    // 6. Sort
    const sort = config.sort;
    if (sort?.enabled && sort.keys?.length > 0) {
        ops.push({ id: crypto.randomUUID(), type: 'sort', enabled: true, params: JSON.parse(JSON.stringify(sort)) });
    }

    emit('update:modelValue', ops);
};

// Track which operator is expanded
const expandedIndex = ref(props.modelValue.length > 0 ? props.modelValue.length - 1 : null);

const toggleExpand = (index) => {
  expandedIndex.value = expandedIndex.value === index ? null : index;
};

const addOperator = (type) => {
  const newOp = {
    id: Math.random().toString(36).substring(2, 11),
    type,
    enabled: true,
    params: getInitialParams(type)
  };
  const newList = [...props.modelValue, newOp];
  emit('update:modelValue', newList);
  // Auto expand new operator
  expandedIndex.value = newList.length - 1;
};

const getInitialParams = (type) => {
  switch (type) {
    case 'filter': return { include: { enabled: false, rules: [] }, exclude: { enabled: false, rules: [] }, protocols: { enabled: false, values: [] }, regions: { enabled: false, values: [] } };
    case 'rename': return { regex: { enabled: false, rules: [] }, template: { enabled: false, text: '' } };
    case 'script': return { code: '', url: '' };
    case 'sort': return { keys: [{ key: 'region', order: 'asc', customOrder: [] }] };
    case 'dedup': return { mode: 'serverPort', includeProtocol: true, prefer: { protocolOrder: [] } };
    default: return {};
  }
};

const removeOperator = (index) => {
  const newList = [...props.modelValue];
  newList.splice(index, 1);
  emit('update:modelValue', newList);
  if (expandedIndex.value === index) expandedIndex.value = null;
};

const moveOperator = (event, index, direction) => {
  event.stopPropagation();
  const newList = [...props.modelValue];
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= newList.length) return;
  [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];
  emit('update:modelValue', newList);
  if (expandedIndex.value === index) expandedIndex.value = newIndex;
  else if (expandedIndex.value === newIndex) expandedIndex.value = index;
};

const toggleOperator = (event, index) => {
  event.stopPropagation();
  const newList = [...props.modelValue];
  newList[index] = { ...newList[index], enabled: !newList[index].enabled };
  emit('update:modelValue', newList);
};

const operatorLabels = {
  filter: '过滤节点',
  rename: '正则命名',
  script: '脚本执行',
  sort: '节点排序',
  dedup: '智能去重'
};

const getOperatorIcon = (type) => {
    switch (type) {
        case 'filter': return '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>';
        case 'rename': return '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>';
        case 'script': return '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>';
        case 'sort': return '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>';
        case 'dedup': return '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>';
        default: return '';
    }
};

</script>

<template>
  <div class="space-y-4">
    <!-- Migration Suggestion Card -->
    <div v-if="canMigrate" class="group relative mb-6 overflow-hidden rounded-xl border border-amber-200/50 bg-gradient-to-br from-amber-50 to-orange-50 p-5 dark:border-amber-500/20 dark:from-amber-900/10 dark:to-orange-900/10">
        <div class="relative z-10 flex items-center justify-between gap-4">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div>
                    <h4 class="text-sm font-bold text-amber-900 dark:text-amber-200">发现旧版配置</h4>
                    <p class="mt-0.5 text-[10px] text-amber-700/70 dark:text-amber-400/60">检测到您有旧版的“节点净化”规则，建议一键迁移至新的操作符链以获得更好的体验。</p>
                </div>
            </div>
            <button @click="migrateFromLegacy" class="whitespace-nowrap rounded-xl bg-amber-500 px-5 py-2 text-[11px] font-bold text-white shadow-md shadow-amber-500/20 transition-all hover:bg-amber-600 active:scale-95">
                立即迁移
            </button>
        </div>
        <!-- Decorative bg -->
        <div class="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
    </div>

    <div v-if="modelValue.length === 0 && !canMigrate" class="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/30 py-12 text-center dark:border-gray-800 dark:bg-gray-900/10">
      <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
      </div>
      <h3 class="text-sm font-bold text-gray-900 dark:text-white">开始链式处理</h3>
      <p class="mt-1 text-[10px] text-gray-500">添加操作符来定制您的订阅节点处理工作流。</p>
    </div>

    <div v-else class="space-y-2">
      <div v-for="(op, index) in modelValue" :key="op.id || index" 
        :class="[
            'group overflow-hidden rounded-2xl border bg-white transition-all dark:bg-gray-800',
            expandedIndex === index ? 'border-indigo-500/50 ring-4 ring-indigo-500/5 shadow-xl' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
            !op.enabled && 'opacity-60 grayscale-[0.5]'
        ]">
        <!-- Compact Header -->
        <div 
          @click="toggleExpand(index)"
          class="cursor-pointer select-none p-4 active:bg-gray-50 dark:active:bg-gray-900 sm:p-3"
        >
          <div class="flex items-start justify-between gap-3 sm:items-center">
          <div class="flex items-center gap-3 min-w-0">
             <div 
                :class="[
                    'w-8 h-8 flex items-center justify-center rounded-xl border shadow-sm transition-colors',
                    expandedIndex === index ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700 text-gray-400'
                ]" 
                v-html="getOperatorIcon(op.type)">
             </div>
             <div>
                 <div class="flex items-center gap-2">
                     <h4 class="font-bold text-sm text-gray-900 dark:text-white">{{ operatorLabels[op.type] }}</h4>
                    <span v-if="!op.enabled" class="rounded-full border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-400 dark:border-gray-700 dark:bg-gray-900">已暂停</span>
                 </div>
                 <p class="mt-1 text-[11px] text-gray-500 dark:text-gray-400 sm:hidden">
                   {{ op.enabled ? '启用中' : '未启用' }}
                 </p>
              </div>
           </div>
           
           <div class="flex items-center gap-2">
            <div class="flex items-center gap-1.5 pr-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button @click="(e) => moveOperator(e, index, -1)" class="rounded-md p-1 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 dark:hover:bg-indigo-500/10" :disabled="index === 0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" /></svg>
                </button>
                <button @click="(e) => moveOperator(e, index, 1)" class="rounded-md p-1 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 dark:hover:bg-indigo-500/10" :disabled="index === modelValue.length - 1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                <button @click="(e) => toggleOperator(e, index)" class="rounded-md p-1" :class="op.enabled ? 'text-indigo-500 hover:bg-orange-50 hover:text-orange-500 dark:hover:bg-orange-500/10' : 'text-gray-400 hover:bg-indigo-50 hover:text-indigo-500 dark:hover:bg-indigo-500/10'">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
                <button @click="(e) => { e.stopPropagation(); removeOperator(index); }" class="rounded-md p-1 text-gray-300 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              class="h-4 w-4 text-gray-300 transition-transform duration-300" 
              :class="{ 'rotate-180 text-indigo-500': expandedIndex === index }" 
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          </div>
        </div>

        <!-- Collapsible Content -->
        <transition
          enter-active-class="transition-[max-height,opacity] duration-300 ease-out"
          enter-from-class="max-h-0 opacity-0"
          enter-to-class="max-h-[800px] opacity-100"
          leave-active-class="transition-[max-height,opacity] duration-200 ease-in"
          leave-from-class="max-h-[800px] opacity-100"
          leave-to-class="max-h-0 opacity-0"
        >
          <div v-show="expandedIndex === index" class="border-t border-gray-100 dark:border-gray-700/50">
            <div class="p-4 sm:p-5">
              <FilterEditor v-if="op.type === 'filter'" v-model="op.params" />
              <RenameEditor v-else-if="op.type === 'rename'" v-model="op.params" />
              <SortEditor v-else-if="op.type === 'sort'" v-model="op.params" />
              <DedupEditor v-else-if="op.type === 'dedup'" v-model="op.params" />
              
              <div v-else-if="op.type === 'script'" class="space-y-4">
                 <input v-model="op.params.url" placeholder="远程脚本 URL（GitGist / Raw 链接）" class="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900" />
                 <textarea v-if="!op.params.url" v-model="op.params.code" placeholder="输入 JavaScript 代码...&#10;支持 $proxies、$context、$utils" class="h-40 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-mono text-[11px] focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900"></textarea>
              </div>

            </div>
          </div>
        </transition>
      </div>
    </div>

    <!-- Add Control (Segmented Style) -->
    <div class="pt-6">
        <div class="grid grid-cols-2 gap-2 rounded-2xl border border-gray-200 bg-gray-100/50 p-1 dark:border-gray-800 dark:bg-gray-900/50 sm:inline-flex sm:flex-wrap">
            <button v-for="(label, type) in operatorLabels" :key="type" 
                @click="addOperator(type)"
                class="rounded-xl px-4 py-2 text-xs font-bold text-gray-500 transition-all hover:bg-white hover:text-indigo-600 dark:hover:bg-gray-800 whitespace-nowrap"
            >
                + {{ label.split(' ')[0] }}
            </button>
        </div>
    </div>
  </div>
</template>

<style scoped>
.group:hover .hover-action {
    opacity: 1;
}
</style>
