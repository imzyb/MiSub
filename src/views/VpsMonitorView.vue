<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useToastStore } from '../stores/toast.js';
import { fetchVpsNodes, createVpsNode, updateVpsNode, deleteVpsNode, fetchVpsAlerts, clearVpsAlerts, fetchVpsNodeDetail, saveSettings, fetchSettings, requestVpsNetworkCheck } from '../lib/api.js';
import DataGrid from '../components/shared/DataGrid.vue';
import Modal from '../components/forms/Modal.vue';
import VpsMetricChart from '../components/vps/VpsMetricChart.vue';
import VpsNetworkTargets from '../components/vps/VpsNetworkTargets.vue';
import VpsMonitorSettingsModal from '../components/modals/VpsMonitorSettingsModal.vue';
import Switch from '../components/ui/Switch.vue';
import { useSettingsStore } from '../stores/settings.js';

const { showToast } = useToastStore();
const { config, updateConfig } = useSettingsStore();

const isLoading = ref(false);
const nodes = ref([]);
const alerts = ref([]);
const nodesError = ref('');
const alertsError = ref('');
const alertFilterType = ref('all');
const alertFilterQuery = ref('');
const selectedGroup = ref('全部');

const groups = computed(() => {
  const g = new Set(['全部']);
  nodes.value.forEach(n => {
    if (n.groupTag) g.add(n.groupTag);
  });
  return Array.from(g);
});

const filteredNodes = computed(() => {
  if (selectedGroup.value === '全部') return nodes.value;
  return nodes.value.filter(n => n.groupTag === selectedGroup.value);
});

const showCreateModal = ref(false);
const showEditModal = ref(false);
const showGuideModal = ref(false);
const showDeleteModal = ref(false);
const showDetailModal = ref(false);
const showSettingsModal = ref(false);
const showAlertsModal = ref(false);

const isSavingSettings = ref(false);
const isCreatingNode = ref(false);
const isUpdatingNode = ref(false);
const isDeletingNode = ref(false);
const isResettingSecret = ref(false);
const isRefreshing = ref(false);

const editingNode = ref(null);
const guidePayload = ref(null);
const detailPayload = ref(null);
const detailReports = ref([]);
const detailNetworkSamples = ref([]);
const detailTargets = ref([]);
const checkingTargets = ref({});
const detailError = ref('');
const isDetailLoading = ref(false);
const detailRange = ref('24h');
const detailAggregation = ref('avg');
const detailSection = ref('overview');

const alertPage = ref(1);
const alertPageSize = 8;

const formState = ref({
  name: '',
  tag: '',
  groupTag: '',
  region: '',
  description: '',
  enabled: true,
  secret: '',
  useGlobalTargets: false,
  trafficLimitGb: 0
});

const statusBadge = (status) => {
  if (status === 'online') return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300';
  if (status === 'offline') return 'bg-rose-500/15 text-rose-600 dark:text-rose-300';
  return 'bg-slate-500/10 text-slate-500 dark:text-slate-300';
};

const metricsBadge = (value, threshold) => {
  if (value === null || value === undefined) return 'text-slate-400';
  return value >= threshold
    ? 'text-rose-600 dark:text-rose-300'
    : 'text-emerald-600 dark:text-emerald-300';
};

const metricThresholds = {
  cpu: 90,
  mem: 90,
  disk: 90
};

const createEmptyNodeForm = () => ({
  name: '',
  tag: '',
  groupTag: '',
  region: '',
  description: '',
  enabled: true,
  secret: '',
  useGlobalTargets: false,
  trafficLimitGb: 0
});

const getFlagFallback = (event) => {
  event.target.style.display = 'none';
};

const getTrafficUsageWidth = (node) => {
  if (!node?.trafficLimitGb) return '100%';
  const totalBytes = node.trafficLimitGb * 1024 * 1024 * 1024;
  const usedBytes = node.totalRx + node.totalTx;
  return `${Math.min(100, (usedBytes / totalBytes) * 100)}%`;
};

const columns = computed(() => [
  { key: 'name', title: '节点', sortable: false },
  { key: 'groupTag', title: '分组', sortable: false },
  { key: 'status', title: '状态', sortable: false, align: 'center' },
  { key: 'metrics', title: '资源', sortable: false },
  { key: 'lastSeenAt', title: '最近上报', sortable: false },
  { key: 'actions', title: '操作', sortable: false, align: 'right', sticky: 'right' }
]);

const loadData = async () => {
  isLoading.value = true;
  isRefreshing.value = true;
  nodesError.value = '';
  alertsError.value = '';
  try {
    const [nodesResult, alertsResult] = await Promise.all([fetchVpsNodes(), fetchVpsAlerts()]);
    if (nodesResult.success) {
      nodes.value = nodesResult.data.data || [];
    } else {
      nodes.value = [];
      nodesError.value = nodesResult.error || '加载节点失败';
      showToast(nodesResult.error || '加载节点失败', 'error');
    }
    if (alertsResult.success) {
      alerts.value = alertsResult.data.data || [];
      alertPage.value = 1;
    } else {
      alerts.value = [];
      alertsError.value = alertsResult.error || '加载告警失败';
    }
  } catch (error) {
    const message = error.message || '加载数据失败';
    nodes.value = [];
    alerts.value = [];
    nodesError.value = message;
    alertsError.value = message;
    showToast(message, 'error');
  } finally {
    isLoading.value = false;
    isRefreshing.value = false;
  }
};

const resetForm = () => {
  formState.value = createEmptyNodeForm();
};

const openCreate = () => {
  resetForm();
  showCreateModal.value = true;
};

const openSettings = async () => {
  const result = await fetchSettings();
  if (result.success) {
    updateConfig(result.data);
  }
  showSettingsModal.value = true;
};

const handleSettingsSave = async () => {
  if (isSavingSettings.value) return;
  isSavingSettings.value = true;
  const payload = config.value || config;
  const result = await saveSettings(payload);
  if (result?.success === false) {
    showToast(result.error || result.message || '保存设置失败', 'error');
    isSavingSettings.value = false;
    return;
  }
  updateConfig(result?.data?.data || payload);
  showToast('设置已保存', 'success');
  showSettingsModal.value = false;
  isSavingSettings.value = false;
};

