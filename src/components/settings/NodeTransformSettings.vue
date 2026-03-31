<script setup>
import { ref, watch, computed } from 'vue';
import DOMPurify from 'dompurify';
import RulePreview from './NodeTransformSettings/RulePreview.vue';
import RuleEditor from './NodeTransformSettings/RuleEditor.vue';
import { extractNodeRegion, getRegionEmoji, REGION_KEYWORDS } from '../../../functions/modules/utils/geo-utils.js';

const isDev = import.meta.env.DEV;

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['update:modelValue']);

// --- 基础配置 ---
const config = ref({
  enabled: false,
  rename: {
    regex: { enabled: false, rules: [] },
    template: {
      enabled: false,
      template: '{emoji}{region}-{protocol}-{index}',
      indexStart: 1,
      indexPad: 2,
      indexScope: 'regionProtocol',
      regionAlias: {},
      protocolAlias: { hysteria2: 'hy2' }
    }
  },
  dedup: {
    enabled: false,
    mode: 'serverPort',
    includeProtocol: false,
    prefer: { protocolOrder: ['vless', 'trojan', 'vmess', 'hysteria2', 'ss', 'ssr'] }
  },
  sort: {
    enabled: false,
    nameIgnoreEmoji: true,
    keys: []
  }
});

// --- 预览数据 ---
const DEFAULT_MOCK_NODES = [
  { name: '🇺🇸 美国 [高速] 01 @100M', protocol: 'vmess', server: 'us1.gw', port: '443' },
  { name: 'Hong Kong 01 | IPLC [VIP]', protocol: 'trojan', server: 'hk1.gw', port: '8443' },
  { name: '🇯🇵 日本 BGP [专线]', protocol: 'vless', server: 'jp1.gw', port: '443' },
  { name: '新加坡 SG-02 [流媒体]', protocol: 'ss', server: 'sg2.gw', port: '8388' },
  { name: '🇰🇷 South Korea SK [原生]', protocol: 'ss', server: 'kr1.gw', port: '443' },
  { name: '⛔️ 到期时间: 2099-12-31', protocol: 'trojan', server: 'info.gw', port: '443' }
];
const customNodeInput = ref('');
const customMockNode = ref(null);

const activeMockNodes = computed(() => {
  if (customMockNode.value) {
    return [customMockNode.value, ...DEFAULT_MOCK_NODES.slice(0, 5)];
  }
  return DEFAULT_MOCK_NODES;
});

const addCustomNode = () => {
  if (!customNodeInput.value.trim()) {
    customMockNode.value = null;
    return;
  }
  customMockNode.value = {
    name: customNodeInput.value,
    protocol: 'vmess',
    server: 'custom.gw',
    port: '443'
  };
};

const DEFAULT_SORT_KEYS = [
  { key: 'region', order: 'asc', customOrder: ['香港', '台湾', '日本', '新加坡', '美国', '韩国', '英国', '德国', '法国', '加拿大'] },
  { key: 'protocol', order: 'asc', customOrder: ['vless', 'trojan', 'vmess', 'hysteria2', 'ss', 'ssr'] },
  { key: 'name', order: 'asc' }
];

const REGION_ZH_TO_CODE = (() => {
  const map = {};
  for (const [zhName, keywords] of Object.entries(REGION_KEYWORDS || {})) {
    if (!Array.isArray(keywords)) continue;
    for (const keyword of keywords) {
      const code = String(keyword || '').trim();
      if (/^[A-Za-z]{2,3}$/.test(code)) {
        map[zhName] = code.toUpperCase();
        break;
      }
    }
  }
  return map;
})();

function normalizeProtocol(proto) {
  const p = String(proto || 'unknown').toLowerCase();
  if (p === 'hy' || p === 'hy2' || p === 'hysteria') return 'hysteria2';
  if (p === 'shadowsocks') return 'ss';
  return p;
}

function stripLeadingEmoji(name) {
  return String(name || '').replace(/^[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]\s*/g, '').trim();
}

