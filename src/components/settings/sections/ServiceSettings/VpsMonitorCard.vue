<script setup>
import { computed, ref } from 'vue';
import Switch from '../../../ui/Switch.vue';
import Modal from '../../../forms/Modal.vue';
import { VPS_PUBLIC_THEME_PREVIEW_CARDS, VPS_PUBLIC_THEME_SECTIONS } from '../../../../constants/vps-public-themes.js';

const props = defineProps({
  settings: {
    type: Object,
    required: true
  }
});

const vpsMonitorConfig = computed({
  get() {
      return props.settings.vpsMonitor || {
        enabled: true,
        requireSecret: true,
      requireSignature: false,
      signatureClockSkewMinutes: 5,
      offlineThresholdMinutes: 10,
      cpuWarnPercent: 90,
      memWarnPercent: 90,
      diskWarnPercent: 90,
      overloadConfirmCount: 2,
      alertCooldownMinutes: 15,
      alertsEnabled: true,
      notifyOffline: true,
      notifyRecovery: true,
      notifyOverload: true,
      reportRetentionDays: 30,
      cooldownIgnoreRecovery: true,
      networkSampleIntervalMinutes: 10,
      reportIntervalMinutes: 5,
        reportStoreIntervalMinutes: 15,
        networkTargetsLimit: 2,
        publicPageEnabled: false,
        publicPageToken: '',
        publicThemePreset: 'default',
        publicThemeTitle: 'VPS 探针公开视图',
        publicThemeSubtitle: '对外展示节点健康、资源负载与在线率。所有关键指标以清晰、可信的方式汇总呈现。',
        publicThemeLogo: '',
        publicThemeBackgroundImage: '',
        publicThemeShowStats: true,
        publicThemeShowAnomalies: true,
        publicThemeShowFeatured: true,
        publicThemeShowDetailTable: true,
        publicThemeFooterText: '由 MiSub VPS 监控引擎提供实时数据驱动',
        publicPageShowHeader: true,
        publicPageShowFooter: true,
        publicThemeSectionOrder: ['anomalies', 'nodes', 'featured', 'details'],
        publicThemeCustomCss: ''
      };
  },
  set(value) {
    props.settings.vpsMonitor = value;
  }
});

const updateField = (key, value) => {
  vpsMonitorConfig.value = {
    ...vpsMonitorConfig.value,
    [key]: value
  };
};

const themeSections = VPS_PUBLIC_THEME_SECTIONS;
const previewTheme = ref(null);

const moveSection = (key, direction) => {
  const current = Array.isArray(vpsMonitorConfig.value.publicThemeSectionOrder)
    ? [...vpsMonitorConfig.value.publicThemeSectionOrder]
    : themeSections.map(item => item.key);
  const index = current.indexOf(key);
  if (index === -1) return;
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= current.length) return;
  [current[index], current[target]] = [current[target], current[index]];
  updateField('publicThemeSectionOrder', current);
};

const exportThemeConfig = async () => {
  const payload = {
    preset: vpsMonitorConfig.value.publicThemePreset || 'default',
    title: vpsMonitorConfig.value.publicThemeTitle || '',
    subtitle: vpsMonitorConfig.value.publicThemeSubtitle || '',
    logo: vpsMonitorConfig.value.publicThemeLogo || '',
    backgroundImage: vpsMonitorConfig.value.publicThemeBackgroundImage || '',
    showStats: vpsMonitorConfig.value.publicThemeShowStats !== false,
    showAnomalies: vpsMonitorConfig.value.publicThemeShowAnomalies !== false,
    showFeatured: vpsMonitorConfig.value.publicThemeShowFeatured !== false,
    showDetailTable: vpsMonitorConfig.value.publicThemeShowDetailTable !== false,
    footerText: vpsMonitorConfig.value.publicThemeFooterText || '',
    sectionOrder: vpsMonitorConfig.value.publicThemeSectionOrder || themeSections.map(item => item.key),
    customCss: vpsMonitorConfig.value.publicThemeCustomCss || ''
  };
  await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
};