const openEdit = (node) => {
  editingNode.value = node;
  formState.value = {
    name: node.name,
    tag: node.tag,
    groupTag: node.groupTag || '',
    region: node.region,
    description: node.description,
    enabled: node.enabled,
    secret: node.secret,
    useGlobalTargets: node.useGlobalTargets,
    trafficLimitGb: node.trafficLimitGb || 0
  };
  showEditModal.value = true;
};

const openGuide = async (node, guide) => {
  editingNode.value = node;
  if (!guide) {
    const result = await fetchVpsNodeDetail(node.id);
    if (result.success) {
      guidePayload.value = result.data?.guide || null;
      showGuideModal.value = true;
      return;
    }
    showToast(result.error || '加载安装信息失败', 'error');
    return;
  }
  guidePayload.value = guide;
  showGuideModal.value = true;
};

const openDelete = (node) => {
  editingNode.value = node;
  showDeleteModal.value = true;
};

const applyDetailResult = (result) => {
  if (result.success) {
    detailPayload.value = result.data.data || null;
    detailReports.value = result.data.reports || [];
    detailNetworkSamples.value = result.data.networkSamples || [];
    detailTargets.value = result.data.targets || [];
    detailError.value = '';
    return true;
  }
  detailError.value = result.error || '加载详情失败';
  return false;
};

const refreshDetail = async (nodeId = editingNode.value?.id || detailPayload.value?.id) => {
  if (!nodeId) return false;
  isDetailLoading.value = true;
  const result = await fetchVpsNodeDetail(nodeId);
  const success = applyDetailResult(result);
  if (!success) {
    showToast(result.error || '加载详情失败', 'error');
  }
  isDetailLoading.value = false;
  return success;
};

const openDetail = async (node) => {
  editingNode.value = node;
  detailPayload.value = null;
  detailReports.value = [];
  detailNetworkSamples.value = [];
  detailTargets.value = [];
  detailError.value = '';
  detailRange.value = '24h';
  detailAggregation.value = 'avg';
  detailSection.value = 'overview';
  showDetailModal.value = true;
  await refreshDetail(node.id);
};

const setCheckingTarget = (targetId, pending) => {
  checkingTargets.value = {
    ...checkingTargets.value,
    [targetId]: pending
  };
};

const handleTargetCheck = async (target) => {
  if (!editingNode.value?.id || !target?.id) return;
  setCheckingTarget(target.id, true);
  try {
    const result = await requestVpsNetworkCheck(editingNode.value.id, target.id);
    if (result.success) {
      showToast(result.data?.message || '已加入下次上报检测队列', 'success');
      detailTargets.value = detailTargets.value.map((item) => (
        item.id === target.id
          ? { ...item, forceCheckAt: new Date().toISOString() }
          : item
      ));
    } else {
      showToast(result.error || '触发检测失败', 'error');
    }
  } finally {
    setCheckingTarget(target.id, false);
  }
};

const latestNetwork = computed(() => {
  const samples = detailNetworkSamples.value;
  if (!samples.length) return [];
  return samples[samples.length - 1].checks || [];
});

const buildNetworkSeries = (mode) => {
  const samples = detailNetworkSamples.value.slice(-24);
  return samples.map((sample) => {
    const checks = sample?.checks || [];
    if (!checks.length) return null;
    if (mode === 'latency') {
      const values = checks
        .map(item => Number(item.latencyMs))
        .filter(val => Number.isFinite(val));
      if (!values.length) return null;
      return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    }
    if (mode === 'loss') {
      const values = checks
        .filter(item => item.type === 'icmp')
        .map(item => Number(item.lossPercent))
        .filter(val => Number.isFinite(val));
      if (!values.length) return null;
      return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    }
    return null;
  });
};

const handleCreate = async () => {
  if (isCreatingNode.value) return;
  if (!formState.value.name.trim()) {
    showToast('请输入节点名称', 'warning');
    return;
  }
  isCreatingNode.value = true;
  const result = await createVpsNode({
    name: formState.value.name,
    tag: formState.value.tag,
    groupTag: formState.value.groupTag,
    region: formState.value.region,
    description: formState.value.description,
    enabled: formState.value.enabled,
    secret: formState.value.secret,
    useGlobalTargets: formState.value.useGlobalTargets,
    trafficLimitGb: Number(formState.value.trafficLimitGb || 0)
  });
  if (result.success) {
    showToast('节点已创建', 'success');
    await loadData();
    showCreateModal.value = false;
    if (result.data?.guide) {
      openGuide(result.data.data, result.data.guide);
    }
  } else {
    showToast(result.error || '创建失败', 'error');
  }
  isCreatingNode.value = false;
};

const handleUpdate = async () => {
  if (!editingNode.value) return;
  if (isUpdatingNode.value) return;
  const payload = {
    name: formState.value.name,
    tag: formState.value.tag,
    groupTag: formState.value.groupTag,
    region: formState.value.region,
    description: formState.value.description,
    enabled: formState.value.enabled,
    useGlobalTargets: formState.value.useGlobalTargets,
    trafficLimitGb: Number(formState.value.trafficLimitGb || 0)
  };
  if (formState.value.secret && formState.value.secret.trim()) {
    payload.secret = formState.value.secret;
  }
  isUpdatingNode.value = true;
  const result = await updateVpsNode(editingNode.value.id, payload);
  if (result.success) {
    showToast('节点已更新', 'success');
    await loadData();
    showEditModal.value = false;
    if (result.data?.guide) {
      openGuide(result.data.data, result.data.guide);
    }
  } else {
    showToast(result.error || '更新失败', 'error');
  }
  isUpdatingNode.value = false;
};

const handleResetSecret = async () => {
  if (!editingNode.value) return;
  if (isResettingSecret.value) return;
  isResettingSecret.value = true;
  const result = await updateVpsNode(editingNode.value.id, { resetSecret: true });
  if (result.success) {
    showToast('密钥已重置', 'success');
    guidePayload.value = result.data?.guide || null;
    await loadData();
    showEditModal.value = false;
    if (result.data?.guide) {
      openGuide(result.data.data, result.data.guide);
    }
  } else {
    showToast(result.error || '重置失败', 'error');
  }
  isResettingSecret.value = false;
};

const copyText = async (text) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板', 'success');
  } catch (error) {
    showToast('复制失败', 'error');
  }
};

