<script setup>
    import Switch from '../../ui/Switch.vue';
    import { computed } from 'vue';
    import { useI18n } from '../../../i18n/index.js';

    const { t } = useI18n();

    // 单订阅的「禁用自动刷新」只在节点持久化开启后才有意义：
    // 持久化关闭时没有 D1 快照，自动刷新本身就不存在。
    const persistenceEnabled = computed(() => props.persistenceEnabled === true);
    const autoRefreshDisabledReason = computed(() =>
        persistenceEnabled.value ? '' : t('settings.autoUpdateRequiresPersistence')
    );

    const props = defineProps({
        editingSubscription: {
            type: Object,
            required: true,
        },
        persistenceEnabled: {
            type: Boolean,
            default: false,
        },
    });

    // 开关文案是「禁用自动更新」：勾选 = autoUpdate false。
    // 存量订阅没有该字段，缺省视为启用自动更新，所以开关默认关闭。
    const autoUpdateDisabled = computed({
        get: () => props.editingSubscription?.autoUpdate === false,
        set: (value) => {
            if (!props.editingSubscription) return;
            props.editingSubscription.autoUpdate = value !== true;
        },
    });
</script>

<template>
    <!-- User-Agent -->
    <div>
        <label for="sub-edit-ua" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('subscriptions.uaLabel') }}
            <span class="text-xs text-gray-500 ml-2">{{ t('subscriptions.optionalDefault') }}</span>
        </label>
        <select
            id="sub-edit-ua"
            v-model="editingSubscription.customUserAgent"
            class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 misub-radius-md dark:text-white"
        >
            <option value="">{{ t('subscriptions.defaultUa') }}</option>
            <option value="MiSub">MiSub</option>
            <option value="clash-verge/v2.4.3">Clash Verge</option>
            <option value="clash.meta">Clash Meta</option>
            <option value="v2rayN/7.23">v2rayN</option>
            <option value="Shadowrocket/1.9.0">Shadowrocket</option>
            <option value="Mozilla/5.0">Mozilla</option>
        </select>
        <p
            v-if="editingSubscription.customUserAgent"
            class="text-xs text-gray-500 dark:text-gray-400 mt-1"
        >
            {{ t('subscriptions.currentUa', { ua: editingSubscription.customUserAgent }) }}
        </p>
    </div>

    <!-- 官网 -->
    <div>
        <label
            for="sub-edit-website"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
            {{ t('subscriptions.websiteLabel') }}
            <span class="text-xs text-gray-500 ml-2">{{ t('subscriptions.websiteOptional') }}</span>
        </label>
        <input
            id="sub-edit-website"
            v-model="editingSubscription.website"
            type="url"
            inputmode="url"
            placeholder="https://example.com"
            class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 misub-radius-md dark:text-white font-mono text-sm"
        />
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ t('subscriptions.websiteHint') }}
        </p>
    </div>

    <!-- 备注 -->
    <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{
            t('subscriptions.notesLabel')
        }}</label>
        <textarea
            v-model="editingSubscription.notes"
            :placeholder="t('subscriptions.notesPlaceholder')"
            rows="2"
            class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 misub-radius-md dark:text-white"
        ></textarea>
    </div>

    <!-- 开关选项 -->
    <div class="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
        <div class="flex items-center justify-between gap-4">
            <div>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{
                    t('subscriptions.nodeCacheTitle')
                }}</span>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {{ t('subscriptions.nodeCacheDesc') }}
                </p>
            </div>
            <Switch v-model="editingSubscription.enableNodeCache" />
        </div>

        <div class="flex items-center justify-between gap-4">
            <div>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{
                    t('subscriptions.plusAsSpaceTitle')
                }}</span>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {{ t('subscriptions.plusAsSpaceDesc') }}
                </p>
            </div>
            <Switch v-model="editingSubscription.plusAsSpace" />
        </div>

        <div class="flex items-center justify-between gap-4">
            <div>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{
                    t('subscriptions.excludeTrafficTitle')
                }}</span>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {{ t('subscriptions.excludeTrafficDesc') }}
                </p>
            </div>
            <Switch v-model="editingSubscription.excludeTraffic" />
        </div>

        <div class="flex items-center justify-between gap-4">
            <div>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {{ t('subscriptions.autoUpdateTitle') }}
                </span>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {{ t('subscriptions.autoUpdateDesc') }}
                </p>
                <p
                    v-if="autoRefreshDisabledReason"
                    class="mt-1 text-xs text-amber-600 dark:text-amber-400"
                >
                    {{ autoRefreshDisabledReason }}
                </p>
            </div>
            <Switch v-model="autoUpdateDisabled" :disabled="!persistenceEnabled" />
        </div>
    </div>
</template>
