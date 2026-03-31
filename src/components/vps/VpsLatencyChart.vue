<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  samples: {
    type: Array,
    default: () => []
  },
  smooth: {
    type: Boolean,
    default: true
  },
  height: {
    type: Number,
    default: 260
  }
});

const svgWidth = 800;
const svgHeight = 260;
const chartPadding = { top: 20, right: 30, bottom: 40, left: 50 };

const chartWidth = svgWidth - chartPadding.left - chartPadding.right;
const chartHeight = svgHeight - chartPadding.top - chartPadding.bottom;

// Extract targets and data points
const seriesData = computed(() => {
  if (!props.samples.length) return [];
  
  // Find all unique targets/points
  const targetMap = new Map();
  
  props.samples.forEach(sample => {
    const checks = sample.checks || [];
    checks.forEach(check => {
      const key = check.name || check.target;
      if (!targetMap.has(key)) {
        targetMap.set(key, {
          name: key,
          type: check.type,
          points: []
        });
      }
      targetMap.get(key).points.push({
        time: new Date(sample.reportedAt || sample.createdAt).getTime(),
        latency: check.latencyMs,
        loss: check.lossPercent
      });
    });
  });
  
  return Array.from(targetMap.values());
});

const colors = [
  '#10b981', // Emerald
  '#0ea5e9', // Sky
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
];

const timeRange = computed(() => {
  if (!props.samples.length) return { min: 0, max: 0 };
  const times = props.samples.map(s => new Date(s.reportedAt || s.createdAt).getTime());
  return {
    min: Math.min(...times),
    max: Math.max(...times)
  };
});

const latencyMax = computed(() => {
  let max = 100;
  seriesData.value.forEach(s => {
    s.points.forEach(p => {
      if (p.latency !== null && p.latency > max) max = p.latency;
    });
  });
  return Math.ceil(max / 50) * 50; // Round up to nearest 50
});

const getX = (time) => {
  const range = timeRange.value.max - timeRange.value.min;
  if (range === 0) return chartPadding.left;
  return chartPadding.left + ((time - timeRange.value.min) / range) * chartWidth;
};

const getY = (latency) => {
  if (latency === null || latency === undefined) return chartPadding.top + chartHeight;
  return chartPadding.top + chartHeight - (latency / latencyMax.value) * chartHeight;
};

const generatePath = (points) => {
  if (points.length < 2) return '';
  
  const validPoints = points.filter(p => p.latency !== null);
  if (validPoints.length < 2) return '';
  
  // Detection for gaps (disconnection)
  // If interval between points > 15 mins (900000ms), we treat it as a gap
  const GAP_THRESHOLD = 15 * 60 * 1000;
  let fullPath = '';
  let subPoints = [];
  
  for (let i = 0; i < validPoints.length; i++) {
    const p = validPoints[i];
    if (subPoints.length > 0 && (p.time - subPoints[subPoints.length - 1].time) > GAP_THRESHOLD) {
      fullPath += drawSegment(subPoints);
      subPoints = [p];
    } else {
      subPoints.push(p);
    }
  }
  
  if (subPoints.length >= 2) {
    fullPath += drawSegment(subPoints);
  }
  
  return fullPath;
};

const drawSegment = (pts) => {
  if (pts.length < 2) return '';
  let path = `M ${getX(pts[0].time)} ${getY(pts[0].latency)}`;
  
  if (!props.smooth) {
    return path + ' ' + pts.slice(1).map(p => `L ${getX(p.time)} ${getY(p.latency)}`).join(' ');
  }
  
  // Improved Smoothing with tension
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const cpX = (getX(p0.time) + getX(p1.time)) / 2;
    path += ` C ${cpX} ${getY(p0.latency)}, ${cpX} ${getY(p1.latency)}, ${getX(p1.time)} ${getY(p1.latency)}`;
  }
  return path;
};

const yTicks = computed(() => {
  const ticks = [];
  const max = latencyMax.value;
  let count = 5;
  if (max > 1000) count = 8;
  for (let i = 0; i <= count; i++) {
    ticks.push(Math.round((max / count) * i));
  }
  return ticks;
});