const handleDelete = async () => {
  if (!editingNode.value) return;
  if (isDeletingNode.value) return;
  isDeletingNode.value = true;
  const result = await deleteVpsNode(editingNode.value.id);
  if (result.success) {
    showToast('节点已删除', 'success');
    await loadData();
    showDeleteModal.value = false;
  } else {
    showToast(result.error || '删除失败', 'error');
  }
  isDeletingNode.value = false;
};

const handleClearAlerts = async () => {
  if (isLoading.value) return;
  if (!alerts.value.length) return;
  if (!window.confirm('确认清空全部探针告警记录吗？此操作不可撤销。')) return;
  const result = await clearVpsAlerts();
  if (result.success) {
    showToast('告警已清空', 'success');
    alerts.value = [];
    alertsError.value = '';
  } else {
    showToast(result.error || '清空失败', 'error');
  }
};

const copyPublicPageLink = async () => {
  const baseUrl = window.location.origin;
  const token = config?.value?.vpsMonitor?.publicPageToken || '';
  const url = token ? `${baseUrl}/vps?token=${encodeURIComponent(token)}` : `${baseUrl}/vps`;
  try {
    await navigator.clipboard.writeText(url);
    showToast('公开页地址已复制', 'success');
  } catch (error) {
    showToast('复制失败', 'error');
  }
};

const formatTime = (value) => {
  if (!value) return '暂无';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无';
  return date.toLocaleString();
};

const formatPercent = (value) => {
  if (value === null || value === undefined) return '-';
  return `${value}%`;
};

const formatTotalTraffic = (bytes) => {
  if (bytes === null || bytes === undefined || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  if (bytes < k) return bytes + ' B';
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatTraffic = (traffic) => {
  if (!traffic) return '-';
  const rx = traffic.rx ?? traffic.download ?? traffic.in;
  const tx = traffic.tx ?? traffic.upload ?? traffic.out;
  const format = (val) => {
    if (val === null || val === undefined) return '-';
    const num = Number(val);
    if (isNaN(num)) return '-';
    const gb = num / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };
  return `⬇ ${format(rx)} / ⬆ ${format(tx)}`;
};

const latestSnapshot = (node) => node.latest || node.lastReport || null;

const filteredAlerts = computed(() => {
  const keyword = alertFilterQuery.value.trim().toLowerCase();
  return alerts.value.filter((alert) => {
    if (alertFilterType.value !== 'all' && alert.type !== alertFilterType.value) {
      return false;
    }
    if (!keyword) return true;
    const content = `${alert.type || ''} ${alert.message || ''}`.toLowerCase();
    return content.includes(keyword);
  });
});

const alertTotalPages = computed(() => {
  const total = filteredAlerts.value.length;
  return Math.max(1, Math.ceil(total / alertPageSize));
});

watch([alertFilterType, alertFilterQuery], () => {
  alertPage.value = 1;
});

watch(alertTotalPages, (total) => {
  if (alertPage.value > total) {
    alertPage.value = total;
  }
});

const previewAlerts = computed(() => filteredAlerts.value.slice(0, 6));

const pagedAlerts = computed(() => {
  const start = (alertPage.value - 1) * alertPageSize;
  const end = start + alertPageSize;
  return filteredAlerts.value.slice(start, end);
});

const escapeHtml = (value) => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const highlightText = (value) => {
  const keyword = alertFilterQuery.value.trim();
  const escaped = escapeHtml(value || '');
  if (!keyword) return escaped;
  const safeKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp(safeKeyword, 'gi'), (match) => `<span class="text-amber-600 dark:text-amber-300 font-semibold">${match}</span>`);
};

const detailSections = [
  { key: 'overview', label: '概览' },
  { key: 'metrics', label: '指标' },
  { key: 'network', label: '网络' }
];

const pickSeries = (key) => {
  return buildSeries(detailReports.value, detailRange.value, (item) => item?.[key]?.usage);
};

const pickScalarSeries = (getter) => {
  return buildSeries(detailReports.value, detailRange.value, getter);
};

const detailSummary = computed(() => {
  const latest = detailReports.value[detailReports.value.length - 1];
  if (!latest) return null;
  return {
    hostname: latest.meta?.hostname || '--',
    os: latest.meta?.os || '--',
    ip: latest.meta?.publicIp || '--',
    reportedAt: latest.reportedAt || '--',
    receivedAt: latest.receivedAt || '--',
    load1: latest.load?.load1 ?? '--',
    uptimeSec: latest.uptimeSec ?? '--'
  };
});

const rangeOptions = [
  { key: '1h', label: '近1小时', bucketCount: 12, windowMs: 60 * 60 * 1000 },
  { key: '24h', label: '近24小时', bucketCount: 24, windowMs: 24 * 60 * 60 * 1000 },
  { key: '7d', label: '近7天', bucketCount: 28, windowMs: 7 * 24 * 60 * 60 * 1000 },
  { key: '30d', label: '近30天', bucketCount: 30, windowMs: 30 * 24 * 60 * 60 * 1000 }
];

const aggregationOptions = [
  { key: 'avg', label: '平均' },
  { key: 'max', label: '峰值' }
];

const rangeConfigMap = rangeOptions.reduce((acc, item) => {
  acc[item.key] = item;
  return acc;
}, {});

const resolveReportTime = (item) => {
  const raw = item?.reportedAt || item?.createdAt;
  if (!raw) return null;
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) ? ts : null;
};

const buildSeries = (reports, rangeKey, accessor) => {
  const config = rangeConfigMap[rangeKey] || rangeConfigMap['24h'];
  const now = Date.now();
  const start = now - config.windowMs;
  const bucketSize = config.windowMs / config.bucketCount;
  const sums = Array.from({ length: config.bucketCount }, () => 0);
  const counts = Array.from({ length: config.bucketCount }, () => 0);
  const peaks = Array.from({ length: config.bucketCount }, () => null);

  reports.forEach((item) => {
    const time = resolveReportTime(item);
    if (time === null || time < start || time > now) return;
    const idx = Math.min(config.bucketCount - 1, Math.max(0, Math.floor((time - start) / bucketSize)));
    const value = accessor(item);
    if (value === null || value === undefined) return;
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    sums[idx] += num;
    counts[idx] += 1;
    if (peaks[idx] === null || num > peaks[idx]) {
      peaks[idx] = num;
    }
  });

  if (detailAggregation.value === 'max') {
    return peaks.map((val) => (val === null ? null : Math.round(val * 10) / 10));
  }
  return sums.map((sum, idx) => (counts[idx] ? Math.round((sum / counts[idx]) * 10) / 10 : null));
};

