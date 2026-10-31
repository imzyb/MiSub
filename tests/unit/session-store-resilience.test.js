import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const apiMocks = vi.hoisted(() => ({
    fetchInitialData: vi.fn(),
    fetchPublicConfig: vi.fn(),
    login: vi.fn(),
    apiGet: vi.fn(),
}));

vi.mock('../../src/lib/api', () => apiMocks);
vi.mock('../../src/lib/http.js', () => ({
    api: { get: apiMocks.apiGet },
}));
vi.mock('../../src/router', () => ({
    default: { push: vi.fn() },
}));
vi.mock('../../src/utils/errorHandler.js', () => ({
    handleError: vi.fn(),
}));

describe('session store resilience', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it('falls back to the default login entry when public config cannot be fetched', async () => {
        const { useSessionStore } = await import('../../src/stores/session.js');
        const store = useSessionStore();

        apiMocks.fetchInitialData.mockResolvedValue({
            success: false,
            error: '认证失败,请重新登录',
            errorType: 'auth',
        });
        apiMocks.fetchPublicConfig.mockResolvedValue({
            success: false,
            error: 'HTTP 500',
            errorType: 'server',
        });

        await store.checkSession();

        expect(store.sessionState).toBe('loggedOut');
        expect(store.publicConfig.customLoginPath).toBe('login');
        expect(store.publicConfig.enablePublicPage).toBe(false);
    });

    it('does not let a failed public config request mask a successful authenticated session', async () => {
        const { useSessionStore } = await import('../../src/stores/session.js');
        const store = useSessionStore();

        const data = {
            config: { password: 'changed', isDefaultPassword: false },
            misubs: [],
            profiles: [],
        };

        apiMocks.fetchInitialData.mockResolvedValue({ success: true, data });
        apiMocks.fetchPublicConfig.mockResolvedValue({
            success: false,
            error: 'HTTP 500',
            errorType: 'server',
        });

        await store.checkSession();

        expect(store.sessionState).toBe('loggedIn');
        expect(store.initialData).toEqual(data);
        expect(store.publicConfig.customLoginPath).toBe('login');
    });

    it('preserves the last known public config after a later fetch failure', async () => {
        const { useSessionStore } = await import('../../src/stores/session.js');
        const store = useSessionStore();
        const data = { config: {}, misubs: [], profiles: [] };
        apiMocks.fetchInitialData.mockResolvedValue({ success: true, data });
        apiMocks.fetchPublicConfig.mockResolvedValueOnce({
            success: true,
            data: { customLoginPath: 'admin-login', enablePublicPage: true },
        });
        await store.checkSession();

        apiMocks.fetchPublicConfig.mockResolvedValueOnce({ success: false, error: 'network down' });
        await store.checkSession();

        expect(store.publicConfig.customLoginPath).toBe('admin-login');
        expect(store.publicConfig.enablePublicPage).toBe(true);
    });

    it('较早发起的会话检查晚返回时，不覆盖最新会话和公开配置', async () => {
        const { useSessionStore } = await import('../../src/stores/session.js');
        const store = useSessionStore();
        const data = { config: { defaultSubName: '最新配置' }, misubs: [], profiles: [] };
        let completeEarlierCheck;

        apiMocks.fetchInitialData
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        completeEarlierCheck = resolve;
                    })
            )
            .mockResolvedValueOnce({ success: true, data });
        apiMocks.fetchPublicConfig
            .mockResolvedValueOnce({
                success: true,
                data: { customLoginPath: 'old-login', enablePublicPage: true },
            })
            .mockResolvedValueOnce({
                success: true,
                data: { customLoginPath: 'latest-login', enablePublicPage: false },
            });

        const earlierCheck = store.checkSession();
        await store.checkSession();
        completeEarlierCheck({ success: false, errorType: 'auth' });
        await earlierCheck;

        expect(store.sessionState).toBe('loggedIn');
        expect(store.initialData).toEqual(data);
        expect(store.subscriptionConfig).toEqual(data.config);
        expect(store.publicConfig.customLoginPath).toBe('latest-login');
        expect(store.publicConfig.enablePublicPage).toBe(false);
    });

    it('keeps a failed logout from claiming the session was cleared', async () => {
        const { useSessionStore } = await import('../../src/stores/session.js');
        const store = useSessionStore();
        store.sessionState = 'loggedIn';
        apiMocks.apiGet.mockRejectedValue(new Error('network down'));
        apiMocks.fetchInitialData.mockResolvedValue({ success: true, data: {} });

        const errorSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            await expect(store.logout()).resolves.toBe(false);
            expect(store.sessionState).toBe('loggedIn');
        } finally {
            errorSpy.mockRestore();
        }
    });

    it('waits for session confirmation before redirecting after login', async () => {
        const { useSessionStore } = await import('../../src/stores/session.js');
        const store = useSessionStore();
        apiMocks.login.mockResolvedValue({ success: true, data: {} });
        apiMocks.fetchInitialData.mockResolvedValue({ success: true, data: {} });
        apiMocks.fetchPublicConfig.mockResolvedValue({ success: true, data: {} });

        await store.login('password');

        expect(store.sessionState).toBe('loggedIn');
    });

    it('keeps default-password warning from login response for immediate frontend display', async () => {
        const { useSessionStore } = await import('../../src/stores/session.js');
        const store = useSessionStore();

        apiMocks.login.mockResolvedValue({
            success: true,
            data: {
                securityWarning: {
                    type: 'default_admin_password',
                    shouldChangePassword: true,
                    message: '当前正在使用默认管理员密码 admin，请登录后立即修改。',
                },
            },
        });
        apiMocks.fetchInitialData.mockResolvedValue({
            success: true,
            data: { config: { isDefaultPassword: true }, misubs: [], profiles: [] },
        });
        apiMocks.fetchPublicConfig.mockResolvedValue({
            success: true,
            data: { customLoginPath: 'login' },
        });

        await store.login('admin');

        expect(store.securityWarning).toMatchObject({
            type: 'default_admin_password',
            shouldChangePassword: true,
        });
    });
});
