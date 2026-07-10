<script setup>
import { computed } from 'vue';
import { useI18n } from '../../../../i18n/index.js';
import draggable from 'vuedraggable';

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['update:modelValue']);
const { t } = useI18n();

const params = computed({
  get: () => ({
    keys: [],
    ...props.modelValue
  }),
  set: (val) => emit('update:modelValue', val)
});

const updateKeys = (updater) => {
  const currentKeys = Array.isArray(params.value.keys) ? params.value.keys : [];
  params.value = {
    ...params.value,
    keys: updater([...currentKeys])
  };
};

const addKey = () => {
  updateKeys(keys => [...keys, { key: 'name', order: 'asc', customOrder: [] }]);
};

const removeKey = (index) => {
  updateKeys(keys => {
    keys.splice(index, 1);
    return keys;
  });
};

const moveKey = (index, dir) => {
  updateKeys(keys => {
    const target = index + dir;
    if (target < 0 || target >= keys.length) return keys;
    [keys[index], keys[target]] = [keys[target], keys[index]];
    return keys;
  });
};

const updateKeyField = (index, field, value) => {
  updateKeys(keys => {
    const current = keys[index];
    if (!current) return keys;
    let next = { ...current, [field]: value };
    if (field === 'key') {
      if (value === 'region') {
        next.customOrder = ['香港', '台湾', '日本', '新加坡', '美国', '韩国', '英国', '德国', '法国', '加拿大'];
      } else if (value === 'protocol') {
        next.customOrder = ['vless', 'trojan', 'vmess', 'hysteria2', 'ss', 'ssr', 'anytls'];
      } else {
        next.customOrder = [];
      }
    }
    keys[index] = next;
    return keys;
  });
};

const getRegionEmoji = (region) => {
  if (!region) return '🌐';
  const regionMap = {
    '香港': '🇭🇰', '台湾': '🇨🇳', '日本': '🇯🇵', '美国': '🇺🇸', '新加坡': '🇸🇬',
    '韩国': '🇰🇷', '英国': '🇬🇧', '德国': '🇩🇪', '法国': '🇫🇷', '俄罗斯': '🇷🇺',
    '加拿大': '🇨🇦', '澳门': '🇲🇴', '中国': '🇨🇳', '印度': '🇮🇳', '荷兰': '🇳🇱',
    '澳大利亚': '🇦🇺', '泰国': '🇹🇭', '越南': '🇻🇳', '印尼': '🇮🇩', '马来西亚': '🇲🇾',
    '菲律宾': '🇵🇭', '土耳其': '🇹🇷'
  };
  return regionMap[region] || '🌍';
};

const getTagsList = (item) => {
  return (item.customOrder || []).map(val => ({ id: val, name: val }));
};

const handleDragEnd = (idx, newOrder) => {
  updateKeys(keys => {
    const current = keys[idx];
    if (!current) return keys;
    keys[idx] = {
      ...current,
      customOrder: newOrder.map(item => item.name)
    };
    return keys;
  });
};

const resetToDefaultOrder = (idx, keyType) => {
  updateKeys(keys => {
    const current = keys[idx];
    if (!current) return keys;
    const defaults = keyType === 'region' 
      ? ['香港', '台湾', '日本', '新加坡', '美国', '韩国', '英国', '德国', '法国', '加拿大']
      : ['vless', 'trojan', 'vmess', 'hysteria2', 'ss', 'ssr', 'anytls'];
    keys[idx] = { ...current, customOrder: defaults };
    return keys;
  });
};

const availableKeys = [
  { value: 'name', labelKey: 'operators.sortKeyName' },
  { value: 'group', labelKey: 'operators.sortKeyGroup' },
  { value: 'region', labelKey: 'operators.sortKeyRegion' },
  { value: 'protocol', labelKey: 'operators.sortKeyProtocol' },
  { value: 'server', labelKey: 'operators.sortKeyServer' },
  { value: 'port', labelKey: 'operators.sortKeyPort' }
];