const importThemeConfig = (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || '{}'));
      updateField('publicThemePreset', parsed.preset || 'default');
      updateField('publicThemeTitle', parsed.title || 'VPS 探针公开视图');
      updateField('publicThemeSubtitle', parsed.subtitle || '');
      updateField('publicThemeLogo', parsed.logo || '');
      updateField('publicThemeBackgroundImage', parsed.backgroundImage || '');
      updateField('publicThemeShowStats', parsed.showStats !== false);
      updateField('publicThemeShowAnomalies', parsed.showAnomalies !== false);
      updateField('publicThemeShowFeatured', parsed.showFeatured !== false);
      updateField('publicThemeShowDetailTable', parsed.showDetailTable !== false);
      updateField('publicThemeFooterText', parsed.footerText || '');
      updateField('publicThemeSectionOrder', Array.isArray(parsed.sectionOrder) ? parsed.sectionOrder : themeSections.map(item => item.key));
      updateField('publicThemeCustomCss', parsed.customCss || '');
    } catch {
      // ignore invalid import
    }
  };
  reader.readAsText(file);
  event.target.value = '';
};

const openPreview = (card) => {
  previewTheme.value = card;
};
</script>

<template>
  <div class="bg-white/90 dark:bg-gray-900/70 misub-radius-lg p-6 space-y-5 border border-gray-100/80 dark:border-white/10 shadow-sm transition-shadow duration-300">
    <div>
      <h3 class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16M7 6v12M12 6v12M17 6v12" />
        </svg>
        VPS 探针设置
      </h3>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
        管理探针上报开关、离线阈值与告警通知规则。
      </p>
      <p class="text-xs text-amber-600 dark:text-amber-400 mt-2">
        使用 VPS 探针前请确保已绑定 D1 数据库（MISUB_DB），并在存储设置中切换为 D1 模式。
      </p>
      <p class="text-xs text-amber-600 dark:text-amber-400 mt-1">
        免费版 D1 配额有限，默认已采用更保守的上报、落库和网络采样间隔；如无必要，不建议再继续缩短。
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="flex items-center justify-between p-3 bg-white/70 dark:bg-gray-900/50 border border-gray-200/60 dark:border-white/10 misub-radius-lg">
        <div>
          <div class="text-sm font-medium text-gray-900 dark:text-gray-200">启用 VPS 探针</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">关闭后拒绝所有上报请求</div>
        </div>
        <Switch v-model="vpsMonitorConfig.enabled" />
      </div>
      <div class="flex items-center justify-between p-3 bg-white/70 dark:bg-gray-900/50 border border-gray-200/60 dark:border-white/10 misub-radius-lg">
        <div>
          <div class="text-sm font-medium text-gray-900 dark:text-gray-200">告警推送</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">发送离线/负载等提醒</div>
        </div>
        <Switch v-model="vpsMonitorConfig.alertsEnabled" />
      </div>
      <div class="flex items-center justify-between p-3 bg-white/70 dark:bg-gray-900/50 border border-gray-200/60 dark:border-white/10 misub-radius-lg">
        <div>
          <div class="text-sm font-medium text-gray-900 dark:text-gray-200">公开展示页</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">用于对外展示探针数据</div>
        </div>
        <Switch v-model="vpsMonitorConfig.publicPageEnabled" />
      </div>
      <div class="flex items-center justify-between p-3 bg-white/70 dark:bg-gray-900/50 border border-gray-200/60 dark:border-white/10 misub-radius-lg">
        <div>
          <div class="text-sm font-medium text-gray-900 dark:text-gray-200">上报签名校验</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">启用 HMAC 防重放</div>
        </div>
        <Switch v-model="vpsMonitorConfig.requireSignature" />
      </div>
      <div class="flex items-center justify-between p-3 bg-white/70 dark:bg-gray-900/50 border border-gray-200/60 dark:border-white/10 misub-radius-lg">
        <div>
          <div class="text-sm font-medium text-gray-900 dark:text-gray-200">强制校验节点密钥</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">关闭后仅依赖节点 ID 接收上报</div>
        </div>
        <Switch v-model="vpsMonitorConfig.requireSecret" />
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">离线阈值（分钟）</label>
        <input
          type="number"
          min="1"
          max="1440"
          :value="vpsMonitorConfig.offlineThresholdMinutes"
          @input="updateField('offlineThresholdMinutes', Number($event.target.value))"
          class="block w-full px-3 py-2 bg-white/70 dark:bg-gray-900/50 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">上报间隔（分钟）</label>
        <input
          type="number"
          min="1"
          max="60"
          :value="vpsMonitorConfig.reportIntervalMinutes"
          @input="updateField('reportIntervalMinutes', Number($event.target.value))"
          class="block w-full px-3 py-2 bg-white/70 dark:bg-gray-900/50 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">记录间隔（分钟）</label>
        <input
          type="number"
          min="1"
          max="60"
          :value="vpsMonitorConfig.reportStoreIntervalMinutes"
          @input="updateField('reportStoreIntervalMinutes', Number($event.target.value))"
          class="block w-full px-3 py-2 bg-white/70 dark:bg-gray-900/50 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">网络采样间隔（分钟）</label>
        <input
          type="number"
          min="1"
          max="60"
          :value="vpsMonitorConfig.networkSampleIntervalMinutes"
          @input="updateField('networkSampleIntervalMinutes', Number($event.target.value))"
          class="block w-full px-3 py-2 bg-white/70 dark:bg-gray-900/50 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">公开页 Token（可选）</label>
        <input
          type="text"
          :value="vpsMonitorConfig.publicPageToken"
          @input="updateField('publicPageToken', $event.target.value)"
          placeholder="留空则公开访问"
          class="block w-full px-3 py-2 bg-white/70 dark:bg-gray-900/50 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">公开页主题</label>
        <select
          :value="vpsMonitorConfig.publicThemePreset || 'default'"
          @change="updateField('publicThemePreset', $event.target.value)"
          class="block w-full px-3 py-2 bg-white/70 dark:bg-gray-900/50 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
        >
          <option value="default">默认</option>
          <option value="fresh">清爽</option>
          <option value="minimal">极简</option>
          <option value="tech">科技</option>
          <option value="glass">玻璃态</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">告警冷却（分钟）</label>
        <input
          type="number"
          min="1"
          max="1440"
          :value="vpsMonitorConfig.alertCooldownMinutes"
          @input="updateField('alertCooldownMinutes', Number($event.target.value))"
          class="block w-full px-3 py-2 bg-white/70 dark:bg-gray-900/50 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">签名时钟偏差（分钟）</label>
        <input
          type="number"
          min="1"
          max="60"
          :value="vpsMonitorConfig.signatureClockSkewMinutes"
          @input="updateField('signatureClockSkewMinutes', Number($event.target.value))"
          class="block w-full px-3 py-2 bg-white/70 dark:bg-gray-900/50 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CPU 告警阈值 %</label>
        <input
          type="number"
          min="1"
          max="100"
          :value="vpsMonitorConfig.cpuWarnPercent"
          @input="updateField('cpuWarnPercent', Number($event.target.value))"
          class="block w-full px-3 py-2 bg-white/70 dark:bg-gray-900/50 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">内存告警阈值 %</label>
        <input
          type="number"
          min="1"
          max="100"
          :value="vpsMonitorConfig.memWarnPercent"
          @input="updateField('memWarnPercent', Number($event.target.value))"
          class="block w-full px-3 py-2 bg-white/70 dark:bg-gray-900/50 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">磁盘告警阈值 %</label>
        <input
          type="number"
          min="1"
          max="100"
          :value="vpsMonitorConfig.diskWarnPercent"
          @input="updateField('diskWarnPercent', Number($event.target.value))"
          class="block w-full px-3 py-2 bg-white/70 dark:bg-gray-900/50 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">负载告警确认次数</label>
        <input
          type="number"
          min="1"
          max="10"
          :value="vpsMonitorConfig.overloadConfirmCount"
          @input="updateField('overloadConfirmCount', Number($event.target.value))"
          class="block w-full px-3 py-2 bg-white/70 dark:bg-gray-900/50 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
        />
      </div>
    </div>

    <div class="rounded-2xl border border-gray-200/70 bg-white/60 p-4 space-y-4 dark:border-white/10 dark:bg-gray-900/40">
      <div>
        <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">公开页主题高级配置</h4>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">可覆盖默认文案，并控制模块显示与背景素材。</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <button
          v-for="card in VPS_PUBLIC_THEME_PREVIEW_CARDS"
          :key="card.key"
          type="button"
          class="group rounded-2xl border p-3 text-left transition-all"
          :class="(vpsMonitorConfig.publicThemePreset || 'default') === card.key
            ? 'border-indigo-500 bg-indigo-50/70 shadow-lg shadow-indigo-500/10 dark:border-indigo-400 dark:bg-indigo-500/10'
            : 'border-gray-200/80 bg-white/70 hover:border-indigo-300 dark:border-white/10 dark:bg-gray-900/40 dark:hover:border-indigo-500/40'"
          @click="updateField('publicThemePreset', card.key)"
        >
          <div class="h-20 rounded-xl bg-gradient-to-br p-3" :class="card.previewClass">
            <div class="flex items-center justify-between">
              <span class="h-2.5 w-14 rounded-full bg-white/70"></span>
              <span class="h-2.5 w-2.5 rounded-full" :class="card.accentClass"></span>
            </div>
            <div class="mt-4 grid grid-cols-2 gap-2">
              <span class="h-6 rounded-lg bg-white/70"></span>
              <span class="h-6 rounded-lg bg-white/55"></span>
            </div>
          </div>
          <div class="mt-3">
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ card.title }}</div>
              <button
                type="button"
                class="rounded-lg border border-gray-200 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                @click.stop="openPreview(card)"
              >预览</button>
            </div>
            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ card.description }}</div>
          </div>
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">公开页标题</label>
          <input
            type="text"
            :value="vpsMonitorConfig.publicThemeTitle"
            @input="updateField('publicThemeTitle', $event.target.value)"
            class="block w-full px-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logo 地址</label>
          <input
            type="url"
            :value="vpsMonitorConfig.publicThemeLogo"
            @input="updateField('publicThemeLogo', $event.target.value)"
            placeholder="https://..."
            class="block w-full px-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">公开页副标题</label>
          <textarea
            :value="vpsMonitorConfig.publicThemeSubtitle"
            @input="updateField('publicThemeSubtitle', $event.target.value)"
            rows="3"
            class="block w-full px-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
          ></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">背景图地址</label>
          <input
            type="url"
            :value="vpsMonitorConfig.publicThemeBackgroundImage"
            @input="updateField('publicThemeBackgroundImage', $event.target.value)"
            placeholder="https://..."
            class="block w-full px-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <div class="flex items-center justify-between p-3 bg-white/70 dark:bg-gray-900/50 border border-gray-200/60 dark:border-white/10 misub-radius-lg">
          <div>
            <div class="text-sm font-medium text-gray-900 dark:text-gray-200">显示统计卡片</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">总数 / 在线 / 离线 / SLA</div>
          </div>
          <Switch :model-value="vpsMonitorConfig.publicThemeShowStats !== false" @update:model-value="updateField('publicThemeShowStats', $event)" />
        </div>
        <div class="flex items-center justify-between p-3 bg-white/70 dark:bg-gray-900/50 border border-gray-200/60 dark:border-white/10 misub-radius-lg">
          <div>
            <div class="text-sm font-medium text-gray-900 dark:text-gray-200">显示异常区</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">离线 / 高负载提示</div>
          </div>
          <Switch :model-value="vpsMonitorConfig.publicThemeShowAnomalies !== false" @update:model-value="updateField('publicThemeShowAnomalies', $event)" />
        </div>
        <div class="flex items-center justify-between p-3 bg-white/70 dark:bg-gray-900/50 border border-gray-200/60 dark:border-white/10 misub-radius-lg">
          <div>
            <div class="text-sm font-medium text-gray-900 dark:text-gray-200">显示重点轮播</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">精选节点 / 资源脉冲</div>
          </div>
          <Switch :model-value="vpsMonitorConfig.publicThemeShowFeatured !== false" @update:model-value="updateField('publicThemeShowFeatured', $event)" />
        </div>
        <div class="flex items-center justify-between p-3 bg-white/70 dark:bg-gray-900/50 border border-gray-200/60 dark:border-white/10 misub-radius-lg">
          <div>
            <div class="text-sm font-medium text-gray-900 dark:text-gray-200">显示明细表</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">底部节点明细表格</div>
          </div>
          <Switch :model-value="vpsMonitorConfig.publicThemeShowDetailTable !== false" @update:model-value="updateField('publicThemeShowDetailTable', $event)" />
        </div>
        <div class="flex items-center justify-between p-3 bg-white/70 dark:bg-gray-900/50 border border-gray-200/60 dark:border-white/10 misub-radius-lg">
          <div>
            <div class="text-sm font-medium text-gray-900 dark:text-gray-200">公开页页头</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">显示 MiSub 顶部导航</div>
          </div>
          <Switch :model-value="vpsMonitorConfig.publicPageShowHeader !== false" @update:model-value="updateField('publicPageShowHeader', $event)" />
        </div>
        <div class="flex items-center justify-between p-3 bg-white/70 dark:bg-gray-900/50 border border-gray-200/60 dark:border-white/10 misub-radius-lg">
          <div>
            <div class="text-sm font-medium text-gray-900 dark:text-gray-200">公开页页脚</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">显示 MiSub 页脚</div>
          </div>
          <Switch :model-value="vpsMonitorConfig.publicPageShowFooter !== false" @update:model-value="updateField('publicPageShowFooter', $event)" />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">公开页页脚文案</label>
          <input
            type="text"
            :value="vpsMonitorConfig.publicThemeFooterText"
            @input="updateField('publicThemeFooterText', $event.target.value)"
            placeholder="例如：由 MiSub VPS 监控引擎提供实时数据驱动"
            class="block w-full px-3 py-2 bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
          />
        </div>
      </div>

      <div>
        <div class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">模块排序</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            v-for="(sectionKey, idx) in (vpsMonitorConfig.publicThemeSectionOrder || themeSections.map(item => item.key))"
            :key="sectionKey"
            class="flex items-center justify-between rounded-xl border border-gray-200/80 bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-gray-900/50"
          >
            <div>
              <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                {{ themeSections.find(item => item.key === sectionKey)?.label || sectionKey }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">排序位置 {{ idx + 1 }}</div>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                :disabled="idx === 0"
                @click="moveSection(sectionKey, 'up')"
              >↑</button>
              <button
                type="button"
                class="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                :disabled="idx === (vpsMonitorConfig.publicThemeSectionOrder || []).length - 1"
                @click="moveSection(sectionKey, 'down')"
              >↓</button>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">自定义 CSS</label>
          <textarea
            :value="vpsMonitorConfig.publicThemeCustomCss"
            @input="updateField('publicThemeCustomCss', $event.target.value)"
            rows="8"
            placeholder=".vps-public-theme-root .your-class { ... }"
            class="block w-full px-3 py-2 font-mono text-xs bg-white/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 dark:text-white transition-colors"
          ></textarea>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">建议仅作用于 .vps-public-theme-root 作用域下，避免污染全站。</p>
        </div>
        <div class="space-y-3">
          <div>
            <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">导入 / 导出主题配置</div>
            <p class="text-xs text-gray-500 dark:text-gray-400">可将当前主题配置导出为 JSON，也可从 JSON 文件恢复。</p>
          </div>
          <button
            type="button"
            class="w-full rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/15"
            @click="exportThemeConfig"
          >
            导出主题配置到剪贴板
          </button>
          <label class="flex w-full cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-gray-900/50 dark:text-gray-200 dark:hover:bg-white/5">
            导入主题配置 JSON
            <input type="file" accept="application/json" class="hidden" @change="importThemeConfig" />
          </label>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">恢复通知不受冷却</label>
        <div class="flex items-center justify-between p-3 bg-white/70 dark:bg-gray-900/50 border border-gray-200/60 dark:border-white/10 misub-radius-lg">
          <div>
            <div class="text-xs text-gray-500 dark:text-gray-400">恢复在线立即提醒</div>
          </div>
          <Switch v-model="vpsMonitorConfig.cooldownIgnoreRecovery" />
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">网络目标上限</label>
        <input
          type="number"
          min="1"
          max="10"
          :value="vpsMonitorConfig.networkTargetsLimit"
          @input="updateField('networkTargetsLimit', Number($event.target.value))"
          class="block w-full px-3 py-2 bg-white/70 dark:bg-gray-900/50 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">历史保留（天）</label>
        <input
          type="number"
          min="1"
          max="180"
          :value="vpsMonitorConfig.reportRetentionDays"
          @input="updateField('reportRetentionDays', Number($event.target.value))"
          class="block w-full px-3 py-2 bg-white/70 dark:bg-gray-900/50 border border-gray-200/80 dark:border-white/10 misub-radius-lg shadow-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 sm:text-sm dark:text-white transition-colors"
        />
      </div>
      <div class="flex items-center justify-between p-3 bg-white/70 dark:bg-gray-900/50 border border-gray-200/60 dark:border-white/10 misub-radius-lg">
        <div>
          <div class="text-sm font-medium text-gray-900 dark:text-gray-200">离线通知</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">节点离线时提醒</div>
        </div>
        <Switch v-model="vpsMonitorConfig.notifyOffline" />
      </div>
      <div class="flex items-center justify-between p-3 bg-white/70 dark:bg-gray-900/50 border border-gray-200/60 dark:border-white/10 misub-radius-lg">
        <div>
          <div class="text-sm font-medium text-gray-900 dark:text-gray-200">恢复通知</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">节点恢复在线提醒</div>
        </div>
        <Switch v-model="vpsMonitorConfig.notifyRecovery" />
      </div>
      <div class="flex items-center justify-between p-3 bg-white/70 dark:bg-gray-900/50 border border-gray-200/60 dark:border-white/10 misub-radius-lg">
        <div>
          <div class="text-sm font-medium text-gray-900 dark:text-gray-200">负载通知</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">CPU/内存/磁盘超阈值</div>
        </div>
        <Switch v-model="vpsMonitorConfig.notifyOverload" />
      </div>
    </div>

    <Modal :show="!!previewTheme" size="2xl" confirm-text="知道了" cancel-text="关闭" @update:show="previewTheme = null">
      <template #title>
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-lg font-bold text-gray-900 dark:text-white">主题预览</div>
            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ previewTheme?.title || '' }}</div>
          </div>
        </div>
      </template>
      <template #body>
        <div v-if="previewTheme" class="space-y-4">
          <div class="rounded-3xl border border-gray-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-gray-900/50">
            <div class="rounded-[28px] bg-gradient-to-br p-5" :class="previewTheme.previewClass">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <div class="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/60 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-gray-700">
                    Theme Preview
                  </div>
                  <h4 class="mt-4 text-2xl font-semibold text-gray-900">{{ previewTheme.title }}</h4>
                  <p class="mt-2 max-w-lg text-sm text-gray-600">{{ previewTheme.description }}</p>
                </div>
                <div class="grid grid-cols-2 gap-3 text-xs min-w-[220px]">
                  <div class="rounded-2xl border border-white/50 bg-white/70 p-3">
                    <div class="text-gray-500">节点总数</div>
                    <div class="mt-1 text-xl font-semibold text-gray-900">12</div>
                  </div>
                  <div class="rounded-2xl border border-white/50 bg-white/70 p-3">
                    <div class="text-gray-500">在线率</div>
                    <div class="mt-1 text-xl font-semibold text-gray-900">92%</div>
                  </div>
                </div>
              </div>
              <div class="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div class="rounded-2xl border border-white/50 bg-white/72 p-4">
                  <div class="h-1.5 rounded-full bg-white/80">
                    <div class="h-1.5 w-4/5 rounded-full" :class="previewTheme.accentClass"></div>
                  </div>
                  <div class="mt-3 text-sm font-semibold text-gray-900">异常节点</div>
                  <div class="mt-1 text-xs text-gray-500">离线与高负载节点优先展示</div>
                </div>
                <div class="rounded-2xl border border-white/50 bg-white/72 p-4">
                  <div class="h-1.5 rounded-full bg-white/80">
                    <div class="h-1.5 w-full rounded-full" :class="previewTheme.accentClass"></div>
                  </div>
                  <div class="mt-3 text-sm font-semibold text-gray-900">节点列表</div>
                  <div class="mt-1 text-xs text-gray-500">统一展示节点状态、资源与流量</div>
                </div>
                <div class="rounded-2xl border border-white/50 bg-white/72 p-4">
                  <div class="h-1.5 rounded-full bg-white/80">
                    <div class="h-1.5 w-2/3 rounded-full" :class="previewTheme.accentClass"></div>
                  </div>
                  <div class="mt-3 text-sm font-semibold text-gray-900">资源脉冲</div>
                  <div class="mt-1 text-xs text-gray-500">展示重点节点与概览曲线</div>
                </div>
              </div>
            </div>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            这是后台中的快速模拟预览，实际公开页还会叠加你的标题、背景图、模块显示与自定义 CSS 配置。
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>