const rangeHint = computed(() => {
  if (detailRange.value === '1h') return '采样粒度：约 5 分钟';
  if (detailRange.value === '24h') return '采样粒度：约 1 小时';
  if (detailRange.value === '7d') return '采样粒度：约 6 小时';
  return '采样粒度：约 1 天';
});

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="space-y-6">
    <div class="mb-4 bg-white/80 dark:bg-gray-900/60 border border-gray-100/80 dark:border-white/10 misub-radius-lg p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">VPS 探针</h1>
        <p class="mt-1 text-sm font-medium text-gray-600 dark:text-gray-400">
          统一管理 VPS 探针节点、资源状态与告警
        </p>
        <p class="mt-2 text-xs text-amber-600 dark:text-amber-400">
          注意：VPS 探针功能需要绑定 D1 数据库（MISUB_DB）并切换存储模式为 D1。
        </p>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          公开展示页：<span class="font-medium">/vps</span>（如设置公开页 Token，请使用 ?token=xxx）
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <!-- Group Filter -->
        <select
          v-if="groups.length > 1"
          v-model="selectedGroup"
          class="px-3 py-2 text-xs font-medium bg-white/80 dark:bg-gray-900/60 text-gray-700 dark:text-gray-300 misub-radius-lg border border-gray-200/80 dark:border-white/10 shadow-sm"
        >
          <option v-for="group in groups" :key="group" :value="group">{{ group }}</option>
        </select>

        <button
          @click="copyPublicPageLink"
          class="px-3 py-2 text-xs font-medium bg-white/80 text-gray-700 hover:bg-white dark:bg-gray-900/60 dark:text-gray-300 dark:hover:bg-gray-900 misub-radius-lg transition-colors border border-gray-200/80 dark:border-white/10 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          复制公开页地址
        </button>
        <a
          :href="(config?.vpsMonitor?.publicPageToken
            ? `/vps?token=${encodeURIComponent(config.vpsMonitor.publicPageToken)}`
            : '/vps')"
          target="_blank"
          rel="noopener"
          class="px-3 py-2 text-xs font-medium bg-white/80 text-gray-700 hover:bg-white dark:bg-gray-900/60 dark:text-gray-300 dark:hover:bg-gray-900 misub-radius-lg transition-colors border border-gray-200/80 dark:border-white/10 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          打开公开页
        </a>
        <button
          @click="loadData"
          :disabled="isRefreshing"
          class="px-4 py-2 text-sm font-medium bg-white/80 text-gray-700 hover:bg-white dark:bg-gray-900/60 dark:text-gray-300 dark:hover:bg-gray-900 misub-radius-lg transition-colors border border-gray-200/80 dark:border-white/10 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          {{ isRefreshing ? '刷新中...' : '刷新' }}
        </button>
        <button
          @click="openSettings"
          class="px-4 py-2 text-sm font-medium bg-white/80 text-gray-700 hover:bg-white dark:bg-gray-900/60 dark:text-gray-300 dark:hover:bg-gray-900 misub-radius-lg transition-colors border border-gray-200/80 dark:border-white/10 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          探针设置
        </button>
        <button
          @click="openCreate"
          class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 misub-radius-lg transition-colors shadow-sm shadow-primary-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60"
        >
          新增节点
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div class="xl:col-span-2 space-y-4">
        <div v-if="nodesError" aria-live="assertive" class="rounded-xl border border-rose-200/70 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {{ nodesError }}
        </div>

        <div v-else-if="!isLoading && !filteredNodes.length" class="rounded-2xl border border-dashed border-gray-300/80 bg-white/70 px-6 py-10 text-center dark:border-white/10 dark:bg-gray-900/50">
          <div class="text-3xl">🛰️</div>
          <p class="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">当前还没有可展示的探针节点</p>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">你可以先新增节点，或切换分组筛选查看其它分组。</p>
          <button
            type="button"
            class="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            @click="openCreate"
          >
            新增节点
          </button>
        </div>

        <div v-else>
          <div class="space-y-3 md:hidden">
            <div
              v-for="row in filteredNodes"
              :key="row.id"
              class="rounded-2xl border border-gray-200/70 bg-white/90 p-4 dark:border-white/10 dark:bg-gray-900/70"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <img
                      v-if="row.countryCode"
                      :src="`https://flagcdn.com/24x18/${row.countryCode.toLowerCase()}.png`"
                      class="h-3.5 w-auto shrink-0 rounded-sm object-cover opacity-80"
                      alt=""
                      :title="row.countryCode"
                      @error="getFlagFallback"
                    />
                    <div class="truncate text-left text-sm font-semibold text-slate-900 dark:text-white">
                      {{ row.name }}
                    </div>
                  </div>
                  <p class="mt-1 text-xs text-slate-500">{{ row.region || row.description || '--' }}</p>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <span v-if="row.groupTag" class="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">{{ row.groupTag }}</span>
                    <span class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium" :class="statusBadge(row.status)">
                      <span class="h-1.5 w-1.5 rounded-full" :class="row.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'"></span>
                      {{ row.status === 'online' ? '在线' : '离线' }}
                    </span>
                  </div>
                </div>
                <button type="button" class="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 dark:border-white/10 dark:text-gray-300" @click="openGuide(row, row.guide)">安装</button>
              </div>
              <div class="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-500 dark:text-gray-400">
                <div>CPU <span :class="metricsBadge(latestSnapshot(row)?.cpuPercent, metricThresholds.cpu)">{{ formatPercent(latestSnapshot(row)?.cpuPercent) }}</span></div>
                <div>内存 <span :class="metricsBadge(latestSnapshot(row)?.memPercent, metricThresholds.mem)">{{ formatPercent(latestSnapshot(row)?.memPercent) }}</span></div>
                <div>磁盘 <span :class="metricsBadge(latestSnapshot(row)?.diskPercent, metricThresholds.disk)">{{ formatPercent(latestSnapshot(row)?.diskPercent) }}</span></div>
              </div>
              <div class="mt-3 text-xs text-gray-500 dark:text-gray-400">最近上报：{{ formatTime(row.lastSeenAt) }}</div>
              <div class="mt-4 flex flex-wrap gap-2">
                <button type="button" class="rounded-lg border border-sky-200/60 px-2.5 py-1.5 text-xs font-medium text-sky-600 dark:border-sky-500/20 dark:text-sky-300" @click="openDetail(row)">详情</button>
                <button type="button" class="rounded-lg border border-indigo-200/60 px-2.5 py-1.5 text-xs font-medium text-indigo-600 dark:border-indigo-500/20 dark:text-indigo-300" @click="openEdit(row)">编辑</button>
                <button type="button" class="rounded-lg border border-rose-200/60 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:border-rose-500/20 dark:text-rose-300" @click="openDelete(row)">删除</button>
              </div>
            </div>
          </div>

          <div class="hidden md:block">
            <DataGrid
              :data="filteredNodes"
              :columns="columns"
              :loading="isLoading"
              :striped="false"
              :pagination="false"
              empty-text="暂无节点数据"
            >
          <template #column-name="{ row }">
            <div class="flex items-center gap-2">
              <img 
                v-if="row.countryCode" 
                :src="`https://flagcdn.com/24x18/${row.countryCode.toLowerCase()}.png`" 
                class="h-3.5 w-auto shrink-0 rounded-sm object-cover opacity-80" 
                alt=""
                :title="row.countryCode"
                @error="getFlagFallback"
              />
              <div class="flex flex-col min-w-0">
                <div class="truncate text-left font-medium text-slate-900 dark:text-white">
                  {{ row.name }}
                </div>
                <span class="text-xs text-slate-500 truncate">{{ row.region || row.description || '--' }}</span>
              </div>
            </div>
          </template>

          <template #column-groupTag="{ row }">
            <span v-if="row.groupTag" class="px-2 py-0.5 rounded-lg border border-slate-200 bg-slate-50 text-[10px] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              {{ row.groupTag }}
            </span>
            <span v-else class="text-slate-400">-</span>
          </template>

          <template #column-status="{ row }">
            <span
              class="px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1"
              :class="statusBadge(row.status)"
            >
              <span class="w-1.5 h-1.5 rounded-full" :class="row.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'"></span>
              {{ row.status === 'online' ? '在线' : '离线' }}
            </span>
          </template>

          <template #column-metrics="{ row }">
            <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <div>
                CPU <span :class="metricsBadge(latestSnapshot(row)?.cpuPercent, metricThresholds.cpu)">{{ formatPercent(latestSnapshot(row)?.cpuPercent) }}</span>
              </div>
              <div>
                内存 <span :class="metricsBadge(latestSnapshot(row)?.memPercent, metricThresholds.mem)">{{ formatPercent(latestSnapshot(row)?.memPercent) }}</span>
              </div>
              <div>
                磁盘 <span :class="metricsBadge(latestSnapshot(row)?.diskPercent, metricThresholds.disk)">{{ formatPercent(latestSnapshot(row)?.diskPercent) }}</span>
              </div>
            </div>
          </template>

          <template #column-lastSeenAt="{ row }">
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {{ formatTime(row.lastSeenAt) }}
            </div>
          </template>

          <template #column-actions="{ row }">
            <div class="flex items-center justify-end gap-2">
              <button
                class="px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5"
                @click.stop="openGuide(row, row.guide)"
              >
                安装
              </button>
              <button
                class="px-2.5 py-1.5 text-xs font-medium text-sky-600 dark:text-sky-300 border border-sky-200/60 dark:border-sky-500/20 rounded-lg hover:bg-sky-50/40 dark:hover:bg-sky-500/10"
                @click.stop="openDetail(row)"
              >
                详情
              </button>
              <button
                class="px-2.5 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-500/20 rounded-lg hover:bg-indigo-50/40 dark:hover:bg-indigo-500/10"
                @click.stop="openEdit(row)"
              >
                编辑
              </button>
              <button
                class="px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-300 border border-rose-200/60 dark:border-rose-500/20 rounded-lg hover:bg-rose-50/40 dark:hover:bg-rose-500/10"
                @click.stop="openDelete(row)"
              >
                删除
              </button>
            </div>
          </template>
            </DataGrid>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <div class="bg-white/90 dark:bg-gray-900/70 misub-radius-lg p-5 border border-gray-100/80 dark:border-white/10 shadow-sm">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">告警动态</h3>
            <button
              class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              @click="handleClearAlerts"
              v-if="alerts.length"
            >
              清空
            </button>
          </div>
          <div v-if="alertsError" aria-live="assertive" class="mt-3 rounded-lg border border-rose-200/70 bg-rose-50/80 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {{ alertsError }}
          </div>
          <div class="mt-3 space-y-3" v-else-if="alerts.length">
          <div class="flex flex-wrap gap-2">
            <select
              v-model="alertFilterType"
                class="px-2.5 py-1.5 text-xs bg-white/80 dark:bg-gray-900/70 border border-gray-200/60 dark:border-white/10 rounded-lg"
              >
                <option value="all">全部类型</option>
                <option value="offline">离线</option>
                <option value="recovery">恢复</option>
                <option value="overload">负载</option>
              </select>
              <input
                v-model="alertFilterQuery"
                placeholder="搜索节点或关键词"
                class="flex-1 min-w-[160px] px-2.5 py-1.5 text-xs bg-white/80 dark:bg-gray-900/70 border border-gray-200/60 dark:border-white/10 rounded-lg"
              />
            </div>
            <div
              v-for="alert in previewAlerts"
              :key="alert.id"
              class="p-3 bg-gray-50 dark:bg-gray-900/60 border border-gray-200/60 dark:border-white/10 rounded-lg text-xs text-gray-600 dark:text-gray-300"
            >
              <div class="font-medium mb-1">{{ alert.type }}</div>
              <div class="text-[11px] whitespace-pre-line" v-html="highlightText(alert.message)"></div>
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400" v-if="filteredAlerts.length > previewAlerts.length">
              <button
                class="px-2 py-1 border border-gray-200 dark:border-white/10 rounded-lg"
                @click="showAlertsModal = true; alertPage = 1"
              >
                查看全部
              </button>
              <span>共 {{ filteredAlerts.length }} 条</span>
            </div>
          </div>
          <div v-else class="text-xs text-gray-500 dark:text-gray-400 mt-3">
            暂无告警记录
          </div>
        </div>

        <div class="bg-gradient-to-br from-indigo-500/15 via-sky-500/10 to-emerald-500/10 dark:from-indigo-500/10 dark:via-sky-500/5 dark:to-emerald-500/5 misub-radius-lg p-5 border border-white/30 dark:border-white/10">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">探针上报说明</h3>
          <p class="text-xs text-gray-600 dark:text-gray-400 mt-2">
            新增节点后复制上报 URL 和密钥到 VPS 探针脚本，保持定时上报即可。
          </p>
          <ul class="mt-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <li>• 建议上报频率：60 秒</li>
            <li>• 支持 CPU/内存/磁盘/流量/负载信息</li>
            <li>• 告警推送复用 Telegram 通知配置</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <Modal v-model:show="showCreateModal" @confirm="handleCreate" confirm-text="创建" cancel-text="取消" size="lg" :confirm-disabled="isCreatingNode">
    <template #title>
      <h3 class="text-lg font-bold text-gray-900 dark:text-white">新增 VPS 节点</h3>
    </template>
    <template #body>
      <div class="space-y-3">
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">节点名称</label>
          <input v-model="formState.name" class="w-full px-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg text-sm" placeholder="例如：AWS-HK-01" />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">标签</label>
            <input v-model="formState.tag" class="w-full px-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg text-sm" placeholder="例如：HK-01" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">分组</label>
            <input v-model="formState.groupTag" class="w-full px-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg text-sm" placeholder="例如：核心业务/测试" />
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">地区</label>
            <input v-model="formState.region" class="w-full px-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg text-sm" placeholder="例如：香港" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">月流量限额 (GB)</label>
            <input v-model="formState.trafficLimitGb" type="number" class="w-full px-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg text-sm" placeholder="0 为不限制" />
          </div>
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">描述</label>
          <textarea v-model="formState.description" rows="2" class="w-full px-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg text-sm"></textarea>
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">自定义密钥（可选）</label>
          <input v-model="formState.secret" class="w-full px-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg text-sm" />
        </div>
        <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input type="checkbox" v-model="formState.enabled" class="rounded border-gray-300" />
          启用节点
        </div>
        <div class="flex items-center justify-between rounded-lg border border-gray-200/80 dark:border-white/10 bg-white/70 dark:bg-gray-900/60 px-3 py-2">
          <div>
            <div class="text-sm text-gray-700 dark:text-gray-200">应用全局监测目标</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">使用探针设置中的全局网络监测目标</div>
          </div>
          <Switch v-model="formState.useGlobalTargets" />
        </div>
      </div>
    </template>
  </Modal>

  <Modal v-model:show="showEditModal" @confirm="handleUpdate" confirm-text="保存" cancel-text="取消" size="lg" :confirm-disabled="isUpdatingNode">
    <template #title>
      <h3 class="text-lg font-bold text-gray-900 dark:text-white">编辑 VPS 节点</h3>
    </template>
    <template #body>
      <div class="space-y-3">
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">节点名称</label>
          <input v-model="formState.name" class="w-full px-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg text-sm" placeholder="例如：AWS-HK-01" />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">标签</label>
            <input v-model="formState.tag" class="w-full px-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg text-sm" placeholder="例如：HK-01" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">分组</label>
            <input v-model="formState.groupTag" class="w-full px-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg text-sm" placeholder="例如：核心业务/测试" />
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">地区</label>
            <input v-model="formState.region" class="w-full px-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg text-sm" placeholder="例如：香港" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">月流量限额 (GB)</label>
            <input v-model="formState.trafficLimitGb" type="number" class="w-full px-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg text-sm" placeholder="0 为不限制" />
          </div>
        </div>
        <div>
          <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">描述</label>
          <textarea v-model="formState.description" rows="2" class="w-full px-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg text-sm"></textarea>
        </div>
        <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input type="checkbox" v-model="formState.enabled" class="rounded border-gray-300" />
          启用节点
        </div>
        <div class="flex items-center justify-between rounded-lg border border-gray-200/80 dark:border-white/10 bg-white/70 dark:bg-gray-900/60 px-3 py-2">
          <div>
            <div class="text-sm text-gray-700 dark:text-gray-200">应用全局监测目标</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">使用探针设置中的全局网络监测目标</div>
          </div>
          <Switch v-model="formState.useGlobalTargets" />
        </div>
        <div class="pt-2 border-t border-gray-200/80 dark:border-white/10">
          <button
            type="button"
            class="text-xs text-rose-600 dark:text-rose-300 disabled:opacity-60 disabled:cursor-not-allowed"
            @click="handleResetSecret"
            :disabled="isResettingSecret"
          >
            {{ isResettingSecret ? '正在生成密钥...' : '重新生成密钥并显示安装信息' }}
          </button>
        </div>
      </div>
    </template>
  </Modal>

  <Modal v-model:show="showDetailModal" confirm-text="关闭" cancel-text="关闭" size="6xl" :confirm-disabled="true">
    <template #title>
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white">VPS 节点详情</h3>
        <span v-if="detailPayload?.name" class="rounded-full border border-sky-200/70 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300">
          {{ detailPayload.name }}
        </span>
      </div>
    </template>
    <template #body>
      <div class="space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="section in detailSections"
            :key="section.key"
            type="button"
            class="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
            :class="detailSection === section.key
              ? 'border-primary-500 bg-primary-500/10 text-primary-700 dark:border-primary-400 dark:bg-primary-500/15 dark:text-primary-200'
              : 'border-gray-200/80 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5'"
            @click="detailSection = section.key"
          >
            {{ section.label }}
          </button>

          <div class="ml-auto flex flex-wrap items-center gap-2">
            <select v-model="detailRange" class="rounded-lg border border-gray-200/80 bg-white/80 px-2.5 py-1.5 text-xs dark:border-white/10 dark:bg-gray-900/70">
              <option v-for="item in rangeOptions" :key="item.key" :value="item.key">{{ item.label }}</option>
            </select>
            <select v-model="detailAggregation" class="rounded-lg border border-gray-200/80 bg-white/80 px-2.5 py-1.5 text-xs dark:border-white/10 dark:bg-gray-900/70">
              <option v-for="item in aggregationOptions" :key="item.key" :value="item.key">{{ item.label }}</option>
            </select>
            <button
              type="button"
              class="rounded-lg border border-gray-200/80 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
              @click="refreshDetail()"
              :disabled="isDetailLoading"
            >
              {{ isDetailLoading ? '刷新中...' : '刷新详情' }}
            </button>
          </div>
        </div>

        <p class="text-xs text-gray-500 dark:text-gray-400">{{ rangeHint }}</p>

        <div v-if="isDetailLoading && !detailPayload && !detailError" class="rounded-xl border border-dashed border-gray-300/70 bg-white/60 px-4 py-8 text-center text-sm text-gray-500 dark:border-white/10 dark:bg-gray-900/50 dark:text-gray-400">
          正在加载节点详情...
        </div>
        <div v-else-if="detailError" class="rounded-xl border border-rose-200/70 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {{ detailError }}
        </div>
        <div v-else-if="detailPayload" class="space-y-4">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-xl border border-gray-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-gray-900/60">
              <div class="text-xs text-gray-500 dark:text-gray-400">当前状态</div>
              <div class="mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium" :class="statusBadge(detailPayload.status)">
                <span class="h-1.5 w-1.5 rounded-full" :class="detailPayload.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'"></span>
                {{ detailPayload.status === 'online' ? '在线' : '离线' }}
              </div>
              <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">最近上报：{{ formatTime(detailPayload.lastSeenAt) }}</div>
            </div>
            <div class="rounded-xl border border-gray-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-gray-900/60">
              <div class="text-xs text-gray-500 dark:text-gray-400">资源快照</div>
              <div class="mt-2 text-sm font-semibold text-gray-900 dark:text-white">CPU {{ formatPercent(detailPayload.latest?.cpuPercent) }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">内存 {{ formatPercent(detailPayload.latest?.memPercent) }} / 磁盘 {{ formatPercent(detailPayload.latest?.diskPercent) }}</div>
            </div>
            <div class="rounded-xl border border-gray-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-gray-900/60">
              <div class="text-xs text-gray-500 dark:text-gray-400">系统信息</div>
              <div class="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{{ detailSummary?.hostname || detailPayload.name || '--' }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ detailSummary?.os || detailPayload.region || '暂无系统信息' }}</div>
            </div>
            <div class="rounded-xl border border-gray-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-gray-900/60">
              <div class="text-xs text-gray-500 dark:text-gray-400">累计流量</div>
              <div class="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{{ formatTotalTraffic((detailPayload.totalRx || 0) + (detailPayload.totalTx || 0)) }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">负载 {{ detailSummary?.load1 ?? '--' }} / 最后样本 {{ detailSummary ? formatTime(detailSummary.reportedAt) : '暂无' }}</div>
            </div>
          </div>

          <div v-if="detailSection !== 'network'" class="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <VpsMetricChart title="CPU 使用率" color="#4f46e5" unit="%" :points="pickSeries('cpu')" />
            <VpsMetricChart title="内存使用率" color="#0ea5e9" unit="%" :points="pickSeries('mem')" />
            <VpsMetricChart title="磁盘使用率" color="#10b981" unit="%" :points="pickSeries('disk')" />
            <VpsMetricChart title="系统负载" color="#f59e0b" :points="pickScalarSeries((item) => item?.load?.load1)" :max="10" />
          </div>

          <div v-if="detailSection !== 'metrics'" class="space-y-4">
            <div class="rounded-xl border border-gray-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-gray-900/60">
              <div class="mb-3 flex items-center justify-between">
                <div>
                  <h4 class="text-sm font-semibold text-gray-900 dark:text-white">网络延迟趋势</h4>
                  <p class="text-xs text-gray-500 dark:text-gray-400">基于最近上报生成的延迟曲线</p>
                </div>
                <span class="text-xs text-gray-400">样本 {{ detailNetworkSamples.length }}</span>
              </div>
              <VpsLatencyChart :samples="detailNetworkSamples" />
            </div>

            <div v-if="latestNetwork.length" class="rounded-xl border border-gray-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-gray-900/60">
              <div class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">最近网络检查结果</div>
              <div class="space-y-2">
                <div v-for="item in latestNetwork" :key="`${item.type}-${item.target}-${item.port || ''}-${item.path || ''}`" class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200/60 bg-white/70 px-3 py-2 text-xs dark:border-white/10 dark:bg-gray-900/50">
                  <div class="min-w-0">
                    <div class="font-medium text-gray-800 dark:text-gray-100">{{ item.name || item.target }}</div>
                    <div class="text-gray-500 dark:text-gray-400">{{ item.type.toUpperCase() }} · {{ item.target }}<span v-if="item.port">:{{ item.port }}</span><span v-if="item.path">{{ item.path }}</span></div>
                  </div>
                  <div class="text-right text-gray-500 dark:text-gray-400">
                    <div>延迟：{{ item.latencyMs !== null && item.latencyMs !== undefined ? `${Math.round(item.latencyMs)} ms` : '--' }}</div>
                    <div>丢包：{{ item.lossPercent !== null && item.lossPercent !== undefined ? `${item.lossPercent}%` : '--' }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <div v-if="detailPayload.useGlobalTargets" class="rounded-lg border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                当前节点启用了全局网络监测目标，此处的新增、启停和删除会同步影响所有使用全局目标的节点。
              </div>
              <VpsNetworkTargets
                :node-id="detailPayload.useGlobalTargets ? 'global' : detailPayload.id"
                :targets="detailTargets"
                :checking-targets="checkingTargets"
                :limit="config?.value?.vpsMonitor?.networkTargetsLimit || config?.vpsMonitor?.networkTargetsLimit || 3"
                @refresh="refreshDetail()"
                @check="handleTargetCheck"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </Modal>

  <Modal v-model:show="showGuideModal" :confirm-disabled="true" cancel-text="关闭" size="4xl">
    <template #title>
      <h3 class="text-lg font-bold text-gray-900 dark:text-white">探针安装信息</h3>
    </template>
    <template #body>
      <div v-if="guidePayload" class="space-y-4 text-sm text-gray-600 dark:text-gray-300">
        <div>
          <label class="block text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">一行安装命令</label>
          <div class="flex items-center gap-2">
            <pre class="text-xs bg-gray-100/70 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg px-3 py-2 overflow-auto flex-1 font-mono">{{ guidePayload.installCommand }}</pre>
            <button
              type="button"
              class="px-2.5 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5"
              @click="copyText(guidePayload.installCommand)"
            >
              复制
            </button>
          </div>
        </div>

        <div v-if="guidePayload.uninstallCommand">
          <label class="block text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">一行卸载命令</label>
          <div class="flex items-center gap-2">
            <pre class="text-xs bg-gray-100/70 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg px-3 py-2 overflow-auto flex-1 font-mono">{{ guidePayload.uninstallCommand }}</pre>
            <button
              type="button"
              class="px-2.5 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5"
              @click="copyText(guidePayload.uninstallCommand)"
            >
              复制
            </button>
          </div>
        </div>

        <div class="pt-2 border-t border-gray-100 dark:border-white/5">
          <label class="block text-xs text-gray-500 mb-1">上报地址</label>
          <div class="font-mono text-xs bg-gray-100/70 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg px-3 py-2">
            {{ guidePayload.reportUrl }}
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">节点 ID</label>
            <div class="font-mono text-xs bg-gray-100/70 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg px-3 py-2">
              {{ guidePayload.nodeId }}
            </div>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">节点密钥</label>
            <div class="font-mono text-xs bg-gray-100/70 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg px-3 py-2">
              {{ guidePayload.nodeSecret }}
            </div>
          </div>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">请求头</label>
          <pre class="text-xs font-mono bg-gray-100/70 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg px-3 py-2 overflow-auto">{{ JSON.stringify(guidePayload.headers, null, 2) }}</pre>
        </div>
        
        <div class="flex flex-col gap-3 pt-2 border-t border-gray-100 dark:border-white/5">
          <details class="text-xs text-gray-500 group">
            <summary class="cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors list-none flex items-center gap-1">
              <span class="rotate-0 group-open:rotate-90 transition-transform">▶</span>
              查看一键安装脚本内容
            </summary>
            <div class="mt-2 flex items-center gap-2">
              <pre class="text-xs font-mono bg-gray-100/70 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg px-3 py-2 overflow-auto flex-1 max-h-48">{{ guidePayload.installScript }}</pre>
              <button
                type="button"
                class="px-2.5 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 shrink-0"
                @click="copyText(guidePayload.installScript)"
              >
                复制
              </button>
            </div>
          </details>

          <details v-if="guidePayload.uninstallScript" class="text-xs text-gray-500 group">
            <summary class="cursor-pointer hover:text-rose-600 dark:hover:text-rose-400 transition-colors list-none flex items-center gap-1">
              <span class="rotate-0 group-open:rotate-90 transition-transform">▶</span>
              查看一键卸载脚本内容
            </summary>
            <div class="mt-2 flex items-center gap-2">
              <pre class="text-xs font-mono bg-gray-100/70 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 rounded-lg px-3 py-2 overflow-auto flex-1 max-h-48">{{ guidePayload.uninstallScript }}</pre>
              <button
                type="button"
                class="px-2.5 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 shrink-0"
                @click="copyText(guidePayload.uninstallScript)"
              >
                复制
              </button>
            </div>
          </details>
        </div>
      </div>
      <div v-else class="text-sm text-gray-500">暂无安装信息</div>
    </template>
  </Modal>

  <Modal v-model:show="showDeleteModal" @confirm="handleDelete" confirm-text="删除" cancel-text="取消" :confirm-disabled="isDeletingNode">
    <template #title>
      <h3 class="text-lg font-bold text-rose-600">确认删除节点</h3>
    </template>
    <template #body>
      <p class="text-sm text-gray-600 dark:text-gray-300">
        确定删除 {{ editingNode?.name || '该节点' }} 吗？相关上报数据会一并清除。
      </p>
    </template>
  </Modal>

  <Modal v-model:show="showAlertsModal" size="4xl" confirm-text="关闭" cancel-text="关闭" :confirm-disabled="true">
    <template #title>
      <h3 class="text-lg font-bold text-gray-900 dark:text-white">告警记录</h3>
    </template>
    <template #body>
      <div class="space-y-4">
        <div class="flex flex-wrap gap-2">
          <select
            v-model="alertFilterType"
            class="px-2.5 py-1.5 text-xs bg-white/80 dark:bg-gray-900/70 border border-gray-200/60 dark:border-white/10 rounded-lg"
          >
            <option value="all">全部类型</option>
            <option value="offline">离线</option>
            <option value="recovery">恢复</option>
            <option value="overload">负载</option>
          </select>
          <input
            v-model="alertFilterQuery"
            placeholder="搜索节点或关键词"
            class="flex-1 min-w-[160px] px-2.5 py-1.5 text-xs bg-white/80 dark:bg-gray-900/70 border border-gray-200/60 dark:border-white/10 rounded-lg"
          />
        </div>

        <div class="space-y-2" v-if="filteredAlerts.length">
          <div
            v-for="alert in pagedAlerts"
            :key="alert.id"
            class="p-3 bg-gray-50 dark:bg-gray-900/60 border border-gray-200/60 dark:border-white/10 rounded-lg text-xs text-gray-600 dark:text-gray-300"
          >
            <div class="font-medium mb-1">{{ alert.type }}</div>
            <div class="text-[11px] whitespace-pre-line" v-html="highlightText(alert.message)"></div>
          </div>
        </div>
        <div v-else class="text-xs text-gray-500">暂无告警记录</div>

        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400" v-if="filteredAlerts.length > alertPageSize">
          <span>第 {{ alertPage }} / {{ alertTotalPages }} 页</span>
          <div class="flex items-center gap-2">
            <button
              class="px-2 py-1 border border-gray-200 dark:border-white/10 rounded-lg"
              :disabled="alertPage <= 1"
              @click="alertPage = Math.max(1, alertPage - 1)"
            >
              上一页
            </button>
            <button
              class="px-2 py-1 border border-gray-200 dark:border-white/10 rounded-lg"
              :disabled="alertPage >= alertTotalPages"
              @click="alertPage = Math.min(alertTotalPages, alertPage + 1)"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </template>
  </Modal>

  <VpsMonitorSettingsModal v-model:show="showSettingsModal" :settings="config" @save="handleSettingsSave" :saving="isSavingSettings" />
</template>
