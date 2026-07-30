<script setup>
import { ref, watch } from 'vue';
import { useI18n } from '../../../../i18n/index.js';
import { createRegionalProtocolRenameDsl } from '../../../../constants/safeScriptPresets.js';

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['update:modelValue']);
const { t } = useI18n();

const resolveMode = (value) => value.mode || (value.code ? 'javascript' : 'rules');
const activeMode = ref(resolveMode(props.modelValue));
const formatDsl = (dsl) => JSON.stringify(Array.isArray(dsl) ? dsl : [], null, 2);
const dslText = ref(formatDsl(props.modelValue.dsl));
const parseError = ref('');

watch(
  () => [props.modelValue.mode, props.modelValue.code],
  () => {
    activeMode.value = resolveMode(props.modelValue);
  }
);

watch(
  () => props.modelValue.dsl,
  (dsl) => {
    const formatted = formatDsl(dsl);
    if (formatted !== dslText.value) dslText.value = formatted;
  },
  { deep: true }
);

const emitDsl = (dsl) => {
  emit('update:modelValue', { ...props.modelValue, mode: 'rules', dsl });
};

const updateDsl = (event) => {
  dslText.value = event.target.value;
  try {
    const parsed = JSON.parse(dslText.value);
    if (!Array.isArray(parsed)) throw new Error(t('operators.safeRulesArrayError'));
    parseError.value = '';
    emitDsl(parsed);
  } catch (error) {
    parseError.value = error.message || t('operators.safeRulesInvalid');
  }
};

const applyRegionalPreset = () => {
  activeMode.value = 'rules';
  const dsl = createRegionalProtocolRenameDsl();
  dslText.value = formatDsl(dsl);
  parseError.value = '';
  emitDsl(dsl);
};

const setMode = (mode) => {
  activeMode.value = mode;
  emit('update:modelValue', { ...props.modelValue, mode });
};

const updateCode = (event) => {
  emit('update:modelValue', {
    ...props.modelValue,
    mode: 'javascript',
    code: event.target.value
  });
};
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="modelValue.url"
      class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      {{ t('operators.remoteScriptDisabled') }}
    </div>

    <div class="flex rounded-xl bg-gray-100 p-1 dark:bg-gray-900">
      <button
        v-for="mode in ['javascript', 'rules']"
        :key="mode"
        type="button"
        class="flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors"
        :class="activeMode === mode
          ? 'bg-white text-indigo-600 shadow-sm dark:bg-gray-800 dark:text-indigo-300'
          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'"
        @click="setMode(mode)"
      >
        {{ mode === 'javascript' ? t('operators.sandboxJavaScript') : t('operators.safeRulesTitle') }}
      </button>
    </div>

    <div v-if="activeMode === 'javascript'" class="space-y-3">
      <div>
        <div class="text-xs font-bold text-gray-700 dark:text-gray-200">
          {{ t('operators.sandboxJavaScript') }}
        </div>
        <p class="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
          {{ t('operators.sandboxJavaScriptHint') }}
        </p>
      </div>
      <textarea
        :value="modelValue.code || ''"
        class="h-96 w-full resize-y rounded-xl border border-slate-700/50 bg-slate-950/90 p-4 font-mono text-xs leading-5 text-slate-200 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
        spellcheck="false"
        :placeholder="t('operators.sandboxJavaScriptPlaceholder')"
        @input="updateCode"
      ></textarea>
      <p class="text-[10px] text-gray-500 dark:text-gray-400">
        {{ t('operators.sandboxLimitsHint') }}
      </p>
    </div>

    <div v-else class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-xs font-bold text-gray-700 dark:text-gray-200">
            {{ t('operators.safeRulesTitle') }}
          </div>
          <p class="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
            {{ t('operators.safeRulesHint') }}
          </p>
        </div>
        <button
          type="button"
          class="rounded-lg bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
          @click="applyRegionalPreset"
        >
          {{ t('operators.regionalProtocolPreset') }}
        </button>
      </div>

      <textarea
        :value="dslText"
        class="h-80 w-full resize-y rounded-xl border border-slate-700/50 bg-slate-950/90 p-4 font-mono text-xs leading-5 text-slate-200 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
        spellcheck="false"
        :placeholder="t('operators.safeRulesPlaceholder')"
        @input="updateDsl"
      ></textarea>

      <p v-if="parseError" class="text-xs text-rose-500">
        {{ t('operators.safeRulesInvalid') }}: {{ parseError }}
      </p>
    </div>
  </div>
</template>
