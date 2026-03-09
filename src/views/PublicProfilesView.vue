<script setup>
import { ref, onMounted, defineAsyncComponent, nextTick, computed } from 'vue';
import { useToastStore } from '../stores/toast.js';
import QRCode from 'qrcode';
import { api } from '../lib/http.js';
import ProfileGrid from '../components/public/ProfileGrid.vue';
import BaseIcon from '../components/ui/BaseIcon.vue';

const isDev = import.meta.env.DEV;

const NodePreviewModal = defineAsyncComponent(() => import('../components/modals/NodePreview/NodePreviewModal.vue'));
const AnnouncementCard = defineAsyncComponent(() => import('../components/features/AnnouncementCard.vue'));
const GuestbookModal = defineAsyncComponent(() => import('../components/modals/GuestbookModal.vue'));
const QuickImportModal = defineAsyncComponent(() => import('../components/modals/QuickImportModal.vue'));

const publicProfiles = ref([]);
const loading = ref(true);
const error = ref(null);
const { showToast } = useToastStore();
const config = ref({});
const announcement = computed(() => config.value.announcement);
const heroConfig = computed(() => config.value.hero || {
    title1: '发现',
    title2: '优质订阅',
    description: '浏览并获取由管理员分享的精选订阅组合，一键导入到您的客户端。'
});
const guestbookConfig = computed(() => config.value.guestbook || {});

const showGuestbookModal = ref(false);
const showQuickImportModal = ref(false);
const selectedProfileForImport = ref(null);

const handleGuestbookTrigger = () => {
    if (guestbookConfig.value && guestbookConfig.value.enabled === false) {
        showToast('留言板功能已关闭', 'warning');
        return;
    }
    showGuestbookModal.value = true;
};

const fetchPublicProfiles = async () => {
    try {
        loading.value = true;
        const data = await api.get('/api/public/profiles');
        if (data.success) {
            publicProfiles.value = data.data;
            config.value = data.config || {};
        } else {
            error.value = data.message || '获取数据失败';
        }
    } catch (err) {
        error.value = err.message;
        console.error('Fetch error:', err);
    } finally {
        loading.value = false;
    }
};

const copyLink = async (profile) => {
    const token = config.value.profileToken || 'profiles';
    const identifier = profile.customId || profile.id;
    const link = `${window.location.origin}/${token}/${identifier}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(link);
            showToast('订阅链接已复制', 'success');
        } catch (e) {
            showToast('复制失败，请手动复制', 'error');
        }
    } else {
        const textArea = document.createElement("textarea");
        textArea.value = link;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showToast('订阅链接已复制', 'success');
        } catch (err) {
            showToast('复制失败，请手动复制', 'error');
        }
        document.body.removeChild(textArea);
    }
};

const clients = ref([]);

const fetchClients = async () => {
    try {
        const data = await api.get('/api/clients');
        if (data.success && data.data && data.data.length > 0) {
            clients.value = data.data;
        }
    } catch (e) {
        console.error('Failed to fetch clients', e);
    }
};

const fetchClientVersions = async () => {
    clients.value.forEach(async (client) => {
        if (!client.repo) return;
        try {
            const data = await api.get(`/api/github/release?repo=${client.repo}`);
            if (data && data.tag_name) {
                client.version = data.tag_name;
            }
        } catch (e) {
            console.warn(`Failed to fetch version for ${client.name}`, e);
        }
    });
};

const getPlatformLabel = (p) => {
    const map = {
        windows: 'Windows',
        macos: 'macOS',
        linux: 'Linux',
        android: 'Android',
        ios: 'iOS'
    };
    return map[p] || p;
};

const showPreviewModal = ref(false);
const previewProfileId = ref(null);
const previewProfileName = ref('');

const handlePreview = (profile) => {
    previewProfileId.value = profile.id; 
    previewProfileName.value = profile.name;
    showPreviewModal.value = true;
};

const handleQuickImport = (profile) => {
    selectedProfileForImport.value = profile;
    showQuickImportModal.value = true;
};

// QR Code in Card
const expandedQRCards = ref(new Set());
const qrCanvasRefs = ref({});

const registerQrCanvas = (profileId, canvas) => {
    if (!canvas) return;
    qrCanvasRefs.value[profileId] = canvas;
};

const toggleQRCode = async (profile) => {
    const profileId = profile.id;
    if (expandedQRCards.value.has(profileId)) {
        expandedQRCards.value.delete(profileId);
    } else {
        expandedQRCards.value.add(profileId);
        await nextTick();
        const canvas = qrCanvasRefs.value[profileId];
        if (canvas) {
            const token = config.value.profileToken || 'profiles';
            const identifier = profile.customId || profile.id;
            const link = `${window.location.origin}/${token}/${identifier}`;
            try {
                await QRCode.toCanvas(canvas, link, {
                    width: 200,
                    margin: 2,
                    color: { dark: '#000000', light: '#FFFFFF' }
                });
            } catch (err) {
                console.error('Failed to generate QR code:', err);
            }
        }
    }
};

const isQRExpanded = (profileId) => expandedQRCards.value.has(profileId);

const downloadQRCode = (profile) => {
    const canvas = qrCanvasRefs.value[profile.id];
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${profile.name || 'subscription'}-qrcode.png`;
    link.href = url;
    link.click();
    showToast('二维码已下载', 'success');
};