const regionLabels = {
  '香港': 'Hong Kong',
  '台湾': 'Taiwan',
  '日本': 'Japan',
  '新加坡': 'Singapore',
  '美国': 'United States',
  '韩国': 'South Korea',
  '英国': 'United Kingdom',
  '德国': 'Germany',
  '法国': 'France',
  '加拿大': 'Canada'
};
const displayTagName = (item, name) => item.key === 'region' ? `${getRegionEmoji(name)} ${t('operators.regionLabel', { region: regionLabels[name] || name })}` : name;

</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <label class="text-[11px] font-bold text-gray-400 uppercase tracking-tight">{{ t('operators.sortWeights') }}</label>
      <button @click="addKey" class="text-[10px] text-indigo-600 font-bold">+ {{ t('operators.addCondition') }}</button>
    </div>

    <div class="space-y-1.5">
      <div v-for="(item, idx) in params.keys" :key="idx" 
        class="flex flex-col gap-2 p-2 bg-gray-50/50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800 transition-all">
        
        <div class="flex items-center gap-2">
          <div class="flex flex-col">
            <button @click="moveKey(idx, -1)" class="text-gray-300 hover:text-indigo-500 disabled:opacity-20" :disabled="idx === 0">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M5 15l7-7 7 7" /></svg>
            </button>
            <button @click="moveKey(idx, 1)" class="text-gray-300 hover:text-indigo-500 disabled:opacity-20" :disabled="idx === params.keys.length - 1">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>

          <select :value="item.key" @change="updateKeyField(idx, 'key', $event.target.value)" class="flex-1 bg-transparent border-none p-0 text-[11px] font-medium text-gray-900 dark:text-gray-100 focus:ring-0 outline-none">
            <option v-for="k in availableKeys" :key="k.value" :value="k.value" class="bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100">{{ t(k.labelKey) }}</option>
          </select>

          <select :value="item.order" @change="updateKeyField(idx, 'order', $event.target.value)" class="w-14 bg-transparent border-none p-0 text-[11px] text-gray-600 dark:text-gray-300 focus:ring-0 outline-none">
            <option value="asc" class="bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100">{{ t('operators.ascending') }}</option>
            <option value="desc" class="bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100">{{ t('operators.descending') }}</option>
          </select>

          <button @click="removeKey(idx)" class="p-1 text-gray-300 hover:text-rose-500">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- Custom Order Editor Section -->
        <div v-if="item.key === 'region' || item.key === 'protocol'" 
             class="mt-0.5 p-2 bg-white dark:bg-gray-950 rounded-lg border border-gray-100 dark:border-gray-900 space-y-2">
            
            <div class="flex items-center justify-between text-[10px]">
                <span class="font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tight flex items-center gap-1">
                  {{ t('operators.customPriorityOrder', { type: t(item.key === 'region' ? 'operators.sortKeyRegion' : 'operators.sortKeyProtocol') }) }}
                </span>
                <button @click="resetToDefaultOrder(idx, item.key)" class="text-indigo-500 hover:text-indigo-600 font-bold">
                  {{ t('operators.resetDefault') }}
                </button>
            </div>

            <!-- Drag and Drop Tags List -->
            <draggable
                :model-value="getTagsList(item)"
                @update:model-value="newOrder => handleDragEnd(idx, newOrder)"
                item-key="id"
                animation="200"
                class="flex flex-wrap gap-1.5"
            >
                <template #item="{ element }">
                    <div class="cursor-grab active:cursor-grabbing inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50/60 dark:bg-indigo-500/10 border border-indigo-100/50 dark:border-indigo-500/20 text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-100/80 dark:hover:bg-indigo-500/20 transition-colors select-none">
                        <span>{{ displayTagName(item, element.name) }}</span>
                    </div>
                </template>
            </draggable>
            
            <div v-if="!(item.customOrder || []).length" class="text-[9px] text-gray-400 italic">
              {{ t('operators.emptyPriorityItems') }}
            </div>
        </div>
      </div>

      <div v-if="params.keys.length === 0" class="text-center py-2 text-[10px] text-gray-400 italic">
        {{ t('operators.emptySortConditions') }}
      </div>
    </div>
    <p class="text-[10px] text-gray-400">{{ t('operators.sortHint') }}</p>
  </div>
</template>
