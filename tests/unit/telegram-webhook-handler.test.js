import { beforeEach, describe, expect, it, vi } from 'vitest';

const createAdapter = vi.fn();
const getStorageType = vi.fn();

vi.mock('../../functions/storage-adapter.js', () => ({
  StorageFactory: {
    createAdapter: (...args) => createAdapter(...args),
    getStorageType: (...args) => getStorageType(...args)
  }
}));

vi.mock('../../functions/modules/utils.js', () => ({
  createJsonResponse: (data, status = 200) => new Response(JSON.stringify(data), { status }),
  escapeHtml: (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}));

function createState(overrides = {}) {
  const state = {
    settings: {
      telegram_push_config: {
        enabled: true,
        bot_token: 'bot-token',
        webhook_secret: 'secret-token',
        allowed_user_ids: ['1', '2'],
        auto_bind: true,
        user_bindings: {}
      }
    },
    subscriptions: [],
    profiles: [
      { id: 'profile-1', name: 'Profile One', subscriptions: [], manualNodes: [] },
      { id: 'profile-2', name: 'Profile Two', subscriptions: [], manualNodes: [] }
    ],
    ...overrides
  };

  return {
    state,
    adapter: {
      get: vi.fn(async () => state.settings),
      put: vi.fn(async (_key, value) => {
        state.settings = value;
        return true;
      }),
      getAllSubscriptions: vi.fn(async () => state.subscriptions),
      putAllSubscriptions: vi.fn(async value => {
        state.subscriptions = value;
        return true;
      }),
      getAllProfiles: vi.fn(async () => state.profiles),
      putAllProfiles: vi.fn(async value => {
        state.profiles = value;
        return true;
      })
    }
  };
}

function createRequest(update, secret = 'secret-token') {
  return new Request('https://example.com/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': secret
    },
    body: JSON.stringify(update)
  });
}

describe('handleTelegramWebhook', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getStorageType.mockResolvedValue('d1');
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  });

  it('rejects webhook requests when secret is missing', async () => {
    const { state, adapter } = createState({
      settings: {
        telegram_push_config: {
          enabled: true,
          bot_token: 'bot-token',
          webhook_secret: '',
          allowed_user_ids: ['1']
        }
      }
    });
    createAdapter.mockReturnValue(adapter);

    const { handleTelegramWebhook } = await import('../../functions/modules/handlers/telegram-webhook-handler.js');
    const response = await handleTelegramWebhook(createRequest({
      message: {
        text: '/start',
        chat: { id: 1001 },
        from: { id: 1 }
      }
    }, ''), { MISUB_KV: null });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Webhook secret required' });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(state.settings.telegram_push_config.webhook_secret).toBe('');
  });

  it('denies access by default when whitelist is empty', async () => {
    const { adapter } = createState({
      settings: {
        telegram_push_config: {
          enabled: true,
          bot_token: 'bot-token',
          webhook_secret: 'secret-token',
          allowed_user_ids: [],
          allow_all_users: false
        }
      }
    });
    createAdapter.mockReturnValue(adapter);

    const { handleTelegramWebhook } = await import('../../functions/modules/handlers/telegram-webhook-handler.js');
    const response = await handleTelegramWebhook(createRequest({
      message: {
        text: '/start',
        chat: { id: 1001 },
        from: { id: 123456 }
      }
    }), { MISUB_KV: null });

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe(1001);
    expect(body.text).toContain('未配置白名单');
  });

  it('stores bindings per telegram user and auto-binds imports to the correct profile', async () => {
    const { state, adapter } = createState();
    createAdapter.mockReturnValue(adapter);

    const { handleTelegramWebhook } = await import('../../functions/modules/handlers/telegram-webhook-handler.js');

    await handleTelegramWebhook(createRequest({
      message: {
        text: '/bind 1',
        chat: { id: 2001 },
        from: { id: 1 }
      }
    }), { MISUB_KV: null });

    await handleTelegramWebhook(createRequest({
      message: {
        text: '/bind 2',
        chat: { id: 2002 },
        from: { id: 2 }
      }
    }), { MISUB_KV: null });

    await handleTelegramWebhook(createRequest({
      message: {
        text: 'ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo0NDM=#Node-A',
        chat: { id: 2001 },
        from: { id: 1 }
      }
    }), { MISUB_KV: null });

    expect(state.settings.telegram_push_config.user_bindings).toEqual({
      '1': 'profile-1',
      '2': 'profile-2'
    });
    expect(state.subscriptions).toHaveLength(1);
    expect(state.profiles[0].manualNodes).toEqual([state.subscriptions[0].id]);
    expect(state.profiles[1].manualNodes).toEqual([]);
  });

  it('keeps the original command surface in help output', async () => {
    const { adapter } = createState();
    createAdapter.mockReturnValue(adapter);

    const { handleTelegramWebhook } = await import('../../functions/modules/handlers/telegram-webhook-handler.js');
    await handleTelegramWebhook(createRequest({
      message: {
        text: '/help',
        chat: { id: 3001 },
        from: { id: 1 }
      }
    }), { MISUB_KV: null });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.text).toContain('/delete');
    expect(body.text).toContain('/search');
    expect(body.text).toContain('/sort');
  });
});