function toRegionCode(zhRegion) {
  const region = String(zhRegion || '').trim();
  if (!region) return '';
  if (/^[A-Za-z]{2,3}$/.test(region)) return region.toUpperCase();
  return REGION_ZH_TO_CODE[region] || region;
}

function applyRegexRename(name, rules) {
  let result = String(name || '');
  for (const rule of rules) {
    if (!rule?.pattern) continue;
    try {
      const re = new RegExp(rule.pattern, rule.flags || 'g');
      result = result.replace(re, rule.replacement || '');
    } catch (error) {
      if (isDev) {
        console.debug('[NodeTransformSettings] Invalid regex rule:', rule, error);
      }
    }
  }
  return result.trim();
}

function getIndexGroupKey(record, scope) {
  switch (scope) {
    case 'region': return `r:${record.region}`;
    case 'protocol': return `p:${record.protocol}`;
    case 'regionProtocol': return `rp:${record.region}|${record.protocol}`;
    default: return 'global';
  }
}

function padIndex(n, width) {
  return width > 0 ? String(n).padStart(width, '0') : String(n);
}

function applyModifier(key, value, modifier, record) {
  const val = value == null ? '' : String(value);
  switch (modifier) {
    case 'UPPER': return val.toUpperCase();
    case 'lower': return val.toLowerCase();
    case 'Title': return val.charAt(0).toUpperCase() + val.slice(1);
    case 'zh':
      if (key === 'region' && record && record.regionZh) return record.regionZh;
      return val;
    default: return val;
  }
}

function renderTemplate(template, vars, record) {
  return String(template || '').replace(/\{([a-zA-Z0-9_]+)(?::([a-zA-Z]+))?\}/g, (_, key, modifier) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return '';
    let v = vars[key];
    if (modifier) v = applyModifier(key, v, modifier, record);
    return v == null ? '' : String(v);
  }).trim();
}

function makeComparator(sortCfg) {
  const keys = sortCfg.keys || [];
  const nameIgnoreEmoji = sortCfg.nameIgnoreEmoji !== false;

  const customOrderMaps = keys.map(k => {
    if (!Array.isArray(k?.customOrder)) return null;
    const map = new Map();
    k.customOrder.forEach((v, i) => map.set(String(v), i));
    return map;
  });

  const cmpStr = (a, b) => String(a || '').localeCompare(String(b || ''));
  const cmpNum = (a, b) => {
    const an = Number(a), bn = Number(b);
    if (Number.isNaN(an) && Number.isNaN(bn)) return 0;
    if (Number.isNaN(an)) return 1;
    if (Number.isNaN(bn)) return -1;
    return an - bn;
  };

  return (ra, rb) => {
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (!k?.key) continue;
      const key = String(k.key);
      const order = String(k.order || 'asc').toLowerCase() === 'desc' ? -1 : 1;
      const orderMap = customOrderMaps[i];

      let va, vb;
      if (key === 'name') {
        va = nameIgnoreEmoji ? stripLeadingEmoji(ra.name) : ra.name;
        vb = nameIgnoreEmoji ? stripLeadingEmoji(rb.name) : rb.name;
        const r = cmpStr(va, vb);
        if (r !== 0) return r * order;
        continue;
      }
      if (key === 'region') {
        va = ra.regionZh || ra.region;
        vb = rb.regionZh || rb.region;
        if (orderMap) {
          const ia = orderMap.get(String(va || ''));
          const ib = orderMap.get(String(vb || ''));
          const raIdx = ia === undefined ? Number.MAX_SAFE_INTEGER : ia;
          const rbIdx = ib === undefined ? Number.MAX_SAFE_INTEGER : ib;
          if (raIdx !== rbIdx) return (raIdx - rbIdx) * order;
        }
        const r = cmpStr(va, vb);
        if (r !== 0) return r * order;
        continue;
      }
      if (key === 'port') {
        const r = cmpNum(ra.port, rb.port);
        if (r !== 0) return r * order;
        continue;
      }

      va = ra[key];
      vb = rb[key];

      if (orderMap) {
        const ia = orderMap.get(String(va || ''));
        const ib = orderMap.get(String(vb || ''));
        const raIdx = ia === undefined ? Number.MAX_SAFE_INTEGER : ia;
        const rbIdx = ib === undefined ? Number.MAX_SAFE_INTEGER : ib;
        if (raIdx !== rbIdx) return (raIdx - rbIdx) * order;
      }

      const r = cmpStr(va, vb);
      if (r !== 0) return r * order;
    }
    return 0;
  };
}

