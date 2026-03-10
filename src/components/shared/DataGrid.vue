/**
 * 共享数据表格组件
 * @author MiSub Team
 */

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  columns: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  height: {
    type: String,
    default: 'auto'
  },
  maxHeight: {
    type: String,
    default: ''
  },
  striped: {
    type: Boolean,
    default: true
  },
  bordered: {
    type: Boolean,
    default: false
  },
  hoverable: {
    type: Boolean,
    default: true
  },
  compact: {
    type: Boolean,
    default: false
  },
  emptyText: {
    type: String,
    default: '暂无数据'
  },
  showHeader: {
    type: Boolean,
    default: true
  },
  selectable: {
    type: Boolean,
    default: false
  },
  selectedRows: {
    type: Array,
    default: () => []
  },
  rowKey: {
    type: String,
    default: 'id'
  },
  pagination: {
    type: [Boolean, Object],
    default: false
  },
  pageSize: {
    type: Number,
    default: 10
  },
  currentPage: {
    type: Number,
    default: 1
  },
  total: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['update:selectedRows', 'rowClick', 'rowDblClick', 'selectionChange', 'pageChange', 'sortChange', 'filterChange']);

const selectedKeys = ref([]);
const sortField = ref('');
const sortOrder = ref(''); // 'asc', 'desc', ''

// 计算分页数据
const paginatedData = computed(() => {
  if (!props.pagination) return props.data;

  if (typeof props.pagination === 'object' && props.pagination.server) {
    return props.data; // 服务端分页，直接使用传入的数据
  }

  // 客户端分页
  const start = (props.currentPage - 1) * props.pageSize;
  const end = start + props.pageSize;
  return props.data.slice(start, end);
});

// 计算总页数
const totalPages = computed(() => {
  if (typeof props.pagination === 'object' && props.pagination.server) {
    return Math.ceil(props.total / props.pageSize);
  }
  return Math.ceil(props.data.length / props.pageSize);
});

// 表格样式
const tableClasses = computed(() => [
  'w-full',
  {
    'divide-y divide-gray-200 dark:divide-gray-700': props.bordered,
    'border border-gray-200 dark:border-gray-700': props.bordered
  }
]);

const headerClasses = computed(() => [
  'bg-gray-50 dark:bg-gray-800',
  {
    'sticky top-0 z-10': props.maxHeight || props.height !== 'auto'
  }
]);

const rowClasses = computed(() => (index) => [
  {
    'bg-white dark:bg-gray-900': !props.striped || index % 2 === 0,
    'bg-gray-50 dark:bg-gray-800': props.striped && index % 2 === 1,
    'hover:bg-gray-50 dark:hover:bg-gray-700': props.hoverable,
    'cursor-pointer': props.selectable
  }
]);

// 选择相关方法
const isRowSelected = (row) => {
  const key = row[props.rowKey];
  return selectedKeys.value.includes(key);
};

const toggleRowSelection = (row) => {
  if (!props.selectable) return;

  const key = row[props.rowKey];
  const index = selectedKeys.value.indexOf(key);

  if (index > -1) {
    selectedKeys.value.splice(index, 1);
  } else {
    selectedKeys.value.push(key);
  }

  const selectedRows = props.data.filter(row =>
    selectedKeys.value.includes(row[props.rowKey])
  );

  emit('update:selectedRows', selectedRows);
  emit('selectionChange', selectedRows);
};

const toggleAllSelection = () => {
  if (selectedKeys.value.length === paginatedData.value.length) {
    selectedKeys.value = [];
  } else {
    selectedKeys.value = paginatedData.value.map(row => row[props.rowKey]);
  }

  const selectedRows = props.data.filter(row =>
    selectedKeys.value.includes(row[props.rowKey])
  );

  emit('update:selectedRows', selectedRows);
  emit('selectionChange', selectedRows);
};

// 排序相关方法
const handleSort = (column) => {
  if (!column.sortable) return;

  if (sortField.value === column.key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : '';
    sortField.value = sortOrder.value ? column.key : '';
  } else {
    sortField.value = column.key;
    sortOrder.value = 'asc';
  }

  emit('sortChange', { field: sortField.value, order: sortOrder.value });
};

// 获取列值
const getColumnValue = (row, column) => {
  const value = column.render ? column.render(row) : row[column.key];
  return value !== undefined && value !== null ? value : '';
};

// 监听选中行变化
watch(() => props.selectedRows, (newVal) => {
  selectedKeys.value = newVal.map(row => row[props.rowKey]);
}, { immediate: true });

