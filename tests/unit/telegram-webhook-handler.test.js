import { beforeEach, describe, expect, it, vi } from 'vitest';

const createAdapter = vi.fn();
const getStorageType = vi.fn();
const clearAllNodeCaches = vi.fn();

vi.mock('../../functions/storage-adapter.js', () => ({
  StorageFactory: {
    createAdapter: (...args) => createAdapter(...args),
    getStorageType: (...args) => getStorageType(...args)
  }
}));

vi.mock('../../functions/services/node-cache-service.js', () => ({
  clearAllNodeCaches: (...args) => clearAllNodeCaches(...args)
}));

vi.mock('../../functions/modules/utils.js', () => ({
  createJsonResponse: (data, status = 200) => new Response(JSON.stringify(data), { status }),
  JSON_BODY_LIMITS: { auth: 16 * 1024, small: 128 * 1024, normal: 1024 * 1024, large: 5 * 1024 * 1024 },
  readJsonWithLimit: async request => request.json(),
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
    clearAllNodeCaches.mockResolvedValue({ cleared: 1, failed: 0 });
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  });

  it('rejects webhook requests when secret is missing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
    try {
      const response = await handleTelegramWebhook(createRequest({
        message: {
          text: '/start',
          chat: { id: 1001 },
          from: { id: 1 }
        }
      }, ''), { MISUB_KV: null });

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: 'Webhook secret required' });
      expect(errorSpy).toHaveBeenCalledWith('[Telegram Push] Missing webhook secret');
      expect(global.fetch).not.toHaveBeenCalled();
      expect(state.settings.telegram_push_config.webhook_secret).toBe('');
    } finally {
      errorSpy.mockRestore();
    }
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
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { state, adapter } = createState();
    createAdapter.mockReturnValue(adapter);

    const { handleTelegramWebhook } = await import('../../functions/modules/handlers/telegram-webhook-handler.js');

    try {
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
      expect(clearAllNodeCaches).toHaveBeenCalledTimes(1);
      expect(clearAllNodeCaches).toHaveBeenCalledWith(adapter);
      expect(infoSpy).toHaveBeenCalledWith('[Telegram Push] Cleared 1 node caches after node import');
      expect(infoSpy).toHaveBeenCalledWith('[Telegram Push] User 1 added 1 items (Ignored 0)');
    } finally {
      infoSpy.mockRestore();
    }
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

  it('shows separate Telegram list entry points instead of mixing manual nodes and airport subscriptions', async () => {
    const { adapter } = createState({
      subscriptions: [
        { id: 'node-1', name: 'HK VLESS', url: 'vless://uuid@example.com:443#HK', enabled: true },
        { id: 'airport-1', name: '机场订阅', url: 'https://airport.example/sub', enabled: true }
      ]
    });
    createAdapter.mockReturnValue(adapter);

    const { handleTelegramWebhook } = await import('../../functions/modules/handlers/telegram-webhook-handler.js');
    await handleTelegramWebhook(createRequest({
      message: {
        text: '/list',
        chat: { id: 4001 },
        from: { id: 1 }
      }
    }), { MISUB_KV: null });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.text).toContain('请选择列表类型');
    expect(body.text).toContain('节点列表');
    expect(body.text).toContain('机场列表');
    expect(body.text).not.toContain('HK VLESS');
    expect(body.text).not.toContain('airport.example');
    expect(body.reply_markup.inline_keyboard.flat()).toEqual(expect.arrayContaining([
      expect.objectContaining({ callback_data: 'cmd_list_node' }),
      expect.objectContaining({ callback_data: 'cmd_list_sub' })
    ]));
  });

  it('opens an airport subscription from an old mixed /list callback index instead of reporting object missing', async () => {
    const subscriptions = Array.from({ length: 29 }, (_, i) => ({
      id: `node-${i + 1}`,
      name: `Node ${i + 1}`,
      url: `vless://uuid@example${i + 1}.com:443#Node-${i + 1}`,
      enabled: true
    }));
    subscriptions.push({
      id: 'airport-30',
      name: '机场订阅 xhj',
      url: 'https://airport.example/sub/token',
      enabled: true
    });

    const { adapter } = createState({
      settings: {
        telegram_push_config: {
          enabled: true,
          bot_token: 'bot-token',
          webhook_secret: 'secret-token',
          allowed_user_ids: ['1', '2'],
          auto_bind: true,
          user_bindings: { '1': 'profile-1' }
        }
      },
      subscriptions
    });
    createAdapter.mockReturnValue(adapter);

    const { handleTelegramWebhook } = await import('../../functions/modules/handlers/telegram-webhook-handler.js');
    await handleTelegramWebhook(createRequest({
      callback_query: {
        id: 'callback-1',
        data: 'node_action_sub_29',
        from: { id: 1 },
        message: { message_id: 88, chat: { id: 4002 } }
      }
    }), { MISUB_KV: null });

    const fetchBodies = global.fetch.mock.calls.map(call => JSON.parse(call[1].body));
    expect(fetchBodies).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ text: '对象不存在', show_alert: true })
    ]));
    expect(fetchBodies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        chat_id: 4002,
        message_id: 88,
        text: expect.stringContaining('机场订阅 xhj'),
        reply_markup: expect.objectContaining({
          inline_keyboard: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({ callback_data: 'link_sub_0' })
            ])
          ])
        })
      })
    ]));
  });
});
