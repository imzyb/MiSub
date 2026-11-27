<script setup>
    import { computed } from 'vue';
    import { useI18n } from '../../i18n/index.js';
    import { useVersionStore } from '../../stores/version.js';
    import Modal from '../forms/Modal.vue';
    import Button from '../ui/Button.vue';
    import ChangelogContent from './ChangelogContent.vue';
    import { parseChangelog } from '../../utils/changelog.js';

    const { t } = useI18n();
    const versionStore = useVersionStore();

    const props = defineProps({
        show: Boolean,
        release: {
            type: Object,
            default: () => ({ tag_name: '', name: '', body: '', html_url: '' }),
        },
        currentVersion: {
            type: String,
            default: '',
        },
    });

    const emit = defineEmits(['update:show', 'confirm', 'suppress']);

    const isLatest = computed(() => {
        if (!props.release?.tag_name) return true;
        return (
            props.currentVersion === props.release.tag_name ||
            props.currentVersion === props.release.tag_name.replace(/^v/, '')
        );
    });

    // 只有一份正文来源：当前已是最新时展示内置日志，否则展示上游 Release body。
    const changelogText = computed(() => {
        if (isLatest.value && versionStore.localChangelog) return versionStore.localChangelog;
        return props.release?.body || '';
    });

    const hasChangelog = computed(() => parseChangelog(changelogText.value).length > 0);

    const bannerTitle = computed(() => {
        if (isLatest.value) {
            return t('changelog.highlightsTitle', { version: props.currentVersion });
        }
        return props.release?.name || props.release?.tag_name || t('changelog.releaseNotes');
    });

    const publishedAt = computed(() => {
        if (isLatest.value || !props.release?.published_at) return '';
        return t('changelog.publishedAt', {
            date: new Date(props.release.published_at).toLocaleString(),
        });
    });
</script>

<template>
    <Modal
        :show="show"
        @update:show="emit('update:show', $event)"
        size="lg"
        :close-on-confirm="false"
    >
        <template #title>
            <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <h3 class="text-lg font-bold text-gray-900 dark:text-white">
                    {{ t('changelog.title') }}
                </h3>
                <span
                    v-if="isLatest"
                    class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                >
                    {{ t('changelog.latestVersion') }}
                </span>
                <span
                    v-else
                    class="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                >
                    {{ t('changelog.newVersionAvailable') }}
                </span>
            </div>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                <template v-if="isLatest">
                    {{ t('changelog.upToDate', { version: currentVersion }) }}
                </template>
                <template v-else>
                    {{
                        t('changelog.newVersionDetected', {
                            latest: release.tag_name,
                            current: currentVersion,
                        })
                    }}
                </template>
            </p>
        </template>

        <template #body>
            <!--
                单列 DOM：摘要条、正文卡片、发布页链接依次纵向排列。
                正文不再套「定高 + 内部滚动」容器 —— 整个 Modal body 才是唯一的滚动容器，
                因此不会出现弹窗滚动条与内容滚动条并存。
            -->
            <div class="flex flex-col gap-3.5 sm:gap-4">
                <div
                    class="rounded-[var(--misub-radius-lg)] border border-primary-200/70 bg-primary-50/60 px-4 py-3 dark:border-primary-400/20 dark:bg-primary-500/10"
                >
                    <p class="text-sm font-semibold text-primary-700 dark:text-primary-300">
                        {{ bannerTitle }}
                    </p>
                    <p
                        v-if="publishedAt"
                        class="mt-1 text-xs text-primary-600/80 dark:text-primary-300/70"
                    >
                        {{ publishedAt }}
                    </p>
                </div>

                <section
                    class="rounded-[var(--misub-radius-lg)] border border-gray-200/80 bg-gray-50/60 px-4 py-4 sm:px-5 dark:border-white/10 dark:bg-white/[0.03]"
                >
                    <ChangelogContent v-if="hasChangelog" :text="changelogText" />
                    <p v-else class="text-sm text-gray-500 dark:text-gray-400">
                        {{ t('changelog.noDetails') }}
                    </p>
                </section>

                <a
                    v-if="release.html_url"
                    :href="release.html_url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-2 self-start rounded-[var(--misub-radius-sm)] text-sm font-medium text-primary-600 transition-colors hover:text-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 dark:text-primary-400 dark:hover:text-primary-300"
                >
                    {{ t('changelog.viewReleasePage') }}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="h-4 w-4"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                        />
                    </svg>
                </a>
            </div>
        </template>

        <template #footer>
            <div class="flex w-full justify-end gap-2.5">
                <Button variant="secondary" @click="emit('suppress')">
                    {{ t('changelog.dontShowAgain') }}
                </Button>
                <Button variant="primary" @click="emit('confirm')">
                    {{ t('actions.confirm') }}
                </Button>
            </div>
        </template>
    </Modal>
</template>
