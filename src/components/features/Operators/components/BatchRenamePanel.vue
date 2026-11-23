<script setup>
    import { computed } from 'vue';
    import { useI18n } from '../../../../i18n/index.js';

    const props = defineProps({
        modelValue: {
            type: Array,
            default: () => [],
        },
    });

    const emit = defineEmits(['update:modelValue']);
    const { t } = useI18n();

    // 本面板管理的操作符用固定 id + meta 标记，与用户手动添加的重命名区分开
    const OP_ID = 'batch-rename';
    const findIndex = () =>
        props.modelValue.findIndex((op) => op?.meta?.batchRename || op?.id === OP_ID);

    const batchOp = computed(() => {
        const i = findIndex();
        return i === -1 ? null : props.modelValue[i];
    });

    const enabled = computed(() => !!batchOp.value?.enabled);
    const template = computed(() => batchOp.value?.params?.template?.template || '');
    const indexScope = computed(() => batchOp.value?.params?.template?.indexScope || 'region');
    const offset = computed(() => batchOp.value?.params?.template?.offset ?? 1);

    const makeOp = (patch = {}) => ({
        id: OP_ID,
        type: 'rename',
        enabled: true,
        meta: { batchRename: true },
        params: {
            regex: { enabled: false, rules: [] },
            template: {
                enabled: true,
                template: '{emoji}{regionZh} {index:2}',
                offset: 1,
                indexScope: 'region',
                ...patch,
            },
        },
    });

    // 统一写回：不存在则新增，存在则更新对应 template 字段
    const patchOp = (patch, forceEnable = true) => {
        const list = [...props.modelValue];
        const i = findIndex();
        if (i === -1) {
            list.push(makeOp(patch));
        } else {
            const op = list[i];
            list[i] = {
                ...op,
                enabled: forceEnable ? true : op.enabled,
                params: {
                    ...op.params,
                    regex: op.params?.regex || { enabled: false, rules: [] },
                    template: {
                        enabled: true,
                        ...(op.params?.template || {}),
                        ...patch,
                    },
                },
            };
        }
        emit('update:modelValue', list);
    };

    const toggleEnabled = (val) => {
        const list = [...props.modelValue];
        const i = findIndex();
        if (i === -1) {
            if (val) list.push(makeOp());
        } else {
            list[i] = { ...list[i], enabled: val };
        }
        emit('update:modelValue', list);
    };

    // 命名方案预设（同时设定模板与编号方式）
    const schemes = [
        { key: 'schemeRegionIndex', template: '{emoji}{regionZh} {index:2}', scope: 'region' },
        { key: 'schemeRegionCodeIndex', template: '{emoji}{region} {index:2}', scope: 'region' },
        {
            key: 'schemeRegionProtoIndex',
            template: '{emoji}{region}-{protocol}-{index:2}',
            scope: 'regionProtocol',
        },
        { key: 'schemeKeepNameIndex', template: '{name} {index:2}', scope: 'global' },
    ];
    const currentScheme = computed(
        () => schemes.find((s) => s.template === template.value)?.key || 'custom'
    );
    const applyScheme = (s) => patchOp({ template: s.template, indexScope: s.scope });

    const scopeOptions = [
        { value: 'region', key: 'scopeRegion' },
        { value: 'protocol', key: 'scopeProtocol' },
        { value: 'regionProtocol', key: 'scopeRegionProtocol' },
        { value: 'global', key: 'scopeGlobal' },
    ];

    const varTags = [
        '{emoji}',
        '{regionZh}',
        '{region}',
        '{protocol}',
        '{name}',
        '{index}',
        '{index:2}',
        '{index:3}',
        '{globalIndex}',
        '{server}',
    ];
    const appendVar = (tag) => patchOp({ template: (template.value || '') + tag });

    // ---- 前端预览：用示例节点复刻后端 renderTemplate 的行为 ----
    const samples = [
        { name: '香港01节点', regionZh: '香港', region: 'HK', emoji: '🇭🇰', protocol: 'vmess' },
        { name: '香港专线B', regionZh: '香港', region: 'HK', emoji: '🇭🇰', protocol: 'trojan' },
        { name: 'Japan-Tokyo-1', regionZh: '日本', region: 'JP', emoji: '🇯🇵', protocol: 'vless' },
        { name: 'US 洛杉矶 03', regionZh: '美国', region: 'US', emoji: '🇺🇸', protocol: 'ss' },
    ];

    const renderName = (tpl, vars) =>
        tpl.replace(/\{(\w+)(?::(\d+))?\}/g, (match, key, pad) => {
            const raw = vars[key];
            if (raw === undefined || raw === null) return '';
            let value = String(raw);
            if (pad) value = value.padStart(Number(pad), '0');
            return value;
        });

    const previewRows = computed(() => {
        const tpl = template.value || '{emoji}{regionZh} {index:2}';
        const scope = indexScope.value || 'region';
        const start = Number(offset.value) || 1;
        const counters = new Map();
        let globalCounter = 0;
        return samples.map((s) => {
            let groupKey = 'global';
            if (scope === 'region') groupKey = `r:${s.regionZh}`;
            else if (scope === 'protocol') groupKey = `p:${s.protocol}`;
            else if (scope === 'regionProtocol') groupKey = `rp:${s.regionZh}|${s.protocol}`;
            const groupIndex = (counters.get(groupKey) || 0) + 1;
            counters.set(groupKey, groupIndex);
            globalCounter += 1;
            const vars = {
                ...s,
                index: groupIndex + start - 1,
                globalIndex: globalCounter + start - 1,
            };
            return { before: s.name, after: renderName(tpl, vars) };
        });
    });

    const statusLabel = (on) => t(on ? 'operators.statusOn' : 'operators.statusOff');
