<script setup>
import { ref, computed, onMounted } from 'vue';
import Modal from '../forms/Modal.vue';

const props = defineProps({
    show: Boolean,
    profile: Object,
    clients: Array,
    profileToken: String
});

const emit = defineEmits(['close']);

// 设备检测
const detectedPlatform = ref(null);

const detectPlatform = () => {
    const ua = navigator.userAgent;
    if (/HarmonyOS|OpenHarmony/.test(ua)) return 'HarmonyOS';
    if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    if (/Mac/.test(ua) && !/iPhone|iPad|iPod/.test(ua)) return 'macos';
    if (/Windows/.test(ua)) return 'windows';
    if (/Linux/.test(ua) && !/Android/.test(ua)) return 'linux';
    return null;
};

// URL Scheme 映射表（内置）
const urlSchemeMap = {
    'clash-verge-rev': 'clash://install-config?url={url}&name={name}',
    'clash-party': 'clash://install-config?url={url}&name={name}',
    'clashbox': 'clash://install-config?url={url}&name={name}',
    'v2rayn': 'v2rayng://install-config?url={url}',
    'v2rayng': 'v2rayng://install-config?url={url}',
    'shadowrocket': 'shadowrocket://add/sub://{url_base64}?remark={name}',
    'hiddify': 'hiddify://import/{url}',
    'nekobox': 'nekobox://install-config?name={name}&type=SUBSCRIPTION&url={url}',
    'stash': 'stash://install-config?url={url}&name={name}',
    'loon': 'loon://import?sub={url}&name={name}',
    'egern': 'egern:/profiles/new?name={name}&url={url}',
    'surge': 'surge:///install-config?url={url}',
    'flclash': 'clash://install-config?url={url}&name={name}',
    'clashmi': 'clash://install-config?url={url}&name={name}',
    'flyclash': 'clash://install-config?url={url}&name={name}',
    'karing': 'karing://install-config?url={url}&name={name}',
    'quantumultx': 'quantumult-x:///add-resource?remote-resource={url_encoded}'
};

// 生成订阅链接
const getSubscriptionUrl = () => {
    if (!props.profile) return '';
    const token = props.profileToken || 'profiles';
    const identifier = props.profile.customId || props.profile.id;
    return `${window.location.origin}/${token}/${identifier}`;
};

// 生成深度链接
const generateDeepLink = (client) => {
    const subUrl = getSubscriptionUrl();
    const scheme = urlSchemeMap[client.id];

    if (!scheme) return null;

    return scheme
        .replace('{url}', encodeURIComponent(subUrl))
        .replace('{name}', encodeURIComponent(props.profile?.name || '订阅'))
        .replace('{url_base64}', btoa(subUrl))
        .replace('{url_encoded}', encodeURIComponent(subUrl));
};

// 过滤支持一键导入的客户端
const supportedClients = computed(() => {
    if (!props.clients) return [];
    return props.clients.filter(client => urlSchemeMap[client.id]);
});

// 按平台分组并排序
const groupedClients = computed(() => {
    const platform = detectedPlatform.value;
    const clients = supportedClients.value;

    if (!platform) return clients;

    // 将当前平台的客户端置顶
    const platformClients = clients.filter(c => c.platforms?.includes(platform));
    const otherClients = clients.filter(c => !c.platforms?.includes(platform));

    return [...platformClients, ...otherClients];
});

// 判断客户端是否为推荐（当前平台）
const isRecommended = (client) => {
    return detectedPlatform.value && client.platforms?.includes(detectedPlatform.value);
};

// 处理客户端点击
const handleClientClick = (client) => {
    const deepLink = generateDeepLink(client);
    if (deepLink) {
        window.location.href = deepLink;
    }
};

// 获取平台标签
const getPlatformLabel = (platform) => {
    const map = {
        ios: 'iOS',
        android: 'Android',
        windows: 'Windows',
        macos: 'macOS',
        linux: 'Linux',
        HarmonyOS: 'HarmonyOS'
    };
    return map[platform] || platform;
};

const closeModal = () => {
    emit('close');
};

onMounted(() => {
    detectedPlatform.value = detectPlatform();
});
</script>

<template>
    <Modal :show="show" size="4xl" @update:show="value => !value && closeModal()">
        <template #title>
            <div class="flex items-center justify-between gap-4">
                <div>
                    <h3 class="text-xl font-bold text-gray-900 dark:text-white">
                        选择客户端导入
                    </h3>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        点击客户端图标自动打开应用并导入订阅
                    </p>
                </div>
                <button @click="closeModal"
                    class="w-10 h-10 flex items-center justify-center misub-radius-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div v-if="detectedPlatform"
                class="mt-4 flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 misub-radius-md">
                <svg class="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="text-sm text-indigo-700 dark:text-indigo-300">
                    检测到您的设备为 <strong>{{ getPlatformLabel(detectedPlatform) }}</strong>，已为您优先推荐适配客户端
                </span>
            </div>
        </template>

        <template #body>
            <div v-if="groupedClients.length === 0" class="py-12 text-center text-gray-500 dark:text-gray-400">
                暂无支持一键导入的客户端
            </div>

            <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                <button v-for="client in groupedClients" :key="client.id" @click="handleClientClick(client)"
                    class="group relative flex flex-col items-center gap-3 p-4 misub-radius-lg border-2 transition-all duration-200 hover:scale-105 hover:shadow-lg"
                    :class="isRecommended(client)
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-600 ring-2 ring-indigo-500/20'
                        : 'bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:border-indigo-200 dark:hover:border-indigo-700'">
                    <div v-if="isRecommended(client)"
                        class="absolute -top-2 -right-2 px-2 py-0.5 bg-indigo-500 text-white text-[10px] font-bold rounded-full shadow-lg">
                        推荐
                    </div>
                    <div class="w-14 h-14 misub-radius-lg flex items-center justify-center text-3xl bg-gray-50 dark:bg-gray-800 overflow-hidden"
                        :class="isRecommended(client) ? 'ring-2 ring-indigo-400' : ''">
                        <img v-if="client.icon && (client.icon.includes('/') || client.icon.startsWith('data:'))" :src="client.icon"
                            :alt="client.name" class="w-full h-full object-cover rounded-lg p-1" />
                        <span v-else>{{ client.icon }}</span>
                    </div>
                    <div class="text-center">
                        <div class="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
                            {{ client.name }}
                        </div>
                        <div class="mt-1 flex flex-wrap justify-center gap-1">
                            <span v-for="platform in client.platforms?.slice(0, 2)" :key="platform"
                                class="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                                {{ getPlatformLabel(platform) }}
                            </span>
                        </div>
                    </div>
                </button>
            </div>
        </template>

        <template #footer>
            <div class="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-700/30 dark:text-gray-400">
                <div class="flex items-start gap-3">
                    <svg class="w-5 h-5 shrink-0 mt-0.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <p class="font-medium text-gray-700 dark:text-gray-300">使用提示：</p>
                        <ul class="mt-1 space-y-1 list-disc list-inside">
                            <li>请确保您已安装对应的客户端应用</li>
                            <li>点击后将自动打开客户端并添加订阅</li>
                            <li>部分浏览器可能需要您手动确认打开应用</li>
                            <li class="font-medium text-amber-600 dark:text-amber-400">若安装了多个同类软件，系统将调用默认关联的程序打开</li>
                        </ul>
                    </div>
                </div>
            </div>
        </template>
    </Modal>
</template>
