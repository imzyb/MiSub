<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['update:modelValue']);

const protocolOptions = ['vless', 'vmess', 'trojan', 'ss', 'hysteria2', 'tuic', 'socks5'];

const params = computed({
  get: () => ({
    mode: 'serverPort',
    includeProtocol: true,
    prefer: {
      protocolOrder: [],
    },
    ...props.modelValue,
    prefer: {
      protocolOrder: [],
      ...(props.modelValue?.prefer || {}),
    }
  }),
  set: (val) => emit('update:modelValue', val)
});

const updateValue = (patch) => {
  params.value = {
    ...params.value,
    ...patch,
  };
};

const toggleProtocol = (protocol) => {
  const current = new Set(params.value.prefer?.protocolOrder || []);
  if (current.has(protocol)) {
    current.delete(protocol);
  } else {
    current.add(protocol);
  }

  updateValue({
    prefer: {
      ...(params.value.prefer || {}),
      protocolOrder: Array.from(current),
    }
  });
};
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-4 md:grid-cols-2">
      <div class="space-y-2">
        <label class="text-[11px] font-bold uppercase tracking-tight text-gray-400">去重依据</label>
        <select
          :value="params.mode"
          @change="updateValue({ mode: $event.target.value })"
          class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        >
          <option value="serverPort">服务器 + 端口</option>
          <option value="url">完整链接</option>
        </select>
        <p class="text-[10px] text-gray-400">通常推荐使用“服务器 + 端口”，适合清理重复节点。</p>
      </div>

      <div class="space-y-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-900/40">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-gray-200">协议参与去重</p>
            <p class="text-[10px] text-gray-500 dark:text-gray-400">开启后，不同协议但同主机端口的节点不会互相去重。</p>
          </div>
          <button
            @click="updateValue({ includeProtocol: !params.includeProtocol })"
            :class="params.includeProtocol ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
            class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          >
            {{ params.includeProtocol ? '已开启' : '关闭' }}
          </button>
        </div>
      </div>
    </div>

    <div class="space-y-2">
      <label class="text-[11px] font-bold uppercase tracking-tight text-gray-400">优先保留协议</label>
      <div class="flex flex-wrap gap-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-900/40">
        <button
          v-for="protocol in protocolOptions"
          :key="protocol"
          @click="toggleProtocol(protocol)"
          :class="(params.prefer?.protocolOrder || []).includes(protocol)
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'border border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'"
          class="rounded-lg px-3 py-1.5 text-xs font-medium uppercase transition-colors"
        >
          {{ protocol }}
        </button>
      </div>
      <p class="text-[10px] text-gray-400">当检测到重复节点时，优先保留这里勾选的协议。未设置时按默认规则处理。</p>
    </div>
  </div>
</template>
