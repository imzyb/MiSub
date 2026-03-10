<script setup>
import { computed, ref } from 'vue';
import draggable from 'vuedraggable';

const props = defineProps({
  config: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['update:config']);

// 可用的排序字段
const SORT_FIELDS = [
  { key: 'region', label: '🌍 地区', hasCustomOrder: true },
  { key: 'protocol', label: '🔌 协议', hasCustomOrder: true },
  { key: 'name', label: '📛 名称', hasCustomOrder: false },
  { key: 'server', label: '🖥️ 服务器', hasCustomOrder: false },
  { key: 'port', label: '🔢 端口', hasCustomOrder: false }
];

// 默认自定义顺序
const DEFAULT_CUSTOM_ORDERS = {
  region: ['香港', '台湾', '日本', '新加坡', '美国', '韩国', '英国', '德国', '法国', '加拿大', '澳大利亚', '俄罗斯', '印度', '巴西'],
  protocol: ['vless', 'trojan', 'vmess', 'hysteria2', 'ss', 'ssr', 'tuic']
};

// 当前排序规则
const sortKeys = computed({
  get: () => props.config.keys || [],
  set: (val) => {
    emit('update:config', { ...props.config, keys: val });
  }
});

// 拖拽用的列表（需要深拷贝避免直接修改 props）
const dragList = computed({
  get: () => sortKeys.value.map((item, idx) => ({ ...item, _id: idx })),
  set: (val) => {
    sortKeys.value = val.map(({ _id, ...rest }) => rest);
  }
});

// 当前编辑自定义顺序的字段
const editingField = ref(null);
const editingOrder = ref('');

// 可添加的字段（排除已存在的）
const availableFields = computed(() => {
  const existingKeys = new Set(sortKeys.value.map(k => k.key));
  return SORT_FIELDS.filter(f => !existingKeys.has(f.key));
});

// 获取字段标签
const getFieldLabel = (key) => {
  return SORT_FIELDS.find(f => f.key === key)?.label || key;
};

// 字段是否支持自定义顺序
const hasCustomOrder = (key) => {
  return SORT_FIELDS.find(f => f.key === key)?.hasCustomOrder || false;
};

// 切换排序方向
const toggleOrder = (index) => {
  const newKeys = [...sortKeys.value];
  newKeys[index] = {
    ...newKeys[index],
    order: newKeys[index].order === 'desc' ? 'asc' : 'desc'
  };
  sortKeys.value = newKeys;
};

// 添加排序字段
const addField = (fieldKey) => {
  const field = SORT_FIELDS.find(f => f.key === fieldKey);
  if (!field) return;
  const newItem = {
    key: fieldKey,
    order: 'asc',
    ...(field.hasCustomOrder ? { customOrder: DEFAULT_CUSTOM_ORDERS[fieldKey] || [] } : {})
  };
  sortKeys.value = [...sortKeys.value, newItem];
};

// 删除排序字段
const removeField = (index) => {
  const newKeys = [...sortKeys.value];
  newKeys.splice(index, 1);
  sortKeys.value = newKeys;
};

// 打开自定义顺序编辑
const openCustomOrderEditor = (index) => {
  const item = sortKeys.value[index];
  editingField.value = { index, key: item.key };
  editingOrder.value = (item.customOrder || DEFAULT_CUSTOM_ORDERS[item.key] || []).join('\n');
};

// 保存自定义顺序
const saveCustomOrder = () => {
  if (editingField.value === null) return;
  const { index } = editingField.value;
  const newOrder = editingOrder.value
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
  
  const newKeys = [...sortKeys.value];
  newKeys[index] = { ...newKeys[index], customOrder: newOrder };
  sortKeys.value = newKeys;
  
  editingField.value = null;
  editingOrder.value = '';
};

// 取消编辑
const cancelEdit = () => {
  editingField.value = null;
  editingOrder.value = '';
};
</script>

<template>
  <!-- 5. 节点排序 -->
  <div class="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
    <div class="flex items-center justify-between mb-2">
      <h4 class="text-sm font-bold text-gray-700 dark:text-gray-200">📶 节点排序</h4>
      <label class="inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
        <input type="checkbox" v-model="config.enabled"
          class="mr-1 rounded text-indigo-600 focus:ring-indigo-500">
        启用排序
      </label>
    </div>

    <div v-if="config.enabled"
      class="bg-gray-50 dark:bg-gray-800/50 misub-radius-lg p-4 border border-gray-100 dark:border-gray-700 space-y-4">
      
      <!-- 排序规则列表 -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-500 dark:text-gray-400">拖拽调整优先级，越靠前优先级越高</span>
        </div>
        
        <draggable
          v-model="dragList"
          item-key="_id"
          handle=".drag-handle"
          animation="200"
          class="space-y-2"
        >
          <template #item="{ element, index }">
            <div
              class="flex items-center gap-2 bg-white dark:bg-gray-700 p-2.5 misub-radius-md border border-gray-200 dark:border-gray-600 group hover:shadow-sm transition-shadow"
            >
              <!-- 拖拽手柄 -->
              <div class="drag-handle cursor-grab text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
                </svg>
              </div>

              <!-- 字段名称 -->
              <span class="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ getFieldLabel(element.key) }}
              </span>

              <!-- 升序/降序切换 -->
              <button
                @click="toggleOrder(index)"
                class="flex items-center gap-1 px-2 py-1 text-xs misub-radius-md transition-colors"
                :class="element.order === 'asc' 
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' 
                  : 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'"
              >
                <svg v-if="element.order === 'asc'" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                </svg>
                <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
                {{ element.order === 'asc' ? '升序' : '降序' }}
              </button>

              <!-- 自定义顺序按钮 -->
              <button
                v-if="hasCustomOrder(element.key)"
                @click="openCustomOrderEditor(index)"
                class="px-2 py-1 text-xs bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 misub-radius-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
              >
                自定义顺序
              </button>

              <!-- 删除按钮 -->
              <button
                @click="removeField(index)"
                class="text-red-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          </template>
        </draggable>

        <!-- 空状态 -->
        <div v-if="sortKeys.length === 0"
          class="text-center text-gray-400 text-xs py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 misub-radius-md">
          暂无排序规则，请点击下方添加
        </div>
      </div>

      <!-- 添加字段 -->
      <div v-if="availableFields.length > 0" class="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <span class="text-xs text-gray-500 dark:text-gray-400">添加字段:</span>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="field in availableFields"
            :key="field.key"
            @click="addField(field.key)"
            class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-indigo-100 hover:text-indigo-600 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400 transition-colors"
          >
            + {{ field.label }}
          </button>
        </div>
      </div>

      <!-- 其他选项 -->
      <div class="pt-2 border-t border-gray-200 dark:border-gray-700">
        <label class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <input type="checkbox" v-model="config.nameIgnoreEmoji"
            class="rounded text-indigo-600 focus:ring-indigo-500">
          排序时忽略国旗 Emoji
        </label>
      </div>
    </div>
  </div>

  <!-- 自定义顺序编辑弹窗 -->
  <Teleport to="body">
    <div v-if="editingField" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- 遮罩 -->
      <div class="absolute inset-0 bg-black/50" @click="cancelEdit"></div>
      
      <!-- 弹窗内容 -->
      <div class="relative w-full max-w-md bg-white dark:bg-gray-800 misub-radius-lg shadow-xl p-5 space-y-4">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">
          自定义{{ getFieldLabel(editingField.key) }}顺序
        </h3>
        
        <p class="text-xs text-gray-500 dark:text-gray-400">
          每行一个，越靠前优先级越高。未列出的项目将排在最后。
        </p>
        
        <textarea
          v-model="editingOrder"
          rows="10"
          class="w-full px-3 py-2 text-sm border misub-radius-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          placeholder="每行输入一个值..."
        ></textarea>
        
        <div class="flex justify-end gap-2">
          <button
            @click="cancelEdit"
            class="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 misub-radius-md transition-colors"
          >
            取消
          </button>
          <button
            @click="saveCustomOrder"
            class="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 misub-radius-md transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