function choosePreferred(existing, candidate, protocolOrder) {
  if (!existing) return candidate;
  if (!protocolOrder?.length) return existing;
  const rank = p => {
    const idx = protocolOrder.indexOf(String(p || '').toLowerCase());
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };
  return rank(candidate.protocol) < rank(existing.protocol) ? candidate : existing;
}

const previewResult = computed(() => {
  if (!config.value.enabled) return activeMockNodes.value.map(n => n.name);

  const cfg = config.value;
  const sortKeys = cfg.sort.enabled ? (cfg.sort.keys || []) : [];
  const effectiveSort = cfg.sort.enabled && sortKeys.length > 0
    ? { ...cfg.sort, keys: sortKeys }
    : { ...cfg.sort, keys: DEFAULT_SORT_KEYS };

  let records = activeMockNodes.value.map(node => {
    const protocol = normalizeProtocol(node.protocol);
    const name = String(node.name || '');
    const url = `${protocol}://${node.server || ''}:${node.port || ''}#${encodeURIComponent(name)}`;
    return { ...node, protocol, name, originalName: name, region: '', regionZh: '', emoji: '', url };
  });

  if (cfg.rename.regex.enabled && cfg.rename.regex.rules.length > 0) {
    records = records.map(r => ({
      ...r,
      name: applyRegexRename(r.name, cfg.rename.regex.rules)
    }));
  }

  if (cfg.dedup.enabled) {
    if (cfg.dedup.mode === 'url') {
      const seen = new Set();
      records = records.filter(r => {
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
      });
    } else {
      const map = new Map();
      for (const r of records) {
        const server = String(r.server || '').trim().toLowerCase();
        const port = String(r.port || '').trim();
        const base = server && port ? `${server}:${port}` : '';
        const key = base
          ? (cfg.dedup.includeProtocol ? `${r.protocol}|${base}` : base)
          : `__raw__:${r.url}`;
        map.set(key, choosePreferred(map.get(key), r, cfg.dedup.prefer?.protocolOrder || []));
      }
      records = Array.from(map.values());
    }
  }

  records = records.map(r => {
    let regionZh = extractNodeRegion(r.name);
    if (regionZh === '其他' && r.server) regionZh = extractNodeRegion(r.server);
    const regionCode = toRegionCode(regionZh);
    const emoji = getRegionEmoji(regionZh);
    return { ...r, region: regionCode, regionZh, emoji };
  });

  if (cfg.rename.template.enabled) {
    const template = cfg.rename.template.template || '';
    const templateHasEmoji = template.includes('{emoji}');
    const groupBuckets = new Map();
    for (const r of records) {
      const gk = getIndexGroupKey(r, cfg.rename.template.indexScope);
      const arr = groupBuckets.get(gk) || [];
      arr.push(r);
      groupBuckets.set(gk, arr);
    }

    const cmpStr = (a, b) => String(a || '').localeCompare(String(b || ''));
    const cmpPort = (a, b) => {
      const an = Number(a), bn = Number(b);
      if (Number.isNaN(an) && Number.isNaN(bn)) return 0;
      if (Number.isNaN(an)) return 1;
      if (Number.isNaN(bn)) return -1;
      return an - bn;
    };

    for (const arr of groupBuckets.values()) {
      arr.sort((a, b) => {
        const r1 = cmpStr(String(a.server || '').toLowerCase(), String(b.server || '').toLowerCase());
        if (r1 !== 0) return r1;
        const r2 = cmpPort(a.port, b.port);
        if (r2 !== 0) return r2;
        const r3 = cmpStr(a.protocol, b.protocol);
        if (r3 !== 0) return r3;
        return cmpStr(a.name, b.name);
      });
    }

    const nextIndex = new Map();
    for (const [gk, arr] of groupBuckets.entries()) {
      nextIndex.set(gk, cfg.rename.template.indexStart);
      for (const r of arr) {
        const regionText = cfg.rename.template.regionAlias?.[r.region] || r.region;
        const protocolText = cfg.rename.template.protocolAlias?.[r.protocol] || r.protocol;
        const currentIndex = nextIndex.get(gk);
        nextIndex.set(gk, currentIndex + 1);

        const vars = {
          emoji: r.emoji,
          region: regionText,
          protocol: protocolText,
          index: padIndex(currentIndex, cfg.rename.template.indexPad),
          name: templateHasEmoji ? stripLeadingEmoji(r.name) : r.name,
          server: r.server,
          port: r.port
        };
        r.name = renderTemplate(template, vars, r);
      }
    }
  }

  if (cfg.sort.enabled && effectiveSort.keys.length > 0) {
    records.sort(makeComparator(effectiveSort));
  }

  return records.map(r => r.name);
});

