/**
 * 共享过滤面板组件
 * @author MiSub Team
 */

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  filters: {
    type: Array,
    required: true
  },
  values: {
    type: Object,
    default: () => ({})
  },
  collapsible: {
    type: Boolean,
    default: true
  },
  collapsed: {
    type: Boolean,
    default: false
  },
  columns: {
    type: Number,
    default: 3
  },
  showReset: {
    type: Boolean,
    default: true
  },
  showApply: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  inline: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:values', 'change', 'reset', 'apply', 'collapse-change']);

const isCollapsed = ref(props.collapsed);
const localValues = ref({ ...props.values });

// 计算网格列数
const gridColumns = computed(() => {
  const columnMap = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
  };
  return columnMap[props.columns] || columnMap[3];
});

// 计算过滤器值
const filterValue = computed(() => (filter) => {
  return localValues.value[filter.key] ?? filter.defaultValue ?? '';
});

// 监听props.values变化
watch(() => props.values, (newValues) => {
  localValues.value = { ...newValues };
}, { deep: true });

// 监听本地值变化
watch(localValues, (newValues) => {
  if (!props.showApply) {
    emit('update:values', newValues);
    emit('change', newValues);
  }
}, { deep: true });

// 监听折叠状态
watch(isCollapsed, (newVal) => {
  emit('collapse-change', newVal);
});

// 处理过滤器值变化
const handleFilterChange = (filter, value) => {
  localValues.value[filter.key] = value;

  // 特殊处理：对于数值范围和日期范围，需要格式化
  if (filter.type === 'number-range' && Array.isArray(value)) {
    const [min, max] = value;
    if (min !== undefined && max !== undefined) {
      localValues.value[filter.key] = { min, max };
    }
  } else if (filter.type === 'date-range' && Array.isArray(value)) {
    const [start, end] = value;
    if (start && end) {
      localValues.value[filter.key] = { start, end };
    }
  }
};

// 重置过滤器
const resetFilters = () => {
  const defaultValues = {};
  props.filters.forEach(filter => {
    defaultValues[filter.key] = filter.defaultValue ?? (filter.type === 'select' ? '' : '');
  });
  localValues.value = defaultValues;

  if (props.showApply) {
    emit('update:values', defaultValues);
    emit('change', defaultValues);
  }

  emit('reset');
};

// 应用过滤器
const applyFilters = () => {
  emit('update:values', localValues.value);
  emit('change', localValues.value);
  emit('apply');
};

// 获取过滤器的显示值
const getDisplayValue = (filter) => {
  const value = filterValue.value(filter);

  if (filter.type === 'select' && filter.options) {
    const option = filter.options.find(opt => opt.value === value);
    return option ? option.label : value;
  }

  if (filter.type === 'daterange' && value) {
    return `${value.start} - ${value.end}`;
  }

  if (filter.type === 'number-range' && value) {
    return `${value.min} - ${value.max}`;
  }

  return value;
};

// 渲染不同类型的过滤器
const renderFilter = (filter) => {
  const value = filterValue.value(filter);

  switch (filter.type) {
    case 'text':
    case 'search':
      return {
        tag: 'input',
        type: 'text',
        placeholder: filter.placeholder,
        value,
        onInput: (e) => handleFilterChange(filter, e.target.value)
      };

    case 'number':
      return {
        tag: 'input',
        type: 'number',
        placeholder: filter.placeholder,
        value,
        onInput: (e) => handleFilterChange(filter, Number(e.target.value))
      };

    case 'select':
      return {
        tag: 'select',
        value,
        onChange: (e) => handleFilterChange(filter, e.target.value)
      };

    case 'multiselect':
      return {
        tag: 'select',
        multiple: true,
        value: Array.isArray(value) ? value : [],
        onChange: (e) => {
          const selected = Array.from(e.target.selectedOptions, option => option.value);
          handleFilterChange(filter, selected);
        }
      };

    case 'daterange':
      return {
        tag: 'div',
        children: 'date range input' // 需要自定义实现
      };

    case 'number-range':
      return {
        tag: 'div',
        children: 'number range input' // 需要自定义实现
      };

    case 'checkbox':
      return {
        tag: 'input',
        type: 'checkbox',
        checked: Boolean(value),
        onChange: (e) => handleFilterChange(filter, e.target.checked)
      };

    default:
      return {
        tag: 'input',
        type: 'text',
        value,
        onInput: (e) => handleFilterChange(filter, e.target.value)
      };
  }
};