</script>

<template>
    <div
        class="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/40 to-teal-50/20 p-4 dark:border-emerald-500/20 dark:from-emerald-900/10 dark:to-teal-900/5"
    >
        <!-- 标题行 -->
        <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
                <div
                    class="w-8 h-8 shrink-0 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm shadow-emerald-500/20"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                        />
                    </svg>
                </div>
                <div class="min-w-0">
                    <h4 class="text-sm font-bold text-gray-900 dark:text-white">
                        {{ t('operators.batchRename.title') }}
                    </h4>
                    <p class="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                        {{ t('operators.batchRename.desc') }}
                    </p>
                </div>
            </div>
            <button
                @click="toggleEnabled(!enabled)"
                :class="[
                    'shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-colors',
                    enabled
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                ]"
            >
                {{ statusLabel(enabled) }}
            </button>
        </div>

        <!-- 配置区 -->
        <div v-if="enabled" class="mt-4 space-y-3">
            <!-- 命名方案 -->
            <div class="space-y-1.5">
                <label
                    class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight"
                >
                    {{ t('operators.batchRename.scheme') }}
                </label>
                <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    <button
                        v-for="s in schemes"
                        :key="s.key"
                        @click="applyScheme(s)"
                        :class="[
                            'rounded-lg px-2 py-1.5 text-[10px] font-medium border transition-all',
                            currentScheme === s.key
                                ? 'border-emerald-400 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
                        ]"
                    >
                        {{ t(`operators.batchRename.${s.key}`) }}
                    </button>
                </div>
            </div>

            <!-- 模板 + 编号方式 + 起始 -->
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_130px_80px]">
                <div class="space-y-1.5">
                    <label
                        class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight"
                    >
                        {{ t('operators.batchRename.template') }}
                    </label>
                    <input
                        :value="template"
                        @input="(e) => patchOp({ template: e.target.value })"
                        placeholder="{emoji}{regionZh} {index:2}"
                        class="w-full px-2.5 py-1.5 text-[11px] font-mono rounded-lg bg-white dark:bg-gray-800 border border-emerald-100 dark:border-emerald-900/40 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20"
                    />
                </div>
                <div class="space-y-1.5">
                    <label
                        class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight"
                    >
                        {{ t('operators.batchRename.scope') }}
                    </label>
                    <select
                        :value="indexScope"
                        @change="(e) => patchOp({ indexScope: e.target.value })"
                        class="w-full px-2 py-1.5 text-[11px] rounded-lg bg-white dark:bg-gray-800 border border-emerald-100 dark:border-emerald-900/40 outline-none"
                    >
                        <option v-for="o in scopeOptions" :key="o.value" :value="o.value">
                            {{ t(`operators.batchRename.${o.key}`) }}
                        </option>
                    </select>
                </div>
                <div class="space-y-1.5">
                    <label
                        class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight"
                    >
                        {{ t('operators.startIndex') }}
                    </label>
                    <input
                        :value="offset"
                        @input="(e) => patchOp({ offset: parseInt(e.target.value) || 1 })"
                        type="number"
                        class="w-full px-2 py-1.5 text-[11px] rounded-lg bg-white dark:bg-gray-800 border border-emerald-100 dark:border-emerald-900/40 outline-none"
                    />
                </div>
            </div>

            <!-- 变量标签 -->
            <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-[9px] text-gray-500 dark:text-gray-400">{{
                    t('operators.batchRename.variables')
                }}</span>
                <button
                    v-for="tag in varTags"
                    :key="tag"
                    @click="appendVar(tag)"
                    class="text-[9px] bg-white dark:bg-gray-800 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100/50 dark:border-emerald-900/30 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                >
                    {{ tag }}
                </button>
            </div>

            <!-- 预览 -->
            <div
                class="rounded-xl bg-white/70 dark:bg-gray-900/40 border border-emerald-100/60 dark:border-emerald-900/30 p-3"
            >
                <div class="text-[10px] font-bold text-gray-600 dark:text-gray-300 mb-2">
                    {{ t('operators.batchRename.preview') }}
                </div>
                <div class="space-y-1">
                    <div
                        v-for="(row, i) in previewRows"
                        :key="i"
                        class="flex items-center gap-2 text-[10px]"
                    >
                        <span class="text-gray-400 dark:text-gray-500 truncate max-w-[45%]">{{
                            row.before
                        }}</span>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-3 w-3 shrink-0 text-emerald-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M14 5l7 7m0 0l-7 7m7-7H3"
                            />
                        </svg>
                        <span class="font-semibold text-emerald-700 dark:text-emerald-300 truncate">
                            {{ row.after }}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
