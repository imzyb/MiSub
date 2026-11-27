<script setup>
    import { computed, ref } from 'vue';
    import { formatBytes } from '../../lib/utils.js';
    import { inferAirportRootDomain } from '../../utils/airport-domain.js';
    import { lookupDomainName } from '../../utils/domain-name-memory.js';
    import { api } from '../../lib/http.js';
    import { TIMING } from '../../constants/timing.js';
    import Switch from './Switch.vue';
    import { useI18n } from '@/i18n/index.js';

    const props = defineProps({
        misub: {
            type: Object,
            required: true,
        },
        // 只有开启 D1 节点持久化时，「已禁用自动刷新」徽标才有意义。
        persistenceEnabled: {
            type: Boolean,
            default: false,
        },
    });

    const emit = defineEmits([
        'delete',
        'change',
        'update',
        'edit',
        'preview',
        'qrcode',
        'applyDetectedName',
    ]);
    const { t } = useI18n();

    const getProtocol = (url) => {
        try {
            if (!url) return 'unknown';
            const lowerUrl = url.toLowerCase();
            if (lowerUrl.startsWith('https://')) return 'https';
            if (lowerUrl.startsWith('http://')) return 'http';
            if (lowerUrl.includes('clash')) return 'clash';
        } catch {
            return 'unknown';
        }
        return 'unknown';
    };

    const protocol = computed(() => getProtocol(props.misub.url));

    // 暂停自动刷新：只在节点持久化开启时才有意义——
    // 未启用持久化时没有 D1 快照，徽标会误导用户。
    const autoUpdatePaused = computed(
        () => props.persistenceEnabled === true && props.misub?.autoUpdate === false
    );

    // 机场自报名称（订阅响应头的 Profile-Title / Content-Disposition），仅用于展示提示
    const detectedName = computed(() => {
        const value = props.misub?.detectedName;
        return typeof value === 'string' ? value.trim() : '';
    });

    // 机场主域名（可点击访问官网）
    const rootDomain = computed(() => inferAirportRootDomain(props.misub?.url));

    // 按需识别：仅在用户点击时抓取官网标题，避免常规刷新时的额外请求
    const detecting = ref(false);
    const localDetectedName = ref('');

    // 该域名记住的名称（用户此前确认过），优先级高于自动识别
    const rememberedName = computed(() =>
        rootDomain.value ? lookupDomainName(rootDomain.value) : ''
    );

    // 展示优先级：用户记住的名称 > 响应头自报名称 > 本次识别结果
    const effectiveDetectedName = computed(
        () => rememberedName.value || detectedName.value || localDetectedName.value
    );

    const handleDetect = async () => {
        if (detecting.value || !rootDomain.value) return;
        detecting.value = true;
        try {
            const result = await api.post('/api/detect_airport_name', { url: props.misub.url });
            const name = String(result?.name || '').trim();
            if (name) {
                localDetectedName.value = name;
                emit('applyDetectedName', name);
            }
        } catch {
            /* 识别失败静默处理，不影响其他功能 */
        } finally {
            detecting.value = false;
        }
    };

    const protocolStyle = computed(() => {
        const p = protocol.value;
        switch (p) {
            case 'https':
                return {
                    text: 'HTTPS',
                    style: 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20',
                };
            case 'clash':
                return {
                    text: 'CLASH',
                    style: 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20',
                };
            case 'http':
                return {
                    text: 'HTTP',
                    style: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20',
                };
            default:
                return {
                    text: 'SUB',
                    style: 'bg-gray-500/10 text-gray-500 dark:text-gray-400 border border-gray-500/20',
                };
        }
    });

    const trafficInfo = computed(() => {
        const info = props.misub.userInfo;
        const REASONABLE_TRAFFIC_LIMIT_BYTES = 10 * 1024 * 1024 * 1024 * 1024 * 1024; // 10 PB
        if (
            !info ||
            info.total === undefined ||
            info.download === undefined ||
            info.upload === undefined ||
            info.total >= REASONABLE_TRAFFIC_LIMIT_BYTES
        ) {
            return null;
        }
        const total = info.total;
        const used = info.download + info.upload;
        const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
        return {
            used: formatBytes(used),
            total: formatBytes(total),
            percentage: percentage,
        };
    });

    const expiryInfo = computed(() => {
        const expireTimestamp = props.misub.userInfo?.expire;
        if (!expireTimestamp) return null;
        const REASONABLE_EXPIRY_LIMIT_DAYS = 365 * 10;
        const expiryDate = new Date(expireTimestamp * TIMING.SECOND_IN_MS);
        const now = new Date();
        expiryDate.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
        if (diffDays > REASONABLE_EXPIRY_LIMIT_DAYS) {
            return null;
        }
        let style = 'text-gray-500 dark:text-gray-400';
        if (diffDays < 0) style = 'text-red-500 font-bold';
        else if (diffDays <= 7) style = 'text-orange-500 font-semibold';
        return {
            date: expiryDate.toLocaleDateString(),
            daysRemaining:
                diffDays < 0
                    ? t('subscriptions.expired')
                    : diffDays === 0
                      ? t('subscriptions.expiresToday')
                      : t('subscriptions.expiresInDays', { count: diffDays }),
            style: style,
        };
    });

    const normalizeWebsiteUrl = (value) => {
        const website = (value || '').trim();
        if (!website) return null;
        if (/^https?:\/\//i.test(website)) return website;
        return `https://${website}`;
    };

    const websiteUrl = computed(() => {
        const explicitWebsite = normalizeWebsiteUrl(props.misub.website);
        if (explicitWebsite) return explicitWebsite;

        const notes = props.misub.notes;
        if (!notes) return null;
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const matches = notes.match(urlRegex);
        return matches ? matches[0] : null;
    });

    const noteWithoutUrl = computed(() => {
        const notes = props.misub.notes;
        if (!notes) return '';
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return notes.replace(urlRegex, '').trim();
    });

    const hasFooterMeta = computed(() => Boolean(noteWithoutUrl.value || websiteUrl.value));

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const formatFullDateTime = (date) => {
        const pad = (num) => String(num).padStart(2, '0');
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    const formatNodeCacheDisplayTime = (date, now) => {
        const pad = (num) => String(num).padStart(2, '0');
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const targetStart = new Date(year, date.getMonth(), date.getDate());
        const calendarDayDiff = Math.round((todayStart - targetStart) / ONE_DAY_MS);

        if (calendarDayDiff === 0) {
            return timePart;
        }
        if (calendarDayDiff === 1) {
            return `${t('subscriptions.nodeCacheYesterday')} ${timePart}`;
        }
        if (calendarDayDiff === 2) {
            return `${t('subscriptions.nodeCacheDayBeforeYesterday')} ${timePart}`;
        }
        if (calendarDayDiff >= 3 && calendarDayDiff <= 6) {
            return `${t('subscriptions.nodeCacheDaysAgo', { count: calendarDayDiff })} ${timePart}`;
        }
        if (year !== now.getFullYear()) {
            return `${year}-${month}-${day} ${timePart}`;
        }
        return `${month}-${day} ${timePart}`;
    };

    const nodeCacheInfo = computed(() => {
        if (props.misub?.enableNodeCache !== true) return null;

        const raw = props.misub?.nodeCacheUpdatedAt;
        const date = raw ? new Date(raw) : null;
        if (!date || Number.isNaN(date.getTime())) {
            return {
                hasCache: false,
                display: t('subscriptions.nodeCacheEmpty'),
                emptyHint: t('subscriptions.nodeCacheEmptyTooltip'),
                valueClass: 'text-gray-500 dark:text-gray-400',
                dotClass: 'bg-gray-400/70 dark:bg-gray-500',
            };
        }

        const now = new Date();
        const isFresh = now.getTime() - date.getTime() <= ONE_DAY_MS;
        const displayTime = formatNodeCacheDisplayTime(date, now);
        const fullTime = formatFullDateTime(date);
        const rawCount = Number(props.misub?.nodeCacheCount);
        const cachedCount = Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 0;

        return {
            hasCache: true,
            isFresh,
            display: displayTime,
            fullTime,
            cachedCount,
            statusLabel: isFresh
                ? t('subscriptions.nodeCacheFreshStatus')
                : t('subscriptions.nodeCacheStaleStatus'),
            valueClass: isFresh
                ? 'font-medium text-emerald-600 dark:text-emerald-400'
                : 'font-medium text-amber-600 dark:text-amber-400',
            dotClass: isFresh
                ? 'bg-emerald-500 dark:bg-emerald-400'
                : 'bg-amber-500 dark:bg-amber-400',
            badgeClass: isFresh
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
        };
    });
</script>

<template>
    <div
        class="group relative flex h-full min-h-[200px] flex-col overflow-hidden rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary-500/5 sm:p-5 dark:border-white/10 dark:bg-gray-900/70"
        :class="{
            'opacity-75 grayscale-[0.8]': !misub.enabled,
        }"
    >
        <div class="relative z-10 flex flex-col h-full">
            <!-- Header -->
            <!-- 窄屏：徽标独占一行，不再与 4 个操作按钮抢宽度（原先会把徽标压成一字一行） -->
            <div class="mb-3 sm:mb-4">
                <div class="mb-1.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span
                        class="shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        :class="protocolStyle.style"
                    >
                        {{ protocolStyle.text }}
                    </span>
                    <span
                        v-if="autoUpdatePaused"
                        data-testid="subscription-auto-update-paused"
                        class="shrink-0 whitespace-nowrap rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold tracking-tight text-amber-600 dark:text-amber-400"
                        :title="t('subscriptions.autoUpdatePausedHint')"
                    >
                        {{ t('subscriptions.autoUpdatePaused') }}
                    </span>
                    <span
                        v-if="expiryInfo"
                        class="shrink-0 whitespace-nowrap rounded-full border border-transparent bg-gray-100 px-2 py-0.5 text-[10px] font-medium dark:bg-white/5"
                        :class="expiryInfo.style"
                    >
                        {{ expiryInfo.daysRemaining }}
                    </span>
                </div>

                <div class="flex items-start justify-between gap-2 sm:gap-3">
                    <div class="min-w-0 flex-1">
                        <h3
                            class="truncate text-lg font-semibold leading-tight text-gray-900 dark:text-white"
                            :title="misub.name || t('subscriptions.unnamed')"
                        >
                            {{ misub.name || t('subscriptions.unnamed') }}
                        </h3>
                        <!-- 机场识别结果：优先响应头自报名称，其次官网标题。仅作提示，不覆盖用户命名。 -->
                        <div
                            v-if="effectiveDetectedName && effectiveDetectedName !== misub.name"
                            class="mt-1 flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400"
                            :title="t('subscriptions.detectedNameHint')"
                        >
                            <svg
                                class="h-3 w-3 shrink-0"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    fill-rule="evenodd"
                                    d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                                    clip-rule="evenodd"
                                />
                            </svg>
                            <span class="truncate">{{ effectiveDetectedName }}</span>
                            <button
                                type="button"
                                class="shrink-0 text-[11px] font-medium text-primary-500 hover:text-primary-600 dark:text-primary-400"
                                :title="t('subscriptions.applyDetectedName')"
                                @click.stop="emit('applyDetectedName', effectiveDetectedName)"
                            >
                                {{ t('subscriptions.applyDetectedNameShort') }}
                            </button>
                        </div>
                        <!-- 未识别到名称时：提供手动触发识别（抓官网标题），按需请求 -->
                        <div
                            v-else-if="rootDomain && !localDetectedName"
                            class="mt-1 flex items-center gap-1"
                        >
                            <button
                                type="button"
                                class="shrink-0 text-[11px] text-gray-500 hover:text-primary-500 dark:text-gray-400 dark:hover:text-primary-400"
                                :disabled="detecting"
                                :title="t('subscriptions.detectNameHint')"
                                @click.stop="handleDetect"
                            >
                                {{
                                    detecting
                                        ? t('subscriptions.detecting')
                                        : t('subscriptions.detectName')
                                }}
                            </button>
                        </div>
                        <!-- 机场主域名：可点击访问官网 -->
                        <a
                            v-if="rootDomain"
                            :href="`https://${rootDomain}`"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="mt-0.5 inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-primary-500 dark:text-gray-400 dark:hover:text-primary-400"
                            :title="t('subscriptions.visitSite', { domain: rootDomain })"
                            @click.stop
                        >
                            <svg class="h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path
                                    d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"
                                />
                                <path
                                    d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"
                                />
                            </svg>
                            <span class="truncate">{{ rootDomain }}</span>
                        </a>
                    </div>

                    <!-- Action Buttons (Visible on Hover/Touch) -->
                    <!-- 移动端收成紧凑图标组：负外边距抵掉触控留白，避免挤占徽标/标题宽度 -->
                    <div
                        class="-mr-2 -mt-1 flex shrink-0 items-center gap-0 opacity-100 sm:mr-0 sm:gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200"
                    >
                        <button
                            @click.stop="emit('preview')"
                            class="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full p-2 text-gray-500 transition-colors hover:bg-primary-50 hover:text-primary-500 dark:text-gray-400 dark:hover:bg-white/10 sm:min-h-[44px] sm:min-w-[44px] lg:min-h-0 lg:min-w-0"
                            :title="t('actions.previewNodes')"
                            :aria-label="t('actions.previewNodes')"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                stroke-width="2"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                            </svg>
                        </button>
                        <button
                            @click.stop="emit('qrcode')"
                            class="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full p-2 text-gray-500 transition-colors hover:bg-primary-50 hover:text-primary-500 dark:text-gray-400 dark:hover:bg-white/10 sm:min-h-[44px] sm:min-w-[44px] lg:min-h-0 lg:min-w-0"
                            :title="t('actions.showQrCode')"
                            :aria-label="t('actions.showQrCode')"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                stroke-width="1.5"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z"
                                />
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z"
                                />
                            </svg>
                        </button>
                        <button
                            @click.stop="emit('edit')"
                            class="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full p-2 text-gray-500 transition-colors hover:bg-primary-50 hover:text-primary-500 dark:text-gray-400 dark:hover:bg-white/10 sm:min-h-[44px] sm:min-w-[44px] lg:min-h-0 lg:min-w-0"
                            :title="t('actions.edit')"
                            :aria-label="t('actions.edit')"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                stroke-width="2"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z"
                                />
                            </svg>
                        </button>
                        <button
                            @click.stop="emit('delete')"
                            class="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-gray-400 dark:hover:bg-red-500/20 sm:min-h-[44px] sm:min-w-[44px] lg:min-h-0 lg:min-w-0"
                            :title="t('actions.delete')"
                            :aria-label="t('actions.delete')"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                stroke-width="2"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- URL Display -->
            <div class="relative mb-4">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg
                        class="h-3.5 w-3.5 text-gray-500 dark:text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                        />
                    </svg>
                </div>
                <input
                    type="text"
                    :value="misub.url"
                    readonly
                    class="w-full rounded-lg border border-gray-100 bg-gray-50/80 py-2 pl-9 pr-3 font-mono text-xs text-gray-500 transition-all focus:border-primary-500/30 focus:bg-white focus-visible:outline-none dark:border-white/5 dark:bg-black/20 dark:text-gray-400 dark:focus:bg-black/40"
                    :aria-label="t('subscriptions.urlLabel')"
                />
            </div>

            <div
                class="grid gap-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3 dark:border-white/10 dark:bg-white/5"
            >
                <div v-if="trafficInfo" class="space-y-2">
                    <div class="flex items-end justify-between text-xs">
                        <span class="text-gray-500 dark:text-gray-400"
                            >{{ t('subscriptions.usedTraffic') }}
                            <span class="font-semibold text-gray-700 dark:text-gray-200">{{
                                trafficInfo.used
                            }}</span></span
                        >
                        <span class="text-gray-500 dark:text-gray-400">{{
                            trafficInfo.total
                        }}</span>
                    </div>
                    <div
                        class="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"
                    >
                        <div
                            class="h-full rounded-full bg-gradient-to-r from-primary-400 to-cyan-400 transition-all duration-500"
                            :style="{ width: trafficInfo.percentage + '%' }"
                        ></div>
                    </div>
                </div>
                <div v-else class="text-xs text-gray-500 dark:text-gray-400">
                    {{ t('subscriptions.noTrafficData') }}
                </div>
                <div class="flex items-center justify-between text-xs">
                    <span class="text-gray-500 dark:text-gray-400">{{
                        t('subscriptions.nodeCountLabel')
                    }}</span>
                    <span class="font-semibold text-gray-700 dark:text-gray-200">
                        {{
                            misub.isUpdating
                                ? t('subscriptions.updating')
                                : t('subscriptions.nodeCount', { count: misub.nodeCount || 0 })
                        }}
                    </span>
                </div>
                <div
                    v-if="nodeCacheInfo"
                    data-testid="subscription-node-cache-time"
                    class="flex items-center justify-between gap-2 text-xs"
                >
                    <span class="shrink-0 text-gray-500 dark:text-gray-400">{{
                        t('subscriptions.nodeCacheTimeLabel')
                    }}</span>
                    <div
                        data-testid="subscription-node-cache-trigger"
                        class="group/cache relative inline-flex min-w-0 items-center"
                    >
                        <span
                            class="inline-flex min-w-0 items-center gap-1.5 tabular-nums"
                            :class="nodeCacheInfo.valueClass"
                        >
                            <span
                                data-testid="subscription-node-cache-dot"
                                class="h-1.5 w-1.5 shrink-0 rounded-full"
                                :class="nodeCacheInfo.dotClass"
                                aria-hidden="true"
                            ></span>
                            <span data-testid="subscription-node-cache-value" class="truncate">
                                {{ nodeCacheInfo.display }}
                            </span>
                        </span>

                        <div
                            role="tooltip"
                            data-testid="subscription-node-cache-tooltip"
                            class="pointer-events-none invisible absolute bottom-full right-0 z-20 mb-2 w-max max-w-[230px] translate-y-1 rounded-lg border border-gray-200/90 bg-white/95 px-3 py-2 text-[11px] leading-relaxed text-gray-700 opacity-0 shadow-lg backdrop-blur-md transition-all duration-150 group-hover/cache:visible group-hover/cache:translate-y-0 group-hover/cache:opacity-100 dark:border-white/10 dark:bg-gray-900/95 dark:text-gray-200 dark:shadow-black/40"
                        >
                            <template v-if="nodeCacheInfo.hasCache">
                                <div class="flex items-center justify-between gap-2.5">
                                    <span
                                        class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                                        :class="nodeCacheInfo.badgeClass"
                                    >
                                        <span
                                            class="h-1.5 w-1.5 rounded-full"
                                            :class="nodeCacheInfo.dotClass"
                                        ></span>
                                        {{ nodeCacheInfo.statusLabel }}
                                    </span>
                                    <span
                                        v-if="nodeCacheInfo.cachedCount > 0"
                                        class="text-[10px] text-gray-500 dark:text-gray-400"
                                    >
                                        {{
                                            t('subscriptions.nodeCacheTooltipCount', {
                                                count: nodeCacheInfo.cachedCount,
                                            })
                                        }}
                                    </span>
                                </div>
                                <div
                                    class="mt-1.5 font-mono text-[11px] font-medium tabular-nums text-gray-800 dark:text-gray-100"
                                >
                                    {{ nodeCacheInfo.fullTime }}
                                </div>
                            </template>
                            <div v-else class="whitespace-normal text-gray-600 dark:text-gray-300">
                                {{ nodeCacheInfo.emptyHint }}
                            </div>
                            <div
                                class="absolute -bottom-1 right-4 h-2 w-2 rotate-45 border-b border-r border-gray-200/90 bg-white/95 dark:border-white/10 dark:bg-gray-900/95"
                                aria-hidden="true"
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer Actions -->
            <div
                class="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-white/10"
            >
                <Switch v-model="misub.enabled" @change="emit('change')" />

                <div class="flex items-center gap-3">
                    <button
                        @click.stop="emit('update')"
                        :disabled="misub.isUpdating"
                        class="p-1.5 rounded-full hover:bg-primary-50 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-primary-500 transition-colors disabled:opacity-50 touch-target"
                        :title="
                            misub.isUpdating
                                ? t('subscriptions.updating')
                                : t('subscriptions.updateNodeInfo')
                        "
                        :aria-label="
                            misub.isUpdating
                                ? t('subscriptions.updating')
                                : t('subscriptions.updateNodeInfo')
                        "
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="w-4 h-4"
                            :class="{ 'animate-spin text-primary-500': misub.isUpdating }"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fill-rule="evenodd"
                                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                                clip-rule="evenodd"
                            />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Notes / Website -->
            <div
                v-if="hasFooterMeta"
                data-testid="subscription-footer-meta"
                class="mt-3 flex items-center gap-1 truncate text-[10px] text-gray-500 dark:text-gray-400"
            >
                <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                </svg>
                <a
                    v-if="websiteUrl"
                    data-testid="subscription-website-link"
                    :href="websiteUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    @click.stop
                    class="flex items-center gap-0.5 text-primary-500 hover:text-primary-600 font-medium transition-colors cursor-pointer"
                    :title="t('subscriptions.visitWebsite')"
                >
                    {{ t('subscriptions.website') }}
                    <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                    </svg>
                </a>
                <span v-if="noteWithoutUrl" data-testid="subscription-notes" class="truncate">{{
                    noteWithoutUrl
                }}</span>
            </div>
        </div>
    </div>
</template>
