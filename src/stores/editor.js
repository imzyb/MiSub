import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useEditorStore = defineStore('editor', () => {
    const isDirty = ref(false);
    const isLoading = ref(false);
    const lastUpdated = ref(null);

    function markDirty() {

        isDirty.value = true;
    }

    function clearDirty() {

        isDirty.value = false;
    }

    function setLoading(loading) {
        isLoading.value = loading;
    }

    function setLastUpdated(date) {
        lastUpdated.value = date;
    }

    return {
        isDirty,
        isLoading,
        lastUpdated,
        markDirty,
        clearDirty,
        setLoading,
        setLastUpdated
    };
});
