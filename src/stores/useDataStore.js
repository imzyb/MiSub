import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useToastStore } from './toast';
import { useSettingsStore } from './settings';
import { useEditorStore } from './editor';
import { createStorageCache } from '../utils/cache-helper.js';
import { DEFAULT_SETTINGS } from '../constants/default-settings.js';
import { TIMING } from '../constants/timing.js';
import { api } from '../lib/http.js';

const isDev = import.meta.env.DEV;

// Initialize Cache
const dataCache = createStorageCache('misub_data_cache', TIMING.CACHE_TTL_MS);

export const useDataStore = defineStore('data', () => {
    const { showToast } = useToastStore();
    const settingsStore = useSettingsStore();
    const editorStore = useEditorStore();

    // --- State ---
    const subscriptions = ref([]);
    const profiles = ref([]);
    const settings = computed(() => settingsStore.config);

    // Store Status
    const isLoading = ref(false);
    const saveState = ref('idle');
    const lastUpdated = ref(null);
    const hasDataLoaded = computed(() => !!lastUpdated.value);

    // Derived Dirty State (from Editor)
    const isDirty = computed(() => editorStore.isDirty);

    // --- Getters ---
    const activeSubscriptions = computed(() => subscriptions.value.filter(sub => sub.enabled));
    const activeProfiles = computed(() => profiles.value.filter(profile => profile.enabled));

    // --- Internal: Snapshot for rollback/diffing ---
    let lastSavedData = {
        subscriptions: [],
        profiles: []
    };

    // --- Actions ---

    // Data Hydration (avoid re-fetching if passed from outside)
    function hydrateFromData(data) {
        if (!data) return false;

        try {
            const cleanSubs = (data.misubs || []).map(sub => ({ ...sub, isUpdating: false }));
            subscriptions.value = cleanSubs;
            profiles.value = data.profiles || [];
            settingsStore.setConfig({ ...DEFAULT_SETTINGS, ...data.config });

            updateSnapshot();
            lastUpdated.value = new Date();
            dataCache.set(data);
            return true;
        } catch (error) {
            console.error('hydrateFromData failed:', error);
            return false;
        }
    }

    async function fetchData(forceRefresh = false) {
        if (isLoading.value) return;

        // Effective Cache Check
        if (hasDataLoaded.value && !forceRefresh) return;

        if (!forceRefresh) {
            const cachedData = dataCache.get();
            if (cachedData) {
                hydrateFromData(cachedData);
                return;
            }
        }

        isLoading.value = true;
        try {
            const data = await api.get('/api/data');

            if (data.error) {
                throw new Error(data.error);
            }

            hydrateFromData(data); // Re-use hydration logic
            clearDirty();

        } catch (error) {
            console.error('Failed to fetch data:', error);
            showToast('获取数据失败: ' + error.message, 'error');
            throw error;
        } finally {
            isLoading.value = false;
        }
    }

    async function saveData() {
        if (isLoading.value) {
            showToast('操作过于频繁，请稍候...', 'warning');
            return;
        }

        isLoading.value = true;
        saveState.value = 'saving';

        try {
            const sanitizedSubs = subscriptions.value.map(sub => {
                const { isUpdating, ...rest } = sub;
                return rest;
            });

            const payload = {
                misubs: sanitizedSubs,
                profiles: profiles.value
            };

            const result = await api.post('/api/misubs', payload);

            if (!result.success) {
                throw new Error(result.message || '保存失败');
            }

            // Update local state with backend response (Source of Truth)
            if (result.data) {
                if (result.data.misubs) subscriptions.value = result.data.misubs;
                if (result.data.profiles) profiles.value = result.data.profiles;
            }

            updateSnapshot();

            showToast('数据已保存', 'success');
            lastUpdated.value = new Date();
            clearDirty();
            saveState.value = 'success';

            // Auto reset idle state
            setTimeout(() => {
                if (saveState.value === 'success') {
                    saveState.value = 'idle';
                }
            }, 2000);

            // Update cache
            dataCache.set(payload); // Note: ideally we cache the RESULT from backend, but payload is close enough for simple cache

        } catch (error) {
            console.error('[Store] Failed to save data:', error);
            showToast('保存数据失败: ' + error.message, 'error');
            saveState.value = 'idle';
            throw error;
        } finally {
            isLoading.value = false;
        }
    }

    async function saveSettings(newSettings) {
        editorStore.setLoading(true);
        try {
            const result = await api.post('/api/settings', newSettings);

            if (!result.success) {
                throw new Error(result.message || '保存设置失败');
            }

            settingsStore.updateConfig(newSettings);
            showToast('设置已更新', 'success');

        } catch (error) {
            console.error('Failed to save settings:', error);
            showToast('保存设置失败: ' + error.message, 'error');
            throw error;
        } finally {
            editorStore.setLoading(false);
        }
    }

    // --- Helpers ---

    function updateSnapshot() {
        lastSavedData = {
            subscriptions: JSON.parse(JSON.stringify(subscriptions.value)),
            profiles: JSON.parse(JSON.stringify(profiles.value))
        };
    }

    function clearCachedData() {
        dataCache.clear();
    }

    // --- Proxy Actions (Mutators) ---
    function addSubscription(subscription) {
        subscriptions.value.unshift(subscription);
    }

    function overwriteSubscriptions(items) {
        subscriptions.value = items;
    }

    function removeSubscription(id) {
        const index = subscriptions.value.findIndex(s => s.id === id);
        if (index !== -1) {
            subscriptions.value.splice(index, 1);
        }
    }

    function updateSubscription(id, updates) {
        const index = subscriptions.value.findIndex(s => s.id === id);
        if (index !== -1) {
            subscriptions.value[index] = { ...subscriptions.value[index], ...updates };
        }
    }

    function addProfile(profile) {
        profiles.value.unshift(profile);
    }

    function overwriteProfiles(items) {
        profiles.value = items;
    }

    function removeProfile(id) {
        const index = profiles.value.findIndex(p => p.id === id || p.customId === id);
        if (index !== -1) {
            profiles.value.splice(index, 1);
        }
    }

    function removeManualNodeFromProfiles(nodeIds) {
        const idsToRemove = Array.isArray(nodeIds) ? new Set(nodeIds) : new Set([nodeIds]);
        if (idsToRemove.size === 0) return;

        let modified = false;
        profiles.value.forEach(profile => {
            if (Array.isArray(profile.manualNodes) && profile.manualNodes.length > 0) {
                const originalLength = profile.manualNodes.length;
                profile.manualNodes = profile.manualNodes.filter(id => !idsToRemove.has(id));
                if (profile.manualNodes.length !== originalLength) {
                    modified = true;
                }
            }
        });

        if (modified && isDev) {
            console.debug('[DataStore] Cleaned up manual node references from profiles');
        }
    }

    function removeSubscriptionFromProfiles(subIds) {
        const idsToRemove = Array.isArray(subIds) ? new Set(subIds) : new Set([subIds]);
        if (idsToRemove.size === 0) return;

        let modified = false;
        profiles.value.forEach(profile => {
            if (Array.isArray(profile.subscriptions) && profile.subscriptions.length > 0) {
                const originalLength = profile.subscriptions.length;
                profile.subscriptions = profile.subscriptions.filter(id => !idsToRemove.has(id));
                if (profile.subscriptions.length !== originalLength) {
                    modified = true;
                }
            }
        });

        if (modified && isDev) {
            console.debug('[DataStore] Cleaned up subscription references from profiles');
        }
    }

    // --- Dirty State Proxies ---
    function markDirty() {
        if (saveState.value === 'success') {
            saveState.value = 'idle';
        }
        editorStore.markDirty();
    }

    function clearDirty() {
        editorStore.clearDirty();
    }

    return {
        // State
        subscriptions,
        profiles,
        settings,
        isLoading,
        saveState,
        lastUpdated,
        hasDataLoaded,
        isDirty,

        // Getters
        activeSubscriptions,
        activeProfiles,

        // Actions
        fetchData,
        saveData,
        saveSettings,
        hydrateFromData,
        clearCachedData,

        // Helpers
        addSubscription,
        overwriteSubscriptions,
        removeSubscription,
        updateSubscription,
        addProfile,
        overwriteProfiles,
        removeProfile,
        removeManualNodeFromProfiles,
        removeSubscriptionFromProfiles,
        markDirty,
        clearDirty
    };
});

