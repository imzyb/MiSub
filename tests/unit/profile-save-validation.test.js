import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useDataStore } from '../../src/stores/useDataStore.js';
import { useProfiles } from '../../src/composables/useProfiles.js';

const showToast = vi.fn();
vi.mock('../../src/stores/toast', () => ({
    useToastStore: () => ({ showToast }),
}));

describe('handleSaveProfile validation', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        showToast.mockClear();
    });

    it('keeps the modal open and reports a duplicate custom id', () => {
        const dataStore = useDataStore();
        dataStore.profiles = [
            { id: 'p1', name: 'A', customId: 'home' },
            { id: 'p2', name: 'B', customId: '' },
        ];

        const { handleSaveProfile, showProfileModal, editingProfile } = useProfiles(vi.fn());
        editingProfile.value = { id: 'p2', name: 'B', customId: 'home' };
        showProfileModal.value = true;

        handleSaveProfile({ id: 'p2', name: 'B', customId: 'home' });

        expect(showToast).toHaveBeenCalledTimes(1);
        expect(showToast.mock.calls[0][1]).toBe('error');
        // 校验失败时弹窗必须保持打开，用户才能就地修改
        expect(showProfileModal.value).toBe(true);
        expect(dataStore.profiles.find((p) => p.id === 'p2').customId).toBe('');
    });

    it('closes the modal after a successful save', () => {
        const dataStore = useDataStore();
        dataStore.profiles = [{ id: 'p1', name: 'A', customId: '' }];

        const { handleSaveProfile, showProfileModal } = useProfiles(vi.fn());
        showProfileModal.value = true;

        handleSaveProfile({ id: 'p1', name: 'A', customId: 'home' });

        expect(showToast).not.toHaveBeenCalled();
        expect(showProfileModal.value).toBe(false);
        expect(dataStore.profiles[0].customId).toBe('home');
    });
});