const xTicks = computed(() => {
  if (!props.samples.length) return [];
  const count = 6;
  const interval = (timeRange.value.max - timeRange.value.min) / (count - 1);
  const ticks = [];
  for (let i = 0; i < count; i++) {
    const time = timeRange.value.min + interval * i;
    ticks.push({
      time,
      label: new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  }
  return ticks;
});

// Tooltip logic
const hoverX = ref(null);
const activePoints = ref([]);

const handleMouseMove = (e) => {
  const svg = e.currentTarget;
  // Standard SVG coordinate conversion
  const point = svg.createSVGPoint();
  point.x = e.clientX;
  point.y = e.clientY;
  const ctm = svg.getScreenCTM();
  const transformedPoint = point.matrixTransform(ctm.inverse());
  const x = transformedPoint.x;
  
  if (x < chartPadding.left || x > svgWidth - chartPadding.right) {
    hoverX.value = null;
    activePoints.value = [];
    return;
  }
  
  hoverX.value = x;
  
  // Find nearest points in all series
  const range = timeRange.value.max - timeRange.value.min;
  const hoverTime = timeRange.value.min + ((x - chartPadding.left) / chartWidth) * range;
  
  const nearest = seriesData.value.map((s, idx) => {
    let closest = s.points[0];
    let minDiff = Math.abs(s.points[0].time - hoverTime);
    
    s.points.forEach(p => {
      const diff = Math.abs(p.time - hoverTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = p;
      }
    });
    
    return {
      ...closest,
      name: s.name,
      color: colors[idx % colors.length]
    };
  });
  
  activePoints.value = nearest;
};

const handleMouseLeave = () => {
  hoverX.value = null;
  activePoints.value = [];
};

// Current Status from the last sample
const isLastSeenOffline = computed(() => {
  if (!props.samples.length) return false;
  const last = props.samples[props.samples.length - 1];
  const lastTime = new Date(last.reportedAt || last.createdAt).getTime();
  return (Date.now() - lastTime) > 15 * 60 * 1000;
});

</script>

<template>
  <div class="relative w-full bg-white/40 dark:bg-slate-900/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-4 transition-all overflow-hidden group vps-latency-shell">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider">网络延迟趋势</h3>
          <span 
            class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
            :class="isLastSeenOffline ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'"
          >
            {{ isLastSeenOffline ? '● Disconnected' : '● Real-time' }}
          </span>
        </div>
        <!-- Wrap-friendly legend -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div v-for="(s, idx) in seriesData" :key="s.name" class="flex items-center gap-1.5 shrink-0">
            <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: colors[idx % colors.length] }"></span>
            <span class="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{{ s.name }}</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-4 text-[10px] text-slate-400 font-mono tabular-nums whitespace-nowrap">
        <div class="flex flex-col items-end">
          <span>POINTS: {{ props.samples.length }}</span>
          <span>PEAK: {{ latencyMax }} ms</span>
        </div>
      </div>
    </div>

    <!-- Chart SVG -->
    <div class="relative">
      <svg 
        :viewBox="`0 0 ${svgWidth} ${svgHeight}`" 
        class="w-full h-auto cursor-crosshair overflow-visible"
        @mousemove="handleMouseMove"
        @mouseleave="handleMouseLeave"
      >
        <!-- Grid Lines -->
        <g class="grid-lines">
          <line v-for="tick in yTicks" :key="tick" 
            :x1="chartPadding.left" :y1="getY(tick)" 
            :x2="svgWidth - chartPadding.right" :y2="getY(tick)" 
            stroke="currentColor" stroke-dasharray="2,4" class="text-slate-200 dark:text-slate-800" stroke-width="1" />
          
          <line v-for="tick in xTicks" :key="tick.time"
            :x1="getX(tick.time)" :y1="chartPadding.top"
            :x2="getX(tick.time)" :y2="svgHeight - chartPadding.bottom"
            stroke="currentColor" stroke-dasharray="2,4" class="text-slate-200 dark:text-slate-800" stroke-width="1" />
        </g>

        <!-- Axes Labels -->
        <g class="axes-labels text-[10px] fill-slate-400 font-medium tabular-nums">
          <text v-for="tick in yTicks" :key="tick" 
            :x="chartPadding.left - 10" :y="getY(tick) + 4" text-anchor="end">{{ tick }}</text>
          
          <text v-for="tick in xTicks" :key="tick.time"
            :x="getX(tick.time)" :y="svgHeight - chartPadding.bottom + 20" text-anchor="middle">{{ tick.label }}</text>
        </g>

        <!-- Data Series -->
        <g v-for="(s, idx) in seriesData" :key="s.name">
          <path 
            :d="generatePath(s.points)" 
            fill="none" 
            :stroke="colors[idx % colors.length]" 
            stroke-width="2.5" 
            stroke-linecap="round" 
            stroke-linejoin="round"
            class="transition-opacity duration-300"
            :class="{ 'opacity-20': activePoints.length && activePoints[0].name !== s.name && false }"
          />
          <!-- Points for hover -->
          <circle v-for="p in s.points" :key="p.time" :cx="getX(p.time)" :cy="getY(p.latency)" r="3" :fill="colors[idx % colors.length]" class="opacity-0 group-hover:opacity-100 transition-opacity" v-if="!smooth" />
        </g>

        <!-- Hover Guideline -->
        <line v-if="hoverX" 
          :x1="hoverX" :y1="chartPadding.top" 
          :x2="hoverX" :y2="svgHeight - chartPadding.bottom" 
          stroke="currentColor" class="text-blue-500/50 latency-guideline" stroke-width="1.5" stroke-dasharray="4,2" />

        <!-- Hover Points -->
        <circle v-for="ap in activePoints" :key="ap.name" 
          :cx="getX(ap.time)" :cy="getY(ap.latency)" r="5" 
          :fill="ap.color" stroke="white" stroke-width="2" />
      </svg>

      <!-- Tooltip -->
      <div v-if="hoverX && activePoints.length" 
        class="absolute z-20 pointer-events-none bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl p-3 text-[11px] min-w-[140px]"
        :style="{ 
          left: (hoverX > svgWidth / 2 ? hoverX - 160 : hoverX + 20) + 'px', 
          top: '20px'
        }"
      >
        <div class="font-bold text-slate-900 dark:text-white mb-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
          {{ new Date(activePoints[0].time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
        </div>
        <div class="space-y-1.5">
          <div v-for="ap in activePoints" :key="ap.name" class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: ap.color }"></span>
              <span class="text-slate-500 dark:text-slate-400 truncate max-w-[80px]">{{ ap.name }}</span>
            </div>
            <span class="font-bold tabular-nums text-slate-800 dark:text-slate-200">
              {{ ap.latency !== null ? ap.latency + 'ms' : 'DOWN' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid-lines {
  transition: opacity 0.3s;
}

svg {
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.05));
}

path {
  transition: all 0.3s ease;
}

.dark svg {
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.2));
}
</style>