// 切换折叠状态
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
};
</script>

<template>
  <div class="filter-panel" :class="{ 'filter-panel--inline': inline }">
    <!-- 过滤器容器 -->
    <div
      :class="[
        'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700',
        inline ? 'p-4' : 'p-6'
      ]"
    >
      <!-- 头部 -->
      <div
        v-if="collapsible || showReset || showApply || $slots.header"
        class="flex items-center justify-between mb-4"
      >
        <div class="flex items-center space-x-2">
          <h3 v-if="$slots.header || !inline" class="text-lg font-medium text-gray-900 dark:text-white">
            <slot name="header">
              {{ inline ? '' : '过滤器' }}
            </slot>
          </h3>
        </div>

        <div class="flex items-center space-x-2">
<!-- 折叠按钮 -->
<button
v-if="collapsible"
type="button"
class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
@click="toggleCollapse"
:aria-expanded="!isCollapsed"
aria-label="展开或收起过滤器"
>
<svg
class="w-4 h-4 transition-transform"
:class="{ 'rotate-180': !isCollapsed }"
fill="none"
stroke="currentColor"
viewBox="0 0 24 24"
aria-hidden="true"
>
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
</svg>
</button>

<!-- 重置按钮 -->
<button
v-if="showReset"
type="button"
:disabled="loading"
class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
@click="resetFilters"
aria-label="重置所有过滤条件"
>
重置
</button>

<!-- 应用按钮 -->
<button
v-if="showApply"
type="button"
:disabled="loading"
class="px-3 py-1.5 text-sm border border-transparent rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
@click="applyFilters"
aria-label="应用过滤条件"
>
应用
</button>
        </div>
      </div>

      <!-- 过滤器内容 -->
      <div
        v-show="!isCollapsed"
        :class="[
          'gap-4',
          inline ? 'flex flex-wrap' : `grid ${gridColumns}`
        ]"
      >
        <div
          v-for="filter in filters"
          :key="filter.key"
          class="filter-item"
        >
          <!-- 标签 -->
          <label
            v-if="filter.label"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {{ filter.label }}
          </label>

          <!-- 输入控件 -->
          <div class="filter-input">
            <!-- 文本输入 -->
            <input
              v-if="filter.type === 'text' || filter.type === 'search'"
              :type="filter.type === 'search' ? 'search' : 'text'"
              :placeholder="filter.placeholder"
              :value="filterValue(filter)"
              :disabled="loading || filter.disabled"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
              @input="handleFilterChange(filter, $event.target.value)"
            />

            <!-- 数字输入 -->
            <input
              v-else-if="filter.type === 'number'"
              type="number"
              :placeholder="filter.placeholder"
              :value="filterValue(filter)"
              :disabled="loading || filter.disabled"
              :min="filter.min"
              :max="filter.max"
              :step="filter.step"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
              @input="handleFilterChange(filter, Number($event.target.value))"
            />

            <!-- 选择器 -->
            <select
              v-else-if="filter.type === 'select'"
              :value="filterValue(filter)"
              :disabled="loading || filter.disabled"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
              @change="handleFilterChange(filter, $event.target.value)"
            >
              <option value="">{{ filter.placeholder || '请选择...' }}</option>
              <option
                v-for="option in filter.options"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>

            <!-- 多选器 -->
            <select
              v-else-if="filter.type === 'multiselect'"
              multiple
              :value="Array.isArray(filterValue(filter)) ? filterValue(filter) : []"
              :disabled="loading || filter.disabled"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
              @change="handleFilterChange(filter, Array.from($event.target.selectedOptions, option => option.value))"
            >
              <option
                v-for="option in filter.options"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>

            <!-- 复选框 -->
            <label
              v-else-if="filter.type === 'checkbox'"
              class="flex items-center space-x-2 cursor-pointer"
            >
              <input
                type="checkbox"
                :checked="Boolean(filterValue(filter))"
                :disabled="loading || filter.disabled"
                class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                @change="handleFilterChange(filter, $event.target.checked)"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ filter.checkboxLabel }}</span>
            </label>

            <!-- 自定义过滤器 -->
            <slot
              v-else
              :name="`filter-${filter.key}`"
              :filter="filter"
              :value="filterValue(filter)"
              :onChange="(value) => handleFilterChange(filter, value)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-panel--inline {
  @apply border-none bg-transparent p-0;
}

.filter-input {
  @apply relative;
}
</style>