const getPlatformStyle = (p) => {
    const map = {
        windows: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30',
        macos: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300 border border-slate-200 dark:border-slate-500/30',
        linux: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300 border border-orange-200 dark:border-orange-500/30',
        android: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300 border border-green-200 dark:border-green-500/30',
        HarmonyOS: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300 border border-red-200 dark:border-red-500/30',
        ios: 'bg-gray-800 text-white dark:bg-white dark:text-gray-900 border border-gray-700 dark:border-gray-200'
    };
    return map[p] || 'bg-gray-100 text-gray-800 border border-gray-200';
};

const ICONS = {
    feedback: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
    error: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    empty: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2-2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
    download: 'M17 8l4 4m0 0l-4 4m4-4H3'
};

onMounted(async () => {
    fetchPublicProfiles();
    await fetchClients();
    fetchClientVersions();
});
</script>

<template>
    <div class="min-h-screen bg-transparent transition-colors duration-500 selection:bg-primary-500/30 selection:text-white relative">
        
        <!-- Hero Section (Left Aligned & Open) -->
        <div class="relative pt-10 pb-10 lg:pt-16 lg:pb-14 z-10 overflow-visible">
            <div class="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative">
                <!-- Left Content: Text (Wider column for no-wrap) -->
                <div class="text-left relative z-20 lg:col-span-12 xl:col-span-12">
                    <!-- Badge -->
                    <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary-200/50 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-md mb-8 shadow-sm animate-fade-in-up">
                        <span class="relative flex h-2 w-2">
                          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                          <span class="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                        </span>
                        <span class="text-xs font-bold text-primary-700 dark:text-primary-300 tracking-widest uppercase">Cosmic Selection</span>
                    </div>

                    <h1 class="text-4xl sm:text-6xl lg:text-8xl font-black tracking-tight leading-[1.1] mb-8 animate-fade-in-up delay-100 break-words">
                        <span class="block text-gray-900 dark:text-white drop-shadow-sm">
                            {{ heroConfig.title1 }}
                        </span>
                        <span class="block text-3xl sm:text-5xl lg:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-primary-600 via-purple-500 to-indigo-500 dark:from-primary-400 dark:via-purple-400 dark:to-indigo-400 bg-[length:200%_auto] animate-gradient pb-2 mt-2">
                            {{ heroConfig.title2 }}
                        </span>
                    </h1>
                    
                    <p class="text-base md:text-lg text-gray-500 dark:text-gray-400 leading-relaxed font-medium max-w-5xl mb-10 animate-fade-in-up delay-200 break-words">
                        {{ heroConfig.description }}
                    </p>
                </div>

                <!-- Right Content: Top-Right Concentric Circles (Bottom-Left Quadrant) -->
                <!-- -mt-20 lg:-mt-32 pulls it up to the very top edge, countering the parent's padding -->

            </div>
        </div>

            <!-- Guestbook Trigger (Fixed) -->
            <div class="fixed bottom-24 md:bottom-6 right-6 z-50">
                <button @click="handleGuestbookTrigger"
                    class="group flex items-center gap-2 px-5 py-3 bg-white dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-full shadow-lg hover:shadow-xl border border-gray-200 dark:border-gray-700 transition-all duration-300 hover:-translate-y-1">
                    <BaseIcon :path="ICONS.feedback" className="w-5 h-5 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                    <span class="font-medium">反馈建议</span>
                </button>
            </div>

        <!-- Content Section -->
        <div class="relative z-20 pb-24">
            
            <!-- Subscription Section -->
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <!-- Announcement Section -->
                <AnnouncementCard v-if="announcement && announcement.enabled" :announcement="announcement" class="mb-10" />

                <!-- Loading State -->
                <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div v-for="i in 6" :key="i"
                        class="h-[300px] bg-white dark:bg-gray-800 misub-radius-lg p-6 shadow-sm border border-gray-100 dark:border-gray-700 animate-pulse">
                        <div class="flex items-center gap-4 mb-6">
                            <div class="h-12 w-12 bg-gray-200 dark:bg-gray-700 misub-radius-lg"></div>
                            <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                        </div>
                        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-3"></div>
                        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 mb-8"></div>
                        <div class="mt-auto h-12 bg-gray-100 dark:bg-gray-700/50 misub-radius-lg"></div>
                    </div>
                </div>

                <!-- Error State -->
                <div v-else-if="error" class="text-center py-20 bg-white/50 dark:bg-gray-800/50 misub-radius-lg border border-red-100 dark:border-red-900/30 backdrop-blur-sm">
                    <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-50 dark:bg-red-900/20 mb-6">
                        <BaseIcon :path="ICONS.error" className="w-10 h-10 text-red-500 dark:text-red-400" />
                    </div>
                    <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">加载失败</h3>
                    <p class="text-gray-500 dark:text-gray-400 mb-6">{{ error }}</p>
                    <button @click="fetchPublicProfiles"
                        class="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium misub-radius-lg shadow-lg shadow-primary-600/20 transition-all active:scale-95">
                        重试
                    </button>
                </div>

                <!-- Empty State -->
                <div v-else-if="publicProfiles.length === 0" class="text-center py-32 bg-white/50 dark:bg-gray-800/50 misub-radius-lg border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm">
                    <div class="inline-flex items-center justify-center w-24 h-24 misub-radius-lg bg-gray-50 dark:bg-gray-700/50 mb-6 transform rotate-3">
                        <BaseIcon :path="ICONS.empty" className="w-12 h-12 text-gray-400" />
                    </div>
                    <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">暂无公开订阅</h3>
                    <p class="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                        管理员暂时没有分享任何公开订阅组，请稍后再来看看。
                    </p>
                </div>

                <!-- Profile Grid -->
                <div v-else class="animate-fade-in-up delay-300">
                    <ProfileGrid :profiles="publicProfiles" :is-qr-expanded="isQRExpanded"
                        :profile-token="config.profileToken || 'profiles'" @quick-import="handleQuickImport"
                        @toggle-qr="toggleQRCode" @preview="handlePreview" @copy-link="copyLink" @download-qr="downloadQRCode"
                        @register-canvas="registerQrCanvas" />
                </div>
            </div>

            <!-- Clients Section (Visually Separated) -->
            <div class="mt-16 pt-12 pb-10 border-t border-transparent bg-transparent dark:bg-transparent backdrop-blur-sm">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="text-center mb-16 relative">
                        <div class="relative inline-flex flex-col items-center">
                            <span class="text-sm font-bold tracking-widest text-primary-600 dark:text-primary-400 uppercase mb-2">Essential Tools</span>
                            <h2 class="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                                必备客户端
                            </h2>
                            <p class="mt-4 text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                                为了获得最佳体验，请下载我们推荐的客户端软件。覆盖全平台，简单易用。
                            </p>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                        <div v-for="client in clients" :key="client.name"
                            class="group relative glass-panel dark:bg-white/5 backdrop-blur-2xl rounded-[2rem] p-6 shadow-xl border border-white/40 dark:border-white/5 hover:border-primary-500/30 transition-all duration-300 hover:shadow-primary-500/5">
                            
                            <div class="flex items-start gap-5">
                                <div class="h-12 w-12 misub-radius-lg flex items-center justify-center text-3xl shadow-sm bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 group-hover:scale-105 transition-transform duration-300 shrink-0 overflow-hidden">
                                    <img v-if="client.icon && client.icon.includes('/')" :src="client.icon"
                                        :alt="client.name" class="w-full h-full object-contain" />
                                    <span v-else>{{ client.icon }}</span>
                                </div>
                                
                                <div class="flex-1 min-w-0 pt-1">
                                    <div class="flex items-center justify-between mb-2">
                                        <h3 class="text-lg font-bold text-gray-900 dark:text-white truncate">
                                            {{ client.name }}
                                        </h3>
                                    </div>
                                    <div class="flex flex-wrap gap-1 mb-2">
                                        <span v-for="platform in client.platforms" :key="platform"
                                            class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border"
                                            :class="{
                                                'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/50': platform === 'windows',
                                                'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700/50 dark:text-gray-300 dark:border-gray-600': platform === 'macos' || platform === 'ios',
                                                'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/50': platform === 'android',
                                                'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-900/50': platform === 'linux'
                                            }">
                                            {{ getPlatformLabel(platform) }}
                                        </span>
                                    </div>
                                    <p class="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 leading-relaxed h-12">
                                        {{ client.description }}
                                    </p>
                                </div>
                            </div>

                            <div class="mt-6 flex items-center justify-between pt-4 border-t border-gray-50 dark:border-white/5">
                                <span v-if="client.version" class="text-xs font-mono text-gray-400 bg-gray-50 dark:bg-white/5 px-2 py-1 misub-radius-md">
                                    {{ client.version }}
                                </span>
                                <span v-else class="text-xs text-gray-400">稳定版</span>

                                <a :href="client.url" target="_blank"
                                    class="text-sm font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1 group/link">
                                    获取下载
                                    <BaseIcon :path="ICONS.download" className="w-4 h-4 transform group-hover/link:translate-x-0.5 transition-transform" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>

        <!-- Modals -->
        <NodePreviewModal v-if="showPreviewModal" :show="showPreviewModal" @update:show="showPreviewModal = $event"
            :profile-id="previewProfileId" :profile-name="previewProfileName" api-endpoint="/api/public/preview" />

        <GuestbookModal :show="showGuestbookModal" :config="guestbookConfig" @close="showGuestbookModal = false" />

        <QuickImportModal :show="showQuickImportModal" :profile="selectedProfileForImport" :clients="clients"
            :profile-token="config.profileToken || 'profiles'" @close="showQuickImportModal = false" />
    </div>
</template>

<style scoped>


/* Entrance Animations */
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.animate-fade-in-up {
    animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    opacity: 0;
}

.delay-100 { animation-delay: 100ms; }
.delay-200 { animation-delay: 200ms; }
.delay-300 { animation-delay: 300ms; }

/* Custom Scrollbar for nicer feel */
::-webkit-scrollbar {
    width: 6px;
}

::-webkit-scrollbar-track {
    background: transparent;
}

::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
}

.dark ::-webkit-scrollbar-thumb {
    background: #475569;
}

.dark ::-webkit-scrollbar-thumb:hover {
    background: #64748b;
}
</style>
