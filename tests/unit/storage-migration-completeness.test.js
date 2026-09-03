import { describe, it, expect } from 'vitest';
import {
  DataMigrator,
  D1_MIGRATION_KEYS,
  D1_MIGRATION_KEY_PREFIXES
} from '../../functions/storage-adapter.js';

/** 内存版 KV 命名空间，满足 isKVNamespace 的鸭子类型 */
function makeKV(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    store,
    get: async key => store.get(key) ?? null,
    put: async (key, value) => { store.set(key, value); },
    delete: async key => { store.delete(key); },
    list: async ({ prefix } = {}) => ({
      keys: [...store.keys()].filter(k => !prefix || k.startsWith(prefix)).map(name => ({ name }))
    })
  };
}

/** 内存版 D1：只实现 DataMigrator 用到的 prepare/bind/run/first */
function makeD1() {
  const tables = { subscriptions: new Map(), profiles: new Map(), settings: new Map() };
  return {
    tables,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              if (/^\s*CREATE/i.test(sql)) return { success: true };
              const table = sql.match(/INTO\s+(\w+)/i)?.[1];
              if (table && tables[table]) tables[table].set(args[0], args[1]);
              return { success: true };
            },
            async first() { return null; },
            async all() { return { results: [] }; }
          };
        },
        async run() { return { success: true }; }
      };
    }
  };
}

// 用户在 KV 上实际会有的业务数据
const KV_FIXTURE = {
  misub_subscriptions_v1: [{ id: 's1', url: 'https://example.com/sub' }],
  misub_profiles_v1: [{ id: 'p1', name: '组' }],
  worker_settings_v1: { storageType: 'kv', mytoken: 't' },
  misub_dns_templates_v1: [{ id: 'dns-1', kind: 'policy', policy: { mode: 'clean' } }],
  misub_rule_templates_v1: [{ id: 'rule-1' }],
  misub_clients_v1: [{ id: 'c1' }],
  misub_guestbook_v1: [{ id: 'g1' }],
  misub_settings_v1: { legacy: true },
  misub_restore_snapshot_latest: { at: '2026-09-03' },
  misub_profile_download_count_p1: 42,
  misub_profile_download_count_p2: 7,
  // 刻意不该被搬走的
  misub_webdav_backup_lock: { lockedAt: 1 },
  misub_system_logs: [{ msg: 'noise' }],
  misub_error_reports: [{ msg: 'boom' }]
};

describe('KV → D1 迁移清单完整性', () => {
  it('迁移清单覆盖全部业务键', () => {
    expect(D1_MIGRATION_KEYS).toEqual(expect.arrayContaining([
      'misub_subscriptions_v1',
      'misub_profiles_v1',
      'misub_dns_templates_v1',
      'misub_rule_templates_v1',
      'misub_clients_v1',
      'misub_guestbook_v1',
      'misub_settings_v1',
      'misub_restore_snapshot_latest'
    ]));
    expect(D1_MIGRATION_KEY_PREFIXES).toContain('misub_profile_download_count_');
  });

  it('清单不含瞬时锁与诊断日志', () => {
    for (const key of ['misub_webdav_backup_lock', 'misub_system_logs', 'misub_error_reports', 'misub_data_v1']) {
      expect(D1_MIGRATION_KEYS).not.toContain(key);
    }
  });
});

describe('migrateKVToD1 实际搬运行为', () => {
  const run = async (fixture = KV_FIXTURE) => {
    const kv = makeKV(fixture);
    const db = makeD1();
    const result = await DataMigrator.migrateKVToD1({ MISUB_KV: kv, MISUB_DB: db });
    return { kv, db, result };
  };

  it('DNS 模板会被搬到 D1——修复前正是这一条静默丢失', async () => {
    const { db, result } = await run();
    expect(result.keys['misub_dns_templates_v1']).toBe('migrated');
    expect(db.tables.settings.has('misub_dns_templates_v1')).toBe(true);

    const stored = JSON.parse(db.tables.settings.get('misub_dns_templates_v1'));
    expect(stored[0]).toMatchObject({ id: 'dns-1', kind: 'policy' });
  });

  it('规则模板 / 客户端 / 留言板 / 恢复快照一并搬运', async () => {
    const { result } = await run();
    for (const key of ['misub_rule_templates_v1', 'misub_clients_v1', 'misub_guestbook_v1', 'misub_restore_snapshot_latest']) {
      expect(result.keys[key]).toBe('migrated');
    }
  });

  it('按前缀枚举搬运订阅组下载计数', async () => {
    const { result } = await run();
    expect(result.keys['misub_profile_download_count_p1']).toBe('migrated');
    expect(result.keys['misub_profile_download_count_p2']).toBe('migrated');
  });

  it('瞬时锁与诊断日志不被搬运', async () => {
    const { result, db } = await run();
    for (const key of ['misub_webdav_backup_lock', 'misub_system_logs', 'misub_error_reports']) {
      expect(result.keys[key]).toBeUndefined();
      expect(db.tables.settings.has(key)).toBe(false);
    }
  });

  it('settings 搬运时把 storageType 翻成 d1', async () => {
    const { db, result } = await run();
    expect(result.settings).toBe(true);
    const settings = JSON.parse(db.tables.settings.get('main'));
    expect(settings.storageType).toBe('d1');
    expect(settings.mytoken).toBe('t');
  });

  it('保留 subscriptions / profiles 两个布尔位，兼容旧调用方', async () => {
    const { result } = await run();
    expect(result.subscriptions).toBe(true);
    expect(result.profiles).toBe(true);
  });

  it('KV 里没有的键报 empty 而不是 failed', async () => {
    const { result } = await run({ worker_settings_v1: { storageType: 'kv' } });
    expect(result.keys['misub_dns_templates_v1']).toBe('empty');
    expect(result.errors).toEqual([]);
  });

  it('缺少 KV 绑定时抛错，不静默成功', async () => {
    await expect(DataMigrator.migrateKVToD1({ MISUB_DB: makeD1() }))
      .rejects.toThrow('No KV binding found');
  });
});
