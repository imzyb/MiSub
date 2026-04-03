<script setup>
import { computed } from 'vue';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  color: {
    type: String,
    default: '#4f46e5'
  },
  unit: {
    type: String,
    default: ''
  },
  points: {
    type: Array,
    default: () => []
  },
  max: {
    type: Number,
    default: 100
  },
  height: {
    type: Number,
    default: 90
  }
});

const dynamicMax = computed(() => {
  const raw = Array.isArray(props.points) ? props.points : [];
  const maxVal = raw.reduce((acc, val) => {
    if (val === null || val === undefined) return acc;
    const num = Number(val);
    return (Number.isFinite(num) && num > acc) ? num : acc;
  }, props.max);
  return maxVal || 1; // Ensure not zero
});

const normalizedPoints = computed(() => {
  const raw = Array.isArray(props.points) ? props.points : [];
  return raw.map((val) => {
    if (val === null || val === undefined) return null;
    const num = Number(val);
    return Number.isFinite(num) ? Math.max(0, Math.min(dynamicMax.value, num)) : null;
  });
});

const lastValue = computed(() => {
  const data = Array.isArray(props.points) ? props.points : [];
  for (let i = data.length - 1; i >= 0; i -= 1) {
    if (data[i] !== null && data[i] !== undefined) return data[i];
  }
  return null;
});

const polylinePoints = computed(() => {
  const data = normalizedPoints.value;
  if (!data.length) return '';
  const width = 200;
  const height = props.height;
  const step = data.length > 1 ? width / (data.length - 1) : width;
  return data
    .map((val, index) => {
      const x = Math.round(index * step);
      const y = val === null ? height : Math.round(height - (val / dynamicMax.value) * height);
      return `${x},${y}`;
    })
    .join(' ');
});

const areaPath = computed(() => {
  const polyline = polylinePoints.value;
  if (!polyline) return '';
  const width = 200;
  const height = props.height;
  const segments = polyline.split(' ');
  const first = segments[0];
  const last = segments[segments.length - 1];
  return `M${first} L${segments.join(' ')} L${last.split(',')[0]},${height} L${first.split(',')[0]},${height} Z`;
});

const hasData = computed(() => normalizedPoints.value.some((val) => val !== null));

const gradientId = computed(() => {
  const source = `${props.title}-${props.color}-${props.unit}`;
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(i);
    hash |= 0;
  }
  const safeId = Math.abs(hash).toString(36);
  return `metric-${safeId || 'chart'}`;
});
</script>

<template>
  <div class="rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-gray-900/60 p-4 shadow-sm vps-metric-chart-shell">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ title }}</p>
        <p class="text-lg font-semibold text-gray-900 dark:text-white">
          <span v-if="lastValue !== null">{{ lastValue }}{{ unit }}</span>
          <span v-else>--</span>
        </p>
      </div>
      <div class="text-xs text-gray-400 dark:text-gray-500">
        {{ dynamicMax.toFixed(dynamicMax < 1 ? 2 : 0) }}{{ unit }}
      </div>
    </div>

    <div class="mt-3">
      <svg viewBox="0 0 200 90" :height="height" class="w-full">
        <defs>
          <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="color" stop-opacity="0.35" />
            <stop offset="100%" :stop-color="color" stop-opacity="0.05" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="200" height="90" fill="transparent" />
        <path v-if="hasData" :d="areaPath" :fill="`url(#${gradientId})`" />
        <polyline v-if="hasData" :points="polylinePoints" fill="none" :stroke="color" stroke-width="2" class="vps-metric-chart-line" />
        <text v-if="!hasData" x="100" y="45" text-anchor="middle" class="fill-gray-400 text-[10px]">暂无数据</text>
      </svg>
    </div>
  </div>
</template>