// 分页事件
const handlePageChange = (page) => {
  emit('pageChange', page);
};
</script>

<template>
  <div class="data-grid">
    <!-- 表格容器 -->
    <div
      class="overflow-hidden misub-radius-md border border-gray-200 dark:border-gray-700"
      :style="{ height, maxHeight }"
    >
      <div class="overflow-x-auto overflow-y-auto">
        <table :class="tableClasses">
          <!-- 表头 -->
          <thead v-if="showHeader" :class="headerClasses">
            <tr>
              <!-- 全选列 -->
              <th v-if="selectable" class="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  :checked="selectedKeys.length === paginatedData.length && paginatedData.length > 0"
                  :indeterminate="selectedKeys.length > 0 && selectedKeys.length < paginatedData.length"
                  class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  @change="toggleAllSelection"
                />
              </th>

              <!-- 数据列 -->
              <th
                v-for="column in columns"
                :key="column.key"
                :class="[
                  'px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider',
                  column.width ? `w-${column.width}` : '',
                  column.align === 'center' ? 'text-center' : '',
                  column.align === 'right' ? 'text-right' : ''
                ]"
              >
                <div class="flex items-center space-x-1">
                  <span>{{ column.title }}</span>

                  <!-- 排序图标 -->
                  <button
                    v-if="column.sortable"
                    class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    @click="handleSort(column)"
                  >
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5 12l5-5 5 5H5z" />
                      <path d="M15 8l-5 5-5-5h10z" />
                    </svg>
                  </button>
                </div>
              </th>
            </tr>
          </thead>

          <!-- 表体 -->
          <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            <!-- 加载状态 -->
            <tr v-if="loading">
              <td :colspan="columns.length + (selectable ? 1 : 0)" class="px-6 py-12 text-center">
                <div class="flex items-center justify-center space-x-2">
                  <svg class="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span class="text-gray-500 dark:text-gray-400">加载中...</span>
                </div>
              </td>
            </tr>

            <!-- 空数据状态 -->
            <tr v-else-if="paginatedData.length === 0">
              <td :colspan="columns.length + (selectable ? 1 : 0)" class="px-6 py-12 text-center">
                <div class="text-gray-500 dark:text-gray-400">
                  {{ emptyText }}
                </div>
              </td>
            </tr>

            <!-- 数据行 -->
            <tr
              v-else
              v-for="(row, index) in paginatedData"
              :key="row[rowKey]"
              :class="rowClasses(index)"
              @click="toggleRowSelection(row)"
              @dblclick="$emit('rowDblClick', row)"
            >
              <!-- 选择列 -->
              <td v-if="selectable" class="px-6 py-4">
                <input
                  type="checkbox"
                  :checked="isRowSelected(row)"
                  class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  @click.stop
                  @change="toggleRowSelection(row)"
                />
              </td>

              <!-- 数据列 -->
              <td
                v-for="column in columns"
                :key="column.key"
                :class="[
                  'px-6 py-4 whitespace-nowrap text-sm',
                  column.align === 'center' ? 'text-center' : '',
                  column.align === 'right' ? 'text-right' : '',
                  compact ? 'py-2' : ''
                ]"
              >
                <slot
                  :name="`column-${column.key}`"
                  :row="row"
                  :column="column"
                  :value="getColumnValue(row, column)"
                >
                  <span :class="column.className">
                    {{ getColumnValue(row, column) }}
                  </span>
                </slot>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="pagination && totalPages > 1" class="mt-4">
      <div class="flex items-center justify-between">
        <div class="text-sm text-gray-700 dark:text-gray-300">
          显示第 {{ (currentPage - 1) * pageSize + 1 }} 至 {{ Math.min(currentPage * pageSize, total) }} 项，共 {{ total }} 项
        </div>

        <div class="flex space-x-1">
          <button
            :disabled="currentPage <= 1"
            class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-l-md bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            @click="handlePageChange(currentPage - 1)"
          >
            上一页
          </button>

          <button
            v-for="page in Math.min(totalPages, 5)"
            :key="page"
            :class="[
              'px-3 py-2 text-sm border border-gray-300 dark:border-gray-600',
              currentPage === page
                ? 'bg-indigo-50 border-indigo-500 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300'
                : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
            ]"
            @click="handlePageChange(page)"
          >
            {{ page }}
          </button>

          <button
            :disabled="currentPage >= totalPages"
            class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-r-md bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            @click="handlePageChange(currentPage + 1)"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  </div>
</template>