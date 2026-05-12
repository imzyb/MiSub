import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const apiMocks = vi.hoisted(() => ({
  fetchInitialData: vi.fn(),
  fetchPublicConfig: vi.fn(),
  login: vi.fn()
}));

vi.mock('../../src/lib/api', () => apiMocks);
vi.mock('../../src/lib/http.js', () => ({
  api: { get: vi.fn() }
}));
vi.mock('../../src/router', () => ({
  default: { push: vi.fn() }
}));
vi.mock('../../src/utils/errorHandler.js', () => ({
  handleError: vi.fn()
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
      errorType: 'auth'
    });
    apiMocks.fetchPublicConfig.mockResolvedValue({
      success: false,
      error: 'HTTP 500',
      errorType: 'server'
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
      profiles: []
    };

    apiMocks.fetchInitialData.mockResolvedValue({ success: true, data });
    apiMocks.fetchPublicConfig.mockResolvedValue({
      success: false,
      error: 'HTTP 500',
      errorType: 'server'
    });

    await store.checkSession();

    expect(store.sessionState).toBe('loggedIn');
    expect(store.initialData).toEqual(data);
    expect(store.publicConfig.customLoginPath).toBe('login');
  });
});
