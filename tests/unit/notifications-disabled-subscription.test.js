import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendTgNotification } = vi.hoisted(() => ({
    sendTgNotification: vi.fn(),
}));

vi.mock('../../functions/services/notification-service.js', () => ({
    sendTgNotification,
    sendEnhancedTgNotification: vi.fn(),
    tgEscape: (value) => String(value || ''),
}));

describe('subscription notifications', () => {
    beforeEach(() => {
        sendTgNotification.mockReset();
        sendTgNotification.mockResolvedValue(true);
    });

    it('does not send expiration reminders for disabled subscriptions', async () => {
        const { checkAndNotify } = await import('../../functions/modules/notifications.js');
        const nowSeconds = Math.floor(Date.now() / 1000);
        const subscription = {
            id: 'disabled-subscription',
            name: 'Disabled Subscription',
            enabled: false,
            userInfo: {
                upload: 0,
                download: 0,
                total: 100,
                expire: nowSeconds + 24 * 60 * 60,
            },
        };

        await checkAndNotify(
            subscription,
            {
                BotToken: 'test-token',
                ChatID: 'test-chat',
                NotifyThresholdDays: 7,
            },
            {}
        );

        expect(sendTgNotification).not.toHaveBeenCalled();
        expect(subscription.lastNotifiedExpire).toBeUndefined();
    });

    it('still sends expiration reminders for enabled subscriptions', async () => {
        const { checkAndNotify } = await import('../../functions/modules/notifications.js');
        const nowSeconds = Math.floor(Date.now() / 1000);
        const subscription = {
            id: 'enabled-subscription',
            name: 'Enabled Subscription',
            enabled: true,
            userInfo: {
                upload: 0,
                download: 0,
                total: 0,
                expire: nowSeconds + 24 * 60 * 60,
            },
        };

        await checkAndNotify(
            subscription,
            {
                BotToken: 'test-token',
                ChatID: 'test-chat',
                NotifyThresholdDays: 7,
            },
            {}
        );

        expect(sendTgNotification).toHaveBeenCalledTimes(1);
        expect(sendTgNotification.mock.calls[0][1]).toContain('订阅临期提醒');
        expect(subscription.lastNotifiedExpire).toEqual(expect.any(Number));
    });
});
