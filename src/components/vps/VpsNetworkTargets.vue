<script setup>
import { computed, ref } from 'vue';
import { createVpsNetworkTarget, updateVpsNetworkTarget, deleteVpsNetworkTarget } from '../../lib/api.js';
import { useToastStore } from '../../stores/toast.js';

const props = defineProps({
  nodeId: {
    type: String,
    required: true
  },
  targets: {
    type: Array,
    default: () => []
  },
  checkingTargets: {
    type: Object,
    default: () => ({})
  },
  allowCheck: {
    type: Boolean,
    default: true
  },
  limit: {
    type: Number,
    default: 3
  }
});

const emit = defineEmits(['refresh', 'check']);
const { showToast } = useToastStore();

const formState = ref({
  name: '',
  type: 'icmp',
  target: '',
  port: '',
  path: '/',
  scheme: 'https'
});

const sortKey = ref('type');
const sortDir = ref('asc');
const filterType = ref('all');
const filterQuery = ref('');
const isCreating = ref(false);
const pendingTargetIds = ref({});

const setPending = (targetId, pending) => {
  pendingTargetIds.value = {
    ...pendingTargetIds.value,
    [targetId]: pending
  };
};

const canAddMore = computed(() => props.targets.length < props.limit);

const filteredTargets = computed(() => {
  const keyword = filterQuery.value.trim().toLowerCase();
  return props.targets.filter((item) => {
    if (filterType.value !== 'all' && item.type !== filterType.value) return false;
    if (!keyword) return true;
    const text = `${item.name || ''} ${item.type} ${item.target} ${item.path || ''} ${item.port || ''}`.toLowerCase();
    return text.includes(keyword);
  });
});

const sortedTargets = computed(() => {
  const list = [...filteredTargets.value];
  const dir = sortDir.value === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    if (sortKey.value === 'status') {
      const av = a.enabled ? 1 : 0;
      const bv = b.enabled ? 1 : 0;
      return (av - bv) * dir;
    }
    if (sortKey.value === 'target') {
      return (a.target || '').localeCompare(b.target || '') * dir;
    }
    return (a.type || '').localeCompare(b.type || '') * dir;
  });
  return list;
});

const resetForm = () => {
  formState.value = { name: '', type: 'icmp', target: '', port: '', path: '/', scheme: 'https' };
};

const handleCreate = async () => {
  if (isCreating.value) return;
  if (!formState.value.target.trim()) {
    showToast('请输入目标地址', 'warning');
    return;
  }
  const payload = {
    name: formState.value.name,
    type: formState.value.type,
    target: formState.value.target,
    port: formState.value.type === 'tcp' ? Number(formState.value.port) : undefined,
    path: formState.value.type === 'http' ? formState.value.path || '/' : undefined,
    scheme: formState.value.type === 'http' ? formState.value.scheme || 'https' : undefined
  };
  isCreating.value = true;
  try {
    const result = await createVpsNetworkTarget(props.nodeId, payload);
    if (result.success) {
      showToast('目标已添加', 'success');
      resetForm();
      emit('refresh');
    } else {
      showToast(result.error || '添加失败', 'error');
    }
  } finally {
    isCreating.value = false;
  }
};

const handleToggle = async (target) => {
  if (pendingTargetIds.value[target.id]) return;
  setPending(target.id, true);
  try {
    const result = await updateVpsNetworkTarget(props.nodeId, { id: target.id, enabled: !target.enabled });
    if (result.success) {
      emit('refresh');
    } else {
      showToast(result.error || '更新失败', 'error');
    }
  } finally {
    setPending(target.id, false);
  }
};

const handleDelete = async (target) => {
  if (pendingTargetIds.value[target.id]) return;
  setPending(target.id, true);
  try {
    const result = await deleteVpsNetworkTarget(props.nodeId, target.id);
    if (result.success) {
      showToast('目标已删除', 'success');
      emit('refresh');
    } else {
      showToast(result.error || '删除失败', 'error');
    }
  } finally {
    setPending(target.id, false);
  }
};

const handleCheck = (target) => {
  if (!props.allowCheck) return;
  emit('check', target);
};

const isChecking = (target) => Boolean(props.checkingTargets?.[target.id]);
const isPending = (target) => Boolean(pendingTargetIds.value?.[target.id]);
const supportsCheck = computed(() => props.allowCheck);
</script>

