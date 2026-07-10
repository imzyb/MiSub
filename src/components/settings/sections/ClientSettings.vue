<script setup>
import { ref, onMounted, computed } from 'vue';
import { useI18n } from '../../../i18n/index.js';
import { useToastStore } from '../../../stores/toast';
import Modal from '../../forms/Modal.vue';
import { api } from '../../../lib/http.js';
import SectionHeader from '../SectionHeader.vue';

const clients = ref([]);
const loading = ref(false);
const { showToast } = useToastStore();
const { t } = useI18n();

const showEditModal = ref(false);
const editingClient = ref({});
const isNew = ref(false);
const saving = ref(false);
const ordering = ref(false);
const iconFileInput = ref(null);
const uploadingIcon = ref(false);
const isDataIcon = computed(() => {
    const icon = editingClient.value?.icon;
    return typeof icon === 'string' && icon.startsWith('data:');
});
const iconInputValue = computed({
    get() {
        const icon = editingClient.value?.icon;
        if (!icon || (typeof icon === 'string' && icon.startsWith('data:'))) return '';
        return icon;
    },
    set(value) {
        editingClient.value = {
            ...editingClient.value,
            icon: value
        };
    }
});

const platformOptions = [
    { value: 'windows', label: 'windows', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200' },
    { value: 'macos', label: 'macOS', class: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
    { value: 'linux', label: 'linux', class: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200' },
    { value: 'android', label: 'android', class: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' },
    { value: 'ios', label: 'iOS', class: 'bg-gray-800 text-white dark:bg-white dark:text-gray-900' },
    { value: 'HarmonyOS', label: 'harmonyOS', class: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' }
];

const handleIconFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        showToast(t('settings.clientIconInvalidType'), 'error');
        return;
    }

    const maxSize = 200 * 1024;
    if (file.size > maxSize) {
        showToast(t('settings.clientIconTooLarge'), 'error');
        return;
    }

    uploadingIcon.value = true;
    const reader = new FileReader();
    reader.onload = (e) => {
        const result = e.target?.result;
        if (result) {
            editingClient.value = {
                ...editingClient.value,
                icon: result
            };
        }
        uploadingIcon.value = false;
    };
    reader.onerror = () => {
        showToast(t('settings.clientIconReadFailed'), 'error');
        uploadingIcon.value = false;
    };
    reader.readAsDataURL(file);

    event.target.value = '';
};

const triggerIconFileSelect = () => {
    iconFileInput.value?.click();
};

const clearIcon = () => {
    editingClient.value = {
        ...editingClient.value,
        icon: ''
    };
};

const fetchClients = async () => {
    loading.value = true;
    try {
        const data = await api.get('/api/clients');
        if (data.success) {
            clients.value = data.data || [];
        } else {
            showToast(t('settings.clientFetchFailed'), 'error');
        }
    } catch (e) {
        showToast(t('settings.networkError'), 'error');
    } finally {
        loading.value = false;
    }
};

const showResetConfirm = ref(false);

const handleInit = () => {
    showResetConfirm.value = true;
};

const executeReset = async () => {
    loading.value = true;
    try {
        const data = await api.post('/api/clients/init');
        if (data.success) {
            clients.value = data.data;
            showToast(t('settings.clientResetSuccess'), 'success');
        }
    } catch (e) {
        showToast(t('settings.clientResetFailed'), 'error');
    } finally {
        loading.value = false;
    }
};

const handleAdd = () => {
    isNew.value = true;
    editingClient.value = {
        id: '',
        name: '',
        icon: '',
        description: '',
        platforms: [],
        url: '',
        repo: ''
    };
    showEditModal.value = true;
};

const handleEdit = (client) => {
    isNew.value = false;
    editingClient.value = JSON.parse(JSON.stringify(client));
    if (!editingClient.value.platforms) editingClient.value.platforms = [];
    showEditModal.value = true;
};

const saveClientOrder = async () => {
    ordering.value = true;
    try {
        const data = await api.post('/api/clients', clients.value);
        if (data.success) {
            clients.value = data.data;
            showToast(t('settings.clientOrderSaved'), 'success');
        } else {
            showToast(data.message || t('settings.clientOrderSaveFailed'), 'error');
        }
    } catch (e) {
        showToast(t('settings.clientOrderSaveFailedWithMessage', { message: e.message }), 'error');
    } finally {
        ordering.value = false;
    }
};

const moveClient = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= clients.value.length) return;
    const next = [...clients.value];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    clients.value = next;
    await saveClientOrder();
};

const handleSave = async () => {
    if (!editingClient.value.name) return showToast(t('settings.clientNameRequired'), 'error');

    saving.value = true;
    try {
        const data = await api.post('/api/clients', editingClient.value);
        if (data.success) {
            showToast(t('settings.clientSaveSuccess'), 'success');
            showEditModal.value = false;
            // Update local list (server returns full list or we refetch)
            // API handler currently returns full list
            clients.value = data.data;
        } else {
            showToast(data.message || t('settings.clientSaveFailed'), 'error');
        }
    } catch (e) {
        showToast(t('settings.clientSaveFailedWithMessage', { message: e.message }), 'error');
    } finally {
        saving.value = false;
    }
};

const showDeleteConfirm = ref(false);
const clientToDeleteId = ref(null);

const handleDelete = (id) => {
    clientToDeleteId.value = id;
    showDeleteConfirm.value = true;
};

const executeDelete = async () => {
    if (!clientToDeleteId.value) return;
    try {
        const data = await api.del(`/api/clients?id=${clientToDeleteId.value}`);
        if (data.success) {
            clients.value = data.data;
            showToast(t('settings.clientDeleted'), 'success');
            showDeleteConfirm.value = false;
        }
    } catch (e) {
        showToast(t('settings.clientDeleteFailed'), 'error');
    }
};

const getPlatformClass = (platform) => {
    const option = platformOptions.find(opt => opt.value === platform);
    return option ? option.class : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
};

onMounted(fetchClients);
</script>

<template>
    <div class="space-y-6">
        <div class="rounded-xl border border-gray-100/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-gray-900/70">
            <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <SectionHeader :title="t('settings.clientManagerTitle')" :description="t('settings.clientManagerDesc')" tone="blue">
                    <template #icon>
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1-3m1.75 0h3.5M12 3v14m0 0l3-3m-3 3l-3-3" />
                        </svg>
                    </template>
                </SectionHeader>
            <div class="flex gap-2 w-full md:w-auto">
                <button @click="handleInit"
                    class="flex-1 md:flex-none px-3 py-1.5 text-center text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 misub-radius-lg border border-gray-300 dark:border-gray-600">{{ t('settings.clientResetDefault') }}</button>
                <button @click="handleAdd"
                    class="flex-1 md:flex-none px-4 py-2 text-center text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 misub-radius-lg shadow-sm shadow-primary-500/20">{{ t('settings.clientAdd') }}</button>
            </div>
        </div>
        </div>

        <div v-if="loading" class="text-center py-8 text-gray-500">{{ t('common.loading') }}</div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="(client, index) in clients" :key="client.id"
                class="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 misub-radius-lg p-4 hover:shadow-md transition-shadow group">

                <div class="flex items-start gap-3 min-w-0">
                    <div
                        class="h-12 w-12 misub-radius-lg flex items-center justify-center text-2xl shrink-0 bg-gray-50 dark:bg-gray-700/50 text-gray-600 overflow-hidden ring-1 ring-gray-200/60 dark:ring-white/10">
                        <img v-if="client.icon && (client.icon.includes('/') || client.icon.startsWith('data:'))" :src="client.icon" :alt="client.name"
                            class="w-full h-full object-cover rounded-lg p-1" />
                        <span v-else>{{ client.icon }}</span>
                    </div>
                    <div class="min-w-0 flex-1">
                        <h4 class="font-bold text-gray-900 dark:text-white truncate pr-1">{{ client.name }}</h4>
                        <p class="text-xs text-gray-500 truncate">{{ client.description }}</p>
                        <div class="flex flex-wrap gap-1 mt-2">
                            <span v-for="p in client.platforms" :key="p" class="px-1.5 py-0.5 text-[10px] rounded"
                                :class="getPlatformClass(p)">
                                {{platformOptions.find(opt => opt.value === p)?.label || p}}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="mt-4 grid grid-cols-2 sm:flex sm:flex-wrap gap-2 border-t border-gray-100 dark:border-gray-700 pt-3">
                    <button @click.stop="moveClient(index, -1)"
                        :disabled="ordering || index === 0"
                        class="flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-40">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            stroke-width="1.6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                        <span>{{ t('actions.moveUp') }}</span>
                    </button>
                    <button @click.stop="moveClient(index, 1)"
                        :disabled="ordering || index === clients.length - 1"
                        class="flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-40">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            stroke-width="1.6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                        <span>{{ t('actions.moveDown') }}</span>
                    </button>
                    <button @click.stop="handleEdit(client)"
                        class="flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>{{ t('actions.edit') }}</span>
                    </button>
                    <button @click.stop="handleDelete(client.id)"
                        class="flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-red-50 dark:bg-red-900/30 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>{{ t('actions.delete') }}</span>
                    </button>
                </div>
            </div>
        </div>

        <Modal v-model:show="showEditModal" :title="isNew ? t('settings.clientAddModalTitle') : t('settings.clientEditModalTitle')" size="5xl">
            <template #body>
                <div class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-8">
                        <!-- Left Column: Visual Identity (30-40%) -->
                        <div class="md:col-span-5 lg:col-span-4">
                            <div
                                class="bg-gray-50 dark:bg-gray-700/30 misub-radius-lg p-6 flex flex-col items-center gap-8 h-full border border-gray-100 dark:border-gray-700/50">
                                <div class="text-center space-y-3 w-full">
                                    <label
                                        class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.clientIconPreview') }}</label>
                                    <div
                                        class="aspect-square w-full max-w-[180px] mx-auto misub-radius-lg flex items-center justify-center text-6xl bg-white dark:bg-gray-800 text-gray-600 border-2 border-dashed border-gray-200 dark:border-gray-600 overflow-hidden shadow-sm">
                                        <img v-if="editingClient.icon && (editingClient.icon.includes('/') || editingClient.icon.startsWith('data:'))"
                                            :src="editingClient.icon" :alt="editingClient.name"
                                            class="w-full h-full object-cover rounded-lg p-1" />
                                        <span v-else>{{ editingClient.icon || '?' }}</span>
                                    </div>
                                </div>

                                <div class="w-full space-y-4 mt-2">
                                    <div class="space-y-2">
                                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.clientLocalIcon') }}</label>
                                        <input
                                            ref="iconFileInput"
                                            type="file"
                                            accept="image/svg+xml,image/png,image/jpeg,image/gif,image/webp"
                                            class="hidden"
                                            @change="handleIconFileSelect"
                                        >
                                        <div class="flex gap-2 justify-center">
                                            <button @click="triggerIconFileSelect" type="button"
                                                class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                                                :disabled="uploadingIcon">
                                                <svg v-if="!uploadingIcon" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                </svg>
                                                <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                <span>{{ uploadingIcon ? t('settings.clientUploading') : t('settings.clientUploadImage') }}</span>
                                            </button>
                                            <button v-if="editingClient.icon" @click="clearIcon" type="button"
                                                class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 misub-radius-md hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors">
                                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                <span>{{ t('actions.clearAll') }}</span>
                                            </button>
                                        </div>
                                        <p class="text-xs text-center text-gray-400 dark:text-gray-500">{{ t('settings.clientIconSupportHint') }}</p>
                                        <p v-if="isDataIcon" class="text-xs text-center text-gray-500 dark:text-gray-400">{{ t('settings.clientUsingLocalIcon') }}</p>
                                    </div>
                                    <div class="space-y-2">
                                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">URL / Emoji</label>
                                        <div class="relative misub-radius-md shadow-sm">
                                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <span class="text-gray-500 sm:text-sm">🔗</span>
                                            </div>
                                            <input v-model="iconInputValue" type="text" :placeholder="t('settings.clientIconPlaceholder')"
                                                class="block w-full pl-10 pr-3 misub-radius-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5">
                                        </div>
                                        <p class="text-xs text-center text-gray-400 dark:text-gray-500">{{ t('settings.clientIconInputHint') }}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Right Column: Form Details (60-70%) -->
                        <div class="md:col-span-7 lg:col-span-8 flex flex-col gap-6">
                            <!-- Basic Info -->
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.clientName') }}
                                        <span class="text-red-500">*</span></label>
                                    <input v-model="editingClient.name" type="text"
                                        class="mt-1 block w-full misub-radius-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2.5 text-lg font-medium"
                                        :placeholder="t('settings.clientNamePlaceholder')">
                                </div>

                                <div>
                                    <label
                                        class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.clientDescription') }}</label>
                                    <textarea v-model="editingClient.description" rows="3"
                                        class="mt-1 block w-full misub-radius-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-3 resize-none"
                                        :placeholder="t('settings.clientDescriptionPlaceholder')"></textarea>
                                </div>
                            </div>

                            <!-- Platforms Grid -->
                            <div>
                                <label
                                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.clientPlatforms') }}</label>
                                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                    <label v-for="opt in platformOptions" :key="opt.value"
                                        class="cursor-pointer group relative flex flex-col items-center justify-center p-3 misub-radius-lg border transition-all duration-200 select-none text-center"
                                        :class="editingClient.platforms.includes(opt.value)
                                            ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-500/50 text-indigo-700 dark:text-indigo-300 shadow-sm ring-1 ring-indigo-500/20'
                                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'">
                                        <input type="checkbox" :value="opt.value" v-model="editingClient.platforms"
                                            class="hidden">
                                        <span class="text-sm font-medium">{{ opt.label }}</span>
                                        <div v-if="editingClient.platforms.includes(opt.value)"
                                            class="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full"></div>
                                    </label>
                                </div>
                            </div>

                            <!-- Links -->
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.clientDownloadUrl') }}</label>
                                    <div class="mt-1 flex misub-radius-md shadow-sm">
                                        <span
                                            class="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-500 sm:text-sm">🔗</span>
                                        <input v-model="editingClient.url" type="text"
                                            class="flex-1 min-w-0 block w-full px-3 py-2.5 rounded-none rounded-r-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                            placeholder="https://...">
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">GitHub
                                        Repo</label>
                                    <div class="mt-1 flex misub-radius-md shadow-sm">
                                        <span
                                            class="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-500 sm:text-sm">
                                            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                                <path fill-rule="evenodd"
                                                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                                                    clip-rule="evenodd" />
                                            </svg>
                                        </span>
                                        <input v-model="editingClient.repo" type="text"
                                            class="flex-1 min-w-0 block w-full px-3 py-2.5 rounded-none rounded-r-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                            placeholder="owner/repo">
                                    </div>
                                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.clientRepoHint') }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
            <template #footer>
                <div class="flex justify-end gap-3">
                    <button @click="showEditModal = false"
                        class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 misub-radius-md hover:bg-gray-50 dark:hover:bg-gray-700">{{ t('actions.cancel') }}</button>
                    <button @click="handleSave" :disabled="saving"
                        class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent misub-radius-md hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                        {{ saving ? t('settings.saving') : t('actions.save') }}
                    </button>
                </div>
            </template>
        </Modal>

        <!-- Reset Confirmation Modal -->
        <Modal v-model:show="showResetConfirm" @confirm="executeReset" :title="t('settings.clientResetConfirmTitle')" :confirmText="t('settings.clientResetConfirmAction')" :cancelText="t('actions.cancel')"
            size="sm">
            <template #body>
                <div class="space-y-3">
                    <div
                        class="flex items-center gap-3 text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 p-3 misub-radius-md border border-amber-100 dark:border-amber-900/30">
                        <svg class="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p class="text-sm font-medium">{{ t('settings.clientDangerWarning') }}</p>
                    </div>
                    <p class="text-gray-600 dark:text-gray-300">
                        {{ t('settings.clientResetConfirmQuestion') }}
                        <br>
                        {{ t('settings.clientResetConfirmDesc') }}
                    </p>
                </div>
            </template>
        </Modal>

        <!-- Delete Confirmation Modal -->
        <Modal v-model:show="showDeleteConfirm" @confirm="executeDelete" :title="t('settings.clientDeleteConfirmTitle')" :confirmText="t('settings.clientDeleteConfirmAction')" :cancelText="t('actions.cancel')"
            size="sm">
            <template #body>
                <div class="space-y-3">
                    <div
                        class="flex items-center gap-3 text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-900/20 p-3 misub-radius-md border border-red-100 dark:border-red-900/30">
                        <svg class="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p class="text-sm font-medium">{{ t('settings.clientDangerWarning') }}</p>
                    </div>
                    <p class="text-gray-600 dark:text-gray-300">
                        {{ t('settings.clientDeleteConfirmQuestion') }}
                    </p>
                </div>
            </template>
        </Modal>
    </div>
</template>