// --- 规则构建器 ---
const ruleBuilder = ref({
  action: 'remove',
  targetType: 'preset',
  preset: '',
  customInput: '',
  replacement: ''
});

const PRESETS = {
  brackets: { label: '[...] (...) {...} 【...】', pattern: '\\[.*?\\]|\\(.*?\\)|\\{.*?\\}|【.*?】' },
  emoji: { label: '🙂 (Emoji)', pattern: '\\p{Emoji_Presentation}' },
  url: { label: 'example.com (域名/网址)', pattern: '([a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,}' },
  chinese: { label: '中文字符', pattern: '[\\u4e00-\\u9fa5]+' },
  ad: { label: 'VIP|群组|频道|官网|高速|专线|流媒体|倍率', pattern: 'VIP|群组|频道|官网|高速|专线|流媒体|倍率' },
  params: { label: '?foo=bar (网址参数)', pattern: '\\?.*' },
  space: { label: 'Space (多余空格)', pattern: '\\s{2,}' },
  trim: { label: 'Trim (首尾空白)', pattern: '^\\s+|\\s+$' },
  // Expanded Presets
  traffic: { label: '1.5x | 3倍 | 0.x (流量倍率)', pattern: '(\\d+(?:\\.\\d+)?|\\.\\d+)\\s*(x|X|倍速|倍|倍率)', flags: 'gi' },
  provider: { label: '专线|BGP|IPLC|IEPL|CN2... (线路)', pattern: '(专线|BGP|IPLC|IEPL|CN2|GIA|Anycast|Relay|Premium|Ultra|High Speed|Game|Media)', flags: 'gi' },
  separator: { label: '- | _ | — (无用分隔符)', pattern: '[-|_|—|\\|]+' },
  ip: { label: '127.0.0.1 (IPv4)', pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b' }
};

const TEMPLATE_PRESETS = [
  { label: '标准', value: '{emoji} {region:zh}-{region:UPPER}-{index}', desc: '🇺🇸 美国-US-01' },
  { label: '极简', value: '{region} {index}', desc: 'US 01' },
  { label: '国家协议序号', value: '{emoji} {region:zh} {protocol:UPPER} {index}', desc: '🇺🇸 美国 VMESS 01' },
  { label: '详细', value: '{emoji} {region} | {protocol} | {name}', desc: '🇺🇸 US | VMESS | 原始名称' },
  { label: '保留', value: '{emoji} {name}', desc: '🇺🇸 原始名称' },
  // Expanded Presets
  { label: '纯净', value: '{emoji} {region:zh} {index}', desc: '🇺🇸 美国 01' },
  { label: '协议', value: '{protocol:UPPER} {index}', desc: 'VMESS 01' },
  { label: '国别', value: '{emoji} {region} {protocol}', desc: '🇺🇸 US VMESS' },
  { label: '标签', value: '[{region:zh}] {name}', desc: '[美国] 原始名称' },
  { label: '仅名称', value: '{name}', desc: '原始名称' }
];

const applyTemplate = (tpl) => {
  config.value.rename.template.template = tpl;
};

const sanitizePlainText = (value) => DOMPurify.sanitize(value, {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: []
});

const sanitizeHighlightedHtml = (value) => DOMPurify.sanitize(value, {
  ALLOWED_TAGS: ['span'],
  ALLOWED_ATTR: ['class']
});

const getHighlightedName = (name) => {
  const safeName = sanitizePlainText(String(name ?? ''));
  if (!config.value.rename.regex.enabled || config.value.rename.regex.rules.length === 0) return safeName;

  let highlighted = safeName;

  for (const rule of config.value.rename.regex.rules) {
    if (!rule?.pattern) continue;
    if (rule.action === 'prefix' || rule.action === 'suffix') continue;
    try {
      const flags = rule.flags || 'g';
      const regex = new RegExp(`(${rule.pattern})`, flags);
      highlighted = highlighted.replace(regex, '<span class="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 line-through decoration-red-500">$1</span>');
    } catch (e) {
      return safeName;
    }
  }

  return sanitizeHighlightedHtml(highlighted);
};

const getRuleLabel = (rule) => {
  let label = '';
  if (rule.targetType === 'preset') {
    label = PRESETS[rule.preset]?.label || rule.preset;
  } else {
    label = rule.customInput;
  }

  switch (rule.action) {
    case 'remove': return `删除 ${label}`;
    case 'replace': return `替换 ${label} 为 "${rule.replacement}"`;
    case 'prefix': return `添加前缀 "${rule.replacement}"`;
    case 'suffix': return `添加后缀 "${rule.replacement}"`;
    default: return `未知规则`;
  }
};

const addVisualRule = () => {
  let pattern = '';
  let replacement = '';
  let flags = 'g';

  if (ruleBuilder.value.action === 'remove') {
    replacement = '';
  } else if (ruleBuilder.value.action === 'replace') {
    replacement = ruleBuilder.value.replacement;
  } else if (ruleBuilder.value.action === 'prefix') {
    // ... handled below
  } else if (ruleBuilder.value.action === 'suffix') {
    // ... handled below
  }

  // 构建 regex pattern
  if (['remove', 'replace'].includes(ruleBuilder.value.action)) {
    if (ruleBuilder.value.targetType === 'preset') {
      const p = PRESETS[ruleBuilder.value.preset];
      pattern = p ? p.pattern : '';
      if (p && p.flags) flags = p.flags;
      else if (ruleBuilder.value.preset === 'emoji') flags = 'gu';

      // Special handling for replacement for some presets
      if (ruleBuilder.value.preset === 'space' && ruleBuilder.value.action === 'replace') replacement = ' ';
    } else {
      const raw = ruleBuilder.value.customInput;
      if (!raw) return;
      // Support multiple keywords separated by |
      if (raw.includes('|')) {
        pattern = raw.split('|').map(p => p.trim()).filter(Boolean).map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      } else {
        pattern = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
    }
  }

  if (!pattern && ruleBuilder.value.action !== 'prefix' && ruleBuilder.value.action !== 'suffix') return;

  // 前后缀逻辑修正
  if (ruleBuilder.value.action === 'prefix') {
    pattern = '^';
    replacement = ruleBuilder.value.replacement;
  } else if (ruleBuilder.value.action === 'suffix') {
    pattern = '$';
    replacement = ruleBuilder.value.replacement;
  }

  const targetDisplay = ruleBuilder.value.targetType === 'preset'
    ? (PRESETS[ruleBuilder.value.preset]?.label || ruleBuilder.value.preset)
    : ruleBuilder.value.customInput;

  config.value.rename.regex.rules.push({
    action: ruleBuilder.value.action,
    pattern,
    replacement: ruleBuilder.value.action === 'remove' ? '' : (replacement || ruleBuilder.value.replacement),
    label: getRuleLabel(ruleBuilder.value),
    flags,
    _meta: {
      action: ruleBuilder.value.action,
      targetDisplay
    }
  });

  ruleBuilder.value.customInput = '';
  ruleBuilder.value.replacement = '';
};

const removeRegexRule = (index) => {
  config.value.rename.regex.rules.splice(index, 1);
};

const moveRule = (index, direction) => {
  const rules = config.value.rename.regex.rules;
  if (direction === -1 && index > 0) {
    [rules[index], rules[index - 1]] = [rules[index - 1], rules[index]];
  } else if (direction === 1 && index < rules.length - 1) {
    [rules[index], rules[index + 1]] = [rules[index + 1], rules[index]];
  }
};

// 协议优先级顺序的双向绑定
const protocolOrderText = computed({
  get: () => (config.value.dedup.prefer?.protocolOrder ?? []).join(', '),
  set: (val) => {
    const order = String(val ?? '')
      .split(/[,\n]/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    config.value.dedup.prefer.protocolOrder = order;
  }
});

// --- Sync Logic ---
let lastEmittedJson = '';
const buildConfig = (val) => ({
  enabled: val?.enabled ?? false,
  rename: val?.rename ? JSON.parse(JSON.stringify(val.rename)) : { regex: { enabled: false, rules: [] }, template: { enabled: false } },
  dedup: val?.dedup ? JSON.parse(JSON.stringify(val.dedup)) : { enabled: false, mode: 'serverPort' },
  sort: val?.sort ? JSON.parse(JSON.stringify(val.sort)) : { enabled: false }
});

watch(() => props.modelValue, (val) => {
  if (val && typeof val === 'object') {
    const newJson = JSON.stringify(buildConfig(val));
    if (newJson !== lastEmittedJson) {
      const parsed = JSON.parse(newJson);
      if (!parsed.rename.regex) parsed.rename.regex = { enabled: false, rules: [] };
      if (!parsed.rename.template) parsed.rename.template = { enabled: false, template: '{emoji}{region}-{protocol}-{index}' };
      config.value = parsed;
      lastEmittedJson = newJson;
    }
  }
}, { immediate: true, deep: true });

watch(config, (val) => {
  const newJson = JSON.stringify(val);
  if (newJson !== lastEmittedJson) {
    lastEmittedJson = newJson;
    emit('update:modelValue', JSON.parse(newJson));
  }
}, { deep: true });

const insertTemplateTag = (tag) => {
  config.value.rename.template.template += tag;
};
</script>

<template>
  <div class="space-y-6">
    <!-- 顶部总开关 -->
    <div class="flex items-center justify-between">
      <div class="flex flex-col gap-1">
        <p class="text-base font-semibold text-gray-800 dark:text-gray-100">启用节点净化管道</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">就像过滤器一样，对节点名称进行清洗、重命名和重新排序</p>
        <!-- Pipeline Guide -->
        <div
          class="mt-2 flex items-center text-[10px] text-gray-400 gap-1 bg-gray-50 dark:bg-gray-800/50 w-fit px-2 py-1 rounded border border-gray-100 dark:border-gray-700">
          <span>ℹ️ 处理流程:</span>
          <span class="font-mono text-indigo-500">1.魔术清理</span>
          <span>→</span>
          <span class="font-mono text-indigo-500">2.智能重命名</span>
          <span>→</span>
          <span class="font-mono text-indigo-500">3.去重 & 排序</span>
        </div>
      </div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" v-model="config.enabled" class="sr-only peer">
        <div
          class="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600 dark:peer-checked:bg-indigo-600">
        </div>
      </label>
    </div>

    <div v-if="config.enabled" class="space-y-6 animate-fade-in-down">
      <RulePreview
        :custom-node-input="customNodeInput"
        :active-mock-nodes="activeMockNodes"
        :preview-result="previewResult"
        :get-highlighted-name="getHighlightedName"
        @update:custom-node-input="customNodeInput = $event"
        @add-custom-node="addCustomNode"
      />

      <RuleEditor
        :config="config"
        :rule-builder="ruleBuilder"
        :presets="PRESETS"
        :template-presets="TEMPLATE_PRESETS"
        :protocol-order-text="protocolOrderText"
        :add-visual-rule="addVisualRule"
        :remove-regex-rule="removeRegexRule"
        :move-rule="moveRule"
        :apply-template="applyTemplate"
        :insert-template-tag="insertTemplateTag"
        @update:protocol-order-text="protocolOrderText = $event"
      />
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in-down {
  animation: fadeInDown 0.3s ease-out;
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