<template>
  <div class="bg-white/90 dark:bg-gray-900/70 misub-radius-lg p-5 border border-gray-100/80 dark:border-white/10 space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">网络监测目标</h4>
        <p class="text-xs text-gray-500 dark:text-gray-400">支持 ICMP / TCP / HTTP</p>
      </div>
      <span class="text-xs text-gray-400">{{ targets.length }}/{{ limit }}</span>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-xs" v-if="targets.length">
      <select v-model="filterType" class="px-2.5 py-1.5 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg">
        <option value="all">全部类型</option>
        <option value="icmp">ICMP</option>
        <option value="tcp">TCP</option>
        <option value="http">HTTP</option>
      </select>
      <input v-model="filterQuery" placeholder="搜索目标" class="px-2.5 py-1.5 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg" />
      <select v-model="sortKey" class="px-2.5 py-1.5 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg">
        <option value="type">按类型</option>
        <option value="target">按目标</option>
        <option value="status">按状态</option>
      </select>
      <button
        type="button"
        class="px-2.5 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'"
      >
        {{ sortDir === 'asc' ? '升序' : '降序' }}
      </button>
    </div>

    <div class="space-y-2" v-if="sortedTargets.length">
      <div
        v-for="item in sortedTargets"
        :key="item.id"
        class="flex flex-col gap-3 rounded-lg border border-gray-200/70 bg-white/70 p-3 dark:border-white/10 dark:bg-gray-900/60 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="min-w-0">
          <div class="text-sm font-medium text-gray-900 dark:text-white">
            <span v-if="item.name" class="mr-1.5 px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold">{{ item.name }}</span>
            <span class="opacity-60 text-xs font-normal mr-1">[{{ item.type.toUpperCase() }}]</span>
            <span :class="{'text-xs opacity-70': item.name}">{{ item.target }}</span>
            <span v-if="item.port" class="text-xs opacity-70">:{{ item.port }}</span>
            <span v-if="item.path" class="text-xs opacity-70">{{ item.path }}</span>
          </div>
          <div class="text-[10px] text-gray-400 mt-0.5">{{ item.enabled ? '已启用监控' : '已停用' }}</div>
        </div>
        <div class="flex flex-wrap items-center gap-2 sm:justify-end">
          <button
            v-if="supportsCheck"
            class="px-2.5 py-1.5 text-xs border border-gray-200 dark:border-white/10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
            @click="handleCheck(item)"
            :disabled="isChecking(item) || isPending(item)"
          >
            {{ isChecking(item) ? '检测中...' : '立即检测' }}
          </button>
          <button
            class="px-2.5 py-1.5 text-xs border border-gray-200 dark:border-white/10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
            @click="handleToggle(item)"
            :disabled="isPending(item) || isChecking(item)"
          >
            {{ isPending(item) ? '处理中...' : (item.enabled ? '停用' : '启用') }}
          </button>
          <button
            class="px-2.5 py-1.5 text-xs text-rose-600 dark:text-rose-300 border border-rose-200/60 dark:border-rose-500/20 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
            @click="handleDelete(item)"
            :disabled="isPending(item) || isChecking(item)"
          >
            {{ isPending(item) ? '处理中...' : '删除' }}
          </button>
        </div>
      </div>
    </div>

    <div class="space-y-2" v-if="canAddMore">
      <div class="grid grid-cols-1 md:grid-cols-5 gap-2">
        <input v-model="formState.name" placeholder="名称 (如: 电信核心)" class="px-3 py-2 text-xs bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg" />
        <select v-model="formState.type" class="px-3 py-2 text-xs bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg">
          <option value="icmp">ICMP (Ping)</option>
          <option value="tcp">TCP (Port)</option>
          <option value="http">HTTP (Web)</option>
        </select>
        <input v-model="formState.target" placeholder="IP 或域名" class="px-3 py-2 text-xs bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg" />
        <input v-if="formState.type === 'tcp'" v-model="formState.port" placeholder="端口" class="px-3 py-2 text-xs bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg" />
        <div v-if="formState.type === 'http'" class="grid grid-cols-2 gap-2">
          <select v-model="formState.scheme" class="px-3 py-2 text-xs bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg">
            <option value="https">https</option>
            <option value="http">http</option>
          </select>
          <input v-model="formState.path" placeholder="路径" class="px-3 py-2 text-xs bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg" />
        </div>
        <button
          type="button"
          class="px-3 py-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
          @click="handleCreate"
          :disabled="isCreating"
        >
          {{ isCreating ? '添加中...' : '添加目标' }}
        </button>
      </div>
    </div>
    <div v-else class="text-xs text-gray-500">已达到目标上限</div>
  </div>
</template>
