import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchSettings, saveSettings, resetSettings, showToast } = vi.hoisted(() => ({
    fetchSettings: vi.fn(),
    saveSettings: vi.fn(),
    resetSettings: vi.fn(),
    showToast: vi.fn(),
}));

vi.mock('../../src/lib/api.js', () => ({
    fetchSettings,
    saveSettings,
    resetSettings,
}));

vi.mock('../../src/stores/toast.js', () => ({
    useToastStore: () => ({ showToast }),
}));

vi.mock('../../src/composables/useBackupLogic.js', () => ({
    useBackupLogic: () => ({
        exportBackup: vi.fn(),
        importBackup: vi.fn(),
    }),
}));

import { useSettingsLogic } from '../../src/composables/useSettingsLogic.js';

describe('useSettingsLogic externalApi normalization', () => {
    beforeEach(() => {
        fetchSettings.mockReset();
        saveSettings.mockReset();
        resetSettings.mockReset();
        showToast.mockReset();
    });

    it('hydrates missing externalApi defaults when loading settings', async () => {
        fetchSettings.mockResolvedValue({
            success: true,
            data: {
                storageType: 'kv',
                externalApi: { enabled: true },
            },
        });

        const { settings, loadSettings } = useSettingsLogic();
        await loadSettings();

        expect(settings.value.externalApi.enabled).toBe(true);
        expect(settings.value.externalApi.tokens).toEqual([{ name: 'default', token: '' }]);
    });

    it('shows a visible reload countdown and reloads automatically after saving', async () => {
        vi.useFakeTimers();
        saveSettings.mockResolvedValue({ success: true });
        const reload = vi.fn();
        const originalReload = window.location.reload;
        window.location.reload = reload;

        try {
            const { settings, handleSave, restartCountdown } = useSettingsLogic();
            settings.value.storageType = 'kv';

            expect(await handleSave()).toBe(true);
            expect(restartCountdown.value).toBe(3);
            await vi.advanceTimersByTimeAsync(1000);
            expect(restartCountdown.value).toBe(2);
            await vi.advanceTimersByTimeAsync(2000);
            expect(reload).toHaveBeenCalledTimes(1);
            expect(restartCountdown.value).toBe(0);
        } finally {
            window.location.reload = originalReload;
            vi.useRealTimers();
        }
    });

    it('normalizes blank token names before saving', async () => {
        saveSettings.mockResolvedValue({ success: true });
        const originalReload = window.location.reload;
        window.location.reload = vi.fn();

        try {
            const { settings, handleSave } = useSettingsLogic();
            settings.value.storageType = 'kv';
            settings.value.externalApi = {
                enabled: true,
                tokens: [{ name: '   ', token: 'abc123' }],
            };

            const result = await handleSave();

            expect(result).toBe(true);
            expect(saveSettings).toHaveBeenCalledTimes(1);
            expect(saveSettings.mock.calls[0][0].externalApi).toEqual({
                enabled: true,
                tokens: [{ name: 'token-1', token: 'abc123' }],
            });
        } finally {
            window.location.reload = originalReload;
        }
    });
});
