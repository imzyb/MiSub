<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { fetchVpsPublicSnapshot, fetchVpsPublicNodeDetail } from '../lib/api.js';
import VpsMetricChart from '../components/vps/VpsMetricChart.vue';
import VpsLatencyChart from '../components/vps/VpsLatencyChart.vue';
import Switch from '../components/ui/Switch.vue';
import { resolveVpsPublicTheme } from '../constants/vps-public-themes.js';

const route = useRoute();

const loading = ref(true);
const error = ref('');
const nodes = ref([]);
const lastUpdatedAt = ref('');
const themePreset = ref('default');
const themeConfig = ref({
  title: 'VPS 探针公开视图',
  subtitle: '对外展示节点健康、资源负载与在线率。所有关键指标以清晰、可信的方式汇总呈现。',
  logo: '',
  backgroundImage: '',
  showStats: true,
  showAnomalies: true,
  showFeatured: true,
  showDetailTable: true
});
const theme = computed(() => resolveVpsPublicTheme(themePreset.value));

const heroBadgeClass = computed(() => theme.value.heroBadge);
const heroTitleClass = computed(() => theme.value.heroTitle);
const heroTextClass = computed(() => theme.value.heroText);
const statCardClass = computed(() => theme.value.statCard);
const panelClass = computed(() => theme.value.panel);
const panelSoftClass = computed(() => theme.value.panelSoft);
const pillClass = computed(() => theme.value.pill);
const accentButtonClass = computed(() => theme.value.accentButton);
const nodeCardClass = computed(() => theme.value.nodeCard);
const detailTableClass = computed(() => theme.value.detailTable);
const layoutClass = computed(() => theme.value.layout || 'default');
const themeClass = computed(() => theme.value.themeClass || '');
const rootStyle = computed(() => themeConfig.value.backgroundImage
  ? { backgroundImage: `url(${themeConfig.value.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  : {});
const showStats = computed(() => themeConfig.value.showStats !== false && layoutClass.value !== 'minimal');
const showAnomalies = computed(() => themeConfig.value.showAnomalies !== false && layoutClass.value !== 'minimal');
const showFeatured = computed(() => themeConfig.value.showFeatured !== false && layoutClass.value !== 'minimal');
const showDetailTable = computed(() => themeConfig.value.showDetailTable !== false);
const orderedSections = computed(() => {
  const raw = Array.isArray(themeConfig.value.sectionOrder) ? themeConfig.value.sectionOrder : ['anomalies', 'nodes', 'featured', 'details'];
  const valid = ['anomalies', 'nodes', 'featured', 'details'];
  const normalized = raw.filter(item => valid.includes(item));
  return normalized.length ? normalized : valid;
});
const sectionOrderMap = computed(() => new Map(orderedSections.value.map((item, index) => [item, index + 1])));
const sectionOrderStyle = (key) => ({ order: sectionOrderMap.value.get(key) || 99 });

// v2.1 Interactive Effects
const mouseX = ref(0);
const mouseY = ref(0);
let mouseFrame = null;
const updateMouse = (e) => {
  if (mouseFrame !== null) return;
  const { clientX, clientY } = e;
  mouseFrame = requestAnimationFrame(() => {
    mouseX.value = clientX;
    mouseY.value = clientY;
    mouseFrame = null;
  });
};

// Node Detail & Latency Chart
const selectedNodeId = ref(null);
const anomalyExpanded = ref(false);
const selectedGroup = ref('全部');
const detailCloseButtonRef = ref(null);
const detailTitleId = 'public-vps-detail-title';
let previousFocusedElement = null;
const createEmptyNodeDetail = (loading = false) => ({
  loading,
  node: null,
  samples: [],
  error: ''
});
const getPublicToken = () => (typeof route.query?.token === 'string' ? route.query.token : '');
const getFlagFallback = (event) => {
  event.target.style.display = 'none';
};
const sortNodesByStatusAndName = (list) => {
  return [...list].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'online' ? -1 : 1;
    return (a.name || '').localeCompare(b.name || '');
  });
};
const getTrafficLimitUsage = (node) => {
  if (!node?.trafficLimitGb) return '0%';
  const totalBytes = node.trafficLimitGb * 1024 * 1024 * 1024;
  const usedBytes = node.totalRx + node.totalTx;
  return `${Math.min(100, (usedBytes / totalBytes) * 100)}%`;
};
const nodeDetailData = ref({
  loading: false,
  node: null,
  samples: [],
  error: ''
});
const isSmooth = ref(true);

const lockBodyScroll = () => {
  document.body.style.overflow = 'hidden';
};

const unlockBodyScroll = () => {
  document.body.style.overflow = '';
};

const openNodeDetail = async (nodeId) => {
  if (selectedNodeId.value === nodeId) {
    closeNodeDetail();
    return;
  }

  selectedNodeId.value = nodeId;
  nodeDetailData.value = createEmptyNodeDetail(true);
  lockBodyScroll();

  const result = await fetchVpsPublicNodeDetail(nodeId, getPublicToken());
  if (result.success) {
    nodeDetailData.value.node = result.data.data;
    nodeDetailData.value.samples = result.data.networkSamples || [];
  } else {
    nodeDetailData.value.error = result.error || '历史数据加载失败';
  }
  nodeDetailData.value.loading = false;
};

const closeNodeDetail = () => {
  selectedNodeId.value = null;
  nodeDetailData.value = createEmptyNodeDetail();
  unlockBodyScroll();
};

const handleDetailKeydown = (event) => {
  if (event.key === 'Escape') {
    closeNodeDetail();
  }
};

watch(selectedNodeId, async (value) => {
  if (value) {
    previousFocusedElement = document.activeElement;
    window.addEventListener('keydown', handleDetailKeydown);
    await nextTick();
    detailCloseButtonRef.value?.focus();
    return;
  }
  window.removeEventListener('keydown', handleDetailKeydown);
  if (previousFocusedElement && typeof previousFocusedElement.focus === 'function') {
    previousFocusedElement.focus();
  }
  previousFocusedElement = null;
});

const displayMetrics = ref({
  total: 0,
  online: 0,
  offline: 0,
  sla: 0
});

const animateValues = (target) => {
  const duration = 1000;
  const start = Date.now();
  const initial = { ...displayMetrics.value };
  
  const step = () => {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3); // Ease out cubic
    
    displayMetrics.value.total = Math.floor(initial.total + (target.total - initial.total) * ease);
    displayMetrics.value.online = Math.floor(initial.online + (target.online - initial.online) * ease);
    displayMetrics.value.offline = Math.floor(initial.offline + (target.offline - initial.offline) * ease);
    displayMetrics.value.sla = Math.floor(initial.sla + (target.sla - initial.sla) * ease);
    
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

const statusSummary = computed(() => {
  const total = nodes.value.length;
  const online = nodes.value.filter((n) => n.status === 'online').length;
  const offline = total - online;
  return { total, online, offline };
});

const onlineRate = computed(() => {
  if (!statusSummary.value.total) return 0;
  return Math.round((statusSummary.value.online / statusSummary.value.total) * 100);
});

const featuredIndex = ref(0);
const featuredNodes = computed(() => {
  return sortNodesByStatusAndName(nodes.value).slice(0, 8);
});

const activeFeatured = computed(() => {
  if (!featuredNodes.value.length) return null;
  const index = featuredIndex.value % featuredNodes.value.length;
  return featuredNodes.value[index];
});

const anomalyNodes = computed(() => {
  return nodes.value.filter((node) => {
    const cpu = node.latest?.cpu?.usage ?? node.latest?.cpuPercent;
    const mem = node.latest?.mem?.usage ?? node.latest?.memPercent;
    const disk = node.latest?.disk?.usage ?? node.latest?.diskPercent;
    return node.status === 'offline'
      || (Number.isFinite(cpu) && cpu >= 85)
      || (Number.isFinite(mem) && mem >= 90)
      || (Number.isFinite(disk) && disk >= 90);
  });
});

const nodeRiskScore = (node) => {
  const cpu = Number(node.latest?.cpu?.usage ?? node.latest?.cpuPercent ?? 0);
  const mem = Number(node.latest?.mem?.usage ?? node.latest?.memPercent ?? 0);
  const disk = Number(node.latest?.disk?.usage ?? node.latest?.diskPercent ?? 0);
  const pressure = (Number.isFinite(cpu) ? cpu : 0) + (Number.isFinite(mem) ? mem : 0) + (Number.isFinite(disk) ? disk : 0);
  return (node.status === 'offline' ? 1000 : 0) + pressure;
};

const focusQueue = computed(() => {
  return [...nodes.value]
    .sort((a, b) => nodeRiskScore(b) - nodeRiskScore(a))
    .slice(0, 5);
});

const sortedNodes = computed(() => {
  return sortNodesByStatusAndName(nodes.value);
});

const nodeGroupItems = computed(() => {
  const countMap = new Map();
  nodes.value.forEach((node) => {
    const key = node.groupTag || '未分组';
    countMap.set(key, (countMap.get(key) || 0) + 1);
  });
  const groups = Array.from(countMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
  return [{ name: '全部', count: nodes.value.length }, ...groups];
});

const filteredSortedNodes = computed(() => {
  if (selectedGroup.value === '全部') return sortedNodes.value;
  return sortedNodes.value.filter((node) => (node.groupTag || '未分组') === selectedGroup.value);
});

const loadSnapshot = async () => {
  loading.value = true;
  error.value = '';
  const result = await fetchVpsPublicSnapshot(getPublicToken());
  if (result.success) {
    nodes.value = result.data?.data || [];
    themePreset.value = result.data?.theme?.preset || 'default';
    themeConfig.value = {
      ...themeConfig.value,
      ...(result.data?.theme || {})
    };
    const groupNames = new Set(nodeGroupItems.value.map((item) => item.name));
    if (!groupNames.has(selectedGroup.value)) {
      selectedGroup.value = '全部';
    }
    lastUpdatedAt.value = new Date().toLocaleString();
    
    // Trigger animation
    animateValues({
      total: statusSummary.value.total,
      online: statusSummary.value.online,
      offline: statusSummary.value.offline,
      sla: onlineRate.value
    });
  } else {
    error.value = result.error || '加载失败';
  }
  loading.value = false;
};

let rotateTimer = null;
const startRotation = () => {
  if (rotateTimer) return;
  rotateTimer = setInterval(() => {
    featuredIndex.value += 1;
  }, 6000);
};

const stopRotation = () => {
  if (rotateTimer) {
    clearInterval(rotateTimer);
    rotateTimer = null;
  }
};

const formatPercent = (val) => (val === null || val === undefined ? '--' : `${val}%`);
const formatLoad = (val) => (val === null || val === undefined ? '--' : Number(val).toFixed(2));
const formatTraffic = (traffic) => {
  if (!traffic) return '--';
  const rx = traffic.rx ?? traffic.download ?? traffic.in;
  const tx = traffic.tx ?? traffic.upload ?? traffic.out;
  const format = (value) => {
    if (value === null || value === undefined) return '--';
    const num = Number(value);
    if (isNaN(num)) return '--';
    const gb = num / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };
  return `⬇ ${format(rx)} / ⬆ ${format(tx)}`;
};

const formatTotalTraffic = (bytes) => {
  if (bytes === null || bytes === undefined || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  if (bytes < k) return bytes + ' B';
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatUptime = (seconds) => {
  const total = Number(seconds);
  if (!Number.isFinite(total)) return '--';
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const averageMetric = (selector) => {
  const values = nodes.value
    .map(selector)
    .filter((val) => Number.isFinite(Number(val)))
    .map(Number);
  if (!values.length) return null;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / values.length);
};

const avgCpu = computed(() => averageMetric(node => node.latest?.cpu?.usage ?? node.latest?.cpuPercent));
const avgMem = computed(() => averageMetric(node => node.latest?.mem?.usage ?? node.latest?.memPercent));
const avgDisk = computed(() => averageMetric(node => node.latest?.disk?.usage ?? node.latest?.diskPercent));
const avgLoad = computed(() => {
  const values = nodes.value
    .map(node => node.latest?.load1 ?? node.latest?.load?.load1)
    .filter((val) => Number.isFinite(Number(val)))
    .map(Number);
  if (!values.length) return null;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return (sum / values.length).toFixed(2);
});

const sparklinePoints = (values) => {
  const data = values
    .map((val) => (val === null || val === undefined ? null : Number(val)))
    .filter((val) => Number.isFinite(val));
  if (!data.length) return '';
  const width = 120;
  const height = 32;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : width;
  return data
    .map((val, idx) => {
      const x = Math.round(idx * step);
      const y = Math.round(height - ((val - min) / range) * height);
      return `${x},${y}`;
    })
    .join(' ');
};

const nodeSparkline = (node) => {
  const cpu = node.latest?.cpu?.usage ?? node.latest?.cpuPercent ?? null;
  const mem = node.latest?.mem?.usage ?? node.latest?.memPercent ?? null;
  const disk = node.latest?.disk?.usage ?? node.latest?.diskPercent ?? null;
  return sparklinePoints([cpu, mem, disk]);
};

const flippedNodes = ref(new Set());
const toggleFlip = (nodeId) => {
  if (flippedNodes.value.has(nodeId)) {
    flippedNodes.value.delete(nodeId);
  } else {
    flippedNodes.value.add(nodeId);
  }
};

const getLatencyColor = (ms) => {
  if (ms === null || ms === undefined) return 'text-[#8a7f70]';
  if (ms < 100) return 'text-emerald-500';
  if (ms < 300) return 'text-sky-500';
  if (ms < 500) return 'text-amber-500';
  return 'text-rose-500';
};

const getLossColor = (loss) => {
  if (loss === null || loss === undefined) return 'text-[#8a7f70]';
  if (loss === 0) return 'text-emerald-500';
  if (loss < 10) return 'text-amber-500';
  return 'text-rose-500';
};

onMounted(() => {
  loadSnapshot();
  startRotation();
  window.addEventListener('mousemove', updateMouse);
});

onUnmounted(() => {
  stopRotation();
  window.removeEventListener('mousemove', updateMouse);
  window.removeEventListener('keydown', handleDetailKeydown);
  if (mouseFrame !== null) {
    cancelAnimationFrame(mouseFrame);
    mouseFrame = null;
  }
  unlockBodyScroll();
});
</script>

<style scoped>
.vps-card-container {
  perspective: 1200px;
  min-height: 214px;
}

.vps-card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
  cursor: pointer;
}

.vps-card-inner.is-flipped {
  transform: rotateY(180deg);
}

.vps-card-front,
.vps-card-back {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform-style: preserve-3d;
}

.vps-card-front {
  z-index: 2;
  transform: translateZ(1px);
}

.vps-card-back {
  transform: rotateY(180deg) translateZ(1px);
}

/* v2.1 Enhanced Visuals */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.glass-premium {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);
}

.dark .glass-premium {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}

.status-glow-online {
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.2);
  animation: pulse-glow 3s infinite ease-in-out;
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 10px rgba(16, 185, 129, 0.1); }
  50% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.3); }
}

.bg-shimmer {
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}

.theme-default {
  background-image: radial-gradient(circle at top, rgba(255,255,255,0.32), transparent 60%);
}

.theme-komari {
  background-image:
    radial-gradient(circle at 20% 20%, rgba(56,189,248,0.18), transparent 35%),
    radial-gradient(circle at 80% 10%, rgba(99,102,241,0.12), transparent 28%),
    linear-gradient(180deg, #f4f7fb 0%, #eef4fb 100%);
}

.theme-minimal {
  background-image:
    linear-gradient(180deg, rgba(248,250,252,0.7) 0%, rgba(255,255,255,1) 100%),
    linear-gradient(transparent 31px, rgba(148,163,184,0.08) 32px),
    linear-gradient(90deg, transparent 31px, rgba(148,163,184,0.08) 32px);
  background-size: auto, 32px 32px, 32px 32px;
}

.theme-tech-dark {
  background-image:
    radial-gradient(circle at 20% 20%, rgba(34,211,238,0.12), transparent 30%),
    radial-gradient(circle at 80% 15%, rgba(14,165,233,0.16), transparent 26%),
    linear-gradient(180deg, #050816 0%, #0a1227 100%);
}

.theme-glass {
  background-image:
    radial-gradient(circle at 25% 20%, rgba(99,102,241,0.14), transparent 30%),
    radial-gradient(circle at 75% 10%, rgba(56,189,248,0.16), transparent 28%),
    linear-gradient(180deg, #eef4ff 0%, #e7effd 100%);
}

.layout-hero-split .vps-card-front,
.layout-hero-split .vps-card-back {
  border-radius: 1.5rem;
}

.layout-tech-grid .vps-card-front,
.layout-tech-grid .vps-card-back {
  box-shadow: inset 0 0 0 1px rgba(34,211,238,0.08);
}

.layout-glass-showcase .vps-card-front,
.layout-glass-showcase .vps-card-back {
  backdrop-filter: blur(24px);
}

.layout-minimal .vps-card-front,
.layout-minimal .vps-card-back {
  min-height: 190px;
}
</style>

<template>
  <div class="min-h-screen vps-public-theme-root" :class="[theme.root, theme.backdrop, themeClass, `layout-${layoutClass}`]" :style="rootStyle">
    <component :is="'style'" v-if="sanitizedCustomCss">{{ sanitizedCustomCss }}</component>
    <div class="relative overflow-hidden">
      <div class="absolute inset-0">
        <!-- Interactive Glow -->
        <div 
          class="pointer-events-none absolute h-96 w-96 rounded-full bg-primary-500/10 blur-[100px] transition-transform duration-300 ease-out"
          :style="{ transform: `translate(${mouseX - 192}px, ${mouseY - 192}px)` }"
        ></div>
        <div class="absolute -top-24 left-10 h-72 w-72 rounded-full bg-gradient-to-br from-[#0ea5e9]/25 via-[#2dd4bf]/15 to-[#f97316]/20 blur-3xl"></div>
        <div class="absolute top-24 right-10 h-64 w-64 rounded-full bg-gradient-to-br from-[#f97316]/20 via-[#22c55e]/15 to-[#38bdf8]/20 blur-3xl"></div>
        <div class="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-gradient-to-br from-[#f59e0b]/18 via-[#22c55e]/12 to-[#0ea5e9]/16 blur-3xl"></div>
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,#ffffff52,transparent_60%)] dark:bg-[radial-gradient(circle_at_top,#1e293b4d,transparent_60%)]"></div>
        <div class="absolute inset-0 opacity-20 dark:opacity-25 bg-[linear-gradient(transparent_23px,rgba(148,163,184,0.22)_24px),linear-gradient(90deg,transparent_23px,rgba(148,163,184,0.22)_24px)] bg-[size:24px_24px]"></div>
        <div class="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#f7f6f1] via-[#f7f6f1]/80 dark:from-[#0a0d14] dark:via-[#0a0d14]/70 to-transparent"></div>
      </div>
        <div class="relative max-w-6xl mx-auto px-6 pt-16 pb-12">
        <div class="flex flex-col gap-8" :class="layoutClass === 'hero-split' ? 'lg:flex-row lg:items-center lg:justify-between' : 'lg:flex-row lg:items-end lg:justify-between'">
          <div class="max-w-2xl">
            <div class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.28em]" :class="heroBadgeClass">
              <img v-if="themeConfig.logo" :src="themeConfig.logo" alt="logo" class="h-4 w-4 rounded-full object-cover" />
              Status Observatory
            </div>
            <h1 class="mt-4 text-4xl md:text-5xl font-semibold" :class="heroTitleClass">
              {{ themeConfig.title }}
            </h1>
            <p class="mt-3 text-sm md:text-base" :class="heroTextClass">
              {{ themeConfig.subtitle }}
            </p>
            <div class="mt-6 flex flex-wrap items-center gap-3 text-xs" :class="heroTextClass">
              <span class="inline-flex items-center gap-2 rounded-full border px-3 py-1" :class="heroBadgeClass">
                更新时间 {{ lastUpdatedAt || '--' }}
              </span>
              <button
                class="inline-flex items-center gap-2 rounded-full border px-4 py-1 hover:shadow-xl"
                :class="accentButtonClass"
                @click="loadSnapshot"
              >
                刷新数据
              </button>
            </div>
          </div>
          <div v-if="showStats" class="grid grid-cols-2 gap-4 text-xs" :class="layoutClass === 'hero-split' ? 'lg:max-w-md' : ''">
            <div class="rounded-2xl border p-4 transition-transform hover:scale-[1.02]" :class="statCardClass">
              <div class="flex items-center justify-between">
                <p class="text-[#8a7f70] dark:text-slate-400">节点总数</p>
                <span class="text-[10px] px-2 py-0.5 rounded-full border border-[#efe6db] bg-[#fdfaf6] text-[#6a5f54] dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">ALL</span>
              </div>
              <p class="mt-2 text-2xl font-semibold text-[#1f1b17] dark:text-slate-100 tabular-nums">{{ displayMetrics.total }}</p>
            </div>
            <div class="rounded-2xl border border-[#d1fae5]/80 bg-[#ecfdf3]/80 p-4 shadow-[0_14px_30px_-22px_rgba(5,150,105,0.2)] dark:border-emerald-500/30 dark:bg-emerald-500/10 transition-transform hover:scale-[1.02]">
              <div class="flex items-center justify-between">
                <p class="text-[#087f5b] dark:text-emerald-300">在线节点</p>
                <span class="text-[10px] px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300">OK</span>
              </div>
              <p class="mt-2 text-2xl font-semibold text-[#064e3b] dark:text-emerald-200 tabular-nums">{{ displayMetrics.online }}</p>
            </div>
            <div class="rounded-2xl border border-[#fee2e2]/80 bg-[#fef2f2]/80 p-4 shadow-[0_14px_30px_-22px_rgba(244,63,94,0.22)] dark:border-rose-500/30 dark:bg-rose-500/10 transition-transform hover:scale-[1.02]">
              <div class="flex items-center justify-between">
                <p class="text-[#b91c1c] dark:text-rose-300">离线节点</p>
                <span class="text-[10px] px-2 py-0.5 rounded-full border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300">DOWN</span>
              </div>
              <p class="mt-2 text-2xl font-semibold text-[#7f1d1d] dark:text-rose-200 tabular-nums">{{ displayMetrics.offline }}</p>
            </div>
            <div class="rounded-2xl border border-[#e0e7ff]/80 bg-[#eef2ff]/80 p-4 shadow-[0_14px_30px_-22px_rgba(59,130,246,0.22)] dark:border-sky-500/30 dark:bg-sky-500/10 transition-transform hover:scale-[1.02]">
              <div class="flex items-center justify-between">
                <p class="text-[#3730a3] dark:text-sky-300">在线率</p>
                <span class="text-[10px] px-2 py-0.5 rounded-full border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-300">SLA</span>
              </div>
              <p class="mt-2 text-2xl font-semibold text-[#312e81] dark:text-sky-200 tabular-nums">{{ displayMetrics.sla }}%</p>
            </div>
          </div>
        </div>
        <div v-if="showStats" class="mt-8 rounded-[24px] border p-4" :class="panelClass">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="h-2 w-24 rounded-full bg-[#efe6db] dark:bg-slate-800">
                <div class="h-2 rounded-full bg-gradient-to-r from-emerald-500 via-sky-400 to-amber-400" :style="{ width: onlineRate + '%' }"></div>
              </div>
              <span class="text-xs text-[#8a7f70] dark:text-slate-400">在线率趋势</span>
            </div>
            <div class="flex flex-wrap items-center gap-2 text-[11px]">
              <span class="px-2 py-1 rounded-full border border-[#efe6db] bg-[#fdfaf6] text-[#6a5f54] dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">CPU ≤ 85%</span>
              <span class="px-2 py-1 rounded-full border border-[#efe6db] bg-[#fdfaf6] text-[#6a5f54] dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">内存 ≤ 90%</span>
              <span class="px-2 py-1 rounded-full border border-[#efe6db] bg-[#fdfaf6] text-[#6a5f54] dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">响应稳定</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="max-w-6xl mx-auto px-6 pb-16">
      <div v-if="loading" role="status" aria-live="polite" class="py-16 text-center text-sm text-[#8a7f70] dark:text-slate-400">正在加载探针数据...</div>
      <div v-else-if="error" aria-live="assertive" class="py-16 text-center text-sm text-rose-600 dark:text-rose-300">{{ error }}</div>
        <div v-else-if="!nodes.length" class="rounded-[30px] border p-8 text-center" :class="panelClass">
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#f4efe7] text-3xl dark:bg-slate-800/80">🛰️</div>
        <h2 class="mt-5 text-xl font-semibold text-[#1f1b17] dark:text-slate-100">暂无可公开展示的探针节点</h2>
        <p class="mt-2 text-sm text-[#8a7f70] dark:text-slate-400">节点接入并上报后，这里会自动展示运行状态、资源概览和历史趋势。</p>
      </div>
        <div v-else class="flex flex-col gap-8 lg:gap-10">
          <!-- Anomaly/Alert Section (New) -->
          <div v-if="showAnomalies && anomalyNodes.length > 0" class="relative group" :style="sectionOrderStyle('anomalies')">
          <div class="absolute -inset-1 bg-gradient-to-r from-rose-500/20 to-orange-500/20 rounded-[32px] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
          <div class="relative rounded-[24px] border border-rose-200/50 bg-rose-50/10 backdrop-blur-3xl p-3 sm:p-4 dark:border-rose-900/30 dark:bg-rose-900/10">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2.5">
              <div class="flex items-center gap-3">
                <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/20 text-rose-500 animate-pulse">
                  <span class="inline-block -translate-y-px text-base leading-none">⚠</span>
                </div>
                <div>
                  <h2 class="text-base font-bold text-rose-700 dark:text-rose-400">异常节点</h2>
                  <p class="mt-0.5 text-[11px] text-rose-600/70 dark:text-rose-400/60">仅展示需要优先处理的离线或高负载节点</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="rounded-full border border-rose-300/70 bg-white/70 px-3 py-1 text-[10px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-700/50 dark:bg-slate-900/70 dark:text-rose-300 dark:hover:bg-rose-900/20"
                  @click="anomalyExpanded = !anomalyExpanded"
                  :aria-expanded="anomalyExpanded"
                >
                  {{ anomalyExpanded ? '收起' : '展开' }}异常
                </button>
                <span class="rounded-full bg-rose-500 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">{{ anomalyNodes.length }} 告警</span>
              </div>
            </div>

            <div v-if="anomalyExpanded" class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <article v-for="node in anomalyNodes" :key="node.id" class="rounded-2xl border border-rose-200/80 bg-white/55 p-2.5 shadow-lg shadow-rose-500/5 dark:border-rose-900/40 dark:bg-slate-900/70">
                <div class="relative mb-2 h-1 w-full rounded-full bg-rose-100 dark:bg-slate-800">
                  <div class="h-1 rounded-full bg-rose-500" :style="{ width: node.status === 'offline' ? '88%' : '72%' }"></div>
                </div>
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <img v-if="node.countryCode" :src="`https://flagcdn.com/w20/${node.countryCode.toLowerCase()}.png`" class="h-3 rounded-sm opacity-90" alt="" @error="getFlagFallback" />
                      <p class="truncate text-sm font-bold text-rose-900 dark:text-rose-300">{{ node.name || node.id }}</p>
                    </div>
                    <p class="mt-1 truncate text-[10px] uppercase tracking-tight text-rose-700/65 dark:text-rose-400/60">{{ node.region || '未知地区' }} · {{ node.status === 'offline' ? '连接异常' : '负载告警' }}</p>
                  </div>
                  <span class="shrink-0 rounded-lg bg-rose-500 px-2 py-1 text-[9px] font-bold text-white">{{ node.status === 'online' ? '高负载' : '离线' }}</span>
                </div>
                <div class="mt-2 grid grid-cols-2 gap-2 text-[10px] font-medium text-rose-700/80 dark:text-rose-300/75">
                  <div :class="{ 'text-rose-600 font-bold': (node.latest?.cpu?.usage ?? node.latest?.cpuPercent) >= 85 }">CPU {{ formatPercent(node.latest?.cpu?.usage ?? node.latest?.cpuPercent) }}</div>
                  <div :class="{ 'text-rose-600 font-bold': (node.latest?.mem?.usage ?? node.latest?.memPercent) >= 90 }">内存 {{ formatPercent(node.latest?.mem?.usage ?? node.latest?.memPercent) }}</div>
                </div>
                <div class="mt-2 flex items-center justify-between border-t border-rose-200/50 pt-2 dark:border-rose-900/35">
                  <span class="truncate text-[9px] font-mono text-rose-500/85">{{ lastUpdatedAt }}</span>
                  <button @click="openNodeDetail(node.id)" class="rounded-lg bg-rose-500 px-2 py-1 text-[10px] font-bold text-white transition-colors hover:bg-rose-600">诊断详情</button>
                </div>
              </article>
            </div>
            <div v-else class="rounded-xl border border-dashed border-rose-300/60 bg-white/50 px-4 py-3 text-xs text-rose-700/80 dark:border-rose-800/60 dark:bg-slate-900/40 dark:text-rose-300/80">
              异常节点列表已默认收起，点击右上角“展开异常”查看详情。
            </div>
          </div>
        </div>

          <div class="space-y-6" :style="sectionOrderStyle('nodes')">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-2xl font-bold text-[#1f1b17] dark:text-slate-100 flex items-center gap-3">
              <span class="text-blue-500">✦</span> 全部节点
            </h2>
            <div class="flex items-center gap-2">
              <span class="text-xs text-[#8a7f70] dark:text-slate-400">在线与离线节点统一展示</span>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              v-for="group in nodeGroupItems"
              :key="group.name"
              type="button"
              class="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors"
                :class="selectedGroup === group.name
                  ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300'
                  : pillClass"
                @click="selectedGroup = group.name"
              >
              <span>{{ group.name }}</span>
              <span class="text-[10px] opacity-75">{{ group.count }}</span>
            </button>
          </div>
          
          <div v-if="filteredSortedNodes.length" class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div v-for="node in filteredSortedNodes" :key="node.id" class="vps-card-container">
                <div class="vps-card-inner group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2" :class="{ 'is-flipped': flippedNodes.has(node.id) }" @click="toggleFlip(node.id)" @keydown.enter.prevent="toggleFlip(node.id)" @keydown.space.prevent="toggleFlip(node.id)" tabindex="0" role="button" :aria-pressed="flippedNodes.has(node.id)" :aria-label="`切换 ${node.name || node.id} 的节点网络状态卡片`">
                  <!-- Front Side -->
                  <div class="vps-card-front rounded-2xl border p-4" :class="nodeCardClass">
                    <div class="h-1 w-full rounded-full bg-[#efe6db] dark:bg-slate-800 relative">
                      <div class="absolute inset-0 flex items-center justify-between px-1 opacity-40">
                        <span class="h-0.5 w-2 bg-white/70 dark:bg-white/20"></span>
                        <span class="h-0.5 w-2 bg-white/70 dark:bg-white/20"></span>
                        <span class="h-0.5 w-2 bg-white/70 dark:bg-white/20"></span>
                        <span class="h-0.5 w-2 bg-white/70 dark:bg-white/20"></span>
                      </div>
                      <div
                        class="h-1 rounded-full bg-gradient-to-r"
                        :class="node.status === 'online'
                          ? 'from-emerald-500 via-sky-400 to-amber-400'
                          : 'from-rose-500 via-orange-400 to-amber-300'"
                        :style="{ width: node.status === 'online' ? '100%' : '45%' }"
                      ></div>
                    </div>
                    <div class="mt-2 flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <img 
                            v-if="node.countryCode" 
                            :src="`https://flagcdn.com/w20/${node.countryCode.toLowerCase()}.png`" 
                            class="h-3.5 w-auto rounded-sm opacity-90" 
                            alt=""
                            :title="node.countryCode"
                            @error="getFlagFallback"
                          />
                          <p class="truncate text-sm font-semibold text-[#1f1b17] dark:text-slate-100">{{ node.name || node.id }}</p>
                        </div>
                        <p class="truncate text-xs text-[#8a7f70] dark:text-slate-400">
                          <span v-if="node.tag" class="mr-1">{{ node.tag }} ·</span>
                          {{ node.region || '未知地区' }}
                          <span class="ml-1 opacity-70">| 📊 {{ formatTotalTraffic(node.totalRx + node.totalTx) }}</span>
                        </p>
                        <div class="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                          <span class="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50/70 px-2 py-0.5 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                            组: {{ node.groupTag || '未分组' }}
                          </span>
                          <span class="inline-flex items-center gap-1 rounded-full border border-[#efe6db] bg-white/70 px-2 py-0.5 text-[#6a5f54] dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                            ⚡ 负载: {{ formatLoad(node.latest?.load1 ?? node.latest?.load?.load1) }}
                          </span>
                        </div>
                      </div>
                      <span class="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]"
                        :class="node.status === 'online'
                          ? 'border-[#bbf7d0] bg-[#ecfdf3] text-[#0f766e] dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : 'border-[#fecdd3] bg-[#fff1f2] text-[#be123c] dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300'"
                      >
                        {{ node.status === 'online' ? '在线' : '离线' }}
                      </span>
                    </div>
                    <div class="mt-3 flex items-center justify-between">
                      <svg viewBox="0 0 120 32" class="h-7 w-24">
                        <polyline :points="nodeSparkline(node)" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" />
                      </svg>
                      <span class="text-[9px] text-[#8a7f70] dark:text-slate-400">CPU/MEM/DISK</span>
                    </div>
                    <div class="mt-4 grid grid-cols-2 gap-2 text-[11px] text-[#6a5f54] dark:text-slate-400">
                      <div>CPU {{ formatPercent(node.latest?.cpu?.usage ?? node.latest?.cpuPercent) }}</div>
                      <div>内存 {{ formatPercent(node.latest?.mem?.usage ?? node.latest?.memPercent) }}</div>
                      <div>磁盘 {{ formatPercent(node.latest?.disk?.usage ?? node.latest?.diskPercent) }}</div>
                      <div>流量 {{ formatTraffic(node.latest?.traffic) }}</div>
                    </div>
                    <!-- Traffic Limit Progress -->
                    <div v-if="node.trafficLimitGb > 0" class="mt-4 border-t border-[#efe6db]/60 pt-3 dark:border-slate-800/60">
                      <div class="mb-1 flex items-center justify-end text-[10px] text-emerald-600 dark:text-emerald-400">
                        <span class="font-medium text-[#6a5f54] dark:text-slate-300">限额: {{ node.trafficLimitGb }} GB</span>
                      </div>
                      <div class="h-1 w-full bg-[#efe6db] dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                        <div 
                          class="h-full transition-all duration-500" 
                          :class="((node.totalRx + node.totalTx) / (node.trafficLimitGb * 1024 * 1024 * 1024) * 100) > 95
                            ? 'bg-rose-500' 
                            : (((node.totalRx + node.totalTx) / (node.trafficLimitGb * 1024 * 1024 * 1024) * 100) > 80 ? 'bg-amber-500' : 'bg-gradient-to-r from-blue-400 to-indigo-500')"
                          :style="{ width: getTrafficLimitUsage(node) }"
                        ></div>
                      </div>
                    </div>
                  </div>

                  <!-- Back Side: Network Metrics -->
                  <div class="vps-card-back rounded-2xl border p-4 flex flex-col h-full" :class="nodeCardClass">
                    <div class="mb-2 flex items-center justify-between border-b border-[#efe6db] pb-1.5 dark:border-slate-800">
                      <h4 class="flex items-center gap-1 text-[11px] font-semibold text-[#1f1b17] dark:text-slate-100">
                        <span class="text-blue-500 text-[10px]">🌐</span> 网络状态
                      </h4>
                      <span class="text-[9px] text-[#8a7f70] dark:text-slate-400 opacity-70">点击返回</span>
                    </div>
                    
                    <div v-if="node.latest?.network && node.latest.network.length" class="flex-1 overflow-y-auto pr-1">
                      <div class="mb-1.5 grid grid-cols-[1fr_58px_40px] gap-2 border-b border-[#efe6db]/50 px-1 pb-0.5 text-[9px] font-bold uppercase tracking-wider text-[#8a7f70] dark:border-slate-800/50 dark:text-slate-500">
                        <span>监测点</span>
                        <span class="text-right">延迟</span>
                        <span class="text-right">丢包</span>
                      </div>
                      <div class="divide-y divide-[#efe6db]/60 dark:divide-slate-800/60">
                        <div v-for="(check, idx) in node.latest.network.slice(0, 4)" :key="idx" class="grid grid-cols-[1fr_58px_40px] gap-2 py-1.5 items-baseline hover:bg-black/5 dark:hover:bg-white/5 rounded-sm px-1 transition-colors">
                          <span class="truncate text-[10px] font-medium text-[#2c2721] dark:text-slate-200" :title="check.name || check.target">
                            {{ check.name || check.target.replace(/^http(s)?:\/\//, '') }}
                          </span>
                          <span class="text-[10px] font-bold text-right tabular-nums" :class="getLatencyColor(check.latencyMs)">
                            {{ check.latencyMs !== null ? Math.round(check.latencyMs) + 'ms' : '--' }}
                          </span>
                          <span class="text-[10px] font-bold text-right tabular-nums" :class="getLossColor(check.lossPercent)">
                            {{ check.lossPercent !== null ? check.lossPercent + '%' : '--' }}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div v-else class="flex flex-col items-center justify-center flex-1 text-center opacity-60">
                      <span class="text-xl mb-1">📡</span>
                      <p class="text-[10px] text-[#8a7f70] dark:text-slate-400">暂无网络监控数据</p>
                    </div>

                    <!-- History Detail Button -->
                    <div class="mt-auto border-t border-[#efe6db]/60 pt-2.5 dark:border-slate-800/60">
                      <button 
                        @click.stop="openNodeDetail(node.id)"
                        class="w-full rounded-xl bg-blue-500/10 py-2 text-[10px] font-bold uppercase tracking-wider text-blue-600 transition-all hover:bg-blue-500 hover:text-white dark:bg-blue-500/20 dark:text-blue-400"
                      >
                        {{ selectedNodeId === node.id ? '收起曲线' : '查看延迟曲线' }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="!filteredSortedNodes.length" class="rounded-xl border border-dashed border-[#dfd5c8] bg-white/60 px-4 py-3 text-xs text-[#7b6e5f] dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
             当前分组下暂无节点，试试切换其它分组。
          </div>
          </div>

          <div v-if="showFeatured" class="rounded-[26px] border p-4 sm:p-5" :class="panelClass" :style="sectionOrderStyle('featured')">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="text-base font-semibold text-[#1f1b17] dark:text-slate-100">重点轮播 · 资源脉冲</h2>
                <p class="mt-1 text-xs text-[#8a7f70] dark:text-slate-400">重点节点展示与最近一次资源占用汇总</p>
              </div>
              <span class="text-xs text-[#8a7f70] dark:text-slate-400">每 6 秒切换</span>
            </div>
            <div class="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.25fr_0.95fr]">
              <div class="grid grid-cols-1 gap-4 self-start lg:grid-cols-[1.15fr_0.85fr]">
            <div class="rounded-2xl border p-4" :class="panelSoftClass">
              <div class="flex items-start justify-between mt-3">
                <div>
                    <div class="flex items-center gap-2">
                      <img 
                        v-if="activeFeatured?.countryCode" 
                        :src="`https://flagcdn.com/w20/${activeFeatured.countryCode.toLowerCase()}.png`" 
                        class="h-3.5 w-auto rounded-sm opacity-90" 
                        alt=""
                        :title="activeFeatured.countryCode"
                        @error="getFlagFallback"
                      />
                      <p class="text-sm font-semibold text-[#1f1b17] dark:text-slate-100">{{ activeFeatured?.name || activeFeatured?.id || '--' }}</p>
                    </div>
                  <p class="text-xs text-[#8a7f70] dark:text-slate-400">{{ activeFeatured?.tag || '--' }} · {{ activeFeatured?.region || '未知地区' }}</p>
                </div>
                <span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]"
                  :class="activeFeatured?.status === 'online'
                    ? 'border-[#bbf7d0] bg-[#ecfdf3] text-[#0f766e] dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'border-[#fecdd3] bg-[#fff1f2] text-[#be123c] dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300'"
                >
                  {{ activeFeatured?.status === 'online' ? '在线' : '离线' }}
                </span>
              </div>
              <div class="mt-4 grid grid-cols-2 gap-4 text-[11px] text-[#6a5f54] dark:text-slate-400">
                <div class="flex justify-between"><span>CPU</span> <span class="font-medium">{{ formatPercent(activeFeatured?.latest?.cpu?.usage ?? activeFeatured?.latest?.cpuPercent) }}</span></div>
                <div class="flex justify-between"><span>内存</span> <span class="font-medium">{{ formatPercent(activeFeatured?.latest?.mem?.usage ?? activeFeatured?.latest?.memPercent) }}</span></div>
                <div class="flex justify-between"><span>磁盘</span> <span class="font-medium">{{ formatPercent(activeFeatured?.latest?.disk?.usage ?? activeFeatured?.latest?.diskPercent) }}</span></div>
                <div class="flex justify-between"><span>运行</span> <span class="font-medium">{{ formatUptime(activeFeatured?.latest?.uptimeSec) }}</span></div>
              </div>
            </div>
            
            <div class="rounded-2xl border p-4" :class="panelSoftClass">
              <h3 class="text-sm font-semibold text-[#1f1b17] dark:text-slate-100">运行概览</h3>
              <p class="mt-1 text-xs text-[#8a7f70] dark:text-slate-400">健康状况自检</p>
              <div v-if="anomalyNodes.length" class="mt-3 space-y-2 text-[11px] text-[#6a5f54] dark:text-slate-400">
                <div v-for="node in anomalyNodes.slice(0,5)" :key="node.id" class="flex items-center justify-between">
                  <span>{{ node.name || node.id }}</span>
                  <span class="px-2 py-0.5 rounded-full border"
                    :class="node.status === 'offline'
                      ? 'border-[#fecdd3] bg-[#fff1f2] text-[#be123c] dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300'
                      : 'border-[#fde68a] bg-[#fffbeb] text-[#b45309] dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300'"
                  >
                    {{ node.status === 'offline' ? '离线' : '重负载' }}
                  </span>
                </div>
              </div>
              <div v-else class="mt-3 text-[11px] text-[#8a7f70] dark:text-slate-400">所有节点运行良好</div>
            </div>
            <div class="rounded-2xl border p-4 lg:col-span-2" :class="panelSoftClass">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-[#1f1b17] dark:text-slate-100">关注队列</h3>
                <span class="text-[10px] text-[#8a7f70] dark:text-slate-400">按风险优先</span>
              </div>
              <div class="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div v-for="node in focusQueue" :key="`focus-${node.id}`" class="flex items-center justify-between rounded-xl border border-[#efe6db] bg-white/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/55">
                  <div class="min-w-0">
                    <p class="truncate text-[11px] font-semibold text-[#1f1b17] dark:text-slate-100">{{ node.name || node.id }}</p>
                    <p class="truncate text-[10px] text-[#8a7f70] dark:text-slate-400">CPU {{ formatPercent(node.latest?.cpu?.usage ?? node.latest?.cpuPercent) }} · 内存 {{ formatPercent(node.latest?.mem?.usage ?? node.latest?.memPercent) }}</p>
                  </div>
                  <span class="ml-3 shrink-0 rounded-full border px-2 py-0.5 text-[10px]"
                    :class="node.status === 'offline'
                      ? 'border-[#fecdd3] bg-[#fff1f2] text-[#be123c] dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300'
                      : 'border-[#fde68a] bg-[#fffbeb] text-[#b45309] dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300'"
                  >
                    {{ node.status === 'offline' ? '离线' : '高负载' }}
                  </span>
                </div>
              </div>
            </div>
              </div>
              <div class="rounded-[22px] border p-4" :class="panelClass">
                <h3 class="text-sm font-semibold text-[#1f1b17] dark:text-slate-100">资源脉冲</h3>
                <p class="mt-1 text-xs text-[#8a7f70] dark:text-slate-400">汇总最近一次上报的资源占用</p>
                <div class="mt-4 grid grid-cols-2 gap-3">
                  <VpsMetricChart title="CPU" unit="%" :points="nodes.map(node => node.latest?.cpu?.usage ?? node.latest?.cpuPercent ?? null)" color="#0ea5e9" :height="56" />
                  <VpsMetricChart title="内存" unit="%" :points="nodes.map(node => node.latest?.mem?.usage ?? node.latest?.memPercent ?? null)" color="#f97316" :height="56" />
                  <VpsMetricChart title="磁盘" unit="%" :points="nodes.map(node => node.latest?.disk?.usage ?? node.latest?.diskPercent ?? null)" color="#22c55e" :height="56" />
                  <VpsMetricChart title="流量" unit="GB" :points="nodes.map(node => {
                    const b = node.latest?.traffic?.rx ?? node.latest?.traffic?.download ?? null;
                    return b !== null ? Number((b / (1024 * 1024 * 1024)).toFixed(2)) : null;
                  })" color="#6366f1" :height="56" :max="10" />
                </div>
                <div class="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div class="rounded-2xl border border-[#efe6db] bg-white/70 px-3 py-2.5 text-[#6a5f54] dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                    平均 CPU <span class="font-semibold">{{ formatPercent(avgCpu) }}</span>
                  </div>
                  <div class="rounded-2xl border border-[#efe6db] bg-white/70 px-3 py-2.5 text-[#6a5f54] dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                    平均内存 <span class="font-semibold">{{ formatPercent(avgMem) }}</span>
                  </div>
                  <div class="rounded-2xl border border-[#efe6db] bg-white/70 px-3 py-2.5 text-[#6a5f54] dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                    平均磁盘 <span class="font-semibold">{{ formatPercent(avgDisk) }}</span>
                  </div>
                  <div class="rounded-2xl border border-[#efe6db] bg-white/70 px-3 py-2.5 text-[#6a5f54] dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                    平均负载 <span class="font-semibold">{{ avgLoad || '--' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>



        <!-- Latency Chart Modal -->
        <transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div v-if="selectedNodeId" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-10 overflow-hidden">
            <!-- Backdrop -->
            <div class="absolute inset-0 bg-slate-950/60 backdrop-blur-md" @click="closeNodeDetail"></div>
            
            <!-- Modal Content -->
            <transition
              enter-active-class="transition duration-500 ease-out"
              enter-from-class="transform scale-90 translate-y-8 opacity-0"
              enter-to-class="transform scale-100 translate-y-0 opacity-100"
              appear
            >
              <div class="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" :aria-labelledby="detailTitleId" tabindex="-1">
                <!-- Header -->
                <div class="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
                  <div class="flex items-center gap-3">
                    <div class="flex items-center justify-center w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500">
                      <span class="text-xl">📈</span>
                    </div>
                    <div>
                        <h2 :id="detailTitleId" class="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                          {{ nodeDetailData.node?.name || '节点' }} 延迟趋势分析
                        </h2>
                      <div class="flex items-center gap-2 mt-0.5">
                        <span class="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{{ nodeDetailData.node?.region || '未知地区' }}</span>
                        <span class="text-[10px] text-slate-300 dark:text-slate-600">/</span>
                        <span class="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">最近 48 小时采样</span>
                      </div>
                    </div>
                  </div>
                  
                  <div class="flex items-center gap-4">
                    <div class="hidden sm:flex items-center gap-3 px-3 py-1.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                      <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tighter">曲线平滑</span>
                      <Switch v-model="isSmooth" size="sm" />
                    </div>
                    <button 
                      ref="detailCloseButtonRef"
                      @click="closeNodeDetail"
                      class="flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 transition-all active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                      aria-label="关闭节点详情弹窗"
                    >
                      <span class="block text-xl leading-none -translate-y-px">×</span>
                    </button>
                  </div>
                </div>

                <!-- Body -->
                <div class="flex-1 overflow-y-auto p-6 custom-scrollbar">
                  <div v-if="nodeDetailData.loading" class="h-[300px] flex items-center justify-center">
                    <div class="flex flex-col items-center gap-4">
                      <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <p class="text-xs text-slate-500 dark:text-slate-400 animate-pulse font-medium">正在拉取历史多点采样数据...</p>
                    </div>
                  </div>
                  <div v-else-if="nodeDetailData.error" aria-live="assertive" class="h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-rose-100 dark:border-rose-900/40 rounded-[24px] bg-rose-50/40 dark:bg-rose-950/10">
                    <span class="text-3xl mb-3 opacity-60">⚠</span>
                    <p class="text-sm text-rose-600 dark:text-rose-300 font-medium">{{ nodeDetailData.error }}</p>
                    <button
                      class="mt-4 rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-600"
                      @click="openNodeDetail(selectedNodeId)"
                    >
                      重试加载
                    </button>
                  </div>
                  <div v-else-if="nodeDetailData.samples.length">
                    <VpsLatencyChart :samples="nodeDetailData.samples" :smooth="isSmooth" />
                    <div class="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div v-for="metric in [
                        { label: '监测点位', val: [...new Set(nodeDetailData.samples.flatMap(s => s.checks?.map(c => c.name) || []))].length + ' 个' },
                        { label: '采样总量', val: nodeDetailData.samples.length + ' 组' },
                        { label: '覆盖时长', val: '约 48 小时' },
                        { label: '状态更新', val: '实时同步' }
                      ]" :key="metric.label" class="p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <p class="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mb-1">{{ metric.label }}</p>
                        <p class="text-sm font-bold text-slate-700 dark:text-slate-200">{{ metric.val }}</p>
                      </div>
                    </div>
                  </div>
                  <div v-else class="h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[24px] bg-slate-50/30 dark:bg-black/10">
                    <span class="text-3xl mb-3 opacity-30">📊</span>
                    <p class="text-xs text-slate-400 dark:text-slate-500 font-medium tracking-widest">该节点暂无历史采样数据</p>
                  </div>
                </div>

                <!-- Footer -->
                <div class="p-4 px-6 bg-slate-50/30 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <p class="text-[9px] text-slate-400 dark:text-slate-600 font-medium">由 MiSub VPS 监控引擎提供实时数据驱动</p>
                </div>
              </div>
            </transition>
          </div>
        </transition>

        <details v-if="showDetailTable" class="mt-8 rounded-[30px] border p-6" :class="panelClass" :style="sectionOrderStyle('details')">
          <summary class="flex cursor-pointer items-center justify-between text-sm font-semibold text-[#1f1b17] dark:text-slate-100">
            <span>节点明细表</span>
            <span class="text-xs text-[#8a7f70] dark:text-slate-400">点击展开</span>
          </summary>
          <div class="mt-4 overflow-x-auto">
            <table class="w-full text-xs">
              <thead class="text-[#8a7f70] dark:text-slate-400">
                <tr class="text-left">
                  <th class="py-2">节点</th>
                  <th class="py-2">地区</th>
                  <th class="py-2">状态</th>
                  <th class="py-2">CPU</th>
                  <th class="py-2">内存</th>
                  <th class="py-2">磁盘</th>
                  <th class="py-2">负载</th>
                  <th class="py-2">运行</th>
                </tr>
              </thead>
              <tbody :class="detailTableClass">
                <tr v-for="node in sortedNodes" :key="node.id" class="border-t border-[#efe6db] dark:border-slate-800">
                  <td class="py-2">{{ node.name || node.id }}</td>
                  <td class="py-2">{{ node.region || '--' }}</td>
                  <td class="py-2">{{ node.status === 'online' ? '在线' : '离线' }}</td>
                  <td class="py-2">{{ formatPercent(node.latest?.cpu?.usage ?? node.latest?.cpuPercent) }}</td>
                  <td class="py-2">{{ formatPercent(node.latest?.mem?.usage ?? node.latest?.memPercent) }}</td>
                  <td class="py-2">{{ formatPercent(node.latest?.disk?.usage ?? node.latest?.diskPercent) }}</td>
                  <td class="py-2">{{ formatLoad(node.latest?.load1 ?? node.latest?.load?.load1) }}</td>
                  <td class="py-2">{{ formatUptime(node.latest?.uptimeSec) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </div>
  </div>
</template>

<style scoped>
.vps-theme-komari h1,
.vps-theme-komari h2,
.vps-theme-komari h3,
.vps-theme-komari h4,
.vps-theme-komari summary,
.vps-theme-komari table,
.vps-theme-komari .vps-card-front,
.vps-theme-komari .vps-card-back {
  color: #0f172a;
}

.vps-theme-komari .theme-komari {
  background-image:
    radial-gradient(circle at 18% 18%, rgba(56, 189, 248, 0.2), transparent 32%),
    radial-gradient(circle at 82% 14%, rgba(99, 102, 241, 0.14), transparent 26%),
    linear-gradient(180deg, #f4f7fb 0%, #edf5ff 55%, #f7fbff 100%);
}

.vps-theme-komari .vps-card-front,
.vps-theme-komari .vps-card-back,
.vps-theme-komari details,
.vps-theme-komari article {
  border-color: rgba(186, 230, 253, 0.9) !important;
}

.vps-theme-komari p,
.vps-theme-komari span,
.vps-theme-komari td,
.vps-theme-komari th {
  color: inherit;
}

.vps-theme-minimal h1,
.vps-theme-minimal h2,
.vps-theme-minimal h3,
.vps-theme-minimal h4,
.vps-theme-minimal summary,
.vps-theme-minimal table {
  color: #0f172a;
}

.vps-theme-minimal .vps-card-front,
.vps-theme-minimal .vps-card-back,
.vps-theme-minimal details,
.vps-theme-minimal article {
  box-shadow: none !important;
}

.vps-theme-minimal .theme-minimal {
  background-image:
    linear-gradient(180deg, rgba(248, 250, 252, 0.95) 0%, rgba(255,255,255,1) 100%),
    linear-gradient(transparent 31px, rgba(148,163,184,0.06) 32px),
    linear-gradient(90deg, transparent 31px, rgba(148,163,184,0.06) 32px);
  background-size: auto, 32px 32px, 32px 32px;
}

.vps-theme-minimal .vps-card-front,
.vps-theme-minimal .vps-card-back {
  border-radius: 1rem;
}

.vps-theme-minimal .vps-card-front,
.vps-theme-minimal .vps-card-back,
.vps-theme-minimal details,
.vps-theme-minimal article {
  border-color: rgba(226, 232, 240, 0.9) !important;
}

.vps-theme-tech-dark h1,
.vps-theme-tech-dark h2,
.vps-theme-tech-dark h3,
.vps-theme-tech-dark h4,
.vps-theme-tech-dark summary,
.vps-theme-tech-dark table,
.vps-theme-tech-dark .vps-card-front,
.vps-theme-tech-dark .vps-card-back {
  color: #e2e8f0;
}

.vps-theme-tech-dark p,
.vps-theme-tech-dark span,
.vps-theme-tech-dark td,
.vps-theme-tech-dark th {
  color: inherit;
}

.vps-theme-tech-dark details,
.vps-theme-tech-dark .vps-card-front,
.vps-theme-tech-dark .vps-card-back,
.vps-theme-tech-dark article {
  border-color: rgba(34, 211, 238, 0.18) !important;
}

.vps-theme-tech-dark .theme-tech-dark {
  background-image:
    radial-gradient(circle at 18% 18%, rgba(34, 211, 238, 0.16), transparent 28%),
    radial-gradient(circle at 82% 12%, rgba(14, 165, 233, 0.16), transparent 24%),
    linear-gradient(180deg, #050816 0%, #09101f 45%, #0d1630 100%);
}

.vps-theme-tech-dark .vps-card-front,
.vps-theme-tech-dark .vps-card-back,
.vps-theme-tech-dark details,
.vps-theme-tech-dark article {
  box-shadow: 0 18px 42px -34px rgba(34, 211, 238, 0.2), inset 0 0 0 1px rgba(34, 211, 238, 0.04);
}

.vps-theme-glass h1,
.vps-theme-glass h2,
.vps-theme-glass h3,
.vps-theme-glass h4,
.vps-theme-glass summary,
.vps-theme-glass table,
.vps-theme-glass .vps-card-front,
.vps-theme-glass .vps-card-back {
  color: #0f172a;
}

.vps-theme-glass p,
.vps-theme-glass span,
.vps-theme-glass td,
.vps-theme-glass th {
  color: inherit;
}

.vps-theme-glass details,
.vps-theme-glass .vps-card-front,
.vps-theme-glass .vps-card-back,
.vps-theme-glass article {
  border-color: rgba(255, 255, 255, 0.32) !important;
  backdrop-filter: blur(20px);
}

.vps-theme-glass .theme-glass {
  background-image:
    radial-gradient(circle at 20% 18%, rgba(99, 102, 241, 0.18), transparent 30%),
    radial-gradient(circle at 78% 12%, rgba(56, 189, 248, 0.18), transparent 28%),
    linear-gradient(180deg, #eef4ff 0%, #e8f0ff 52%, #edf5ff 100%);
}

.vps-theme-glass .vps-card-front,
.vps-theme-glass .vps-card-back {
  background: rgba(255, 255, 255, 0.38) !important;
}

.vps-theme-tech-dark .vps-card-front,
.vps-theme-tech-dark .vps-card-back {
  background: rgba(8, 16, 31, 0.92) !important;
}
</style>
