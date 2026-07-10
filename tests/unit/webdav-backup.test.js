import { describe, it, expect, beforeEach, vi } from 'vitest';

function createMemoryKV(initial = {}) {
  const store = new Map(Object.entries(initial).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
  return {
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); },
    async delete(key) { store.delete(key); },
    async list({ prefix = '' } = {}) {
      return { keys: Array.from(store.keys()).filter(name => name.startsWith(prefix)).map(name => ({ name })) };
    },
    dump() { return Object.fromEntries(store); }
  };
}

const sampleSubscriptions = [
  { id: 'airport-1', name: '机场订阅', url: 'https://airport.example/sub', includeRules: ['HK'], excludeRules: ['倍率'] },
  { id: 'manual-1', name: '手动节点', url: 'vmess://sanitized', groups: ['manual'] }
];
const sampleProfiles = [{ id: 'profile-1', name: '订阅组', subscriptions: ['airport-1'], manualNodes: ['manual-1'], ruleLevel: 'std' }];
const sampleTemplates = [{
  id: 'tpl-1',
  name: '自定义规则',
  description: '',
  type: 'ini',
  content: '[custom]\nruleset=🎯 全球直连,[]MATCH',
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}];

function createEnv(settings = {}) {
  return {
    MISUB_KV: createMemoryKV({
      worker_settings_v1: {
        storageType: 'kv',
        mytoken: 'auto',
        webdavBackup: {
          enabled: true,
          endpoint: 'https://dav.example/remote.php/dav/files/user',
          username: 'user',
          password: 'secret',
          remotePath: '/MiSub',
          backupScope: 'dataOnly'
        },
        adminPassword: 'should-not-export',
        cookieSecret: 'should-not-export',
        ...settings
      },
      misub_subscriptions_v1: sampleSubscriptions,
      misub_profiles_v1: sampleProfiles,
      misub_rule_templates_v1: sampleTemplates,
      unrelated_key: { keep: true }
    })
  };
}

describe('WebDAV backup payload and restore', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('builds data-only payload with complete business collections but without settings', async () => {
    const { buildBackupPayload } = await import('../../functions/modules/webdav-backup-handler.js');
    const payload = await buildBackupPayload(createEnv(), { scope: 'dataOnly', trigger: 'manual' });

    expect(payload.app).toBe('MiSub');
    expect(payload.type).toBe('misub-backup');
    expect(payload.scope).toBe('dataOnly');
    expect(payload.data.subscriptions).toEqual(sampleSubscriptions);
    expect(payload.data.profiles).toEqual(sampleProfiles);
    expect(payload.data.ruleTemplates).toHaveLength(1);
    expect(payload.data.ruleTemplates[0]).toMatchObject({
      id: 'tpl-1',
      name: '自定义规则',
      type: 'ini',
      content: '[custom]\nruleset=🎯 全球直连,[]MATCH',
      enabled: true
    });
    expect(payload.data.settings).toBeNull();
  });

  it('builds data-and-settings payload while excluding WebDAV config and runtime secrets', async () => {
    const { buildBackupPayload } = await import('../../functions/modules/webdav-backup-handler.js');
    const payload = await buildBackupPayload(createEnv({ cronSecret: 'keep-cron-for-restore', FileName: 'MiSubTest' }), { scope: 'dataAndSettings' });

    expect(payload.scope).toBe('dataAndSettings');
    expect(payload.data.settings.FileName).toBe('MiSubTest');
    expect(payload.data.settings.cronSecret).toBe('keep-cron-for-restore');
    expect(payload.data.settings.webdavBackup).toBeUndefined();
    expect(payload.data.settings.adminPassword).toBeUndefined();
    expect(payload.data.settings.cookieSecret).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('secret');
    expect(JSON.stringify(payload)).not.toContain('https://dav.example');
  });

  it('restores data-only backups by replacing MiSub collections without touching settings or unknown keys', async () => {
    const { restoreBackupPayload } = await import('../../functions/modules/webdav-backup-handler.js');
    const env = createEnv({ FileName: 'Before' });
    const restorePayload = {
      version: 1,
      app: 'MiSub',
      type: 'misub-backup',
      scope: 'dataOnly',
      data: {
        subscriptions: [{ id: 'new-sub', name: 'New', url: 'https://new.example/sub' }],
        profiles: [{ id: 'new-profile', name: 'New Profile', subscriptions: ['new-sub'], manualNodes: [] }],
        ruleTemplates: [{ id: 'new-tpl', name: 'New Template', content: 'rules: []' }],
        settings: null
      }
    };

    const result = await restoreBackupPayload(env, restorePayload, { createSnapshot: false });
    const kv = env.MISUB_KV.dump();

    expect(result.success).toBe(true);
    expect(JSON.parse(kv.misub_subscriptions_v1)).toEqual(restorePayload.data.subscriptions);
    expect(JSON.parse(kv.misub_profiles_v1)).toEqual(restorePayload.data.profiles);
    expect(JSON.parse(kv.misub_rule_templates_v1)).toEqual(restorePayload.data.ruleTemplates);
    expect(JSON.parse(kv.worker_settings_v1).FileName).toBe('Before');
    expect(JSON.parse(kv.unrelated_key)).toEqual({ keep: true });
  });

  it('restores data-and-settings backups but preserves current WebDAV config', async () => {
    const { restoreBackupPayload } = await import('../../functions/modules/webdav-backup-handler.js');
    const env = createEnv({ FileName: 'Before' });
    const currentWebdav = JSON.parse(env.MISUB_KV.dump().worker_settings_v1).webdavBackup;

    await restoreBackupPayload(env, {
      version: 1,
      app: 'MiSub',
      type: 'misub-backup',
      scope: 'dataAndSettings',
      data: {
        subscriptions: [],
        profiles: [],
        ruleTemplates: [],
        settings: {
          FileName: 'Restored',
          webdavBackup: { endpoint: 'https://old.example', password: 'old-secret' },
          adminPassword: 'bad',
          cookieSecret: 'bad'
        }
      }
    }, { createSnapshot: false });

    const settings = JSON.parse(env.MISUB_KV.dump().worker_settings_v1);
    expect(settings.FileName).toBe('Restored');
    expect(settings.webdavBackup).toEqual(currentWebdav);
    expect(settings.adminPassword).toBeUndefined();
    expect(settings.cookieSecret).toBeUndefined();
  });
});
